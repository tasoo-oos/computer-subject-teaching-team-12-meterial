import { ACCOUNTS, EXPENSES, TRANSFER_ORDER, type ExpenseId, type Settlement, type TransferAccountId } from '@gagyebu/core';
import { Money } from '../Money.tsx';

type DiffKey = ExpenseId | TransferAccountId | 'livingBuffer';

const LABEL: Record<DiffKey, string> = {
  ...(Object.fromEntries(Object.entries(EXPENSES).map(([k, v]) => [k, v.label])) as Record<ExpenseId, string>),
  ...(Object.fromEntries(TRANSFER_ORDER.map((id) => [id, ACCOUNTS[id].label])) as Record<TransferAccountId, string>),
  livingBuffer: '생활비 여유분',
};

/** 처음 가계부와 12월 가계부 비교 */
export function BudgetDiff({ settlement, budgetEdits }: { settlement: Settlement; budgetEdits: number }) {
  const rows = settlement.budgetDiff;
  return (
    <section aria-labelledby="diff-title">
      <h2 id="diff-title" className="display text-[26px]">
        처음 가계부 → 12월 가계부
      </h2>
      {rows.length === 0 ? (
        <p className="mt-2 text-[15px] text-ink-2">1년 동안 가계부를 바꾸지 않았습니다. 처음 계획을 그대로 지켰어요.</p>
      ) : (
        <table className="mt-3 w-full text-[14px]">
          <caption className="sr-only">처음 가계부와 12월 가계부의 항목별 차이</caption>
          <thead>
            <tr className="border-b border-rule text-left text-[12px] text-ink-3">
              <th scope="col" className="py-1.5 font-medium">항목</th>
              <th scope="col" className="py-1.5 text-right font-medium">처음</th>
              <th scope="col" className="py-1.5 text-right font-medium">12월</th>
              <th scope="col" className="py-1.5 text-right font-medium">차이</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="ledger-row">
                <th scope="row" className="py-2 text-left font-medium">
                  {LABEL[r.key as DiffKey]}
                </th>
                <td className="py-2 text-right text-ink-2">
                  <Money value={r.before} unit="man" />
                </td>
                <td className="py-2 text-right">
                  <Money value={r.after} unit="man" className="font-semibold" />
                </td>
                <td className={`py-2 text-right font-semibold ${r.after > r.before ? 'text-seal' : 'text-in'}`}>
                  <Money value={r.after - r.before} signed unit="man" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="mt-2 text-[12px] text-ink-3">가계부를 조정한 횟수: {budgetEdits}회 · 월세와 물가가 오르면 계획도 같이 바뀝니다.</p>
    </section>
  );
}
