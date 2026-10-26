import { useEffect, useRef, useState } from 'react';
import { Minus, Plus } from 'lucide-react';

const nf = new Intl.NumberFormat('ko-KR');

/** 1만 원 단위 조정 + 직접 입력. 조작 버튼은 44px 터치 영역을 지킨다 */
export function MoneyStepper({
  value,
  onChange,
  label,
  step = 10_000,
  min = 0,
  max,
  disabled = false,
  invalid = false,
  size = 'md',
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
  step?: number;
  min?: number;
  max?: number;
  disabled?: boolean;
  invalid?: boolean;
  size?: 'sm' | 'md';
}) {
  const [text, setText] = useState(nf.format(value));
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setText(nf.format(value));
  }, [value]);
  const clamp = (v: number) => Math.max(min, max === undefined ? v : Math.min(max, v));
  const commit = (raw: string) => {
    const n = Number(raw.replace(/[^0-9]/g, ''));
    const v = clamp(Number.isFinite(n) ? n : 0);
    onChange(v);
    setText(nf.format(v));
  };
  const h = size === 'sm' ? 'h-11' : 'h-12';
  const btn = `flex ${h} w-11 shrink-0 items-center justify-center text-ink-2 transition-colors hover:bg-ink/5 active:bg-ink/10 disabled:text-line-strong disabled:hover:bg-transparent`;
  return (
    <div
      className={`flex items-stretch overflow-hidden rounded-xl border bg-surface ${invalid ? 'border-danger' : 'border-line-strong'} ${disabled ? 'opacity-55' : ''} focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/25`}
    >
      <button type="button" className={btn} aria-label={`${label} 1만 원 줄이기`} disabled={disabled || value <= min} onClick={() => onChange(clamp(value - step))}>
        <Minus size={17} aria-hidden />
      </button>
      <label className="flex min-w-0 flex-1 items-center border-x border-line px-1.5">
        <span className="sr-only">{label} (원)</span>
        <input
          inputMode="numeric"
          className="num w-full min-w-0 bg-transparent text-right text-[15px] font-semibold text-ink outline-none"
          value={text}
          disabled={disabled}
          onFocus={() => (focused.current = true)}
          onChange={(e) => setText(e.target.value)}
          onBlur={(e) => {
            focused.current = false;
            commit(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit((e.target as HTMLInputElement).value);
            if (e.key === 'ArrowUp') {
              e.preventDefault();
              onChange(clamp(value + step));
            }
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              onChange(clamp(value - step));
            }
          }}
        />
        <span className="ml-0.5 shrink-0 text-[11px] text-ink-3" aria-hidden>
          원
        </span>
      </label>
      <button type="button" className={btn} aria-label={`${label} 1만 원 늘리기`} disabled={disabled || (max !== undefined && value >= max)} onClick={() => onChange(clamp(value + step))}>
        <Plus size={17} aria-hidden />
      </button>
    </div>
  );
}
