// 시뮬레이션 공용 타입. 화면 앱과 엔진은 이 파일의 타입만으로 소통한다.

/** 원 단위 정수 금액 */
export type Won = number;
/** 1~12 */
export type MonthNo = number;

// ---------------------------------------------------------------------------
// 계좌와 가계부

export type AccountId = 'living' | 'emergency' | 'savings' | 'invest' | 'goal' | 'housing';
/** 자동이체 대상 계좌 (생활비 통장은 지출 예산 합계로 채워지므로 제외) */
export type TransferAccountId = Exclude<AccountId, 'living'>;

export type ExpenseId =
  | 'rent'
  | 'phone'
  | 'insurance'
  | 'transport'
  | 'subscription'
  | 'food'
  | 'household'
  | 'beauty'
  | 'leisure'
  | 'family';
export type ExpenseGroup = 'fixed' | 'variable';

export interface AccountMeta {
  id: AccountId;
  label: string;
  /** 상품 유형 예시 */
  product: string;
  purpose: string;
  /** 연 이율 (학습용 가정값). 투자 계좌는 월별 수익률을 따로 쓰므로 null */
  annualRate: number | null;
  /** 꺼내 쓸 때 규칙 한 줄 */
  withdrawRule: string;
  /** 권장 배분 문구 (예: "10%") */
  guide: string;
}

export interface ExpenseMeta {
  id: ExpenseId;
  label: string;
  group: ExpenseGroup;
  example: string;
}

export interface Budget {
  /** 월급날 각 계좌로 보내는 자동이체 금액 */
  transfers: Record<TransferAccountId, Won>;
  /** 생활비 통장에서 나가는 항목별 예산 */
  expenses: Record<ExpenseId, Won>;
  /** 생활비 통장에 남겨 두는 여유분 (쓰지 않으면 이월) */
  livingBuffer: Won;
}

export interface BudgetSummary {
  salary: Won;
  transferTotal: Won;
  expenseTotal: Won;
  fixedTotal: Won;
  variableTotal: Won;
  /** 생활비 통장 입금액 = 지출 예산 + 여유분 */
  livingIn: Won;
  /** 월급 - (자동이체 + 생활비 입금). 0이어야 확정 가능 */
  remaining: Won;
  /** (적금 + 투자 + 청약 + 비상금 + 목표) / 월급 */
  savingsRate: number;
  /** 계좌별 비율 막대용. 합계 1 */
  shares: Record<AccountId, number>;
}

export type BudgetIssue =
  | { kind: 'over'; amount: Won }
  | { kind: 'under'; amount: Won }
  | { kind: 'negative'; key: TransferAccountId | ExpenseId | 'livingBuffer' };

// ---------------------------------------------------------------------------
// 계좌 상태, 부채, 지속 효과

export interface AccountState {
  balance: Won;
  /** 지금까지 넣은 원금 */
  contributed: Won;
  /** 지금까지 붙은 이자·수익 (투자는 손실이면 음수) */
  earned: Won;
}

export interface SavingsPlan {
  /** 만기 적금에 납입한 횟수 (해지 전까지) */
  paidMonths: number;
  broken: boolean;
  brokenMonth: MonthNo | null;
  /** 해지 뒤 새 적금에 들어간 원금 (12월에 만기가 되지 않음) */
  restartedPrincipal: Won;
}

export type DebtKind = 'installment' | 'revolving' | 'cardBill';

export interface Debt {
  id: string;
  label: string;
  kind: DebtKind;
  principal: Won;
  remaining: Won;
  /** 매달 생활비에서 빠지는 금액 */
  monthly: Won;
  monthsLeft: number;
  annualRate: number;
  startedMonth: MonthNo;
  sourceEventId?: EventId;
}

export type StatusId = 'noLaptop' | 'laptopInstallment' | 'sneakers' | 'frugalMode' | 'revolving' | 'savingsRestarted';
export type StatusActionId = 'sellSneakers';

export interface StatusDef {
  id: StatusId;
  label: string;
  description: string;
  tone: 'buff' | 'debuff' | 'neutral';
  /** 매달 월초에 자동으로 적용되는 효과 */
  monthly?: { satisfaction?: number };
  /** 상태 카드에서 언제든 할 수 있는 행동 */
  actions?: { id: StatusActionId; label: string }[];
}

export interface StatusInstance {
  id: StatusId;
  since: MonthNo;
  /** 끝나는 달. null이면 직접 해제할 때까지 */
  until: MonthNo | null;
  /** 보유 물건 수량 등 (예: 운동화 켤레 수) */
  count?: number;
  /** 화면에 덧붙일 짧은 문구 (예: "현재 시세 42만 원") */
  note?: string;
}

