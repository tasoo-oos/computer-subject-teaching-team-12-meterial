// CSV 내보내기 계약 (docs/live-api.md §9.7). 서버는 core를 모르므로(§1.2) 열 정의와
// PaymentPlan→문자열 변환을 이 활동이 소유한다. 서버는 BOM·CSV 이스케이프·인코딩만 담당한다.
import type { GameState, PaymentPlan } from '@gagyebu/core';

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

/** PaymentPlan → "emergency:520000;card:80000/3" 형식 문자열. 지불이 없는 기록은 빈 문자열 */
export function formatPaymentPlan(plan: PaymentPlan): string {
  const parts = (plan.parts ?? []).map((p) => `${p.source}:${p.amount}`);
  if (plan.card) parts.push(`card:${plan.card.amount}/${plan.card.months}`);
  return parts.join(';');
}

/** state.decisions를 기록 순서대로 행으로 펼친다. tags는 ';' 결합, auto는 boolean */
export function exportRows(
  s: GameState,
  student: { studentId: string; nickname: string },
): Record<string, string | number | boolean>[] {
  return s.decisions.map((d) => ({
    studentId: student.studentId,
    nickname: student.nickname,
    month: d.month,
    eventCode: d.eventCode,
    sceneId: d.sceneId,
    choiceId: d.choiceId,
    choiceLabel: d.choiceLabel,
    kind: d.kind,
    auto: d.auto === true,
    tags: (d.tags ?? []).join(';'),
    payment: d.payment ? formatPaymentPlan(d.payment) : '',
  }));
}
