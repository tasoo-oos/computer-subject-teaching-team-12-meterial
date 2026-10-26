import type { AchievementDef, AchievementId, EndingDef, EndingId } from '../types.ts';

export const ACHIEVEMENT_ORDER: AchievementId[] = [
  'paySelfFirst',
  'emergency3',
  'emergencyRefill',
  'noInstallment',
  'fraudDetector',
  'savingsComplete',
  'budgetRemodel',
  'plannedJoy',
  'happyHeart',
  'steadyInvestor',
  'resellEscape',
  'expectedValue',
  'negotiator',
];

export const ACHIEVEMENTS: Record<AchievementId, AchievementDef> = {
  paySelfFirst: {
    id: 'paySelfFirst',
    title: '선저축 1년',
    description: '12개월 내내 저축·투자 자동이체 합계가 월급의 20% 이상',
    hidden: false,
    months: [],
  },
  emergency3: {
    id: 'emergency3',
    title: '든든한 비상금',
    description: '비상금이 월 생활비 3개월분 이상 쌓임',
    hidden: false,
    months: [],
  },
  emergencyRefill: {
    id: 'emergencyRefill',
    title: '비상금 지킴이',
    description: '비상금을 쓴 뒤 쓰기 전 금액 이상으로 다시 채움',
    hidden: false,
    months: [2],
  },
  noInstallment: {
    id: 'noInstallment',
    title: '할부 없는 1년',
    description: '카드 할부와 리볼빙을 한 번도 쓰지 않음',
    hidden: false,
    months: [2, 5, 6, 9],
  },
  fraudDetector: {
    id: 'fraudDetector',
    title: '사기 감별사',
    description: '금융사기 3건(중고거래, 가족 사칭, 리딩방)을 모두 피함',
    hidden: false,
    months: [2, 5, 11],
  },
  savingsComplete: {
    id: 'savingsComplete',
    title: '적금 완주',
    description: '적금을 해지하지 않고 12월에 만기 수령',
    hidden: false,
    months: [],
  },
  budgetRemodel: {
    id: 'budgetRemodel',
    title: '가계부 리모델링',
    description: '가계부를 이벤트에 맞춰 3번 이상 조정',
    hidden: false,
    months: [6, 8, 9],
  },
  plannedJoy: {
    id: 'plannedJoy',
    title: '계획된 행복',
    description: '목표 통장으로 계획한 소비를 2번 이상 함',
    hidden: false,
    months: [3, 5],
  },
  happyHeart: {
    id: 'happyHeart',
    title: '마음 부자',
    description: '만족도 80 이상으로 결산',
    hidden: false,
    months: [],
  },
  steadyInvestor: {
    id: 'steadyInvestor',
    title: '흔들리지 않는 투자자',
    description: '8월 급락 때 팔지 않고 12월까지 투자 계좌 유지',
    hidden: true,
    months: [8],
  },
  resellEscape: {
    id: 'resellEscape',
    title: '리셀 탈출',
    description: '운동화를 산 가격보다 비싸게 팜',
    hidden: true,
    months: [3, 4],
  },
  expectedValue: {
    id: 'expectedValue',
    title: '기대값 계산기',
    description: '복권 당첨금을 다시 복권에 쓰지 않음',
    hidden: true,
    months: [7],
  },
  negotiator: {
    id: 'negotiator',
    title: '협상의 기술',
    description: '월세 협상에 성공',
    hidden: true,
    months: [6],
  },
};

/** 위에서부터 먼저 맞는 칭호 하나를 준다 (기획서 5.4) */
export const ENDING_ORDER: EndingId[] = ['debt', 'frugal', 'yolo', 'balanced', 'ordinary'];

export const ENDINGS: Record<EndingId, EndingDef> = {
  debt: {
    id: 'debt',
    title: '빚과의 동거',
    tagline: '내년의 월급이 벌써 조금 줄어 있어요.',
    condition: '결산 시점에 부채(할부 잔액, 리볼빙)가 남아 있음',
  },
  frugal: {
    id: 'frugal',
    title: '짠테크 장인',
    tagline: '돈은 모았지만 조금 지쳤어요.',
    condition: '순자산이 월급의 5배 이상, 만족도 40 미만',
  },
  yolo: {
    id: 'yolo',
    title: '욜로 라이프',
    tagline: '즐거웠지만 다음 비상 상황이 걱정돼요.',
    condition: '만족도 80 이상, 비상금 1개월 미만',
  },
  balanced: {
    id: 'balanced',
    title: '균형 잡힌 재무설계자',
    tagline: '모으면서도 즐겁게, 계획대로 1년을 보냈어요.',
    condition: '순자산이 월급의 4배 이상, 만족도 60 이상',
  },
  ordinary: {
    id: 'ordinary',
    title: '무난한 1년 차',
    tagline: '큰 사고 없이 1년을 버텼어요. 내년엔 목표를 하나 세워 봐요.',
    condition: '위 조건에 해당하지 않음',
  },
};

/** 엔딩 판정 임시 기준값 */
export const ENDING_THRESHOLDS = {
  frugalNetWorthX: 5,
  frugalSatisfactionBelow: 40,
  yoloSatisfactionMin: 80,
  yoloEmergencyMonthsBelow: 1,
  balancedNetWorthX: 4,
  balancedSatisfactionMin: 60,
} as const;
