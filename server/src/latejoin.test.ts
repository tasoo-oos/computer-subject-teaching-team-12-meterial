// 지각 합류·재접속·병합 (docs/live-api.md §8.3, §5.8).
import { describe, expect, it } from 'vitest';
import type { HelloPayload, JoinPayload } from '@gagyebu/live';
import { fakeSocket, makeRoom, memLog, type Captured } from './testutil/helpers.ts';
import { testActivities, testLesson } from './testutil/fake.ts';
import type { FakeState } from './testutil/fake.ts';
import type { LogLine } from './log.ts';

function lines(room: ReturnType<typeof makeRoom>): LogLine[] {
  const log = (room as unknown as { log: { lines?: LogLine[] } }).log;
  if (!log.lines) throw new Error('파일 로그 방은 이 헬퍼를 쓸 수 없다');
  return log.lines;
}

describe('지각 합류 채우기 (§8.3)', () => {
  it('활동 세그먼트가 시작되기 전 입장은 지각이 아니다', async () => {
    const room = makeRoom({ lesson: testLesson, activities: testActivities });
    await room.next(true); // 슬라이드 도중
    const ack = await room.joinStudent(fakeSocket(), { nickname: 'a' } satisfies JoinPayload);
    expect(ack.ok).toBe(true);
    const rec = room.students.get(ack.ok ? ack.studentId : '')!;
    expect(rec.late).toBe(false);
    // init만 적용: count = bonus(0)
    expect((rec.states['game'] as FakeState).count).toBe(0);
    expect(lines(room).filter((l) => l.t === 'auto')).toHaveLength(0);
  });

  it('활동 도중 입장은 highMark 직전까지 채우고 live 비트로 들어가는 전이도 포함', async () => {
    const room = makeRoom({ lesson: testLesson, activities: testActivities });
    await room.joinStudent(fakeSocket(), { nickname: 'first' });
    for (let i = 0; i < 4; i++) await room.next(true); // setup(seg1,beat1)
    await room.next(true); // setup 마감(기본값) + 전이 → mid(seg1,beat2)

    const ack = await room.joinStudent(fakeSocket(), { nickname: 'late' } satisfies JoinPayload);
    expect(ack.ok).toBe(true);
    const rec = room.students.get(ack.ok ? ack.studentId : '')!;
    expect(rec.late).toBe(true);
    const state = rec.states['game'] as FakeState;
    // join(0) done이라 기본값 없음, setup(1) 기본값 +1, 전이 (1,2) t12
    expect(state.count).toBe(1);
    expect(state.marks).toEqual(['t12']);
    // live 비트(mid) 자체는 채우지 않는다 — count < 3로 남는다
    expect(state.count).toBeLessThan(3);

    // 로그: join(late) + auto(backfill) + transition
    const joinLine = lines(room).find((l) => l.t === 'join' && l.studentId === rec.id);
    expect(joinLine && joinLine.t === 'join' && joinLine.late).toBe(true);
    const autos = lines(room).filter((l) => l.t === 'auto' && l.studentId === rec.id);
    expect(autos).toHaveLength(1);
    expect(autos[0]!.t === 'auto' && autos[0]!.kind).toBe('backfill');
    const transitions = lines(room).filter((l) => l.t === 'transition' && l.studentId === rec.id);
    expect(transitions).toHaveLength(1);
    expect(transitions[0]!.t === 'transition' && transitions[0]!.from).toEqual({ segment: 1, beat: 1 });
    expect(transitions[0]!.t === 'transition' && transitions[0]!.to).toEqual({ segment: 1, beat: 2 });
  });

  it('활동이 끝난 뒤 입장하면 활동 전체를 채운다', async () => {
    const room = makeRoom({ lesson: testLesson, activities: testActivities });
    await room.joinStudent(fakeSocket(), { nickname: 'first' });
    for (let i = 0; i < 9; i++) await room.next(true); // 마지막 비트(seg2,beat0) — 공개 1번 포함

    const ack = await room.joinStudent(fakeSocket(), { nickname: 'late' } satisfies JoinPayload);
    const rec = room.students.get(ack.ok ? ack.studentId : '')!;
    expect(rec.late).toBe(true);
    const state = rec.states['game'] as FakeState;
    // join(0) done, setup +1, mid +2(3까지), final +2(5까지), 전이 t12·t34
    expect(state.count).toBe(5);
    expect(state.marks).toEqual(['t12', 't34']);
    // 경계 전이(final→outro)는 없다
    expect(state.marks).not.toContain('t40');
  });
});

