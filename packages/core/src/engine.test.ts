// step 엔진 단위 테스트: 상태 전이, 월급날 처리, 부채·상태·적금, 결산, StepError 코드.
import { describe, expect, it } from 'vitest';
import { autoPaymentPlan, canStep, createInitialState, defaultAnswers, step, StepError } from './engine.ts';
import { getScene, livingSpare, monthEndDue, totalDebt } from './selectors.ts';
import { cloneBudget, deepFreeze, fallbackStep } from './testUtils.ts';
import type { Action, Budget, GameState, QuestionId } from './types.ts';

/** 균형형(점수 4)이 나오는 명시적 답안 — 추천 가계부 수치를 손으로 계산해 두었다 */
const BALANCED_ANSWERS: Partial<Record<QuestionId, string>> = {
  meal: '5to10',
  cafe: '3to7',
  delivery: '3to4',
  phonePlan: 'normal',
  subscriptions: '2to3',
  weekend: '5to15',
  impulse: 'think',
};

/** 추천 가계부(균형형 답안)로 시뮬레이션 시작 상태를 만든다 */
function start(budget?: Budget): GameState {
  let s = createInitialState('테스터');
  s = step(s, { type: 'start', nickname: '테스터' });
  s = step(s, { type: 'submitSurvey', answers: BALANCED_ANSWERS });
  s = step(s, { type: 'goto', phase: 'budget' });
  if (budget) s = step(s, { type: 'setBudget', budget });
  s = step(s, { type: 'confirmBudget' });
  return s;
}

/** 1월(튜토리얼)을 지나 2월 장면 단계까지 간다 */
function toFeb(s: GameState): GameState {
  s = step(s, { type: 'beginMonth' });
  s = step(s, { type: 'choose', choiceId: 'ok' });
  s = step(s, { type: 'continue' });
  s = step(s, { type: 'endMonth' });
  return step(s, { type: 'beginMonth' });
}

/** 기본값 함수만으로 결산까지 진행한다 */
function runFallbackYear(s: GameState): GameState {
  let guard = 0;
  while (s.phase !== 'result') {
    s = fallbackStep(s);
    guard += 1;
    expect(guard).toBeLessThan(400);
  }
  return s;
}

/** 기본값 함수만으로 targetMonth의 장면 단계까지 진행한다 */
function runFallbackUntilScene(s: GameState, sceneId: string): GameState {
  let guard = 0;
  while (!(s.phase === 'sim' && s.step === 'scene' && s.current?.sceneId === sceneId)) {
    expect(s.phase, `장면 ${sceneId}에 도달하지 못함`).toBe('sim');
    s = fallbackStep(s);
    guard += 1;
    expect(guard).toBeLessThan(400);
  }
  return s;
}

describe('상태 전이 (phase)', () => {
  it('start → survey → guide → budget → sim 순서로만 간다', () => {
    let s = createInitialState('');
    expect(() => step(s, { type: 'submitSurvey', answers: {} })).toThrow(StepError);
    s = step(s, { type: 'start', nickname: '하늘' });
    expect(s.phase).toBe('survey');
    expect(s.profile).toEqual({ nickname: '하늘', salary: 2_650_000 }); // 월급은 모두 같다
    expect(() => step(s, { type: 'goto', phase: 'budget' })).toThrow(StepError); // survey에서 goto 불가
    expect(() => step(s, { type: 'start', nickname: '둘' })).toThrow(StepError); // 이미 start 아님
    s = step(s, { type: 'submitSurvey', answers: defaultAnswers({}) });
    expect(s.phase).toBe('guide');
    expect(s.survey.result?.type).toBe('planner'); // 중간 답 7문항의 점수는 1 → 계획형
    expect(s.budget).toEqual(s.survey.result?.recommended); // 추천 가계부가 기본값
    s = step(s, { type: 'goto', phase: 'budget' });
    expect(s.phase).toBe('budget');
    s = step(s, { type: 'confirmBudget' });
    expect(s.phase).toBe('sim');
    expect(s.month).toBe(1);
    expect(s.step).toBe('payday');
    expect(s.initialBudget).toEqual(s.budget);
  });

  it('start 인자 검증: 닉네임 1~10자', () => {
    const s = createInitialState('');
    const bad: Action[] = [
      { type: 'start', nickname: '' },
      { type: 'start', nickname: '열글자를넘는닉네임입니다' },
    ];
    for (const action of bad) {
      expect(canStep(s, action)).not.toBe(true);
      try {
        step(s, action);
        expect.unreachable();
      } catch (e) {
        expect((e as StepError).code).toBe('invalid-phase');
      }
    }
  });

  it('작성 단계에서는 합계가 안 맞는 가계부도 저장되고, 확정은 합계 일치만', () => {
    let s = createInitialState('테스터');
    s = step(s, { type: 'start', nickname: '테스터' });
    s = step(s, { type: 'submitSurvey', answers: defaultAnswers({}) });
    s = step(s, { type: 'goto', phase: 'budget' });
    const over = cloneBudget(s.budget);
    over.transfers.savings += 100_000; // 10만 원 초과
    s = step(s, { type: 'setBudget', budget: over });
    expect(s.budget.transfers.savings).toBe(over.transfers.savings);
    expect(() => step(s, { type: 'confirmBudget' })).toThrowError(StepError);
    try {
      step(s, { type: 'confirmBudget' });
      expect.unreachable();
    } catch (e) {
      expect((e as StepError).code).toBe('budget-invalid');
    }
    s = step(s, { type: 'setBudget', budget: cloneBudget(s.survey.result!.recommended) });
    s = step(s, { type: 'confirmBudget' });
    expect(s.phase).toBe('sim');
  });

  it('reset은 어느 phase에서든 새 초기 상태로', () => {
    const s = start();
    const r = step(s, { type: 'reset' });
    expect(r.phase).toBe('start');
    expect(r.profile.nickname).toBe('');
    expect(r.history).toHaveLength(0);
  });

  it('결과 화면 뒤의 행동은 already-finished (reset 제외)', () => {
    const done = runFallbackYear(start());
    expect(done.phase).toBe('result');
    const bad: Action[] = [
      { type: 'beginMonth' },
      { type: 'continue' },
      { type: 'endMonth' },
      { type: 'choose', choiceId: 'ok' },
      { type: 'setBudget', budget: done.budget },
    ];
    for (const action of bad) {
      expect(canStep(done, action)).not.toBe(true);
      try {
        step(done, action);
        expect.unreachable();
      } catch (e) {
        expect((e as StepError).code).toBe('already-finished');
      }
    }
    expect(step(done, { type: 'reset' }).phase).toBe('start');
  });
});

