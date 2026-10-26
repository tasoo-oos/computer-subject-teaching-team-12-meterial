import type { ExpenseId, SpendingType, SpendingTypeDef, SurveyQuestion, Won } from '../types.ts';

export const SURVEY: SurveyQuestion[] = [
  {
    id: 'meal',
    text: '한 끼 식사에 보통 얼마를 쓰나요?',
    linkedTo: '식비',
    options: [
      { id: 'lt5', label: '5천 원 이하', adds: { food: 240_000 }, impulse: 0 },
      { id: '5to10', label: '5천~1만 원', adds: { food: 330_000 }, impulse: 0 },
      { id: '10to15', label: '1만~1만 5천 원', adds: { food: 420_000 }, impulse: 1 },
      { id: 'gt15', label: '1만 5천 원 이상', adds: { food: 520_000 }, impulse: 2 },
    ],
  },
  {
    id: 'cafe',
    text: '하루에 카페나 간식에 얼마를 쓰나요?',
    linkedTo: '식비(간식)',
    options: [
      { id: 'none', label: '거의 안 써요', adds: { food: 0 }, impulse: 0 },
      { id: 'lt3', label: '3천 원 이하', adds: { food: 60_000 }, impulse: 0 },
      { id: '3to7', label: '3천~7천 원', adds: { food: 110_000 }, impulse: 1 },
      { id: 'gt7', label: '7천 원 이상', adds: { food: 170_000 }, impulse: 2 },
    ],
  },
  {
    id: 'delivery',
    text: '배달 음식은 일주일에 몇 번 시키나요?',
    linkedTo: '식비',
    options: [
      { id: '0', label: '안 시켜요', adds: { food: 0 }, impulse: 0 },
      { id: '1to2', label: '1~2번', adds: { food: 60_000 }, impulse: 0 },
      { id: '3to4', label: '3~4번', adds: { food: 140_000 }, impulse: 1 },
      { id: '5plus', label: '5번 이상', adds: { food: 230_000 }, impulse: 2 },
    ],
  },
  {
    id: 'phonePlan',
    text: '휴대폰 요금제는 어떤 것을 쓰나요?',
    linkedTo: '통신비',
    options: [
      { id: 'budget', label: '저가 (알뜰폰)', adds: { phone: 20_000 }, impulse: 0 },
      { id: 'normal', label: '일반', adds: { phone: 50_000 }, impulse: 0 },
      { id: 'unlimited', label: '무제한', adds: { phone: 80_000 }, impulse: 1 },
    ],
  },
  {
    id: 'subscriptions',
    text: '구독 서비스(OTT, 음악 등)는 몇 개인가요?',
    linkedTo: '구독료',
    options: [
      { id: '0', label: '없어요', adds: { subscription: 0 }, impulse: 0 },
      { id: '1', label: '1개', adds: { subscription: 10_000 }, impulse: 0 },
      { id: '2to3', label: '2~3개', adds: { subscription: 30_000 }, impulse: 1 },
      { id: '4plus', label: '4개 이상', adds: { subscription: 55_000 }, impulse: 2 },
    ],
  },
  {
    id: 'weekend',
    text: '주말 여가에 한 달 동안 얼마를 쓰나요?',
    linkedTo: '여가·문화',
    options: [
      { id: 'lt5', label: '5만 원 이하', adds: { leisure: 50_000 }, impulse: 0 },
      { id: '5to15', label: '5만~15만 원', adds: { leisure: 100_000 }, impulse: 0 },
      { id: '15to30', label: '15만~30만 원', adds: { leisure: 220_000 }, impulse: 1 },
      { id: 'gt30', label: '30만 원 이상', adds: { leisure: 350_000 }, impulse: 2 },
    ],
  },
  {
    id: 'impulse',
    text: '사고 싶은 것이 생기면 어떻게 하나요?',
    linkedTo: '소비 성향 유형',
    options: [
      { id: 'buy', label: '바로 산다', impulse: 3 },
      { id: 'think', label: '고민한다', impulse: 1 },
      { id: 'hold', label: '참는다', impulse: 0 },
    ],
  },
];

/** 설문과 무관하게 들어가는 기본 지출 예산 */
export const BASE_EXPENSES: Record<ExpenseId, Won> = {
  rent: 550_000,
  phone: 0,
  insurance: 50_000,
  transport: 70_000,
  subscription: 0,
  food: 0,
  household: 50_000,
  beauty: 80_000,
  leisure: 0,
  family: 50_000,
};

export const SPENDING_TYPES: Record<SpendingType, SpendingTypeDef> = {
  planner: {
    id: 'planner',
    label: '계획형',
    oneLiner: '쓰기 전에 한 번 더 생각하는 편이에요.',
    advice: '저축은 잘하지만 즐거움에 쓸 돈도 목표 통장에 미리 떼어 두세요.',
  },
  balanced: {
    id: 'balanced',
    label: '균형형',
    oneLiner: '필요한 곳과 즐거운 곳에 고루 쓰는 편이에요.',
    advice: '월급날 저축부터 자동이체로 떼어 두면 지금의 균형을 지킬 수 있어요.',
  },
  impulsive: {
    id: 'impulsive',
    label: '즉흥형',
    oneLiner: '마음에 들면 바로 사는 편이에요.',
    advice: '24시간 규칙을 써 보세요. 하루 지나도 필요하면 그때 삽니다.',
  },
};

/** impulse 점수 합으로 유형 결정: 이하이면 해당 유형 */
export const SPENDING_TYPE_THRESHOLDS = { planner: 3, balanced: 7 } as const;

/** 유형별 추천 자동이체 비율 (청약은 고정 금액) */
export const RECOMMENDED_TRANSFERS: Record<
  SpendingType,
  { emergency: number; savings: number; invest: number; goal: number; housing: Won }
> = {
  planner: { emergency: 0.1, savings: 0.2, invest: 0.07, goal: 0.04, housing: 100_000 },
  balanced: { emergency: 0.1, savings: 0.15, invest: 0.05, goal: 0.03, housing: 100_000 },
  impulsive: { emergency: 0.1, savings: 0.12, invest: 0.03, goal: 0.05, housing: 50_000 },
};
