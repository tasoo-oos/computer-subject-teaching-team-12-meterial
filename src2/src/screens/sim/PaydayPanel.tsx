import { ACCOUNTS, formatWon, monthLabel, type GameState } from '@gagyebu/core';
import { ArrowRight, Banknote, CalendarClock, CreditCard, Landmark, PiggyBank, Sparkles, TrendingUp } from 'lucide-react';
import { Button } from '../../components/ui.tsx';
import { Money } from '../../components/Money.tsx';
import { AccountIcon } from '../../components/AccountBadge.tsx';
import { useSequence } from '../../lib/motion.ts';

const STEP = [
  { icon: Landmark, title: '월급 입금', tone: 'text-primary bg-primary-soft' },
  { icon: CalendarClock, title: '자동이체', tone: 'text-acc-savings bg-acc-savings-soft' },
  { icon: CreditCard, title: '생활비 지출', tone: 'text-acc-goal bg-acc-goal-soft' },
  { icon: TrendingUp, title: '이자 · 수익', tone: 'text-acc-emergency bg-acc-emergency-soft' },
];

/** 월급날: 입금 → 자동이체 → 생활비 → 이자 순서를 한 단계씩 보여 준다 */
export function PaydayPanel({ state, onContinue }: { state: GameState; onContinue: () => void }) {
  const p = state.payday;
  const [stage] = useSequence(STEP.length, 780);
  if (!p) return null;
  const earnings = Object.values(p.earnings).reduce((a, b) => a + (b ?? 0), 0);
  const spendTotal = p.spending + p.debtPayments;
  const netGain = p.salary - spendTotal + earnings;
  const tutorial = state.month === 1;
  const done = stage >= STEP.length;
  const show = (i: number) => done || i <= stage;

  return (
    <section className="animate-enter" aria-label="월급날 처리">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-xs font-semibold tracking-wide text-primary">5단계 · 12개월 시뮬레이션</p>
          <h1 className="text-[clamp(1.4rem,2.6vw,1.85rem)] font-bold tracking-tight text-ink">
            {monthLabel(state.month)} 월급날
            {tutorial && <span className="ml-2 rounded-full bg-accent-soft px-2 py-0.5 align-middle text-xs font-bold text-accent-ink">튜토리얼</span>}
          </h1>
        </div>
        <p className="text-sm text-ink-2">
          월급 <Money value={p.salary} className="font-bold text-ink" />이 들어왔습니다
        </p>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_280px]">
        <ol className="card divide-y divide-line overflow-hidden p-0">
          {STEP.map((s, i) => {
            const visible = show(i);
            const amount =
              i === 0 ? p.salary : i === 1 ? -p.transfers.emergency - p.transfers.savings - p.transfers.invest - p.transfers.goal - p.transfers.housing : i === 2 ? -spendTotal : earnings;
            return (
              <li key={s.title} className={`flex items-start gap-3 px-4 py-3 transition-opacity duration-500 ${visible ? 'opacity-100' : 'opacity-30'}`}>
                <span className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl ${s.tone}`} aria-hidden>
                  <s.icon size={18} strokeWidth={2.2} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-[11px] font-bold text-ink-3">{i + 1}</span>
                    <h2 className="text-[15px] font-bold text-ink">{s.title}</h2>
                    <span className={`num ml-auto text-[15px] font-bold ${amount > 0 ? 'text-up' : 'text-ink'}`}>
                      {amount > 0 ? '+' : ''}
                      {formatWon(amount)}
                    </span>
                  </div>

                  {i === 0 && (
                    <p className="mt-0.5 text-[12px] leading-relaxed text-ink-2">
                      {state.profile.nickname}님의 통장에 월급이 들어왔습니다. 이제 가계부가 정한 순서대로 나뉩니다.
                    </p>
                  )}
                  {i === 1 && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {(['emergency', 'savings', 'invest', 'goal', 'housing'] as const).map((id) => (
                        <span key={id} className="inline-flex items-center gap-1 rounded-lg bg-surface-2 px-1.5 py-0.5 text-[11px] text-ink-2">
                          <AccountIcon id={id} size="sm" />
                          <span>{ACCOUNTS[id].label}</span>
                          <span className="num font-semibold">{formatWon(p.transfers[id])}</span>
                        </span>
                      ))}
                    </div>
                  )}
                  {i === 2 && (
                    <p className="num mt-0.5 text-[12px] leading-relaxed text-ink-2">
                      예산 {formatWon(p.spending)}
                      {p.debtPayments > 0 && <> · 할부·카드값 {formatWon(p.debtPayments)}</>}
                      {p.livingShortfall > 0 && <span className="font-bold text-danger"> · 생활비 부족 {formatWon(p.livingShortfall)}</span>}
                    </p>
                  )}
                  {i === 3 && (
                    <ul className="mt-1 flex flex-wrap gap-1.5">
                      {(['emergency', 'savings', 'invest', 'goal', 'housing'] as const).map((id) => (
                        <li key={id} className="inline-flex items-center gap-1 rounded-lg bg-surface-2 px-1.5 py-0.5 text-[11px] text-ink-2">
                          <AccountIcon id={id} size="sm" />
                          <span>{ACCOUNTS[id].label}</span>
                          <span className="num font-semibold">{formatWon(p.earnings[id] ?? 0)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </li>
            );
          })}
        </ol>

        <div className="flex flex-col gap-3">
          <div className="card p-3.5">
            <div className="text-[11px] font-semibold text-ink-3">이번 달 순자산 변화</div>
            <div className="mt-1 text-2xl font-bold">
              <Money value={netGain} signed tone />
            </div>
            <p className="mt-1 text-[12px] leading-relaxed text-ink-2">
              월급에서 지출을 빼고 이자를 더한 값입니다. 자동이체는 통장 사이의 이동이라 순자산을 바꾸지 않습니다.
            </p>
          </div>

          {tutorial ? (
            <div className="rounded-2xl border border-accent/50 bg-accent-soft p-3">
              <div className="flex items-center gap-1.5 text-[13px] font-bold text-accent-ink">
                <Sparkles size={15} aria-hidden /> 1월은 튜토리얼
              </div>
              <ul className="mt-1.5 space-y-1.5 text-[12px] leading-relaxed text-accent-ink">
                <li className="flex gap-1.5">
                  <span className="font-bold">1</span> 월급이 들어오면 자동이체가 먼저 돈을 나눕니다.
                </li>
                <li className="flex gap-1.5">
                  <span className="font-bold">2</span> 생활비 통장 잔고만 보고 한 달을 삽니다.
                </li>
                <li className="flex gap-1.5">
                  <span className="font-bold">3</span> 남은 통장은 이름표에 맞게 쌓입니다.
                </li>
              </ul>
              <p className="mt-2 border-t border-accent/30 pt-1.5 text-[12px] font-semibold">2월부터는 예상하지 못한 일이 생깁니다.</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-line bg-surface-2 p-3 text-[12px] leading-relaxed text-ink-2">
              <div className="mb-1 flex items-center gap-1.5 text-[13px] font-bold text-ink">
                <PiggyBank size={15} aria-hidden /> 자동이체가 끝나면
              </div>
              생활비 통장에는 이번 달 쓸 돈만 남습니다. 다른 통장은 목적에 맞게 쌓입니다.
            </div>
          )}

          <Button size="lg" onClick={onContinue} className="w-full">
            {tutorial ? '1년 시작하기' : '이번 달 장면 보기'}
            <ArrowRight size={18} aria-hidden />
          </Button>
          {!done && (
            <p className="text-center text-[11px] text-ink-3" role="status">
              순서대로 처리 중…
            </p>
          )}
        </div>
      </div>
      <p className="mt-3 flex items-center gap-1.5 text-[11px] text-ink-3">
        <Banknote size={13} aria-hidden /> 입금·이체는 화면 연출입니다. 실제 잔고는 오른쪽 통장 카드에 반영됩니다.
      </p>
    </section>
  );
}
