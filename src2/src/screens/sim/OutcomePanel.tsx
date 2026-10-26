import {
  ACCOUNTS,
  EXPENSES,
  EVENTS,
  STATUSES,
  describeScheduled,
  formatMan,
  formatSignedWon,
  getScene,
  type Delta,
  type GameState,
} from '@gagyebu/core';
import { ArrowRight, BookOpen, CalendarClock, CreditCard, Gauge, Landmark, MessageSquareQuote, ShieldCheck, Sparkles } from 'lucide-react';
import { Button, Chip } from '../../components/ui.tsx';
import { AccountIcon } from '../../components/AccountBadge.tsx';
import { Money } from '../../components/Money.tsx';

/** 선택 결과: 피드백, 변화 목록, 이어지는 장면·예약 예고, 교훈 */
export function OutcomePanel({ state, onContinue, onAdjust }: { state: GameState; onContinue: () => void; onAdjust: () => void }) {
  const o = state.lastOutcome;
  if (!o) return null;
  const event = EVENTS[o.ref.eventId];
  const next = o.next ? getScene(o.next) : null;
  const choice = event.scenes[o.ref.sceneId]?.choices.find((c) => c.id === o.choiceId);

  return (
    <section className="animate-enter">
      <p className="text-xs font-semibold tracking-wide text-primary">선택의 결과</p>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <Chip className="bg-hud text-white">{event.code}</Chip>
        <h1 className="text-[clamp(1.3rem,2.5vw,1.7rem)] font-bold tracking-tight text-ink">{event.title}</h1>
        {choice && <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-ink-2">{choice.label}</span>}
      </div>

      <div className="card relative mt-3 overflow-hidden p-4">
        <MessageSquareQuote size={22} className="text-primary" aria-hidden />
        <p className="mt-1.5 max-w-[62ch] text-[17px] leading-[1.7] font-medium text-ink">{o.feedback}</p>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-3">
          <div className="card p-3.5">
            <h2 className="mb-2 text-sm font-bold text-ink-2">무엇이 바뀌었나요</h2>
            {o.deltas.length === 0 ? (
              <p className="rounded-xl bg-surface-2 px-3 py-2.5 text-[13px] leading-relaxed text-ink-2">
                잔고 변화는 없습니다. 이번 선택은 기록으로만 남습니다.
              </p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {o.deltas.map((d, i) => (
                  <DeltaRow key={i} d={d} />
                ))}
              </ul>
            )}
          </div>

          {o.lesson && (
            <div className="rounded-2xl border border-primary/25 bg-primary-soft/50 p-3.5">
              <div className="flex items-center gap-1.5 text-[12px] font-bold text-primary">
                <BookOpen size={14} aria-hidden /> 이 장면의 교훈
              </div>
              <p className="mt-1 text-[14px] leading-relaxed text-ink">{o.lesson}</p>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          {next && (
            <div className="card p-3.5">
              <div className="flex items-center gap-1.5 text-[12px] font-bold text-primary">
                <ArrowRight size={14} aria-hidden /> 이어지는 장면
              </div>
              <p className="mt-1 text-[14px] font-bold text-ink">{next.event.title}</p>
              <p className="mt-1 line-clamp-3 text-[12px] leading-relaxed text-ink-2">{next.scene.text}</p>
            </div>
          )}
          {o.scheduled && (
            <div className="rounded-2xl border border-dashed border-line-strong bg-surface p-3.5">
              <div className="flex items-center gap-1.5 text-[12px] font-bold text-ink-2">
                <CalendarClock size={14} aria-hidden /> 예약된 장면
              </div>
              <p className="num mt-1 text-[12px] font-semibold text-primary">{describeScheduled(o.scheduled)}</p>
              <p className="mt-1 text-[11px] leading-relaxed text-ink-3">그 달이 되면 이 선택의 결과가 다시 등장합니다.</p>
            </div>
          )}
          {!next && !o.scheduled && (
            <div className="rounded-2xl border border-dashed border-line bg-surface-2 p-3.5 text-[12px] leading-relaxed text-ink-2">
              이어지는 장면이 없습니다. 이번 달 장면은 여기서 끝납니다.
            </div>
          )}

          <div className="mt-auto flex flex-col gap-1.5 pt-1">
            {o.budgetReason ? (
              <Button size="lg" onClick={onAdjust} className="w-full">
                가계부 조정하기 <ArrowRight size={18} aria-hidden />
              </Button>
            ) : (
              <Button size="lg" onClick={onContinue} className="w-full">
                {next ? '다음 장면으로' : '계속'} <ArrowRight size={18} aria-hidden />
              </Button>
            )}
            <p className="text-center text-[11px] text-ink-3">선택은 기록되어 결과 화면의 타임라인에 남습니다.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function DeltaRow({ d }: { d: Delta }) {
  const base = 'flex items-center gap-2 rounded-xl border border-line bg-surface-2/60 px-2.5 py-2 text-[13px]';
  switch (d.kind) {
    case 'account':
      return (
        <li className={base}>
          <AccountIcon id={d.account} size="sm" />
          <span className="font-semibold text-ink-2">{ACCOUNTS[d.account].label}</span>
          <Money value={d.amount} signed tone className="ml-auto font-bold" />
        </li>
      );
    case 'satisfaction':
      return (
        <li className={base}>
          <span className="flex size-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800" aria-hidden>
            <Gauge size={15} />
          </span>
          <span className="font-semibold text-ink-2">만족도</span>
          <span className="num ml-auto font-bold text-ink">
            {formatSignedWon(d.amount).replace('원', '')}점
          </span>
        </li>
      );
    case 'credit':
      return (
        <li className={base}>
          <span className="flex size-7 items-center justify-center rounded-lg bg-sky-100 text-sky-800" aria-hidden>
            <ShieldCheck size={15} />
          </span>
          <span className="font-semibold text-ink-2">신용점수</span>
          <span className="num ml-auto font-bold text-ink">
            {formatSignedWon(d.amount).replace('원', '')}점
          </span>
        </li>
      );
    case 'debt':
      return (
        <li className={base}>
          <span className="flex size-7 items-center justify-center rounded-lg bg-orange-100 text-orange-800" aria-hidden>
            <CreditCard size={15} />
          </span>
          <span className="font-semibold text-ink-2">{d.label}</span>
          <span className="num ml-auto font-bold text-ink">{formatSignedWon(d.amount)}</span>
        </li>
      );
    case 'status':
      return (
        <li className={base}>
          <span className="flex size-7 items-center justify-center rounded-lg bg-violet-100 text-violet-800" aria-hidden>
            <Sparkles size={15} />
          </span>
          <span className="font-semibold text-ink-2">{STATUSES[d.status].label}</span>
          <span className="ml-auto text-[12px] font-bold text-ink-2">{d.change === 'add' ? '생김' : '사라짐'}</span>
        </li>
      );
    case 'budget':
      return (
        <li className={base}>
          <span className="flex size-7 items-center justify-center rounded-lg bg-amber-100 text-amber-800" aria-hidden>
            <Landmark size={15} />
          </span>
          <span className="font-semibold text-ink-2">{d.key in EXPENSES ? EXPENSES[d.key as keyof typeof EXPENSES].label : ACCOUNTS[d.key as keyof typeof ACCOUNTS].label} 예산</span>
          <span className="num ml-auto font-bold text-ink">{formatMan(d.amount)}</span>
        </li>
      );
    default:
      return null;
  }
}