// ---------------------------------------------------------------------------
// 이벤트 (로그라이크식 장면 그래프)

export type EventType = 'tutorial' | 'daily' | 'lifestyle' | 'temptation' | 'social' | 'fraud' | 'opportunity' | 'quirky';

export type EventId =
  | 'tutorial'
  | 'laptop-spill'
  | 'sneaker-resell'
  | 'family-month'
  | 'rent-hike'
  | 'scratch-lottery'
  | 'market-crash'
  | 'price-rise'
  | 'coin-room';

export type SceneId = string;

/** 선택지 유형. 화면은 이 값으로 선택지의 생김새와 다음 단계(지불 수단 선택 등)를 정한다 */
export type ChoiceKind =
  | 'pay' // 무엇을 할지 고른 뒤 어느 계좌에서 얼마씩 낼지 학생이 정함
  | 'fixedPay' // 지불 방식이 정해져 있음 (예: 12개월 무이자 할부)
  | 'free' // 돈을 쓰지 않음: 거절, 확인 전화, 신고, 미루기
  | 'deposit' // 들어온 돈을 어느 계좌에 넣을지 정함
  | 'gamble' // 결과가 다음 장면이나 몇 달 뒤로 이어짐 (pay가 붙을 수 있음)
  | 'budget'; // 이후 매달 금액이 바뀜. 선택 뒤 가계부 조정 단계로

export type FundingSource = AccountId | 'card';
export type CardMonths = 1 | 3 | 6 | 12;

/** 금액 지정. 숫자 또는 상태에서 계산되는 값 */
export type AmountSpec = Won | 'investBalance' | 'sneakerValue' | 'livingShortfall';

export interface PaySpec {
  amount: AmountSpec;
  /** 쓸 수 있는 수단. 여러 개로 나눠 낼 수 있음 */
  sources: FundingSource[];
  /** 카드를 허용할 때 고를 수 있는 할부 개월 수 (1 = 일시불) */
  cardMonths?: CardMonths[];
  interestFree?: boolean;
  /** 학생이 금액을 고를 수 있으면 범위 지정 (예: 추가 매수) */
  adjustable?: { min: Won; max: Won; step: Won };
  /** 지출이 아니라 다른 계좌로 옮기는 경우 (예: 투자 추가 매수) */
  to?: AccountId;
  /** 목표 통장으로 내면 받는 만족도 보너스 */
  goalBonus?: number;
}

export interface FixedPaySpec {
  amount: Won;
  source: FundingSource;
  cardMonths?: CardMonths;
  interestFree?: boolean;
  /** 화면에 보여 줄 지불 방식 (예: "12개월 무이자 할부, 매달 12.5만 원") */
  label: string;
}

export interface DepositSpec {
  amount: AmountSpec;
  targets: AccountId[];
}

export type Condition =
  | { kind: 'minBalance'; account: AccountId; amount: Won }
  | { kind: 'maxBalance'; account: AccountId; amount: Won }
  | { kind: 'hasStatus'; status: StatusId }
  | { kind: 'lacksStatus'; status: StatusId }
  | { kind: 'flag'; key: string; equals: boolean | number | string }
  | { kind: 'all'; of: Condition[] }
  | { kind: 'any'; of: Condition[] }
  | { kind: 'not'; cond: Condition };

export type Effect =
  | { kind: 'satisfaction'; delta: number }
  | { kind: 'credit'; delta: number }
  | { kind: 'money'; account: AccountId; delta: Won }
  | { kind: 'budget'; expense: ExpenseId; delta: Won }
  | { kind: 'budgetPct'; expense: ExpenseId; pct: number }
  | { kind: 'addStatus'; status: StatusId; months?: number; count?: number }
  | { kind: 'removeStatus'; status: StatusId }
  | { kind: 'flag'; key: string; value: boolean | number | string }
  | { kind: 'sellAllInvest' }
  | { kind: 'breakSavings' }
  | { kind: 'startRevolving'; amount: AmountSpec }
  | { kind: 'openBudget'; reason: string };

export type ChoiceTag =
  | 'fraudHit'
  | 'fraudAvoided'
  | 'plannedJoy'
  | 'deferred'
  | 'heldInvest'
  | 'soldInvest'
  | 'boughtDip'
  | 'resellProfit'
  | 'lotteryAgain'
  | 'negotiated';

