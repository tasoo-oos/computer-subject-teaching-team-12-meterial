import { ArrowRight, BookOpen, CalendarClock, CircleCheck, Lightbulb, Minus } from 'lucide-react';
import {
  ACCOUNTS,
  STATUSES,
  budgetSummary,
  formatMan,
  formatSignedWon,
  monthLabel,
  type AccountId,
  type Delta,
  type GameState,
  type Outcome,
} from '@gagyebu/core';
import { AccountMark, Button, Money } from '../../components/ui.tsx';
import { ShareBar } from '../../components/ShareBar.tsx';

/** 결과 컷: 피드백, 잔고 변화, 이어지는 장면, 교훈, 결정 기록 */
export function OutcomeView({
  state,
  outcome,
  nextLabel,
  onContinue,
}: {
  state: GameState;
  outcome: Outcome;
  nextLabel: string;
  onContinue: () => void;
}) {
  const sum = budgetSummary(state.budget, state.profile.salary);
  const recent = state.decisions.slice(-4).reverse();

  return (
    <section className="cut flex flex-1 flex-col p-4" aria-labelledby="outcome-title">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-[11px] font-bold text-mute">선택의 결과 · {state.decisions.at(-1)?.eventCode ?? ''}</p>
          <h1 id="outcome-title" className="mt-0.5 text-[19px] font-bold tracking-[-0.015em]">
            {state.decisions.at(-1)?.choiceLabel ?? '결과'}
          </h1>
        </div>
        <p className="text-[11px] text-mute">{monthLabel(state.month)}</p>
      </div>

      <div className="mt-3 grid flex-1 gap-x-5 gap-y-3 lg:grid-cols-[1.15fr_0.85fr]">
        <div>
          <p className="max-w-[36em] text-[17px] leading-relaxed font-semibold text-pretty">{outcome.feedback}</p>

          <p className="mt-4 text-[11px] font-bold text-mute">바뀐 것</p>
          <ul className="mt-1.5 grid gap-1">
            {outcome.deltas.length === 0 && <li className="text-[12px] text-mute">잔고 변화는 없습니다.</li>}
            {outcome.deltas.map((d, i) => (
              <DeltaRow key={i} delta={d} />
            ))}
          </ul>

          {outcome.lesson && (
            <p className="mt-4 flex gap-2 rounded-[4px] bg-flash-soft px-3 py-2.5 text-[13px] leading-relaxed font-medium">
              <Lightbulb size={16} className="mt-0.5 shrink-0" aria-hidden /> {outcome.lesson}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          {outcome.next && (
            <div className="rounded-[4px] bg-paper-2 px-3 py-2.5">
              <p className="flex items-center gap-1.5 text-[11px] font-bold text-mute">
                <ArrowRight size={13} aria-hidden /> 같은 달에 이어집니다
              </p>
              <p className="mt-0.5 text-[13px] font-semibold">다음 장면이 도착했습니다.</p>
            </div>
          )}
          {outcome.scheduled && (
            <div className="rounded-[4px] bg-paper-2 px-3 py-2.5">
              <p className="flex items-center gap-1.5 text-[11px] font-bold text-mute">
                <CalendarClock size={13} aria-hidden /> 예약된 장면
              </p>
              <p className="mt-0.5 text-[13px] font-semibold">{outcome.scheduled.reason}</p>
              <p className="num text-[11px] text-mute">
                {monthLabel(outcome.scheduled.month)} · {outcome.scheduled.month - state.month}개월 뒤
              </p>
            </div>
          )}
          {outcome.budgetReason && (
            <div className="rounded-[4px] bg-warn-soft px-3 py-2.5 text-warn">
              <p className="text-[11px] font-bold">가계부를 다시 맞춰야 합니다</p>
              <p className="mt-0.5 text-[12px] leading-snug">{outcome.budgetReason}</p>
            </div>
          )}

          <div className="rounded-[4px] border border-line px-3 py-2.5">
            <p className="text-[11px] font-bold text-mute">이번 달 배분</p>
            <div className="mt-1.5">
              <ShareBar shares={sum.shares} height={10} labels={false} />
            </div>
            <p className="num mt-1.5 text-[11px] text-mute">저축률 {(sum.savingsRate * 100).toFixed(1).replace('.0', '')}%</p>
          </div>

          <div className="mt-auto rounded-[4px] bg-paper-2 px-3 py-2.5">
            <p className="text-[11px] font-bold text-mute">최근 결정</p>
            <ol className="mt-1 grid gap-1">
              {recent.map((d, i) => (
                <li key={`${d.month}-${d.choiceId}-${i}`} className="flex gap-2 text-[11px] leading-snug">
                  <span className="num w-6 shrink-0 font-bold text-mute">{d.month}월</span>
                  <span className="truncate">{d.choiceLabel}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-3">
        <p className="text-[11px] text-mute">결정은 기록에 남고, 다음 달 잔고에 그대로 이어집니다.</p>
        <Button variant="plate" onClick={onContinue}>
          {nextLabel} <ArrowRight size={16} />
        </Button>
      </div>
    </section>
  );
}

function DeltaRow({ delta }: { delta: Delta }) {
  if (delta.kind === 'account') {
    return (
      <li className="flex items-center gap-2 rounded-[3px] bg-paper-2 px-2.5 py-1.5">
        <AccountMark id={delta.account} size={20} />
        <span className="text-[12px] text-mute">{ACCOUNTS[delta.account as AccountId].label}</span>
        <span className={`num ml-auto text-[12px] font-bold ${delta.amount > 0 ? 'text-good' : 'text-bad'}`}>{formatSignedWon(delta.amount)}</span>
      </li>
    );
  }
  if (delta.kind === 'satisfaction') {
    return (
      <li className="flex items-center gap-2 rounded-[3px] bg-paper-2 px-2.5 py-1.5">
        <span className="flex size-5 items-center justify-center rounded-[3px] bg-paper-3 text-[11px] font-bold" aria-hidden>만</span>
        <span className="text-[12px] text-mute">만족도</span>
        <span className={`num ml-auto text-[12px] font-bold ${delta.amount > 0 ? 'text-good' : 'text-bad'}`}>
          {delta.amount > 0 ? '+' : ''}
          {delta.amount}
        </span>
      </li>
    );
  }
  if (delta.kind === 'credit') {
    return (
      <li className="flex items-center gap-2 rounded-[3px] bg-paper-2 px-2.5 py-1.5">
        <span className="flex size-5 items-center justify-center rounded-[3px] bg-paper-3 text-[11px] font-bold" aria-hidden>신</span>
        <span className="text-[12px] text-mute">신용점수</span>
        <span className={`num ml-auto text-[12px] font-bold ${delta.amount > 0 ? 'text-good' : 'text-bad'}`}>
          {delta.amount > 0 ? '+' : ''}
          {delta.amount}
        </span>
      </li>
    );
  }
  if (delta.kind === 'debt') {
    return (
      <li className="flex items-center gap-2 rounded-[3px] bg-bad-soft px-2.5 py-1.5">
        <span className="text-[12px] text-bad">{delta.label}</span>
        <Money value={delta.amount} mode="man" className="num ml-auto text-[12px] font-bold text-bad" />
      </li>
    );
  }
  if (delta.kind === 'status') {
    return (
      <li className="flex items-center gap-2 rounded-[3px] bg-paper-2 px-2.5 py-1.5">
        <span className="flex size-5 items-center justify-center rounded-[3px] bg-paper-3" aria-hidden>
          {delta.change === 'add' ? <CircleCheck size={12} /> : <Minus size={12} />}
        </span>
        <span className="text-[12px] text-mute">{STATUSES[delta.status].label}</span>
        <span className="ml-auto text-[11px] font-semibold text-mute">{delta.change === 'add' ? '생김' : '끝남'}</span>
      </li>
    );
  }
  return (
    <li className="flex items-center gap-2 rounded-[3px] bg-paper-2 px-2.5 py-1.5">
      <BookOpen size={14} className="text-mute" aria-hidden />
      <span className="text-[12px] text-mute">가계부 항목 변경</span>
      <span className="ml-auto text-[11px] font-semibold text-mute">{formatMan(delta.amount)}</span>
    </li>
  );
}
