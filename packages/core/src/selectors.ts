// 상태에서 화면용 값을 계산하는 순수 함수들. 화면 앱은 계산을 직접 하지 말고 이 함수들을 쓴다.
import { ACCOUNT_ORDER, TRANSFER_ORDER, EXPENSE_ORDER, EXPENSES } from './data/accounts.ts';
import { EVENTS, SCHEDULE } from './data/events.ts';
import { formatMan } from './format.ts';
import { QUIET_MONTHS, RATES, RESELL_FEE, SETTLEMENT_MONTH, SNEAKER_PRICES } from './data/constants.ts';
import type {
  AccountId,
  AmountSpec,
  Budget,
  BudgetIssue,
  BudgetSummary,
  Choice,
  Condition,
  Debt,
  FundingSource,
  GameEvent,
  GameState,
  MonthNo,
  PaySpec,
  Scene,
  SceneRef,
  SavingsMaturity,
  Won,
} from './types.ts';

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

// ---------------------------------------------------------------------------
// 가계부

export function expenseTotal(budget: Budget): Won {
  return sum(EXPENSE_ORDER.map((id) => budget.expenses[id]));
}

export function transferTotal(budget: Budget): Won {
  return sum(TRANSFER_ORDER.map((id) => budget.transfers[id]));
}

export function budgetSummary(budget: Budget, salary: Won): BudgetSummary {
  const exp = expenseTotal(budget);
  const tr = transferTotal(budget);
  const fixed = sum(EXPENSE_ORDER.filter((id) => EXPENSES[id].group === 'fixed').map((id) => budget.expenses[id]));
  const remaining = salary - tr - exp;
  // 남는 돈은 생활비 통장에 그대로 남는다. 초과면 생활비 통장에는 지출 예산만큼만 잡는다(비율 막대용)
  const livingIn = exp + Math.max(0, remaining);
  const allocated = tr + livingIn;
  const denom = allocated > 0 ? allocated : 1;
  const shares = Object.fromEntries(
    ACCOUNT_ORDER.map((id) => [id, (id === 'living' ? livingIn : budget.transfers[id]) / denom]),
  ) as Record<AccountId, number>;
  return {
    salary,
    transferTotal: tr,
    expenseTotal: exp,
    fixedTotal: fixed,
    variableTotal: exp - fixed,
    livingIn,
    remaining,
    savingsRate: salary > 0 ? tr / salary : 0,
    shares,
  };
}

export function budgetIssues(budget: Budget, salary: Won): BudgetIssue[] {
  const issues: BudgetIssue[] = [];
  for (const id of TRANSFER_ORDER) if (budget.transfers[id] < 0) issues.push({ kind: 'negative', key: id });
  for (const id of EXPENSE_ORDER) if (budget.expenses[id] < 0) issues.push({ kind: 'negative', key: id });
  const { remaining } = budgetSummary(budget, salary);
  if (remaining < 0) issues.push({ kind: 'over', amount: -remaining });
  return issues;
}

export function isBudgetValid(budget: Budget, salary: Won): boolean {
  return budgetIssues(budget, salary).length === 0;
}

// ---------------------------------------------------------------------------
// 지표

export function totalDebt(state: GameState): Won {
  return sum(state.debts.map((d) => d.remaining));
}

export function sneakerValue(state: GameState, month: MonthNo = state.month): Won {
  const s = state.statuses.find((x) => x.id === 'sneakers');
  if (!s) return 0;
  const price = SNEAKER_PRICES[month] ?? 0;
  return Math.round(price * (s.count ?? 1) * (1 - RESELL_FEE));
}

export function netWorth(state: GameState): Won {
  return sum(ACCOUNT_ORDER.map((id) => state.accounts[id].balance)) + sneakerValue(state) - totalDebt(state);
}

/** 이 부채가 이번 달 월말에 생활비 통장에서 빠지는 금액. 이번 달에 만든 부채는 다음 달부터 갚는다 */
export function debtPaymentDue(debt: Debt, month: MonthNo): Won {
  if (debt.startedMonth >= month || debt.monthsLeft <= 0) return 0;
  const interest = Math.round((debt.remaining * debt.annualRate) / 12);
  return Math.min(debt.monthly, debt.remaining + interest);
}

/** 이번 달 월말에 생활비 통장에서 나갈 돈(지출 예산 + 할부·카드값). 월급날 전이거나 이미 마감했으면 0 */
export function monthEndDue(state: GameState): { spending: Won; debtPayments: Won; total: Won } {
  const p = state.payday;
  if (!p || p.closed || p.month !== state.month) return { spending: 0, debtPayments: 0, total: 0 };
  const debtPayments = sum(state.debts.map((d) => debtPaymentDue(d, state.month)));
  return { spending: p.spending, debtPayments, total: p.spending + debtPayments };
}

/** 월말에 나갈 돈을 빼고도 생활비 통장에 남는 돈. 이보다 많이 꺼내 쓰면 월말 부족분이 카드값이 된다 */
export function livingSpare(state: GameState): Won {
  return Math.max(0, state.accounts.living.balance - monthEndDue(state).total);
}

/** 비상금으로 버틸 수 있는 개월 수 (생활비 지출 예산 기준) */
export function emergencyMonths(state: GameState): number {
  const monthly = expenseTotal(state.budget);
  return monthly > 0 ? state.accounts.emergency.balance / monthly : 0;
}

