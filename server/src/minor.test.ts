// 감산(m1~m8) 단위·통합 테스트 (§14 #145~#152).
// m1 student op 모양 검증 · m2 hello.device 화이트리스트 · m3 draft 크기 제한 ·
// m4 내보낸 닉네임 차단 · m7 전이 줄은 실제 적용된 행동만 · m8 두 번째 hello의 이전 방 해제.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ActivityLogic, Beat, Lesson, StudentOp } from '@gagyebu/live';
import type { RunningServer } from './main.ts';
import { cleanupTemp, startTestServer } from './testutil/server.ts';
import { connect, emitAck, onceEvent, waitFor, type ClientSocket } from './testutil/client.ts';
import { fakeSocket, fileLog, makeRoom } from './testutil/helpers.ts';
import { Room, restoreRoom } from './room.ts';
import { readSessionLog } from './log.ts';
import { testActivities, testLesson } from './testutil/fake.ts';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let server: RunningServer;
let url: string;
const sockets: ClientSocket[] = [];

beforeEach(async () => {
  ({ server, url } = await startTestServer());
});

afterEach(async () => {
  for (const s of sockets.splice(0)) s.disconnect();
  await server.close();
  cleanupTemp();
});

// ── m1: student op 모양 (§14 #145) ──────────────────────────────────────────

describe('m1: student op 모양 검증', () => {
  it('모르는 op 종류·누락 필드는 invalid-target (null ack가 아니라)', async () => {
    const room = makeRoom({ lesson: testLesson, activities: testActivities });
    const join = await room.joinStudent(fakeSocket(), { nickname: 'a' });
    if (!join.ok) throw new Error('join 실패');

    expect(await room.studentOp({ op: 'wat', id: join.studentId } as unknown as StudentOp)).toEqual({
      ok: false,
      reason: 'invalid-target',
    });
    // B1 재현 모양: nickname 누락 rename — 예외 대신 invalid-target
    expect(await room.studentOp({ op: 'rename', id: join.studentId } as unknown as StudentOp)).toEqual({
      ok: false,
      reason: 'invalid-target',
    });
    expect(await room.studentOp({ op: 'kick' } as unknown as StudentOp)).toEqual({
      ok: false,
      reason: 'invalid-target',
    });
    expect(await room.studentOp({ op: 'merge', pendingId: 'p1' } as unknown as StudentOp)).toEqual({
      ok: false,
      reason: 'invalid-target',
    });
    expect(await room.studentOp('not-even-an-object' as unknown as StudentOp)).toEqual({
      ok: false,
      reason: 'invalid-target',
    });
    // 서버는 그 뒤로도 정상 동작
    expect((await room.studentOp({ op: 'rename', id: join.studentId, nickname: 'b' })).ok).toBe(true);
  });
});

// ── m2: hello.device 화이트리스트 (§14 #146) ───────────────────────────────

describe('m2: hello.device 검증', () => {
  it('모르는 기기는 laptop으로, 알려진 기기는 그대로 roster에 남는다', async () => {
    const opened = await server.openClass(testLesson.id);
    if (!opened.ok) throw new Error('openClass 실패');

    const joinWithDevice = async (nickname: string, device: unknown): Promise<void> => {
      const s = connect(url);
      sockets.push(s);
      await emitAck(s, 'hello', { code: opened.code, device });
      const ack = await emitAck<{ ok: boolean; reason?: string }>(s, 'join', { nickname });
      expect(ack.ok, ack.reason).toBe(true);
    };
    await joinWithDevice('랩톱', 'laptop');
    await joinWithDevice('미확인기기', '냉장고'); // 화이트리스트 밖 → 기본값
    await joinWithDevice('폰', 'phone');

    const room = server.rooms.get(opened.code)!;
    const devices = new Map(room.rosterEntries().map((e) => [e.nickname, e.device]));
    expect(devices.get('랩톱')).toBe('laptop');
    expect(devices.get('미확인기기')).toBe('laptop'); // 기본값(§14 #146)
    expect(devices.get('폰')).toBe('phone');
  });
});

// ── m3: draft 크기 제한 (§14 #147) ─────────────────────────────────────────

/** draft 유무에 따라 다른 기본값을 고르는 활동 — 크기 제한이 draft 보존에 영향 주는지 확인용 */
const draftyLogic: ActivityLogic<unknown, { marks: string[] }, { type: 'mark'; label: string }, unknown> = {
  id: 'drafty',
  beats: (): Beat[] => [
    { id: 'w0', label: '작업0', mode: 'work' },
    { id: 'w1', label: '작업1', mode: 'work' },
  ],
  init: () => ({ state: { marks: [] }, actions: [] }),
  allowed: () => true,
  apply: (s, a) => ({ marks: [...s.marks, a.label] }),
  done: (s, beat) => (beat === 0 ? s.marks.length > 0 : true),
  fallback: (_s, _beat, _cfg, draft) =>
    draft === undefined
      ? { action: { type: 'mark', label: 'nodraft' }, notice: '' }
      : { action: { type: 'mark', label: 'draft' }, notice: '' },
  transition: () => [],
  stats: () => ({ kind: 'none' }),
};

