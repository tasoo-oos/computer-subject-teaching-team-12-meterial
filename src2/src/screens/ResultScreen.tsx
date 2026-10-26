import { useMemo } from 'react';
import type { ScreenProps } from '@gagyebu/draft-kit';
import {
  ACHIEVEMENTS,
  ACHIEVEMENT_ORDER,
  ACCOUNTS,
  ACCOUNT_ORDER,
  CLOSING_TIPS,
  ENDINGS,
  formatMan,
  formatPct,
  formatSignedWon,
  formatWon,
  monthLabel,
  netWorth,
  type AchievementId,
  type GameState,
  type Settlement,
} from '@gagyebu/core';
import {
  ArrowRight,
  Award,
  BookOpen,
  CircleHelp,
  Coins,
  CreditCard,
  Landmark,
  Lock,
  Presentation,
  RotateCcw,
  Sparkles,
  Trophy,
} from 'lucide-react';
import { Button } from '../components/ui.tsx';
import { AccountIcon } from '../components/AccountBadge.tsx';
import { Money } from '../components/Money.tsx';
import { LessonBar, LessonFooter } from '../components/LessonBar.tsx';
import { budgetKeyLabel } from '../components/BudgetEditor.tsx';
import { ACCOUNT_LOOK } from '../lib/accounts.tsx';

export function ResultScreen({ state, ui, go, goScreen }: ScreenProps) {
  if (ui.presentation) return <PresentationView state={state} go={go} />;
  return <ResultDetail state={state} go={go} goScreen={goScreen} />;
}

