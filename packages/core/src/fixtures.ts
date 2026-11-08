// 목업 스냅숏 상태. 엔진(step)이 아직 없으므로 화면은 이 스냅숏으로 그린다.
// 숫자는 기획서 5장 규칙을 단순화해 계산한 근사값이며, 엔진 구현 후 실제 값과 다를 수 있다.
import { ACCOUNT_ORDER, EXPENSE_ORDER, TRANSFER_ORDER } from './data/accounts.ts';
import { ACHIEVEMENT_ORDER } from './data/achievements.ts';
import { MARKET_RETURNS, RATES, SNEAKER_PRICES } from './data/constants.ts';
import { EVENTS } from './data/events.ts';
import { STATUSES } from './data/statuses.ts';
import { createInitialState, recommendBudget } from './engine.ts';
import { expenseTotal, netWorth, savingsMaturity, totalDebt } from './selectors.ts';
import type {
  AccountId,
  AchievementId,
  Budget,
  CardMonths,
  EventId,
  GameState,
  MonthNo,
  Outcome,
  PaymentPlan,
  QuestionId,
  ScheduledScene,
  StatusId,
  Won,
} from './types.ts';

export type ScreenId = 'start' | 'survey' | 'guide' | 'budget' | 'sim' | 'result';
export const SCREEN_ORDER: ScreenId[] = ['start', 'survey', 'guide', 'budget', 'sim', 'result'];
export const SCREEN_LABEL: Record<ScreenId, string> = {
  start: '시작',
  survey: '소비습관 설문',
  guide: '재무 기초 안내',
  budget: '가계부 작성',
  sim: '12개월 시뮬레이션',
  result: '결과 · 엔딩',
};

/** GameState에 담기지 않는 화면 내부 상태 힌트 */
export interface FixtureUi {
  /** 시작 화면: 닉네임 입력 단계 또는 월급 공개 단계 */
  startStage?: 'name' | 'reveal';
  /** 설문: 0~6은 질문, 7은 결과 */
  surveyIndex?: number;
  /** 안내 카드 번호 (0부터) */
  guideIndex?: number;
  /** 시뮬레이션: 지불·입금 패널이 열려 있는 선택지 id */
  openChoiceId?: string;
  /** 결과: 발표용 크게 보기 */
  presentation?: boolean;
}

export interface Fixture {
  id: string;
  screen: ScreenId;
  label: string;
  /** 이 스냅숏에서 꼭 보여야 하는 것 */
  note: string;
  state: GameState;
  ui: FixtureUi;
}

// ---------------------------------------------------------------------------
// 근사 시뮬레이션 도구

const clone = <T>(x: T): T => structuredClone(x);

function runPayday(s: GameState, m: MonthNo) {
  const b = s.budget;
  const transfers = { ...b.transfers };
  for (const id of TRANSFER_ORDER) {
    s.accounts[id].balance += b.transfers[id];
    s.accounts[id].contributed += b.transfers[id];
  }
  if (s.savings.broken) s.savings.restartedPrincipal += b.transfers.savings;
  else s.savings.paidMonths += 1;

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

  const overspend = typeof s.flags.foodOverspend === 'number' ? Math.round(b.expenses.food * s.flags.foodOverspend) : 0;
  const spending = expenseTotal(b) + overspend;
  const livingIn = expenseTotal(b) + b.livingBuffer;
  const living = s.accounts.living;
  living.balance += livingIn - spending - debtPayments;
  living.contributed += livingIn;
  let shortfall = 0;
  if (living.balance < 0) {
    shortfall = -living.balance;
    living.balance = 0;
    s.satisfaction -= 5;
  }
  s.flags.livingShort = shortfall > 0;
  s.flags.livingShortfall = shortfall;

  const earnings: Partial<Record<AccountId, Won>> = {};
  for (const id of ['emergency', 'goal', 'housing'] as const) {
    const e = Math.round((s.accounts[id].balance * RATES[id]) / 12);
    s.accounts[id].balance += e;
    s.accounts[id].earned += e;
    earnings[id] = e;
  }
  const r = MARKET_RETURNS[m] ?? 0;
  const inv = s.accounts.invest;
  const gain = Math.round(inv.balance * r);
  inv.balance += gain;
  inv.earned += gain;
  earnings.invest = gain;

  const statusEffects: { status: StatusId; satisfaction: number }[] = [];
  for (const st of s.statuses) {
    const delta = STATUSES[st.id].monthly?.satisfaction;
    if (delta && st.since < m) {
      s.satisfaction += delta;
      statusEffects.push({ status: st.id, satisfaction: delta });
    }
    if (st.id === 'sneakers') st.note = `현재 시세 ${(SNEAKER_PRICES[m] ?? 0) / 10_000}만 원`;
  }

  s.payday = {
    month: m,
    salary: s.profile.salary,
    transfers,
    livingIn,
    spending,
    debtPayments,
    earnings,
    investReturnPct: r,
    statusEffects,
    livingShortfall: shortfall,
  };
}

