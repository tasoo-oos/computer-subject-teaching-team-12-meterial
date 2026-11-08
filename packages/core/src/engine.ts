// 시뮬레이션 엔진. 지금은 시그니처만 고정하고, step 본체는 구현하지 않는다.
import { ACCOUNT_ORDER, EXPENSE_ORDER } from './data/accounts.ts';
import { BASE_SALARY, SALARY_ROUND, SALARY_SPREAD, START_CREDIT, START_SATISFACTION } from './data/constants.ts';
import {
  BASE_EXPENSES,
  RECOMMENDED_TRANSFERS,
  SPENDING_TYPE_THRESHOLDS,
  SURVEY,
} from './data/survey.ts';
import type {
  AccountId,
  AccountState,
  Action,
  Budget,
  BudgetChange,
  Choice,
  DecisionRecord,
  DepositSpec,
  ExpenseId,
  GameState,
  MonthNo,
  PaySpec,
  PaymentIssue,
  PaymentPlan,
  QuestionId,
  Scene,
  SpendingType,
  StepErrorCode,
  SurveyResult,
  Won,
} from './types.ts';

export class NotImplementedError extends Error {
  constructor(what: string) {
    super(`아직 구현하지 않음: ${what}`);
    this.name = 'NotImplementedError';
  }
}

const roundTo = (n: number, unit: number) => Math.round(n / unit) * unit;

export function emptyBudget(): Budget {
  return {
    transfers: { emergency: 0, savings: 0, invest: 0, goal: 0, housing: 0 },
    expenses: Object.fromEntries(EXPENSE_ORDER.map((id) => [id, 0])) as Record<ExpenseId, Won>,
    livingBuffer: 0,
  };
}

export function emptyAccounts(): Record<AccountId, AccountState> {
  return Object.fromEntries(ACCOUNT_ORDER.map((id) => [id, { balance: 0, contributed: 0, earned: 0 }])) as Record<
    AccountId,
    AccountState
  >;
}

/** 기준 평균소득 ±10%, 1만 원 단위 반올림 */
export function rollSalary(random: () => number = Math.random, base: Won = BASE_SALARY): Won {
  const factor = 1 + (random() * 2 - 1) * SALARY_SPREAD;
  return roundTo(base * factor, SALARY_ROUND);
}

export function createInitialState(nickname: string, salary: Won): GameState {
  return {
    version: 1,
    phase: 'start',
    profile: { nickname, salary, baseSalary: BASE_SALARY },
    survey: { answers: {}, result: null },
    initialBudget: null,
    budget: emptyBudget(),
    month: 1,
    step: 'payday',
    payday: null,
    accounts: emptyAccounts(),
    savings: { paidMonths: 0, broken: false, brokenMonth: null, restartedPrincipal: 0 },
    debts: [],
    statuses: [],
    satisfaction: START_SATISFACTION,
    credit: START_CREDIT,
    flags: {},
    queue: [],
    current: null,
    lastOutcome: null,
    scheduled: [],
    history: [],
    decisions: [],
    budgetEdits: 0,
    unlocked: [],
    settlement: null,
  };
}

export function classifySpending(answers: Partial<Record<QuestionId, string>>): { type: SpendingType; score: number } {
  let score = 0;
  for (const q of SURVEY) {
    const opt = q.options.find((o) => o.id === answers[q.id]);
    if (opt) score += opt.impulse;
  }
  const type: SpendingType =
    score <= SPENDING_TYPE_THRESHOLDS.planner ? 'planner' : score <= SPENDING_TYPE_THRESHOLDS.balanced ? 'balanced' : 'impulsive';
  return { type, score };
}

/** 설문 답과 월급으로 추천 가계부를 만든다. 남는 돈은 생활비 여유분으로 둔다 */
export function recommendBudget(answers: Partial<Record<QuestionId, string>>, salary: Won): SurveyResult {
  const { type, score } = classifySpending(answers);
  const expenses = { ...BASE_EXPENSES };
  for (const q of SURVEY) {
    const opt = q.options.find((o) => o.id === answers[q.id]);
    for (const [k, v] of Object.entries(opt?.adds ?? {})) expenses[k as ExpenseId] += v;
  }
  const r = RECOMMENDED_TRANSFERS[type];
  const transfers = {
    emergency: roundTo(salary * r.emergency, 10_000),
    savings: roundTo(salary * r.savings, 10_000),
    invest: roundTo(salary * r.invest, 10_000),
    goal: roundTo(salary * r.goal, 10_000),
    housing: r.housing,
  };
  const spent = Object.values(transfers).reduce((a, b) => a + b, 0) + Object.values(expenses).reduce((a, b) => a + b, 0);
  let livingBuffer = salary - spent;
  if (livingBuffer < 0) {
    // 모자라면 적금부터 줄인다
    const cut = Math.min(transfers.savings, -livingBuffer);
    transfers.savings -= cut;
    livingBuffer += cut;
    if (livingBuffer < 0) {
      expenses.leisure = Math.max(0, expenses.leisure + livingBuffer);
      livingBuffer = 0;
    }
  }
  return { type, impulseScore: score, recommended: { transfers, expenses, livingBuffer } };
}

