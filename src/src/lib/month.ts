import { ACCOUNT_ORDER, TRANSFER_ORDER, type AccountId, type GameState, type Won } from '@gagyebu/core';

/**
 * 이번 달 계좌별 변화: 월급날 처리(자동이체, 생활비 입출금, 이자·수익) + 이번 달 선택의 계좌 변화.
 * 화면 표시용 합성이며 새 금액을 계산하지 않는다.
 */
export function monthDeltas(state: GameState): Record<AccountId, Won> {
  const out = Object.fromEntries(ACCOUNT_ORDER.map((id) => [id, 0])) as Record<AccountId, Won>;
  const p = state.payday;
  if (p) {
    for (const id of TRANSFER_ORDER) out[id] += p.transfers[id];
    out.living += p.livingIn - p.spending - p.debtPayments;
    for (const id of ACCOUNT_ORDER) out[id] += p.earnings[id] ?? 0;
  }
  for (const d of state.decisions) {
    if (d.month !== state.month || !d.payment) continue;
    for (const part of d.payment.parts) out[part.source] -= part.amount;
  }
  return out;
}
