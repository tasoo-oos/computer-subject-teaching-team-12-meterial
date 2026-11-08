// TV용 선택 분포 막대 (docs/live-classroom-plan.md §3 원칙):
// - 모든 막대가 같은 색(잉크 남색) — 많이 고른 쪽을 강조하지 않는다
// - 데이터 순서 그대로 — 정렬·순위 없음
// - 자동 처리 응답은 분포에서 빼고 별도 줄("자동 처리 N명")로 센다
// S5가 가계부 Stage 화면(월 선택 분포·엔딩 분포 등)에서 import해 쓴다.
export interface DistributionItem {
  label: string;
  count: number;
}

export interface DistributionBarsProps {
  /** 데이터 순서 그대로 표시한다 */
  items: DistributionItem[];
  /** 분모(합계). 생략하면 items의 count 합계 */
  total?: number;
  /** 예: "자동 처리 3명". 분포 막대 아래 별도 줄로 표시 */
  autoLine?: string | null;
  className?: string;
}

export function DistributionBars({
  items,
  total,
  autoLine,
  className = "",
}: DistributionBarsProps) {
  const sum = total ?? items.reduce((acc, it) => acc + it.count, 0);
  return (
    <div className={`flex flex-col gap-[14px] ${className}`}>
      {items.map((it) => {
        const pct = sum > 0 ? (it.count / sum) * 100 : 0;
        return (
          <div key={it.label} className="flex items-center gap-6">
            <p className="w-[560px] shrink-0 truncate text-[26px] font-semibold text-ink">
              {it.label}
            </p>
            <div className="h-[46px] flex-1 overflow-hidden rounded-[6px] bg-sheet shadow-[inset_0_0_0_1.5px_var(--color-rule-soft)]">
              {/* 같은 색 막대 — 좋고 나쁨·많고 적음을 색으로 구분하지 않는다 */}
              <div
                className="h-full rounded-[4px] bg-ink"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="num w-[110px] shrink-0 text-right text-[26px] font-bold text-ink">
              {it.count}
              <span className="text-[19px] font-semibold text-ink-3">명</span>
            </p>
          </div>
        );
      })}
      {items.length === 0 ? (
        <p className="text-[24px] text-ink-3">아직 아무도 답하지 않았어요</p>
      ) : null}
      {autoLine ? (
        <p className="mt-2 self-end rounded-[6px] bg-mark/70 px-4 py-1.5 text-[21px] font-semibold text-ink">
          {autoLine}
        </p>
      ) : null}
    </div>
  );
}
