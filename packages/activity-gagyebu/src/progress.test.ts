// 비트별 allowed / done / fallback / transition / previewFallback / locate 단위 테스트 (docs/live-api.md §9.3).
import { describe, expect, it } from 'vitest';
import { autoPaymentPlan, defaultAnswers, getScene, step } from '@gagyebu/core';
import type { Action, GameState } from '@gagyebu/core';
import { beats } from './beats.ts';
import type { GagyebuConfig } from './config.ts';
import { allowed, done, fallback, initState, locate, previewFallback, transition } from './progress.ts';

const cfg: GagyebuConfig = { guide: true, monthReveal: true, spotlight: true, confirmForce: true };
const list = beats(cfg);
const at = (id: string): number => {
  const i = list.findIndex((b) => b.id === id);
  if (i < 0) throw new Error(`비트 없음: ${id}`);
  return i;
};

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

function apply(s: GameState, ...as: Action[]): GameState {
  return as.reduce((acc, a) => step(acc, a), s);
}

/** 기저 + start 행동까지 적용한 학생 (phase 'survey') */
function student(nickname = '테스트'): GameState {
  const { state, actions } = initState({ nickname, random: () => 0.5 }, cfg);
  return apply(state, ...actions);
}

/** 설문·안내·가계부 확정까지 마친 학생 (phase 'sim', month 1, step 'payday') */
function simStudent(nickname = '테스트'): GameState {
  return apply(
    student(nickname),
    { type: 'submitSurvey', answers: defaultAnswers({}) },
    { type: 'goto', phase: 'budget' },
    { type: 'confirmBudget' },
  );
}

/** 1월 튜토리얼을 마치고 2월 월급날에 있는 학생 */
function atFebPayday(): GameState {
  return apply(simStudent(), { type: 'beginMonth' }, { type: 'choose', choiceId: 'ok' }, { type: 'continue' }, { type: 'endMonth' });
}

/** 2월 장면(start)에 서 있는 학생 */
function atFebScene(): GameState {
  return apply(atFebPayday(), { type: 'beginMonth' });
}

/** done이 될 때까지 fallback을 반복 적용한다(서버의 기본값 루프, §5.5-3) */
function runFallback(s: GameState, beat: number, draft?: unknown): GameState {
  let cur = s;
  for (let i = 0; i < 60 && !done(cur, beat, cfg); i++) {
    const r = fallback(cur, beat, cfg, draft);
    cur = step(cur, r.action);
  }
  return cur;
}

describe('init (§4.2)', () => {
  it('기저 상태는 결정적이고 월급은 행동에 박힌다', () => {
    const a = initState({ nickname: '하늘', random: () => 0.3 }, cfg);
    const b = initState({ nickname: '하늘', random: () => 0.3 }, cfg);
    expect(a.state).toEqual(b.state);
    expect(a.state.phase).toBe('start');
    expect(a.state.profile.salary).toBe(0); // 난수는 상태가 아니라 행동에
    expect(a.actions).toHaveLength(1);
    expect(a.actions[0]).toMatchObject({ type: 'start', nickname: '하늘' });
    expect((a.actions[0] as { salary: number }).salary).toBeGreaterThan(0);
  });

  it('같은 닉네임·다른 난수면 행동의 월급만 달라진다', () => {
    const a = initState({ nickname: '하늘', random: () => 0.9 }, cfg);
    const b = initState({ nickname: '하늘', random: () => 0.1 }, cfg);
    expect(a.state).toEqual(b.state);
    expect((a.actions[0] as { salary: number }).salary).not.toBe((b.actions[0] as { salary: number }).salary);
  });
});

