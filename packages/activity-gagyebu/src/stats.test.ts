// 비트별 익명 집계 단위 테스트 (docs/live-api.md §9.4).
import { describe, expect, it } from 'vitest';
import { ACHIEVEMENT_ORDER, ENDING_ORDER, autoPaymentPlan, defaultAnswers, getScene, step } from '@gagyebu/core';
import type { Action, EventId, GameState, PaySpec } from '@gagyebu/core';
import { beats } from './beats.ts';
import type { GagyebuConfig } from './config.ts';
import { fallback } from './progress.ts';
import { stats } from './stats.ts';
import type { GagyebuStats } from './stats.ts';
import { apply, atFebPayday, atFebScene, beatIndex, beatList, cfg, runFallback, simStudent, student } from './testutil.ts';

const list = beatList;
const at = beatIndex;

function statsOf(states: GameState[], beatId: string, cfg2: GagyebuConfig = cfg): GagyebuStats {
  return stats(states, at(beatId), cfg2);
}

/** 자동(기본값) 경로로 해당 비트까지 진행한 상태 */
function lazyAt(beatId: string): GameState {
  return runFallback(atFebPayday(), at(beatId));
}

/** pay 선택지를 autoPaymentPlan으로 골라 choose하는 헬퍼 */
function chooseWithPlan(s: GameState, eventId: EventId, sceneId: string, choiceId: string): GameState {
  const scene = getScene({ eventId, sceneId }).scene;
  const choice = scene.choices.find((c) => c.id === choiceId)!;
  const a: Extract<Action, { type: 'choose' }> = { type: 'choose', choiceId };
  if (choice.pay) {
    const pay = choice.pay as PaySpec;
    a.payment = autoPaymentPlan(s, pay).plan;
    if (pay.adjustable) a.amount = pay.adjustable.min;
  }
  if (choice.deposit) a.depositTo = choice.deposit.targets[0]!;
  return step(s, a);
}