describe('재접속·토큰 (§8.3)', () => {
  it('hello 토큰으로 재접속하면 snapshot을 받고 끊긴 동안 통지도 온다', async () => {
    const room = makeRoom({ lesson: testLesson, activities: testActivities });
    const joined = await room.joinStudent(fakeSocket(), { nickname: 'a' } satisfies JoinPayload);
    if (!joined.ok) throw new Error('join 실패');
    const token = joined.token;

    // 끊김
    const rec = room.students.get(joined.studentId)!;
    const dead = rec.socket!;
    room.studentDisconnected(dead);

    // 그 사이 next 강제로 기본값 적용
    for (let i = 0; i < 5; i++) await room.next(true); // mid
    await room.next(true); // 공개
    await room.next(true); // 기본값(3걸음) + 전이 → show
    expect(rec.autoApplied.length).toBeGreaterThan(0); // 큐에 쌓여 있다

    // 토큰 재접속
    const captured: Captured[] = [];
    const socket = fakeSocket(captured);
    const ack = await room.helloStudent(socket, {
      code: '1234',
      token,
      device: 'phone',
    } satisfies HelloPayload);
    expect(ack).toEqual({ ok: true, resumed: true });
    expect(rec.connected).toBe(true);
    expect(rec.socket).toBe(socket);
    const snapshot = captured.find((c) => c.event === 'snapshot');
    expect(snapshot).toBeTruthy();
    const payload = snapshot!.payload as {
      you: { studentId: string; done: boolean };
      autoApplied?: { message: string }[];
    };
    expect(payload.you.studentId).toBe(joined.studentId);
    expect(payload.autoApplied && payload.autoApplied.length).toBeGreaterThan(0); // 통지 전달
    expect(rec.autoApplied).toHaveLength(0); // 큐 비움
    expect(rec.device).toBe('phone'); // hello의 기기로 갱신
  });

  it('끝난 수업의 hello는 ended, 없는 코드는 서버측에서 not-found', async () => {
    const room = makeRoom({ lesson: testLesson, activities: testActivities });
    const joined = await room.joinStudent(fakeSocket(), { nickname: 'a' } satisfies JoinPayload);
    await room.endClass();
    const ack = await room.helloStudent(fakeSocket(), {
      code: '1234',
      token: joined.ok ? joined.token : undefined,
      device: 'laptop',
    } satisfies HelloPayload);
    expect(ack).toEqual({ ok: false, reason: 'ended' });
  });
});

