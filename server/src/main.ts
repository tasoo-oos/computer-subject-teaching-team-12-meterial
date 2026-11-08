// 서버 진입점 (docs/live-api.md §8.6): env 검증(§7) → http 서버 → socket.io → 로그 재생(§8.2).
// 실행: node --env-file=.env server/src/main.ts (빌드 단계 없음 — Node 24 네이티브 타입 스트리핑, §1.3).
//
// startServer(opts)를 테스트·스모크에서도 쓴다: lessons·activities를 주입해 가짜 활동·
// 테스트 레슨으로 서버 전체를 띄울 수 있다(§12 M2). CLI 경로는 실제 레슨·레지스트리를 쓴다.
import { randomInt } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Server } from 'socket.io';
import type {
  ActivityLogic,
  ClassCode,
  Lesson,
  OpenClassInfo,
} from '@gagyebu/live';
import { lesson, rehearsalLesson } from '@gagyebu/lesson';
import type { Env } from './env.ts';
import { validateEnv } from './env.ts';
import { LoginLimiter } from './auth.ts';
import { EndedCodes, issueCode } from './codes.ts';
import { openSessionLog, readSessionLog } from './log.ts';
import type { LiveIOServer, LiveSocket } from './room.ts';
import { Room, restoreRoom } from './room.ts';
import { handleApi } from './http.ts';
import { createStaticHandler } from './static.ts';
import { attachSockets } from './sockets.ts';
import { activities as defaultActivities } from './activities.ts';

export interface StartServerOptions {
  env: Env;
  /** lessonId → Lesson. 기본: 실제 수업 레슨(@gagyebu/lesson) */
  lessons?: Record<string, Lesson>;
  /** activity id → ActivityLogic. 기본: server/src/activities.ts 레지스트리 */
  activities?: Record<string, ActivityLogic<unknown, unknown, unknown, unknown>>;
  /** 정적 파일 루트. 기본: <repo>/src/dist */
  distDir?: string;
  /** 집계 스로틀 간격(기본 250ms, §5.6). 0이면 즉시(테스트) */
  statsIntervalMs?: number;
  /** 끝난 수업을 메모리에서 내려 보내기까지의 유예(기본 60초, §14 #144). CSV는 로그에서 다시 만든다 */
  endedGraceMs?: number;
  now?: () => number;
  random?: () => number;
}

export interface RunningServer {
  httpServer: ReturnType<typeof createServer>;
  io: LiveIOServer;
  env: Env;
  rooms: Map<ClassCode, Room>;
  /** 수업 열기: 코드 발급(§8.4) + Room 생성 + 로그 open(§8.2) */
  openClass(lessonId?: string): Promise<{ ok: true; code: ClassCode } | { ok: false; reason: 'invalid-target' }>;
  close(): Promise<void>;
}

/**
 * 서버 전체를 만든다: http(정적+API) + socket.io + 로그 재생.
 * listen은 호출자이가 한다(CLI: env.port, 테스트: 임시 포트 0).
 */