const draftyLesson: Lesson = {
  id: 'drafty-lesson',
  title: 'draft 검증',
  settings: { showProgressOnStage: false },
  segments: [{ kind: 'activity', id: 'drafty', activity: 'drafty', config: {} }],
};

describe('m3: draft 8KB 제한', () => {
  it('작은 초안은 저장되고(기본값이 쓴다) 8KB 초과 초안은 버려진다', async () => {
    const room = makeRoom({ lesson: draftyLesson, activities: { drafty: draftyLogic } });
    const sa = fakeSocket();
    const sb = fakeSocket();
    const a = await room.joinStudent(sa, { nickname: 'a' });
    if (!a.ok) throw new Error('join 실패');
    const b = await room.joinStudent(sb, { nickname: 'b' });
    if (!b.ok) throw new Error('join 실패');
    const beat = { segment: 0, beat: 0 };

    room.saveDraft(sa, { beat, data: '작은 초안' }); // 저장
    room.saveDraft(sb, { beat, data: 'x'.repeat(9 * 1024) }); // 9KB — 버림(§14 #147)
    await new Promise((r) => setTimeout(r, 20)); // 큐 처리 대기

    await room.next(true); // 마감: fallback이 각자의 draft 여부를 기록에 남긴다

    const marksOf = (id: string): string[] => {
      const rec = room.students.get(id)!;
      return (rec.states['drafty'] as { marks: string[] }).marks;
    };
    expect(marksOf(a.studentId)).toContain('draft'); // 초안이 살아 있었다
    expect(marksOf(b.studentId)).toContain('nodraft'); // 8KB 초과 초안은 버려졌다
  });
});

// ── m4: 내보낸 닉네임 (§14 #148) ───────────────────────────────────────────

describe('m4: 내보낸 닉네임은 그 수업에서 다시 쓸 수 없다', () => {
  it('kick 뒤 같은 닉네임 join은 join-locked, 다른 닉네임은 가능, 개명도 막힌다', async () => {
    const room = makeRoom({ lesson: testLesson, activities: testActivities });
    const a = await room.joinStudent(fakeSocket(), { nickname: '내보내짐' });
    if (!a.ok) throw new Error('join 실패');
    const b = await room.joinStudent(fakeSocket(), { nickname: '남는사람' });
    if (!b.ok) throw new Error('join 실패');

    expect((await room.studentOp({ op: 'kick', id: a.studentId })).ok).toBe(true);

    expect(await room.joinStudent(fakeSocket(), { nickname: '내보내짐' })).toEqual({
      ok: false,
      reason: 'join-locked',
    });
    expect((await room.joinStudent(fakeSocket(), { nickname: '다른이름' })).ok).toBe(true);
    expect(await room.studentOp({ op: 'rename', id: b.studentId, nickname: '내보내짐' })).toEqual({
      ok: false,
      reason: 'invalid-target',
    });
  });

  it('재생도 내보낸 닉네임을 막는다 (admin kick 줄에서 복원)', async () => {
    const sessionsDir = mkdtempSync(join(tmpdir(), 'gg-kick-'));
    const room = new Room({
      code: '1357',
      lesson: testLesson,
      activities: testActivities,
      log: fileLog(sessionsDir, '1357'),
      io: null,
      statsIntervalMs: 0,
      random: () => 0,
      now: () => 0,
      hooks: { getClasses: () => [] },
    });
    room.appendOpen();
    const a = await room.joinStudent(fakeSocket(), { nickname: '내보내짐' });
    if (!a.ok) throw new Error('join 실패');
    await room.studentOp({ op: 'kick', id: a.studentId });

    const restored = restoreRoom(readSessionLog(sessionsDir, '1357'), {
      lessons: { [testLesson.id]: testLesson },
      activities: testActivities,
      log: fileLog(sessionsDir, '1357'),
      io: null,
      statsIntervalMs: 0,
      hooks: { getClasses: () => [] },
    });
    expect(restored).toBeTruthy();
    expect(await restored!.joinStudent(fakeSocket(), { nickname: '내보내짐' })).toEqual({
      ok: false,
      reason: 'join-locked',
    });
    rmSync(sessionsDir, { recursive: true, force: true });
  });
});

// ── m7: 전이 줄은 실제 적용된 행동만 (§14 #151) ────────────────────────────

