import { Presentation, TrendingDown, TrendingUp } from 'lucide-react';
import {
  ACCOUNTS,
  ACCOUNT_ORDER,
  CLOSING_TIPS,
  ENDINGS,
  formatMan,
  formatPct,
  totalDebt,
  type GameState,
} from '@gagyebu/core';
import type { ScreenProps } from '@gagyebu/draft-kit';
import { FlowHeader } from '../components/FlowHeader.tsx';
import { MaturityReceipt } from '../components/MaturityReceipt.tsx';
import { Money } from '../components/Money.tsx';
import { Spine } from '../components/Spine.tsx';
import { Achievements } from '../components/result/Achievements.tsx';
import { BudgetDiff } from '../components/result/BudgetDiff.tsx';
import { DecisionTimeline } from '../components/result/DecisionTimeline.tsx';
import { NetWorthChart } from '../components/result/NetWorthChart.tsx';
import { PresentationView } from './ResultPresentation.tsx';

export function ResultScreen({ state, ui, go }: ScreenProps) {
  if (ui.presentation) return <PresentationView state={state} onExit={() => go('result-balanced')} />;
  const s = state.settlement;
  if (!s) return null;
  const ending = ENDINGS[s.ending];
  const debt = totalDebt(state);
  const earned = ACCOUNT_ORDER.reduce((a, id) => a + state.accounts[id].earned, 0);
  const balances = ACCOUNT_ORDER.reduce((a, id) => a + s.finalBalances[id], 0);
  const achievements = s.achievements.filter((a) => a.unlocked).length;
  return (
    <div className="paper-texture min-h-dvh">
      <FlowHeader current="result" nickname={state.profile.nickname} />
      <main className="mx-auto max-w-[1200px] px-5 py-6 sm:px-8 sm:py-8">
        <div className="grid gap-6 lg:grid-cols-[1.15fr_1fr] lg:gap-10">
          <section aria-labelledby="ending-title">
            <p className="text-[15px] font-semibold text-ink-2">
              {state.profile.nickname}님의 12월 결산 · 엔딩
            </p>
            <h1 id="ending-title" className="display mt-1 text-[42px] leading-[1.1] sm:text-[56px]">
              {ending.title}
            </h1>
            <p className="mt-3 max-w-[30em] text-[19px] font-medium leading-snug">{ending.tagline}</p>

            <div className="mt-5 flex flex-wrap items-end gap-x-8 gap-y-3 border-t-2 border-ink pt-3">
              <div>
                <p className="text-[13px] text-ink-2">12월 말 순자산</p>
                <p className="num text-[38px] font-bold leading-none sm:text-[46px]">
                  <Money value={s.netWorth} />
                </p>
              </div>
              <div className="num text-[14px] text-ink-2">
                <p>
                  월급의 <strong className="text-[17px] text-ink">{(s.netWorth / state.profile.salary).toFixed(1)}배</strong>
                </p>
                <p>
                  만족도 <strong className="text-[17px] text-ink">{state.satisfaction}</strong> · 신용{' '}
                  <strong className="text-[17px] text-ink">{state.credit}</strong>
                </p>
              </div>
            </div>

            {debt > 0 ? (
              <p className="mt-3 flex items-start gap-2 rounded-[8px] bg-seal-soft px-3.5 py-2.5 text-[14px] leading-relaxed text-seal">
                <TrendingDown size={16} className="mt-0.5 flex-none" aria-hidden />
                아직 갚을 돈이 <strong className="num whitespace-nowrap">{formatMan(debt)}</strong> 남았습니다. 내년 월급에서 매달 조금씩 빠집니다.
              </p>
            ) : (
              <p className="mt-3 flex items-start gap-2 rounded-[8px] bg-in-soft px-3.5 py-2.5 text-[14px] leading-relaxed text-in">
                <TrendingUp size={16} className="mt-0.5 flex-none" aria-hidden />
                부채 없이 1년을 마쳤습니다. 이자·수익으로만 <strong className="num whitespace-nowrap">{formatMan(earned)}</strong>이 붙었어요.
              </p>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={() => go('result-present')} className="btn btn-primary">
                <Presentation size={17} aria-hidden />
                발표용 크게 보기
              </button>
              <button type="button" onClick={() => go('start-name')} className="btn btn-quiet">
                처음부터 다시
              </button>
            </div>
          </section>

          <div className="grid gap-3">
            <MaturityReceipt maturity={s.maturity} />
            <section className="rounded-panel bg-sheet px-4 py-3 shadow-[0_0_0_1px_var(--color-rule)]" aria-labelledby="last-month-title">
              <h2 id="last-month-title" className="text-[13px] font-bold text-ink-2">
                12월 마지막 정산
              </h2>
              <dl className="mt-1 grid grid-cols-[1fr_auto] gap-x-4 gap-y-0.5 text-[13px]">
                <dt className="text-ink-2">마지막 월급</dt>
                <dd className="text-right">
                  <Money value={state.payday?.salary ?? state.profile.salary} className="font-semibold" />
                </dd>
                <dt className="text-ink-2">적금 만기 (세후 이자)</dt>
                <dd className="text-right">
                  <Money value={s.maturity.interestNet} signed className="font-semibold" />
                </dd>
                <dt className="text-ink-2">1년 이자·투자 수익 합계</dt>
                <dd className="text-right">
                  <Money value={earned} signed className="font-semibold" />
                </dd>
                <dt className="text-ink-2">남은 부채</dt>
                <dd className="text-right">
                  {debt > 0 ? <Money value={debt} className="font-semibold text-seal" /> : <span className="text-[13px]">없음</span>}
                </dd>
              </dl>
            </section>
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.35fr_1fr] lg:gap-10">
          <section aria-labelledby="graph-title" className="rounded-panel bg-sheet p-4 shadow-[0_0_0_1px_var(--color-rule)] sm:p-5">
            <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
              <h2 id="graph-title" className="display text-[26px]">
                1년 순자산
              </h2>
              <p className="text-[13px] text-ink-2">
                처음 <span className="num">{formatMan(state.history[0]?.netWorth ?? 0)}</span> → 12월{' '}
                <span className="num font-bold text-ink">{formatMan(s.netWorth)}</span>
              </p>
            </div>
            <NetWorthChart state={state} />
          </section>

          <section aria-labelledby="balances-title">
            <div className="flex items-baseline justify-between gap-3">
              <h2 id="balances-title" className="display text-[26px]">
                통장별 최종 잔고
              </h2>
              <p className="num text-[13px] text-ink-2">합계 {formatMan(balances)}</p>
            </div>
            <ul className="mt-3 divide-y divide-rule-soft rounded-panel bg-sheet px-4 shadow-[0_0_0_1px_var(--color-rule)]">
              {ACCOUNT_ORDER.map((id) => (
                <li key={id} className="flex items-center gap-3 py-2">
                  <Spine id={id} className="h-7" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-semibold leading-tight">{ACCOUNTS[id].label}</p>
                    <p className="text-[11px] leading-tight text-ink-3">{ACCOUNTS[id].purpose}</p>
                  </div>
                  <div className="text-right">
                    <Money value={s.finalBalances[id]} className="block text-[15px] font-bold leading-tight" />
                    <span className="block text-[11px] leading-tight text-ink-3">{formatPct(balances ? s.finalBalances[id] / balances : 0)}</span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="mt-8 grid items-start gap-8 lg:grid-cols-[1.02fr_1fr] lg:gap-10">
          <div className="space-y-8">
            <BudgetDiff settlement={s} budgetEdits={state.budgetEdits} />
            <div>
              <Achievements settlement={s} />
              <p className="mt-2 text-[13px] text-ink-2">
                놓친 도전과제가 {s.achievements.length - achievements}개 있습니다. 같은 상황에서 다른 선택을 했다면 무엇이 달라졌을지
                이야기해 보세요.
              </p>
            </div>
          </div>
          <DecisionTimeline decisions={state.decisions} state={state} />
        </div>

        <section aria-labelledby="tips-title" className="mt-8 rounded-panel bg-ink p-5 text-white sm:p-6">
          <h2 id="tips-title" className="display text-[26px]">
            수업을 마치며
          </h2>
          <div className="mt-3 grid gap-x-10 gap-y-4 sm:grid-cols-2">
            {CLOSING_TIPS.map((group) => (
              <div key={group.title}>
                <h3 className="text-[15px] font-bold text-mark">{group.title}</h3>
                <ul className="mt-1.5 space-y-1">
                  {group.items.map((item) => (
                    <li key={item} className="flex gap-2 text-[13px] leading-relaxed text-white/85">
                      <span aria-hidden className="mt-2 size-1 flex-none rounded-full bg-white/60" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
        <p className="mt-3 text-[12px] text-ink-3">
          금리·수익률·물가는 수업을 위한 가정값입니다. 실제 금융상품의 조건과 다릅니다.
        </p>
      </main>
    </div>
  );
}

export function resultStats(state: GameState) {
  const s = state.settlement;
  return { netWorth: s?.netWorth ?? 0 };
}