describe('월급날 처리', () => {
  it('월급날: 월급 → 자동이체 → 이자. 생활비는 통장에 남았다가 월말에 지출된다 (1월, 추천 가계부)', () => {
    // 균형형 추천 (월급 265만): 이체 98만(비상금 27·적금 40·투자 13·목표 8·청약 10), 지출 161만, 남는 돈 6만
    let s = start();
    s = step(s, { type: 'beginMonth' });
    expect(s.step).toBe('scene'); // 1월 튜토리얼 장면
    const p = s.payday!;
    expect(p.month).toBe(1);
    expect(p.salary).toBe(2_650_000);
    expect(p.transfers).toEqual({ emergency: 270_000, savings: 400_000, invest: 130_000, goal: 80_000, housing: 100_000 });
    expect(p.livingIn).toBe(1_670_000);
    expect(p.spending).toBe(1_610_000); // 월말에 나갈 예정액
    expect(p.debtPayments).toBe(0);
    expect(p.investReturnPct).toBe(0);
    expect(p.livingShortfall).toBe(0);
    expect(p.closed).toBe(false);
    // 달 중간: 이번 달 생활비 전체가 생활비 통장에 있다
    expect(s.accounts.living.balance).toBe(1_670_000);
    expect(monthEndDue(s)).toEqual({ spending: 1_610_000, debtPayments: 0, total: 1_610_000 });
    expect(livingSpare(s)).toBe(60_000);
    expect(s.accounts.emergency.balance).toBe(270_000 + Math.round((270_000 * 0.02) / 12));
    expect(s.accounts.savings.balance).toBe(400_000);
    expect(s.accounts.savings.contributed).toBe(400_000);
    expect(s.accounts.invest.balance).toBe(130_000);
    expect(s.savings.paidMonths).toBe(1);
    // 월말(리포트로 넘어갈 때): 지출 예산이 나가고 남는 돈만 남는다
    s = step(s, { type: 'choose', choiceId: 'ok' });
    s = step(s, { type: 'continue' });
    expect(s.step).toBe('report');
    expect(s.payday!.closed).toBe(true);
    expect(s.accounts.living.balance).toBe(60_000);
    expect(monthEndDue(s).total).toBe(0);
    // 남는 돈은 다음 달로 넘어간다
    s = step(s, { type: 'endMonth' });
    s = step(s, { type: 'beginMonth' });
    expect(s.accounts.living.balance).toBe(60_000 + 1_670_000);
  });

  it('월말 생활비가 모자라면 잔고 0, 만족도 -5, 부족분은 카드값(다음 달 월말 결제)이 된다', () => {
    // 남는 돈 6만을 여가로 옮겨 남는 돈 0 + splurge 상환으로 부족을 만든다
    const b = cloneBudget(start().budget);
    b.expenses.leisure += 60_000;
    let s = toFeb(start(b)); // 2월 장면
    s = step(s, { type: 'choose', choiceId: 'splurge' });
    s = step(s, { type: 'continue' });
    s = step(s, { type: 'endMonth' });
    s = step(s, { type: 'beginMonth' }); // 3월: 첫 상환은 월말
    expect(s.payday!.debtPayments).toBe(268_333); // 예정액
    expect(s.accounts.living.balance).toBe(1_670_000);
    expect(s.flags.livingShort).toBe(false); // 2월 월말은 모자라지 않았다
    s = step(s, { type: 'choose', choiceId: 'pass' });
    s = step(s, { type: 'continue' }); // → report (월말 마감)
    expect(s.accounts.living.balance).toBe(0);
    expect(s.payday!.livingShortfall).toBe(268_333);
    expect(s.flags.livingShort).toBe(true);
    expect(s.flags.livingShortfall).toBe(268_333);
    expect(s.satisfaction).toBe(58); // 60 + 3(splurge) - 5(부족)
    const bill = s.debts.find((d) => d.id === 'shortfall-3')!;
    expect(bill).toMatchObject({ kind: 'cardBill', remaining: 268_333, monthly: 268_333, monthsLeft: 1, annualRate: 0, startedMonth: 3 });
    // 4월 월말: 할부 + 3월 부족분 카드값을 함께 낸다 — 남는 돈이 없으면 부족분이 다시 카드값이 된다
    s = step(s, { type: 'endMonth' });
    s = step(s, { type: 'beginMonth' }); // 4월(조용한 달) → 바로 월말 마감
    expect(s.step).toBe('report');
    expect(s.payday!.debtPayments).toBe(268_333 + 268_333);
    expect(s.payday!.livingShortfall).toBe(268_333 + 268_333);
    expect(s.debts.some((d) => d.id === 'shortfall-3')).toBe(false);
    expect(s.debts.find((d) => d.id === 'shortfall-4')!.remaining).toBe(536_666);
  });

  it('생활비 통장에서 꺼내 쓴 만큼 월말에 모자라면 카드값이 된다', () => {
    let s = toFeb(start()); // 2월: 생활비 통장 = 6만(1월 남는 돈) + 167만
    expect(livingSpare(s)).toBe(120_000);
    s = step(s, { type: 'choose', choiceId: 'repair', payment: { parts: [{ source: 'living', amount: 600_000 }] } });
    s = step(s, { type: 'continue' });
    expect(s.step).toBe('report');
    expect(s.payday!.livingShortfall).toBe(480_000);
    expect(s.debts.find((d) => d.id === 'shortfall-2')!.remaining).toBe(480_000);
  });

  it('장면 없는 달은 report로, endMonth로 다음 달로', () => {
    let s = start();
    s = step(s, { type: 'beginMonth' }); // 1월 장면
    s = step(s, { type: 'choose', choiceId: 'ok' });
    s = step(s, { type: 'continue' });
    expect(s.step).toBe('report');
    s = step(s, { type: 'endMonth' });
    expect(s.month).toBe(2);
    expect(s.step).toBe('payday');
    expect(s.payday).toBeNull();
    expect(s.history).toHaveLength(1);
    expect(s.history[0]!.month).toBe(1);
    expect(s.history[0]!.eventIds).toEqual(['tutorial']);
  });
});

