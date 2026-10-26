import { useState } from 'react';
import { TriangleAlert, X } from 'lucide-react';
import {
  ACCOUNTS,
  formatMan,
  formatWon,
  fundingOptions,
  resolveAmount,
  type Choice,
  type FundingSource,
  type GameState,
  type Won,
} from '@gagyebu/core';
import { cardPlan, sourceLabel } from '../../lib/accounts.ts';
import { Stepper } from '../Stepper.tsx';
import { Money } from '../Money.tsx';

interface PayPanelProps {
  state: GameState;
  choice: Choice;
  onClose: () => void;
  onConfirm: () => void;
  /** 확인 버튼 문구 */
  confirmLabel?: string;
}

/** 지불 패널: 계좌별로 나눠 내고, 카드는 일시불·할부를 고른다 */
export function PayPanel({ state, choice, onClose, onConfirm, confirmLabel }: PayPanelProps) {
  const pay = choice.pay ?? choice.fixedPay;
  if (!pay) return null;
  const adjustable = 'adjustable' in pay ? pay.adjustable : undefined;
  const fixed = !('sources' in pay);
  const [amount, setAmount] = useState<Won>(() => (adjustable ? adjustable.min : resolveAmount(state, pay.amount as never)));
  const options = 'sources' in pay ? fundingOptions(state, pay) : [];
  const [parts, setParts] = useState<Partial<Record<FundingSource, Won>>>({});
  const [cardMonths, setCardMonths] = useState<number>(() => (Array.isArray(pay.cardMonths) ? (pay.cardMonths[0] ?? 1) : 1));
  const to = 'to' in pay ? pay.to : undefined;
  const cardAllowed = options.some((o) => o.source === 'card');
  const paid = Object.entries(parts).reduce((a, [, v]) => a + (v ?? 0), 0);
  const remaining = amount - paid;
  const cardAmount = parts.card ?? 0;
  const plan = cardAmount > 0 ? cardPlan(cardAmount, cardMonths, 'interestFree' in pay ? !!pay.interestFree : false) : null;

  const setPart = (source: FundingSource, v: Won) => setParts((p) => ({ ...p, [source]: v }));
  const confirm = () => onConfirm();

  if (fixed) {
    const fp = choice.fixedPay!;
    const c = cardPlan(fp.amount, fp.cardMonths ?? 1, !!fp.interestFree);
    return (
      <section aria-labelledby="pay-title" className="sheet-in rounded-panel bg-sheet p-4 shadow-[0_0_0_1px_var(--color-rule)] sm:p-5">
        <header className="flex items-start justify-between gap-3">
          <div>
            <h3 id="pay-title" className="text-[17px] font-bold">
              지불 방식 확인
            </h3>
            <p className="text-[13px] text-ink-2">이 선택은 결제 방식이 이미 정해져 있습니다.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="닫기" className="btn btn-quiet min-h-11 px-2.5">
            <X size={18} aria-hidden />
          </button>
        </header>
        <p className="mt-3 rounded-[8px] bg-paper px-3.5 py-3 text-[15px] font-semibold">{fp.label}</p>
        {fp.source === 'savings' ? (
          <p className="mt-2 flex gap-1.5 rounded-[6px] bg-seal-soft px-3 py-2 text-[12px] leading-snug text-seal">
            <TriangleAlert size={13} className="mt-0.5 flex-none" aria-hidden />
            적금에서 꺼내면 적금 전체가 해지되고, 이자가 연 0.5%로 줄어듭니다. 12월 만기 이자도 받지 못합니다.
          </p>
        ) : null}
        {fp.source === 'housing' ? (
          <p className="mt-2 flex gap-1.5 rounded-[6px] bg-seal-soft px-3 py-2 text-[12px] leading-snug text-seal">
            <TriangleAlert size={13} className="mt-0.5 flex-none" aria-hidden />
            청약 통장을 해지하면 가입 기간이 0으로 초기화됩니다.
          </p>
        ) : null}
        <dl className="mt-3 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-[14px]">
          <dt className="text-ink-2">총액</dt>
          <dd className="text-right">
            <Money value={fp.amount} className="font-semibold" />
          </dd>
          <dt className="text-ink-2">내는 곳</dt>
          <dd className="text-right font-medium">{fp.source === 'card' ? '카드' : ACCOUNTS[fp.source].label}</dd>
          {fp.cardMonths && fp.cardMonths > 1 ? (
            <>
              <dt className="text-ink-2">{fp.cardMonths}개월 동안 매달</dt>
              <dd className="text-right">
                <Money value={c.monthly} className="font-bold" />
              </dd>
              <dt className="text-ink-2">할부 수수료</dt>
              <dd className="text-right">{fp.interestFree ? '없음 (무이자)' : formatWon(c.fee)}</dd>
            </>
          ) : null}
        </dl>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn btn-quiet">
            다시 고르기
          </button>
          <button type="button" onClick={confirm} className="btn btn-primary px-5">
            {confirmLabel ?? '이 방식으로 확정'}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="pay-title" className="sheet-in rounded-panel bg-sheet shadow-[0_0_0_1px_var(--color-rule)]">
      <header className="flex items-start justify-between gap-3 border-b border-rule-soft px-4 py-3 sm:px-5">
        <div>
          <h3 id="pay-title" className="text-[17px] font-bold">
            {to ? '어디서 옮길까요?' : '어느 돈으로 낼까요?'}
          </h3>
          <p className="text-[13px] text-ink-2">
            {to ? `${formatMan(amount)}을 ${ACCOUNTS[to].label}로 옮깁니다. 여러 통장에서 나눠 옮길 수 있어요.` : '여러 통장에서 나눠 낼 수 있어요. 합계가 맞아야 확정됩니다.'}
          </p>
        </div>
        <button type="button" onClick={onClose} aria-label="닫기" className="btn btn-quiet min-h-11 px-2.5">
          <X size={18} aria-hidden />
        </button>
      </header>

      <div className="space-y-2 px-4 py-3 sm:px-5">
        {adjustable ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-[8px] bg-paper px-3 py-2">
            <span className="text-[14px] font-semibold">옮길 금액</span>
            <div className="flex items-center gap-2">
              <Stepper label="옮길 금액" value={amount} onChange={setAmount} step={adjustable.step} min={adjustable.min} max={adjustable.max} size="sm" />
            </div>
          </div>
        ) : null}

        <ul className="grid gap-2 sm:grid-cols-2">
          {options.map((o) => {
            const isCard = o.source === 'card';
            const name = isCard ? '신용카드' : ACCOUNTS[o.source as keyof typeof ACCOUNTS].label;
            const value = parts[o.source] ?? 0;
            const p = isCard && value > 0 ? cardPlan(value, cardMonths, 'interestFree' in pay ? !!pay.interestFree : false) : null;
            return (
              <li key={o.source} className={`rounded-[8px] px-3 py-2 ${value > 0 ? 'bg-mark/35 shadow-[inset_0_0_0_1.5px_var(--color-ink-3)]' : 'bg-paper'}`}>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <div className="min-w-0 flex-1 basis-32">
                    <p className="text-[14px] font-semibold leading-tight">{name}</p>
                    <p className="num text-[12px] leading-tight text-ink-2">
                      {isCard ? '한도 없음 · 다음 달 생활비에서 빠짐' : `잔액 ${formatWon(o.max ?? 0)}`}
                    </p>
                  </div>
                  <Stepper
                    label={name}
                    value={value}
                    onChange={(v) => setPart(o.source, v)}
                    step={10_000}
                    min={0}
                    max={isCard ? amount : (o.max ?? 0)}
                    size="sm"
                  />
                  <button
                    type="button"
                    onClick={() => setPart(o.source, Math.min(isCard ? amount : (o.max ?? 0), remaining + value))}
                    className="btn btn-quiet hidden min-h-11 px-2 text-[12px] sm:inline-flex"
                    disabled={remaining === 0}
                    title="남은 금액 채우기"
                  >
                    채우기
                  </button>
                </div>
                {o.warning ? (
                  <p className="mt-1 flex gap-1.5 text-[11.5px] leading-snug text-ink-2">
                    <TriangleAlert size={12} className="mt-0.5 flex-none text-seal" aria-hidden />
                    {o.warning}
                  </p>
                ) : null}
                {isCard && cardAllowed ? (
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    {(Array.isArray(pay.cardMonths) ? pay.cardMonths : [1]).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setCardMonths(m)}
                        aria-pressed={cardMonths === m}
                        className={`btn min-h-11 px-2 text-[12px] ${cardMonths === m ? 'bg-ink text-white' : 'btn-quiet'}`}
                      >
                        {m === 1 ? '일시불' : `${m}개월`}
                      </button>
                    ))}
                    {p ? (
                      <span className="num text-[12px] text-ink-2">
                        매달 <strong className="text-[13px] text-ink">{formatMan(p.monthly)}</strong>
                        {p.fee > 0 ? ` · 수수료 ${formatMan(p.fee)}` : ' · 무이자'}
                      </span>
                    ) : (
                      <span className="text-[11.5px] text-ink-3">금액을 넣으면 매달 갚을 돈을 계산합니다.</span>
                    )}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-rule bg-paper/60 px-4 py-3 sm:px-5">
        <dl className="flex items-center gap-5 text-[13px]">
          <div>
            <dt className="text-ink-2">{to ? '옮길 금액' : '낼 금액'}</dt>
            <dd className="num text-[16px] font-bold">{formatWon(amount)}</dd>
          </div>
          <div>
            <dt className="text-ink-2">지금 정한 금액</dt>
            <dd className="num text-[16px] font-bold">{formatWon(paid)}</dd>
          </div>
          <div>
            <dt className="text-ink-2">남은 금액</dt>
            <dd className={`num text-[16px] font-bold ${remaining === 0 ? 'text-in' : 'text-seal'}`}>{formatWon(remaining)}</dd>
          </div>
        </dl>
        <button
          type="button"
          disabled={remaining !== 0}
          onClick={confirm}
          className="btn btn-primary w-full px-5 sm:w-auto"
          title={remaining !== 0 ? '합계가 맞아야 확정할 수 있어요' : undefined}
        >
          {confirmLabel ?? (to ? '이대로 옮기기' : '이렇게 내기')}
        </button>
      </footer>
    </section>
  );
}

/** 입금 패널: 받은 돈을 어느 통장에 넣을지 고른다 */
export function DepositPanel({
  state,
  choice,
  onClose,
  onConfirm,
}: {
  state: GameState;
  choice: Choice;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const spec = choice.deposit!;
  const amount = resolveAmount(state, spec.amount);
  const [target, setTarget] = useState(spec.targets[0]);
  const loss = state.accounts.invest.earned < 0 ? -state.accounts.invest.earned : 0;
  const sellAll = choice.id === 'sellAll';
  return (
    <section aria-labelledby="deposit-title" className="sheet-in rounded-panel bg-sheet shadow-[0_0_0_1px_var(--color-rule)]">
      <header className="flex items-start justify-between gap-3 border-b border-rule-soft px-4 py-3 sm:px-5">
        <div>
          <h3 id="deposit-title" className="text-[17px] font-bold">
            받은 돈을 어느 통장에 넣을까요?
          </h3>
          <p className="text-[13px] text-ink-2">한 통장만 고를 수 있어요.</p>
        </div>
        <button type="button" onClick={onClose} aria-label="닫기" className="btn btn-quiet min-h-11 px-2.5">
          <X size={18} aria-hidden />
        </button>
      </header>
      <div className="px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <p className="text-[14px] font-semibold text-ink-2">넣을 금액</p>
          <p className="num text-[26px] font-bold leading-none">{formatWon(amount)}</p>
        </div>
        {sellAll && loss > 0 ? (
          <p className="mt-2 flex gap-1.5 rounded-[6px] bg-seal-soft px-3 py-2 text-[13px] leading-snug text-seal">
            <TriangleAlert size={14} className="mt-0.5 flex-none" aria-hidden />
            지금 팔면 손실 {formatWon(loss)}이 확정됩니다. 투자 계좌에 넣은 원금은 {formatWon(state.accounts.invest.contributed)}입니다.
          </p>
        ) : null}
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {spec.targets.map((id) => {
            const on = target === id;
            return (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => setTarget(id)}
                  aria-pressed={on}
                  className={`w-full rounded-[8px] px-3 py-2 text-left ${on ? 'bg-ink text-white' : 'bg-paper hover:bg-white'}`}
                >
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="text-[14px] font-semibold">{ACCOUNTS[id].label}</span>
                    <span className={`num text-[13px] ${on ? 'text-white/80' : 'text-ink-2'}`}>{formatMan(state.accounts[id].balance)} →</span>
                  </span>
                  <span className={`num block text-[16px] font-bold ${on ? 'text-white' : 'text-ink'}`}>
                    {formatWon(state.accounts[id].balance + amount)}
                  </span>
                  <span className={`block text-[12px] leading-snug ${on ? 'text-white/75' : 'text-ink-3'}`}>{ACCOUNTS[id].withdrawRule.split('.')[0]}.</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      <footer className="flex justify-end gap-2 border-t border-rule px-4 py-3 sm:px-5">
        <button type="button" onClick={onClose} className="btn btn-quiet">
          다시 고르기
        </button>
        <button type="button" onClick={onConfirm} disabled={!target} className="btn btn-primary px-5">
          이 통장에 넣기
        </button>
      </footer>
    </section>
  );
}
