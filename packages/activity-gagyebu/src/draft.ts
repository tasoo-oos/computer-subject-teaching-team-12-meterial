// 가계부 활동의 초안 타입 (docs/live-api.md §9.5).
import type { Budget } from '@gagyebu/core';

/** 가계부 작성·조정 비트에서 2초 간격으로 묶어 보내는 편집 중인 안.
 *  클라이언트는 제출(act) 직전에 마지막 초안을 즉시 flush한다(§5.4). */
export interface GagyebuDraft {
  kind: 'budget';
  budget: Budget;
}
