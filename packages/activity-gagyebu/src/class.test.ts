// 수업 시뮬레이션 하네스: 서버의 next 알고리즘(§5.5)·지각 합류 채우기(§8.3)을 그대로 흉내 내어
// 60명 혼합 학급이 예외·멈춤 없이 1년을 완주하는지, 집계·통지·결정성이 맞는지 확인한다 (M4·M5).
import { describe, expect, it } from 'vitest';
import { ENDING_ORDER } from '@gagyebu/core';
import { beatIndex, beatList, ClassHarness, cfg } from './testutil.ts';
import { transition } from './progress.ts';
import { stats } from './stats.ts';
import type { GagyebuStats } from './stats.ts';

const N = 60;
const WORK_BEAT_IDS = new Set(['survey', 'budget', ...Array.from({ length: 12 }, (_, i) => `m${i + 1}`)]);

/** 60명 혼합 학급: 12명 완전 게으름, 24명 부분 참여(초안·지불 패널 남기기), 24명 활발 */
function makeClass(seed: number): ClassHarness {
  const h = new ClassHarness(seed);
  for (let i = 0; i < N; i++) {
    const nickname = `봇${String(i + 1).padStart(2, '0')}`;
    const mod = i % 5;
    const behavior =
      mod === 0 ? { kind: 'lazy' as const } : mod <= 2 ? { kind: 'partial' as const, rate: 0.6 } : { kind: 'active' as const };
    h.join(nickname, behavior);
  }
  return h;
}

/** stats 모양 검증 (§9.4) */
function validateStats(st: GagyebuStats, beatId: string, total: number): void {
  switch (st.kind) {
    case 'none':
      return;
    case 'join':
      expect(st.joined).toBe(total);
      expect(st.connected).toBe(total);
      expect(st.nicknames).toHaveLength(total);
      return;
    case 'salary':
      expect(st.salary).toBe(2_650_000); // 모두 같은 월급
      return;
    case 'budget':
      expect(st.savingsRates).toHaveLength(st.shares.length);
      expect(st.savingsRates.length + st.autoCount).toBe(total);
      expect(st.autoCount).toBeGreaterThanOrEqual(0);
      return;
    case 'month': {
      const m = Number(/^m(\d+)$/.exec(beatId)?.[1]);
      expect(st.month).toBe(m);
      if (m === 4 || m === 10) expect(st.entry).toBeNull();
      else {
        expect(st.entry).not.toBeNull();
        expect(st.entry!.choices.length).toBeGreaterThan(0);
        expect(st.entry!.choices.every((c) => c.count >= 0)).toBe(true);
      }
      for (const bucket of [st.chained, st.scheduled]) {
        for (const t of bucket) {
          expect(t.reached).toBeGreaterThanOrEqual(t.choices.reduce((a, c) => a + c.count, 0));
          expect(t.choices.every((c) => c.count >= 0)).toBe(true);
        }
      }
      expect(st.inChained).toBeGreaterThanOrEqual(0);
      expect(st.inChained).toBeLessThanOrEqual(total);
      expect(st.netWorths).toHaveLength(total);
      expect(st.autoCount).toBeGreaterThanOrEqual(0);
      return;
    }
    case 'settlement':
      expect(st.endings.map((e) => e.endingId)).toEqual(ENDING_ORDER);
      expect(st.achievements).toHaveLength(13);
      expect(st.achievements.every((a) => a.rate >= 0 && a.rate <= 1)).toBe(true);
      expect(st.netWorths).toHaveLength(total);
      expect(st.autoCount).toBeGreaterThanOrEqual(0);
      return;
  }
}

/** 전이 후 새 비트에서 전원이 동기화됐는지 — 전이가 두 번 필요한 일이 없는지 (§9.3 방어 코드) */
function assertSync(h: ClassHarness): void {
  const id = h.beats[h.cursor]?.id ?? '';
  const month = Number(/^m(\d+)$/.exec(id)?.[1] ?? 0);
  for (const rec of h.students) {
    const s = rec.state;
    if (month > 0) {
      expect(s.month).toBe(month);
      expect(s.step).toBe('payday');
    }
    if (id === 'budget') expect(['budget', 'sim']).toContain(s.phase);
    if (id === 'survey-result' || id.startsWith('guide-')) expect(s.phase).toBe('guide');
    // 이미 적용한 전이를 다시 요구하지 않는다 — 두 번째 호출은 항상 []
    if (h.cursor > 0) {
      expect(transition(s, h.cursor - 1, h.cursor, cfg)).toEqual([]);
    }
  }
}

