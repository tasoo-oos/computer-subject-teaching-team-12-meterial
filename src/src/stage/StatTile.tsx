// TV용 큰 숫자·통계 타일 (docs/live-classroom-plan.md §3 "TV 집계의 원칙"에 맞춘 중립 표시).
// S5가 가계부 Stage 화면에서도 그대로 import해 쓴다.
export interface StatTileProps {
  /** 표시 값. 숫자는 num 클래스로 자릿수 정렬 */
  value: string | number;
  label: string;
  /** 값 뒤에 붙는 단위 (예: "명", "원") */
  unit?: string;
  className?: string;
}

export function StatTile({ value, label, unit, className = '' }: StatTileProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-panel bg-sheet px-10 py-6 text-center shadow-[0_0_0_1px_var(--color-rule)] ${className}`}
    >
      <p className="display num text-[64px] leading-none text-ink">
        {value}
        {unit ? <span className="ml-2 text-[33px]">{unit}</span> : null}
      </p>
      <p className="mt-3 text-[19px] font-semibold text-ink-2">{label}</p>
    </div>
  );
}