function ResultDetail({ state, go, goScreen }: { state: GameState; go: ScreenProps['go']; goScreen: ScreenProps['goScreen'] }) {
  const settlement = state.settlement;
  if (!settlement) return null;
  const ending = ENDINGS[settlement.ending];
  const unlocked = settlement.achievements.filter((a) => a.unlocked).length;
  const maturity = settlement.maturity;
  const salary = state.profile.salary;

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <LessonBar
        current="result"
        right={
          <Button variant="secondary" size="sm" onClick={() => go('result-present')}>
            <Presentation size={15} aria-hidden /> 발표용 크게 보기
          </Button>
        }
      />
      <main className="mx-auto w-full max-w-[1180px] flex-1 px-4 py-6 sm:px-6">
        {/* 결산 히어로 */}
        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="relative overflow-hidden rounded-[24px] bg-hud p-5 text-hud-ink shadow-[var(--shadow-lift)] sm:p-6">
            <div className="pointer-events-none absolute -top-16 -right-10 size-56 rounded-full bg-accent/20 blur-3xl" aria-hidden />
            <div className="relative">
              <p className="flex items-center gap-1.5 text-[12px] font-semibold text-hud-ink-2">
                <Sparkles size={14} className="text-accent" aria-hidden /> 12월 결산 · {state.profile.nickname}님의 1년
              </p>
              <h1 className="mt-1.5 text-[clamp(1.9rem,4vw,2.9rem)] font-bold leading-tight tracking-tight text-white">{ending.title}</h1>
              <p className="mt-1 max-w-[46ch] text-[15px] leading-relaxed text-hud-ink-2">{ending.tagline}</p>

              <div className="mt-5 flex flex-wrap items-end gap-x-6 gap-y-2">
                <div>
                  <div className="text-[11px] font-semibold text-hud-ink-2">최종 순자산</div>
                  <div className="mt-0.5 text-[clamp(2rem,5vw,2.8rem)] font-bold leading-none text-white">
                    <Money value={settlement.netWorth} />
                  </div>
                </div>
                <div className="flex gap-4 pb-1 text-[12px] text-hud-ink-2">
                  <span>
                    월급의 <strong className="num text-white">{(settlement.netWorth / salary).toFixed(1)}배</strong>
                  </span>
                  <span>
                    도전과제 <strong className="num text-white">{unlocked}/{ACHIEVEMENT_ORDER.length}</strong>
                  </span>
                  <span>
                    만족도 <strong className="num text-white">{state.satisfaction}</strong>
                  </span>
                </div>
              </div>
              {settlement.debt > 0 && (
                <p className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-orange-400/15 px-2.5 py-1 text-[12px] font-semibold text-orange-200">
                  <CreditCard size={14} aria-hidden /> 남은 부채 <Money value={settlement.debt} className="num" />
                </p>
              )}
            </div>
          </div>

          <div className="card p-4">
            <div className="flex items-center gap-1.5 text-[12px] font-bold text-primary">
              <Coins size={15} aria-hidden /> 적금 만기
            </div>
            <p className="mt-0.5 text-[12px] text-ink-3">
              {monthLabel(12)} 마지막 월급 <Money value={state.profile.salary} className="font-semibold text-ink-2" /> 입금 후 정산
            </p>
            <dl className="mt-2 divide-y divide-line text-[13px]">
              <Row label="납입 원금" value={maturity.principal} />
              <Row label={`세전 이자 (연 3.5% 단리)`} value={maturity.interestGross} />
              <Row label="이자소득세 15.4%" value={-maturity.tax} />
              <Row label="세후 이자" value={maturity.interestNet} strong />
            </dl>
            <div className="mt-2 flex items-baseline justify-between rounded-xl bg-primary-soft px-3 py-2">
              <span className="text-[12px] font-semibold text-primary">받은 금액</span>
              <span className="num text-lg font-bold text-primary">{formatWon(maturity.principal + maturity.interestNet)}</span>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-ink-3">세금은 학습용 가정값입니다. 적금을 중도에 해지했다면 이자율이 연 0.5%로 줄어듭니다.</p>
          </div>
        </section>

        {/* 그래프 + 계좌 */}
        <section className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
          <div className="card p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-[15px] font-bold text-ink">12개월 순자산</h2>
              <span className="text-[11px] text-ink-3">시작 0원 → {formatMan(settlement.netWorth)}</span>
            </div>
            <NetWorthChart state={state} />
          </div>

          <div className="card p-4">
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="text-[15px] font-bold text-ink">계좌별 최종 잔고</h2>
              <span className="text-[11px] text-ink-3">부채 {formatMan(settlement.debt)}</span>
            </div>
            <ul className="divide-y divide-line">
              {ACCOUNT_ORDER.map((id) => (
                <li key={id} className="flex items-center gap-2 py-1.5">
                  <AccountIcon id={id} size="sm" />
                  <span className="text-[13px] font-semibold text-ink-2">{ACCOUNTS[id].label}</span>
                  <span className="num ml-auto text-[14px] font-bold text-ink">{formatWon(settlement.finalBalances[id])}</span>
                  <span
                    className="ml-1 h-1.5 w-12 shrink-0 overflow-hidden rounded-full bg-surface-2"
                    role="img"
                    aria-label={`${ACCOUNTS[id].label} 비중 ${formatPct(settlement.netWorth > 0 ? settlement.finalBalances[id] / settlement.netWorth : 0)}`}
                  >
                    <span className={`block h-full ${ACCOUNT_LOOK[id].bg}`} style={{ width: `${Math.min(100, settlement.netWorth > 0 ? (settlement.finalBalances[id] / settlement.netWorth) * 120 : 0)}%` }} />
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-2 flex items-center justify-between rounded-xl bg-surface-2 px-3 py-2 text-[13px]">
              <span className="flex items-center gap-1.5 font-semibold text-ink-2">
                <Landmark size={15} aria-hidden /> 순자산
              </span>
              <Money value={settlement.netWorth} className="font-bold text-ink" />
            </div>
          </div>
        </section>

        {/* 가계부 비교 + 선택 기록 */}
        <section className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <BudgetDiff settlement={settlement} />
          <Timeline state={state} />
        </section>

        {/* 도전과제 */}
        <Achievements settlement={settlement} />

        {/* 정리 */}
        <section className="mt-4 grid gap-3 sm:grid-cols-2">
          {CLOSING_TIPS.map((tip) => (
            <div key={tip.title} className="card p-4">
              <h2 className="flex items-center gap-1.5 text-[15px] font-bold text-ink">
                <BookOpen size={16} className="text-primary" aria-hidden /> {tip.title}
              </h2>
              <ul className="mt-2 flex flex-col gap-1.5">
                {tip.items.map((it) => (
                  <li key={it} className="flex items-start gap-2 text-[13px] leading-relaxed text-ink-2">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                    {it}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          <Button variant="secondary" onClick={() => goScreen('start')}>
            <RotateCcw size={16} aria-hidden /> 처음부터 다시
          </Button>
          <Button onClick={() => go('result-present')} size="lg">
            <Presentation size={18} aria-hidden /> 발표용으로 크게 보기
          </Button>
        </div>
      </main>
      <LessonFooter />
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2 py-1.5">
      <dt className="text-ink-2">{label}</dt>
      <dd className={`num ${strong ? 'text-[15px] font-bold text-up' : 'font-semibold text-ink'}`}>
        <Money value={value} signed={value < 0} />
      </dd>
    </div>
  );
}

/** 12개월 순자산 선 그래프. 라이브러리 없이 SVG로 그린다 */
function NetWorthChart({ state }: { state: GameState }) {
  const points = useMemo(() => [{ month: 0, value: 0 }, ...state.history.map((h) => ({ month: h.month, value: h.netWorth }))], [state.history]);
  const W = 720;
  const H = 240;
  const pad = { l: 56, r: 16, t: 16, b: 28 };
  const max = Math.max(1, ...points.map((p) => p.value));
  const min = Math.min(0, ...points.map((p) => p.value));
  const span = max - min || 1;
  const x = (m: number) => pad.l + ((m - 0) / 12) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - (v - min) / span) * (H - pad.t - pad.b);
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.month).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const area = `${line} L${x(12)},${y(min)} L${x(0)},${y(min)} Z`;
  const last = points.at(-1)!;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => min + span * f);

  return (
    <figure className="mt-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-labelledby="nw-title" aria-describedby="nw-desc">
        <title id="nw-title">12개월 순자산 변화</title>
        <desc id="nw-desc">1월 0원에서 시작해 12월 {formatWon(last.value)}이 되었습니다.</desc>
        <defs>
          <linearGradient id="nw-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--color-line)" strokeWidth="1" strokeDasharray={t === min ? undefined : '3 4'} />
            <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--color-ink-3)" className="num">
              {t === 0 ? '0' : formatMan(t)}
            </text>
          </g>
        ))}
        <path d={area} fill="url(#nw-fill)" />
        <path d={line} fill="none" stroke="var(--color-primary)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {[1, 3, 6, 9, 12].map((m) => (
          <text key={m} x={x(m)} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--color-ink-3)" className="num">
            {m}월
          </text>
        ))}
        {points.map((p) => (
          <g key={p.month} tabIndex={0} role="listitem" aria-label={`${p.month === 0 ? '시작' : monthLabel(p.month)} 순자산 ${formatWon(p.value)}`} className="outline-none focus-visible:outline-none">
            <circle cx={x(p.month)} cy={y(p.value)} r="8" fill="transparent" />
            <circle cx={x(p.month)} cy={y(p.value)} r={p.month === last.month ? 4.5 : 2.5} fill={p.month === last.month ? 'var(--color-primary)' : 'var(--color-surface)'} stroke="var(--color-primary)" strokeWidth="2" />
          </g>
        ))}
        <g>
          <rect x={x(12) - 96} y={y(last.value) - 34} width="92" height="22" rx="6" fill="var(--color-surface)" stroke="var(--color-line)" />
          <text x={x(12) - 50} y={y(last.value) - 19} textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--color-ink)" className="num">
            {formatMan(last.value)}
          </text>
        </g>
      </svg>
      <ul className="sr-only-table">
        {points.map((p) => (
          <li key={p.month}>
            {p.month === 0 ? '시작' : monthLabel(p.month)} {formatWon(p.value)}
          </li>
        ))}
      </ul>
      <figcaption className="mt-1 text-[11px] text-ink-3">점에 포커스를 두면 그 달의 순자산을 읽을 수 있습니다. 순자산 = 계좌 합계 + 보유 물건 시세 − 부채.</figcaption>
    </figure>
  );
}

