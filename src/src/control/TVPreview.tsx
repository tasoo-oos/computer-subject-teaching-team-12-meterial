// TV 미리보기 (docs/live-api.md §10.6 "TV 미리보기"). /stage가 지금 그리는 화면을
// 같은 컴포넌트(StageContent)로 1920×1080 논리 캔버스에 그린 뒤 통제 화면 폭에 맞춰 축소한다.
// 주의: spotlightState는 :stage 룸에만 방송되므로(§5.2) 통제 미리보기의 발표자 상태는 항상 null이다.
// 발표 화면의 최종 확인은 실제 /stage 탭에서 해야 한다(§14 S6 결정).
import type { Beat, ClassState, Lesson, StatsPayload } from '@gagyebu/live';
import { AutoStageThumb } from '../stage/ScaledSurface.tsx';
import { StageContent } from '../stage/StageContent.tsx';

export interface TVPreviewProps {
  classState: ClassState;
  lesson: Lesson;
  beats: { segment: number; beats: Beat[] }[] | null;
  stats: StatsPayload | null;
}

export function TVPreview({ classState, lesson, beats, stats }: TVPreviewProps) {
  return (
    <section className="rounded-panel bg-sheet p-2.5 shadow-[0_0_0_1px_var(--color-rule)]">
      <p className="mb-2 flex items-baseline justify-between px-0.5">
        <span className="text-[12px] font-bold text-ink-2">TV 미리보기 — 지금 전면 화면</span>
        <button
          type="button"
          className="text-[12px] font-semibold text-in hover:underline"
          onClick={() => window.open('/stage', '_blank', 'noopener')}
        >
          크게 열기
        </button>
      </p>
      <AutoStageThumb>
        <StageContent classState={classState} lesson={lesson} beats={beats} stats={stats} spotlight={null} />
      </AutoStageThumb>
    </section>
  );
}