/**
 * 상태 전이. React useReducer에 그대로 연결한다.
 * 규칙은 기획서 5장과 docs/core-api.md를 따른다. M1에서 구현한다.
 */
export function step(_state: GameState, action: Action): GameState {
  throw new NotImplementedError(`step(${action.type})`);
}

/** 조건을 어기면 던지는 예외 (docs/core-api.md §4.2). erasable 구문만 쓴다(파라미터 프로퍼티 금지, §1.3). */
export class StepError extends Error {
  readonly code: StepErrorCode;
  constructor(code: StepErrorCode, message: string) {
    super(message);
    this.name = 'StepError';
    this.code = code;
  }
}

/** 행동을 적용할 수 있는지 미리 검사. 실패 이유 문구를 돌려준다. 서버의 allowed 검사가 쓴다.
 *  canStep이 true를 반환하는 행동은 step이 예외 없이 처리해야 한다(§4.4). M1에서 구현한다. */
export function canStep(_state: GameState, action: Action): true | string {
  throw new NotImplementedError(`canStep(${action.type})`);
}

/** 합계 맞추기. 남는 돈은 생활비 여유분에 넣고, 모자라면 여유분에서 뺀다.
 *  여유분이 0이 되어도 모자라면 변동비를 여가 → 의류·미용 → 생활용품 → 경조사 → 식비 순서로 줄인다.
 *  고정비와 자동이체는 절대 건드리지 않는다. 결과는 항상 isBudgetValid를 통과한다.
 *  changes는 학생 안내 문구용. M1'에서 구현한다. */
export function balanceBudget(_budget: Budget, _salary: Won): { budget: Budget; changes: BudgetChange[] } {
  throw new NotImplementedError('balanceBudget');
}

/** 답하지 않은 문항만 중간 답으로 채운다. 중간 답 = 보기 n개 중 floor((n-1)/2)번째(데이터 순서).
 *  이미 답한 문항은 그대로 둔다. M1'에서 구현한다. */
export function defaultAnswers(_answers: Partial<Record<QuestionId, string>>): Record<QuestionId, string> {
  throw new NotImplementedError('defaultAnswers');
}

/** 장면의 기본 선택지(fallback: true). 정확히 하나 있어야 한다(테스트 §4.4). M1'에서 구현한다. */
export function fallbackChoice(_scene: Scene): Choice {
  throw new NotImplementedError('fallbackChoice');
}

/** 자동 지불 계획: 허용된 수단 중 생활비 → 비상금 → 목표 → 투자 → 적금 → 청약 순서로
 *  잔고만큼, 남으면 카드 일시불(cardMonths에 1이 있을 때, 없으면 가장 짧은 허용 개월).
 *  adjustable이면 금액 = 최솟값. 카드도 허용되지 않아 남는 금액은 shortfall로 돌려준다. M1'에서 구현한다. */
export function autoPaymentPlan(_state: GameState, _pay: PaySpec): { plan: PaymentPlan; shortfall: Won } {
  throw new NotImplementedError('autoPaymentPlan');
}

/** 자동 입금 계좌: 데이터의 첫 번째 입금 계좌. M1'에서 구현한다. */
export function autoDepositTarget(_deposit: DepositSpec): AccountId {
  throw new NotImplementedError('autoDepositTarget');
}

/** 지불 계획 검증. 지불 패널과 서버가 같은 규칙을 쓴다 (DESIGN.md 7장 4번 제안). M1'에서 구현한다. */
export function validatePayment(
  _state: GameState,
  _pay: PaySpec,
  _plan: PaymentPlan,
): { ok: true } | { ok: false; issue: PaymentIssue } {
  throw new NotImplementedError('validatePayment');
}

/** 그 달의 선택 기록(첫 선택 + 이어진 장면 + 상태 행동)을 기록 순서대로. 집계(stats)가 쓴다. M1'에서 구현한다. */
export function monthChoices(_state: GameState, _month: MonthNo): DecisionRecord[] {
  throw new NotImplementedError('monthChoices');
}