function BudgetDiff({ settlement }: { settlement: Settlement }) {
  return (
    <div className="card p-4">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-[15px] font-bold text-ink">처음 가계부 → 최종 가계부</h2>
        <span className="text-[11px] text-ink-3">{settlement.budgetDiff.length}개 항목 변경</span>
      </div>
      {settlement.budgetDiff.length === 0 ? (
        <p className="rounded-xl bg-surface-2 px-3 py-3 text-[13px] text-ink-2">1년 동안 가계부를 바꾸지 않았습니다.</p>
      ) : (
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-line text-left text-ink-3">
              <th scope="col" className="py-1.5 font-semibold">항목</th>
              <th scope="col" className="py-1.5 text-right font-semibold">처음</th>
              <th scope="col" className="py-1.5 text-right font-semibold">최종</th>
              <th scope="col" className="py-1.5 text-right font-semibold">변화</th>
            </tr>
          </thead>
          <tbody className="num">
            {settlement.budgetDiff.map((d) => (
              <tr key={d.key} className="border-b border-line/70 last:border-0">
                <th scope="row" className="py-1.5 text-left font-medium text-ink-2">{budgetKeyLabel(d.key)}</th>
                <td className="py-1.5 text-right text-ink-2">{formatMan(d.before)}</td>
                <td className="py-1.5 text-right font-semibold text-ink">{formatMan(d.after)}</td>
                <td className={`py-1.5 text-right font-bold ${d.after - d.before > 0 ? 'text-ink' : 'text-up'}`}>{formatSignedWon(d.after - d.before)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="mt-2 text-[11px] leading-relaxed text-ink-3">가계부를 고친 횟수 {Number(settlement.budgetDiff.length > 0)}회 이상 · 조정은 나쁜 것이 아니라 조건이 바뀌었다는 신호입니다.</p>
    </div>
  );
}

function Timeline({ state }: { state: GameState }) {
  return (
    <div className="card p-4">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-[15px] font-bold text-ink">선택 기록</h2>
        <span className="text-[11px] text-ink-3">{state.decisions.length}번의 선택</span>
      </div>
      <ol className="relative flex flex-col gap-0.5 border-l border-line pl-3">
        {state.decisions.map((d, i) => {
          const pay = d.payment
            ? [
                ...d.payment.parts.map((p) => `${ACCOUNTS[p.source].label} ${formatMan(p.amount)}`),
                ...(d.payment.card ? [`카드 ${d.payment.card.months}개월 ${formatMan(d.payment.card.amount)}`] : []),
              ].join(' + ')
            : null;
          return (
            <li key={`${d.month}-${d.eventCode}-${i}`} className="relative pb-2">
              <span className="absolute top-1.5 -left-[17px] size-2 rounded-full bg-primary ring-2 ring-surface" aria-hidden />
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="num text-[11px] font-bold text-primary">{monthLabel(d.month)}</span>
                <span className="num rounded bg-surface-2 px-1 text-[10px] font-bold text-ink-2">{d.eventCode}</span>
                <span className="text-[13px] font-semibold text-ink">{d.choiceLabel}</span>
              </div>
              {pay && <p className="num mt-0.5 text-[11px] text-ink-3">결제 · {pay}</p>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function Achievements({ settlement }: { settlement: Settlement }) {
  const done = settlement.achievements.filter((a) => a.unlocked).length;
  return (
    <section className="mt-4">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-[15px] font-bold text-ink">
          <Trophy size={17} className="text-accent" aria-hidden /> 도전과제
        </h2>
        <span className="text-[12px] text-ink-2">
          <strong className="num text-ink">{done}</strong> / {ACHIEVEMENT_ORDER.length} 달성
        </span>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {ACHIEVEMENT_ORDER.map((id: AchievementId) => {
          const def = ACHIEVEMENTS[id];
          const unlocked = settlement.achievements.find((a) => a.id === id)?.unlocked ?? false;
          const hidden = def.hidden && !unlocked;
          return (
            <li
              key={id}
              className={`rounded-2xl border p-3 ${unlocked ? 'border-accent/60 bg-accent-soft/60' : hidden ? 'border-dashed border-line-strong bg-surface-2/60' : 'border-line bg-surface'}`}
            >
              <div className="flex items-center gap-2">
                <span className={`flex size-8 shrink-0 items-center justify-center rounded-xl ${unlocked ? 'bg-accent text-white' : hidden ? 'bg-line text-ink-3' : 'bg-surface-2 text-ink-3'}`} aria-hidden>
                  {unlocked ? <Award size={18} /> : hidden ? <CircleHelp size={17} /> : <Lock size={16} />}
                </span>
                <div className="min-w-0">
                  <div className={`truncate text-[13px] font-bold ${unlocked ? 'text-accent-ink' : 'text-ink-2'}`}>{hidden ? '???' : def.title}</div>
                  <div className="text-[10px] font-semibold text-ink-3">{unlocked ? '달성' : hidden ? '숨은 도전과제' : '미달성'}</div>
                </div>
              </div>
              <p className="mt-1.5 text-[11px] leading-snug text-ink-2">{hidden ? '달성하면 공개됩니다. 다른 선택을 했다면 어땠을까요?' : def.description}</p>
              {!unlocked && !hidden && def.months.length > 0 && <p className="num mt-1 text-[10px] text-ink-3">관련 장면 {def.months.map((m) => `${m}월`).join(' · ')}</p>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** 프로젝터용 크게 보기: 닉네임, 엔딩, 순자산 그래프, 핵심 선택, 도전과제 수 */
function PresentationView({ state, go }: { state: GameState; go: ScreenProps['go'] }) {
  const settlement = state.settlement;
  if (!settlement) return null;
  const ending = ENDINGS[settlement.ending];
  const unlocked = settlement.achievements.filter((a) => a.unlocked).length;
  const keyDecisions = state.decisions.filter((d) => ['laptop-spill', 'sneaker-resell', 'market-crash', 'coin-room', 'rent-hike'].includes(d.eventId)).slice(0, 4);

  return (
    <div className="flex min-h-dvh flex-col bg-hud text-hud-ink">
      <div className="mx-auto flex w-full max-w-[1500px] flex-1 flex-col px-6 py-5 sm:px-10 sm:py-7">
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-2 text-[clamp(0.9rem,1.4vw,1.1rem)] font-semibold text-hud-ink-2">
            <span className="flex size-9 items-center justify-center rounded-xl bg-white/10 text-accent" aria-hidden>
              ₩
            </span>
            내 첫 월급, 1년 살아 보기
          </span>
          <button
            type="button"
            onClick={() => go('result-balanced')}
            className="min-h-11 rounded-xl border border-white/20 px-4 text-[15px] font-semibold text-hud-ink hover:bg-white/10"
          >
            결과 화면으로
          </button>
        </div>

        <div className="mt-4 grid flex-1 items-center gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
          <div>
            <p className="text-[clamp(1rem,1.6vw,1.35rem)] font-semibold text-accent">{state.profile.nickname}님의 1년</p>
            <h1 className="mt-2 text-[clamp(2.6rem,6vw,5rem)] font-bold leading-[1.05] tracking-tight text-white">{ending.title}</h1>
            <p className="mt-3 max-w-[28ch] text-[clamp(1.1rem,2vw,1.6rem)] leading-snug text-hud-ink-2">{ending.tagline}</p>

            <div className="mt-7">
              <div className="text-[clamp(0.9rem,1.4vw,1.1rem)] font-semibold text-hud-ink-2">최종 순자산</div>
              <div className="mt-1 text-[clamp(2.4rem,5.6vw,4.6rem)] font-bold leading-none text-white">
                <Money value={settlement.netWorth} />
              </div>
              <div className="num mt-2 flex flex-wrap gap-x-6 gap-y-1 text-[clamp(0.95rem,1.5vw,1.25rem)] text-hud-ink-2">
                <span>월급의 {(settlement.netWorth / state.profile.salary).toFixed(1)}배</span>
                <span>만족도 {state.satisfaction}</span>
                <span>
                  도전과제 {unlocked}/{ACHIEVEMENT_ORDER.length}
                </span>
              </div>
            </div>

            <div className="mt-6 hidden lg:block">
              <PresentationChart state={state} />
            </div>
          </div>

          <div className="lg:pl-6">
            <h2 className="text-[clamp(1.1rem,1.8vw,1.45rem)] font-bold text-white">핵심 선택</h2>
            <ol className="mt-3 flex flex-col gap-2.5">
              {keyDecisions.map((d, i) => (
                <li key={i} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3">
                  <span className="num mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent text-[15px] font-bold text-hud" aria-hidden>
                    {d.month}
                  </span>
                  <div className="min-w-0">
                    <div className="text-[clamp(0.8rem,1.1vw,0.95rem)] font-semibold text-hud-ink-2">
                      {d.month}월 · {d.eventCode}
                    </div>
                    <div className="text-[clamp(1rem,1.5vw,1.3rem)] font-bold leading-snug text-white">{d.choiceLabel}</div>
                  </div>
                </li>
              ))}
            </ol>
            <div className="mt-3 lg:hidden">
              <PresentationChart state={state} />
            </div>
            <div className="mt-5 flex items-center gap-3 rounded-2xl border border-accent/30 bg-accent/10 px-4 py-3">
              <Trophy size={22} className="text-accent" aria-hidden />
              <p className="text-[clamp(0.95rem,1.5vw,1.2rem)] font-semibold text-white">
                도전과제 {unlocked}개 달성 · {settlement.achievements.length - unlocked}개는 다른 선택에서
              </p>
            </div>
          </div>
        </div>

        <p className="mt-4 text-center text-[clamp(0.75rem,1vw,0.9rem)] text-hud-ink-2/70">
          같은 상황에서도 선택에 따라 결과가 달라집니다 · 학습용 가정 금리·수익률
        </p>
      </div>
      <span className="sr-only">발표용 화면에서는 {netWorth(state)}원의 순자산과 {unlocked}개의 도전과제를 보여 줍니다.</span>
    </div>
  );
}

function PresentationChart({ state }: { state: GameState }) {
  const points = [{ month: 0, value: 0 }, ...state.history.map((h) => ({ month: h.month, value: h.netWorth }))];
  const W = 640;
  const H = 180;
  const max = Math.max(1, ...points.map((p) => p.value));
  const x = (m: number) => 8 + (m / 12) * (W - 16);
  const y = (v: number) => 10 + (1 - v / max) * (H - 30);
  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.month).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const area = `${d} L${x(12)},${H - 20} L${x(0)},${H - 20} Z`;
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`12개월 순자산 추이, 마지막 ${formatWon(points.at(-1)!.value)}`}>
        <defs>
          <linearGradient id="pw-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <line x1="8" x2={W - 8} y1={H - 20} y2={H - 20} stroke="rgba(255,255,255,0.2)" />
        <path d={area} fill="url(#pw-fill)" />
        <path d={d} fill="none" stroke="var(--color-accent)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={x(12)} cy={y(points.at(-1)!.value)} r="7" fill="var(--color-accent)" />
        <text x={x(12)} y={y(points.at(-1)!.value) - 14} textAnchor="end" fontSize="20" fontWeight="700" fill="#fff" className="num">
          {formatMan(points.at(-1)!.value)}
        </text>
        <text x="8" y={H - 4} fontSize="15" fill="rgba(248,250,252,0.7)">1월</text>
        <text x={W - 8} y={H - 4} textAnchor="end" fontSize="15" fill="rgba(248,250,252,0.7)">12월</text>
      </svg>
    </figure>
  );
}
