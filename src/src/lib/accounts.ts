import { RATES, type AccountId, type FundingSource } from '@gagyebu/core';

/** 통장 표지 색. CSS 토큰과 같은 값 */
export const ACCOUNT_COLOR: Record<AccountId, string> = {
  living: 'var(--color-acc-living)',
  emergency: 'var(--color-acc-emergency)',
  savings: 'var(--color-acc-savings)',
  invest: 'var(--color-acc-invest)',
  goal: 'var(--color-acc-goal)',
  housing: 'var(--color-acc-housing)',
};

/** 짧은 이름 (좁은 자리용) */
export const ACCOUNT_SHORT: Record<AccountId, string> = {
  living: '생활비',
  emergency: '비상금',
  savings: '적금',
  invest: '투자',
  goal: '목표',
  housing: '청약',
};

/** 표지 위 글자색 (대비 4.5:1 이상) */
export const ACCOUNT_ON: Record<AccountId, string> = {
  living: '#18264a',
  emergency: '#ffffff',
  savings: '#ffffff',
  invest: '#ffffff',
  goal: '#ffffff',
  housing: '#ffffff',
};

export function sourceLabel(s: FundingSource): string {
  return s === 'card' ? '카드' : ACCOUNT_SHORT[s];
}

/**
 * 카드 할부 월 납입금. core에 선택자가 없어 fixtures.ts의 cardDebt와 같은 식을 쓴다.
 * (DESIGN.md "core에 대한 제안" 참고)
 */
export function cardPlan(amount: number, months: number, interestFree = false) {
  const rate = interestFree || months === 1 ? 0 : RATES.installmentApr;
  const total = Math.round(amount * (1 + (rate * months) / 12));
  return { monthly: Math.round(total / months), total, fee: total - amount };
}
