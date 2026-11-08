// next 알고리즘 (docs/live-api.md §5.5): 공개 먼저 · confirm-required · force ·
// 기본값 루프(50회 가드 → stalled) · 세그먼트 안 전이만 · cursor/highMark/highRevealed.
import { describe, expect, it } from 'vitest';
import type { ActPayload, JoinPayload } from '@gagyebu/live';
import { fakeSocket, makeRoom, memLog, type Captured } from './testutil/helpers.ts';
import { noConfirmLesson, stuckLesson, testActivities, testLesson } from './testutil/fake.ts';
import type { FakeAction, FakeState } from './testutil/fake.ts';
import type { StudentRecord } from './room.ts';

const HM = (room: ReturnType<typeof makeRoom>) => room.classState().highMark;

async function join(room: ReturnType<typeof makeRoom>, nickname: string, captured?: Captured[]): Promise<StudentRecord> {
  const socket = fakeSocket(captured);
  const ack = await room.joinStudent(socket, { nickname } satisfies JoinPayload);
  if (!ack.ok) throw new Error(`join 실패: ${JSON.stringify(ack)}`);
  const rec = room.students.get(ack.studentId);
  if (!rec) throw new Error('학생 기록이 없다');
  return rec;
}

async function act(room: ReturnType<typeof makeRoom>, rec: StudentRecord, action: FakeAction, seq = 1) {
  return room.act(rec.socket!, {
    seq,
    beat: HM(room),
    action,
  } satisfies ActPayload<FakeAction>);
}

describe('next: 공개 단계 먼저 (§5.5-1)', () => {
  it('reveal 비트에서는 next가 먼저 공개하고 커서는 움직이지 않는다', async () => {
    const room = makeRoom({ lesson: testLesson, activities: testActivities });
    await join(room, 'a');
    // 슬라이드 3비트 → 활동 join(0) → setup(1) → mid(2, reveal)
    for (let i = 0; i < 5; i++) await room.next(true);
    expect(HM(room)).toEqual({ segment: 1, beat: 2 });
    expect(room.cursor.revealed).toBe(false);

    const ack = await room.next(true);
    expect(ack).toEqual({ ok: true });
    expect(room.cursor).toEqual({ segment: 1, beat: 2, revealed: true });
    expect(room.highRevealed).toBe(true);
    // 로그에 reveal 줄이 남는다
    const log = memLogLines(room);
    expect(log.filter((l) => l.t === 'reveal').length).toBeGreaterThan(0);
  });

  it('reveal 뒤 next는 마감 확인으로 거부된다(pending 포함)', async () => {
    const room = makeRoom({ lesson: testLesson, activities: testActivities });
    await join(room, 'a'); // count 0
    for (let i = 0; i < 5; i++) await room.next(true);
    await room.next(true); // 공개
    const ack = await room.next(); // force 없음 — mid에서 count<3 미완료
    expect(ack).toEqual({ ok: false, reason: 'confirm-required', pending: 1 });
    expect(HM(room)).toEqual({ segment: 1, beat: 2 }); // 커서 안 움직임
  });

  it('confirmForce=false면 확인 없이 바로 기본값이 적용된다', async () => {
    const room = makeRoom({ lesson: noConfirmLesson, activities: testActivities });
    const rec = await join(room, 'a');
    for (let i = 0; i < 6; i++) await room.next(true); // mid 공개까지
    const ack = await room.next(); // force 없음 — confirmForce=false
    expect(ack).toEqual({ ok: true });
    expect((rec.states['game'] as FakeState).count).toBeGreaterThanOrEqual(3); // 기본값 루프 결과
    expect(HM(room)).toEqual({ segment: 1, beat: 3 });
  });
});

