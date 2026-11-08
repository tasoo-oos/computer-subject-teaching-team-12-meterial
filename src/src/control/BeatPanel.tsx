// 비트별 패널 (docs/live-api.md §10.6 "비트별 패널"·"타임라인"의 슬라이드 미리보기).
//  - 슬라이드 비트: SlidePreview(현재·다음 슬라이드 축소 모형 + 발표자 노트)
//  - 활동 비트: 비트 발표자 노트(beat.notes — 통제만 받는 온전한 lesson, §5.2) +
//    ACTIVITY_VIEWS[activity].ControlPanel (등록됐을 때만, stats.beat가 커서 비트와 같을 때만)
import type { Beat, BeatRef, ClassState, Lesson, RosterEntry, StatsPayload } from '@gagyebu/live';
import { ACTIVITY_VIEWS } from '../activities/registry.ts';
import { SlidePreview } from '../activities/slides/Preview.tsx';
import { sameBeat } from '../stage/StageContent.tsx';

export interface BeatPanelProps {
  classState: ClassState;
  lesson: Lesson;
  beats: { segment: number; beats: Beat[] }[] | null;
  stats: StatsPayload | null;
  roster: RosterEntry[];
}

export function BeatPanel({ classState, lesson, beats, stats, roster }: BeatPanelProps) {
  const cursor = classState.cursor;
  const beat = beats?.[cursor.segment]?.beats[cursor.beat] ?? null;
  const segment = lesson.segments[cursor.segment] ?? null;
  if (!beat || !segment) return null;

  if (segment.kind === 'slides') {
    return <SlidePreview deck={segment.deck} beatId={beat.id} cursor={cursor} />;
  }

  // 활동 비트 — stats.beat가 커서 비트와 같을 때만 활동 통계를 넘긴다(§5.7)
  const beatStats = stats && sameBeat(stats.beat, cursor) ? stats.stats : null;
  const ControlPanel = ACTIVITY_VIEWS[segment.activity]?.ControlPanel;

  return (
    <div className="grid gap-2.5">
      <div className="flex items-center gap-2">
        <p className="text-[13px] font-bold">
          {beat.label}
          <span className="ml-1.5 rounded-[4px] bg-rule-soft px-1.5 py-px text-[11px] font-semibold text-ink-3">
            {beat.mode === 'work' ? '작업' : '표시'}
            {beat.reveal ? ' · 공개' : ''}
          </span>
        </p>
      </div>
      {beat.notes ? (
        <p className="rounded-[8px] bg-mark/70 px-3.5 py-2.5 text-[13px] leading-relaxed">
          <span className="font-bold">발표자 노트 </span>
          {beat.notes}
        </p>
      ) : null}
      {ControlPanel ? (
        <ControlPanel beat={beat} revealed={cursor.revealed} stats={beatStats} roster={roster} />
      ) : (
        <p className="rounded-[8px] bg-rule-soft/60 px-3.5 py-2.5 text-[12.5px] text-ink-3">
          이 활동의 통제 패널은 아직 등록되지 않았어요 (ACTIVITY_VIEWS[
          {segment.activity}].ControlPanel).
        </p>
      )}
    </div>
  );
}

/** 리뷰 상태 띠 — 커서가 highMark 앞의 show 비트를 다시 보고 있을 때 (§4.1 리뷰 모드) */
export function ReviewBanner({ onBackToLive }: { onBackToLive: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-panel bg-seal-soft px-4 py-2.5 shadow-[0_0_0_1px_var(--color-seal)]">
      <p className="text-[13.5px] font-semibold text-seal">
        지금 이전 단계를 다시 보여 주고 있어요 (리뷰) — 학생 조작은 잠시 멈춰 있어요
      </p>
      <button
        type="button"
        className="btn h-9 shrink-0 bg-seal px-3.5 text-[13px] text-white hover:bg-[#a12229]"
        onClick={onBackToLive}
      >
        현재 단계로 돌아가기
      </button>
    </div>
  );
}

/** 커서 비트 정보 한 줄 (머리글 아래 요약) */
export function CursorLine({ beat, ref, review }: { beat: Beat | null; ref: BeatRef; review: boolean }) {
  if (!beat) return null;
  return (
    <p className="text-[13px] text-ink-2" data-testid="cursor-line">
      <span className="font-bold">{beat.label}</span>
      <span className="num ml-1.5 text-ink-3">
        {ref.segment}:{ref.beat}
      </span>
      {review ? <span className="ml-1.5 font-semibold text-seal">(리뷰 중)</span> : null}
    </p>
  );
}
