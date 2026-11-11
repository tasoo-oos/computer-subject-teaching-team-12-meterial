// §4.3 기본값·자동 처리 함수 단위 테스트 (§4.4 표)
import { describe, expect, it } from 'vitest';
import {
  autoDepositTarget,
  autoPaymentPlan,
  balanceBudget,
  createInitialState,
  defaultAnswers,
  emptyBudget,
  monthChoices,
  step,
  validatePayment,
} from './engine.ts';
import { isBudgetValid } from './selectors.ts';
import type {
  Budget,
  CardMonths,
  FundingSource,
  GameState,
  PaymentPlan,
  QuestionId,
  Won,
} from './types.ts';

// 합계 1,980,000원인 기준 가계부
function baseBudget(overrides: Partial<Budget['expenses']> = {}): Budget {
  const b = emptyBudget();
  b.transfers = { emergency: 100_000, savings: 200_000, invest: 100_000, goal: 50_000, housing: 50_000 };
  b.expenses = {
    rent: 550_000,
    phone: 50_000,
    insurance: 50_000,
    transport: 70_000,
    subscription: 10_000,
    food: 400_000,
    household: 50_000,
    beauty: 100_000,
    leisure: 150_000,
    family: 50_000,
    ...overrides,
  };
  return b;
}

describe('balanceBudget', () => {
  it('남는 돈은 그대로 둔다 (생활비 통장에 남는다)', () => {
    const b = baseBudget(); // 합계 1,980,000
    const { budget: out, changes } = balanceBudget(b, 2_050_000);
    expect(changes).toEqual([]);
    expect(out).toEqual(b);
    expect(isBudgetValid(out, 2_050_000)).toBe(true);
  });

  it('월급을 넘으면 변동비를 여가→의류·미용→생활용품→경조사→식비 순서로 줄인다', () => {
    const b = baseBudget(); // 합계 1,980,000
    // 12만 원 초과: 여가 15만 중 12만
    let r = balanceBudget(b, 1_860_000);
    expect(r.budget.expenses.leisure).toBe(30_000);
    expect(r.changes).toEqual([{ key: 'leisure', before: 150_000, after: 30_000 }]);
    expect(isBudgetValid(r.budget, 1_860_000)).toBe(true);

    // 25만 원 초과: 여가 15만 전부 → 의류·미용 10만 전부
    r = balanceBudget(b, 1_730_000);
    expect(r.budget.expenses.leisure).toBe(0);
    expect(r.budget.expenses.beauty).toBe(0);
    expect(r.changes.map((c) => c.key)).toEqual(['leisure', 'beauty']);

    // 40만 원 초과: 여가→미용→생활용품 5만→경조사 5만→식비 5만
    r = balanceBudget(b, 1_580_000);
    expect(r.budget.expenses.leisure).toBe(0);
    expect(r.budget.expenses.beauty).toBe(0);
    expect(r.budget.expenses.household).toBe(0);
    expect(r.budget.expenses.family).toBe(0);
    expect(r.budget.expenses.food).toBe(350_000);
    expect(r.changes.map((c) => c.key)).toEqual(['leisure', 'beauty', 'household', 'family', 'food']);
    expect(isBudgetValid(r.budget, 1_580_000)).toBe(true);
  });

  it('고정비와 자동이체는 줄이지 않는다', () => {
    const b = baseBudget(); // 합계 1,980,000
    const { budget: out } = balanceBudget(b, 1_880_000); // 10만 원 초과
    expect(out.expenses.rent).toBe(550_000);
    expect(out.expenses.phone).toBe(50_000);
    expect(out.expenses.insurance).toBe(50_000);
    expect(out.expenses.transport).toBe(70_000);
    expect(out.expenses.subscription).toBe(10_000);
    expect(out.transfers).toEqual(b.transfers);
  });

  it('이미 합계가 맞으면 아무 것도 바꾸지 않는다', () => {
    const b = baseBudget();
    const { budget: out, changes } = balanceBudget(b, 1_980_000);
    expect(changes).toEqual([]);
    expect(out).toEqual(b);
  });
});

