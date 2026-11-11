// 가계부 활동 설정 (docs/live-api.md §9.1).
// showProgressOnStage(TV에 완료 인원 표시)는 활동 설정이 아니라 레슨 설정(Lesson.settings, §4.1)이다.
import type { DeckManifest } from '@gagyebu/live';

/** 안내 카드 자리에 넣을 발표 자료(12조, 선택). 게임 안에서 「다음」만으로 개념 설명이 이어지게 한다 */
export interface GuideDeck {
  manifest: DeckManifest;
  /** 설문 비트 앞에 둘 장 id(예: 설문 안내 장). 나머지 장은 설문 결과 뒤, 안내 카드 자리에 */
  beforeSurvey?: string[];
  /** 덱 뒤에 남길 안내 카드 번호(1부터). 덱에 대응하는 장이 없는 카드만 */
  keepGuides?: number[];
}
export interface GagyebuConfig {
  /** 안내 카드 1~6 비트 포함 (기본 true). deck이 있으면 안내 카드 대신 덱의 장(keepGuides 카드만 남김) */
  guide: boolean;
  /** 안내 카드 자리에 넣을 발표 자료(선택). 없으면 지금과 똑같다 */
  deck?: GuideDeck;
  /** 입장 바로 뒤에 둘 도입 덱(선택, 12조). 입장 QR이 수업의 맨 앞에 오게 한다 */
  openingDeck?: DeckManifest;
  /** N월 비트의 공개 토글 (기본 true). false면 reveal 없는 work 비트 */
  monthReveal: boolean;
  /** 발표 비트 포함 (기본 true) */
  spotlight: boolean;
  /** 미완료가 있을 때 next에 확인 대화상자 (기본 true) */
  confirmForce: boolean;
}
