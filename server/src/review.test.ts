// 리뷰 모드 (docs/live-api.md §4.1, §5.7): prev/goto 규칙, stale-beat,
// 리뷰 중 next는 커서만, stats는 커서 비트 기준 + progress는 highMark 기준.
import { describe, expect, it } from 'vitest';
import type { ActPayload, BeatRef } from '@gagyebu/live';
import { fakeSocket, makeRoom } from './testutil/helpers.ts';
import { testActivities, testLesson } from './testutil/fake.ts';
import type { FakeAction, FakeState } from './testutil/fake.ts';
import type { StudentRecord } from './room.ts';

async function join(room: ReturnType<typeof makeRoom>, nickname: string): Promise<StudentRecord> {
  const socket = fakeSocket();
  const ack = await room.joinStudent(socket, { nickname });
  if (!ack.ok) throw new Error('join 실패');
  return room.students.get(ack.studentId)!;
}

/** mid(seg1,beat2)까지 진행하고 공개한 방. highMark={1,2}, highRevealed=true */
async function roomAtMid() {
  const room = makeRoom({ lesson: testLesson, activities: testActivities });
  await join(room, 'a');
  for (let i = 0; i < 5; i++) await room.next(true); // mid
  await room.next(true); // 공개 → highRevealed=true
  return room;
}

describe('prev/goto (§5.7)', () => {
  it('prev는 가장 가까운 이전 show 비트로, 리뷰 상태가 된다', async () => {
    const room = await roomAtMid();
    const ack = await room.prev();
    expect(ack).toEqual({ ok: true });
    // mid 앞의 show 비트: intro 덱의 why--1(seg0, beat2)
    expect(room.cursor).toEqual({ segment: 0, beat: 2, revealed: false });
    expect(room.highMark).toEqual({ segment: 1, beat: 2 }); // highMark 불변
    expect(room.highRevealed).toBe(true); // 복원용 보존
    expect(room.version).toBe(7); // next 5 + reveal 1 + prev 1
  });

  it('첫 비트에서 prev는 invalid-target', async () => {
    const room = makeRoom({ lesson: testLesson, activities: testActivities });
    const ack = await room.prev();
    expect(ack).toEqual({ ok: false, reason: 'invalid-target' });
  });

  it('goto는 highMark 이내의 show 비트만; work 비트·앞쪽 건너뛰기는 거부', async () => {
    const room = await roomAtMid();
    // show 비트 seg0 beat1(why--0) — OK
    expect(await room.goto({ segment: 0, beat: 1 })).toEqual({ ok: true });
    // work 비트(seg1 beat1 setup) — 거부
    expect(await room.goto({ segment: 1, beat: 1 })).toEqual({ ok: false, reason: 'invalid-target' });
    // highMark보다 앞 — 거부
    expect(await room.goto({ segment: 1, beat: 3 })).toEqual({ ok: false, reason: 'invalid-target' });
    expect(await room.goto({ segment: 2, beat: 0 })).toEqual({ ok: false, reason: 'invalid-target' });
    // 없는 비트 — 거부
    expect(await room.goto({ segment: 5, beat: 0 })).toEqual({ ok: false, reason: 'invalid-target' });
  });

  it('goto highMark 자신은 허용되고 공개 상태를 복원한다', async () => {
    const room = await roomAtMid();
    await room.prev(); // 리뷰
    expect(await room.goto({ segment: 1, beat: 2 })).toEqual({ ok: true }); // live 비트로 복귀
    expect(room.cursor).toEqual({ segment: 1, beat: 2, revealed: true }); // highRevealed 복원
    expect(before(room.cursor, room.highMark)).toBe(false); // 리뷰 아님
  });
});