export interface NextScene {
  scene: SceneId;
  /** 없으면 같은 달에 바로 이어짐 */
  delayMonths?: number;
  /** 예약 장면이 실제로 나타날 조건 (그 달 월초에 판정) */
  when?: Condition;
}

export interface Choice {
  id: string;
  label: string;
  /** 선택지 아래 작은 설명 */
  detail?: string;
  kind: ChoiceKind;
  pay?: PaySpec;
  fixedPay?: FixedPaySpec;
  deposit?: DepositSpec;
  requires?: Condition;
  /** requires를 못 채웠을 때 보여 줄 이유 */
  lockedReason?: string;
  effects?: Effect[];
  next?: NextScene;
  feedback: string;
  tags?: ChoiceTag[];
}

/** 장면이 어떤 매체로 전달되는지. 화면 연출(말풍선, 문자, 뉴스 속보 등)에 사용 */
export type SceneChannel = 'narration' | 'messenger' | 'sms' | 'news' | 'app';

export interface Scene {
  id: SceneId;
  channel: SceneChannel;
  /** 메시지 보낸 사람 등 */
  speaker?: string;
  title?: string;
  text: string;
  /** 이 장면에서 공개되는 숫자 정보 (예: 시세, 기대값) */
  reveal?: { label: string; value: string }[];
  choices: Choice[];
}

export interface GameEvent {
  id: EventId;
  /** 기획서 6.3 목록 코드 (예: A2) */
  code: string;
  type: EventType;
  month: MonthNo;
  title: string;
  summary: string;
  lesson: string;
  promptId?: PromptId;
  entry: SceneId;
  /** 조건에 따라 다른 시작 장면 (위에서부터 먼저 맞는 것) */
  entryVariants?: { when: Condition; scene: SceneId }[];
  scenes: Record<SceneId, Scene>;
}

// ---------------------------------------------------------------------------
// 설문, 안내, 도전과제, 엔딩, 프롬프트

export type QuestionId = 'meal' | 'cafe' | 'delivery' | 'phonePlan' | 'subscriptions' | 'weekend' | 'impulse';
export type SpendingType = 'planner' | 'balanced' | 'impulsive';

export interface SurveyOption {
  id: string;
  label: string;
  /** 추천 가계부에 더해지는 항목별 월 금액 */
  adds?: Partial<Record<ExpenseId, Won>>;
  /** 소비 성향 점수 (높을수록 즉흥형) */
  impulse: number;
}

export interface SurveyQuestion {
  id: QuestionId;
  text: string;
  linkedTo: string;
  options: SurveyOption[];
}

export interface SpendingTypeDef {
  id: SpendingType;
  label: string;
  oneLiner: string;
  advice: string;
}

export interface SurveyResult {
  type: SpendingType;
  impulseScore: number;
  recommended: Budget;
}

export interface GuideCard {
  id: string;
  title: string;
  lead: string;
  points: string[];
  tip?: string;
}

export type AchievementId =
  | 'paySelfFirst'
  | 'emergency3'
  | 'emergencyRefill'
  | 'noInstallment'
  | 'fraudDetector'
  | 'savingsComplete'
  | 'budgetRemodel'
  | 'plannedJoy'
  | 'happyHeart'
  | 'steadyInvestor'
  | 'resellEscape'
  | 'expectedValue'
  | 'negotiator';

export interface AchievementDef {
  id: AchievementId;
  title: string;
  description: string;
  hidden: boolean;
  months: MonthNo[];
}

export type EndingId = 'debt' | 'frugal' | 'yolo' | 'balanced' | 'ordinary';

export interface EndingDef {
  id: EndingId;
  title: string;
  tagline: string;
  condition: string;
}

export type PromptId = 'budget' | 'accounts' | 'emergency' | 'temptation' | 'crash' | 'fraud';

export interface PromptTemplate {
  id: PromptId;
  stage: string;
  /** {salary}, {meal}, {delivery}, {amount}, {accounts}, {item}, {months}, {message} 자리표시자 */
  template: string;
}

// ---------------------------------------------------------------------------
// 게임 상태

export type Phase = 'start' | 'survey' | 'guide' | 'budget' | 'sim' | 'result';

/** 시뮬레이션 화면 안의 단계 */
export type MonthStep =
  | 'payday' // 월급 입금, 자동이체, 생활비 사용, 이자 연출
  | 'scene' // 장면 카드와 선택지
  | 'outcome' // 선택 결과 피드백
  | 'adjust' // 가계부 조정
  | 'report'; // 월말 리포트

export interface SceneRef {
  eventId: EventId;
  sceneId: SceneId;
}

