// 슬라이드 세그먼트 논리 (docs/live-api.md §2.2, §4.1). 서버·클라이언트가 같은 함수로 비트를 계산한다.
import type { Beat, BeatRef, DeckManifest, Lesson, SlideManifest } from './types.ts';

/**
 * 덱 매니페스트를 show 비트 목록으로 만든다 (서버·클라이언트 공용).
 * 비트 라벨은 SlideManifest.label ?? slideId. steps가 있으면 " (k/n)"을 덧붙인다
 * (k는 1부터 — §14 #64: 사람 표기 기준. 비트 id의 k는 0부터).
 * steps: n인 슬라이드는 비트 n개(비트 k는 항목 0..k까지 드러낸 상태), 없으면 비트 1개.
 */
export function deckBeats(deck: DeckManifest): Beat[] {
  const beats: Beat[] = [];
  for (const slide of deck.slides) {
    const base = slide.label ?? slide.id;
    if (slide.steps === undefined) {
      beats.push(showBeat(slide, slide.id, base));
    } else {
      const n = slide.steps;
      for (let k = 0; k < n; k++) {
        beats.push(showBeat(slide, `${slide.id}--${k}`, `${base} (${k + 1}/${n})`));
      }
    }
  }
  return beats;
}

/** 레슨의 모든 세그먼트를 순서대로 평탄화. 세그먼트별 비트 수와 BeatRef 계산에 쓴다.
 *  활동 세그먼트의 비트는 beatsOf(활동 레지스트리의 beats)로, 슬라이드 세그먼트는 deckBeats로 계산한다. */
export function lessonBeats(
  lesson: Lesson,
  beatsOf: (activityId: string, config: unknown) => Beat[],
): { segment: number; beats: Beat[] }[] {
  return lesson.segments.map((seg, segment) => ({
    segment,
    beats: seg.kind === 'slides' ? deckBeats(seg.deck) : beatsOf(seg.activity, seg.config),
  }));
}

/** 두 비트 주소가 같은지 */
export function sameBeat(a: BeatRef, b: BeatRef): boolean {
  return a.segment === b.segment && a.beat === b.beat;
}

/** a가 b보다 전역 순서상 앞인지 (같으면 false). 커서 < highMark(리뷰 상태) 판정에 쓴다 */
export function beforeBeat(a: BeatRef, b: BeatRef): boolean {
  return a.segment < b.segment || (a.segment === b.segment && a.beat < b.beat);
}

function showBeat(slide: SlideManifest, id: string, label: string): Beat {
  return slide.notes === undefined ? { id, label, mode: 'show' } : { id, label, mode: 'show', notes: slide.notes };
}
