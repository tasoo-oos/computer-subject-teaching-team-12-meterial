import { ACCOUNT_ORDER, ACCOUNTS, budgetSummary, formatMan, type AccountId, type GameState } from '@gagyebu/core';
import { Spine } from '../Spine.tsx';
import { Money } from '../Money.tsx';
import { monthDeltas } from '../../lib/month.ts';

/** 통장 6권 + 남은 부채. 이번 달 변화를 함께 보여 준다 */
export function AccountsPanel({ state, highlight }: { state: GameState; highlight?: AccountId[] }) {
  const deltas = monthDeltas(state);
  const debt = state.debts.reduce((a, d) => a + d.remaining, 0);
  return (
    <section aria-labelledby="accounts-title" className="rounded-panel bg-sheet shadow-[0_0_0_1px_var(--color-rule)]">
      <header className="flex items-baseline justify-between border-b border-rule-soft px-4 py-2.5">
        <h2 id="accounts-title" className="text-[15px] font-bold">
          내 통장
        </h2>
        <p className="text-[12px] text-ink-3">이번 달 변화</p>
      </header>
      <ul className="divide-y divide-rule-soft">
        {ACCOUNT_ORDER.map((id) => {
          const a = state.accounts[id];
          const d = deltas[id];
          const on = highlight?.includes(id);
          return (
            <li key={id} className={`flex items-center gap-2.5 px-3 py-2 ${on ? 'bg-mark/35' : ''}`}>
              <Spine id={id} className="h-7" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold leading-tight">{ACCOUNTS[id].label}</p>
                <p className="text-[11px] leading-tight text-ink-3">
                  {id === 'savings' && state.savings.broken ? '해지됨 · 새 적금' : ACCOUNTS[id].purpose.split(',')[0]}
                </p>
              </div>
              <div className="text-right">
                <Money value={a.balance} unit="man" className="block text-[15px] font-bold leading-tight" />
                <Money value={d} signed unit="man" className="block text-[11px] leading-tight" />
              </div>
            </li>
          );
        })}
      </ul>
      <div className="flex items-center justify-between gap-2 border-t border-rule px-4 py-2">
        <span className="text-[13px] font-semibold text-ink-2">남은 부채</span>
        {debt > 0 ? (
          <span className="text-right">
            <Money value={debt} className="block text-[15px] font-bold text-seal" />
            <span className="block text-[11px] leading-tight text-ink-3">{state.debts.map((x) => x.label.split(' ')[0]).join(', ')}</span>
          </span>
        ) : (
          <span className="text-[13px] text-ink-3">없음</span>
        )}
      </div>
    </section>
  );
}

/** 가계부 요약 한 줄: 지출 예산과 남는 돈 */
export function BudgetGlance({ state }: { state: GameState }) {
  const s = budgetSummary(state.budget, state.profile.salary);
  return (
    <p className="text-[12px] leading-relaxed text-ink-2">
      지출 예산 <span className="num font-semibold text-ink">{formatMan(s.expenseTotal)}</span> + 남는 돈{' '}
      <span className="num font-semibold text-ink">{formatMan(Math.max(0, s.remaining))}</span>
      <br />
      월급 <span className="num">{formatMan(s.salary)}</span> 중 자동이체 <span className="num">{formatMan(s.transferTotal)}</span>
    </p>
  );
}
