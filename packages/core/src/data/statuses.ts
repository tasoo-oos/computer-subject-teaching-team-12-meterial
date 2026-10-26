import type { StatusDef, StatusId } from '../types.ts';

export const STATUSES: Record<StatusId, StatusDef> = {
  noLaptop: {
    id: 'noLaptop',
    label: '노트북 없음',
    description: '휴대폰으로 버티는 중. 매달 만족도 -3',
    tone: 'debuff',
    monthly: { satisfaction: -3 },
  },
  laptopInstallment: {
    id: 'laptopInstallment',
    label: '노트북 할부 상환 중',
    description: '매달 12.5만 원이 생활비에서 빠집니다.',
    tone: 'neutral',
  },
  sneakers: {
    id: 'sneakers',
    label: '한정판 운동화 보유',
    description: '시세는 매달 바뀝니다. 팔 때 수수료 10%',
    tone: 'neutral',
    actions: [{ id: 'sellSneakers', label: '지금 시세로 팔기' }],
  },
  frugalMode: {
    id: 'frugalMode',
    label: '절약 모드',
    description: '도시락과 장보기로 식비를 지키는 중. 매달 만족도 -2',
    tone: 'debuff',
    monthly: { satisfaction: -2 },
  },
  revolving: {
    id: 'revolving',
    label: '리볼빙 이용 중',
    description: '남은 카드값에 연 18% 이자가 붙습니다.',
    tone: 'debuff',
  },
  savingsRestarted: {
    id: 'savingsRestarted',
    label: '적금 새로 가입',
    description: '해지한 적금 대신 새 적금에 넣는 중. 12월에는 만기가 되지 않습니다.',
    tone: 'neutral',
  },
};
