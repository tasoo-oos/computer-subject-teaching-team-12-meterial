import { ArrowRight, CalendarClock, CircleAlert, Sparkles } from 'lucide-react';
import {
  ACCOUNTS,
  STATUSES,
  EXPENSES,
  budgetSummary,
  formatMan,
  type Delta,
  type GameState,
  type Outcome,
} from '@gagyebu/core';
import { Money } from '../Money.tsx';
import { Spine } from '../Spine.tsx';
import { useActBusy } from '../../lib/actBusy.tsx';

function deltaRow(d: Delta, i: number) {
  switch (d.kind) {
    case 'account':
      return (
        <li key={i} className="flex items-center gap-2 py-1.5">
          <Spine id={d.account} className="h-6" />
          <span className="flex-1 text-[14px]">{ACCOUNTS[d.account].label}</span>
          <Money value={d.amount} signed className="text-[15px] font-semibold" />
        </li>
      );
    case 'satisfaction':
      return (
        <li key={i} className="flex items-center gap-2 py-1.5">
          <span className="flex-1 text-[14px]">만족도</span>
          <span className="num text-[15px] font-semibold">{d.amount > 0 ? `+${d.amount}` : d.amount}</span>
        </li>
      );
    case 'credit':
      return (
        <li key={i} className="flex items-center gap-2 py-1.5">
          <span className="flex-1 text-[14px]">신용점수</span>
          <span className="num text-[15px] font-semibold">{d.amount > 0 ? `+${d.amount}` : d.amount}</span>
        </li>
      );
    case 'debt':
      return (
        <li key={i} className="flex items-center gap-2 py-1.5">
          <span className="flex-1 text-[14px]">{d.label}</span>
          <Money value={-d.amount} signed className="text-[15px] font-semibold" />
        </li>
      );
    case 'status':
      return (
        <li key={i} className="flex items-center gap-2 py-1.5">
          <span className="flex-1 text-[14px]">{STATUSES[d.status].label}</span>
          <span className="text-[13px] text-ink-2">{d.change === 'add' ? '생김' : '사라짐'}</span>
        </li>
      );
    case 'budget':
      return (
        <li key={i} className="flex items-center gap-2 py-1.5">
          <span className="flex-1 text-[14px]">{d.key in EXPENSES ? EXPENSES[d.key as keyof typeof EXPENSES].label : ACCOUNTS[d.key as keyof typeof ACCOUNTS].label} 예산</span>
          <Money value={d.amount} signed className="text-[15px] font-semibold" />
        </li>
      );
  }
}

/** 선택 결과: 피드백, 잔고 변화, 이어지는 장면, 교훈 */
export function OutcomeStage({ state, onContinue }: { state: GameState; onContinue: () => void }) {
  const busy = useActBusy();
  const o: Outcome | null = state.lastOutcome;
  if (!o) return null;
  const monthBudget = budgetSummary(state.budget, state.profile.salary);
  return (
    <div className="grid gap-4">
      <section className="sheet-in rounded-panel bg-ink p-4 text-white sm:p-5" aria-labelledby="outcome-title">
        <p className="text-[13px] font-semibold text-white/70">선택의 결과</p>
        <h2 id="outcome-title" className="mt-1 text-[21px] leading-snug font-bold">
          {o.feedback}
        </h2>
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        <section className="rounded-panel bg-sheet p-4 shadow-[0_0_0_1px_var(--color-rule)]" aria-labelledby="delta-title">
          <h3 id="delta-title" className="text-[15px] font-bold">
            달라진 것
          </h3>
          {o.deltas.length ? (
            <ul className="mt-1 divide-y divide-rule-soft">{o.deltas.map(deltaRow)}</ul>
          ) : (
            <p className="mt-1 text-[13px] text-ink-2">잔고 변화는 없습니다.</p>
          )}
          <p className="mt-2 border-t border-rule-soft pt-2 text-[12px] text-ink-3">
            생활비 예산 {formatMan(monthBudget.expenseTotal)} · 남은 부채{' '}
            {state.debts.reduce((a, d) => a + d.remaining, 0) > 0 ? formatMan(state.debts.reduce((a, d) => a + d.remaining, 0)) : '없음'}
          </p>
        </section>

        <section className="rounded-panel bg-sheet p-4 shadow-[0_0_0_1px_var(--color-rule)]" aria-labelledby="next-title">
          <h3 id="next-title" className="text-[15px] font-bold">
            이다음
          </h3>
          {o.next ? (
            <p className="mt-2 flex items-start gap-2 rounded-[6px] bg-mark/40 px-3 py-2 text-[14px]">
              <ArrowRight size={16} className="mt-0.5 flex-none" aria-hidden />
              같은 달에 이어지는 장면이 있습니다.
            </p>
          ) : o.scheduled ? (
            <p className="mt-2 flex items-start gap-2 rounded-[6px] bg-paper px-3 py-2 text-[14px]">
              <CalendarClock size={16} className="mt-0.5 flex-none" aria-hidden />
              {o.scheduled.month}월에 다시 찾아옵니다. {o.scheduled.reason}
            </p>
          ) : (
            <p className="mt-2 text-[14px] text-ink-2">이 사건은 여기서 끝났습니다. 이번 달 가계부를 다시 볼 수 있어요.</p>
          )}
          {o.budgetReason ? (
            <p className="mt-2 flex items-start gap-2 rounded-[6px] bg-seal-soft px-3 py-2 text-[13px] text-seal">
              <CircleAlert size={15} className="mt-0.5 flex-none" aria-hidden />
              {o.budgetReason}
            </p>
          ) : null}
          {o.lesson ? (
            <p className="mt-3 flex items-start gap-2 border-t border-rule-soft pt-2 text-[13px] leading-relaxed text-ink-2">
              <Sparkles size={15} className="mt-0.5 flex-none text-ink-3" aria-hidden />
              {o.lesson}
            </p>
          ) : null}
        </section>
      </div>

      <div className="flex justify-end">
        <button type="button" onClick={onContinue} disabled={busy} className="btn btn-primary px-6">
          {o.next ? '다음 장면 보기' : o.budgetReason ? '가계부 조정하기' : '계속하기'}
        </button>
      </div>
    </div>
  );
}