describe('병합·내보내기 생명주기 (§5.8)', () => {
  it('같은 닉네임 join은 대기 요청을 만들고, merge 승인으로 기록을 이어받는다', async () => {
    const room = makeRoom({ lesson: testLesson, activities: testActivities });
    const firstCaptured: Captured[] = [];
    const first = await room.joinStudent(fakeSocket(firstCaptured), { nickname: 'nick' } satisfies JoinPayload);
    if (!first.ok) throw new Error('join 실패');

    const pendingCaptured: Captured[] = [];
    const pendingAck = await room.joinStudent(fakeSocket(pendingCaptured), {
      nickname: 'nick',
    } satisfies JoinPayload);
    if (pendingAck.ok || pendingAck.reason !== 'nickname-taken') throw new Error('nickname-taken 아님');
    const pendingId = pendingAck.pendingId;

    // roster에 pendingMerge 항목이 보인다
    const roster = room.rosterEntries();
    expect(roster.map((r) => r.studentId)).toContain(pendingId);
    expect(roster.find((r) => r.studentId === pendingId)?.pendingMerge).toBe(true);

    // 승인: merge { pendingId, intoId }
    const merged = await room.studentOp({ op: 'merge', pendingId, intoId: first.studentId });
    expect(merged).toEqual({ ok: true });

    // 기존 소켓은 kicked
    expect(firstCaptured.some((c) => c.event === 'kicked')).toBe(true);
    // 대기 소켓은 joined(새 토큰) + snapshot
    const joinedMsg = pendingCaptured.find((c) => c.event === 'joined');
    expect(joinedMsg).toBeTruthy();
    const newToken = (joinedMsg!.payload as { token: string }).token;
    expect(newToken).not.toBe(first.token);
    expect(pendingCaptured.some((c) => c.event === 'snapshot')).toBe(true);
    // 대기 항목은 roster에서 사라진다
    expect(room.rosterEntries().map((r) => r.studentId)).not.toContain(pendingId);

    // 로그에 admin merge(새 토큰 포함, §14 #63)
    const mergeLine = lines(room).find((l) => l.t === 'admin' && l.op.kind === 'merge');
    expect(mergeLine && mergeLine.t === 'admin' && mergeLine.op.kind === 'merge' && mergeLine.op.token).toBe(newToken);
  });

  it('merge 거부(kick pendingId)는 kicked merge-rejected', async () => {
    const room = makeRoom({ lesson: testLesson, activities: testActivities });
    await room.joinStudent(fakeSocket(), { nickname: 'nick' } satisfies JoinPayload);
    const pendingCaptured: Captured[] = [];
    const pendingAck = await room.joinStudent(fakeSocket(pendingCaptured), { nickname: 'nick' } satisfies JoinPayload);
    if (pendingAck.ok || pendingAck.reason !== 'nickname-taken') throw new Error('nickname-taken 아님');

    const ack = await room.studentOp({ op: 'kick', id: pendingAck.pendingId });
    expect(ack).toEqual({ ok: true });
    expect(pendingCaptured.some((c) => c.event === 'kicked' && (c.payload as { reason: string }).reason === 'merge-rejected')).toBe(true);
    expect(room.rosterEntries().some((r) => r.pendingMerge)).toBe(false);
  });

  it('kick은 토큰을 무효화하고 roster에서 제거한다', async () => {
    const room = makeRoom({ lesson: testLesson, activities: testActivities });
    const captured: Captured[] = [];
    const joined = await room.joinStudent(fakeSocket(captured), { nickname: 'a' } satisfies JoinPayload);
    if (!joined.ok) throw new Error('join 실패');
    const ack = await room.studentOp({ op: 'kick', id: joined.studentId });
    expect(ack).toEqual({ ok: true });
    expect(captured.some((c) => c.event === 'kicked' && (c.payload as { reason: string }).reason === 'kicked')).toBe(true);
    expect(room.students.has(joined.studentId)).toBe(false);
    // 토큰 무효화: hello로 재접속 불가
    const hello = await room.helloStudent(fakeSocket(), {
      code: '1234',
      token: joined.token,
      device: 'laptop',
    } satisfies HelloPayload);
    expect(hello).toEqual({ ok: true, resumed: false });
  });

  it('rename은 수업 내 유일해야 한다', async () => {
    const room = makeRoom({ lesson: testLesson, activities: testActivities });
    const a = await room.joinStudent(fakeSocket(), { nickname: 'a' } satisfies JoinPayload);
    const b = await room.joinStudent(fakeSocket(), { nickname: 'b' } satisfies JoinPayload);
    if (!a.ok || !b.ok) throw new Error('join 실패');
    expect(await room.studentOp({ op: 'rename', id: a.studentId, nickname: 'c' })).toEqual({ ok: true });
    expect(room.students.get(a.studentId)!.nickname).toBe('c');
    expect(await room.studentOp({ op: 'rename', id: b.studentId, nickname: 'c' })).toEqual({
      ok: false,
      reason: 'invalid-target',
    });
    expect(await room.studentOp({ op: 'rename', id: b.studentId, nickname: '01234567890' })).toEqual({
      ok: false,
      reason: 'invalid-target',
    });
  });

  it('join 잠금과 인원 제한 (§5.8)', async () => {
    const room = makeRoom({ lesson: testLesson, activities: testActivities, hooks: undefined });
    (room as unknown as { maxStudents: number }).maxStudents = 2;
    await room.joinStudent(fakeSocket(), { nickname: 'a' } satisfies JoinPayload);
    await room.joinStudent(fakeSocket(), { nickname: 'b' } satisfies JoinPayload);
    const full = await room.joinStudent(fakeSocket(), { nickname: 'c' } satisfies JoinPayload);
    expect(full).toEqual({ ok: false, reason: 'class-full' });
    await room.lockJoin(true);
    // 잠기면 새 닉네임도 거부
    const locked = await room.joinStudent(fakeSocket(), { nickname: 'd' } satisfies JoinPayload);
    expect(locked).toEqual({ ok: false, reason: 'join-locked' });
  });
});