/** 두 번째 apply가 예외를 던지는 전이 — 적용된 첫 행동만 로그에 남아야 한다 */
const boomLogic: ActivityLogic<unknown, { marks: string[] }, { type: 'mark'; label: string }, unknown> = {
  id: 'boom',
  beats: (): Beat[] => [
    { id: 'w0', label: '작업0', mode: 'work' },
    { id: 'w1', label: '작업1', mode: 'work' },
  ],
  init: () => ({ state: { marks: [] }, actions: [] }),
  allowed: () => true,
  apply: (s, a) => {
    if (a.label === 'boom') throw new Error('transition apply stub');
    return { marks: [...s.marks, a.label] };
  },
  done: (s, beat) => (beat === 0 ? s.marks.length > 0 : true),
  fallback: () => ({ action: { type: 'mark', label: 'auto' }, notice: '' }),
  transition: (_s, from) => (from === 0 ? [{ type: 'mark', label: 'good' }, { type: 'mark', label: 'boom' }] : []),
  stats: () => ({ kind: 'none' }),
};

const boomLesson: Lesson = {
  id: 'boom-lesson',
  title: '전이 예외 검증',
  settings: { showProgressOnStage: false },
  segments: [{ kind: 'activity', id: 'boom', activity: 'boom', config: {} }],
};

describe('m7: 전이 도중 apply 예외 — 적용된 행동만 기록', () => {
  it('transition 줄에는 예외 전까지 적용된 행동만 남고 재생도 같아진다', async () => {
    const sessionsDir = mkdtempSync(join(tmpdir(), 'gg-boom-'));
    const room = new Room({
      code: '2468',
      lesson: boomLesson,
      activities: { boom: boomLogic },
      log: fileLog(sessionsDir, '2468'),
      io: null,
      statsIntervalMs: 0,
      random: () => 0,
      now: () => 0,
      hooks: { getClasses: () => [] },
    });
    room.appendOpen();
    const a = await room.joinStudent(fakeSocket(), { nickname: 'a' });
    if (!a.ok) throw new Error('join 실패');

    await room.next(true); // fallback(auto) → 전이(good 적용, boom에서 예외) → beat1

    const marks = (room.students.get(a.studentId)!.states['boom'] as { marks: string[] }).marks;
    expect(marks).toEqual(['auto', 'good']); // 예외 던지기 전까지 적용된 상태

    const lines = readSessionLog(sessionsDir, '2468');
    const transitionLines = lines.filter((l) => l.t === 'transition');
    expect(transitionLines).toHaveLength(1);
    expect((transitionLines[0] as { actions: unknown[] }).actions).toEqual([{ type: 'mark', label: 'good' }]);

    // 재생도 같은 상태를 만든다 — 로그가 적용된 만큼만 말하고 있으므로
    const restored = restoreRoom(lines, {
      lessons: { [boomLesson.id]: boomLesson },
      activities: { boom: boomLogic },
      log: fileLog(sessionsDir, '2468'),
      io: null,
      statsIntervalMs: 0,
      hooks: { getClasses: () => [] },
    });
    expect(restored!.debugState()).toEqual(room.debugState());
    rmSync(sessionsDir, { recursive: true, force: true });
  });
});

// ── m8: 두 번째 hello로 다른 방 (§14 #152) ─────────────────────────────────

describe('m8: 다른 방으로 hello하면 이전 방 연결을 먼저 뗀다', () => {
  it('이전 방 roster는 disconnected가 되고 새 방에서 join된다', async () => {
    const a = await server.openClass(testLesson.id);
    const b = await server.openClass(testLesson.id);
    if (!a.ok || !b.ok) throw new Error('openClass 실패');

    const s = connect(url);
    sockets.push(s);
    await emitAck(s, 'hello', { code: a.code, device: 'laptop' });
    const joinA = await emitAck<{ ok: boolean; reason?: string }>(s, 'join', { nickname: '돌아이' });
    expect(joinA.ok, joinA.reason).toBe(true);

    // 같은 소켓으로 다른 방에 hello → 이전 방 연결 해제 후 새 방으로
    const hello2 = await emitAck<{ ok: boolean; resumed: boolean }>(s, 'hello', {
      code: b.code,
      device: 'laptop',
    });
    expect(hello2).toEqual({ ok: true, resumed: false });

    const snapshotP = onceEvent(s, 'snapshot');
    const joinB = await emitAck<{ ok: boolean; reason?: string }>(s, 'join', { nickname: '새방으로' });
    expect(joinB.ok, joinB.reason).toBe(true);
    expect(((await snapshotP) as { class: { code: string } }).class.code).toBe(b.code);

    const roomA = server.rooms.get(a.code)!;
    const roomB = server.rooms.get(b.code)!;
    await waitFor(() => {
      const entryA = roomA.rosterEntries().find((e) => e.nickname === '돌아이');
      return entryA?.connected === false;
    });
    expect(roomA.rosterEntries().some((e) => e.nickname === '돌아이')).toBe(true); // 기록은 남는다(§8.3)
    expect(roomB.rosterEntries().some((e) => e.nickname === '새방으로')).toBe(true);
  });
});
