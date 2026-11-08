// 로그 재생 (docs/live-api.md §8.2): 로그를 쓰고 → 새 Room을 로그로 복원 → 상태가 같은지.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { JoinPayload } from '@gagyebu/live';
import { fakeSocket, fileLog } from './testutil/helpers.ts';
import { Room, restoreRoom } from './room.ts';
import { readSessionLog } from './log.ts';
import { testActivities, testLesson } from './testutil/fake.ts';

let sessionsDir: string;

beforeEach(() => {
  sessionsDir = mkdtempSync(join(tmpdir(), 'gg-replay-'));
});

afterEach(() => {
  rmSync(sessionsDir, { recursive: true, force: true });
});

/** 시나리오: 학생 2명(1명은 이름 변경·1명은 지각), next로 활동 통과, 공개·발표·잠금. */
async function runScenario(): Promise<Room> {
  const room = new Room({
    code: '7777',
    lesson: testLesson,
    activities: testActivities,
    log: fileLog(sessionsDir, '7777'),
    io: null,
    statsIntervalMs: 0,
    random: () => 0.04, // init bonus = 0 — 이후 비트들은 기본값 루프로 진행된다
    now: () => 1_000_000,
    hooks: { getClasses: () => [] },
  });
  room.appendOpen();

  const a = await room.joinStudent(fakeSocket(), { nickname: '앨리스' } satisfies JoinPayload);
  if (!a.ok) throw new Error('join 실패');
  await room.studentOp({ op: 'rename', id: a.studentId, nickname: '앨리스2' });

  // 슬라이드 3비트 → join → setup
  for (let i = 0; i < 4; i++) await room.next(true);
  // setup 마감(기본값) → mid, 공개, mid 마감 → show → final 마감 → outro
  await room.next(true); // setup 마감 + 전이 → mid
  await room.next(true); // mid 공개
  await room.spotlightCmd(a.studentId);
  await room.next(true); // mid 마감(기본값) → show
  await room.next(true); // show → final
  await room.next(true); // final 마감(기본값) → outro(마지막)

  // 지각 합류(활동이 끝난 뒤): 활동 전체 채우기
  const b = await room.joinStudent(fakeSocket(), { nickname: '밥' } satisfies JoinPayload);
  if (!b.ok) throw new Error('join 실패');

  await room.lockJoin(true);
  return room;
}

describe('로그 재생 (§8.2)', () => {
  it('재생은 커서·학생 상태·토큰·버전까지 동일하게 복원한다', async () => {
    const live = await runScenario();
    const lines = readSessionLog(sessionsDir, '7777');
    const restored = restoreRoom(lines, {
      lessons: { [testLesson.id]: testLesson },
      activities: testActivities,
      log: fileLog(sessionsDir, '7777'),
      io: null,
      statsIntervalMs: 0,
      hooks: { getClasses: () => [] },
    });
    expect(restored).toBeTruthy();
    expect(restored!.debugState()).toEqual(live.debugState());

    // 주요 필드 명시적 확인
    expect(restored!.status).toBe('open'); // end 줄이 없으면 열린 채 복원(§8.2)
    expect(restored!.cursor).toEqual({ segment: 2, beat: 0, revealed: false });
    expect(restored!.highMark).toEqual({ segment: 2, beat: 0 });
    expect(restored!.joinLocked).toBe(true);
    expect(restored!.spotlight).toBe('s1');
    expect(restored!.students.size).toBe(2);
    const s1 = restored!.students.get('s1')!;
    expect(s1.nickname).toBe('앨리스2');
    expect(s1.token).toBe(live.students.get('s1')!.token);
    // 토큰으로 재접속이 가능해야 한다
    const hello = await restored!.helloStudent(fakeSocket(), {
      code: '7777',
      token: s1.token,
      device: 'laptop',
    });
    expect(hello).toEqual({ ok: true, resumed: true });
  });

  it('end 줄이 있으면 ended로 복원된다', async () => {
    const live = await runScenario();
    await live.endClass();
    const lines = readSessionLog(sessionsDir, '7777');
    const restored = restoreRoom(lines, {
      lessons: { [testLesson.id]: testLesson },
      activities: testActivities,
      log: fileLog(sessionsDir, '7777'),
      io: null,
      statsIntervalMs: 0,
      hooks: { getClasses: () => [] },
    });
    expect(restored!.status).toBe('ended');
    expect(restored!.debugState()).toEqual(live.debugState());
  });

  it('모르는 레슨의 세션은 건너뛴다(null)', async () => {
    await runScenario();
    const lines = readSessionLog(sessionsDir, '7777');
    const restored = restoreRoom(lines, {
      lessons: {}, // 레슨 없음
      activities: testActivities,
      log: fileLog(sessionsDir, '7777'),
      io: null,
      hooks: { getClasses: () => [] },
    });
    expect(restored).toBeNull();
  });

  it('kick된 학생의 기록은 재생에서 kick 줄에서 끝난다', async () => {
    const room = new Room({
      code: '3131',
      lesson: testLesson,
      activities: testActivities,
      log: fileLog(sessionsDir, '3131'),
      io: null,
      statsIntervalMs: 0,
      random: () => 0,
      now: () => 0,
      hooks: { getClasses: () => [] },
    });
    room.appendOpen();
    const a = await room.joinStudent(fakeSocket(), { nickname: 'a' } satisfies JoinPayload);
    const b = await room.joinStudent(fakeSocket(), { nickname: 'b' } satisfies JoinPayload);
    if (!a.ok || !b.ok) throw new Error('join 실패');
    await room.studentOp({ op: 'kick', id: b.studentId });

    const lines = readSessionLog(sessionsDir, '3131');
    const restored = restoreRoom(lines, {
      lessons: { [testLesson.id]: testLesson },
      activities: testActivities,
      log: fileLog(sessionsDir, '3131'),
      io: null,
      statsIntervalMs: 0,
      hooks: { getClasses: () => [] },
    });
    expect(restored!.students.has(b.studentId)).toBe(false);
    expect(restored!.students.has(a.studentId)).toBe(true);
    expect(restored!.debugState()).toEqual(room.debugState());
  });

  it('merge 승인의 새 토큰이 재생에서 복원된다 (§14 #63)', async () => {
    const room = new Room({
      code: '2468',
      lesson: testLesson,
      activities: testActivities,
      log: fileLog(sessionsDir, '2468'),
      io: null,
      statsIntervalMs: 0,
      random: () => 0,
      now: () => 0,
      hooks: { getClasses: () => [] },
    });
    room.appendOpen();
    await room.joinStudent(fakeSocket(), { nickname: 'nick' } satisfies JoinPayload);
    const pending = await room.joinStudent(fakeSocket(), { nickname: 'nick' } satisfies JoinPayload);
    if (pending.ok || pending.reason !== 'nickname-taken') throw new Error('nickname-taken 아님');
    await room.studentOp({ op: 'merge', pendingId: pending.pendingId, intoId: 's1' });

    const lines = readSessionLog(sessionsDir, '2468');
    const restored = restoreRoom(lines, {
      lessons: { [testLesson.id]: testLesson },
      activities: testActivities,
      log: fileLog(sessionsDir, '2468'),
      io: null,
      statsIntervalMs: 0,
      hooks: { getClasses: () => [] },
    });
    const rec = restored!.students.get('s1')!;
    expect(rec.token).toBe(room.students.get('s1')!.token);
    expect(restored!.debugState()).toEqual(room.debugState());
  });
});