describe('next: 기본값 루프와 전이 (§5.5-3·4)', () => {
  it('미완료 학생의 기본값 루프가 done까지 반복하고 auto 줄 하나로 기록된다', async () => {
    const captured: Captured[] = [];
    const room = makeRoom({ lesson: testLesson, activities: testActivities });
    const rec = await join(room, 'a', captured); // count 0
    for (let i = 0; i < 5; i++) await room.next(true); // mid 도착
    await room.next(true); // 공개
    const ack = await room.next(true); // force — mid: 1→3까지 2걸음
    expect(ack).toEqual({ ok: true });
    const state = rec.states['game'] as FakeState;
    expect(state.count).toBe(3);
    // auto 줄은 학생·비트마다 하나: setup(1걸음) + mid(2걸음)
    const autos = memLogLines(room).filter((l) => l.t === 'auto');
    expect(autos).toHaveLength(2);
    const auto = autos[1]!;
    expect(auto.t === 'auto' && auto.actions).toHaveLength(2);
    expect(auto.t === 'auto' && auto.overflow).toBe(false);
    expect(auto.t === 'auto' && auto.kind).toBe('fallback');
    expect(auto.t === 'auto' && auto.notices).toHaveLength(2);
    // 통지는 다음 state/snapshot에 실려 전달되고 큐는 비워진다(§4.2)
    const stateMsgs = captured.filter((c) => c.event === 'state');
    const delivered = stateMsgs.reduce(
      (acc: number, c: Captured) => acc + (((c.payload as { autoApplied?: unknown[] }).autoApplied ?? []).length),
      0,
    );
    expect(delivered).toBe(3); // setup 1 + mid 2
    expect(rec.autoApplied).toHaveLength(0);
  });

  it('전이는 같은 활동 세그먼트 안에서만, 모든 학생(완료 포함)에게 1회', async () => {
    const room = makeRoom({ lesson: testLesson, activities: testActivities });
    const a = await join(room, 'a');
    const b = await join(room, 'b');
    // a는 setup에서 직접 완료, b는 기본값으로
    for (let i = 0; i < 4; i++) await room.next(true); // setup(1)
    await act(room, a, { type: 'add', n: 5 });
    await room.next(true); // setup 마감: b 기본값 +1, 전이 (1,2)
    expect((a.states['game'] as FakeState).marks).toContain('t12');
    expect((b.states['game'] as FakeState).marks).toContain('t12');
    expect((b.states['game'] as FakeState).count).toBe(1);
    // 전이 줄이 학생마다 기록된다(§8.2)
    const transitions = memLogLines(room).filter((l) => l.t === 'transition');
    expect(transitions).toHaveLength(2);
  });

  it('세그먼트 경계를 넘을 때는 전이가 없다', async () => {
    const room = makeRoom({ lesson: testLesson, activities: testActivities });
    const a = await join(room, 'a');
    // 끝까지 진행(final → outro)
    for (let i = 0; i < 12; i++) await room.next(true);
    expect(HM(room)).toEqual({ segment: 2, beat: 0 }); // 마지막 비트
    const state = a.states['game'] as FakeState;
    // 마지막 활동 비트(final)의 marks에 경계 전이가 없다: t12·t34만
    expect(state.marks).toEqual(['t12', 't34']);
  });

  it('마지막 비트에서 next는 invalid-target (§14 #5)', async () => {
    const room = makeRoom({ lesson: testLesson, activities: testActivities });
    await join(room, 'a');
    // 총 9비트 + 공개 1번 = 성공 next 9번 뒤 마지막 비트, 그 다음은 invalid-target
    for (let i = 0; i <= 9; i++) {
      const ack = await room.next(true);
      if (i < 9) expect(ack).toEqual({ ok: true });
      else expect(ack).toEqual({ ok: false, reason: 'invalid-target' });
    }
    expect(HM(room)).toEqual({ segment: 2, beat: 0 });
  });
});

describe('next: 50회 가드 → stalled (§4.2)', () => {
  it('fallback이 진전하지 않으면 50회에서 끊고 stalled, 수업은 계속', async () => {
    const room = makeRoom({ lesson: stuckLesson, activities: testActivities });
    const rec = await join(room, 'a');
    for (let i = 0; i < 5; i++) await room.next(true); // mid
    await room.next(true); // 공개
    const ack = await room.next(true); // force — stuck fallback
    expect(ack).toEqual({ ok: true }); // 수업은 계속
    expect(rec.stalled).toBe(true);
    const autos = memLogLines(room).filter((l) => l.t === 'auto');
    const auto = autos[0]!;
    expect(auto.t === 'auto' && auto.overflow).toBe(true);
    expect(auto.t === 'auto' && auto.actions).toHaveLength(50); // 최대 50회
    // 커서는 전진했다
    expect(HM(room)).toEqual({ segment: 1, beat: 3 });
  });
});

describe('cursor/highMark/highRevealed 갱신', () => {
  it('next마다 highMark가 따라가고 highRevealed는 공개 시점만 true', async () => {
    const room = makeRoom({ lesson: testLesson, activities: testActivities });
    await join(room, 'a');
    expect(room.version).toBe(0);
    await room.next(true);
    expect(room.cursor).toEqual({ segment: 0, beat: 1, revealed: false });
    expect(room.highMark).toEqual({ segment: 0, beat: 1 });
    expect(room.highRevealed).toBe(false);
    expect(room.version).toBe(1);
    for (let i = 0; i < 4; i++) await room.next(true); // mid
    expect(room.highMark).toEqual({ segment: 1, beat: 2 });
    await room.next(true); // 공개
    expect(room.highRevealed).toBe(true);
    await room.next(true); // 기본값 + 전이 + 커서 이동
    expect(room.highMark).toEqual({ segment: 1, beat: 3 });
    expect(room.highRevealed).toBe(false); // 새 live 비트는 미공개
  });

  it('학생 act는 version을 올리지 않고 done을 갱신한다', async () => {
    const room = makeRoom({ lesson: testLesson, activities: testActivities });
    const rec = await join(room, 'a');
    for (let i = 0; i < 4; i++) await room.next(true); // setup
    const before = room.version;
    const ack = await act(room, rec, { type: 'add', n: 2 });
    expect(ack.ok).toBe(true);
    if (ack.ok) {
      expect(ack.done).toBe(true);
      expect(ack.version).toBe(before); // ClassState는 안 바뀌었다
      expect((ack.state as FakeState).count).toBe(2);
    }
  });

  it('허용되지 않은 행동은 not-allowed, 답 없는 비트는 거부', async () => {
    const room = makeRoom({ lesson: testLesson, activities: testActivities });
    const rec = await join(room, 'a');
    await room.next(true); // 아직 슬라이드 — act 불가
    const ack = await act(room, rec, { type: 'add', n: 1 });
    expect(ack).toEqual({ ok: false, reason: 'not-allowed', message: '표시 비트에서는 조작할 수 없습니다.' });
  });
});

// memLog는 makeRoom 기본 로그 — 줄 접근 도우미
function memLogLines(room: ReturnType<typeof makeRoom>): import('./log.ts').LogLine[] {
  const log = (room as unknown as { log: { lines?: import('./log.ts').LogLine[] } }).log;
  if (!log.lines) throw new Error('파일 로그 방은 이 헬퍼를 쓸 수 없다');
  return log.lines;
}
