import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { formatMan, formatSignedWon, formatWon, type AccountId, type FundingSource } from '@gagyebu/core';
import { ACCOUNT_LOOK, sourceLook } from '../lib/meta.ts';

type Variant = 'plate' | 'plain' | 'quiet' | 'onInk' | 'ghostInk';

const VARIANT: Record<Variant, string> = {
  plate:
    'bg-ink text-frame hover:bg-ink-3 active:bg-ink-2 disabled:bg-paper-3 disabled:text-mute disabled:cursor-not-allowed',
  plain:
    'bg-paper text-text border border-line-strong hover:bg-paper-2 hover:border-ink-4 disabled:text-mute disabled:border-line disabled:cursor-not-allowed',
  quiet: 'text-text hover:bg-paper-2 disabled:text-mute disabled:cursor-not-allowed',
  onInk: 'bg-paper text-ink hover:bg-flash-soft disabled:bg-ink-3 disabled:text-frame-mute disabled:cursor-not-allowed',
  ghostInk: 'text-frame border border-ink-4 hover:bg-ink-3 disabled:text-frame-mute disabled:cursor-not-allowed',
};

export function Button({
  variant = 'plain',
  size = 'md',
  className = '',
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' | 'lg' }) {
  const sz = size === 'lg' ? 'min-h-14 px-6 text-[17px]' : size === 'sm' ? 'min-h-11 px-3 text-sm' : 'min-h-12 px-4 text-[15px]';
  return (
    <button
      type="button"
      {...rest}
      className={`inline-flex items-center justify-center gap-2 rounded-[5px] font-semibold transition-colors duration-150 ${sz} ${VARIANT[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

/** 금액 표기. 숫자는 항상 tabular */
export function Money({
  value,
  mode = 'won',
  className = '',
}: {
  value: number;
  mode?: 'won' | 'man' | 'signed' | 'signedMan';
  className?: string;
}) {
  const text =
    mode === 'man'
      ? formatMan(value)
      : mode === 'signed'
        ? formatSignedWon(value)
        : mode === 'signedMan'
          ? value === 0
            ? '0원'
            : `${value > 0 ? '+' : ''}${formatMan(value)}`
          : formatWon(value);
  return <span className={`num whitespace-nowrap ${className}`}>{text}</span>;
}

/** 통장 색 표지 */
export function AccountMark({ id, size = 28 }: { id: FundingSource; size?: number }) {
  const look = sourceLook(id);
  const Icon = look.icon;
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-[4px] text-white"
      style={{ background: look.color, width: size, height: size }}
    >
      <Icon size={Math.round(size * 0.56)} strokeWidth={2.2} />
    </span>
  );
}

export function AccountDot({ id }: { id: AccountId }) {
  return <span aria-hidden className="inline-block size-2.5 shrink-0 rounded-[2px]" style={{ background: ACCOUNT_LOOK[id].color }} />;
}

export function Tag({ children, tone = 'ink', className = '' }: { children: ReactNode; tone?: 'ink' | 'line' | 'flash' | 'warn' | 'bad' | 'good'; className?: string }) {
  const t = {
    ink: 'bg-ink text-frame',
    line: 'border border-line-strong text-mute',
    flash: 'bg-flash text-ink',
    warn: 'bg-warn-soft text-warn',
    bad: 'bg-bad-soft text-bad',
    good: 'bg-good-soft text-good',
  }[tone];
  return <span className={`inline-flex items-center gap-1 rounded-[3px] px-1.5 py-0.5 text-xs font-semibold whitespace-nowrap ${t} ${className}`}>{children}</span>;
}

/** 금액 변화: 색은 사실(늘었다/줄었다)만 표시 */
export function Delta({ value, man = true, className = '' }: { value: number; man?: boolean; className?: string }) {
  if (value === 0) return <span className={`num text-mute ${className}`}>변화 없음</span>;
  const color = value > 0 ? 'text-good' : 'text-bad';
  return <Money value={value} mode={man ? 'signedMan' : 'signed'} className={`${color} font-semibold ${className}`} />;
}