describe('defaultAnswers', () => {
  it('보기 4개→2번째, 3개→2번째(중간)를 채운다', () => {
    const out = defaultAnswers({});
    expect(Object.keys(out)).toHaveLength(7);
    expect(out.meal).toBe('5to10'); // 보기 4개 → floor(3/2)=1 → 두 번째
    expect(out.phonePlan).toBe('normal'); // 보기 3개 → floor(2/2)=1 → 두 번째
    expect(out.impulse).toBe('think');
  });

  it('이미 답한 문항은 그대로 둔다', () => {
    const out = defaultAnswers({ meal: 'gt15', weekend: 'gt30' });
    expect(out.meal).toBe('gt15');
    expect(out.weekend).toBe('gt30');
    expect(out.cafe).toBe('lt3'); // 보기 4개 → 두 번째
  });

  it('7문항 모두 채워 submitSurvey를 통과한다', () => {
    let s = createInitialState('검증');
    s = step(s, { type: 'start', nickname: '검증' });
    s = step(s, { type: 'submitSurvey', answers: defaultAnswers({}) });
    expect(s.phase).toBe('guide');
    expect(s.survey.result).not.toBeNull();
  });
});

describe('autoPaymentPlan', () => {
  const stateWith = (balances: Partial<Record<keyof GameState['accounts'], Won>>): GameState => {
    const s = createInitialState('자동');
    for (const [k, v] of Object.entries(balances)) s.accounts[k as keyof GameState['accounts']].balance = v as Won;
    return s;
  };
  const ALL: FundingSource[] = ['living', 'emergency', 'goal', 'invest', 'savings', 'housing', 'card'];

  it('생활비 → 비상금 → 목표 → 투자 → 적금 → 청약 순서로 잔고만큼', () => {
    const s = stateWith({ living: 100_000, emergency: 200_000, goal: 500_000 });
    const { plan, shortfall } = autoPaymentPlan(s, { amount: 600_000, sources: ALL });
    expect(plan.parts).toEqual([
      { source: 'living', amount: 100_000 },
      { source: 'emergency', amount: 200_000 },
      { source: 'goal', amount: 300_000 },
    ]);
    expect(plan.card).toBeUndefined();
    expect(shortfall).toBe(0);
  });

  it('PaySpec.sources에 없는 수단은 건너뛴다', () => {
    const s = stateWith({ living: 100_000, emergency: 200_000, invest: 500_000 });
    const { plan } = autoPaymentPlan(s, { amount: 600_000, sources: ['living', 'invest'] });
    expect(plan.parts).toEqual([
      { source: 'living', amount: 100_000 },
      { source: 'invest', amount: 500_000 },
    ]);
  });

  it('남으면 카드 일시불(cardMonths에 1이 있을 때)', () => {
    const s = stateWith({ emergency: 100_000 });
    const { plan, shortfall } = autoPaymentPlan(s, {
      amount: 600_000,
      sources: ['emergency', 'card'],
      cardMonths: [1, 3],
    });
    expect(plan.parts).toEqual([{ source: 'emergency', amount: 100_000 }]);
    expect(plan.card).toEqual({ amount: 500_000, months: 1 });
    expect(shortfall).toBe(0);
  });

  it('cardMonths에 1이 없으면 가장 짧은 허용 개월', () => {
    const s = stateWith({ emergency: 100_000 });
    const { plan } = autoPaymentPlan(s, { amount: 600_000, sources: ['emergency', 'card'], cardMonths: [3, 6] });
    expect(plan.card).toEqual({ amount: 500_000, months: 3 });
  });

  it('카드도 허용되지 않으면 남는 금액은 shortfall', () => {
    const s = stateWith({ emergency: 100_000 });
    const { plan, shortfall } = autoPaymentPlan(s, { amount: 600_000, sources: ['emergency', 'goal'] });
    expect(plan.card).toBeUndefined();
    expect(shortfall).toBe(500_000);
  });

  it('adjustable이면 금액 = 최솟값', () => {
    const s = stateWith({ living: 1_000_000 });
    const { plan, shortfall } = autoPaymentPlan(s, {
      amount: 200_000,
      sources: ['living', 'goal'],
      adjustable: { min: 50_000, max: 1_000_000, step: 50_000 },
    });
    expect(plan.parts).toEqual([{ source: 'living', amount: 50_000 }]);
    expect(shortfall).toBe(0);
  });

  it('계좌 이동(to) 선택지도 같은 계획을 쓴다', () => {
    const s = stateWith({ living: 300_000 });
    const { plan } = autoPaymentPlan(s, { amount: 200_000, sources: ['living'], to: 'invest' });
    expect(plan.parts).toEqual([{ source: 'living', amount: 200_000 }]);
  });
});