/** 한 비트: 학생 행동 → 통계·fuzz 검증 → next → 동기화 검증. 스냅숏을 모은다 */
function runBeatChecked(h: ClassHarness, snapshots: string[]): void {
  h.studentTurn();
  h.fuzzDisplayHelpers(); // fallback·locate·previewFallback이 어떤 상태에서도 예외 없이
  const beat = h.beats[h.cursor]!;
  const st = h.statsAt(h.cursor);
  validateStats(st, beat.id, h.students.length);
  if (st.kind !== 'join') {
    expect(JSON.stringify(st)).not.toContain('봇'); // 익명 (§9.4)
  }
  if (st.kind === 'month') {
    const expected = h.students.reduce((a, r) => a + (r.autoChoose[st.month] ?? 0), 0);
    expect(st.autoCount).toBe(expected); // autoCount = 자동 처리된 선택 응답 수
  }
  if (st.kind === 'budget') {
    expect(st.autoCount).toBe(h.students.filter((r) => r.state.initialBudget === null).length);
  }
  snapshots.push(JSON.stringify(st));
  const before = h.cursor;
  h.nextBeat(); // 공개 비트면 첫 호출은 공개만 하고 커서가 그대로다(§5.5-1)
  if (h.cursor !== before) assertSync(h); // 실제 비트가 넘어갔을 때만 동기화 검사
}

function runFullClass(seed: number): { h: ClassHarness; snapshots: string[] } {
  const h = makeClass(seed);
  const snapshots: string[] = [];
  while (h.cursor < h.beats.length - 1) runBeatChecked(h, snapshots);
  return { h, snapshots };
}

/** 시드 42 전 과정은 한 번만 돌리고 공유한다 (같은 시드라 결과도 같다) */
let cache42: { h: ClassHarness; snapshots: string[] } | null = null;
function run42(): { h: ClassHarness; snapshots: string[] } {
  cache42 ??= runFullClass(42);
  return cache42;
}

describe('60명 혼합 학급 시뮬레이션 (M4·M5)', () => {
  it('모든 학생이 예외·멈춤 없이 12월 결산(phase result)까지 간다', () => {
    const { h } = run42();
    expect(h.cursor).toBe(h.beats.length - 1); // present 비트
    for (const rec of h.students) {
      expect(rec.state.phase).toBe('result');
      expect(rec.state.settlement).not.toBeNull();
      expect(rec.stalled).toBe(false);
    }
    // 마지막 비트에서 next는 invalid-target — 하네스도 그렇게 멈춘다
    expect(() => h.nextBeat()).toThrow();
  });

  it('완전 게으른 학생의 통지: 절차적 걸음은 빈 문구, 실제 결정만 안내가 남는다 (§14 #123)', () => {
    const { h } = run42();
    const lazy = h.students.filter((r) => r.behavior.kind === 'lazy');
    expect(lazy).toHaveLength(12);
    for (const rec of lazy) {
      // 매 걸음마다 통지 큐에는 쌓이되(서버와 같은 모양), 빈 문구는 S8이 화면·서버에서 걸러낸다
      expect(rec.notices.length).toBeGreaterThanOrEqual(14); // 설문+가계부+12개월
      const nonEmpty = rec.notices.filter((n) => n.message.length > 0);
      const empty = rec.notices.filter((n) => n.message.length === 0);
      // 실제 결정(설문 기본값·가계부 확정·대안이 있는 장면 선택)의 안내만 남는다
      expect(nonEmpty.length).toBeGreaterThanOrEqual(3);
      expect(empty.length).toBeGreaterThan(0); // auto beginMonth·continue·재현 endMonth·확인 장면
      for (const n of nonEmpty) {
        expect(WORK_BEAT_IDS.has(n.beatId)).toBe(true);
      }
    }
  });

  it('결산 통계: 엔딩 분포 합계 = 전원, 달성률 0~1, 월 비트별 자동 처리도 추적값과 같다', () => {
    const { h } = run42();
    const states = h.students.map((r) => r.state);
    const st = stats(states, beatIndex('m12'), cfg);
    if (st.kind !== 'settlement') throw new Error('kind settlement 아님');
    expect(st.endings.reduce((a, e) => a + e.count, 0)).toBe(N);
    expect(st.achievements.every((a) => a.rate >= 0 && a.rate <= 1)).toBe(true);
    // 60명 요약 (보고용 수치 — 별도 스크립트로도 확인한다)
    const endingDist = st.endings.filter((e) => e.count > 0).map((e) => `${e.label}:${e.count}`);
    const autoPerBeat = beatList
      .filter((b) => /^m\d+$/.test(b.id))
      .map((b) => {
        const ms = stats(states, beatList.indexOf(b), cfg);
        return `${b.id}=${ms.kind === 'month' || ms.kind === 'settlement' ? ms.autoCount : 0}`;
      });
    expect(endingDist.length).toBeGreaterThan(0);
    expect(autoPerBeat).toHaveLength(12);
  });

  it('리뷰처럼 모든 비트 통계를 다시 계산해도 autoCount가 추적값과 정확히 일치한다', () => {
    const { h } = run42();
    const states = h.students.map((r) => r.state);
    for (let m = 1; m <= 11; m++) {
      const st = stats(states, beatIndex(`m${m}`), cfg);
      if (st.kind !== 'month') throw new Error(`kind month 아님: m${m}`);
      const expected = h.students.reduce((a, r) => a + (r.autoChoose[m] ?? 0), 0);
      expect(st.autoCount).toBe(expected);
    }
    const s12 = stats(states, beatIndex('m12'), cfg);
    if (s12.kind !== 'settlement') throw new Error('kind settlement 아님');
    expect(s12.autoCount).toBe(h.students.filter((r) => Object.values(r.autoChoose).some((v) => v > 0)).length);
  });

  it('같은 시드면 두 번 돌려도 전 과정이 결정적이다 (상태·통계 스냅숏)', () => {
    const a = runFullClass(7);
    const b = runFullClass(7);
    expect(b.snapshots).toEqual(a.snapshots);
    expect(b.h.students.map((r) => r.state)).toEqual(a.h.students.map((r) => r.state));
    expect(b.h.students.map((r) => r.notices)).toEqual(a.h.students.map((r) => r.notices));
  });

  it('다른 시드면 결과가 달라진다 (난수가 실제로 쓰이고 있다)', () => {
    const a = runFullClass(7);
    const c = runFullClass(8);
    expect(c.h.students.map((r) => r.state)).not.toEqual(a.h.students.map((r) => r.state));
  });
});