describe('allowed (§9.3 허용 목록)', () => {
  it('설문 비트: submitSurvey만 받는다', () => {
    const s = student();
    expect(allowed(s, at('survey'), { type: 'submitSurvey', answers: defaultAnswers({}) }, cfg)).toBe(true);
    expect(allowed(s, at('survey'), { type: 'setBudget', budget: s.budget }, cfg)).not.toBe(true);
    expect(allowed(s, at('survey'), { type: 'beginMonth' }, cfg)).not.toBe(true);
  });

  it('학생 행동의 auto 표시는 무조건 거부한다', () => {
    const s = student();
    expect(allowed(s, at('survey'), { type: 'submitSurvey', answers: defaultAnswers({}), auto: true }, cfg)).not.toBe(true);
    expect(allowed(simStudent(), at('m1'), { type: 'choose', choiceId: 'x', auto: true }, cfg)).not.toBe(true);
  });

  it('가계부 비트: setBudget·confirmBudget만 받는다', () => {
    const s = apply(student(), { type: 'submitSurvey', answers: defaultAnswers({}) }, { type: 'goto', phase: 'budget' });
    expect(allowed(s, at('budget'), { type: 'setBudget', budget: s.budget }, cfg)).toBe(true);
    expect(allowed(s, at('budget'), { type: 'confirmBudget' }, cfg)).toBe(true);
    expect(allowed(s, at('budget'), { type: 'beginMonth' }, cfg)).not.toBe(true);
    expect(allowed(s, at('budget'), { type: 'goto', phase: 'budget' }, cfg)).not.toBe(true);
  });

  it('월 비트: state.month === N일 때만 받는다', () => {
    const s = atFebPayday(); // month 2, payday
    expect(allowed(s, at('m2'), { type: 'beginMonth' }, cfg)).toBe(true);
    expect(allowed(s, at('m3'), { type: 'beginMonth' }, cfg)).not.toBe(true); // 3월 비트에서 2월 상태
    expect(allowed(s, at('m1'), { type: 'beginMonth' }, cfg)).not.toBe(true);
  });

  it('월 비트: choose는 지불 계획까지 검사한다(canStep 위임)', () => {
    const scene = atFebScene();
    expect(allowed(scene, at('m2'), { type: 'choose', choiceId: 'used' }, cfg)).toBe(true);
    expect(allowed(scene, at('m2'), { type: 'choose', choiceId: 'repair' }, cfg)).not.toBe(true); // 지불 계획 필요
    const pay = getScene({ eventId: 'laptop-spill', sceneId: 'start' }).scene.choices.find((c) => c.id === 'repair')!.pay!;
    const { plan } = autoPaymentPlan(scene, pay);
    expect(allowed(scene, at('m2'), { type: 'choose', choiceId: 'repair', payment: plan }, cfg)).toBe(true);
    // 조정 단계가 아닌 데서 setBudget 금지
    expect(allowed(scene, at('m2'), { type: 'setBudget', budget: scene.budget }, cfg)).not.toBe(true);
  });

  it('월 비트: 결과→continue, endMonth는 학생 금지', () => {
    const outcome = apply(atFebScene(), { type: 'choose', choiceId: 'used' });
    expect(allowed(outcome, at('m2'), { type: 'continue' }, cfg)).toBe(true);
    expect(allowed(outcome, at('m2'), { type: 'endMonth' }, cfg)).not.toBe(true);
  });

  it('운동화 판매(statusAction)는 depositTo가 필요하다', () => {
    const mar = apply(atFebPayday(), { type: 'beginMonth' }, { type: 'choose', choiceId: 'splurge' }, { type: 'continue' }, { type: 'endMonth' });
    const scene = apply(mar, { type: 'beginMonth' });
    const pay = getScene({ eventId: 'sneaker-resell', sceneId: 'start' }).scene.choices.find((c) => c.id === 'flip3')!.pay!;
    const chose = apply(scene, { type: 'choose', choiceId: 'flip3', payment: autoPaymentPlan(scene, pay).plan });
    const report = apply(chose, { type: 'continue' });
    expect(allowed(report, at('m3'), { type: 'statusAction', status: 'sneakers', action: 'sellSneakers', depositTo: 'emergency' }, cfg)).toBe(true);
    expect(allowed(report, at('m3'), { type: 'statusAction', status: 'sneakers', action: 'sellSneakers' }, cfg)).not.toBe(true);
  });

  it('m12 비트: beginMonth만 받는다', () => {
    const nov = runFallback(atFebPayday(), at('m11'));
    expect(nov.month).toBe(11);
    const decPayday = step(nov, { type: 'endMonth' });
    expect(allowed(decPayday, at('m12'), { type: 'beginMonth' }, cfg)).toBe(true);
    expect(allowed(decPayday, at('m12'), { type: 'choose', choiceId: 'x' }, cfg)).not.toBe(true);
    expect(allowed(decPayday, at('m12'), { type: 'statusAction', status: 'sneakers', action: 'sellSneakers', depositTo: 'goal' }, cfg)).not.toBe(true);
  });

  it('표시 비트·입장 비트에서는 아무 것도 못 한다 (reset·goto·endMonth 포함)', () => {
    const s = simStudent();
    for (const id of ['join', 'salary', 'survey-result', 'guide-1', 'guide-6', 'present']) {
      expect(allowed(s, at(id), { type: 'reset' }, cfg)).not.toBe(true);
      expect(allowed(s, at(id), { type: 'goto', phase: 'budget' }, cfg)).not.toBe(true);
      expect(allowed(s, at(id), { type: 'endMonth' }, cfg)).not.toBe(true);
      expect(allowed(s, at(id), { type: 'submitSurvey', answers: {} }, cfg)).not.toBe(true);
    }
  });

  it('거부 이유는 한국어 문구다', () => {
    const s = simStudent();
    const reason = allowed(s, at('present'), { type: 'reset' }, cfg);
    expect(typeof reason).toBe('string');
    expect(reason).toContain('선생님');
  });
});