describe('autoDepositTarget', () => {
  it('데이터의 첫 번째 입금 계좌', () => {
    expect(autoDepositTarget({ amount: 50_000, targets: ['living', 'emergency'] })).toBe('living');
    expect(autoDepositTarget({ amount: 'investBalance', targets: ['emergency', 'goal'] })).toBe('emergency');
  });
});

describe('validatePayment', () => {
  const stateWith = (balances: Partial<Record<keyof GameState['accounts'], Won>>): GameState => {
    const s = createInitialState('검증');
    for (const [k, v] of Object.entries(balances)) s.accounts[k as keyof GameState['accounts']].balance = v as Won;
    return s;
  };
  const pay = { amount: 600_000, sources: ['living', 'emergency', 'card'] as FundingSource[], cardMonths: [1, 3] as CardMonths[] };

  it('합계가 맞으면 통과', () => {
    const s = stateWith({ living: 400_000, emergency: 300_000 });
    const plan: PaymentPlan = { parts: [{ source: 'living', amount: 400_000 }, { source: 'emergency', amount: 200_000 }] };
    expect(validatePayment(s, pay, plan)).toEqual({ ok: true });
  });

  it('합계 불일치 → sum-mismatch', () => {
    const s = stateWith({ living: 400_000 });
    const plan: PaymentPlan = { parts: [{ source: 'living', amount: 400_000 }] };
    const v = validatePayment(s, pay, plan);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.issue.kind).toBe('sum-mismatch');
  });

  it('허용 밖 수단 → source-not-allowed', () => {
    const s = stateWith({ goal: 600_000 });
    const plan: PaymentPlan = { parts: [{ source: 'goal', amount: 600_000 }] };
    const v = validatePayment(s, pay, plan);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.issue.kind).toBe('source-not-allowed');
  });

  it('잔고 초과 → over-balance', () => {
    const s = stateWith({ living: 100_000 });
    const plan: PaymentPlan = { parts: [{ source: 'living', amount: 600_000 }] };
    const v = validatePayment(s, pay, plan);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.issue.kind).toBe('over-balance');
  });

  it('카드 개월 위반 → card-months-not-allowed', () => {
    const s = stateWith({ living: 100_000 });
    const plan: PaymentPlan = { parts: [{ source: 'living', amount: 100_000 }], card: { amount: 500_000, months: 6 } };
    const v = validatePayment(s, pay, plan);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.issue.kind).toBe('card-months-not-allowed');
  });

  it('음수 부분 → negative-part', () => {
    const s = stateWith({ living: 100_000 });
    const plan: PaymentPlan = { parts: [{ source: 'living', amount: -100_000 }] };
    const v = validatePayment(s, pay, plan);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.issue.kind).toBe('negative-part');
  });

  it('adjustable: 범위·단위 어긋나면 amount-out-of-range', () => {
    const s = stateWith({ living: 1_000_000 });
    const spec = {
      amount: 200_000 as Won,
      sources: ['living'] as FundingSource[],
      adjustable: { min: 50_000, max: 500_000, step: 50_000 },
    };
    expect(validatePayment(s, spec, { parts: [{ source: 'living', amount: 200_000 }] }).ok).toBe(true);
    const tooSmall = validatePayment(s, spec, { parts: [{ source: 'living', amount: 30_000 }] });
    expect(tooSmall.ok).toBe(false);
    if (!tooSmall.ok) expect(tooSmall.issue.kind).toBe('amount-out-of-range');
    const offStep = validatePayment(s, spec, { parts: [{ source: 'living', amount: 80_000 }] });
    expect(offStep.ok).toBe(false);
    if (!offStep.ok) expect(offStep.issue.kind).toBe('amount-out-of-range');
  });
});

