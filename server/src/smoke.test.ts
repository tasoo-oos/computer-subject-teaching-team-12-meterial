// M2 스모크 (docs/live-api.md §12): 통제 소켓으로 수업 열기 → 학생 60명(봇) 입장 →
// 모든 비트 넘기기(공개·확인·기본값 포함) → 서버 재시작 → 커서·학생 상태 복원(로그 재생).
// 프로덕션 레슨의 gagyebu 활동은 아직 stub이라 테스트 레슨(가짜 활동)으로 검증한다.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { AddressInfo } from 'node:net';
import { startServer, type RunningServer } from './main.ts';
import { loginControl, loginStage, makeDist, tempDir, testEnv, cleanupTemp } from './testutil/server.ts';
import { connect, emitAck, onceEvent, waitFor, type ClientSocket } from './testutil/client.ts';
import { testActivities, testLesson } from './testutil/fake.ts';

const N = 60;

let server: RunningServer;
let url: string;
const sockets: ClientSocket[] = [];

interface Bot {
  socket: ClientSocket;
  id: string;
  token: string;
  nickname: string;
  lazy: boolean;
  autoAppliedCount: number;
  lastState: { done: boolean; segment: number } | null;
}

async function boot(): Promise<void> {
  const env = testEnv();
  server = await startServer({
    env,
    lessons: { [testLesson.id]: testLesson },
    activities: testActivities,
    distDir: makeDist(),
    statsIntervalMs: 0,
    random: () => 0.01, // init bonus 0 — 결정적
  });
  await new Promise<void>((resolve) => server.httpServer.listen(0, () => resolve()));
  url = `http://127.0.0.1:${(server.httpServer.address() as AddressInfo).port}`;
}

async function shutdown(): Promise<void> {
  for (const s of sockets.splice(0)) s.disconnect();
  await server.close();
}

beforeEach(async () => {
  await boot();
});

afterEach(async () => {
  await shutdown();
  cleanupTemp();
});

function botTrack(socket: ClientSocket, id: string, token: string, nickname: string, lazy: boolean): Bot {
  const bot: Bot = { socket, id, token, nickname, lazy, autoAppliedCount: 0, lastState: null };
  socket.on('state', (p: unknown) => {
    const payload = p as { done: boolean; segment: number; autoApplied?: unknown[] };
    bot.lastState = { done: payload.done, segment: payload.segment };
    if (payload.autoApplied) bot.autoAppliedCount += payload.autoApplied.length;
  });
  return bot;
}

