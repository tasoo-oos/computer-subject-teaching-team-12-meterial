import { useMemo, useState } from 'react';
import {
  ACCOUNTS,
  RATES,
  formatMan,
  formatWon,
  fundingOptions,
  resolveAmount,
  type Choice,
  type FundingSource,
  type GameState,
  type PaymentPlan,
} from '@gagyebu/core';
import { CalendarClock, CircleAlert, Info } from 'lucide-react';
import { AccountIcon } from '../../components/AccountBadge.tsx';
import { Money } from '../../components/Money.tsx';
import { MoneyStepper } from '../../components/MoneyStepper.tsx';
import { Button } from '../../components/ui.tsx';
import { Sheet } from './Sheet.tsx';

const MONTH_LABEL = (m: number) => (m === 1 ? '일시불' : `${m}개월`);

/** 지불형: 수단별 한도와 경고를 보여 주고 여러 계좌로 나눠 낸다 */
export function PaymentPanel({
  state,
  choice,
  onClose,
  onConfirm,
}: {
  state: GameState;
  choice: Choice;
  onClose: () => void;
  onConfirm: (plan: PaymentPlan) => void;
}) {
  const pay = choice.pay!;
  const options = useMemo(() => fundingOptions(state, pay), [state, pay]);
  const cardMonthsList = pay.cardMonths ?? [1];
  const [adjustable, setAdjustable] = useState(pay.adjustable?.min ?? 0);
  const need = pay.adjustable ? adjustable : resolveAmount(state, pay.amount);
  // 비상금처럼 '이 일에 쓰라고 둔 돈'부터 채워 둔다. 금액은 언제든 바꿀 수 있다
  const firstAccount =
    options.find((o) => o.source === 'emergency' && (o.max ?? 0) > 0) ?? options.find((o) => o.source !== 'card' && (o.max ?? 0) > 0);
  const [parts, setParts] = useState<Partial<Record<FundingSource, number>>>(() =>
    firstAccount ? { [firstAccount.source]: Math.min(firstAccount.max ?? 0, need) } : {},
  );
  const [months, setMonths] = useState<(typeof cardMonthsList)[number]>(cardMonthsList[0] ?? 1);

  const cardAmount = parts.card ?? 0;
  const total = (Object.entries(parts) as [FundingSource, number][]).reduce((a, [, v]) => a + (v || 0), 0);
  const left = need - total;
  const rate = pay.interestFree || months === 1 ? 0 : RATES.installmentApr;
  const monthly = cardAmount > 0 ? Math.round((cardAmount * (1 + (rate * months) / 12)) / months) : 0;
  const ready = left === 0 && need > 0;

  const set = (source: FundingSource, v: number) => setParts((p) => ({ ...p, [source]: v }));

  return (
    <Sheet
      title={choice.label}
      subtitle={`${formatWon(need)}${pay.to ? `을 ${ACCOUNTS[pay.to].label}로 옮깁니다` : '을 어떻게 낼까요?'} · 여러 계좌로 나눠 낼 수 있어요`}
      onClose={onClose}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-baseline gap-2 text-sm">
              <span className="text-ink-2">합계</span>
              <Money value={total} className="text-lg font-bold" />
              <span className="text-ink-3">/ {formatMan(need)}</span>
            </div>
            <div className={`mt-0.5 text-[13px] font-semibold ${left === 0 ? 'text-up' : left > 0 ? 'text-warn' : 'text-danger'}`} role="status">
              {left === 0 ? '금액이 맞았습니다' : left > 0 ? `${formatWon(left)} 더 필요합니다` : `${formatWon(-left)} 넘게 골랐습니다`}
            </div>
          </div>
          <Button size="lg" className="w-full sm:w-auto" disabled={!ready} onClick={() => onConfirm({ parts: (Object.entries(parts) as [FundingSource, number][]).filter(([s, v]) => s !== 'card' && v > 0).map(([source, amount]) => ({ source: source as Exclude<FundingSource, 'card'>, amount })), ...(cardAmount > 0 ? { card: { amount: cardAmount, months } } : {}) })}>
            {formatWon(need)} 확정
          </Button>
        </div>
      }
    >
      {pay.adjustable && (
        <div className="mb-3 rounded-xl border border-line bg-surface-2 p-3">
          <div className="flex items-baseline justify-between text-sm">
            <label htmlFor="adjust-amount" className="font-semibold text-ink-2">
              옮길 금액
            </label>
            <span className="num font-bold text-ink">{formatWon(adjustable)}</span>
          </div>
          <input
            id="adjust-amount"
            type="range"
            min={pay.adjustable.min}
            max={pay.adjustable.max}
            step={pay.adjustable.step}
            value={adjustable}
            onChange={(e) => setAdjustable(Number(e.target.value))}
            className="mt-2 w-full accent-[var(--color-primary)]"
          />
          <div className="num flex justify-between text-[11px] text-ink-3">
            <span>{formatMan(pay.adjustable.min)}</span>
            <span>{formatMan(pay.adjustable.max)}</span>
          </div>
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        {options
          .filter((o) => o.source !== 'card')
          .map((o) => {
            const source = o.source as Exclude<FundingSource, 'card'>;
            const max = o.max ?? 0;
            const value = parts[source] ?? 0;
            return (
              <div key={source} className={`rounded-xl border p-2.5 ${value > 0 ? 'border-primary/60 bg-primary-soft/30' : 'border-line bg-surface'}`}>
                <div className="flex items-center gap-2">
                  <AccountIcon id={source} size="sm" />
                  <span className="text-[13px] font-bold text-ink">{ACCOUNTS[source].label}</span>
                  <span className="num ml-auto text-[11px] text-ink-3">
                    잔고 {formatMan(max)}
                    {max === 0 && ' · 없음'}
                  </span>
                </div>
                <div className="mt-1.5 flex gap-1.5">
                  <div className="min-w-0 flex-1">
                    <MoneyStepper size="sm" label={`${ACCOUNTS[source].label} 낼 금액`} value={value} max={max} onChange={(v) => set(source, Math.min(v, max))} />
                  </div>
                  <button
                    type="button"
                    onClick={() => set(source, Math.max(0, Math.min(max, value + Math.max(0, left))))}
                    className="min-h-11 shrink-0 rounded-lg border border-line-strong bg-surface px-2 text-[11px] font-bold text-ink-2 hover:bg-surface-2"
                    aria-label={`${ACCOUNTS[source].label}에서 낼 수 있는 만큼 채우기`}
                  >
                    채우기
                  </button>
                </div>
                {o.warning && (
                  <p className="mt-1.5 flex items-start gap-1 text-[11px] leading-snug text-warn">
                    <CircleAlert size={12} className="mt-0.5 shrink-0" aria-hidden />
                    {o.warning}
                  </p>
                )}
              </div>
            );
          })}

        {options.some((o) => o.source === 'card') && (
          <div className={`rounded-xl border p-2.5 sm:col-span-2 ${cardAmount > 0 ? 'border-acc-card bg-acc-card-soft/50' : 'border-line bg-surface'}`}>
            <div className="flex flex-wrap items-center gap-2">
              <AccountIcon id="card" size="sm" />
              <span className="text-[13px] font-bold text-ink">신용카드</span>
              <div className="ml-auto flex gap-1" role="group" aria-label="카드 할부 개월">
                {cardMonthsList.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMonths(m)}
                    aria-pressed={months === m}
                    className={`min-h-11 rounded-lg px-2.5 text-[11px] font-bold ${months === m ? 'bg-acc-card text-white' : 'bg-surface-2 text-ink-2 hover:bg-line'}`}
                  >
                    {MONTH_LABEL(m)}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <div className="min-w-0 flex-1">
                <MoneyStepper size="sm" label="카드로 낼 금액" value={cardAmount} max={Math.max(need, cardAmount)} onChange={(v) => set('card', v)} />
              </div>
              <div className="text-[11px] leading-tight text-ink-2">
                {cardAmount > 0 ? (
                  <>
                    <span className="num block font-bold text-ink">매달 {formatWon(monthly)}</span>
                    <span className="num">
                      {months === 1 ? '다음 달 생활비에서' : `${months}회 · 총 ${formatWon(monthly * months)}`}
                      {!pay.interestFree && months > 1 ? ' (수수료 포함)' : ''}
                    </span>
                  </>
                ) : (
                  <span className="flex items-center gap-1 text-ink-3">
                    <CalendarClock size={12} aria-hidden /> 카드값은 다음 달에 청구됩니다
                  </span>
                )}
              </div>
            </div>
            {cardAmount > 0 && months > 1 && (
              <p className="mt-1.5 text-[11px] text-ink-2">
                총액 {formatWon(cardAmount)}을 {months}개월로 나눠 갚습니다. 총 {formatWon(monthly * months)}을 냅니다.
              </p>
            )}
          </div>
        )}
      </div>

      <p className="mt-2 flex items-start gap-1 text-[11px] leading-snug text-ink-3">
        <Info size={12} className="mt-0.5 shrink-0" aria-hidden />
        적금·청약·투자에서 꺼내면 그 계좌의 규칙에 따라 손해가 생깁니다. 경고는 각 수단 아래에 표시됩니다.
      </p>
    </Sheet>
  );
}