describe('done (§9.3 표)', () => {
  it('join·salary·survey-result·guide·present는 항상 true', () => {
    const s = student();
    for (const id of ['join', 'salary', 'survey-result', 'guide-1', 'guide-6', 'present']) {
      expect(done(s, at(id), cfg)).toBe(true);
    }
  });

  it('설문: 제출 전 false, 제출 후 true', () => {
    const s = student();
    expect(done(s, at('survey'), cfg)).toBe(false);
    const after = step(s, { type: 'submitSurvey', answers: defaultAnswers({}) });
    expect(done(after, at('survey'), cfg)).toBe(true);
  });

  it('가계부: 확정(sim)이어야 true', () => {
    const s = apply(student(), { type: 'submitSurvey', answers: defaultAnswers({}) });
    expect(done(s, at('budget'), cfg)).toBe(false);
    const b = step(s, { type: 'goto', phase: 'budget' });
    expect(done(b, at('budget'), cfg)).toBe(false);
    expect(done(step(b, { type: 'confirmBudget' }), at('budget'), cfg)).toBe(true);
  });

  it('월 비트: month === N && step === report', () => {
    const payday = atFebPayday();
    expect(done(payday, at('m2'), cfg)).toBe(false);
    const scene = atFebScene();
    expect(done(scene, at('m2'), cfg)).toBe(false);
    const outcome = apply(scene, { type: 'choose', choiceId: 'splurge' });
    expect(done(outcome, at('m2'), cfg)).toBe(false);
    const report = apply(outcome, { type: 'continue' });
    expect(done(report, at('m2'), cfg)).toBe(true);
    expect(done(report, at('m3'), cfg)).toBe(false); // 아직 2월
  });

  it('m12: phase result여야 true', () => {
    const nov = runFallback(atFebPayday(), at('m11'));
    expect(done(nov, at('m12'), cfg)).toBe(false);
    const dec = runFallback(atFebPayday(), at('m12'));
    expect(dec.phase).toBe('result');
    expect(done(dec, at('m12'), cfg)).toBe(true);
  });

  it('모르는 비트 인덱스는 true (마감 판정을 방해하지 않는다)', () => {
    expect(done(student(), 999, cfg)).toBe(true);
  });
});