describe('부채 (할부·카드값·리볼빙)', () => {
  it('fixedPay 카드 할부: 수수료 포함 웬 상환액, 다음 달부터 갚는다', () => {
    let s = toFeb(start()); // 2월 장면
    s = step(s, { type: 'choose', choiceId: 'splurge' });
    expect(s.debts).toHaveLength(1);
    const d = s.debts[0]!;
    expect(d.kind).toBe('installment');
    expect(d.principal).toBe(2_800_000);
    expect(d.monthly).toBe(268_333); // 280만 × 1.15 / 12
    expect(d.annualRate).toBe(0.15);
    expect(d.startedMonth).toBe(2);
    expect(d.label).toContain('12개월 할부');
    expect(s.statuses.some((x) => x.id === 'laptopInstallment')).toBe(true);
    expect(s.decisions.find((d) => d.choiceId === 'splurge')!.payment).toEqual({
      parts: [],
      card: { amount: 2_800_000, months: 12 },
    });
    s = step(s, { type: 'continue' });
    s = step(s, { type: 'endMonth' });
    s = step(s, { type: 'beginMonth' }); // 3월: 상환은 월말
    expect(s.debts[0]!.remaining).toBe(2_800_000);
    s = step(s, { type: 'choose', choiceId: 'pass' });
    s = step(s, { type: 'continue' }); // 3월 월말 첫 상환 (이자 35,000원 포함)
    expect(s.debts[0]!.remaining).toBe(2_800_000 + 35_000 - 268_333);
    expect(s.debts[0]!.monthsLeft).toBe(11);
  });

  it('pay로 카드로 낸 몫의 부채 이름은 "카드 일시불/N개월 할부 — 선택지"다 (1개월)', () => {
    let s = toFeb(start()); // 2월 장면 (laptop-spill)
    s = step(s, { type: 'choose', choiceId: 'repair', payment: { parts: [], card: { amount: 600_000, months: 1 } } });
    expect(s.debts).toHaveLength(1);
    expect(s.debts[0]!.label).toBe('카드 일시불 — 서비스센터에서 수리한다');
    const delta = s.lastOutcome!.deltas.find((d) => d.kind === 'debt');
    expect(delta).toMatchObject({ kind: 'debt', amount: 600_000, label: '카드 일시불 — 서비스센터에서 수리한다' });
  });

  it('pay로 카드로 낸 몫의 부채 이름은 "카드 일시불/N개월 할부 — 선택지"다 (3개월 할부)', () => {
    let s = toFeb(start()); // 2월 장면 (laptop-spill)
    s = step(s, {
      type: 'choose',
      choiceId: 'repair',
      payment: { parts: [{ source: 'emergency', amount: 300_000 }], card: { amount: 300_000, months: 3 } },
    });
    expect(s.debts).toHaveLength(1);
    expect(s.debts[0]!.label).toBe('카드 3개월 할부 — 서비스센터에서 수리한다');
    expect(s.debts[0]!.kind).toBe('installment');
    const delta = s.lastOutcome!.deltas.find((d) => d.kind === 'debt');
    expect(delta).toMatchObject({ kind: 'debt', amount: 300_000, label: '카드 3개월 할부 — 서비스센터에서 수리한다' });
  });

  it('카드 일시불은 다음 달에 전액 결제되고 할부로 치지 않는다', () => {
    let s = toFeb(start()); // 2월 장면
    s = step(s, { type: 'choose', choiceId: 'used' });
    s = step(s, { type: 'continue' });
    s = step(s, { type: 'choose', choiceId: 'transfer', payment: { parts: [{ source: 'emergency', amount: 330_000 }] } });
    s = step(s, { type: 'continue' }); // → scammed
    s = step(s, { type: 'choose', choiceId: 'repair', payment: { parts: [], card: { amount: 600_000, months: 1 } } });
    expect(s.debts[0]!.kind).toBe('cardBill');
    expect(s.debts[0]!.annualRate).toBe(0);
    s = step(s, { type: 'continue' });
    s = step(s, { type: 'endMonth' });
    s = step(s, { type: 'beginMonth' }); // 3월: 월말에 전액 결제
    expect(s.payday!.debtPayments).toBe(600_000); // 예정액
    expect(s.debts).toHaveLength(1);
    s = step(s, { type: 'choose', choiceId: 'pass' });
    s = step(s, { type: 'continue' });
    expect(s.debts.some((d) => d.sourceEventId === 'laptop-spill')).toBe(false); // 카드값은 다 냈다
    expect(s.payday!.debtPayments).toBe(600_000);
    // 남는 돈(1·2월 12만)보다 큰 카드값이라 3월 생활비가 42만 원 모자라 다시 카드값이 된다
    expect(s.payday!.livingShortfall).toBe(420_000); // 179만 − 161만 − 60만
    expect(s.debts.map((d) => d.id)).toEqual(['shortfall-3']);
    expect(s.flags.usedInstallment).toBeUndefined(); // 일시불은 '할부 없는 1년'을 깨지 않는다
  });

  it('pay로 적금에서 내면 적금이 해지되고, 이후 이체는 새 적금 원금으로', () => {
    let s = toFeb(start()); // 2월 장면
    s = step(s, { type: 'choose', choiceId: 'repair', payment: { parts: [{ source: 'savings', amount: 600_000 }] } });
    expect(s.savings.broken).toBe(true);
    expect(s.savings.brokenMonth).toBe(2);
    expect(s.accounts.savings.balance).toBe(800_000 - 600_000);
    s = step(s, { type: 'continue' });
    s = step(s, { type: 'endMonth' });
    s = step(s, { type: 'beginMonth' }); // 3월
    expect(s.savings.paidMonths).toBe(2); // 해지 전 납입 횟수 그대로
    expect(s.savings.restartedPrincipal).toBe(400_000);
    expect(runFallbackYear(s).unlocked).not.toContain('savingsComplete');
  });

  it('리볼빙: 매달 10% 상환, 연 18% 이자, 신용 -40', () => {
    // 남는 돈 0 가계부 + splurge로 매달 생활비 부족 → 10월 리볼빙 장면
    const b = cloneBudget(start().budget);
    b.expenses.leisure += 60_000;
    const s = runFallbackYear(start(b));
    expect(s.decisions.some((d) => d.choiceId === 'revolve')).toBe(true);
    const revolving = s.debts.find((d) => d.kind === 'revolving');
    expect(revolving).toBeDefined();
    expect(revolving!.annualRate).toBe(0.18);
    expect(revolving!.monthly).toBe(Math.round(revolving!.principal * 0.1));
    expect(s.credit).toBe(810); // 850 - 40
    expect(s.statuses.some((x) => x.id === 'revolving')).toBe(true);
    // 리볼빙으로 돌린 9월 부족분 카드값은 리볼빙 부채로 바뀐다 (이중 부채 없음)
    expect(s.debts.some((d) => d.id === 'shortfall-9')).toBe(false);
  });
  it('리볼빙 대신 다른 계좌로 전액 결제하면 9월 부족분 카드값이 끝난다', () => {
    const b = cloneBudget(start().budget);
    b.expenses.leisure += 60_000;
    let s = runFallbackUntilScene(start(b), 'revolving'); // 10월
    const bill = s.debts.find((d) => d.id === 'shortfall-9')!;
    expect(bill.remaining).toBe(s.flags.livingShortfall);
    const payFull = getScene(s.current!).scene.choices.find((c) => c.id === 'payFull')!;
    const { plan, shortfall } = autoPaymentPlan(s, payFull.pay!);
    expect(shortfall).toBe(0);
    s = step(s, { type: 'choose', choiceId: 'payFull', payment: plan });
    expect(s.debts.some((d) => d.id === 'shortfall-9')).toBe(false);
    expect(s.debts.some((d) => d.kind === 'revolving')).toBe(false);
  });

  it('자동 지불 계획은 생활비 통장에서 월말에 나갈 돈을 뺀 만큼만 쓴다', () => {
    let s = start();
    s = step(s, { type: 'beginMonth' }); // 1월: 생활비 167만 중 161만은 월말 지출
    const { plan } = autoPaymentPlan(s, { amount: 100_000, sources: ['living', 'emergency'] });
    expect(plan.parts).toEqual([
      { source: 'living', amount: 60_000 },
      { source: 'emergency', amount: 40_000 },
    ]);
  });
});

