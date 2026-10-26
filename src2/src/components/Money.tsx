import { formatMan, formatSignedWon, formatWon } from '@gagyebu/core';
import { useCountUp } from '../lib/motion.ts';

/** 금액 표기. 숫자는 항상 tabular-nums */
export function Money({
  value,
  short = false,
  signed = false,
  tone = false,
  className = '',
}: {
  value: number;
  short?: boolean;
  signed?: boolean;
  /** 부호에 따라 색을 입힌다 (결과·변화량 표시에만 사용, 선택지에는 쓰지 않음) */
  tone?: boolean;
  className?: string;
}) {
  const text = short ? (signed && value > 0 ? `+${formatMan(value)}` : formatMan(value)) : signed ? formatSignedWon(value) : formatWon(value);
  const color = tone ? (value > 0 ? 'text-up' : value < 0 ? 'text-down' : 'text-ink-3') : '';
  return <span className={`num ${color} ${className}`}>{text}</span>;
}

/** 카운트업하는 금액 */
export function CountMoney({
  value,
  from = 0,
  duration = 800,
  delay = 0,
  short = false,
  className = '',
}: {
  value: number;
  from?: number;
  duration?: number;
  delay?: number;
  short?: boolean;
  className?: string;
}) {
  const v = useCountUp(value, { from, duration, delay });
  return (
    <span className={`num ${className}`} aria-label={formatWon(value)}>
      <span aria-hidden>{short ? formatMan(v) : formatWon(v)}</span>
    </span>
  );
}