describe('monthChoices', () => {
  function start(): GameState {
    let s = createInitialState('기록');
    s = step(s, { type: 'start', nickname: '기록' });
    s = step(s, { type: 'submitSurvey', answers: defaultAnswers({}) });
    s = step(s, { type: 'goto', phase: 'budget' });
    s = step(s, { type: 'confirmBudget' });
    return s;
  }

  it('예약 장면이 실행된 달(4월 check4)에 그 달 기록으로 들어온다', () => {
    let s = start();
    // 1월: 튜토리얼
    s = step(s, { type: 'beginMonth' });
    s = step(s, { type: 'choose', choiceId: 'ok' });
    s = step(s, { type: 'continue' });
    s = step(s, { type: 'endMonth' });
    // 2월: 중고 노트북 안전결제 (사기 회피, 후속 장면 없음)
    s = step(s, { type: 'beginMonth' });
    s = step(s, { type: 'choose', choiceId: 'used' });
    s = step(s, { type: 'continue' });
    s = step(s, { type: 'choose', choiceId: 'safe', payment: { parts: [{ source: 'emergency', amount: 350_000 }] } });
    s = step(s, { type: 'continue' });
    s = step(s, { type: 'endMonth' });
    // 3월: 운동화 1켤레 → 4월로 예약
    s = step(s, { type: 'beginMonth' });
    s = step(s, { type: 'choose', choiceId: 'flip1', payment: { parts: [{ source: 'emergency', amount: 300_000 }] } });
    s = step(s, { type: 'continue' });
    s = step(s, { type: 'endMonth' });
    expect(monthChoices(s, 3)).toHaveLength(1);
    expect(monthChoices(s, 3)[0]!.sceneId).toBe('start');

    // 4월: 예약된 check4 장면이 이벤트 없는 달에 등장
    s = step(s, { type: 'beginMonth' });
    expect(s.step).toBe('scene');
    expect(s.current?.sceneId).toBe('check4');
    expect(monthChoices(s, 4)).toHaveLength(0); // 아직 선택 전
    s = step(s, { type: 'choose', choiceId: 'hold' });
    s = step(s, { type: 'continue' });
    s = step(s, { type: 'endMonth' });
    const apr = monthChoices(s, 4);
    expect(apr).toHaveLength(1);
    expect(apr[0]!.eventId).toBe('sneaker-resell');
    expect(apr[0]!.sceneId).toBe('check4');
  });

  it('상태 행동 기록도 그 달 기록으로 들어온다 (장면 밖에서는 빈 이벤트 sentinel)', () => {
    let s = start();
    // 1~3월: 튜토리얼 → 중고 안전결제 → 운동화 1켤레
    s = step(s, { type: 'beginMonth' });
    s = step(s, { type: 'choose', choiceId: 'ok' });
    s = step(s, { type: 'continue' });
    s = step(s, { type: 'endMonth' });
    s = step(s, { type: 'beginMonth' });
    s = step(s, { type: 'choose', choiceId: 'used' });
    s = step(s, { type: 'continue' });
    s = step(s, { type: 'choose', choiceId: 'safe', payment: { parts: [{ source: 'emergency', amount: 350_000 }] } });
    s = step(s, { type: 'continue' });
    s = step(s, { type: 'endMonth' });
    s = step(s, { type: 'beginMonth' });
    s = step(s, { type: 'choose', choiceId: 'flip1', payment: { parts: [{ source: 'emergency', amount: 300_000 }] } });
    s = step(s, { type: 'continue' });
    s = step(s, { type: 'endMonth' });

    // 4월 월급날(장면 없는 상태)에서 운동화 판매: 시세 42만 원 × 0.9
    s = step(s, { type: 'statusAction', status: 'sneakers', action: 'sellSneakers', depositTo: 'emergency' });
    const rec = monthChoices(s, 4);
    expect(rec).toHaveLength(1);
    expect(rec[0]!.eventId).toBe('');
    expect(rec[0]!.eventCode).toBe('');
    expect(rec[0]!.sceneId).toBe('status:sneakers');
    expect(rec[0]!.choiceId).toBe('sellSneakers');
    expect(rec[0]!.kind).toBe('free');
    expect(rec[0]!.payment?.parts[0]).toEqual({ source: 'emergency', amount: 378_000 });
    expect(rec[0]!.tags).toContain('resellProfit');
    expect(s.statuses.some((x) => x.id === 'sneakers')).toBe(false);
    // 산 가격(30만)보다 비싸게 팔아 '리셀 탈출' 달성
    expect(s.unlocked).toContain('resellEscape');
  });
});