describe('상태 (지속 효과)', () => {
  it('noLaptop: 이번 달 제외, 다음 달부터 매달 만족도 -3', () => {
    let s = toFeb(start()); // 2월 장면
    s = step(s, { type: 'choose', choiceId: 'wait' });
    expect(s.statuses.some((x) => x.id === 'noLaptop')).toBe(true);
    expect(s.satisfaction).toBe(60); // 선택 자체는 만족도 변화 없음
    s = step(s, { type: 'continue' });
    s = step(s, { type: 'endMonth' });
    s = step(s, { type: 'beginMonth' }); // 3월
    expect(s.payday!.statusEffects).toEqual([{ status: 'noLaptop', satisfaction: -3 }]);
    expect(s.satisfaction).toBe(57);
  });

  it('statusAction: 장면 밖에서 운동화를 팔면 시세가 입금되고 기록에 빈 이벤트가 남는다', () => {
    let s = start();
    s = step(s, { type: 'beginMonth' }); // 1월
    s = step(s, { type: 'choose', choiceId: 'ok' });
    s = step(s, { type: 'continue' });
    s = step(s, { type: 'endMonth' });
    s = step(s, { type: 'beginMonth' }); // 2월: 중고 안전결제
    s = step(s, { type: 'choose', choiceId: 'used' });
    s = step(s, { type: 'continue' });
    s = step(s, { type: 'choose', choiceId: 'safe', payment: { parts: [{ source: 'emergency', amount: 350_000 }] } });
    s = step(s, { type: 'continue' });
    s = step(s, { type: 'endMonth' });
    s = step(s, { type: 'beginMonth' }); // 3월: 운동화 1켤레
    s = step(s, { type: 'choose', choiceId: 'flip1', payment: { parts: [{ source: 'emergency', amount: 300_000 }] } });
    s = step(s, { type: 'continue' });
    s = step(s, { type: 'endMonth' });
    const st = s.statuses.find((x) => x.id === 'sneakers');
    expect(st?.count).toBe(1);
    expect(st?.note).toBeUndefined(); // 시세 문구는 상태가 생긴 뒤 첫 월급날에 갱신된다
    // 4월 월급날(장면 없음)에서 판매: 4월 시세 42만 × 0.9
    const goalBefore = s.accounts.goal.balance;
    s = step(s, { type: 'statusAction', status: 'sneakers', action: 'sellSneakers', depositTo: 'goal' });
    expect(s.accounts.goal.balance).toBe(goalBefore + 378_000);
    expect(s.statuses.some((x) => x.id === 'sneakers')).toBe(false);
    const rec = s.decisions.at(-1)!;
    expect(rec.eventId).toBe('');
    expect(rec.eventCode).toBe('');
    expect(rec.sceneId).toBe('status:sneakers');
    expect(rec.payment?.parts[0]).toEqual({ source: 'goal', amount: 378_000 });
    expect(s.unlocked).toContain('resellEscape'); // 산 값 30만보다 비싸게 팜
    // 보유하지 않은 상태/행동은 StepError
    expect(() => step(s, { type: 'statusAction', status: 'sneakers', action: 'sellSneakers' })).toThrow(StepError);
    expect(() => step(s, { type: 'statusAction', status: 'noLaptop', action: 'sellSneakers' })).toThrow(StepError);
  });
});

