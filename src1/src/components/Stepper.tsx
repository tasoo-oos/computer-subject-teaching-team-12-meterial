import { useEffect, useState } from 'react';
import { Minus, Plus } from 'lucide-react';

const nf = new Intl.NumberFormat('ko-KR');

interface StepperProps {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  label: string;
  size?: 'md' | 'sm';
}

/** 1만 원 단위 스테퍼 + 직접 입력. 금액은 원 단위 정수 */
export function Stepper({ value, onChange, step = 10_000, min = 0, max = Number.MAX_SAFE_INTEGER, label, size = 'md' }: StepperProps) {
  const [draft, setDraft] = useState(nf.format(value));
  useEffect(() => setDraft(nf.format(value)), [value]);
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  const commit = () => {
    const n = Number(draft.replace(/[^0-9]/g, ''));
    onChange(clamp(Number.isFinite(n) ? n : value));
  };
  // 1만 원 단위가 아닌 값(예: 626,400원)도 한 번 누르면 1만 원 눈금에 맞춘다
  const down = () => onChange(clamp(value % step === 0 ? value - step : Math.floor(value / step) * step));
  const up = () => onChange(clamp(value % step === 0 ? value + step : Math.ceil(value / step) * step));
  const h = 'h-11';
  return (
    <div className={`inline-flex ${h} items-stretch overflow-hidden rounded-[8px] bg-white shadow-[inset_0_0_0_1.5px_var(--color-rule)]`}>
      <button
        type="button"
        onClick={down}
        disabled={value <= min}
        aria-label={`${label} ${nf.format(step)}원 줄이기`}
        className="grid w-11 place-items-center text-ink hover:bg-paper disabled:text-rule"
      >
        <Minus size={16} aria-hidden />
      </button>
      <label className="flex items-center border-x border-rule-soft px-2">
        <span className="sr-only">{label} 금액 (원)</span>
        <input
          inputMode="numeric"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'ArrowUp') {
              e.preventDefault();
              up();
            }
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              down();
            }
          }}
          className="num w-[5.6rem] bg-transparent text-right font-semibold outline-none"
        />
        <span className="ml-0.5 text-[13px] text-ink-3">원</span>
      </label>
      <button
        type="button"
        onClick={up}
        disabled={value >= max}
        aria-label={`${label} ${nf.format(step)}원 늘리기`}
        className="grid w-11 place-items-center text-ink hover:bg-paper disabled:text-rule"
      >
        <Plus size={16} aria-hidden />
      </button>
    </div>
  );
}
