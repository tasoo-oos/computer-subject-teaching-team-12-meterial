// 통제 페이지용 슬라이드 미리보기 (docs/live-api.md §10.6 "TV 미리보기", M8).
// S6이 통제 페이지에 끼워 넣는다: 커서가 슬라이드 세그먼트에 있을 때
//   const seg = lesson.segments[classState.cursor.segment];  // kind === 'slides'
//   <SlidePreview deck={seg.deck} beatId={beat.id} />
// 지금 화면(현재 슬라이드 축소 모형) + 다음 슬라이드 축소 모형 + 발표자 노트를 보여 준다.
import { deckBeats, type BeatRef, type DeckManifest } from '@gagyebu/live';
import { slideOfBeat, SlideSurface } from './SlideCanvas.tsx';

/** 고정 폭 축소 모형 (표시기와 같은 렌더, 크기만 다르다) */
export function SlideThumb({ deckId, slideId, step, width }: { deckId: string; slideId: string; step: number; width: number }) {
  const scale = width / 1920;
  return (
    <div className="overflow-hidden rounded-[6px] bg-sheet shadow-[0_0_0_1px_var(--color-rule)]" style={{ width, height: width * (1080 / 1920) }}>
      <div style={{ width: 1920, height: 1080, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
        <SlideSurface deckId={deckId} slideId={slideId} step={step} />
      </div>
    </div>
  );
}

/** 커서 비트 다음 슬라이드 비트(같은 덱 안에서). 없으면 null */
function nextBeatOf(deck: DeckManifest, ref: { slideId: string; step: number }): { slideId: string; step: number } | null {
  const beats = deckBeats(deck);
  const i = beats.findIndex((b) => slideOfBeat(b.id).slideId === ref.slideId && slideOfBeat(b.id).step === ref.step);
  const next = i >= 0 ? beats[i + 1] : undefined;
  return next ? slideOfBeat(next.id) : null;
}

/**
 * 통제용 미리보기: 현재 슬라이드 + 다음 슬라이드 축소 모형 + 발표자 노트.
 * 노트는 통제가 받는 온전한 lesson(§5.2)의 SlideManifest.notes에서 온다.
 */
export function SlidePreview({ deck, beatId, cursor }: { deck: DeckManifest; beatId: string; cursor?: BeatRef }) {
  const cur = slideOfBeat(beatId);
  const next = nextBeatOf(deck, cur);
  const notes = deck.slides.find((s) => s.id === cur.slideId)?.notes;
  return (
    <div className="grid gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[13px] font-bold text-ink-2">
          TV 미리보기 · <span className="num">{deck.title}</span>
        </p>
        {cursor ? (
          <p className="num text-[12px] text-ink-3">
            {cursor.segment}:{cursor.beat}
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap items-start gap-3">
        <figure className="m-0">
          <figcaption className="mb-1 text-[12px] font-semibold">지금</figcaption>
          <SlideThumb deckId={deck.id} slideId={cur.slideId} step={cur.step} width={288} />
        </figure>
        {next ? (
          <figure className="m-0 opacity-80">
            <figcaption className="mb-1 text-[12px] font-semibold text-ink-3">다음</figcaption>
            <SlideThumb deckId={deck.id} slideId={next.slideId} step={next.step} width={168} />
          </figure>
        ) : (
          <p className="self-end pb-2 text-[12px] text-ink-3">다음 슬라이드 없음 (덱 끝)</p>
        )}
      </div>
      {notes ? (
        <p className="rounded-[8px] bg-mark/70 px-3.5 py-2.5 text-[13px] leading-relaxed">
          <span className="font-bold">발표자 노트 </span>
          {notes}
        </p>
      ) : null}
    </div>
  );
}