export async function startServer(opts: StartServerOptions): Promise<RunningServer> {
  const env = opts.env;
  const lessons = opts.lessons ?? { [lesson.id]: lesson, [rehearsalLesson.id]: rehearsalLesson };
  const activities = opts.activities ?? defaultActivities;
  const now = opts.now ?? Date.now;
  const statsIntervalMs = opts.statsIntervalMs ?? 250;

  const sessionsDir = join(env.dataDir, 'sessions');
  mkdirSync(sessionsDir, { recursive: true });
  const ended = new EndedCodes(env.dataDir);
  ended.load(now());

  const rooms = new Map<ClassCode, Room>();
  const roleSockets = new Set<LiveSocket>();
  const limiter = new LoginLimiter({ now });
  const endedGraceMs = opts.endedGraceMs ?? 60_000;
  const evictionTimers = new Set<ReturnType<typeof setTimeout>>();
  let closed = false;

  const getClasses = (): OpenClassInfo[] =>
    [...rooms.values()]
      .filter((r) => r.status === 'open')
      .sort((a, b) => a.openedAt - b.openedAt)
      .map((r) => ({ code: r.code, lessonId: r.lesson.id, openedAt: r.openedAt }));

  const broadcastClasses = (): void => {
    const classes = getClasses();
    for (const socket of roleSockets) socket.emit('classes', { classes });
  };

  const hooks = {
    getClasses,
    onClassesChange: broadcastClasses,
    /** 수업 종료(§14 #144): ended.json에 기록하고 유예 뒤 메모리에서 내려 보낸다.
     *  CSV 내보내기는 이후에도 로그에서 요청 시 다시 만든다(rebuildRoom). */
    onEnd(code: ClassCode): void {
      ended.add(code, now());
      const room = rooms.get(code);
      if (!room) return;
      const timer = setTimeout(() => {
        evictionTimers.delete(timer);
        if (closed || rooms.get(code) !== room) return;
        rooms.delete(code);
        room.close();
      }, endedGraceMs);
      evictionTimers.add(timer);
    },
  };

  // http 서버: /socket.io/* → socket.io, /api/* → API, 나머지 → 정적(§6.1)
  const distDir = opts.distDir ?? resolve(import.meta.dirname, '..', '..', 'src', 'dist');
  const staticHandler = createStaticHandler(distDir, env.soloEnabled);

  const httpServer = createServer((req: IncomingMessage, res: ServerResponse) => {
    void (async () => {
      const url = new URL(req.url ?? '/', 'http://localhost');
      const pathname = url.pathname;
      if (pathname.startsWith('/socket.io/')) return; // socket.io 엔진이 처리
      if (pathname.startsWith('/api/')) {
        await handleApi(req, res, { env, limiter, rooms, now, rebuildRoom }, pathname);
        return;
      }
      staticHandler(req, res, pathname);
    })().catch((err) => {
      console.error('[http] 요청 처리 오류:', err);
      if (!res.headersSent) {
        res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
      }
      res.end('서버 오류');
    });
  });

  const io = new Server(httpServer, { serveClient: false }) as LiveIOServer;

  // 로그 재생(§8.2): 서버 시작 시 각 세션 디렉터리를 읽어 줄 순서대로 적용한다.
  // 세션 하나가 깨져도(찢어진 줄·손상) 나머지는 그대로 복원된다(B2, §14 #141).
  // end 줄이 있는 세션은 메모리에 올리지 않고 ended.json에만 남긴다(§14 #144).
  let entries: string[] = [];
  try {
    entries = readdirSync(sessionsDir).filter((d) => existsSync(join(sessionsDir, d, 'log.jsonl')));
  } catch {
    entries = [];
  }
  for (const code of entries) {
    try {
      const log = openSessionLog(sessionsDir, code); // 찢어진 마지막 줄 수리(§14 #141)
      const lines = readSessionLog(sessionsDir, code);
      const endTs = lines.find((l) => l.t === 'end')?.ts;
      if (endTs !== undefined) {
        ended.add(code, endTs); // 48시간 코드 재사용 금지 + hello 'ended' 응답(§8.4, §14 #144)
        continue; // 끝난 수업은 Room으로 복원하지 않는다 — CSV는 요청 시 로그에서 다시 만든다
      }
      const room = restoreRoom(lines, {
        lessons,
        activities,
        log,
        io,
        statsIntervalMs,
        hooks,
      });
      if (room) rooms.set(room.code, room);
    } catch (err) {
      console.error(`[replay] 세션 ${code} 복원 실패 — 건너뛴다(나머지는 계속):`, err);
    }
  }

  /** 끝난(또는 메모리에서 내려간) 수업을 로그에서 다시 만들어 CSV 내보내기에 쓴다(§14 #144). */
  const rebuildRoom = (code: ClassCode): Room | null => {
    try {
      const lines = readSessionLog(sessionsDir, code);
      if (lines.length === 0) return null;
      const readOnlyLog = {
        dir: join(sessionsDir, code),
        file: join(sessionsDir, code, 'log.jsonl'),
        append(): void {
          // 읽기 전용 재구축 — 새 줄을 쓰지 않는다
        },
      };
      return restoreRoom(lines, {
        lessons,
        activities,
        log: readOnlyLog,
        io: null,
        statsIntervalMs: 0,
        hooks: { getClasses: () => [] },
      });
    } catch (err) {
      console.error(`[export] 세션 ${code} 재구축 실패:`, err);
      return null;
    }
  };

  // 수업 열기 — 서버 수준 직렬화(코드 발급 경합 방지).
  let openQueue: Promise<unknown> = Promise.resolve();
  const openClass = (lessonIdRaw?: string): Promise<{ ok: true; code: ClassCode } | { ok: false; reason: 'invalid-target' }> => {
    const run = openQueue.then(async (): Promise<{ ok: true; code: ClassCode } | { ok: false; reason: 'invalid-target' }> => {
      const lessonId = lessonIdRaw?.trim() || env.lessonId;
      const lessonToOpen = lessons[lessonId];
      if (!lessonToOpen) return { ok: false, reason: 'invalid-target' };
      for (const seg of lessonToOpen.segments) {
        if (seg.kind === 'activity' && !activities[seg.activity]) {
          return { ok: false, reason: 'invalid-target' };
        }
      }
      const code = issueCode(randomInt, (c) => rooms.has(c) || ended.has(c)); // §8.4 제외 집합
      const log = openSessionLog(sessionsDir, code);
      const room = new Room({
        code,
        lesson: lessonToOpen,
        activities,
        log,
        io,
        maxStudents: env.maxStudents,
        statsIntervalMs,
        random: opts.random,
        now,
        hooks,
      });
      room.appendOpen();
      rooms.set(code, room);
      broadcastClasses();
      return { ok: true, code };
    });
    openQueue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  };

  attachSockets({
    env,
    io,
    rooms,
    lessons,
    activities,
    roleSockets,
    getClasses,
    openClass,
    endedHas: (code) => ended.has(code),
  });

  return {
    httpServer,
    io,
    env,
    rooms,
    openClass,
    async close(): Promise<void> {
      if (closed) return;
      closed = true;
      for (const timer of evictionTimers) clearTimeout(timer);
      evictionTimers.clear();
      for (const room of rooms.values()) room.close();
      roleSockets.clear();
      await new Promise<void>((resolveClose) => {
        io.close(() => resolveClose());
      });
      await new Promise<void>((resolveClose) => {
        httpServer.close(() => resolveClose());
      });
    },
  };
}

