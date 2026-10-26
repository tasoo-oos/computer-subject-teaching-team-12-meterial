import { useState } from 'react';
import { ACCOUNTS, formatMan, formatSignedWon, formatWon, resolveAmount, type AccountId, type Choice, type GameState } from '@gagyebu/core';
import { CircleAlert, Info } from 'lucide-react';
import { AccountIcon } from '../../components/AccountBadge.tsx';
import { Money } from '../../components/Money.tsx';
import { Button } from '../../components/ui.tsx';
import { Sheet } from './Sheet.tsx';

/** 입금형: 들어온 돈을 어느 계좌에 넣을지 고른다. 매도면 손실 확정액도 보여 준다 */
export function DepositPanel({
  state,
  choice,
  onClose,
  onConfirm,
}: {
  state: GameState;
  choice: Choice;
  onClose: () => void;
  onConfirm: (target: AccountId) => void;
}) {
  const dep = choice.deposit ?? choice.pay;
  const amount = dep ? resolveAmount(state, dep.amount) : 0;
  const targets = (choice.deposit?.targets ?? []) as AccountId[];
  const [target, setTarget] = useState<AccountId>(targets[0] ?? 'emergency');
  const selling = dep?.amount === 'investBalance';
  const loss = selling ? state.accounts.invest.balance - state.accounts.invest.contributed : 0;
  const isGain = loss > 0;

  return (
    <Sheet
      title={choice.label}
      subtitle={`${formatWon(amount)}을 어느 통장에 넣을까요?`}
      onClose={onClose}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-[13px] text-ink-2">
            <span className="text-ink-3">넣는 곳 </span>
            <strong className="text-ink">{ACCOUNTS[target].label}</strong>
          </div>
          <Button size="lg" className="w-full sm:w-auto" onClick={() => onConfirm(target)}>
            {formatWon(amount)} 입금
          </Button>
        </div>
      }
    >
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2 rounded-xl border border-line bg-surface-2 px-3 py-2.5">
        <div>
          <div className="text-[11px] font-semibold text-ink-3">{selling ? '매도 대금' : '받을 금액'}</div>
          <Money value={amount} className="text-2xl font-bold text-ink" />
        </div>
        {selling && (
          <div className={`rounded-lg px-2.5 py-1.5 text-right text-[12px] ${isGain ? 'bg-up-soft text-up' : 'bg-danger-soft text-danger'}`}>
            <div className="font-bold">{isGain ? '평가 이익' : '손실 확정'}</div>
            <div className="num font-bold">{formatSignedWon(loss)}</div>
          </div>
        )}
      </div>

      {selling && (
        <p className={`mb-3 flex items-start gap-1.5 rounded-xl px-3 py-2 text-[12px] leading-snug ${isGain ? 'bg-surface-2 text-ink-2' : 'bg-warn-soft text-warn'}`}>
          <CircleAlert size={14} className="mt-0.5 shrink-0" aria-hidden />
          {isGain
            ? '지금 팔면 그 달 평가금으로 정리됩니다. 이후 시장이 올라도 이 계좌에는 영향이 없습니다.'
            : '지금 팔면 그 달 평가금으로 정리되어, 떨어진 만큼의 손실이 확정됩니다. 다시 오르더라도 되돌릴 수 없습니다.'}
        </p>
      )}

      <fieldset>
        <legend className="mb-2 text-sm font-bold text-ink">넣을 통장</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {targets.map((id) => {
            const active = target === id;
            return (
              <label
                key={id}
                className={`flex min-h-16 items-center gap-2.5 rounded-xl border-2 px-3 py-2 transition-colors ${active ? 'border-primary bg-primary-soft/40' : 'border-line bg-surface hover:border-line-strong'}`}
              >
                <input type="radio" name="deposit-target" checked={active} onChange={() => setTarget(id)} className="sr-only" />
                <AccountIcon id={id} />
                <span className="min-w-0">
                  <span className="block text-[14px] font-bold text-ink">{ACCOUNTS[id].label}</span>
                  <span className="num block text-[11px] text-ink-3">지금 {formatMan(state.accounts[id].balance)}</span>
                </span>
                <span className={`ml-auto size-4 shrink-0 rounded-full border-2 ${active ? 'border-primary bg-primary' : 'border-line-strong'}`} aria-hidden />
              </label>
            );
          })}
        </div>
      </fieldset>
      <p className="mt-2 flex items-start gap-1 text-[11px] leading-snug text-ink-3">
        <Info size={12} className="mt-0.5 shrink-0" aria-hidden />
        넣은 뒤에는 그 통장의 이름표에 맞게만 쓸 수 있습니다. 생활비 통장에 넣으면 이번 달 쓸 돈이 됩니다.
      </p>
    </Sheet>
  );
}