describe('fallback (§9.3 + 월 비트 규칙 1~5)', () => {
  it('설문: 전 문항 중간 답으로 제출하고 한 걸음에 끝난다', () => {
    const s = student();
    const r = fallback(s, at('survey'), cfg, undefined);
    expect(r.action).toEqual({ type: 'submitSurvey', answers: defaultAnswers({}), auto: true });
    expect(r.notice).toContain('기본 답안');
    expect(done(step(s, r.action), at('survey'), cfg)).toBe(true);
  });

  it('가계부: 합계가 이미 맞으면 confirmBudget 한 걸음 (진전 보장)', () => {
    const s = apply(student(), { type: 'submitSurvey', answers: defaultAnswers({}) }, { type: 'goto', phase: 'budget' });
    const r = fallback(s, at('budget'), cfg, undefined);
    expect(r.action.type).toBe('confirmBudget');
    expect((r.action as { auto?: true }).auto).toBe(true);
    expect(step(s, r.action).phase).toBe('sim');
  });

  it('가계부: 초안이 넘치면 balanceBudget(초안)으로 맞춘 뒤 확정 — 두 걸음, 각각 notice', () => {
    const s = apply(student(), { type: 'submitSurvey', answers: defaultAnswers({}) }, { type: 'goto', phase: 'budget' });
    const over = clone(s.budget);
    over.transfers.emergency += 100_000; // 10만 원 초과
    const edited = step(s, { type: 'setBudget', budget: over });
    const draft = { kind: 'budget' as const, budget: over };
    const r1 = fallback(edited, at('budget'), cfg, draft);
    expect(r1.action.type).toBe('setBudget');
    expect(r1.notice).toContain('여유 부족분');
    expect(r1.notice).toContain('10만 원');
    const s2 = step(edited, r1.action);
    expect(done(s2, at('budget'), cfg)).toBe(false); // 아직 확정 전
    const r2 = fallback(s2, at('budget'), cfg, draft);
    expect(r2.action.type).toBe('confirmBudget');
    expect(step(s2, r2.action).phase).toBe('sim');
  });

  it('가계부: 초안이 없으면 state.budget(마지막 편집)으로 맞춘다', () => {
    const s = apply(student(), { type: 'submitSurvey', answers: defaultAnswers({}) }, { type: 'goto', phase: 'budget' });
    const under = clone(s.budget);
    under.expenses.leisure = Math.max(0, under.expenses.leisure - 80_000); // 8만 원 남는 돈
    const edited = step(s, { type: 'setBudget', budget: under });
    const r = fallback(edited, at('budget'), cfg, undefined);
    expect(r.action.type).toBe('setBudget');
    expect(r.notice).toContain('남는 돈');
    expect(r.notice).toContain('8만 원');
    const s2 = step(edited, r.action);
    expect(done(s2, at('budget'), cfg)).toBe(false);
    expect(fallback(s2, at('budget'), cfg, undefined).action.type).toBe('confirmBudget');
  });

  it('월급날: beginMonth', () => {
    const r = fallback(atFebPayday(), at('m2'), cfg, undefined);
    expect(r.action).toEqual({ type: 'beginMonth' });
    expect(r.notice).toContain('2월');
  });

  it('장면: 기본 선택지를 고른다 — fixedPay는 payment 없이 (§9.3 규칙 3)', () => {
    const sc = atFebScene();
    const r = fallback(sc, at('m2'), cfg, undefined);
    const a = r.action as Extract<Action, { type: 'choose' }>;
    expect(a.type).toBe('choose');
    expect(a.choiceId).toBe('splurge');
    expect(a.payment).toBeUndefined();
    expect(a.auto).toBe(true);
    expect(r.notice).toBe("시간 안에 고르지 못해 '이참에 최고 사양 노트북을 12개월 할부로 산다'이(가) 자동으로 선택됐어요");
    expect(step(sc, r.action).step).toBe('outcome');
  });

  it('장면: pay 선택지는 자동 지불 계획이, deposit 선택지는 입금 계좌가 실린다', () => {
    // seller 장면의 기본 선택지 transfer는 pay
    const seller = apply(atFebScene(), { type: 'choose', choiceId: 'used' }, { type: 'continue' });
    const r2 = fallback(seller, at('m2'), cfg, undefined);
    const a2 = r2.action as Extract<Action, { type: 'choose' }>;
    expect(a2.choiceId).toBe('transfer');
    expect(a2.payment!.parts.length).toBeGreaterThan(0);
    expect(step(seller, r2.action).step).toBe('outcome');

    // 8월 drop 장면의 기본 선택지 sellAll은 deposit — 첫 입금 계좌
    const payday = step(runFallback(atFebPayday(), at('m7')), { type: 'endMonth' });
    const augScene = step(payday, { type: 'beginMonth' });
    if (augScene.step === 'scene' && augScene.current?.sceneId === 'drop') {
      const r3 = fallback(augScene, at('m8'), cfg, undefined);
      const a3 = r3.action as Extract<Action, { type: 'choose' }>;
      expect(a3.choiceId).toBe('sellAll');
      expect(a3.depositTo).toBe('living');
    }
  });

  it('결과: continue', () => {
    const outcome = apply(atFebScene(), { type: 'choose', choiceId: 'used' });
    const r = fallback(outcome, at('m2'), cfg, undefined);
    expect(r.action).toEqual({ type: 'continue' });
    expect(r.notice).toContain('자동으로 넘어');
  });

  it('조정: balanceBudget(초안 ?? state.budget) 한 걸음으로 조정 단계가 저절로 끝난다', () => {
    // 6월 월세 인상 'ignore' 선택 → 조정 단계 (운동화 경로를 피해 수동으로 진행)
    let s = atFebPayday();
    s = apply(s, { type: 'beginMonth' }, { type: 'choose', choiceId: 'splurge' }, { type: 'continue' }); // 2월 리포트
    s = apply(s, { type: 'endMonth' }); // 3월
    s = apply(s, { type: 'beginMonth' }, { type: 'choose', choiceId: 'pass' }, { type: 'continue' }); // 3월 리포트
    s = apply(s, { type: 'endMonth' }); // 4월(조용한 달)
    s = apply(s, { type: 'beginMonth' }); // 장면 없음 → 리포트
    s = apply(s, { type: 'endMonth' }); // 5월
    const letterPay = getScene({ eventId: 'family-month', sceneId: 'gift' }).scene.choices.find((c) => c.id === 'letter')!.pay!;
    s = apply(s, { type: 'beginMonth' }, { type: 'choose', choiceId: 'letter', payment: autoPaymentPlan(s, letterPay).plan }, { type: 'continue' }); // gift → message
    s = apply(s, { type: 'choose', choiceId: 'ignore' }, { type: 'continue' }); // message → 5월 리포트
    s = apply(s, { type: 'endMonth' }); // 6월
    s = apply(s, { type: 'beginMonth' }); // notice 장면
    s = apply(s, { type: 'choose', choiceId: 'ignore' }); // 가계부 조정으로
    s = apply(s, { type: 'continue' });
    expect(s.step).toBe('adjust');
    const draft = { kind: 'budget' as const, budget: clone(s.budget) };
    const r = fallback(s, at('m6'), cfg, draft);
    expect(r.action.type).toBe('setBudget');
    const after = step(s, r.action);
    expect(after.step).toBe('report'); // setBudget만으로 조정 완료 — continue를 보내지 않는다
    expect(done(after, at('m6'), cfg)).toBe(true);
  });

  it('재현 규칙: month < N이면 endMonth를 반복한다 (규칙 1)', () => {
    const s = apply(atFebScene(), { type: 'choose', choiceId: 'splurge' }, { type: 'continue' }); // 2월 리포트
    const r = fallback(s, at('m5'), cfg, undefined);
    expect(r.action).toEqual({ type: 'endMonth' });
    expect(r.notice).toContain('2월');
    const s2 = step(s, r.action);
    expect(s2.month).toBe(3);
    expect(done(s2, at('m5'), cfg)).toBe(false);
  });

  it('m12: month < 12 report → endMonth, month 12 payday → beginMonth(결산)', () => {
    const feb = apply(atFebScene(), { type: 'choose', choiceId: 'splurge' }, { type: 'continue' });
    const r = fallback(feb, at('m12'), cfg, undefined);
    expect(r.action).toEqual({ type: 'endMonth' });
    const nov = runFallback(feb, at('m11'));
    const decPayday = step(nov, { type: 'endMonth' });
    expect(decPayday.month).toBe(12);
    const r2 = fallback(decPayday, at('m12'), cfg, undefined);
    expect(r2.action).toEqual({ type: 'beginMonth' });
    const dec = step(decPayday, r2.action);
    expect(dec.phase).toBe('result');
    expect(done(dec, at('m12'), cfg)).toBe(true);
  });

  it('표시 비트·모르는 비트에서도 예외 없이 걸음을 만든다 (방어 경로)', () => {
    const s = student();
    for (const b of [at('join'), at('salary'), at('survey-result'), at('guide-3'), at('present'), 999]) {
      expect(() => fallback(s, b, cfg, undefined)).not.toThrow();
    }
    // phase 'start'(도달 불가 — init 행동이 곧바로 적용된다)에서도 함수 자체는 예외 없다
    const base = initState({ nickname: 'x', random: () => 0.5 }, cfg).state;
    expect(() => fallback(base, at('salary'), cfg, undefined)).not.toThrow();
  });

  it('fallback을 반복하면 어떤 상태에서든 done에 도달한다 (진전 보장)', () => {
    const s = runFallback(atFebPayday(), at('m12'));
    expect(s.phase).toBe('result');
    expect(s.settlement).not.toBeNull();
  });
});

