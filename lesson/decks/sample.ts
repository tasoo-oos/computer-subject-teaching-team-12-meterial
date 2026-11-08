// 시험용 덱 매니페스트 (데이터만 — 서버 안전). M2(플랫폼 골격)·M8(슬라이드) 검증용.
// 렌더 컴포넌트는 src/src/activities/slides/decks/sample.tsx (클라이언트 전용, §2.2).
import type { DeckManifest } from '@gagyebu/live';

export const sampleDeck: DeckManifest = {
  id: 'sample',
  title: '시험용 덱',
  slides: [
    { id: 'hello', label: '인사', notes: '환영 인사와 수업 규칙 안내' },
    { id: 'why', label: '왜 가계부인가', steps: 3, notes: '항목을 하나씩 드러내며 설명 (steps → 3비트)' },
    { id: 'rules', notes: '게임 규칙: 12개월, 매달 장면과 선택' },
  ],
};
