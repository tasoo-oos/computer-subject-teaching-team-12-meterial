// 시뮬레이션 엔진. 디자인 시안 단계에서는 시그니처만 고정하고, step 본체는 구현하지 않는다.
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
  ExpenseId,
  GameState,
  QuestionId,
  SpendingType,
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
 * 규칙은 기획서 5장과 docs/core-api.md를 따른다. 디자인 시안 단계에서는 구현하지 않는다.
 */
export function step(_state: GameState, action: Action): GameState {
  throw new NotImplementedError(`step(${action.type})`);
}
