import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'onDark';

const VARIANT: Record<Variant, string> = {
  primary:
    'bg-primary text-white shadow-[0_2px_0_rgb(15_23_42/0.25)] hover:bg-primary-hover active:translate-y-px active:shadow-none disabled:bg-line-strong disabled:text-ink-2 disabled:shadow-none',
  secondary:
    'bg-surface text-ink border border-line-strong hover:border-ink-3 hover:bg-surface-2 active:shadow-[var(--shadow-press)] disabled:text-ink-3 disabled:bg-surface-2',
  ghost: 'text-ink-2 hover:bg-ink/5 active:bg-ink/10 disabled:text-ink-3',
  onDark: 'on-dark bg-white/10 text-hud-ink border border-white/20 hover:bg-white/15 active:bg-white/20',
};

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' | 'lg'; children: ReactNode }) {
  const sz = size === 'lg' ? 'min-h-14 px-6 text-lg' : size === 'sm' ? 'min-h-11 px-3.5 text-sm' : 'min-h-12 px-5 text-base';
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-[background-color,border-color,transform,box-shadow] duration-150 ${sz} ${VARIANT[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Chip({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${className}`}>
      {children}
    </span>
  );
}

/** 단계 진행 표시 (n/총) */
export function StepDots({ index, total, label }: { index: number; total: number; label: string }) {
  return (
    <div className="flex items-center gap-3" aria-label={`${label} ${index + 1}/${total}`} role="group">
      <div className="flex flex-1 gap-1.5" aria-hidden>
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className={`h-2 flex-1 rounded-full transition-colors duration-300 ${i < index ? 'bg-primary' : i === index ? 'bg-accent' : 'bg-line'}`}
          />
        ))}
      </div>
      <span className="num shrink-0 text-sm font-semibold text-ink-2">
        {index + 1} / {total}
      </span>
    </div>
  );
}

export function SectionTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-2.5 flex items-center justify-between gap-2">
      <h2 className="text-sm font-bold tracking-wide text-ink-2">{children}</h2>
      {aside}
    </div>
  );
}