export function creditGrade(score: number): { tier: 1 | 2 | 3 | 4 | 5; label: string } {
  if (score >= 900) return { tier: 1, label: '매우 우수' };
  if (score >= 800) return { tier: 2, label: '우수' };
  if (score >= 700) return { tier: 3, label: '보통' };
  if (score >= 600) return { tier: 4, label: '주의' };
  return { tier: 5, label: '위험' };
}

export function satisfactionBand(score: number): { level: 1 | 2 | 3 | 4 | 5; label: string } {
  if (score >= 80) return { level: 1, label: '아주 만족' };
  if (score >= 60) return { level: 2, label: '만족' };
  if (score >= 40) return { level: 3, label: '그럭저럭' };
  if (score >= 20) return { level: 4, label: '지침' };
  return { level: 5, label: '번아웃' };
}

/** 매달 같은 금액을 12회 넣은 적금의 만기 계산 (단리) */
export function savingsMaturity(monthly: Won, months = 12, broken = false): SavingsMaturity {
  const principal = monthly * months;
  const rate = broken ? RATES.savingsBroken : RATES.savings;
  // 1회차는 months개월, 마지막 회차는 1개월 동안 이자가 붙는다
  const monthSum = (months * (months + 1)) / 2;
  const interestGross = Math.round((monthly * rate * monthSum) / 12);
  const tax = Math.round(interestGross * RATES.interestTax);
  return { principal, interestGross, tax, interestNet: interestGross - tax, broken };
}

// ---------------------------------------------------------------------------
// 월과 이벤트

export type MonthKind = 'tutorial' | 'event' | 'quiet' | 'settlement';

export function monthKind(month: MonthNo): MonthKind {
  if (month === SETTLEMENT_MONTH) return 'settlement';
  if (month === 1) return 'tutorial';
  if (QUIET_MONTHS.includes(month)) return 'quiet';
  return 'event';
}

export function eventForMonth(month: MonthNo): GameEvent | null {
  const id = SCHEDULE[month];
  return id ? EVENTS[id] : null;
}

export function getScene(ref: SceneRef): { event: GameEvent; scene: Scene } {
  const event = EVENTS[ref.eventId];
  const scene = event.scenes[ref.sceneId];
  if (!scene) throw new Error(`장면 없음: ${ref.eventId}/${ref.sceneId}`);
  return { event, scene };
}

export function entrySceneId(state: GameState, event: GameEvent): string {
  for (const v of event.entryVariants ?? []) if (evalCondition(state, v.when)) return v.scene;
  return event.entry;
}

export function evalCondition(state: GameState, cond: Condition): boolean {
  switch (cond.kind) {
    case 'minBalance':
      return state.accounts[cond.account].balance >= cond.amount;
    case 'maxBalance':
      return state.accounts[cond.account].balance <= cond.amount;
    case 'hasStatus':
      return state.statuses.some((s) => s.id === cond.status);
    case 'lacksStatus':
      return !state.statuses.some((s) => s.id === cond.status);
    case 'flag':
      return state.flags[cond.key] === cond.equals;
    case 'all':
      return cond.of.every((c) => evalCondition(state, c));
    case 'any':
      return cond.of.some((c) => evalCondition(state, c));
    case 'not':
      return !evalCondition(state, cond.cond);
  }
}

export function choiceAvailability(state: GameState, choice: Choice): { enabled: boolean; reason: string | null } {
  if (choice.requires && !evalCondition(state, choice.requires)) {
    return { enabled: false, reason: choice.lockedReason ?? '지금은 고를 수 없습니다.' };
  }
  return { enabled: true, reason: null };
}

export function resolveAmount(state: GameState, spec: AmountSpec): Won {
  if (typeof spec === 'number') return spec;
  switch (spec) {
    case 'investBalance':
      return state.accounts.invest.balance;
    case 'sneakerValue':
      return sneakerValue(state);
    case 'livingShortfall':
      return typeof state.flags.livingShortfall === 'number' ? state.flags.livingShortfall : 0;
  }
}

export interface FundingOption {
  source: FundingSource;
  /** 이 수단으로 낼 수 있는 최대 금액. 카드는 null (한도 없음으로 가정) */
  max: Won | null;
  /** 고르기 전에 보여 줄 경고 (예: 적금 해지) */
  warning: string | null;
}

/** 지불형 선택지의 지불 수단별 한도와 경고 */
export function fundingOptions(state: GameState, pay: PaySpec): FundingOption[] {
  return pay.sources.map((source) => {
    if (source === 'card') {
      return { source, max: null, warning: '카드값은 다음 달 월말에 생활비 통장에서 빠집니다. 할부는 수수료가 붙습니다.' };
    }
    const balance = state.accounts[source].balance;
    const due = source === 'living' ? monthEndDue(state).total : 0;
    const warning =
      source === 'living' && due > 0
        ? `월말에 이번 달 지출 ${formatMan(due)}이 빠져나갑니다. ${formatMan(livingSpare(state))}보다 많이 쓰면 모자란 만큼 카드값이 되고 만족도가 떨어집니다.`
        : source === 'savings'
        ? '적금에서 꺼내면 적금 전체가 해지되고 이자가 연 0.5%로 줄어듭니다.'
        : source === 'housing'
          ? '청약 통장을 해지하면 가입 기간이 0으로 초기화됩니다.'
          : source === 'invest'
            ? '그 달 평가금으로 팝니다. 떨어졌을 때 팔면 손실이 확정됩니다.'
            : null;
    return { source, max: balance, warning };
  });
}
