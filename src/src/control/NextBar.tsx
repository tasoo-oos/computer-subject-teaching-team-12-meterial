// 큰 다음 버튼 + 공개 토글 (docs/live-api.md §10.6 "다음", §5.5 — "다음" 키 하나가 공개 → 다음 비트 순서로).
// 라벨: live 비트가 공개(reveal) 단계이고 아직 공개 전이면 "결과 공개", 아니면 "다음".
// 리뷰 중에는 "다음"이 show 비트를 차례로 지나 highMark로 돌아간다(§5.5-0).
import { ChevronLeft, Eye, EyeOff } from 'lucide-react';

export interface NextBarProps {
  /** 큰 버튼 라벨 — "다음" / "결과 공개" */
  label: string;
  disabled: boolean;
  /** 커서 비트에 공개 토글이 있을 때만 렌더링 */
  revealToggle?: { revealed: boolean; onToggle: (on: boolean) => void } | null;
  onNext: () => void;
  onPrev: () => void;
  prevDisabled?: boolean;
}

export function NextBar({ label, disabled, revealToggle, onNext, onPrev, prevDisabled }: NextBarProps) {
  return (
    <div className="flex items-stretch gap-2.5">
      <button
        type="button"
        className="btn btn-quiet px-4"
        onClick={onPrev}
        disabled={prevDisabled}
        title="이전 표시형 비트 (← / PageUp)"
        aria-label="이전"
      >
        <ChevronLeft size={20} aria-hidden />
      </button>
      <button
        type="button"
        className="btn btn-primary h-16 flex-1 text-[21px]"
        onClick={onNext}
        disabled={disabled}
        data-testid="next-button"
      >
        {label}
      </button>
      {revealToggle ? (
        <button
          type="button"
          className="btn btn-quiet px-4 text-[14px]"
          onClick={() => revealToggle.onToggle(!revealToggle.revealed)}
          title={revealToggle.revealed ? '공개된 상태 — 눌러 다시 감추기' : '지금 결과를 공개'}
        >
          {revealToggle.revealed ? <EyeOff size={17} aria-hidden /> : <Eye size={17} aria-hidden />}
          {revealToggle.revealed ? '비공개' : '공개'}
        </button>
      ) : null}
    </div>
  );
}
