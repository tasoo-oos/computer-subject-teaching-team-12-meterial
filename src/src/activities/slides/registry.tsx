// 슬라이드 렌더 레지스트리 (docs/live-api.md §2.2 계약). 키는 `${deckId}/${slideId}`.
// 슬라이드 컴포넌트는 decks/<deckId>.tsx에 들어 있고 레지스트리만 import한다.
// 레지스트리에 없는 키가 오면 SlideCanvas가 자리표시 오류 슬라이드를 보여 준다(개발 중 드러남).
import type { ComponentType } from 'react';
import { sampleSlides } from './decks/sample.tsx';

/** `${deckId}/${slideId}` → 슬라이드 렌더 컴포넌트 */
export const SLIDE_RENDERERS: Record<string, ComponentType<{ step: number }>> = {
  ...sampleSlides,
};
