import type { PromptId, PromptTemplate } from '../types.ts';

export const PROMPTS: Record<PromptId, PromptTemplate> = {
  budget: {
    id: 'budget',
    stage: '가계부 작성',
    template:
      '나는 사회초년생이고 월급이 {salary}원이야. 한 끼 식비는 {meal} 정도고 배달은 주 {delivery} 시켜. 생활비, 비상금, 적금, 투자, 목표 통장으로 나누는 한 달 가계부를 표로 짜 줘.',
  },
  accounts: {
    id: 'accounts',
    stage: '계좌 분리',
    template: '파킹통장, 적금, ISA의 차이를 고등학생도 이해하게 설명해 줘. 각각 어떤 돈을 넣으면 좋을까?',
  },
  emergency: {
    id: 'emergency',
    stage: '돌발 지출',
    template: '이번 달에 갑자기 {amount}원이 필요해졌어. 지금 내 계좌 잔고는 {accounts}이야. 어느 계좌에서 꺼내는 게 가장 손해가 적을까?',
  },
  temptation: {
    id: 'temptation',
    stage: '유혹 상황',
    template: '{item}을(를) {months}개월 할부로 사려고 해. 총액과 내 저축 계획에 주는 영향을 계산해 줘.',
  },
  crash: {
    id: 'crash',
    stage: '증시 급락',
    template: '내 투자 계좌가 한 달 만에 15% 떨어졌어. 지금 팔면 어떻게 되고, 기다리면 어떤 위험이 있는지 장단점을 알려 줘.',
  },
  fraud: {
    id: 'fraud',
    stage: '사기 의심',
    template: '이런 문자(제안)를 받았어: {message}. 사기일 가능성이 있는지, 확인 방법을 알려 줘.',
  },
};