export interface ScheduledScene extends SceneRef {
  month: MonthNo;
  when?: Condition;
  /** 화면에 보여 줄 예고 문구 (예: "4월에 노트북 문제가 다시 찾아옵니다") */
  reason: string;
}

export interface PaymentPlan {
  /** 계좌별로 낸 금액 */
  parts: { source: AccountId; amount: Won }[];
  card?: { amount: Won; months: CardMonths };
}

export type Delta =
  | { kind: 'account'; account: AccountId; amount: Won }
  | { kind: 'satisfaction'; amount: number }
  | { kind: 'credit'; amount: number }
  | { kind: 'debt'; amount: Won; label: string }
  | { kind: 'status'; status: StatusId; change: 'add' | 'remove' }
  | { kind: 'budget'; key: ExpenseId | TransferAccountId; amount: Won };

export interface Outcome {
  ref: SceneRef;
  choiceId: string;
  feedback: string;
  deltas: Delta[];
  /** 같은 달에 바로 이어지는 장면 */
  next: SceneRef | null;
  /** 몇 달 뒤로 예약된 장면 */
  scheduled: ScheduledScene | null;
  /** 이벤트가 끝났으면 핵심 교훈 */
  lesson: string | null;
  /** 가계부 조정이 필요하면 그 이유 */
  budgetReason: string | null;
}

export interface PaydayBreakdown {
  month: MonthNo;
  salary: Won;
  transfers: Record<TransferAccountId, Won>;
  livingIn: Won;
  spending: Won;
  debtPayments: Won;
  /** 이번 달에 붙은 이자·수익 */
  earnings: Partial<Record<AccountId, Won>>;
  investReturnPct: number;
  statusEffects: { status: StatusId; satisfaction: number }[];
  /** 생활비가 모자라 카드값으로 넘어간 금액 */
  livingShortfall: Won;
}

export interface MonthRecord {
  month: MonthNo;
  netWorth: Won;
  balances: Record<AccountId, Won>;
  debt: Won;
  satisfaction: number;
  credit: number;
  eventIds: EventId[];
}

export interface DecisionRecord {
  month: MonthNo;
  eventId: EventId;
  eventCode: string;
  sceneId: SceneId;
  choiceId: string;
  choiceLabel: string;
  kind: ChoiceKind;
  payment?: PaymentPlan;
  tags: ChoiceTag[];
}

export interface SavingsMaturity {
  principal: Won;
  interestGross: Won;
  tax: Won;
  interestNet: Won;
  broken: boolean;
}

export interface Settlement {
  maturity: SavingsMaturity;
  finalBalances: Record<AccountId, Won>;
  netWorth: Won;
  debt: Won;
  ending: EndingId;
  achievements: { id: AchievementId; unlocked: boolean }[];
  budgetDiff: { key: ExpenseId | TransferAccountId | 'livingBuffer'; before: Won; after: Won }[];
}

export interface GameState {
  version: 1;
  phase: Phase;
  profile: { nickname: string; salary: Won; baseSalary: Won };
  survey: { answers: Partial<Record<QuestionId, string>>; result: SurveyResult | null };
  initialBudget: Budget | null;
  budget: Budget;

  month: MonthNo;
  step: MonthStep;
  payday: PaydayBreakdown | null;

  accounts: Record<AccountId, AccountState>;
  savings: SavingsPlan;
  debts: Debt[];
  statuses: StatusInstance[];
  /** 0~100 */
  satisfaction: number;
  /** 0~1000 */
  credit: number;
  flags: Record<string, boolean | number | string>;

  /** 이번 달에 남은 장면 */
  queue: SceneRef[];
  current: SceneRef | null;
  lastOutcome: Outcome | null;
  scheduled: ScheduledScene[];

  history: MonthRecord[];
  decisions: DecisionRecord[];
  budgetEdits: number;
  unlocked: AchievementId[];
  settlement: Settlement | null;
}

/** step(state, action)에 넣는 행동 */
export type Action =
  | { type: 'start'; nickname: string }
  | { type: 'answer'; question: QuestionId; option: string }
  | { type: 'finishSurvey' }
  | { type: 'goto'; phase: Phase }
  | { type: 'setBudget'; budget: Budget }
  | { type: 'confirmBudget' }
  | { type: 'beginMonth' }
  | { type: 'choose'; choiceId: string; payment?: PaymentPlan; depositTo?: AccountId; amount?: Won }
  | { type: 'continue' }
  | { type: 'statusAction'; status: StatusId; action: StatusActionId; depositTo?: AccountId }
  | { type: 'endMonth' }
  | { type: 'reset' };