describe('stats — 비트별 kind (§9.4)', () => {
  it('join: 입장 인원·닉네임 (닉네임이 나오는 유일한 kind)', () => {
    const st = statsOf([student('봇1'), student('봇2')], 'join');
    expect(st).toEqual({ kind: 'join', joined: 2, connected: 2, nicknames: ['봇1', '봇2'] });
  });

  it('salary: 기준 월급과 학생별 월급', () => {
    const st = statsOf([student('봇1'), student('봇2')], 'salary');
    if (st.kind !== 'salary') throw new Error('kind salary 아님');
    expect(st.baseSalary).toBe(2_600_000);
    expect(st.salaries).toHaveLength(2);
    expect(st.salaries.every((x) => x > 0)).toBe(true);
  });

  it('survey·survey-result·guide·present는 { kind: "none" } — 설문 답은 분포로 나오지 않는다', () => {
    const s = student('봇1');
    for (const id of ['survey', 'survey-result', 'guide-1', 'guide-6', 'present']) {
      expect(statsOf([s], id)).toEqual({ kind: 'none' });
    }
    const submitted = step(s, { type: 'submitSurvey', answers: defaultAnswers({}) });
    expect(statsOf([submitted], 'survey')).toEqual({ kind: 'none' });
  });

  it('budget: 확정한 학생의 initialBudget 분포 + 미확정 autoCount (§14)', () => {
    const confirmed = simStudent('봇1');
    const editing = apply(student('봇2'), { type: 'submitSurvey', answers: defaultAnswers({}) }, { type: 'goto', phase: 'budget' });
    const st = statsOf([confirmed, editing, student('봇3')], 'budget');
    if (st.kind !== 'budget') throw new Error('kind budget 아님');
    expect(st.savingsRates).toHaveLength(1); // 확정한 학생만 분포에
    expect(st.shares).toHaveLength(1);
    expect(Object.keys(st.shares[0]!).sort()).toEqual(['emergency', 'goal', 'housing', 'invest', 'living', 'savings']);
    const sum = Object.values(st.shares[0]!).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 5);
    expect(st.savingsRates[0]).toBeGreaterThan(0);
    expect(st.autoCount).toBe(2); // 아직 확정하지 않은 학생 = 지금 넘기면 자동 처리될 인원
  });

  it('month: 배치 이벤트 첫 장면 집계 — 선택지는 데이터 순서, 자동 응답은 막대에서 빼고 autoCount로', () => {
    // 수동 경로: used → seller에서 safe 선택 → 리포트
    let manual = atFebScene();
    manual = chooseWithPlan(manual, 'laptop-spill', 'start', 'used');
    manual = step(manual, { type: 'continue' }); // seller 장면
    manual = chooseWithPlan(manual, 'laptop-spill', 'seller', 'safe');
    manual = step(manual, { type: 'continue' }); // 리포트
    // 자동 경로: splurge
    const r = fallback(atFebScene(), at('m2'), cfg, undefined);
    const auto = step(step(atFebScene(), r.action), { type: 'continue' });

    const st = statsOf([manual, auto], 'm2');
    if (st.kind !== 'month') throw new Error('kind month 아님');
    expect(st.month).toBe(2);
    expect(st.entry).not.toBeNull();
    const entry = st.entry!;
    expect(entry.eventId).toBe('laptop-spill');
    expect(entry.sceneId).toBe('start');
    expect(entry.channel).toBe('narration');
    expect(entry.title).toBe('노트북에 커피를 쏟음');
    expect(entry.choices.map((c) => c.choiceId)).toEqual(['repair', 'used', 'splurge', 'new', 'wait']); // 데이터 순서
    expect(entry.choices.find((c) => c.choiceId === 'used')!.count).toBe(1);
    expect(entry.choices.find((c) => c.choiceId === 'splurge')!.count).toBe(0); // 자동은 막대에서 빠진다
    expect(st.autoCount).toBe(1);
    // seller는 연쇄 장면 — used를 고른 학생만 도달·선택
    expect(st.chained.map((c) => c.sceneId)).toEqual(['seller']);
    expect(st.chained[0]!.reached).toBe(1);
    expect(st.chained[0]!.choices.map((c) => c.choiceId)).toEqual(['transfer', 'safe', 'meet']);
    expect(st.chained[0]!.choices.find((c) => c.choiceId === 'safe')!.count).toBe(1);
    expect(st.scheduled).toEqual([]);
    expect(st.inChained).toBe(0); // 둘 다 리포트로 이동했다
    expect(st.netWorths).toHaveLength(2);
  });

  it('month: 연쇄 장면에 서 있는 학생 수(inChained)', () => {
    const onSeller = apply(atFebScene(), { type: 'choose', choiceId: 'used' }, { type: 'continue' });
    const st = statsOf([onSeller, atFebPayday()], 'm2');
    if (st.kind !== 'month') throw new Error('kind month 아님');
    expect(st.inChained).toBe(1);
  });

  it('month: 조용한 달(4월)은 entry가 null, 예약 장면(again·check4)은 scheduled 버킷에', () => {
    // 3월 자동 경로(flip3 → check4 예약)와 2월 wait 선택(again 예약)을 4월까지 진행
    const aprA = runFallback(lazyAt('m3'), at('m4')); // check4 선택까지
    let waitFeb = chooseWithPlan(atFebScene(), 'laptop-spill', 'start', 'wait'); // next: again(+2개월)
    waitFeb = step(waitFeb, { type: 'continue' }); // 2월 리포트
    const aprB = runFallback(waitFeb, at('m4')); // again 선택 → check4 선택 → 리포트
    expect(aprA.month).toBe(4);
    expect(aprB.month).toBe(4);

    const st = statsOf([aprA, aprB], 'm4');
    if (st.kind !== 'month') throw new Error('kind month 아님');
    expect(st.entry).toBeNull(); // 조용한 달 — 배치 이벤트 없음
    expect(st.scheduled.map((x) => x.sceneId)).toEqual(['again', 'check4']); // 이벤트 데이터 순서
    expect(st.scheduled[0]!.reached).toBe(1); // again: aprB만
    expect(st.scheduled[1]!.reached).toBe(2); // check4: 둘 다
    expect(st.chained).toEqual([]);
  });

  it('month: 6월은 예약(check6) + 배치(rent-hike)가 함께 나온다', () => {
    const june = runFallback(lazyAt('m3'), at('m6')); // check4(hold) → check6 예약 → 6월 자동 진행
    expect(june.month).toBe(6);
    expect(june.step).toBe('report');
    const st = statsOf([june], 'm6');
    if (st.kind !== 'month') throw new Error('kind month 아님');
    expect(st.entry!.eventId).toBe('rent-hike');
    expect(st.entry!.sceneId).toBe('notice');
    expect(st.entry!.choices.map((c) => c.choiceId)).toEqual(['accept', 'ignore', 'negotiate', 'move']);
    expect(st.scheduled.map((x) => x.sceneId)).toEqual(['check6']);
    expect(st.chained).toEqual([]); // 자동 경로는 negotiate를 안 골라 counter가 없다
  });

  it('month: 8월 자동 경로는 drop 장면 — 기본 선택지 sellAll이 autoCount로 센다', () => {
    const aug = lazyAt('m8'); // 8월 리포트까지 자동 진행 (투자 잔고 > 0 → drop)
    expect(aug.month).toBe(8);
    const st = statsOf([aug], 'm8');
    if (st.kind !== 'month') throw new Error('kind month 아님');
    expect(st.entry!.eventId).toBe('market-crash');
    expect(st.entry!.sceneId).toBe('drop');
    expect(st.entry!.choices.find((c) => c.choiceId === 'sellAll')!.count).toBe(0); // 자동이라 막대에서 빠짐
    expect(st.autoCount).toBeGreaterThanOrEqual(1);
  });

  it('settlement: 엔딩은 ENDING_ORDER 순서, 도전과제는 ACHIEVEMENT_ORDER 순서, 자동 학생 수', () => {
    const dec = lazyAt('m12'); // 기본값만으로 1년 완주 — '빚과의 동거' (core §4.5)
    expect(dec.phase).toBe('result');
    const st = statsOf([dec], 'm12');
    if (st.kind !== 'settlement') throw new Error('kind settlement 아님');
    expect(st.endings.map((e) => e.endingId)).toEqual(ENDING_ORDER);
    expect(st.endings.find((e) => e.endingId === 'debt')!.count).toBe(1);
    expect(st.endings.find((e) => e.endingId === 'debt')!.label).toBe('빚과의 동거');
    expect(st.achievements.map((a) => a.achievementId)).toEqual(ACHIEVEMENT_ORDER);
    expect(st.achievements.every((a) => a.rate >= 0 && a.rate <= 1)).toBe(true);
    expect(st.netWorths).toHaveLength(1);
    expect(st.autoCount).toBe(1); // 자동 처리 기록이 하나라도 있는 학생 수(§14)
  });

  it('settlement: 아직 결산하지 않은 학생은 엔딩 집계에 들어가지 않는다', () => {
    const done12 = lazyAt('m12');
    const notYet = lazyAt('m11'); // 11월 리포트 — 12월 결산 전
    const st = statsOf([done12, notYet], 'm12');
    if (st.kind !== 'settlement') throw new Error('kind settlement 아님');
    expect(st.endings.reduce((a, e) => a + e.count, 0)).toBe(1);
  });
});

