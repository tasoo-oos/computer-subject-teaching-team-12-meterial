// /stage 본판 콘텐츠 (docs/live-api.md §10.5). 1920×1080 논리 캔버스에 "지금 TV에 보이는 화면"을 그린다.
// 통제 페이지의 TV 미리보기(TVPreview)가 같은 컴포넌트를 축소해 쓴다 — 두 화면이 절대 어긋나지 않게.
//  - 슬라이드 비트 → SlideSurface(슬라이드 표시기 본체)
//  - 활동 비트   → ACTIVITY_VIEWS[activity].Stage (§4.3 StageProps). 등록 안 된 활동은 중립 자리표시
//  - stats는 stats.beat가 커서 비트와 같을 때만 넘긴다(§5.7 — 리뷰 중 다른 비트의 통계는 null 취급)
//  - progress는 lesson.settings.showProgressOnStage일 때만(항상 highMark 기준값)
import type { Beat, BeatRef, ClassState, Lesson, StatsPayload } from '@gagyebu/live';
import { ACTIVITY_VIEWS } from '../activities/registry.ts';
import { SlideSurface, slideOfBeat } from '../activities/slides/SlideCanvas.tsx';

export function sameBeat(a: BeatRef, b: BeatRef): boolean {
  return a.segment === b.segment && a.beat === b.beat;
}

export interface StageContentProps {
  classState: ClassState;
  lesson: Lesson;
  /** lessonBeats(lesson, beatsOf) — useRoleLive.beats */
  beats: { segment: number; beats: Beat[] }[] | null;
  /** 최신 stats 페이로드. beat 불일치 판정은 이 안에서 한다 */
  stats: StatsPayload | null;
  /** 발표자의 활동 상태 (spotlight 없으면 null). 통제 소켓은 받지 못하므로 미리보기에서는 null */
  spotlight: unknown;
  /** 발표자 닉네임 (spotlight 없으면 null). /stage는 spotlightState 페이로드에서,
   *  통제 미리보기는 roster + classState.spotlight에서 클라이언트가 만든다(§14 #132) */
  spotlightName: string | null;
}

export function StageContent({ classState, lesson, beats, stats, spotlight, spotlightName }: StageContentProps) {
  const cursor = classState.cursor;
  const beat = beats?.[cursor.segment]?.beats[cursor.beat] ?? null;
  const segment = lesson.segments[cursor.segment] ?? null;
  if (!beat || !segment) return <StageMessage title="수업 준비 중" />;

  // stats.beat가 커서 비트와 같을 때만 활동 통계로 넘긴다(§5.7). progress는 항상 highMark 기준값
  const beatStats = stats && sameBeat(stats.beat, cursor) ? stats.stats : null;
  const progress = lesson.settings.showProgressOnStage ? (stats?.progress ?? null) : null;

  if (segment.kind === 'slides') {
    const { slideId, step } = slideOfBeat(beat.id);
    return <SlideSurface deckId={segment.deck.id} slideId={slideId} step={step} />;
  }

  const Stage = ACTIVITY_VIEWS[segment.activity]?.Stage;
  if (Stage) {
    return (
      <Stage
        beat={beat}
        revealed={cursor.revealed}
        stats={beatStats}
        spotlight={spotlight}
        spotlightName={spotlightName}
        progress={progress}
      />
    );
  }
  return <BeatPlaceholder beat={beat} />;
}

/** 활동 화면이 아직 등록되지 않았을 때의 중립 자리표시 — 비트 라벨만 크게 (S5가 ACTIVITY_VIEWS에 등록하면 사라진다) */
export function BeatPlaceholder({ beat }: { beat: Beat }) {
  return (
    <div className="paper-texture grid size-full place-items-center px-[120px]">
      <div className="text-center">
        <p className="hatch mx-auto mb-8 h-[3px] w-[120px] rounded-full" aria-hidden />
        <h1 className="display text-[72px] leading-tight text-ink">{beat.label}</h1>
        <p className="mt-6 text-[24px] text-ink-3">이 단계의 전면 화면은 준비 중이에요</p>
      </div>
    </div>
  );
}

/** TV의 대기 안내 — 수업 열기 전·연결 중·끝난 수업 */
export function StageMessage({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="paper-texture grid size-full place-items-center px-[120px]">
      <div className="text-center">
        <p className="hatch mx-auto mb-8 h-[3px] w-[120px] rounded-full" aria-hidden />
        <h1 className="display text-[72px] leading-tight text-ink">{title}</h1>
        {sub ? <p className="mt-6 text-[26px] text-ink-2">{sub}</p> : null}
      </div>
    </div>
  );
}