describe('장면 그래프 (연쇄·예약·조건)', () => {
  it('continue는 lastOutcome.next 장면으로, 끝나면 queue로, 없으면 report로', () => {
    let s = toFeb(start()); // 2월 장면
    s = step(s, { type: 'choose', choiceId: 'used' });
    s = step(s, { type: 'continue' });
    expect(s.current?.sceneId).toBe('seller');
    expect(s.step).toBe('scene');
    s = step(s, { type: 'choose', choiceId: 'safe', payment: { parts: [{ source: 'emergency', amount: 350_000 }] } });
    s = step(s, { type: 'continue' });
    expect(s.step).toBe('report'); // 연쇄·queue 없음
  });

  it('예약 장면이 조용한 달에 나타난다 (3월 flip1 → 4월 check4)', () => {
    let s = start();
    s = step(s, { type: 'beginMonth' }); // 1월
    s = step(s, { type: 'choose', choiceId: 'ok' });
    s = step(s, { type: 'continue' });
    s = step(s, { type: 'endMonth' });
    s = step(s, { type: 'beginMonth' }); // 2월: 수리
    const e2 = s.accounts.emergency.balance;
    s = step(s, { type: 'choose', choiceId: 'repair', payment: { parts: [{ source: 'emergency', amount: e2 }, { source: 'goal', amount: 600_000 - e2 }] } });
    s = step(s, { type: 'continue' });
    s = step(s, { type: 'endMonth' });
    s = step(s, { type: 'beginMonth' }); // 3월
    s = step(s, { type: 'choose', choiceId: 'flip1', payment: { parts: [], card: { amount: 300_000, months: 1 } } });
    expect(s.scheduled).toHaveLength(1);
    expect(s.scheduled[0]!.month).toBe(4);
    expect(s.lastOutcome!.scheduled).not.toBeNull();
    expect(s.lastOutcome!.lesson).toBeNull(); // 이벤트가 이어지므로 교훈 아직
    s = step(s, { type: 'continue' });
    s = step(s, { type: 'endMonth' });
    s = step(s, { type: 'beginMonth' }); // 4월: 예약 장면만
    expect(s.current?.sceneId).toBe('check4');
    expect(s.queue).toHaveLength(0);
    s = step(s, { type: 'choose', choiceId: 'wearNow' });
    expect(s.lastOutcome!.lesson).not.toBeNull(); // 이벤트 종료 → 교훈
    s = step(s, { type: 'continue' });
    s = step(s, { type: 'endMonth' });
  });

  it('같은 달에 예약 장면이 배치 이벤트보다 먼저 나온다 (6월 check6 → rent-hike)', () => {
    let s = start();
    s = runFallbackUntilScene(s, 'check4'); // 3월 기본값 flip3 → 4월 check4
    s = step(s, { type: 'choose', choiceId: 'hold' }); // → 6월 check6 예약
    s = step(s, { type: 'continue' });
    while (s.month < 6) s = fallbackStep(s);
    s = step(s, { type: 'beginMonth' }); // 6월
    expect(s.current?.sceneId).toBe('check6');
    expect(s.queue).toEqual([{ eventId: 'rent-hike', sceneId: 'notice' }]);
    s = step(s, { type: 'choose', choiceId: 'hold' });
    s = step(s, { type: 'continue' }); // queue의 다음 장면으로
    expect(s.current?.sceneId).toBe('notice');
    expect(s.step).toBe('scene');
  });

  it('when 조건이 거짓이면 예약 장면은 소멸한다 (10월 리볼빙)', () => {
    let s = start();
    // 1~4월: 가벼운 선택으로 지나친다 (2월 수리, 3월 패스, 4월 조용한 달)
    s = step(s, { type: 'beginMonth' }); // 1월
    s = step(s, { type: 'choose', choiceId: 'ok' });
    s = step(s, { type: 'continue' });
    s = step(s, { type: 'endMonth' });
    s = step(s, { type: 'beginMonth' }); // 2월
    const e2 = s.accounts.emergency.balance;
    s = step(s, { type: 'choose', choiceId: 'repair', payment: { parts: [{ source: 'emergency', amount: e2 }, { source: 'goal', amount: 600_000 - e2 }] } });
    s = step(s, { type: 'continue' });
    s = step(s, { type: 'endMonth' });
    s = step(s, { type: 'beginMonth' }); // 3월
    s = step(s, { type: 'choose', choiceId: 'pass' });
    s = step(s, { type: 'continue' });
    s = step(s, { type: 'endMonth' });
    s = step(s, { type: 'beginMonth' }); // 4월
    s = step(s, { type: 'endMonth' });
    // 5월: 손편지 + 전화 확인(사기 회피), 6월: 협상 수용, 7월: 당첨금 입금, 8월: 그대로
    for (const script of [
      () => {
        s = step(s, { type: 'choose', choiceId: 'letter', payment: { parts: [{ source: 'living', amount: 50_000 }] } });
        s = step(s, { type: 'continue' });
        s = step(s, { type: 'choose', choiceId: 'call' });
        s = step(s, { type: 'continue' });
      },
      () => {
        s = step(s, { type: 'choose', choiceId: 'negotiate' });
        s = step(s, { type: 'continue' });
        s = step(s, { type: 'choose', choiceId: 'accept30' });
        s = step(s, { type: 'continue' }); // → adjust
        const b = cloneBudget(s.budget);
        b.expenses.leisure -= 30_000;
        s = step(s, { type: 'setBudget', budget: b });
      },
      () => {
        s = step(s, { type: 'choose', choiceId: 'save', depositTo: 'emergency' });
        s = step(s, { type: 'continue' });
      },
      () => {
        s = step(s, { type: 'choose', choiceId: 'hold' });
        s = step(s, { type: 'continue' });
      },
    ] as (() => void)[]) {
      s = step(s, { type: 'beginMonth' });
      script();
      s = step(s, { type: 'endMonth' });
    }
    // 9월: 물가 상승 무시 → 10월 리볼빙 예약. 생활비가 남아 livingShort가 아니면 소멸
    s = step(s, { type: 'beginMonth' });
    expect(s.current?.sceneId).toBe('notice');
    s = step(s, { type: 'choose', choiceId: 'ignore' });
    expect(s.scheduled).toHaveLength(1);
    expect(s.scheduled[0]!.when).toEqual({ kind: 'flag', key: 'livingShort', equals: true });
    s = step(s, { type: 'continue' });
    s = step(s, { type: 'endMonth' });
    s = step(s, { type: 'beginMonth' }); // 10월
    expect(s.flags.livingShort).toBe(false);
    expect(s.scheduled).toHaveLength(0);
    expect(s.step).toBe('report');
    expect(s.decisions.some((d) => d.choiceId === 'revolve')).toBe(false);
  });

  it('entryVariants: 투자 잔고가 0이면 dropNoInvest 장면으로', () => {
    const b = cloneBudget(start().budget);
    b.transfers.invest = 0; // 남는 돈은 생활비 통장에
    let s = start(b);
    s = runFallbackUntilScene(s, 'dropNoInvest'); // 8월
    // tipStock: 카드 3개월 부채 + invest +50만 후 반 토막 -25만 → 25만 (음수 계좌 없음)
    s = step(s, { type: 'choose', choiceId: 'tipStock' });
    const tipDebt = s.debts.find((d) => d.id === 'market-crash-8-tipStock')!;
    expect(tipDebt.kind).toBe('installment');
    expect(tipDebt.monthsLeft).toBe(3);
    expect(s.accounts.invest.balance).toBe(250_000); // +50만 후 -25만, 음수 계좌 없음
    expect(s.accounts.invest.contributed).toBe(500_000);
  });

  it('adjustable 지불: 범위·단위 안의 금액만, 계획 합계와 같아야', () => {
    let s = start();
    s = runFallbackUntilScene(s, 'drop'); // 8월 (투자 있음)
    // buyMore: adjustable { min 5만, max 100만, step 5만 }, sources [living, goal]
    const offStep = { type: 'choose', choiceId: 'buyMore', amount: 60_000, payment: { parts: [{ source: 'goal', amount: 60_000 }] } } as Action;
    expect(canStep(s, offStep)).not.toBe(true);
    try {
      step(s, offStep);
      expect.unreachable();
    } catch (e) {
      expect((e as StepError).code).toBe('payment-invalid');
    }
    const noAmount = { type: 'choose', choiceId: 'buyMore' } as Action;
    expect(canStep(s, noAmount)).not.toBe(true);
    // 정상: 목표 통장에서 15만 원 추가 매수 → invest로 이동
    s = step(s, { type: 'choose', choiceId: 'buyMore', amount: 150_000, payment: { parts: [{ source: 'goal', amount: 150_000 }] } });
    expect(s.accounts.invest.balance).toBeGreaterThan(0);
    expect(s.lastOutcome!.deltas).toContainEqual({ kind: 'account', account: 'invest', amount: 150_000 });
    expect(s.decisions.at(-1)!.payment?.parts).toEqual([{ source: 'goal', amount: 150_000 }]);
  });

  it('goalBonus: 목표 통장으로 내면 만족도 보너스, 계획된 행복 2번이면 도전과제', () => {
    let s = toFeb(start()); // 2월 장면
    s = step(s, { type: 'choose', choiceId: 'used' });
    s = step(s, { type: 'continue' });
    s = step(s, { type: 'choose', choiceId: 'safe', payment: { parts: [{ source: 'emergency', amount: 350_000 }] } });
    s = step(s, { type: 'continue' });
    s = step(s, { type: 'endMonth' });
    s = step(s, { type: 'beginMonth' }); // 3월
    const g3 = s.accounts.goal.balance;
    s = step(s, { type: 'choose', choiceId: 'wear', payment: { parts: [{ source: 'goal', amount: g3 }, { source: 'living', amount: 300_000 - g3 }] } });
    expect(s.satisfaction).toBe(68); // 선택 효과 +4, goalBonus +4
    expect(s.unlocked).not.toContain('plannedJoy');
    s = step(s, { type: 'continue' });
    s = step(s, { type: 'endMonth' });
    s = step(s, { type: 'beginMonth' }); // 4월(예약 없음)
    s = step(s, { type: 'endMonth' });
    s = step(s, { type: 'beginMonth' }); // 5월
    s = step(s, { type: 'choose', choiceId: 'mid', payment: { parts: [{ source: 'goal', amount: 150_000 }] } });
    expect(s.satisfaction).toBe(68 + 5 + 3); // 선택 효과 +5, goalBonus +3
    expect(s.unlocked).toContain('plannedJoy'); // 목표 통장 계획 소비 2번
  });
});

