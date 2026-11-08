// CSV 내보내기 계약 (docs/live-api.md §9.7). 서버는 core를 모르므로(§1.2) 열 정의와
// PaymentPlan→문자열 변환을 이 활동이 소유한다. exportRows는 S4가 구현한다.
import { NotImplementedError } from '@gagyebu/core';
import type { GameState } from '@gagyebu/core';

export const exportColumns: string[] = [
  'studentId',
  'nickname',
  'month',
  'eventCode',
  'sceneId',
  'choiceId',
  'choiceLabel',
  'kind',
  'auto',
  'tags',
  'payment',
];

/** state.decisions를 기록 순서대로 행으로 펼친다. payment는 "emergency:520000;card:80000/3" 형식 문자열 */
export function exportRows(
  _s: GameState,
  _student: { studentId: string; nickname: string },
): Record<string, string | number | boolean>[] {
  throw new NotImplementedError('activity-gagyebu exportRows (§9.7) — S4 구현 예정');
}
