// 시뮬레이션 엔진. 상태 전이(step·canStep)와 기본값·자동 처리 함수(§4.3).
// 규칙의 근거: 기획서 5~6장, docs/core-api.md §4. 문서의 모호한 지점은 §4.5 '구현 결정'에 기록했다.
import { ACCOUNT_ORDER, EXPENSE_ORDER, TRANSFER_ORDER } from './data/accounts.ts';
import { ACHIEVEMENT_ORDER, ENDING_ORDER, ENDING_THRESHOLDS } from './data/achievements.ts';
import {
  BASE_SALARY,
  MARKET_RETURNS,
  RATES,
  SALARY_ROUND,
  SALARY_SPREAD,
  SETTLEMENT_MONTH,
  SNEAKER_PRICES,
  START_CREDIT,
  START_SATISFACTION,
} from './data/constants.ts';
import { EVENTS, SCHEDULE } from './data/events.ts';
import { STATUSES } from './data/statuses.ts';
import { BASE_EXPENSES, RECOMMENDED_TRANSFERS, SPENDING_TYPE_THRESHOLDS, SURVEY } from './data/survey.ts';
import {
  emergencyMonths,
  entrySceneId,
  evalCondition,
  eventForMonth,
  expenseTotal,
  getScene,
  isBudgetValid,
  netWorth,
  resolveAmount,
  savingsMaturity,
  sneakerValue,
  totalDebt,
  transferTotal,
} from './selectors.ts';
import type {
  AccountId,
  AccountState,
  AchievementId,
  Action,
  Budget,
  BudgetChange,
  CardMonths,
  Choice,
  DecisionRecord,
  Delta,
  DepositSpec,
  EndingId,
  EventId,
  ExpenseId,
  FundingSource,
  GameEvent,
  GameState,
  MonthNo,
  MonthRecord,
  Outcome,
  PaySpec,
  PaymentIssue,
  PaymentPlan,
  QuestionId,
  Scene,
  SceneRef,
  ScheduledScene,
  SpendingType,
  StatusId,
  StepErrorCode,
  SurveyResult,
  Won,
} from './types.ts';

/** step·canStep 구현 전 스텁이 던지던 예외. M1 이후 core 안에서는 쓰이지 않는다(호환용 보존). */
export class NotImplementedError extends Error {
  constructor(what: string) {
    super(`아직 구현하지 않음: ${what}`);
    this.name = 'NotImplementedError';
  }
}

const roundTo = (n: number, unit: number) => Math.round(n / unit) * unit;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

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

// ---------------------------------------------------------------------------
// 검증 (canStep) 과 전이 (step) — 같은 validate 경로를 공유한다 (§4.2)

interface Rejection {
  code: StepErrorCode;
  message: string;
}

