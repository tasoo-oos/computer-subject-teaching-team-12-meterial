import { useState } from 'react';
import { ArrowRight, Check, Landmark, Percent, ReceiptText, Wallet } from 'lucide-react';
import {
  ACCOUNTS,
  TRANSFER_ORDER,
  budgetSummary,
  formatMan,
  formatSignedWon,
  type GameState,
} from '@gagyebu/core';
import { AccountMark, Button } from '../../components/ui.tsx';
import { ShareBar } from '../../components/ShareBar.tsx';

/** 월급날: 입금 → 자동이체 → 생활비 지출 → 이자·수익, 네 컷으로 인화된다 */
export function PaydayView({ state, onDone }: { state: GameState; onDone: () => void }) {
  const p = state.payday!;
  const [stage, setStage] = useState(0);
  const sum = budgetSummary(state.budget, state.profile.salary);

  const steps = [
    {
      key: 'salary',
      label: '월급 입금',
      icon: Landmark,
      amount: p.salary,
      note: '회사에서 이번 달 월급이 들어왔습니다.',
      details: null,
      tone: 'plus' as const,
    },
    {
      key: 'transfer',
      label: '자동이체',
      icon: Wallet,
      amount: -Object.values(p.transfers).reduce((a, b) => a + b, 0),
      note: '가계부에서 정한 대로 다섯 통장으로 먼저 보냅니다.',
      details: TRANSFER_ORDER.map((id) => ({ id, text: ACCOUNTS[id].label, value: p.transfers[id] })),
      tone: 'minus' as const,
    },
    {
      key: 'living',
      label: '생활비 지출',
      icon: ReceiptText,
      amount: -(p.spending + p.debtPayments),
      note:
        p.debtPayments > 0
          ? '예산만큼 쓰고, 할부·카드값 상환액도 생활비에서 빠집니다.'
          : '생활비 통장에서 예산만큼 지출합니다. 남은 돈은 다음 달로 넘어갑니다.',
      details: [
        { id: 'living' as const, text: '예산 지출', value: -p.spending },
        ...(p.debtPayments > 0 ? [{ id: 'living' as const, text: '부채 상환', value: -p.debtPayments }] : []),
      ],
      tone: 'minus' as const,
    },
    {
      key: 'earn',
      label: '이자 · 수익',
      icon: Percent,
      amount: Object.values(p.earnings).reduce((a, b) => a + (b ?? 0), 0),
      note: `투자 계좌는 이번 달 ${(p.investReturnPct * 100).toFixed(1).replace('.0', '')}% 움직였습니다.`,
      details: (['emergency', 'goal', 'housing', 'invest'] as const)
        .filter((id) => (p.earnings[id] ?? 0) !== 0)
        .map((id) => ({ id, text: ACCOUNTS[id].label, value: p.earnings[id] ?? 0 })),
      tone: 'plus' as const,
    },
  ] as const;

  const current = steps[stage]!;
  const Icon = current.icon;
  const allDone = stage === steps.length - 1;

  return (
    <section className="cut flex min-h-full flex-1 flex-col p-4" aria-labelledby="payday-title">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-[11px] font-bold text-mute">월급날 · 튜토리얼</p>
          <h1 id="payday-title" className="mt-0.5 text-[19px] font-bold tracking-[-0.015em]">
            월급이 다섯 통장으로 나뉘는 순서
          </h1>
        </div>
        <p className="num text-[12px] text-mute">
          {stage + 1} / {steps.length} 단계
        </p>
      </div>

      <ol className="mt-3 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((s, i) => {
          const StepIcon = s.icon;
          const done = i < stage;
          const now = i === stage;
          return (
            <li key={s.key}>
              <button
                type="button"
                onClick={() => setStage(i)}
                aria-current={now ? 'step' : undefined}
                className={`h-full w-full rounded-[4px] border p-2.5 text-left transition-colors ${
                  now ? 'border-ink bg-flash' : 'border-line bg-paper hover:bg-paper-2'
                }`}
              >
                <span className="flex items-center gap-1.5 text-[11px] font-bold text-mute">
                  {done ? <Check size={13} aria-hidden /> : <StepIcon size={13} aria-hidden />} {i + 1}. {s.label}
                </span>
                <span className={`num mt-1 block text-[15px] font-bold text-text`}>
                  {s.amount === 0 ? '0원' : formatSignedWon(s.amount)}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <div className="mt-3 flex flex-1 flex-col rounded-[4px] bg-paper-2 p-4">
        <div className="flex items-start gap-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-[4px] bg-ink text-frame" aria-hidden>
            <Icon size={17} />
          </span>
          <div>
            <p className="text-[15px] font-bold">{current.label}</p>
            <p className="mt-0.5 max-w-[38em] text-[13px] leading-relaxed text-mute">{current.note}</p>
          </div>
        </div>

        <p className={`num mt-3 text-[32px] leading-none font-extrabold tracking-[-0.02em] ${current.amount < 0 ? 'text-text' : 'text-text'}`}>
          {current.amount === 0 ? '0원' : formatSignedWon(current.amount)}
        </p>

        {current.details && (
          <ul className="mt-3 grid gap-1 sm:grid-cols-2">
            {current.details.map((d, i) => (
              <li key={`${d.text}-${i}`} className="flex items-center gap-2 rounded-[3px] bg-paper px-2.5 py-1.5">
                <AccountMark id={d.id} size={20} />
                <span className="text-[12px] text-mute">{d.text}</span>
                <span className="num ml-auto text-[12px] font-semibold">{formatSignedWon(d.value)}</span>
              </li>
            ))}
          </ul>
        )}

        {stage === 2 && p.livingShortfall > 0 && (
          <p className="mt-2 rounded-[3px] bg-bad-soft px-2.5 py-1.5 text-[11px] font-semibold text-bad">
            생활비가 {formatMan(p.livingShortfall)} 모자라 카드값으로 넘어갔습니다. 만족도가 떨어집니다.
          </p>
        )}

        <div className="mt-3 rounded-[4px] border border-line px-3 py-2.5">
          <div className="flex items-baseline justify-between">
            <p className="text-[11px] font-bold text-mute">가계부가 정한 이번 달 배분</p>
            <p className="num text-[11px] text-mute">저축률 {(sum.savingsRate * 100).toFixed(1).replace('.0', '')}%</p>
          </div>
          <div className="mt-1.5">
            <ShareBar shares={sum.shares} height={10} labels={false} />
          </div>
          <p className="num mt-1.5 flex justify-between text-[11px] text-mute">
            <span>생활비 {formatMan(sum.livingIn)}</span>
            <span>자동이체 {formatMan(sum.transferTotal)}</span>
          </p>
        </div>

        <p className="mt-auto pt-3 text-[11px] leading-relaxed text-mute">
          2월부터는 예상하지 못한 일이 생깁니다. 비상금이 얼마나 쌓였는지 기억해 두세요.
        </p>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <p className="text-[11px] text-mute">
          통장 잔고는 오른쪽에서 함께 바뀝니다.
        </p>
        <div className="flex gap-2">
          <Button size="sm" disabled={stage === 0} onClick={() => setStage((s) => Math.max(0, s - 1))}>
            이전 단계
          </Button>
          {allDone ? (
            <Button variant="plate" onClick={onDone}>
              1년 시작하기 <ArrowRight size={16} />
            </Button>
          ) : (
            <Button variant="plate" onClick={() => setStage((s) => Math.min(steps.length - 1, s + 1))}>
              다음 단계 <ArrowRight size={16} />
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