describe('12월 결산', () => {
  it('적금 만기(세전·세후)·최종 잔고·순자산·엔딩·도전과제·가계부 전후 비교', () => {
    const s = runFallbackYear(start());
    expect(s.phase).toBe('result');
    const st = s.settlement!;
    expect(s.history).toHaveLength(12);
    expect(s.history[11]!.month).toBe(12);
    expect(s.history.map((h) => h.month)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    // 기본값 경로는 적금을 깨지 않는다 → 만기 12회
    expect(s.savings.broken).toBe(false);
    expect(s.savings.paidMonths).toBe(12);
    expect(st.maturity.principal).toBe(s.budget.transfers.savings * 12);
    expect(st.maturity.tax).toBe(Math.round(st.maturity.interestGross * 0.154));
    expect(st.maturity.interestNet).toBe(st.maturity.interestGross - st.maturity.tax);
    expect(st.finalBalances.savings).toBe(s.budget.transfers.savings * 12 + st.maturity.interestNet);
    expect(st.netWorth).toBeGreaterThan(0);
    expect(st.debt).toBe(totalDebt(s));
    expect(st.ending).toBe('debt'); // splurge 잔여 2개월
    expect(st.achievements).toHaveLength(13);
    expect(new Set(st.achievements.map((a) => a.id)).size).toBe(13);
    // 가계부 전후 비교: 기본값 경로에서 바뀐 항목은 rent(+7만)과 그 절감 출처뿐
    expect(st.budgetDiff.map((d) => d.key).sort()).toEqual(['leisure', 'rent']);
  });

  it('adjust 단계에서 합계가 월급 안이어야 report로 넘어간다 (조정 완료는 setBudget이다)', () => {
    const b = cloneBudget(start().budget);
    b.expenses.leisure += 60_000; // 남는 돈 0 — 월세가 오르면 월급을 넘는다
    let s = start(b);
    s = step(s, { type: 'beginMonth' }); // 1월
    s = step(s, { type: 'choose', choiceId: 'ok' });
    s = step(s, { type: 'continue' });
    s = step(s, { type: 'endMonth' });
    s = step(s, { type: 'beginMonth' }); // 2월
    s = step(s, { type: 'choose', choiceId: 'used' });
    s = step(s, { type: 'continue' });
    s = step(s, { type: 'choose', choiceId: 'safe', payment: { parts: [{ source: 'emergency', amount: 350_000 }] } });
    s = step(s, { type: 'continue' });
    s = step(s, { type: 'endMonth' });
    s = step(s, { type: 'beginMonth' }); // 3월
    s = step(s, { type: 'choose', choiceId: 'pass' });
    s = step(s, { type: 'continue' });
    s = step(s, { type: 'endMonth' });
    s = step(s, { type: 'beginMonth' }); // 4월
    s = step(s, { type: 'endMonth' });
    s = step(s, { type: 'beginMonth' }); // 5월
    s = step(s, { type: 'choose', choiceId: 'mid', payment: { parts: [{ source: 'goal', amount: 150_000 }] } });
    s = step(s, { type: 'continue' });
    s = step(s, { type: 'choose', choiceId: 'call' });
    s = step(s, { type: 'continue' });
    s = step(s, { type: 'endMonth' });
    // 6월: 월세 인상 accept → adjust
    s = step(s, { type: 'beginMonth' });
    s = step(s, { type: 'choose', choiceId: 'accept' });
    s = step(s, { type: 'continue' });
    expect(s.step).toBe('adjust');
    expect(s.lastOutcome!.budgetReason).toContain('5만 원');
    // 월급을 넘은 채 제출 → 여전히 adjust
    s = step(s, { type: 'setBudget', budget: cloneBudget(s.budget) });
    expect(s.step).toBe('adjust');
    expect(s.budgetEdits).toBe(1);
    // 여가 5만 절감 → 월급 안 → report (조정 완료는 별도 continue가 아니다)
    const fixed = cloneBudget(s.budget);
    fixed.expenses.leisure -= 50_000;
    s = step(s, { type: 'setBudget', budget: fixed });
    expect(s.step).toBe('report');
    expect(s.budgetEdits).toBe(2);
    expect(() => step(s, { type: 'continue' })).toThrow(StepError); // report에서 continue 불가
  });
});

describe('StepError 코드 (canStep과 step이 같은 판정)', () => {
  it('각 오류 상황이 문서의 코드로 나온다', () => {
    const s = start();
    const cases: { action: Action; code: string }[] = [
      { action: { type: 'start', nickname: 'x' }, code: 'invalid-phase' },
      { action: { type: 'submitSurvey', answers: {} }, code: 'invalid-phase' },
      { action: { type: 'goto', phase: 'budget' }, code: 'invalid-phase' },
      { action: { type: 'confirmBudget' }, code: 'invalid-phase' },
      { action: { type: 'choose', choiceId: 'ok' }, code: 'invalid-step' },
      { action: { type: 'continue' }, code: 'invalid-step' },
      { action: { type: 'endMonth' }, code: 'invalid-step' },
      { action: { type: 'statusAction', status: 'sneakers', action: 'sellSneakers', depositTo: 'goal' }, code: 'invalid-step' },
    ];
    for (const { action, code } of cases) {
      expect(canStep(s, action)).not.toBe(true);
      try {
        step(s, action);
        expect.unreachable();
      } catch (e) {
        expect((e as StepError).code).toBe(code);
      }
    }
    // 장면 안의 오류 (1월 튜토리얼 → 2월 노트북 장면)
    const m = step(s, { type: 'beginMonth' });
    expect(canStep(m, { type: 'choose', choiceId: '없는선택지' })).not.toBe(true);
    try {
      step(m, { type: 'choose', choiceId: '없는선택지' });
      expect.unreachable();
    } catch (e) {
      expect((e as StepError).code).toBe('unknown-choice');
    }
    const feb = toFeb(s); // 2월 장면
    const sceneCases: { action: Action; code: string }[] = [
      { action: { type: 'choose', choiceId: 'repair', payment: { parts: [{ source: 'living', amount: 1 }] } }, code: 'payment-invalid' },
      { action: { type: 'choose', choiceId: 'repair' }, code: 'payment-invalid' }, // 계획 없음
      { action: { type: 'choose', choiceId: 'repair', payment: { parts: [{ source: 'emergency', amount: 600_000 }] } }, code: 'over-balance' },
    ];
    for (const { action, code } of sceneCases) {
      expect(canStep(feb, action)).not.toBe(true);
      try {
        step(feb, action);
        expect.unreachable();
      } catch (e) {
        expect((e as StepError).code).toBe('payment-invalid');
      }
    }
  });

  it('잠긴 선택지는 choice-locked (11월 allIn, 적금 300만 미만)', () => {
    const b = cloneBudget(start().budget);
    b.transfers.savings = 100_000; // 월 10만 → 11월에 110만 < 300만 (남는 돈은 생활비 통장에)
    let s = start(b);
    s = runFallbackUntilScene(s, 'invite'); // 11월
    const scene = getScene(s.current!).scene;
    const allIn = scene.choices.find((c) => c.id === 'allIn')!;
    expect(allIn.requires).toBeDefined();
    const action = { type: 'choose', choiceId: 'allIn' } as Action;
    expect(canStep(s, action)).not.toBe(true);
    try {
      step(s, action);
      expect.unreachable();
    } catch (e) {
      expect((e as StepError).code).toBe('choice-locked');
    }
  });
});

describe('순수성·결정성', () => {
  it('step·canStep은 절대 원본을 고치지 않는다 (한 달 사이클 전체)', () => {
    const s = start();
    const before = JSON.stringify(s);
    const frozen = deepFreeze(JSON.parse(before) as GameState);
    let cur = step(frozen, { type: 'beginMonth' });
    cur = step(cur, { type: 'choose', choiceId: 'ok' });
    cur = step(cur, { type: 'continue' });
    cur = step(cur, { type: 'endMonth' });
    expect(cur.month).toBe(2);
    expect(JSON.stringify(frozen)).toBe(before);
  });

  it('같은 (state, action)은 항상 같은 결과', () => {
    const s = start();
    const a = step(s, { type: 'beginMonth' });
    const b = step(s, { type: 'beginMonth' });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('choose의 auto 플래그는 선택 기록으로 옮겨진다', () => {
    let s = start();
    s = step(s, { type: 'beginMonth' });
    s = step(s, { type: 'choose', choiceId: 'ok', auto: true });
    expect(s.decisions[0]!.auto).toBe(true);
    s = step(s, { type: 'continue' });
    s = step(s, { type: 'endMonth' });
    s = step(s, { type: 'beginMonth' });
    s = step(s, { type: 'choose', choiceId: 'used' });
    expect(s.decisions[1]!.auto).toBeUndefined();
  });
});