/** 행동을 적용할 수 있는지 검사. canStep(메시지)와 step(StepError.code)가 같은 판정을 쓴다 */
function validate(state: GameState, action: Action): Rejection | null {
  if (action.type !== 'reset' && state.phase === 'result') {
    return { code: 'already-finished', message: '이미 1년을 마쳤습니다. 다시 하려면 reset을 쓰세요.' };
  }
  switch (action.type) {
    case 'start': {
      if (state.phase !== 'start') return { code: 'invalid-phase', message: '시작 화면에서만 시작할 수 있습니다.' };
      if (typeof action.nickname !== 'string' || action.nickname.length < 1 || action.nickname.length > 10)
        return { code: 'invalid-phase', message: '닉네임은 1~10자여야 합니다.' };
      if (!Number.isInteger(action.salary) || action.salary <= 0)
        return { code: 'invalid-phase', message: '월급은 0보다 큰 정수여야 합니다.' };
      return null;
    }
    case 'submitSurvey': {
      if (state.phase !== 'survey') return { code: 'invalid-phase', message: '설문 단계에서만 설문을 제출할 수 있습니다.' };
      for (const q of SURVEY) {
        const a = action.answers[q.id];
        if (typeof a !== 'string' || !q.options.some((o) => o.id === a)) {
          return { code: 'invalid-phase', message: `${q.id} 문항의 답이 유효하지 않습니다.` };
        }
      }
      return null;
    }
    case 'goto': {
      if (state.phase !== 'guide' || action.phase !== 'budget')
        return { code: 'invalid-phase', message: '안내 단계에서만 가계부 작성으로 넘어갈 수 있습니다.' };
      return null;
    }
    case 'setBudget': {
      const inWrite = state.phase === 'budget';
      const inAdjust = state.phase === 'sim' && state.step === 'adjust';
      if (!inWrite && !inAdjust) return { code: 'invalid-phase', message: '가계부 작성·조정 단계에서만 가계부를 바꿀 수 있습니다.' };
      const b = action.budget;
      if (!b || typeof b !== 'object' || !b.transfers || !b.expenses || typeof b.livingBuffer !== 'number')
        return { code: 'budget-invalid', message: '가계부 형식이 올바르지 않습니다.' };
      for (const id of TRANSFER_ORDER)
        if (typeof b.transfers[id] !== 'number' || b.transfers[id] < 0)
          return { code: 'budget-invalid', message: '자동이체 금액은 0 이상이어야 합니다.' };
      for (const id of EXPENSE_ORDER)
        if (typeof b.expenses[id] !== 'number' || b.expenses[id] < 0)
          return { code: 'budget-invalid', message: '지출 예산은 0 이상이어야 합니다.' };
      if (b.livingBuffer < 0) return { code: 'budget-invalid', message: '생활비 여유분은 0 이상이어야 합니다.' };
      return null;
    }
    case 'confirmBudget': {
      if (state.phase !== 'budget') return { code: 'invalid-phase', message: '가계부 작성 단계에서만 확정할 수 있습니다.' };
      if (!isBudgetValid(state.budget, state.profile.salary))
        return { code: 'budget-invalid', message: '가계부 합계가 월급과 같지 않거나 음수 항목이 있습니다.' };
      return null;
    }
    case 'beginMonth': {
      if (state.phase !== 'sim') return { code: 'invalid-phase', message: '시뮬레이션 중에만 쓸 수 있습니다.' };
      if (state.step !== 'payday')
        return { code: 'invalid-step', message: '월급날 단계에서만 한 달을 시작할 수 있습니다.' };
      return null;
    }
    case 'choose': {
      if (state.phase !== 'sim') return { code: 'invalid-phase', message: '시뮬레이션 중에만 선택할 수 있습니다.' };
      if (state.step !== 'scene' || !state.current)
        return { code: 'invalid-step', message: '장면이 열려 있을 때만 선택할 수 있습니다.' };
      const { scene } = getScene(state.current);
      const choice = scene.choices.find((c) => c.id === action.choiceId);
      if (!choice) return { code: 'unknown-choice', message: `선택지가 없습니다: ${action.choiceId}` };
      if (choice.requires && !evalCondition(state, choice.requires))
        return { code: 'choice-locked', message: choice.lockedReason ?? '지금은 고를 수 없습니다.' };
      if (choice.pay) {
        const pay = choice.pay;
        const plan = action.payment;
        if (!plan || !Array.isArray(plan.parts))
          return { code: 'payment-invalid', message: '지불 계획이 필요합니다.' };
        if (pay.adjustable) {
          const amount = action.amount;
          if (typeof amount !== 'number' || !Number.isInteger(amount))
            return { code: 'payment-invalid', message: '금액을 정해야 합니다.' };
          const { min, max, step } = pay.adjustable;
          if (amount < min || amount > max || (amount - min) % step !== 0)
            return { code: 'payment-invalid', message: `금액은 ${min}원부터 ${step}원 단위로 ${max}원까지 고를 수 있습니다.` };
          const planTotal = sum(plan.parts.map((p) => p.amount)) + (plan.card?.amount ?? 0);
          if (planTotal !== amount)
            return { code: 'payment-invalid', message: '지불 계획 합계가 고른 금액과 같지 않습니다.' };
        }
        const v = validatePayment(state, pay, plan);
        if (!v.ok) return { code: 'payment-invalid', message: v.issue.detail };
      }
      if (choice.fixedPay && choice.fixedPay.source !== 'card') {
        const fp = choice.fixedPay;
        const src = fp.source as AccountId;
        if (state.accounts[src].balance < fp.amount)
          return { code: 'payment-invalid', message: `${src} 계좌 잔고가 부족합니다.` };
      }
      if (choice.deposit) {
        if (!action.depositTo || !choice.deposit.targets.includes(action.depositTo))
          return { code: 'payment-invalid', message: '입금 계좌를 골라야 합니다.' };
      }
      return null;
    }
    case 'continue': {
      if (state.phase !== 'sim') return { code: 'invalid-phase', message: '시뮬레이션 중에만 쓸 수 있습니다.' };
      if (state.step !== 'outcome' || !state.lastOutcome)
        return { code: 'invalid-step', message: '선택 결과를 본 뒤에만 계속할 수 있습니다.' };
      return null;
    }
    case 'statusAction': {
      if (state.phase !== 'sim') return { code: 'invalid-phase', message: '시뮬레이션 중에만 쓸 수 있습니다.' };
      if (!state.statuses.some((x) => x.id === action.status))
        return { code: 'invalid-step', message: `보유하지 않은 상태입니다: ${action.status}` };
      const def = STATUSES[action.status];
      if (!def.actions?.some((a) => a.id === action.action))
        return { code: 'invalid-step', message: `상태 ${action.status}에 정의되지 않은 행동입니다: ${action.action}` };
      if (action.action === 'sellSneakers' && (!action.depositTo || !ACCOUNT_ORDER.includes(action.depositTo)))
        return { code: 'payment-invalid', message: '입금 계좌를 골라야 합니다.' };
      return null;
    }
    case 'endMonth': {
      if (state.phase !== 'sim') return { code: 'invalid-phase', message: '시뮬레이션 중에만 쓸 수 있습니다.' };
      if (state.step !== 'report') return { code: 'invalid-step', message: '월말 리포트 단계에서만 달을 마칠 수 있습니다.' };
      if (state.month >= SETTLEMENT_MONTH)
        return { code: 'invalid-step', message: '12월에는 endMonth 대신 결산이 진행됩니다.' };
      return null;
    }
    case 'reset':
      return null;
  }
}

/** 상태 전이. React useReducer에 그대로 연결한다. 순수·결정적이고 원본을 고치지 않는다. */
export function step(state: GameState, action: Action): GameState {
  const rejection = validate(state, action);
  if (rejection) throw new StepError(rejection.code, rejection.message);
  return applyAction(clone(state), action);
}

