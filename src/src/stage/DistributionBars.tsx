// TV용 선택 분포 막대 (docs/live-classroom-plan.md §3 원칙):
// - 모든 막대가 같은 색(잉크 남색) — 많이 고른 쪽을 강조하지 않는다
// - 데이터 순서 그대로 — 정렬·순위 없음
// - 자동 처리 응답은 분포에서 빼고 별도 줄("자동 처리 N명")로 센다
// 좁은 컨테이너(오른쪽 기둥·축소 패널)에서는 라벨+인수가 한 줄, 막대가 그 아래 full 폭으로 쌓이고
// 넓은 컨테이너(≥850px)에서는 라벨(최대 2줄) | 막대(flex-1, 최소 280px) | 인수(고정 폭) 한 줄로 선다(§14 #125).
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

export function DistributionBars({ items, total, autoLine, className = '' }: DistributionBarsProps) {
  const sum = total ?? items.reduce((acc, it) => acc + it.count, 0);
  return (
    <div className={`@container flex flex-col gap-[10px] ${className}`}>
      {items.map((it) => {
        const pct = sum > 0 ? (it.count / sum) * 100 : 0;
        return (
          <div key={it.label} className="flex flex-col gap-0.5 @min-[850px]:flex-row @min-[850px]:items-center @min-[850px]:gap-5">
            {/* 좁은 컨테이너: 라벨+인수 한 줄. 넓은 컨테이너: contents로 풀어 한 줄 레이아웃에 참여 */}
            <div className="flex items-baseline justify-between gap-3 @min-[850px]:contents">
              <p className="line-clamp-2 text-[28px] leading-[1.2] font-semibold text-ink @min-[850px]:w-[440px] @min-[850px]:shrink-0">
                {it.label}
              </p>
              <p className="num shrink-0 text-[28px] font-bold text-ink @min-[850px]:w-[110px] @min-[850px]:text-right">
                {it.count}
                <span className="text-[19px] font-semibold text-ink-3">명</span>
              </p>
            </div>
            <div className="h-[30px] w-full overflow-hidden rounded-[6px] bg-sheet shadow-[inset_0_0_0_1.5px_var(--color-rule-soft)] @min-[850px]:h-[46px] @min-[850px]:min-w-[280px] @min-[850px]:flex-1">
              {/* 같은 색 막대 — 좋고 나쁨·많고 적음을 색으로 구분하지 않는다 */}
              <div className="h-full rounded-[4px] bg-ink" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
      {items.length === 0 ? <p className="text-[24px] text-ink-3">아직 아무도 답하지 않았어요</p> : null}
      {autoLine ? (
        <p className="mt-2 self-start rounded-[6px] bg-mark/70 px-4 py-1.5 text-[21px] font-semibold text-ink">
          {autoLine}
        </p>
      ) : null}
    </div>
  );
}
