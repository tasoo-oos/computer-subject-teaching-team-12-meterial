import { useState } from 'react';
import { ArrowLeft, Check, TrendingDown } from 'lucide-react';
import {
  ACCOUNTS,
  formatMan,
  formatWon,
  resolveAmount,
  type AccountId,
  type Choice,
  type GameState,
} from '@gagyebu/core';
import { AccountMark, Button, Money } from '../../components/ui.tsx';

/** 입금 패널: 들어온 돈을 어느 통장에 넣을지 고른다 */
export function DepositPanel({
  state,
  choice,
  onBack,
  onConfirm,
}: {
  state: GameState;
  choice: Choice;
  onBack: () => void;
  onConfirm: (target: AccountId) => void;
}) {
  const dep = choice.deposit!;
  const amount = resolveAmount(state, dep.amount);
  const [target, setTarget] = useState<AccountId>(dep.targets[0] ?? 'emergency');

  const invest = state.accounts.invest;
  const realized = amount > 0 && dep.amount === 'investBalance' ? invest.balance - invest.contributed : 0;

  return (
    <section className="cut flex min-h-full flex-1 flex-col p-4" aria-labelledby="deposit-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold text-mute">입금 계좌 고르기</p>
          <h2 id="deposit-title" className="mt-0.5 text-[18px] font-bold tracking-[-0.01em]">
            {choice.label}
          </h2>
        </div>
        <Button size="sm" onClick={onBack}>
          <ArrowLeft size={15} /> 다른 선택
        </Button>
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-x-8 gap-y-2 rounded-[4px] bg-paper-2 px-3.5 py-2.5">
        <div>
          <p className="text-[11px] font-bold text-mute">받는 돈</p>
          <p className="num text-[28px] leading-tight font-extrabold tracking-[-0.02em]">{formatWon(amount)}</p>
        </div>
        {realized < 0 && (
          <p className="flex items-center gap-1.5 text-[12px] font-semibold text-bad">
            <TrendingDown size={14} aria-hidden /> 손실 확정 <Money value={realized} mode="signed" />
          </p>
        )}
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="입금할 통장">
        {dep.targets.map((id) => {
          const active = target === id;
          const after = state.accounts[id].balance + amount;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setTarget(id)}
              className={`flex items-center gap-2.5 rounded-[4px] border p-2.5 text-left ${
                active ? 'border-ink bg-paper-2 ring-2 ring-ink' : 'border-line-strong hover:bg-paper-2'
              }`}
            >
              <AccountMark id={id} size={24} />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold">{ACCOUNTS[id].label}</p>
                <p className="num text-[11px] text-mute">
                  {formatMan(state.accounts[id].balance)} → <span className="font-semibold text-text">{formatMan(after)}</span>
                </p>
              </div>
              <span className={`flex size-4 shrink-0 items-center justify-center rounded-full border ${active ? 'border-ink bg-ink text-frame' : 'border-line-strong'}`} aria-hidden>
                {active && <Check size={10} strokeWidth={3} />}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-3 rounded-[4px] bg-paper-2 px-3.5 py-3">
        <p className="text-[11px] font-bold text-mute">고른 통장의 이름표</p>
        <p className="mt-1 max-w-[46em] text-[13px] leading-relaxed">
          <b>{ACCOUNTS[target].label}</b> · {ACCOUNTS[target].purpose}
        </p>
        <p className="mt-1 max-w-[46em] text-[11px] leading-relaxed text-mute">{ACCOUNTS[target].withdrawRule}</p>
        {realized < 0 && (
          <p className="mt-2 flex flex-wrap items-center gap-x-2 text-[11px] text-mute">
            <TrendingDown size={13} className="text-bad" aria-hidden />
            매도로 손실이 확정됩니다. 다시 투자하려면 다음 달 가계부에서 자동이체를 정해야 합니다.
          </p>
        )}
      </div>

      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
        <p className="text-[11px] leading-snug text-mute">
          넣은 뒤에는 그 통장의 이름표대로만 쓸 수 있습니다.
          {dep.amount === 'investBalance' ? ' 다시 사려면 새로 투자해야 합니다.' : ''}
        </p>
        <Button variant="plate" onClick={() => onConfirm(target)}>
          {ACCOUNTS[target].label}에 넣기
        </Button>
      </div>
    </section>
  );
}