describe('리뷰 중 행동과 next (§5.7)', () => {
  it('리뷰 중 학생 act는 stale-beat로 거부', async () => {
    const room = await roomAtMid();
    const rec = room.students.values().next().value!;
    await room.prev();
    const ack = await room.act(rec.socket!, {
      seq: 1,
      beat: { segment: 1, beat: 2 }, // live 비트를 보내도
      action: { type: 'add', n: 1 } satisfies FakeAction,
    } satisfies ActPayload<FakeAction>);
    expect(ack).toEqual({ ok: false, reason: 'stale-beat' });
  });

  it('리뷰 중 next는 커서만 전진: show 비트 순서대로, 끝에서 highMark로', async () => {
    const room = await roomAtMid();
    await room.prev(); // → seg0 beat2 (why--1)
    // 중간에 show 비트가 없다(join·setup·mid는 work) → highMark 자신으로, revealed 복원
    expect(await room.next()).toEqual({ ok: true });
    expect(room.cursor).toEqual({ segment: 1, beat: 2, revealed: true });
    expect(room.highMark).toEqual({ segment: 1, beat: 2 }); // 불변
    expect(room.highRevealed).toBe(true);
    // 리뷰가 끝났으므로 다음 next는 정상 동작(공개는 이미 됐으니 마감 확인)
    const ack = await room.next();
    expect(ack).toEqual({ ok: false, reason: 'confirm-required', pending: 1 });
  });

  it('리뷰 중 show 비트를 거쳐 전진한다(highMark 이내만)', async () => {
    const room = await roomAtMid();
    // show 비트(seg1,beat3)를 지나 final까지 진행한 뒤 되돌아본다
    await room.next(true); // mid 마감 → show
    await room.next(true); // show → final
    expect(room.highMark).toEqual({ segment: 1, beat: 4 });
    await room.goto({ segment: 1, beat: 3 }); // show 비트로 리뷰
    expect(room.cursor).toEqual({ segment: 1, beat: 3, revealed: false });
    // 리뷰 next: 다음 show 비트는 없다(final은 work) → highMark 자신
    expect(await room.next()).toEqual({ ok: true });
    expect(room.cursor).toEqual({ segment: 1, beat: 4, revealed: false });
    expect(room.highMark).toEqual({ segment: 1, beat: 4 });
  });

  it('리뷰 중 next는 마감·기본값·전이를 전혀 실행하지 않는다', async () => {
    const room = await roomAtMid();
    const rec = room.students.values().next().value!;
    const countBefore = (rec.states['game'] as FakeState).count;
    await room.prev();
    await room.next();
    await room.next(); // highMark 복귀
    expect((rec.states['game'] as FakeState).count).toBe(countBefore); // 상태 불변
  });
});

describe('리뷰 중 stats (§5.7, §14 #59)', () => {
  it('stats.beat는 커서 비트, progress·fallbackPreview는 항상 highMark 기준', async () => {
    const room = await roomAtMid();
    const rec = room.students.values().next().value!;
    await act(room, rec, { type: 'add', n: 3 }); // mid 완료(count 3)
    await room.prev(); // → seg0 beat2(슬라이드)
    const p = room.statsPayload();
    expect(p.beat).toEqual({ segment: 0, beat: 2 } satisfies BeatRef); // 커서 비트
    expect((p.stats as { kind: string }).kind).toBe('none'); // 슬라이드 비트 집계 없음
    expect(p.progress).toEqual({ done: 1, connected: 1, total: 1 }); // highMark(mid) 기준 완료
    expect(p.fallbackPreview).toBe(null); // 미완료 없음

    // 활동 show 비트로 이동해도 progress는 여전히 highMark 기준
    await room.goto({ segment: 0, beat: 1 }); // 슬라이드 show 비트
    const q = room.statsPayload();
    expect(q.beat).toEqual({ segment: 0, beat: 1 });
    expect((q.stats as { kind: string }).kind).toBe('none');
    expect(q.progress.done).toBe(1); // highMark 기준
  });

  it('활동 show 비트의 리뷰 통계: stats.beat가 커서를 따라간다', async () => {
    const room = await roomAtMid();
    const rec = room.students.values().next().value!;
    await act(room, rec, { type: 'add', n: 3 }); // mid 완료
    await room.next(true); // mid 마감 → show(seg1,beat3)
    await room.next(true); // show → final(seg1,beat4)
    await room.goto({ segment: 1, beat: 3 }); // 활동 show 비트 리뷰
    const p = room.statsPayload();
    expect(p.beat).toEqual({ segment: 1, beat: 3 });
    expect((p.stats as { kind: string; beat: number }).kind).toBe('counter'); // 커서 비트 통계
    expect((p.stats as { beat: number }).beat).toBe(3);
    expect(p.progress.done).toBe(0); // highMark(final) 기준 — count 3 < 5
  });

  it('fallbackPreview는 첫 미완료 학생의 현재 장면 기준(§9.4)', async () => {
    const room = await roomAtMid();
    const a = room.students.values().next().value!; // setup 기본값으로 count 1
    const b = await join(room, 'b'); // 지각 합류: setup 채우기로 count 1
    const p = room.statsPayload();
    expect((a.states['game'] as FakeState).count).toBe(1);
    expect((b.states['game'] as FakeState).count).toBe(1);
    expect(p.fallbackPreview).toBe('+1로 자동 (현재 1)'); // a(id s1)가 첫 미완료
    expect(p.progress).toEqual({ done: 0, connected: 2, total: 2 });
  });
});

async function act(room: ReturnType<typeof makeRoom>, rec: StudentRecord, action: FakeAction, seq = 1) {
  return room.act(rec.socket!, {
    seq,
    beat: room.highMark,
    action,
  } satisfies ActPayload<FakeAction>);
}

function before(a: BeatRef, b: BeatRef): boolean {
  return a.segment < b.segment || (a.segment === b.segment && a.beat < b.beat);
}
