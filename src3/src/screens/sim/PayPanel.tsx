import { useState } from 'react';
import { ArrowLeft, CreditCard, TriangleAlert } from 'lucide-react';
import {
  ACCOUNTS,
  RATES,
  formatMan,
  formatWon,
  fundingOptions,
  resolveAmount,
  type AccountId,
  type CardMonths,
  type Choice,
  type GameState,
  type PaymentPlan,
} from '@gagyebu/core';
import { AccountMark, Button, Money } from '../../components/ui.tsx';
import { sourceLabel } from '../../lib/meta.ts';

const STEP = 10_000;
const MAX_SOURCES: AccountId[] = ['living', 'emergency', 'goal', 'invest', 'savings', 'housing'];

function plannedMonthly(total: number, months: CardMonths, annualRate: number) {
  return Math.round((total * (1 + (annualRate * months) / 12)) / months);
}

/** 지불 패널: 수단별 한도와 경고를 보여 주고 여러 통장·카드로 나눠 낸다 */
export function PayPanel({
  state,
  choice,
  onBack,
  onConfirm,
}: {
  state: GameState;
  choice: Choice;
  onBack: () => void;
  onConfirm: (plan: PaymentPlan) => void;
}) {
  const pay = choice.pay!;
  const amount = resolveAmount(state, pay.amount);
  const options = fundingOptions(state, pay);
  const [parts, setParts] = useState<Partial<Record<AccountId, number>>>({});
  const [cardAmount, setCardAmount] = useState(0);
  const [months, setMonths] = useState<CardMonths>(pay.cardMonths?.[0] ?? 1);

  const allocated = MAX_SOURCES.reduce((a, id) => a + (parts[id] ?? 0), 0) + cardAmount;
  const remaining = amount - allocated;
  const over = remaining < 0;
  const perMonth = plannedMonthly(cardAmount, months, pay.interestFree ? 0 : RATES.installmentApr);
  const cardOptions = pay.cardMonths ?? [];
  const chosen = MAX_SOURCES.map((id) => ({ id, amount: parts[id] ?? 0 })).filter((x) => x.amount > 0);
  const risky = chosen.filter((x) => x.id === 'savings' || x.id === 'housing' || x.id === 'invest');

  const setPart = (id: AccountId, v: number) => {
    const cap = state.accounts[id].balance;
    setParts((p) => ({ ...p, [id]: Math.max(0, Math.min(cap, Math.round(v / STEP) * STEP)) }));
  };

  const confirm = () => {
    if (remaining !== 0 || over) return;
    const plan: PaymentPlan = {
      parts: chosen.map((x) => ({ source: x.id, amount: x.amount })),
    };
    if (cardAmount > 0) plan.card = { amount: cardAmount, months };
    onConfirm(plan);
  };

  return (
    <section className="cut flex flex-1 flex-col p-4" aria-labelledby="pay-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold text-mute">지불 수단 고르기</p>
          <h2 id="pay-title" className="mt-0.5 text-[18px] font-bold tracking-[-0.01em]">
            {choice.label}
          </h2>
          <p className="mt-0.5 text-[12px] text-mute">
            낼 돈 <Money value={amount} className="font-semibold text-text" /> · 여러 통장으로 나눠 낼 수 있습니다
            {pay.to && ` · ${sourceLabel(pay.to)}으로 옮깁니다`}
          </p>
        </div>
        <Button size="sm" onClick={onBack}>
          <ArrowLeft size={15} /> 다른 선택
        </Button>
      </div>

      <div className={`mt-3 flex flex-wrap items-end justify-between gap-3 rounded-[4px] px-3.5 py-2.5 ${remaining === 0 ? 'bg-flash' : over ? 'bg-bad-soft' : 'bg-paper-2'}`}>
        <div>
          <p className={`text-[11px] font-bold ${over ? 'text-bad' : 'text-mute'}`}>{over ? '넘긴 금액' : remaining === 0 ? '다 맞았습니다' : '남은 금액'}</p>
          <p className={`num text-[28px] leading-tight font-extrabold tracking-[-0.02em] ${over ? 'text-bad' : ''}`}>{formatWon(Math.abs(remaining))}</p>
        </div>
        <p className="text-[11px] text-mute">
          통장 {formatMan(allocated - cardAmount)} + 카드 {formatMan(cardAmount)}
        </p>
      </div>

      <div className="mt-3 grid gap-2 lg:grid-cols-2">
        {MAX_SOURCES.map((id) => {
          const opt = options.find((o) => o.source === id);
          if (!opt) return null;
          const balance = state.accounts[id].balance;
          const value = parts[id] ?? 0;
          return (
            <div key={id} className="rounded-[4px] border border-line p-2.5">
              <div className="flex items-center gap-2">
                <AccountMark id={id} size={22} />
                <p className="text-[13px] font-semibold">{sourceLabel(id)}</p>
                <p className="num ml-auto text-[11px] text-mute">잔고 {formatMan(balance)}</p>
              </div>
              <div className="mt-1.5 flex items-center gap-1.5">
                <div className="flex flex-1 items-center rounded-[4px] border border-line-strong bg-paper">
                  <button
                    type="button"
                    aria-label={`${sourceLabel(id)} 1만 원 줄이기`}
                    disabled={value === 0}
                    onClick={() => setPart(id, value - STEP)}
                    className="h-9 w-9 shrink-0 text-mute hover:text-text disabled:opacity-30"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    aria-label={`${sourceLabel(id)}에서 낼 금액 (만 원)`}
                    value={Math.round((value / 10_000) * 10) / 10}
                    onChange={(e) => setPart(id, (Number.parseFloat(e.target.value) || 0) * 10_000)}
                    className="num h-9 w-full min-w-0 bg-transparent text-right text-[13px] font-semibold focus:outline-none"
                  />
                  <span className="mr-1 shrink-0 text-[10px] text-mute">만</span>
                  <button
                    type="button"
                    aria-label={`${sourceLabel(id)} 1만 원 늘리기`}
                    disabled={value >= balance}
                    onClick={() => setPart(id, value + STEP)}
                    className="h-9 w-9 shrink-0 text-mute hover:text-text disabled:opacity-30"
                  >
                    +
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setPart(id, balance)}
                  disabled={balance === 0}
                  className="h-9 shrink-0 rounded-[4px] border border-line-strong px-2 text-[11px] font-semibold text-mute hover:bg-paper-2 hover:text-text disabled:opacity-40"
                >
                  최대
                </button>
              </div>
              {opt.warning && (
                <p className={`mt-1.5 flex gap-1 text-[11px] leading-snug ${id === 'savings' || id === 'housing' ? 'text-warn' : 'text-mute'}`}>
                  <TriangleAlert size={12} className="mt-0.5 shrink-0" aria-hidden /> {opt.warning}
                </p>
              )}
            </div>
          );
        })}

        {cardOptions.length > 0 && (
          <div className="rounded-[4px] border border-line p-2.5">
            <div className="flex items-center gap-2">
              <span className="flex size-[22px] items-center justify-center rounded-[4px] bg-ink text-frame" aria-hidden>
                <CreditCard size={13} />
              </span>
              <p className="text-[13px] font-semibold">카드</p>
              <p className="ml-auto text-[11px] text-mute">한도 없음 · 다음 달 청구</p>
            </div>
            <div className="mt-1.5 flex items-center gap-1.5">
              <div className="flex flex-1 items-center rounded-[4px] border border-line-strong bg-paper">
                <button type="button" aria-label="카드 금액 1만 원 줄이기" disabled={cardAmount === 0} onClick={() => setCardAmount(Math.max(0, cardAmount - STEP))} className="h-9 w-9 shrink-0 text-mute hover:text-text disabled:opacity-30">
                  −
                </button>
                <input
                  type="number"
                  aria-label="카드로 낼 금액 (만 원)"
                  value={Math.round((cardAmount / 10_000) * 10) / 10}
                  onChange={(e) => setCardAmount(Math.max(0, Math.round((Number.parseFloat(e.target.value) || 0) * 10) * 1_000))}
                  className="num h-9 w-full min-w-0 bg-transparent text-right text-[13px] font-semibold focus:outline-none"
                />
                <span className="mr-1 shrink-0 text-[10px] text-mute">만</span>
                <button type="button" aria-label="카드 금액 1만 원 늘리기" onClick={() => setCardAmount(cardAmount + STEP)} className="h-9 w-9 shrink-0 text-mute hover:text-text">
                  +
                </button>
              </div>
              <div className="flex shrink-0 gap-1" role="radiogroup" aria-label="할부 개월">
                {cardOptions.map((m) => (
                  <button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={months === m}
                    onClick={() => setMonths(m)}
                    className={`h-9 rounded-[3px] border px-2 text-[11px] font-semibold ${months === m ? 'border-ink bg-ink text-frame' : 'border-line-strong text-mute'}`}
                  >
                    {m === 1 ? '일시불' : `${m}개월`}
                  </button>
                ))}
              </div>
            </div>
            <p className="mt-1.5 text-[11px] leading-snug text-mute">
              {cardAmount > 0
                ? months === 1
                  ? `다음 달 생활비에서 ${formatMan(cardAmount)}이 빠집니다.`
                  : `매달 ${formatWon(perMonth)} × ${months}개월, 총 ${formatMan(perMonth * months)}입니다.`
                : '카드는 다음 달 월급을 미리 쓰는 것입니다. 할부는 총액과 기간으로 판단하세요.'}
            </p>
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
        <p className="max-w-[42em] text-[11px] leading-snug text-mute">
          {risky.length > 0
            ? `${risky.map((x) => ACCOUNTS[x.id].label).join(' · ')}을 건드리면 그만큼 손해가 확정됩니다.`
            : pay.goalBonus && (parts.goal ?? 0) > 0
              ? `목표 통장에서 내면 만족도 +${pay.goalBonus}를 더 받습니다.`
              : '합계가 낼 돈과 같아야 확정할 수 있습니다.'}
        </p>
        <Button variant="plate" disabled={allocated !== amount} onClick={confirm}>
          나눠 낸 대로 확정 <span className="num">{formatMan(allocated)}</span>
        </Button>
      </div>
    </section>
  );
}

/** 고정 지불형: 지불 방식이 이미 정해져 있어 확인만 한다 */
export function FixedPayPanel({
  state,
  choice,
  onBack,
  onConfirm,
}: {
  state: GameState;
  choice: Choice;
  onBack: () => void;
  onConfirm: () => void;
}) {
  const fp = choice.fixedPay!;
  const months = fp.cardMonths ?? 1;
  const perMonth = plannedMonthly(fp.amount, months as CardMonths, fp.interestFree ? 0 : RATES.installmentApr);
  const source = fp.source === 'card' ? '신용카드' : ACCOUNTS[fp.source].label;

  return (
    <section className="cut flex flex-1 flex-col p-4" aria-labelledby="fixedpay-title">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-bold text-mute">정해진 지불 방식</p>
          <h2 id="fixedpay-title" className="mt-0.5 text-[18px] font-bold">
            {choice.label}
          </h2>
        </div>
        <Button size="sm" onClick={onBack}>
          <ArrowLeft size={15} /> 다른 선택
        </Button>
      </div>
      <div className="mt-3 rounded-[4px] bg-paper-2 px-4 py-3">
        <p className="text-[12px] text-mute">낼 돈</p>
        <p className="num text-[30px] leading-tight font-extrabold tracking-[-0.02em]">{formatWon(fp.amount)}</p>
        <p className="mt-1 text-[13px] font-semibold">{fp.label}</p>
        <p className="mt-0.5 text-[11px] text-mute">
          {source} · {months === 1 ? '일시불' : `${months}개월`}
        </p>
      </div>
      {months > 1 && (
        <dl className="mt-3 grid grid-cols-[1fr_auto] gap-y-1 text-[12px]">
          <dt className="text-mute">매달 갚을 돈</dt>
          <dd className="num font-semibold">{formatWon(perMonth)}</dd>
          <dt className="text-mute">총 갚을 돈</dt>
          <dd className="num font-semibold">{formatWon(perMonth * months)}</dd>
          <dt className="text-mute">할부 수수료</dt>
          <dd className="num">{fp.interestFree ? '무이자' : `연 ${RATES.installmentApr * 100}%`}</dd>
        </dl>
      )}
      <p className="mt-3 text-[11px] leading-relaxed text-mute">
        할부는 월 납입금이 아니라 총액과 기간으로 판단합니다. 이 금액은 매달 생활비에서 빠집니다.
      </p>
      <div className="mt-auto flex justify-end pt-3">
        <Button variant="plate" onClick={onConfirm}>
          이 방식으로 확정 <span className="num">{formatMan(fp.amount)}</span>
        </Button>
      </div>
    </section>
  );
}