describe('stats — 익명성 (§9.4)', () => {
  it('join 외 kind에는 닉네임이 절대 나오지 않는다', () => {
    const states = [student('봇1'), student('봇2'), simStudent('봇3'), lazyAt('m12')];
    for (const b of list) {
      const st = stats(states, list.indexOf(b), cfg);
      if (st.kind === 'join') continue;
      expect(JSON.stringify(st)).not.toContain('봇');
    }
  });
});

describe('stats — 결정성·모양', () => {
  it('같은 states 배열에 대해 항상 같은 결과', () => {
    const states = [lazyAt('m2'), lazyAt('m5'), lazyAt('m12')];
    for (let i = 0; i < list.length; i++) {
      expect(stats(states, i, cfg)).toEqual(stats(states, i, cfg));
    }
  });

  it('빈 학생 목록에서도 예외 없이 모양이 유효하다', () => {
    expect(stats([], at('join'), cfg)).toEqual({ kind: 'join', joined: 0, connected: 0, nicknames: [] });
    expect(stats([], at('salary'), cfg)).toEqual({ kind: 'salary', baseSalary: 2_600_000, salaries: [] });
    expect(stats([], at('budget'), cfg)).toMatchObject({ kind: 'budget', autoCount: 0 });
    // 조용한 달(4월)은 entry도 null — 이벤트 달(2월)은 기록이 없어도 entry 골격이 나온다
    expect(stats([], at('m4'), cfg)).toMatchObject({ kind: 'month', month: 4, entry: null, chained: [], scheduled: [], inChained: 0, autoCount: 0 });
    expect(stats([], at('m2'), cfg)).toMatchObject({ kind: 'month', month: 2, chained: [], scheduled: [], inChained: 0, autoCount: 0 });
    expect((stats([], at('m2'), cfg) as { entry: { sceneId: string } | null }).entry!.sceneId).toBe('start');
    expect(stats([], at('m12'), cfg)).toMatchObject({ kind: 'settlement' });
    expect(stats([], 999, cfg)).toEqual({ kind: 'none' });
  });

  it('cfg.guide=false·spotlight=false 설정에서도 같이 계산한다', () => {
    const cfg2: GagyebuConfig = { ...cfg, guide: false, monthReveal: false, spotlight: false };
    const list2 = beats(cfg2);
    const states = [simStudent('봇1')];
    expect(stats(states, list2.findIndex((b) => b.id === 'm1'), cfg2).kind).toBe('month');
    expect(stats(states, list2.findIndex((b) => b.id === 'budget'), cfg2).kind).toBe('budget');
    expect(stats(states, list2.findIndex((b) => b.id === 'survey-result'), cfg2)).toEqual({ kind: 'none' });
  });
});
