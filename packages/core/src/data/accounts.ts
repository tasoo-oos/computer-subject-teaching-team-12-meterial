import type { AccountId, AccountMeta, ExpenseId, ExpenseMeta, TransferAccountId } from '../types.ts';

export const ACCOUNT_ORDER: AccountId[] = ['living', 'emergency', 'savings', 'invest', 'goal', 'housing'];
export const TRANSFER_ORDER: TransferAccountId[] = ['emergency', 'savings', 'invest', 'goal', 'housing'];

export const ACCOUNTS: Record<AccountId, AccountMeta> = {
  living: {
    id: 'living',
    label: '생활비 통장',
    product: '입출금 통장 + 체크카드',
    purpose: '고정비와 변동비로 쓰는 돈',
    annualRate: null,
    withdrawRule: '자유롭게 씁니다. 바닥나면 부족분이 카드값으로 넘어가고 만족도가 떨어집니다.',
    guide: '50~60%',
  },
  emergency: {
    id: 'emergency',
    label: '비상금 통장',
    product: '파킹통장, CMA',
    purpose: '사고나 병원비처럼 급할 때 쓰는 돈',
    annualRate: 0.02,
    withdrawRule: '언제든 불이익 없이 꺼낼 수 있습니다.',
    guide: '10% (생활비 3개월분까지)',
  },
  savings: {
    id: 'savings',
    label: '적금',
    product: '12개월 정기적금',
    purpose: '1~3년 뒤에 쓸 목돈',
    annualRate: 0.035,
    withdrawRule: '꺼내면 적금 전체가 해지되고 이자가 연 0.5%로 줄어듭니다.',
    guide: '15~20%',
  },
  invest: {
    id: 'invest',
    label: '투자 계좌',
    product: 'ISA 안의 적립식 ETF',
    purpose: '10년 넘게 묶어 둘 돈',
    annualRate: null,
    withdrawRule: '그 달 평가금으로 팝니다. 떨어졌을 때 팔면 손실이 확정됩니다.',
    guide: '5~10%',
  },
  goal: {
    id: 'goal',
    label: '목표 통장',
    product: '자유적금',
    purpose: '선물 · 취미 · 여행처럼 계획한 즐거움',
    annualRate: 0.02,
    withdrawRule: '계획한 소비에 쓰면 만족도 보너스를 받습니다.',
    guide: '5%',
  },
  housing: {
    id: 'housing',
    label: '청약 통장',
    product: '주택청약종합저축',
    purpose: '내 집 마련 청약 자격',
    annualRate: 0.02,
    withdrawRule: '해지하면 가입 기간이 0으로 초기화됩니다.',
    guide: '월 2~25만 원',
  },
};

export const EXPENSE_ORDER: ExpenseId[] = [
  'rent',
  'phone',
  'insurance',
  'transport',
  'subscription',
  'food',
  'household',
  'beauty',
  'leisure',
  'family',
];

export const EXPENSES: Record<ExpenseId, ExpenseMeta> = {
  rent: { id: 'rent', label: '월세·관리비', group: 'fixed', example: '원룸 월세와 관리비' },
  phone: { id: 'phone', label: '통신비', group: 'fixed', example: '휴대폰 요금' },
  insurance: { id: 'insurance', label: '보험료', group: 'fixed', example: '실손보험' },
  transport: { id: 'transport', label: '교통비', group: 'fixed', example: '대중교통, K-패스' },
  subscription: { id: 'subscription', label: '구독료', group: 'fixed', example: 'OTT, 음악' },
  food: { id: 'food', label: '식비', group: 'variable', example: '식사, 간식, 배달' },
  household: { id: 'household', label: '생활용품', group: 'variable', example: '세제, 휴지' },
  beauty: { id: 'beauty', label: '의류·미용', group: 'variable', example: '옷, 미용실' },
  leisure: { id: 'leisure', label: '여가·문화', group: 'variable', example: '영화, 취미, 모임' },
  family: { id: 'family', label: '경조사비', group: 'variable', example: '축의금, 선물' },
};
