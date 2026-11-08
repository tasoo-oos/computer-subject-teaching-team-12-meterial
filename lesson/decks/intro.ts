// 도입 덱 매니페스트 (데이터만 — 서버 안전). 실제 슬라이드가 들어오기 전까지 slides: [] 로 비워 둔다(§2.3).
import type { DeckManifest } from '@gagyebu/live';

export const introDeck: DeckManifest = {
  id: 'intro',
  title: '수업 도입',
  slides: [],
};