describe('지각 합류 채우기 (§8.3)', () => {
  function advanceTo(h: ClassHarness, beatId: string): void {
    while (h.beats[h.cursor]?.id !== beatId) {
      h.studentTurn();
      h.nextBeat();
    }
  }

  it('가계부 비트에서 합류: 설문 채우기 + 안내→가계부 전이(goto)까지 적용되고 정상 참여한다', () => {
    const h = new ClassHarness(11);
    h.join('봇01', { kind: 'lazy' });
    h.join('봇02', { kind: 'active' });
    advanceTo(h, 'budget');
    const late = h.join('봇03', { kind: 'active' });
    // 채우기는 live 비트 "바로 앞"까지 — live 비트로 들어가는 전이(goto) 포함
    expect(late.state.survey.result).not.toBeNull(); // 설문 비트 기본값
    expect(late.state.phase).toBe('budget'); // guide-6 → budget 전이 적용됨
    expect(late.notices).toEqual([]); // 지각 채우기는 통지 없음(§8.3)
    // live 비트에서 정상 참여
    h.studentTurn();
    expect(late.state.phase).toBe('sim');
    while (h.cursor < h.beats.length - 1) {
      h.studentTurn();
      h.nextBeat();
    }
    expect(late.state.phase).toBe('result');
  });

  it('5월 비트에서 합류: 4월 리포트까지 채우고 5월 월급날에 선다', () => {
    const h = new ClassHarness(12);
    h.join('봇01', { kind: 'lazy' });
    h.join('봇02', { kind: 'active' });
    advanceTo(h, 'm5');
    const late = h.join('봇03', { kind: 'active' });
    expect(late.state.phase).toBe('sim');
    expect(late.state.month).toBe(5); // m4 → m5 전이(endMonth) 적용됨
    expect(late.state.step).toBe('payday');
    expect(late.state.initialBudget).not.toBeNull(); // 가계부 비트도 채워짐
    expect(late.notices).toEqual([]);
    // 이전 달 자동 처리 기록은 stats에 보인다(4월)
    const st4 = h.statsAt(beatIndex('m4'));
    if (st4.kind !== 'month') throw new Error('kind month 아님');
    expect(st4.autoCount).toBeGreaterThanOrEqual(1); // 지각생의 4월 자동 선택
    // 5월 비트에서 정상 참여
    h.studentTurn();
    expect(late.state.month).toBe(5);
    expect(late.state.step).not.toBe('payday'); // 스스로 시작했다
    while (h.cursor < h.beats.length - 1) {
      h.studentTurn();
      h.nextBeat();
    }
    expect(late.state.phase).toBe('result');
  });

  it('12월 비트에서 합류: 11월 리포트까지 채우고 스스로 결산을 시작한다', () => {
    const h = new ClassHarness(13);
    h.join('봇01', { kind: 'lazy' });
    h.join('봇02', { kind: 'active' });
    advanceTo(h, 'm12');
    const late = h.join('봇03', { kind: 'active' });
    expect(late.state.month).toBe(12); // m11 → m12 전이(endMonth) 적용됨
    expect(late.state.step).toBe('payday');
    expect(late.state.phase).toBe('sim');
    h.studentTurn(); // 12월 결산 시작 — 정상 참여
    expect(late.state.phase).toBe('result');
    expect(late.state.settlement).not.toBeNull();
    while (h.cursor < h.beats.length - 1) {
      h.studentTurn();
      h.nextBeat();
    }
    for (const rec of h.students) expect(rec.state.phase).toBe('result');
  });
});
