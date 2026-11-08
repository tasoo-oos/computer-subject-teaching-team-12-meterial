// 마무리 덱 매니페스트 (데이터만 — 서버 안전). 실제 슬라이드가 들어오기 전까지 slides: [] 로 비워 둔다(§2.3).
import type { DeckManifest } from '@gagyebu/live';

export const wrapUpDeck: DeckManifest = {
  id: 'wrap-up',
  title: '마무리',
  slides: [],
};
