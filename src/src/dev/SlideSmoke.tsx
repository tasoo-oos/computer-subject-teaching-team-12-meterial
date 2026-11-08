// 슬라이드 표시기 스모크 화면 (개발 전용): /dev#/slides 로 연다. scripts/smoke-slides.mjs가
// laptop·tablet·tabletPortrait·phone 4크기로 찍는다(M8 검증, §14 #84).
// 시험용 덱(sample) 전체(단계 공개 포함)를 SlideCanvas로 그리고, 통제 미리보기(SlidePreview)도 함께 둔다.
import { useState } from 'react';
import { deckBeats, type DeckManifest } from '@gagyebu/live';
import { rehearsalLesson } from '@gagyebu/lesson';
import { SlideCanvas, slideOfBeat } from '../activities/slides/SlideCanvas.tsx';
import { SlidePreview } from '../activities/slides/Preview.tsx';

/** 리허설 레슨의 첫 세그먼트가 시험용 덱(sample)이다(lesson/decks/sample.ts) */
const sampleDeck: DeckManifest =
  rehearsalLesson.segments[0]?.kind === 'slides' ? rehearsalLesson.segments[0].deck : { id: 'sample', title: '시험용 덱', slides: [] };

/** 덱의 비트 순서: hello → why--0 → why--1 → why--2 → rules (steps → 3비트) */
const BEATS = deckBeats(sampleDeck);

export function SlideSmoke() {
  const [i, setI] = useState(0);
  const beat = BEATS[i] ?? BEATS[0]!;
  const { slideId, step } = slideOfBeat(beat.id);
  const prev = () => setI((n) => (n - 1 + BEATS.length) % BEATS.length);
  const next = () => setI((n) => (n + 1) % BEATS.length);

  return (
    <div className="min-h-dvh">
      {/* 표시기: 화면을 채운다(스모크 대상) */}
      <SlideCanvas deckId={sampleDeck.id} slideId={slideId} step={step} />
      {/* 개발 조작·미리보기: 화면 아래에 붙는다 (표시기 위 커서 반응 없음 규칙은 캔버스 안에만 적용) */}
      <div
        data-testid="slide-smoke-bar"
        className="fixed inset-x-0 bottom-0 z-10 mx-auto flex max-w-[900px] flex-wrap items-center justify-between gap-3 rounded-t-[10px] bg-sheet/95 px-4 py-3 shadow-[0_-4px_16px_-8px_rgba(24,38,74,.4)] backdrop-blur"
      >
        <p className="num text-[13px] font-semibold text-ink-2">
          {sampleDeck.id}/{slideId} · step {step} <span className="text-ink-3">({i + 1}/{BEATS.length} 비트)</span>
        </p>
        <div className="flex gap-2">
          <button type="button" data-testid="slide-prev" onClick={prev} className="btn btn-quiet h-10 px-4 text-[14px]">
            이전
          </button>
          <button type="button" data-testid="slide-next" onClick={next} className="btn btn-primary h-10 px-4 text-[14px]">
            다음
          </button>
        </div>
      </div>
      <div className="fixed right-3 top-3 z-10 w-[320px] rounded-panel bg-sheet/95 p-3 shadow-[0_0_0_1px_var(--color-rule)] backdrop-blur">
        <SlidePreview deck={sampleDeck} beatId={beat.id} />
      </div>
    </div>
  );
}