/** 행동을 적용할 수 있는지 미리 검사. 실패 이유 문구를 돌려준다. 서버의 allowed 검사가 쓴다. */
export function canStep(state: GameState, action: Action): true | string {
  const rejection = validate(state, action);
  return rejection ? rejection.message : true;
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

// ---------------------------------------------------------------------------
// 상태 전이 본체 (복제된 상태를 고친다)

function applyAction(s: GameState, action: Action): GameState {
  switch (action.type) {
    case 'reset':
      return createInitialState('', 0);
    case 'start':
      s.profile.nickname = action.nickname;
      s.profile.salary = action.salary;
      s.phase = 'survey';
      return s;
    case 'submitSurvey':
      s.survey.answers = { ...action.answers };
      s.survey.result = recommendBudget(action.answers, s.profile.salary);
      s.budget = clone(s.survey.result.recommended);
      s.phase = 'guide';
      return s;
    case 'goto':
      s.phase = 'budget';
      return s;
    case 'setBudget': {
      const wasAdjust = s.phase === 'sim' && s.step === 'adjust';
      s.budget = clone(action.budget);
      if (wasAdjust) {
        s.budgetEdits += 1;
        // 조정 단계에서 합계가 맞으면 조정 완료 — 별도 continue가 없다 (§4.2)
        if (isBudgetValid(s.budget, s.profile.salary)) s.step = 'report';
      }
      checkAchievements(s);
      return s;
    }
    case 'confirmBudget':
      s.initialBudget = clone(s.budget);
      s.phase = 'sim';
      s.month = 1;
      s.step = 'payday';
      return s;
    case 'beginMonth':
      return beginMonth(s);
    case 'choose':
      return choose(s, action);
    case 'continue': {
      const o = s.lastOutcome;
      if (o && o.next) {
        s.current = o.next;
        s.step = 'scene';
      } else if (o && o.budgetReason) {
        s.step = 'adjust';
      } else if (s.queue.length > 0) {
        // 이어지는 장면이 없어도 이번 달 queue에 남은 장면(예약 후속 → 배치 이벤트)이 있으면 그 장면으로 (§4.5)
        s.current = s.queue.shift() ?? null;
        s.step = 'scene';
      } else {
        s.current = null;
        s.step = 'report';
      }
      return s;
    }
    case 'statusAction':
      return statusAction(s, action);
    case 'endMonth': {
      s.history.push(monthRecord(s));
      s.month += 1;
      s.step = 'payday';
      s.payday = null;
      s.current = null;
      s.queue = [];
      s.lastOutcome = null;
      return s;
    }
  }
}

function monthRecord(s: GameState): MonthRecord {
  const eventIds = s.decisions
    .filter((d) => d.month === s.month && d.eventId !== '')
    .map((d) => d.eventId)
    .filter((id): id is EventId => id !== '');
  return {
    month: s.month,
    netWorth: netWorth(s),
    balances: Object.fromEntries(ACCOUNT_ORDER.map((id) => [id, s.accounts[id].balance])) as Record<AccountId, Won>,
    debt: totalDebt(s),
    satisfaction: s.satisfaction,
    credit: s.credit,
    eventIds: [...new Set(eventIds)],
  };
}

// ---------------------------------------------------------------------------
// 월급날 처리 (기획서 5.1~5.3, §4.2의 순서)

function runPayday(s: GameState) {
  const m = s.month;
  const b = s.budget;
  const salary = s.profile.salary;

  // 1. 월급 입금(생활비 통장)
  s.accounts.living.balance += salary;
  s.accounts.living.contributed += salary;

  // 2. 자동이체 (적금은 납입 횟수 +1, 해지된 적금이면 새 적금 원금)
  const transfers = { ...b.transfers };
  for (const id of TRANSFER_ORDER) {
    const t = b.transfers[id];
    s.accounts.living.balance -= t;
    s.accounts[id].balance += t;
    s.accounts[id].contributed += t;
  }
  if (s.savings.broken) s.savings.restartedPrincipal += b.transfers.savings;
  else s.savings.paidMonths += 1;

  // 선저축 1년 플래그: 이번 달 자동이체로만 판정 (12회 모두 통과해야 한다)
  const saveInvest = b.transfers.savings + b.transfers.invest + b.transfers.housing;
  if (saveInvest >= 0.2 * salary) {
    if (s.flags.paySelfFirstOk !== false) s.flags.paySelfFirstOk = true;
  } else {
    s.flags.paySelfFirstOk = false;
  }

  // 3. 부채 상환 (이번 달에 만든 부채는 다음 달부터 갚는다, §4.5)
  let debtPayments = 0;
  for (const d of s.debts) {
    if (d.startedMonth >= m || d.monthsLeft <= 0) continue;
    const interest = Math.round((d.remaining * d.annualRate) / 12);
    const pay = Math.min(d.monthly, d.remaining + interest);
    d.remaining = d.remaining + interest - pay;
    d.monthsLeft -= 1;
    debtPayments += pay;
  }
  s.debts = s.debts.filter((d) => d.remaining > 0);

  // 4. 지출 (예산 + 물가 상승분 foodOverspend 플래그)
  const overspend = typeof s.flags.foodOverspend === 'number' ? Math.round(b.expenses.food * s.flags.foodOverspend) : 0;
  const spending = expenseTotal(b) + overspend;
  s.accounts.living.balance -= spending + debtPayments;

  // 5. 생활비 부족분: 카드값으로 넘어간다고 기록(플래그). 자동 부채는 만들지 않는다 (§4.5)
  let shortfall = 0;
  if (s.accounts.living.balance < 0) {
    shortfall = -s.accounts.living.balance;
    s.accounts.living.balance = 0;
    s.satisfaction = clamp(s.satisfaction - 5, 0, 100);
  }
  s.flags.livingShort = shortfall > 0;
  s.flags.livingShortfall = shortfall;

  // 6. 이자·투자 수익
  const earnings: Partial<Record<AccountId, Won>> = {};
  for (const id of ['emergency', 'goal', 'housing'] as const) {
    const e = Math.round((s.accounts[id].balance * RATES[id]) / 12);
    s.accounts[id].balance += e;
    s.accounts[id].earned += e;
    earnings[id] = e;
  }
  const investReturnPct = MARKET_RETURNS[m] ?? 0;
  const gain = Math.round(s.accounts.invest.balance * investReturnPct);
  s.accounts.invest.balance += gain;
  s.accounts.invest.earned += gain;
  earnings.invest = gain;

  // 7. 상태 효과 (이번 달에 생긴 상태는 다음 달부터, 만료 달 지나면 제거)
  const statusEffects: { status: StatusId; satisfaction: number }[] = [];
  for (const st of s.statuses) {
    const delta = STATUSES[st.id].monthly?.satisfaction;
    if (delta && st.since < m) {
      s.satisfaction = clamp(s.satisfaction + delta, 0, 100);
      statusEffects.push({ status: st.id, satisfaction: delta });
    }
    if (st.id === 'sneakers') st.note = `현재 시세 ${(SNEAKER_PRICES[m] ?? 0) / 10_000}만 원`;
  }
  s.statuses = s.statuses.filter((st) => st.until === null || st.until > m);

  s.payday = {
    month: m,
    salary,
    transfers,
    livingIn: expenseTotal(b) + b.livingBuffer,
    spending,
    debtPayments,
    earnings,
    investReturnPct,
    statusEffects,
    livingShortfall: shortfall,
  };
}

function beginMonth(s: GameState): GameState {
  runPayday(s);
  checkAchievements(s);
  if (s.month === SETTLEMENT_MONTH) {
    settle(s);
    return s;
  }
  // 예약 장면(when 판정) → 배치 이벤트 순서로 queue를 채운다
  const queue: SceneRef[] = [];
  const remaining: ScheduledScene[] = [];
  for (const sc of s.scheduled) {
    if (sc.month !== s.month) {
      remaining.push(sc);
      continue;
    }
    if (sc.when && !evalCondition(s, sc.when)) continue; // 조건이 맞지 않으면 그냥 사라진다 (§4.5)
    queue.push({ eventId: sc.eventId, sceneId: sc.sceneId });
  }
  s.scheduled = remaining;
  const event = eventForMonth(s.month);
  if (event) queue.push({ eventId: event.id, sceneId: entrySceneId(s, event) });
  s.queue = queue;
  s.current = queue.length > 0 ? (queue.shift() as SceneRef) : null;
  s.step = s.current ? 'scene' : 'report';
  return s;
}

// ---------------------------------------------------------------------------
// 12월 결산

function settle(s: GameState) {
  const unlock = (id: AchievementId) => {
    if (!s.unlocked.includes(id)) s.unlocked.push(id);
  };
  // 적금 만기 (세후 이자만 잔고에 더한다. 원금은 매달 이체로 이미 들어 있다)
  const maturity = savingsMaturity(s.budget.transfers.savings, s.savings.paidMonths, s.savings.broken);
  s.accounts.savings.balance += maturity.interestNet;
  s.accounts.savings.earned += maturity.interestNet;

  // 결산 시점에 확정되는 도전과제
  if (s.flags.paySelfFirstOk === true) unlock('paySelfFirst');
  if (s.flags.usedInstallment !== true) unlock('noInstallment');
  if (!s.savings.broken) unlock('savingsComplete');
  if (s.satisfaction >= 80) unlock('happyHeart');
  if (s.flags.soldInvestEver !== true && s.accounts.invest.balance > 0) unlock('steadyInvestor');
  checkAchievements(s);

  s.history.push(monthRecord(s));

  const debt = totalDebt(s);
  const nw = netWorth(s);
  const salary = s.profile.salary;
  const t = ENDING_THRESHOLDS;
  let ending: EndingId = 'ordinary';
  for (const id of ENDING_ORDER) {
    const hit =
      id === 'debt'
        ? debt > 0
        : id === 'frugal'
          ? nw >= salary * t.frugalNetWorthX && s.satisfaction < t.frugalSatisfactionBelow
          : id === 'yolo'
            ? s.satisfaction >= t.yoloSatisfactionMin && emergencyMonths(s) < t.yoloEmergencyMonthsBelow
            : id === 'balanced'
              ? nw >= salary * t.balancedNetWorthX && s.satisfaction >= t.balancedSatisfactionMin
              : true;
    if (hit) {
      ending = id;
      break;
    }
  }

  const budgetDiff: NonNullable<GameState['settlement']>['budgetDiff'] = [];
  const init = s.initialBudget;
  if (init) {
    for (const id of TRANSFER_ORDER)
      if (init.transfers[id] !== s.budget.transfers[id])
        budgetDiff.push({ key: id, before: init.transfers[id], after: s.budget.transfers[id] });
    for (const id of EXPENSE_ORDER)
      if (init.expenses[id] !== s.budget.expenses[id])
        budgetDiff.push({ key: id, before: init.expenses[id], after: s.budget.expenses[id] });
    if (init.livingBuffer !== s.budget.livingBuffer)
      budgetDiff.push({ key: 'livingBuffer', before: init.livingBuffer, after: s.budget.livingBuffer });
  }

  s.settlement = {
    maturity,
    finalBalances: Object.fromEntries(ACCOUNT_ORDER.map((id) => [id, s.accounts[id].balance])) as Record<AccountId, Won>,
    netWorth: nw,
    debt,
    ending,
    achievements: ACHIEVEMENT_ORDER.map((id) => ({ id, unlocked: s.unlocked.includes(id) })),
    budgetDiff,
  };
  s.phase = 'result';
  s.step = 'report';
  s.current = null;
  s.queue = [];
  s.lastOutcome = null;
}

// ---------------------------------------------------------------------------
// 도전과제 (기획서 5.4). 즉시 판정 가능한 것만 여기서, 결산 확정은 settle에서

function checkAchievements(s: GameState) {
  const unlock = (id: AchievementId) => {
    if (!s.unlocked.includes(id)) s.unlocked.push(id);
  };
  if (s.budgetEdits >= 3) unlock('budgetRemodel');
  const exp = expenseTotal(s.budget);
  if (exp > 0 && s.accounts.emergency.balance >= 3 * exp) unlock('emergency3');
  const refillTarget = s.flags.emergencyRefillTarget;
  if (typeof refillTarget === 'number' && refillTarget > 0 && s.accounts.emergency.balance >= refillTarget) {
    unlock('emergencyRefill');
    s.flags.emergencyRefillTarget = 0;
  }
  if (s.decisions.some((d) => d.tags.includes('negotiated'))) unlock('negotiator');
  const fraudEvents: EventId[] = ['laptop-spill', 'family-month', 'coin-room'];
  if (
    fraudEvents.every((fe) => s.decisions.some((d) => d.eventId === fe)) &&
    !s.decisions.some((d) => d.tags.includes('fraudHit'))
  ) {
    unlock('fraudDetector');
  }
  if (
    s.decisions.some((d) => d.eventId === 'scratch-lottery') &&
    !s.decisions.some((d) => d.tags.includes('lotteryAgain'))
  ) {
    unlock('expectedValue');
  }
}

// ---------------------------------------------------------------------------
// 선택 (choose) 과 상태 행동 (statusAction)

function setRefillTarget(s: GameState, balanceBefore: Won) {
  const prev = typeof s.flags.emergencyRefillTarget === 'number' ? s.flags.emergencyRefillTarget : 0;
  s.flags.emergencyRefillTarget = Math.max(prev, balanceBefore);
}

function withdrawFrom(s: GameState, source: AccountId, amount: Won): Delta {
  const before = s.accounts[source].balance;
  s.accounts[source].balance = Math.max(0, before - amount);
  if (source === 'emergency' && amount > 0) setRefillTarget(s, before);
  if (source === 'invest' && amount > 0) s.flags.soldInvestEver = true;
  if (source === 'savings' && amount > 0 && !s.savings.broken) {
    s.savings.broken = true;
    s.savings.brokenMonth = s.month;
  }
  return { kind: 'account', account: source, amount: -Math.min(before, amount) };
}

/** pay 선택지에서 카드로 낸 몫의 부채 이름 — 선택지 문구만 쓰면 결과 화면에서 즉시 청구로 읽힌다 (§4.5) */
function cardDebtLabel(months: CardMonths, choiceLabel: string): string {
  return months === 1 ? `카드 일시불 — ${choiceLabel}` : `카드 ${months}개월 할부 — ${choiceLabel}`;
}

function addCardDebt(
  s: GameState,
  eventId: EventId,
  choiceId: string,
  amount: Won,
  months: CardMonths,
  interestFree: boolean,
  label: string,
): Delta {
  const rate = interestFree || months === 1 ? 0 : RATES.installmentApr;
  s.debts.push({
    id: `${eventId}-${s.month}-${choiceId}`,
    label,
    kind: months === 1 ? 'cardBill' : 'installment',
    principal: amount,
    remaining: amount,
    monthly: Math.round((amount * (1 + (rate * months) / 12)) / months),
    monthsLeft: months,
    annualRate: rate,
    startedMonth: s.month,
    sourceEventId: eventId,
  });
  if (months > 1) s.flags.usedInstallment = true;
  return { kind: 'debt', amount, label };
}

function applyEffects(s: GameState, effects: NonNullable<Choice['effects']>, deltas: Delta[]): string | null {
  let budgetReason: string | null = null;
  for (const e of effects) {
    switch (e.kind) {
      case 'satisfaction':
        s.satisfaction = clamp(s.satisfaction + e.delta, 0, 100);
        deltas.push({ kind: 'satisfaction', amount: e.delta });
        break;
      case 'credit':
        s.credit = clamp(s.credit + e.delta, 0, 1000);
        deltas.push({ kind: 'credit', amount: e.delta });
        break;
      case 'money': {
        if (e.delta >= 0) {
          s.accounts[e.account].balance += e.delta;
          s.accounts[e.account].contributed += e.delta;
          deltas.push({ kind: 'account', account: e.account, amount: e.delta });
        } else {
          deltas.push(withdrawFrom(s, e.account, -e.delta));
        }
        break;
      }
      case 'budget': {
        const before = s.budget.expenses[e.expense];
        s.budget.expenses[e.expense] = before + e.delta;
        deltas.push({ kind: 'budget', key: e.expense, amount: e.delta });
        break;
      }
      case 'budgetPct': {
        const before = s.budget.expenses[e.expense];
        const after = Math.round(before * (1 + e.pct));
        s.budget.expenses[e.expense] = after;
        deltas.push({ kind: 'budget', key: e.expense, amount: after - before });
        break;
      }
      case 'addStatus': {
        const ex = s.statuses.find((x) => x.id === e.status);
        if (ex) {
          if (e.count) ex.count = (ex.count ?? 1) + e.count;
          if (e.months) ex.until = s.month + e.months;
        } else {
          s.statuses.push({ id: e.status, since: s.month, until: e.months ? s.month + e.months : null, count: e.count });
        }
        deltas.push({ kind: 'status', status: e.status, change: 'add' });
        break;
      }
      case 'removeStatus':
        s.statuses = s.statuses.filter((x) => x.id !== e.status);
        deltas.push({ kind: 'status', status: e.status, change: 'remove' });
        break;
      case 'flag':
        s.flags[e.key] = e.value;
        // 물가 상승 플래그: "이번 달 식비도 이미 8% 더 나왔다"를 즉시 반영한다 (§4.5).
        // 이후 매달 월급날 지출에도 같은 비율이 붙는다.
        if (e.key === 'foodOverspend' && typeof e.value === 'number' && e.value > 0) {
          const overspendNow = Math.round(s.budget.expenses.food * e.value);
          const before = s.accounts.living.balance;
          s.accounts.living.balance = Math.max(0, before - overspendNow);
          deltas.push({ kind: 'account', account: 'living', amount: s.accounts.living.balance - before });
          if (before < overspendNow) {
            s.flags.livingShort = true;
            s.flags.livingShortfall = overspendNow - before;
            s.satisfaction = clamp(s.satisfaction - 5, 0, 100);
          }
        }
        break;
      case 'sellAllInvest':
        s.flags.soldInvestEver = true;
        s.accounts.invest.balance = 0;
        break;
      case 'breakSavings':
        if (!s.savings.broken) {
          s.savings.broken = true;
          s.savings.brokenMonth = s.month;
        }
        break;
      case 'startRevolving': {
        const amount = resolveAmount(s, e.amount);
        if (amount > 0) {
          s.debts.push({
            id: `revolving-${s.month}`,
            label: '리볼빙 (일부결제금액 이월약정)',
            kind: 'revolving',
            principal: amount,
            remaining: amount,
            monthly: Math.round(amount * 0.1),
            monthsLeft: 99,
            annualRate: RATES.revolvingApr,
            startedMonth: s.month,
          });
          s.flags.usedInstallment = true;
          deltas.push({ kind: 'debt', amount, label: '리볼빙 (일부결제금액 이월약정)' });
        }
        if (!s.statuses.some((x) => x.id === 'revolving')) {
          s.statuses.push({ id: 'revolving', since: s.month, until: null });
          deltas.push({ kind: 'status', status: 'revolving', change: 'add' });
        }
        break;
      }
      case 'openBudget':
        budgetReason = e.reason;
        break;
    }
  }
  return budgetReason;
}

function choose(s: GameState, action: Extract<Action, { type: 'choose' }>): GameState {
  const ref = s.current as SceneRef;
  const { event, scene } = getScene(ref);
  const choice = scene.choices.find((c) => c.id === action.choiceId) as Choice;
  const deltas: Delta[] = [];
  let payment: PaymentPlan | undefined;

  // 1. 지불 (pay: 계좌 나눠 내기 + 카드, fixedPay: 정해진 방식)
  if (choice.pay) {
    const pay = choice.pay;
    const plan = action.payment as PaymentPlan;
    const amount = pay.adjustable ? (action.amount as Won) : resolveAmount(s, pay.amount);
    for (const p of plan.parts) {
      if (p.amount > 0) deltas.push(withdrawFrom(s, p.source, p.amount));
    }
    if (plan.card) {
      deltas.push(
        addCardDebt(
          s,
          event.id,
          choice.id,
          plan.card.amount,
          plan.card.months,
          pay.interestFree ?? false,
          cardDebtLabel(plan.card.months, choice.label),
        ),
      );
    }
    if (pay.to) {
      s.accounts[pay.to].balance += amount;
      s.accounts[pay.to].contributed += amount;
      deltas.push({ kind: 'account', account: pay.to, amount });
    }
    if (pay.goalBonus && plan.parts.some((p) => p.source === 'goal' && p.amount > 0)) {
      s.satisfaction = clamp(s.satisfaction + pay.goalBonus, 0, 100);
      deltas.push({ kind: 'satisfaction', amount: pay.goalBonus });
      // 목표 통장으로 계획한 소비 (도전과제 '계획된 행복', §4.5)
      if (!s.unlocked.includes('plannedJoy')) {
        const joys = s.decisions.filter((d) => d.tags.includes('plannedJoy')).length + 1;
        if (joys >= 2) s.unlocked.push('plannedJoy');
      }
    }
    payment = plan;
  }
  if (choice.fixedPay) {
    const fp = choice.fixedPay;
    if (fp.source === 'card') {
      deltas.push(
        addCardDebt(s, event.id, choice.id, fp.amount, (fp.cardMonths ?? 1) as CardMonths, fp.interestFree ?? false, fp.label),
      );
      payment = { parts: [], card: { amount: fp.amount, months: (fp.cardMonths ?? 1) as CardMonths } };
    } else {
      deltas.push(withdrawFrom(s, fp.source, fp.amount));
      payment = { parts: [{ source: fp.source, amount: fp.amount }] };
    }
  }

  // 2. 입금 (deposit)
  if (choice.deposit) {
    const amount = resolveAmount(s, choice.deposit.amount);
    const to = action.depositTo as AccountId;
    s.accounts[to].balance += amount;
    s.accounts[to].contributed += amount;
    deltas.push({ kind: 'account', account: to, amount });
    // 운동화 판매: 산 가격(발매가)보다 비싸게 팔았는지 (도전과제 '리셀 탈출')
    if (choice.deposit.amount === 'sneakerValue') {
      const st = s.statuses.find((x) => x.id === 'sneakers');
      const purchase = (st?.count ?? 1) * (SNEAKER_PRICES[3] ?? 300_000);
      if (amount > purchase && !s.unlocked.includes('resellEscape')) s.unlocked.push('resellEscape');
    }
  }

  // 3. 선택 효과
  const budgetReason = applyEffects(s, choice.effects ?? [], deltas);

  // 4. 선택 기록
  s.decisions.push({
    month: s.month,
    eventId: event.id,
    eventCode: event.code,
    sceneId: scene.id,
    choiceId: choice.id,
    choiceLabel: choice.label,
    kind: choice.kind,
    payment,
    tags: choice.tags ?? [],
    auto: action.auto,
  });

  // 5. 결과 (같은 달 연쇄는 lastOutcome.next로, 예약은 scheduled로)
  let next: SceneRef | null = null;
  let scheduled: ScheduledScene | null = null;
  if (choice.next) {
    if (choice.next.delayMonths) {
      scheduled = {
        eventId: event.id,
        sceneId: choice.next.scene,
        month: s.month + choice.next.delayMonths,
        when: choice.next.when,
        reason: sceneTitle(event, choice.next.scene),
      };
      s.scheduled.push(scheduled);
    } else {
      next = { eventId: event.id, sceneId: choice.next.scene };
    }
  }
  const outcome: Outcome = {
    ref,
    choiceId: choice.id,
    feedback: choice.feedback,
    deltas,
    next,
    scheduled,
    lesson: choice.next ? null : event.lesson,
    budgetReason,
  };
  s.lastOutcome = outcome;
  s.step = 'outcome';
  checkAchievements(s);
  return s;
}

function sceneTitle(event: GameEvent, sceneId: string): string {
  const scene = event.scenes[sceneId];
  return scene?.title ?? event.title;
}

function statusAction(s: GameState, action: Extract<Action, { type: 'statusAction' }>): GameState {
  const def = STATUSES[action.status];
  const act = def.actions?.find((a) => a.id === action.action);
  if (!act) return s; // validate를 통과했으면 없을 수 없다
  if (action.status === 'sneakers' && action.action === 'sellSneakers') {
    const st = s.statuses.find((x) => x.id === 'sneakers');
    const amount = sneakerValue(s);
    const to = action.depositTo as AccountId;
    s.accounts[to].balance += amount;
    s.accounts[to].contributed += amount;
    s.statuses = s.statuses.filter((x) => x.id !== 'sneakers');
    const current = s.current;
    const eventCode = current ? EVENTS[current.eventId].code : '';
    s.decisions.push({
      month: s.month,
      eventId: current ? current.eventId : '',
      eventCode,
      sceneId: current ? current.sceneId : `status:${action.status}`,
      choiceId: act.id,
      choiceLabel: act.label,
      kind: 'free',
      payment: { parts: [{ source: to, amount }] },
      tags: ['resellProfit'],
    });
    const purchase = (st?.count ?? 1) * (SNEAKER_PRICES[3] ?? 300_000);
    if (amount > purchase && !s.unlocked.includes('resellEscape')) s.unlocked.push('resellEscape');
  }
  checkAchievements(s);
  return s;
}

// ---------------------------------------------------------------------------
// 기본값·자동 처리 함수 (§4.3)

/** 합계 맞추기. 남는 돈은 생활비 여유분에 넣고, 모자라면 여유분에서 뺀다.
 *  여유분이 0이 되어도 모자라면 변동비를 여가 → 의류·미용 → 생활용품 → 경조사 → 식비 순서로 줄인다.
 *  고정비는 절대 건드리지 않는다(변동비를 다 줄여도 모자라는 극단적인 경우만 자동이체에서 충당, §4.5).
 *  결과는 항상 isBudgetValid를 통과한다. changes는 학생 안내 문구용. */
const BALANCE_CUT_ORDER: ExpenseId[] = ['leisure', 'beauty', 'household', 'family', 'food'];

export function balanceBudget(budget: Budget, salary: Won): { budget: Budget; changes: BudgetChange[] } {
  const b = clone(budget);
  const changes: BudgetChange[] = [];
  const track = (key: BudgetChange['key'], before: Won, after: Won) => {
    if (before !== after) changes.push({ key, before, after });
  };
  const allocated = transferTotal(b) + expenseTotal(b) + b.livingBuffer;
  const diff = salary - allocated; // 양수면 남는 돈, 음수면 모자람
  if (diff > 0) {
    const before = b.livingBuffer;
    b.livingBuffer += diff;
    track('livingBuffer', before, b.livingBuffer);
  } else if (diff < 0) {
    let need = -diff;
    const bufBefore = b.livingBuffer;
    const bufCut = Math.min(b.livingBuffer, need);
    b.livingBuffer -= bufCut;
    need -= bufCut;
    track('livingBuffer', bufBefore, b.livingBuffer);
    for (const id of BALANCE_CUT_ORDER) {
      if (need <= 0) break;
      const before = b.expenses[id];
      const cut = Math.min(before, need);
      b.expenses[id] = before - cut;
      need -= cut;
      track(id, before, b.expenses[id]);
    }
    // 데이터상 일어나지 않는 극단적인 경우: 고정비는 그대로 두고 자동이체에서 충당해 합계를 맞춘다
    for (const id of [...TRANSFER_ORDER].reverse()) {
      if (need <= 0) break;
      const before = b.transfers[id];
      const cut = Math.min(before, need);
      b.transfers[id] = before - cut;
      need -= cut;
      track(id, before, b.transfers[id]);
    }
  }
  return { budget: b, changes };
}

/** 답하지 않은 문항만 중간 답으로 채운다. 중간 답 = 보기 n개 중 floor((n-1)/2)번째(데이터 순서).
 *  이미 답한 문항은 그대로 둔다. */
export function defaultAnswers(answers: Partial<Record<QuestionId, string>>): Record<QuestionId, string> {
  const out: Partial<Record<QuestionId, string>> = { ...answers };
  for (const q of SURVEY) {
    if (out[q.id] === undefined) {
      const mid = Math.floor((q.options.length - 1) / 2);
      out[q.id] = q.options[mid]?.id;
    }
  }
  return out as Record<QuestionId, string>;
}

/** 장면의 기본 선택지(fallback: true). 정확히 하나 있어야 한다(테스트 §4.4). */
export function fallbackChoice(scene: Scene): Choice {
  const list = scene.choices.filter((c) => c.fallback === true);
  if (list.length !== 1) {
    throw new Error(`장면 '${scene.id}'의 기본 선택지가 ${list.length}개입니다. 정확히 하나여야 합니다.`);
  }
  return list[0] as Choice;
}

/** 자동 지불 계획이 쓰는 수단 우선순위 (§4.3) */
const AUTO_SOURCE_ORDER: AccountId[] = ['living', 'emergency', 'goal', 'invest', 'savings', 'housing'];

/** 자동 지불 계획: 허용된 수단 중 생활비 → 비상금 → 목표 → 투자 → 적금 → 청약 순서로
 *  잔고만큼, 남으면 카드 일시불(cardMonths에 1이 있을 때, 없으면 가장 짧은 허용 개월).
 *  adjustable이면 금액 = 최솟값. 카드도 허용되지 않아 남는 금액은 shortfall로 돌려준다. */
export function autoPaymentPlan(state: GameState, pay: PaySpec): { plan: PaymentPlan; shortfall: Won } {
  const amount = pay.adjustable ? pay.adjustable.min : resolveAmount(state, pay.amount);
  const parts: { source: AccountId; amount: Won }[] = [];
  let left = amount;
  for (const src of AUTO_SOURCE_ORDER) {
    if (left <= 0) break;
    if (!pay.sources.includes(src)) continue;
    const balance = state.accounts[src].balance;
    if (balance <= 0) continue;
    const take = Math.min(balance, left);
    parts.push({ source: src, amount: take });
    left -= take;
  }
  const plan: PaymentPlan = { parts };
  if (left > 0 && pay.sources.includes('card')) {
    const allowed = pay.cardMonths ?? [1];
    const months = (allowed.includes(1) ? 1 : Math.min(...allowed)) as CardMonths;
    plan.card = { amount: left, months };
    left = 0;
  }
  return { plan, shortfall: left };
}

/** 자동 입금 계좌: 데이터의 첫 번째 입금 계좌 */
export function autoDepositTarget(deposit: DepositSpec): AccountId {
  const first = deposit.targets[0];
  if (!first) throw new Error('입금 대상 계좌가 없습니다.');
  return first;
}

/** 지불 계획 검증. 지불 패널과 서버가 같은 규칙을 쓴다 (DESIGN.md 7장 4번 제안) */
export function validatePayment(
  state: GameState,
  pay: PaySpec,
  plan: PaymentPlan,
): { ok: true } | { ok: false; issue: PaymentIssue } {
  const parts = Array.isArray(plan.parts) ? plan.parts : [];
  for (const p of parts) {
    if (!Number.isFinite(p.amount) || p.amount <= 0)
      return { ok: false, issue: { kind: 'negative-part', detail: `${p.source}의 금액이 0 이하입니다.` } };
    if (!pay.sources.includes(p.source as FundingSource))
      return { ok: false, issue: { kind: 'source-not-allowed', detail: `${p.source}는 이 선택지에서 쓸 수 없는 수단입니다.` } };
    if (p.amount > state.accounts[p.source].balance)
      return { ok: false, issue: { kind: 'over-balance', detail: `${p.source}의 잔고가 부족합니다.` } };
  }
  let total = sum(parts.map((p) => p.amount));
  if (plan.card) {
    if (!pay.sources.includes('card'))
      return { ok: false, issue: { kind: 'source-not-allowed', detail: '이 선택지에서는 카드를 쓸 수 없습니다.' } };
    const months = plan.card.months;
    if (!pay.cardMonths || !pay.cardMonths.includes(months))
      return { ok: false, issue: { kind: 'card-months-not-allowed', detail: `${months}개월 할부는 쓸 수 없습니다.` } };
    if (!Number.isFinite(plan.card.amount) || plan.card.amount <= 0)
      return { ok: false, issue: { kind: 'negative-part', detail: '카드 금액이 0 이하입니다.' } };
    total += plan.card.amount;
  }
  if (pay.adjustable) {
    const { min, max, step } = pay.adjustable;
    if (total < min || total > max || (total - min) % step !== 0)
      return {
        ok: false,
        issue: { kind: 'amount-out-of-range', detail: `금액은 ${min}원부터 ${step}원 단위로 ${max}원까지 고를 수 있습니다.` },
      };
  } else {
    const target = resolveAmount(state, pay.amount);
    if (total !== target)
      return { ok: false, issue: { kind: 'sum-mismatch', detail: `지불 합계가 ${target}원과 같지 않습니다.` } };
  }
  return { ok: true };
}

/** 그 달의 선택 기록(첫 선택 + 이어진 장면 + 상태 행동)을 기록 순서대로. 집계(stats)가 쓴다 */
export function monthChoices(state: GameState, month: MonthNo): DecisionRecord[] {
  return state.decisions.filter((d) => d.month === month);
}
