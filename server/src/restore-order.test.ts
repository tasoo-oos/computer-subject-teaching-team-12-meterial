// 복원 후 자동 선택·classes 순서 (docs/live-api.md §14 #165):
// restoreRoom은 openedAt을 복원 시각이 아니라 로그 open 줄의 ts로 정한다.
// 그래서 서버 재시작 뒤 통제·전면 소켓의 자동 선택이 "가장 최근에 연 수업"을 다시
// 보고(§5.8, §14 S2-#67), classes 목록(열린 시각 오름차순)도 살아 있을 때와 같은 순서다.
// 두 수업을 열고 재시작해 순서가 뒤바뀌지 않음을 검증한다.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';
import { startServer, type RunningServer } from './main.ts';
import { readSessionLog } from './log.ts';
import { loginControl, makeDist, testEnv, cleanupTemp } from './testutil/server.ts';
import { connect, emitAck, onceEvent, type ClientSocket } from './testutil/client.ts';
import { testActivities, testLesson } from './testutil/fake.ts';

let server: RunningServer;
let url: string;
let now: () => number;
const sockets: ClientSocket[] = [];

/** 실제 지금에서 호출마다 10ms씩 전진하는 시계 — 두 수업의 open ts가 겹치지 않게
 *  하되 쿠키 만료 검증(verifyCookieValue는 Date.now 기준)은 그대로 통과한다. */
function stepClock(): () => number {
  let t = Date.now();
  return () => (t += 10);
}

async function boot(dataDir: string | undefined): Promise<void> {
  server = await startServer({
    env: testEnv(dataDir ? { dataDir } : {}),
    lessons: { [testLesson.id]: testLesson },
    activities: testActivities,
    distDir: makeDist(),
    statsIntervalMs: 0,
    now,
    random: () => 0.01,
  });
  await new Promise<void>((resolve) => server.httpServer.listen(0, () => resolve()));
  url = `http://127.0.0.1:${(server.httpServer.address() as AddressInfo).port}`;
}

async function shutdown(): Promise<void> {
  for (const s of sockets.splice(0)) s.disconnect();
  await server.close();
}

beforeEach(async () => {
  now = stepClock(); // 재시작 후에도 같은 시계가 계속 돈다 — 새 수업의 openedAt이 복원된 두 수업보다 늦는다
  await boot(undefined);
});

afterEach(async () => {
  await shutdown();
  cleanupTemp();
});

describe('복원 후 자동 선택·classes 순서 (§14 #165)', () => {
  it('재시작하면 나중에 연 수업이 자동 선택되고, openedAt은 로그 open 줄의 ts다', async () => {
    // ── 수업 두 개 열기 (A 먼저, B 나중) ─────────────────────────────
    const cookie = await loginControl(url);
    const control = connect(url, { query: { role: 'control' }, extraHeaders: { Cookie: cookie } });
    sockets.push(control);
    await onceEvent(control, 'classes'); // 연결 시 열린 수업이 없어 빈 목록을 받는다(§14)

    const classesA = onceEvent<{ classes: { code: string }[] }>(control, 'classes');
    const a = await emitAck<{ ok: boolean; code?: string }>(control, 'openClass', {});
    expect(a.ok).toBe(true);
    expect((await classesA).classes.map((c) => c.code)).toEqual([a.code]);

    const classesB = onceEvent<{ classes: { code: string }[] }>(control, 'classes');
    const b = await emitAck<{ ok: boolean; code?: string }>(control, 'openClass', {});
    expect(b.ok).toBe(true);
    expect((await classesB).classes.map((c) => c.code)).toEqual([a.code, b.code]); // openedAt 오름차순

    const liveA = server.rooms.get(a.code!)!;
    const liveB = server.rooms.get(b.code!)!;
    expect(liveB.openedAt).toBeGreaterThan(liveA.openedAt);

    // ── 재시작: 같은 DATA_DIR에서 로그 재생 ──────────────────────────
    const dataDir = server.env.dataDir;
    const sessionsDir = join(dataDir, 'sessions');
    const openTsA = readSessionLog(sessionsDir, a.code!).find((l) => l.t === 'open')!.ts;
    const openTsB = readSessionLog(sessionsDir, b.code!).find((l) => l.t === 'open')!.ts;
    await shutdown();

    await boot(dataDir); // 같은 시계로 계속 — 세 수업의 openedAt 순서가 흐르는 시간 그대로

    const restoredA = server.rooms.get(a.code!)!;
    const restoredB = server.rooms.get(b.code!)!;
    expect(restoredA).toBeTruthy();
    expect(restoredB).toBeTruthy();
    // 복원 시각이 아니라 처음 연 시각 — 자동 선택·목록 순서의 기준(§14 #165)
    expect(restoredA.openedAt).toBe(openTsA);
    expect(restoredB.openedAt).toBe(openTsB);
    expect(restoredA.openedAt).toBeLessThan(restoredB.openedAt);

    // ── 새 통제 소켓의 자동 선택은 나중에 연 수업 B ──────────────────
    const cookie2 = await loginControl(url);
    const control2 = connect(url, { query: { role: 'control' }, extraHeaders: { Cookie: cookie2 } });
    sockets.push(control2);
    const snap = await onceEvent<{ class: { code: string } }>(control2, 'snapshot');
    expect(snap.class.code).toBe(b.code);

    // ── classes 목록도 열린 시각 순서 그대로 ─────────────────────────
    const classesC = onceEvent<{ classes: { code: string; openedAt: number }[] }>(control2, 'classes');
    const c = await emitAck<{ ok: boolean; code?: string }>(control2, 'openClass', {});
    expect(c.ok).toBe(true);
    const list = (await classesC).classes;
    expect(list.map((x) => x.code)).toEqual([a.code, b.code, c.code]);
    for (let i = 1; i < list.length; i++) {
      expect(list[i]!.openedAt).toBeGreaterThan(list[i - 1]!.openedAt); // openedAt 오름차순
    }
  });
});
