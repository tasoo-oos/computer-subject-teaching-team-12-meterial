// 가계부 활동 설정 (docs/live-api.md §9.1).
// showProgressOnStage(TV에 완료 인원 표시)는 활동 설정이 아니라 레슨 설정(Lesson.settings, §4.1)이다.
export interface GagyebuConfig {
  /** 안내 카드 1~6 비트 포함 (기본 true) */
  guide: boolean;
  /** N월 비트의 공개 토글 (기본 true). false면 reveal 없는 work 비트 */
  monthReveal: boolean;
  /** 발표 비트 포함 (기본 true) */
  spotlight: boolean;
  /** 미완료가 있을 때 next에 확인 대화상자 (기본 true) */
  confirmForce: boolean;
}