describe('transition (§9.3 표)', () => {
  it('guide-6 → budget: 안내 단계 학생에게 goto', () => {
    const guide = apply(student(), { type: 'submitSurvey', answers: defaultAnswers({}) });
    expect(transition(guide, at('guide-6'), at('budget'), cfg)).toEqual([{ type: 'goto', phase: 'budget' }]);
    const budget = step(guide, { type: 'goto', phase: 'budget' });
    expect(transition(budget, at('guide-6'), at('budget'), cfg)).toEqual([]);
    expect(transition(simStudent(), at('guide-6'), at('budget'), cfg)).toEqual([]);
  });

  it('cfg.guide=false면 survey-result → budget로 goto (§14)', () => {
    const cfg2: GagyebuConfig = { ...cfg, guide: false };
    const list2 = beats(cfg2);
    const i = (id: string) => list2.findIndex((b) => b.id === id);
    const guide = apply(student(), { type: 'submitSurvey', answers: defaultAnswers({}) });
    expect(transition(guide, i('survey-result'), i('budget'), cfg2)).toEqual([{ type: 'goto', phase: 'budget' }]);
  });

  it('m(N) → m(N+1): 리포트면 endMonth, 아니면 [] (방어)', () => {
    const report = apply(atFebScene(), { type: 'choose', choiceId: 'splurge' }, { type: 'continue' });
    expect(transition(report, at('m2'), at('m3'), cfg)).toEqual([{ type: 'endMonth' }]);
    expect(transition(atFebPayday(), at('m2'), at('m3'), cfg)).toEqual([]);
    expect(transition(atFebScene(), at('m2'), at('m3'), cfg)).toEqual([]);
  });

  it('m11 → m12도 endMonth, m12 → present는 []', () => {
    const nov = runFallback(atFebPayday(), at('m11'));
    expect(transition(nov, at('m11'), at('m12'), cfg)).toEqual([{ type: 'endMonth' }]);
    const dec = runFallback(atFebPayday(), at('m12'));
    expect(transition(dec, at('m12'), at('present'), cfg)).toEqual([]);
  });

  it('가계부 → m1, 설문 → 설문 결과, 안내 사이는 []', () => {
    expect(transition(simStudent(), at('budget'), at('m1'), cfg)).toEqual([]);
    const guide = apply(student(), { type: 'submitSurvey', answers: defaultAnswers({}) });
    expect(transition(guide, at('survey'), at('survey-result'), cfg)).toEqual([]);
    expect(transition(guide, at('guide-1'), at('guide-2'), cfg)).toEqual([]);
  });

  it('한 비트씩이 아닌 이동(방어)이면 []', () => {
    expect(transition(simStudent(), at('m1'), at('m3'), cfg)).toEqual([]);
  });
});

