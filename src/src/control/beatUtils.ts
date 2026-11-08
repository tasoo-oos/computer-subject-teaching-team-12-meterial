// 비트 주소 비교·평탄화 유틸 (통제 타임라인·NextBar 판정용).
import type { Beat, BeatRef, Cursor } from "@gagyebu/live";

/** 비트 주소 순서 비교 (세그먼트 → 비트) */
export function cmpRef(a: BeatRef, b: BeatRef): number {
  return a.segment - b.segment || a.beat - b.beat;
}

export function refOf(c: Cursor): BeatRef {
  return { segment: c.segment, beat: c.beat };
}

export interface FlatBeat {
  ref: BeatRef;
  beat: Beat;
  /** lesson.segments 인덱스 */
  segment: number;
  /** 레슨 전체의 마지막 비트면 true — Next 버튼 비활성 판정 */
  last: boolean;
}

/** lessonBeats 결과를 1차원 목록으로 편다 */
export function flattenBeats(
  beats: { segment: number; beats: Beat[] }[] | null,
): FlatBeat[] {
  if (!beats) return [];
  const out: FlatBeat[] = [];
  for (const seg of beats) {
    seg.beats.forEach((beat, i) => {
      out.push({
        ref: { segment: seg.segment, beat: i },
        beat,
        segment: seg.segment,
        last: false,
      });
    });
  }
  if (out.length > 0) out[out.length - 1]!.last = true;
  return out;
}
