import {
  ArrowDownToLine,
  Bell,
  CreditCard,
  Dices,
  Gift,
  Hand,
  House,
  LifeBuoy,
  MessageCircle,
  Newspaper,
  PiggyBank,
  Receipt,
  SlidersHorizontal,
  Smartphone,
  TrendingUp,
  Wallet,
  BookOpen,
  type LucideIcon,
} from 'lucide-react';
import { ACCOUNTS, type AccountId, type ChoiceKind, type FundingSource, type SceneChannel } from '@gagyebu/core';

export interface AccountLook {
  /** CSS 색 (var) */
  color: string;
  icon: LucideIcon;
  /** 짧은 이름: 생활비, 비상금 … */
  short: string;
}

const shortName = (label: string) => label.replace(/ ?(통장|계좌)$/, '');

export const ACCOUNT_LOOK: Record<AccountId, AccountLook> = {
  living: { color: 'var(--color-acc-living)', icon: Wallet, short: shortName(ACCOUNTS.living.label) },
  emergency: { color: 'var(--color-acc-emergency)', icon: LifeBuoy, short: shortName(ACCOUNTS.emergency.label) },
  savings: { color: 'var(--color-acc-savings)', icon: PiggyBank, short: shortName(ACCOUNTS.savings.label) },
  invest: { color: 'var(--color-acc-invest)', icon: TrendingUp, short: shortName(ACCOUNTS.invest.label) },
  goal: { color: 'var(--color-acc-goal)', icon: Gift, short: shortName(ACCOUNTS.goal.label) },
  housing: { color: 'var(--color-acc-housing)', icon: House, short: shortName(ACCOUNTS.housing.label) },
};

export const CARD_LOOK: AccountLook = { color: 'var(--color-acc-card)', icon: CreditCard, short: '카드' };

export function sourceLook(source: FundingSource): AccountLook {
  return source === 'card' ? CARD_LOOK : ACCOUNT_LOOK[source];
}
export function sourceLabel(source: FundingSource): string {
  return source === 'card' ? '신용카드' : ACCOUNTS[source].label;
}

/** 선택지 유형. 선택지의 생김새는 이것으로만 달라진다 (정답 힌트 금지) */
export const KIND_LOOK: Record<ChoiceKind, { label: string; icon: LucideIcon; hint: string }> = {
  pay: { label: '지불', icon: Wallet, hint: '낼 통장을 직접 고릅니다' },
  fixedPay: { label: '정해진 지불', icon: Receipt, hint: '지불 방식이 정해져 있습니다' },
  free: { label: '돈 쓰지 않음', icon: Hand, hint: '바로 결과로' },
  deposit: { label: '입금', icon: ArrowDownToLine, hint: '넣을 통장을 고릅니다' },
  gamble: { label: '결과는 나중에', icon: Dices, hint: '다음 장면으로 이어집니다' },
  budget: { label: '가계부 변경', icon: SlidersHorizontal, hint: '고른 뒤 가계부를 다시 맞춥니다' },
};

export const CHANNEL_LOOK: Record<SceneChannel, { label: string; icon: LucideIcon }> = {
  narration: { label: '상황', icon: BookOpen },
  messenger: { label: '메신저', icon: MessageCircle },
  sms: { label: '문자 메시지', icon: Smartphone },
  news: { label: '뉴스 속보', icon: Newspaper },
  app: { label: '앱 알림', icon: Bell },
};

/** 인화 띠의 날짜 도장: "1년 차 · 02월" */
export function stamp(month: number): string {
  return `1년 차 · ${String(month).padStart(2, '0')}월`;
}