function closeMonth(s: GameState, m: MonthNo) {
  s.history.push({
    month: m,
    netWorth: netWorth(s),
    balances: Object.fromEntries(ACCOUNT_ORDER.map((id) => [id, s.accounts[id].balance])) as Record<AccountId, Won>,
    debt: totalDebt(s),
    satisfaction: s.satisfaction,
    credit: s.credit,
    eventIds: [...new Set(s.decisions.filter((d) => d.month === m).map((d) => d.eventId))],
  });
  s.current = null;
  s.queue = [];
  s.lastOutcome = null;
}

type Hook = (s: GameState) => void;

/** 1월부터 upTo월까지 진행한다. upTo월은 월급날 처리 뒤 last만 실행하고 닫지 않는다 */
function simulate(base: GameState, upTo: MonthNo, hooks: Partial<Record<MonthNo, Hook>>, last?: Hook): GameState {
  const s = clone(base);
  s.phase = 'sim';
  for (let m = 1; m <= upTo; m++) {
    s.month = m;
    runPayday(s, m);
    if (m < upTo) {
      hooks[m]?.(s);
      closeMonth(s, m);
    } else {
      last?.(s);
    }
  }
  return s;
}

function spend(s: GameState, parts: Partial<Record<AccountId, Won>>): PaymentPlan {
  const plan: PaymentPlan = { parts: [] };
  for (const [id, amount] of Object.entries(parts) as [AccountId, Won][]) {
    s.accounts[id].balance -= amount;
    plan.parts.push({ source: id, amount });
  }
  return plan;
}