describe('previewFallback (§9.4 정의)', () => {
  it('장면 단계에서는 기본 선택지 라벨', () => {
    expect(previewFallback(atFebScene(), at('m2'), cfg)).toBe('이참에 최고 사양 노트북을 12개월 할부로 산다');
  });

  it('장면 밖 단계(월급날·결과·조정·리포트·설문·가계부)는 null', () => {
    expect(previewFallback(atFebPayday(), at('m2'), cfg)).toBeNull();
    expect(previewFallback(apply(atFebScene(), { type: 'choose', choiceId: 'used' }), at('m2'), cfg)).toBeNull();
    expect(previewFallback(student(), at('survey'), cfg)).toBeNull();
    expect(previewFallback(runFallback(atFebPayday(), at('m12')), at('m12'), cfg)).toBeNull();
  });
});

describe('locate (§4.2)', () => {
  it('장면: "N월 · 장면 이름"', () => {
    expect(locate(atFebScene())).toBe('2월 · 노트북에 커피를 쏟음'); // start 장면은 title·speaker가 없어 event title
    const seller = apply(atFebScene(), { type: 'choose', choiceId: 'used' }, { type: 'continue' });
    expect(locate(seller)).toBe('2월 · 중고거래 판매자');
  });

  it('시뮬레이션 단계별 문구', () => {
    expect(locate(atFebPayday())).toBe('2월 · 월급날');
    expect(locate(apply(atFebScene(), { type: 'choose', choiceId: 'used' }))).toBe('2월 · 결과 확인');
    expect(locate(apply(atFebScene(), { type: 'choose', choiceId: 'splurge' }, { type: 'continue' }))).toBe('2월 · 월말 리포트');
  });

  it('비시뮬레이션 단계별 문구', () => {
    expect(locate(student())).toBe('소비습관 설문');
    expect(locate(apply(student(), { type: 'submitSurvey', answers: defaultAnswers({}) }))).toBe('안내 카드');
    expect(locate(apply(student(), { type: 'submitSurvey', answers: defaultAnswers({}) }, { type: 'goto', phase: 'budget' }))).toBe('가계부 작성');
    expect(locate(runFallback(atFebPayday(), at('m12')))).toBe('1년 결산 완료');
  });
});
