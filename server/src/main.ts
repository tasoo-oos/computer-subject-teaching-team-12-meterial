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
        await handleApi(req, res, { env, limiter, rooms, now }, pathname);
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
  let entries: string[] = [];
  try {
    entries = readdirSync(sessionsDir).filter((d) => existsSync(join(sessionsDir, d, 'log.jsonl')));
  } catch {
    entries = [];
  }
  for (const code of entries) {
    const lines = readSessionLog(sessionsDir, code);
    const log = openSessionLog(sessionsDir, code);
    const room = restoreRoom(lines, {
      lessons,
      activities,
      log,
      io,
      statsIntervalMs,
      hooks,
    });
    if (room) rooms.set(room.code, room);
  }

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
