import { formatMan, formatSignedWon, formatWon, type Won } from '@gagyebu/core';

interface MoneyProps {
  value: Won;
  /** won: 1,234,567원 / man: 123.5만 원 */
  unit?: 'won' | 'man';
  /** 부호를 붙이고 입금 파랑·출금 빨강으로 표시 */
  signed?: boolean;
  className?: string;
}

export function Money({ value, unit = 'won', signed = false, className = '' }: MoneyProps) {
  let text: string;
  if (signed) {
    text = unit === 'man' ? (value > 0 ? `+${formatMan(value)}` : value === 0 ? '0원' : formatMan(value)) : formatSignedWon(value);
  } else {
    text = unit === 'man' ? formatMan(value) : formatWon(value);
  }
  const tone = signed ? (value > 0 ? 'text-in' : value < 0 ? 'text-seal' : 'text-ink-3') : '';
  return <span className={`num whitespace-nowrap ${tone} ${className}`}>{text}</span>;
}
