import { House, PiggyBank, ShieldPlus, Target, TrendingUp, Wallet, CreditCard, type LucideIcon } from 'lucide-react';
import type { AccountId, FundingSource } from '@gagyebu/core';

/** 계좌 6종(+카드)의 시각 정체성. 모든 화면에서 이 표를 쓴다 */
export interface AccountLook {
  Icon: LucideIcon;
  /** 짧은 이름 (칩, 막대 범례용) */
  short: string;
  text: string;
  bg: string;
  soft: string;
  border: string;
  ring: string;
  fill: string;
}

export const ACCOUNT_LOOK: Record<FundingSource, AccountLook> = {
  living: {
    Icon: Wallet,
    short: '생활비',
    text: 'text-acc-living',
    bg: 'bg-acc-living',
    soft: 'bg-acc-living-soft',
    border: 'border-acc-living',
    ring: 'ring-acc-living',
    fill: 'var(--color-acc-living)',
  },
  emergency: {
    Icon: ShieldPlus,
    short: '비상금',
    text: 'text-acc-emergency',
    bg: 'bg-acc-emergency',
    soft: 'bg-acc-emergency-soft',
    border: 'border-acc-emergency',
    ring: 'ring-acc-emergency',
    fill: 'var(--color-acc-emergency)',
  },
  savings: {
    Icon: PiggyBank,
    short: '적금',
    text: 'text-acc-savings',
    bg: 'bg-acc-savings',
    soft: 'bg-acc-savings-soft',
    border: 'border-acc-savings',
    ring: 'ring-acc-savings',
    fill: 'var(--color-acc-savings)',
  },
  invest: {
    Icon: TrendingUp,
    short: '투자',
    text: 'text-acc-invest',
    bg: 'bg-acc-invest',
    soft: 'bg-acc-invest-soft',
    border: 'border-acc-invest',
    ring: 'ring-acc-invest',
    fill: 'var(--color-acc-invest)',
  },
  goal: {
    Icon: Target,
    short: '목표',
    text: 'text-acc-goal',
    bg: 'bg-acc-goal',
    soft: 'bg-acc-goal-soft',
    border: 'border-acc-goal',
    ring: 'ring-acc-goal',
    fill: 'var(--color-acc-goal)',
  },
  housing: {
    Icon: House,
    short: '청약',
    text: 'text-acc-housing',
    bg: 'bg-acc-housing',
    soft: 'bg-acc-housing-soft',
    border: 'border-acc-housing',
    ring: 'ring-acc-housing',
    fill: 'var(--color-acc-housing)',
  },
  card: {
    Icon: CreditCard,
    short: '카드',
    text: 'text-acc-card',
    bg: 'bg-acc-card',
    soft: 'bg-acc-card-soft',
    border: 'border-acc-card',
    ring: 'ring-acc-card',
    fill: 'var(--color-acc-card)',
  },
};

export function sourceLabel(source: FundingSource, labels: Record<AccountId, { label: string }>): string {
  return source === 'card' ? '신용카드' : labels[source].label;
}
