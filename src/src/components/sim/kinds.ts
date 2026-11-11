import { ArrowDownToLine, CalendarClock, Dices, Hand, SlidersHorizontal, Wallet, type LucideIcon } from 'lucide-react';
import type { ChoiceKind } from '@gagyebu/core';

/** 선택지 유형 표시. 좋고 나쁨이 아니라 "누르면 무슨 일이 일어나는지"만 알려 준다 */
export const KIND_META: Record<ChoiceKind, { icon: LucideIcon; label: string }> = {
  pay: { icon: Wallet, label: '통장을 골라 냄' },
  fixedPay: { icon: CalendarClock, label: '정해진 방식으로 냄' },
  free: { icon: Hand, label: '돈을 안 씀' },
  deposit: { icon: ArrowDownToLine, label: '통장에 넣음' },
  gamble: { icon: Dices, label: '결과는 나중에' },
  budget: { icon: SlidersHorizontal, label: '가계부를 고침' },
};