// ── CLI ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  // 프로세스 수준 안전망(B1, §14 #140): 놓친 예외·거부가 Node를 죽이지 않게
  // 크게 로그를 남기고 계속 서비스한다. 각 이벤트 처리기의 catch가 원칙이고 이것은 최후의 보루다.
  process.on('unhandledRejection', (reason) => {
    console.error('[server] 처리되지 않은 promise 거부 — 로그만 남기고 계속한다:', reason);
  });
  process.on('uncaughtException', (err) => {
    console.error('[server] 처리되지 않은 예외 — 로그만 남기고 계속한다:', err);
  });

  let env: Env;
  try {
    env = validateEnv(process.env);
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
  const server = await startServer({ env });
  server.httpServer.listen(env.port, () => {
    console.log(`@gagyebu/server: http://localhost:${env.port} (DATA_DIR=${env.dataDir})`);
  });
  const shutdown = (signal: string) => {
    console.log(`@gagyebu/server: ${signal} 수신 — 종료`);
    void server.close().then(() => process.exit(0));
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

// 이 파일이 엔트리일 때만 CLI를 실행한다(테스트는 startServer만 import).
const isMain = (() => {
  if (!process.argv[1]) return false;
  try {
    return import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
  } catch {
    return false;
  }
})();
if (isMain) {
  await main();
}