function cardDebt(s: GameState, eventId: EventId, label: string, amount: Won, months: CardMonths, interestFree: boolean) {
  const rate = interestFree || months === 1 ? 0 : RATES.installmentApr;
  s.debts.push({
    id: `${eventId}-${s.month}`,
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
}

function addStatus(s: GameState, id: StatusId, count?: number, until: MonthNo | null = null) {
  s.statuses.push({ id, since: s.month, until, count });
}
function removeStatus(s: GameState, id: StatusId) {
  s.statuses = s.statuses.filter((x) => x.id !== id);
}

function decide(s: GameState, eventId: EventId, sceneId: string, choiceId: string, payment?: PaymentPlan) {
  const event = EVENTS[eventId];
  const choice = event.scenes[sceneId]?.choices.find((c) => c.id === choiceId);
  if (!choice) throw new Error(`선택지 없음: ${eventId}/${sceneId}/${choiceId}`);
  s.decisions.push({
    month: s.month,
    eventId,
    eventCode: event.code,
    sceneId,
    choiceId,
    choiceLabel: choice.label,
    kind: choice.kind,
    payment,
    tags: choice.tags ?? [],
  });
}

function editBudget(s: GameState, changes: Partial<Record<keyof Budget['expenses'] | 'livingBuffer', number>>) {
  for (const [k, v] of Object.entries(changes)) {
    if (k === 'livingBuffer') s.budget.livingBuffer += v;
    else s.budget.expenses[k as keyof Budget['expenses']] += v;
  }
  s.budgetEdits += 1;
}

function scene(s: GameState, eventId: EventId, sceneId: string, queue: string[] = []) {
  s.step = 'scene';
  s.current = { eventId, sceneId };
  s.queue = queue.map((q) => ({ eventId, sceneId: q }));
}

function settle(s: GameState, unlocked: AchievementId[]) {
  const maturity = savingsMaturity(s.budget.transfers.savings, s.savings.paidMonths, s.savings.broken);
  s.accounts.savings.balance += maturity.interestNet;
  s.accounts.savings.earned += maturity.interestNet;
  closeMonth(s, 12);
  s.phase = 'result';
  s.unlocked = unlocked;
  const init = s.initialBudget!;
  const diff: NonNullable<GameState['settlement']>['budgetDiff'] = [];
  for (const id of TRANSFER_ORDER)
    if (init.transfers[id] !== s.budget.transfers[id]) diff.push({ key: id, before: init.transfers[id], after: s.budget.transfers[id] });
  for (const id of EXPENSE_ORDER)
    if (init.expenses[id] !== s.budget.expenses[id]) diff.push({ key: id, before: init.expenses[id], after: s.budget.expenses[id] });
  if (init.livingBuffer !== s.budget.livingBuffer)
    diff.push({ key: 'livingBuffer', before: init.livingBuffer, after: s.budget.livingBuffer });
  s.settlement = {
    maturity,
    finalBalances: Object.fromEntries(ACCOUNT_ORDER.map((id) => [id, s.accounts[id].balance])) as Record<AccountId, Won>,
    netWorth: netWorth(s),
    debt: totalDebt(s),
    ending: totalDebt(s) > 0 ? 'debt' : 'balanced',
    achievements: ACHIEVEMENT_ORDER.map((id) => ({ id, unlocked: unlocked.includes(id) })),
    budgetDiff: diff,
  };
}

function outcome(
  s: GameState,
  eventId: EventId,
  sceneId: string,
  choiceId: string,
  deltas: Outcome['deltas'],
  extra: Partial<Outcome> = {},
): Outcome {
  const choice = EVENTS[eventId].scenes[sceneId]!.choices.find((c) => c.id === choiceId)!;
  s.step = 'outcome';
  s.current = { eventId, sceneId };
  const o: Outcome = {
    ref: { eventId, sceneId },
    choiceId,
    feedback: choice.feedback,
    deltas,
    next: null,
    scheduled: null,
    lesson: EVENTS[eventId].lesson,
    budgetReason: null,
    ...extra,
  };
  s.lastOutcome = o;
  return o;
}

// ---------------------------------------------------------------------------
// 등장인물 두 명

/** 하늘: 균형형, 신중하게 선택하는 경로 */
const HANEUL_ANSWERS: Partial<Record<QuestionId, string>> = {
  meal: '5to10',
  cafe: '3to7',
  delivery: '3to4',
  phonePlan: 'normal',
  subscriptions: '2to3',
  weekend: '5to15',
  impulse: 'think',
};
const HANEUL_SALARY = 2_630_000;

function haneulBase(): GameState {
  const s = createInitialState('하늘', HANEUL_SALARY);
  s.survey.answers = { ...HANEUL_ANSWERS };
  s.survey.result = recommendBudget(HANEUL_ANSWERS, HANEUL_SALARY);
  s.budget = clone(s.survey.result.recommended);
  s.initialBudget = clone(s.budget);
  return s;
}

const haneulHooks: Partial<Record<MonthNo, Hook>> = {
  1: (s) => decide(s, 'tutorial', 'welcome', 'ok'),
  2: (s) => {
    const emergency = s.accounts.emergency.balance;
    decide(s, 'laptop-spill', 'start', 'repair', spend(s, { emergency, goal: 600_000 - emergency }));
  },
  3: (s) => decide(s, 'sneaker-resell', 'start', 'pass'),
  5: (s) => {
    decide(s, 'family-month', 'gift', 'mid', spend(s, { goal: 150_000 }));
    s.satisfaction += 8;
    decide(s, 'family-month', 'message', 'call');
    s.satisfaction += 3;
  },
  6: (s) => {
    decide(s, 'rent-hike', 'notice', 'negotiate');
    decide(s, 'rent-hike', 'counter', 'accept30');
    editBudget(s, { rent: 30_000, leisure: -30_000 });
  },
  7: (s) => {
    decide(s, 'scratch-lottery', 'win', 'save');
    s.accounts.emergency.balance += 50_000;
  },
  8: (s) => decide(s, 'market-crash', 'drop', 'hold'),
  9: (s) => {
    decide(s, 'price-rise', 'notice', 'adjust');
    const inc = Math.round(s.budget.expenses.food * 0.08);
    editBudget(s, { food: inc, beauty: -inc });
  },
  11: (s) => {
    decide(s, 'coin-room', 'invite', 'warn');
    s.satisfaction += 2;
  },
};

/** 바다: 즉흥형, 도박수와 할부가 많은 경로 */
const BADA_ANSWERS: Partial<Record<QuestionId, string>> = {
  meal: '10to15',
  cafe: 'gt7',
  delivery: '3to4',
  phonePlan: 'unlimited',
  subscriptions: '4plus',
  weekend: 'gt30',
  impulse: 'buy',
};
const BADA_SALARY = 2_410_000;
const BADA_BUDGET: Budget = {
  transfers: { emergency: 150_000, savings: 200_000, invest: 100_000, goal: 50_000, housing: 20_000 },
  expenses: {
    rent: 550_000,
    phone: 80_000,
    insurance: 50_000,
    transport: 70_000,
    subscription: 55_000,
    food: 520_000,
    household: 60_000,
    beauty: 150_000,
    leisure: 195_000,
    family: 30_000,
  },
  livingBuffer: 130_000,
};

function badaBase(): GameState {
  const s = createInitialState('바다', BADA_SALARY);
  s.survey.answers = { ...BADA_ANSWERS };
  s.survey.result = recommendBudget(BADA_ANSWERS, BADA_SALARY);
  s.budget = clone(BADA_BUDGET);
  s.initialBudget = clone(BADA_BUDGET);
  return s;
}

const badaHooks: Partial<Record<MonthNo, Hook>> = {
  1: (s) => decide(s, 'tutorial', 'welcome', 'ok'),
  2: (s) => {
    decide(s, 'laptop-spill', 'start', 'new', { parts: [], card: { amount: 1_500_000, months: 12 } });
    cardDebt(s, 'laptop-spill', '노트북 12개월 무이자 할부', 1_500_000, 12, true);
    addStatus(s, 'laptopInstallment', undefined, 13);
    s.satisfaction += 10;
  },
  3: (s) => {
    decide(s, 'sneaker-resell', 'start', 'flip1', spend(s, { emergency: 300_000 }));
    addStatus(s, 'sneakers', 1);
  },
  4: (s) => decide(s, 'sneaker-resell', 'check4', 'hold'),
  5: (s) => {
    decide(s, 'family-month', 'gift', 'letter', spend(s, { living: 50_000 }));
    s.satisfaction += 4;
    const e = s.accounts.emergency.balance;
    decide(s, 'family-month', 'message', 'send', spend(s, { emergency: e, goal: 500_000 - e }));
    decide(s, 'family-month', 'aftermath', 'ok');
  },
  6: (s) => {
    decide(s, 'sneaker-resell', 'check6', 'hold');
    decide(s, 'rent-hike', 'notice', 'accept');
    editBudget(s, { rent: 50_000, livingBuffer: -50_000 });
  },
  7: (s) => {
    decide(s, 'scratch-lottery', 'win', 'more');
    decide(s, 'scratch-lottery', 'reveal', 'again');
    s.satisfaction -= 3;
  },
  8: (s) => {
    const v = s.accounts.invest.balance;
    decide(s, 'market-crash', 'drop', 'sellAll');
    s.accounts.invest.balance = 0;
    s.accounts.emergency.balance += v;
  },
  9: (s) => {
    decide(s, 'price-rise', 'notice', 'ignore');
    s.flags.foodOverspend = 0.08;
    // 이번 달 식비도 이미 8% 더 나갔다
    s.accounts.living.balance -= Math.round(s.budget.expenses.food * 0.08);
    if (s.accounts.living.balance < 0) {
      s.flags.livingShort = true;
      s.flags.livingShortfall = -s.accounts.living.balance;
      s.accounts.living.balance = 0;
    }
  },
  10: (s) => {
    decide(s, 'price-rise', 'revolving', 'revolve');
    const short = typeof s.flags.livingShortfall === 'number' ? s.flags.livingShortfall : 0;
    s.debts.push({
      id: 'revolving-10',
      label: '리볼빙 (일부결제금액 이월약정)',
      kind: 'revolving',
      principal: short,
      remaining: short,
      monthly: Math.round(short * 0.1),
      monthsLeft: 99,
      annualRate: RATES.revolvingApr,
      startedMonth: 10,
    });
    addStatus(s, 'revolving');
    s.credit -= 40;
  },
  11: (s) => {
    decide(s, 'coin-room', 'invite', 'tryTen', spend(s, { goal: 100_000 }));
    decide(s, 'coin-room', 'withdraw', 'refuse');
  },
};

// ---------------------------------------------------------------------------
// 스냅숏

function startName(): GameState {
  return createInitialState('', 0);
}
function startReveal(): GameState {
  return createInitialState('하늘', HANEUL_SALARY);
}
function surveyAt(n: number): GameState {
  const s = startReveal();
  s.phase = 'survey';
  const keys = Object.keys(HANEUL_ANSWERS) as QuestionId[];
  for (const k of keys.slice(0, n)) s.survey.answers[k] = HANEUL_ANSWERS[k];
  if (n >= keys.length) s.survey.result = recommendBudget(HANEUL_ANSWERS, HANEUL_SALARY);
  return s;
}
function guide(): GameState {
  const s = haneulBase();
  s.phase = 'guide';
  s.initialBudget = null;
  return s;
}
function budgetRecommended(): GameState {
  const s = haneulBase();
  s.phase = 'budget';
  s.initialBudget = null;
  return s;
}
function budgetOver(): GameState {
  const s = budgetRecommended();
  s.budget.transfers.savings += 100_000;
  s.budget.transfers.invest += 50_000;
  s.budget.expenses.leisure -= 30_000;
  return s;
}

const H = haneulBase;
const B = badaBase;

function build(): Fixture[] {
  const list: Fixture[] = [];
  const add = (f: Fixture) => list.push(f);

  add({ id: 'start-name', screen: 'start', label: '닉네임 입력', note: '수업 첫 화면. "여러분은 오늘 첫 월급을 받았습니다" 상황 제시', state: startName(), ui: { startStage: 'name' } });
  add({ id: 'start-reveal', screen: 'start', label: '월급 공개', note: '"축하합니다! 하늘님의 첫 월급은 2,630,000원입니다" 연출', state: startReveal(), ui: { startStage: 'reveal' } });

  add({ id: 'survey-q1', screen: 'survey', label: '설문 1번', note: '한 화면에 질문 하나. 진행 표시(1/7)', state: surveyAt(0), ui: { surveyIndex: 0 } });
  add({ id: 'survey-q7', screen: 'survey', label: '설문 7번', note: '마지막 질문 (소비 성향 질문)', state: surveyAt(6), ui: { surveyIndex: 6 } });
  add({ id: 'survey-result', screen: 'survey', label: '소비 성향 결과', note: '유형(균형형) + 한 줄 피드백 + 추천 가계부 미리보기', state: surveyAt(7), ui: { surveyIndex: 7 } });

  add({ id: 'guide-1', screen: 'guide', label: '안내 카드 1', note: '카드 6장 중 첫 장', state: guide(), ui: { guideIndex: 0 } });
  add({ id: 'guide-3', screen: 'guide', label: '안내 카드 3 (통장 쪼개기)', note: '계좌 6종 소개가 들어가는 가장 정보가 많은 카드', state: guide(), ui: { guideIndex: 2 } });

  add({ id: 'budget-ok', screen: 'budget', label: '추천 가계부 (합계 일치)', note: '합계 = 월급. 다음 단계 버튼 활성', state: budgetRecommended(), ui: {} });
  add({ id: 'budget-over', screen: 'budget', label: '가계부 초과', note: '자동이체를 늘려 12만 원 초과. 경고와 비활성 버튼', state: budgetOver(), ui: {} });

  add({
    id: 'sim-jan-payday',
    screen: 'sim',
    label: '1월 월급날 (튜토리얼)',
    note: '월급 입금 → 자동이체 → 생활비 사용 → 이자 순서 연출. 계좌 카드 숫자 증가',
    state: (() => {
      const s = simulate(H(), 1, haneulHooks);
      s.step = 'payday';
      return s;
    })(),
    ui: {},
  });
  add({
    id: 'sim-feb-scene',
    screen: 'sim',
    label: '2월 노트북 고장',
    note: '장면 카드 + 선택지 4개 (지불형, 연쇄, 고정 지불형, 무지출형). 비상금 약 52만 원 < 수리비 60만 원',
    state: simulate(H(), 2, haneulHooks, (s) => scene(s, 'laptop-spill', 'start')),
    ui: {},
  });
  add({
    id: 'sim-feb-pay',
    screen: 'sim',
    label: '2월 지불 수단 고르기',
    note: '수리 60만 원을 계좌별로 나눠 내기. 비상금(약 52만 원)만으로는 부족, 적금·청약·투자 경고, 카드 일시불/3개월',
    state: simulate(H(), 2, haneulHooks, (s) => scene(s, 'laptop-spill', 'start')),
    ui: { openChoiceId: 'repair' },
  });
  add({
    id: 'sim-feb-seller',
    screen: 'sim',
    label: '2월 중고거래 판매자 (메신저)',
    note: '채널이 messenger인 장면. 사기 반전',
    state: simulate(H(), 2, haneulHooks, (s) => {
      decide(s, 'laptop-spill', 'start', 'used');
      scene(s, 'laptop-spill', 'seller');
    }),
    ui: {},
  });
  add({
    id: 'sim-feb-outcome',
    screen: 'sim',
    label: '2월 결과 피드백',
    note: '잔고 변화(비상금 약 -52만, 목표 약 -8만), 교훈 한 줄',
    state: simulate(H(), 2, haneulHooks, (s) => {
      haneulHooks[2]!(s);
      const e = s.decisions.at(-1)!.payment!.parts;
      outcome(
        s,
        'laptop-spill',
        'start',
        'repair',
        e.map((p) => ({ kind: 'account' as const, account: p.source, amount: -p.amount })),
      );
    }),
    ui: {},
  });
  add({
    id: 'sim-mar-resell',
    screen: 'sim',
    label: '3월 운동화 리셀 (도박형)',
    note: '친구 메신저 + 공개 정보(발매가, 리셀가)',
    state: simulate(B(), 3, badaHooks, (s) => scene(s, 'sneaker-resell', 'start')),
    ui: {},
  });
  add({
    id: 'sim-apr-check',
    screen: 'sim',
    label: '4월 리셀 시세 알림 (예약 후속)',
    note: '이벤트 없는 달에 예약 장면 등장. 상태 "운동화 보유", "노트북 할부" 표시',
    state: simulate(B(), 4, badaHooks, (s) => scene(s, 'sneaker-resell', 'check4')),
    ui: {},
  });
  add({
    id: 'sim-may-message',
    screen: 'sim',
    label: '5월 가족 사칭 메시지 (연쇄 장면)',
    note: '같은 달 두 번째 장면. 모르는 번호 메신저',
    state: simulate(H(), 5, haneulHooks, (s) => {
      decide(s, 'family-month', 'gift', 'mid', spend(s, { goal: 150_000 }));
      s.satisfaction += 8;
      scene(s, 'family-month', 'message');
    }),
    ui: {},
  });
  add({
    id: 'sim-jun-adjust',
    screen: 'sim',
    label: '6월 가계부 조정 (월세 +5만)',
    note: '가계부 변경형 선택 뒤 조정 단계. 5만 원 초과 상태에서 다른 항목을 줄여야 함',
    state: simulate(B(), 6, badaHooks, (s) => {
      decide(s, 'sneaker-resell', 'check6', 'hold');
      decide(s, 'rent-hike', 'notice', 'accept');
      s.budget.expenses.rent += 50_000;
      outcome(s, 'rent-hike', 'notice', 'accept', [{ kind: 'budget', key: 'rent', amount: 50_000 }], {
        budgetReason: '월세가 5만 원 올랐습니다. 다른 항목을 줄여 합계를 맞추세요.',
      });
      s.step = 'adjust';
    }),
    ui: {},
  });
  add({
    id: 'sim-jul-reveal',
    screen: 'sim',
    label: '7월 복권 10장 결과 (기대값 공개)',
    note: '공개 정보(reveal) 강조. 그만둔다(입금형) / 한 장 더(도박형)',
    state: simulate(B(), 7, badaHooks, (s) => {
      decide(s, 'scratch-lottery', 'win', 'more');
      scene(s, 'scratch-lottery', 'reveal');
    }),
    ui: {},
  });
  add({
    id: 'sim-aug-crash',
    screen: 'sim',
    label: '8월 증시 급락 (뉴스)',
    note: '뉴스 속보 채널. 투자 계좌 -15% 반영. 선택지 4개',
    state: simulate(H(), 8, haneulHooks, (s) => scene(s, 'market-crash', 'drop')),
    ui: {},
  });
  add({
    id: 'sim-aug-deposit',
    screen: 'sim',
    label: '8월 전부 매도 후 입금 계좌 고르기',
    note: '입금형 패널: 판 돈을 넣을 계좌 선택. 손실 확정 금액 표시',
    state: simulate(H(), 8, haneulHooks, (s) => scene(s, 'market-crash', 'drop')),
    ui: { openChoiceId: 'sellAll' },
  });
  add({
    id: 'sim-oct-report',
    screen: 'sim',
    label: '10월 월말 리포트 (이벤트 없는 달)',
    note: '이벤트 없는 달의 월말 리포트. 생활비 부족, 상태(리볼빙, 노트북 할부, 운동화), 신용점수 하락',
    state: simulate(B(), 10, badaHooks, (s) => {
      badaHooks[10]!(s);
      s.step = 'report';
    }),
    ui: {},
  });
  add({
    id: 'sim-nov-invite',
    screen: 'sim',
    label: '11월 코인 리딩방 초대',
    note: '조건부 선택지(적금 300만 원 이상). 하늘은 열림',
    state: simulate(H(), 11, haneulHooks, (s) => scene(s, 'coin-room', 'invite')),
    ui: {},
  });
  add({
    id: 'sim-nov-locked',
    screen: 'sim',
    label: '11월 코인 리딩방 (잠긴 선택지)',
    note: '적금이 300만 원보다 적어 첫 선택지가 잠김. 잠긴 이유 표시',
    state: simulate(B(), 11, badaHooks, (s) => scene(s, 'coin-room', 'invite')),
    ui: {},
  });

  const haneulDone = simulate(H(), 12, haneulHooks, (s) =>
    settle(s, [
      'paySelfFirst',
      'emergencyRefill',
      'noInstallment',
      'fraudDetector',
      'savingsComplete',
      'steadyInvestor',
      'expectedValue',
      'negotiator',
    ]),
  );
  const badaDone = simulate(B(), 12, badaHooks, (s) => settle(s, ['paySelfFirst']));

  add({ id: 'result-balanced', screen: 'result', label: '결과: 균형 잡힌 재무설계자', note: '적금 만기 연출, 순자산 그래프, 도전과제 8/13, 숨은 도전과제', state: haneulDone, ui: {} });
  add({ id: 'result-debt', screen: 'result', label: '결과: 빚과의 동거', note: '부채가 남은 엔딩. 놓친 도전과제가 많음', state: badaDone, ui: {} });
  add({ id: 'result-present', screen: 'result', label: '결과: 발표용 크게 보기', note: '교실 프로젝터용. 멀리서도 읽히는 크기', state: haneulDone, ui: { presentation: true } });

  return list;
}

export const FIXTURES: Fixture[] = build();

export function getFixture(id: string): Fixture | undefined {
  return FIXTURES.find((f) => f.id === id);
}

export function fixturesFor(screen: ScreenId): Fixture[] {
  return FIXTURES.filter((f) => f.screen === screen);
}

/** 예약 장면 예고 문구 만들기용 (화면에서 쓸 수 있음) */
export function describeScheduled(x: ScheduledScene): string {
  return `${x.month}월 · ${x.reason}`;
}