describe('M2 스모크: 열기 → 60봇 → 전 비트 → 재시작 복원', () => {
  it(
    '통제 소켓·봇 60·전 비트 진행·재시작 후 커서와 학생이 복원된다',
    async () => {
      // ── 통제 소켓으로 수업 열기 ──────────────────────────────────────
      const cookie = await loginControl(url);
      const control = connect(url, { query: { role: 'control' }, extraHeaders: { Cookie: cookie } });
      sockets.push(control);
      const openSnap = onceEvent(control, 'snapshot'); // 자동 선택 스냅숏
      const opened = await emitAck<{ ok: boolean; code?: string }>(control, 'openClass', {});
      expect(opened.ok).toBe(true);
      const code = opened.code!;
      expect(code).toMatch(/^[0-9]{4}$/);
      await openSnap;

      const room = server.rooms.get(code)!;
      expect(room.classState().lessonId).toBe('test-lesson');

      // 전면 소켓도 붙는다(stats 수신 확인)
      const stageCookie = await loginStage(url);
      const stage = connect(url, { query: { role: 'stage' }, extraHeaders: { Cookie: stageCookie } });
      sockets.push(stage);
      await onceEvent(stage, 'snapshot');
      let statsCount = 0;
      stage.on('stats', () => statsCount++);

      // ── 봇 60명 입장(2명은 lazy — 기본값 처리 검증) ──────────────────
      const bots: Bot[] = [];
      await Promise.all(
        Array.from({ length: N }, (_, i) => (async () => {
          const nickname = `bot-${String(i + 1).padStart(2, '0')}`;
          const s = connect(url);
          sockets.push(s);
          const hello = await emitAck<{ ok: boolean }>(s, 'hello', { code, device: i % 3 === 0 ? 'phone' : 'laptop' });
          expect(hello.ok).toBe(true);
          const snapP = onceEvent(s, 'snapshot');
          const join = await emitAck<{ ok: boolean; studentId?: string; token?: string }>(s, 'join', { nickname });
          expect(join.ok).toBe(true);
          await snapP;
          bots.push(botTrack(s, join.studentId!, join.token!, nickname, i < 2));
        })()),
      );
      expect(bots).toHaveLength(N);
      await waitFor(() => room.students.size === N);

      // ── 비트 넘기기: 슬라이드 3 → join → setup → mid(공개) → show → final → outro ──
      // 통제 명령 속도 제한이 초당 10회(§5.4)이므로 명령 사이에 짧은 대기를 둔다.
      const next = async (force = false) => {
        await new Promise((r) => setTimeout(r, 120));
        return emitAck<{ ok: boolean; reason?: string; pending?: number }>(
          control,
          'next',
          force ? { force: true } : {},
        );
      };

      // 슬라이드 3비트
      for (let i = 0; i < 3; i++) expect((await next()).ok).toBe(true);
      expect(room.highMark).toEqual({ segment: 1, beat: 0 }); // join

      // join 비트 — 플랫폼 판정으로 전원 done, next 그대로 통과
      expect((await next()).ok).toBe(true);
      expect(room.highMark).toEqual({ segment: 1, beat: 1 }); // setup

      // 봇들이 setup에서 행동(lazy 봇 제외)
      await Promise.all(
        bots
          .filter((b) => !b.lazy)
          .map((b) =>
            emitAck(b.socket, 'act', { seq: 1, beat: { segment: 1, beat: 1 }, action: { type: 'add', n: 1 } }),
          ),
      );
      await waitFor(() => room.rosterEntries().filter((r) => !r.pendingMerge && r.done).length >= N - 2);

      // setup 마감: lazy 2명 미완료 → 확인 대화상자
      const confirm = await next();
      if (!confirm.ok) {
        expect(confirm.reason).toBe('confirm-required');
        expect(confirm.pending).toBe(2);
        expect((await next(true)).ok).toBe(true); // force → 기본값
      }
      expect(room.highMark).toEqual({ segment: 1, beat: 2 }); // mid

      // mid: 공개 먼저
      expect((await next()).ok).toBe(true);
      expect(room.cursor.revealed).toBe(true);
      expect(room.highRevealed).toBe(true);
      // mid 마감 — 전원 count 1 < 3 → 확인 → force → 기본값 2걸음
      const confirmMid = await next();
      expect(confirmMid.ok ? true : confirmMid.reason).toBe(confirmMid.ok ? true : 'confirm-required');
      expect((await next(true)).ok).toBe(true);
      for (const b of bots) {
        // lazy 봇은 기본값 통지를 받았다
        if (b.lazy) expect(b.autoAppliedCount).toBeGreaterThan(0);
      }
      expect(room.highMark).toEqual({ segment: 1, beat: 3 }); // show

      expect((await next()).ok).toBe(true); // show → final
      expect(room.highMark).toEqual({ segment: 1, beat: 4 });
      // final 마감: count 3 < 5 → 확인 → force
      const confirmFinal = await next();
      expect(confirmFinal.ok ? true : confirmFinal.reason).toBe(confirmFinal.ok ? true : 'confirm-required');
      expect((await next(true)).ok).toBe(true);
      expect(room.highMark).toEqual({ segment: 2, beat: 0 }); // outro = 마지막 비트

      // 마지막 비트의 next는 invalid-target
      expect(await next()).toEqual({ ok: false, reason: 'invalid-target' });

      // 전면에 stats가 흘렀다
      expect(statsCount).toBeGreaterThan(0);

      const liveVersion = room.version;
      const liveTokens = new Map([...room.students.values()].map((r) => [r.id, r.token]));
      const liveCursor = { ...room.cursor };

      // ── 재시작: 같은 DATA_DIR에서 로그 재생 ──────────────────────────
      const dataDir = server.env.dataDir;
      await shutdown();

      const env2 = testEnv({ dataDir });
      server = await startServer({
        env: env2,
        lessons: { [testLesson.id]: testLesson },
        activities: testActivities,
        distDir: makeDist(),
        statsIntervalMs: 0,
        random: () => 0.01,
      });
      await new Promise<void>((resolve) => server.httpServer.listen(0, () => resolve()));
      url = `http://127.0.0.1:${(server.httpServer.address() as AddressInfo).port}`;

      const restored = server.rooms.get(code);
      expect(restored).toBeTruthy();
      expect(restored!.cursor).toEqual(liveCursor); // 커서 복원
      expect(restored!.status).toBe('open'); // end 줄이 없으므로 열린 채
      expect(restored!.version).toBe(liveVersion);
      expect(restored!.students.size).toBe(N); // 학생 복원
      for (const [id, token] of liveTokens) {
        expect(restored!.students.get(id)!.token).toBe(token); // 토큰 복원
      }

      // 봇 하나가 토큰으로 재접속하면 이어받는다
      const bot3 = bots[2]!;
      const s = connect(url);
      sockets.push(s);
      // snapshot은 hello ack보다 먼저 온다 — 리스너를 먼저 등록한다
      const snapP = onceEvent<{ you: { studentId: string }; class: { cursor: { segment: number; beat: number } } }>(s, 'snapshot');
      const hello = await emitAck<{ ok: boolean; resumed?: boolean }>(s, 'hello', {
        code,
        token: bot3.token,
        device: 'laptop',
      });
      expect(hello).toEqual({ ok: true, resumed: true });
      const snap = await snapP;
      expect(snap.you.studentId).toBe(bot3.id);
      expect(snap.class.cursor).toEqual(liveCursor);

      // 재시작 뒤에도 통제 소켓·CSV 내보내기가 동작한다
      const cookie2 = await loginControl(url);
      const control2 = connect(url, { query: { role: 'control' }, extraHeaders: { Cookie: cookie2 } });
      sockets.push(control2);
      const snap2 = await onceEvent<{ class: { code: string; cursor: { segment: number; beat: number } } }>(control2, 'snapshot');
      expect(snap2.class.code).toBe(code);
      expect(snap2.class.cursor).toEqual(liveCursor);
      const csv = await fetch(`${url}/api/export/${code}.csv`, { headers: { cookie: cookie2 } });
      expect(csv.status).toBe(200);
      const text = await csv.text();
      expect(text.split(/\r?\n/).filter(Boolean).length).toBe(N + 1); // 머리글 + 60행
    },
    120_000,
  );
});
