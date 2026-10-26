import { ACCOUNTS, ACCOUNT_ORDER, STATUSES, formatMan, totalDebt, type GameState } from '@gagyebu/core';
import { CreditCard } from 'lucide-react';
import { AccountCard } from '../../components/AccountCard.tsx';
import { Money } from '../../components/Money.tsx';

/** 이번 달 계좌 변화 (월급날 처리 내역 기반) */
export function accountDeltas(state: GameState): Partial<Record<(typeof ACCOUNT_ORDER)[number], number>> {
  const p = state.payday;
  if (!p) return {};
  const living = p.livingIn - p.spending - p.debtPayments;
  return {
    living,
    emergency: p.transfers.emergency + (p.earnings.emergency ?? 0),
    savings: p.transfers.savings + (p.earnings.savings ?? 0),
    invest: p.transfers.invest + (p.earnings.invest ?? 0),
    goal: p.transfers.goal + (p.earnings.goal ?? 0),
    housing: p.transfers.housing + (p.earnings.housing ?? 0),
  };
}

export function AccountPanel({ state, layout = 'grid' }: { state: GameState; layout?: 'grid' | 'strip' }) {
  const deltas = accountDeltas(state);
  const debt = totalDebt(state);
  return (
    <section className="card p-3" aria-label="계좌 잔고">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-sm font-bold text-ink">내 통장 6개</h2>
        <span className="text-[11px] text-ink-3">이번 달 변화</span>
      </div>
      <div className={layout === 'strip' ? 'grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6' : 'grid grid-cols-2 gap-2'}>
        {ACCOUNT_ORDER.map((id) => (
          <AccountCard key={id} id={id} balance={state.accounts[id].balance} delta={deltas[id]} from={Math.max(0, state.accounts[id].balance - (deltas[id] ?? 0))} />
        ))}
      </div>
      <div className={`mt-2 flex items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-[13px] ${debt > 0 ? 'bg-warn-soft text-warn' : 'bg-surface-2 text-ink-2'}`}>
        <span className="flex items-center gap-1.5 font-semibold">
          <CreditCard size={15} aria-hidden /> 남은 부채
        </span>
        <span className="flex items-baseline gap-2">
          {state.debts.length > 0 && <span className="text-[11px] font-normal">{state.debts[0]!.label}</span>}
          <Money value={debt} className="font-bold" />
        </span>
      </div>
      <dl className="sr-only">
        {ACCOUNT_ORDER.map((id) => (
          <div key={id}>
            <dt>{ACCOUNTS[id].label}</dt>
            <dd>{formatMan(state.accounts[id].balance)}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** 상태 효과 목록: 이름, 성격, 남은 기간, note, 행동 버튼 */
export function StatusPanel({ state, onSell }: { state: GameState; onSell?: () => void }) {
  return (
    <section className="card p-3" aria-label="상태 효과">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-sm font-bold text-ink">상태 효과</h2>
        <span className="text-[11px] text-ink-3">{state.statuses.length}개 지속 중</span>
      </div>
      {state.statuses.length === 0 ? (
        <p className="rounded-xl bg-surface-2 px-3 py-3 text-[13px] leading-relaxed text-ink-3">
          지속되는 효과가 없습니다. 선택이 남긴 효과가 생기면 여기에 표시됩니다.
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {state.statuses.map((st) => {
            const def = STATUSES[st.id];
            const remain = st.until ? Math.max(0, st.until - state.month) : null;
            const toneCls =
              def.tone === 'buff'
                ? 'border-emerald-300/70 bg-emerald-50 text-emerald-900'
                : def.tone === 'debuff'
                  ? 'border-orange-300/70 bg-orange-50 text-orange-900'
                  : 'border-line bg-surface-2 text-ink-2';
            return (
              <li key={`${st.id}-${st.since}`} className={`rounded-xl border px-2.5 py-2 ${toneCls}`}>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[13px] font-bold">{def.label}</span>
                  <span className="rounded-full border border-current/30 px-1.5 text-[10px] font-semibold">{TONE_LABEL[def.tone]}</span>
                  <span className="ml-auto text-[10px]">{remain === null ? '직접 해제까지' : remain === 0 ? '이번 달까지' : `${remain}개월 남음`}</span>
                </div>
                <p className="mt-0.5 text-[11px] leading-snug">{def.description}</p>
                {st.note && <p className="num mt-1 text-[12px] font-bold">{st.note}</p>}
                {st.count ? <p className="text-[11px]">보유 {st.count}켤레 · 팔 때 수수료 10%</p> : null}
                {def.actions?.length ? (
                  <button
                    type="button"
                    onClick={onSell}
                    className="mt-1.5 min-h-11 w-full rounded-lg border border-current/30 bg-white/70 px-2 text-[12px] font-bold hover:bg-white"
                  >
                    {def.actions[0]!.label}
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

const TONE_LABEL = { buff: '이득', debuff: '부담', neutral: '중립' } as const;

/** 예약된 장면 예고 + 학습용 가정값 안내 */
export function ScheduledPanel({ state }: { state: GameState }) {
  return (
    <section className="card p-3" aria-label="예약된 장면">
      <h2 className="mb-2 text-sm font-bold text-ink">예약된 장면</h2>
      {state.scheduled.length === 0 ? (
        <p className="rounded-xl bg-surface-2 px-3 py-2.5 text-[13px] leading-relaxed text-ink-3">예약된 장면이 없습니다. 지금의 선택이 몇 달 뒤 장면을 만들 수 있습니다.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {state.scheduled.map((sc) => (
            <li key={`${sc.eventId}-${sc.sceneId}`} className="rounded-xl border border-dashed border-line-strong bg-surface-2 px-2.5 py-2">
              <div className="num text-[11px] font-bold text-primary">{sc.month}월 예정</div>
              <p className="text-[13px] leading-snug text-ink-2">{sc.reason}</p>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-[10px] leading-relaxed text-ink-3">금리·수익률은 학습용 가정값입니다.</p>
    </section>
  );
}
