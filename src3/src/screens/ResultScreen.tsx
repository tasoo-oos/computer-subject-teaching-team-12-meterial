import { useState } from 'react';
import { ArrowUpRight, Award, Eye, Lock, Maximize2, Minimize2, Sparkles } from 'lucide-react';
import {
  ACCOUNTS,
  ACHIEVEMENTS,
  ACHIEVEMENT_ORDER,
  CLOSING_TIPS,
  ENDINGS,
  EXPENSES,
  formatMan,
  formatSignedWon,
  formatWon,
  type AccountId,
  type GameState,
  type MonthRecord,
  type Settlement,
} from '@gagyebu/core';
import type { ScreenProps } from '@gagyebu/draft-kit';
import { AppFrame } from '../components/AppFrame.tsx';
import { Button, Money, Tag } from '../components/ui.tsx';
import { ShareBar } from '../components/ShareBar.tsx';

const ACCOUNT_SHORT: Record<AccountId, string> = {
  living: '생활비',
  emergency: '비상금',
  savings: '적금',
  invest: '투자',
  goal: '목표',
  housing: '청약',
};

function diffLabel(key: string) {
  if (key === 'livingBuffer') return '생활비 여유분';
  return EXPENSES[key as keyof typeof EXPENSES]?.label ?? ACCOUNTS[key as AccountId]?.label ?? key;
}

export function ResultScreen({ state, ui, go }: ScreenProps) {
  const s = state.settlement!;
  const ending = ENDINGS[s.ending];
  const unlocked = s.achievements.filter((a) => a.unlocked).length;
  const [zoomed, setZoomed] = useState(false);

  if (ui.presentation || zoomed) {
    return <Presentation state={state} settlement={s} onExit={() => (ui.presentation ? go('result-balanced') : setZoomed(false))} />;
  }

  return (
    <AppFrame screen="result" nickname={state.profile.nickname} wide>
      <div className="flex flex-1 flex-col gap-2.5">
        <section className="cut grid gap-5 p-5 sm:p-6 lg:grid-cols-[1.25fr_1fr]">
          <div>
            <p className="text-[11px] font-bold text-mute">12월 결산 · {state.profile.nickname}의 1년</p>
            <h1 className="mt-1 text-[40px] leading-[1.05] font-extrabold tracking-[-0.04em] text-balance sm:text-[54px]">{ending.title}</h1>
            <p className="mt-2 text-[17px] leading-relaxed text-mute">{ending.tagline}</p>
            <div className="mt-4 flex flex-wrap items-end gap-x-8 gap-y-2">
              <div>
                <p className="text-[11px] font-bold text-mute">최종 순자산</p>
                <p className="num text-[32px] leading-tight font-extrabold tracking-[-0.02em]">{formatWon(s.netWorth)}</p>
                <p className="num text-[11px] text-mute">월급의 {(s.netWorth / state.profile.salary).toFixed(1)}배</p>
              </div>
              <div>
                <p className="text-[11px] font-bold text-mute">남은 부채</p>
                <p className={`num text-[20px] font-bold ${s.debt > 0 ? 'text-bad' : 'text-good'}`}>{formatWon(s.debt)}</p>
              </div>
              <div>
                <p className="text-[11px] font-bold text-mute">도전과제</p>
                <p className="num text-[20px] font-bold">
                  {unlocked} <span className="text-[13px] font-medium text-mute">/ {s.achievements.length}</span>
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button variant="plate" onClick={() => setZoomed(true)}>
                <Maximize2 size={16} /> 발표용 크게 보기
              </Button>
              <p className="text-[11px] leading-snug text-mute">교실 프로젝터에서 뒤에서도 읽히는 화면입니다.</p>
            </div>
          </div>

          <div className="rounded-[5px] bg-paper-2 p-4">
            <div className="flex items-baseline justify-between">
              <h2 className="text-[13px] font-bold">적금 만기</h2>
              <Tag tone={s.maturity.broken ? 'warn' : 'good'}>{s.maturity.broken ? '중도 해지' : '12회 납입 완료'}</Tag>
            </div>
            <dl className="mt-3 grid grid-cols-[1fr_auto] gap-y-1.5 text-[13px]">
              <dt className="text-mute">원금</dt>
              <dd><Money value={s.maturity.principal} className="font-semibold" /></dd>
              <dt className="text-mute">세전 이자</dt>
              <dd><Money value={s.maturity.interestGross} /></dd>
              <dt className="text-mute">이자소득세 15.4%</dt>
              <dd><Money value={-s.maturity.tax} /></dd>
              <dt className="border-t border-line pt-1.5 font-bold">세후 이자</dt>
              <dd className="border-t border-line pt-1.5"><Money value={s.maturity.interestNet} className="font-bold" /></dd>
            </dl>
            <div className="mt-3 grid grid-cols-12 gap-1" aria-hidden>
              {Array.from({ length: 12 }).map((_, i) => (
                <span key={i} className="h-2 rounded-[1px]" style={{ background: i < state.savings.paidMonths ? 'var(--color-acc-savings)' : 'var(--color-line)' }} />
              ))}
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-mute">
              {s.maturity.broken
                ? '중도에 해지해 이자가 연 0.5%로 줄었습니다. 묶인 돈을 미리 꺼낸 대가입니다.'
                : '월급날마다 넣은 12회 납입과 단리 이자입니다. 학습용 가정 금리 연 3.5%.'}
            </p>
          </div>
        </section>

        <div className="grid gap-2.5 lg:grid-cols-[1.25fr_1fr]">
          <section className="cut p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-[15px] font-bold">12개월 순자산</h2>
              <p className="num text-[11px] text-mute">
                {state.history[0] ? `${formatMan(state.history[0]!.netWorth)} → ` : ''}
                <b className="text-text">{formatMan(s.netWorth)}</b>
              </p>
            </div>
            <NetWorthChart history={state.history} />
          </section>

          <section className="cut p-5">
            <div className="flex items-baseline justify-between">
              <h2 className="text-[15px] font-bold">계좌별 최종 잔고</h2>
              <span className="text-[11px] text-mute">합계 {formatMan(Object.values(s.finalBalances).reduce((a, b) => a + b, 0))}</span>
            </div>
            <ul className="mt-3 grid gap-1">
              {(Object.keys(s.finalBalances) as AccountId[]).map((id) => (
                <li key={id} className="flex items-center gap-2 text-[13px]">
                  <span className="size-2.5 rounded-[2px]" style={{ background: `var(--color-acc-${id})` }} aria-hidden />
                  <span className="w-14 text-mute">{ACCOUNT_SHORT[id]}</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-[2px] bg-paper-2">
                    <span
                      className="block h-full"
                      style={{ width: `${Math.min(100, (s.finalBalances[id] / Math.max(1, ...Object.values(s.finalBalances))) * 100)}%`, background: `var(--color-acc-${id})` }}
                    />
                  </span>
                  <Money value={s.finalBalances[id]} className="w-[6.5rem] shrink-0 text-right font-semibold" />
                </li>
              ))}
            </ul>
            <div className="mt-4">
              <p className="mb-2 text-[11px] font-bold text-mute">최종 배분</p>
              <ShareBar shares={sharesOf(s.finalBalances)} height={12} labels={false} />
            </div>
          </section>
        </div>

        <div className="grid gap-2.5 lg:grid-cols-[1fr_1.2fr]">
          <section className="cut p-5">
            <h2 className="text-[15px] font-bold">처음 가계부와 비교</h2>
            {s.budgetDiff.length === 0 ? (
              <p className="mt-2 text-[13px] text-mute">1년 동안 가계부를 그대로 유지했습니다.</p>
            ) : (
              <table className="mt-2 w-full text-[12px]">
                <thead>
                  <tr className="text-left text-mute">
                    <th className="pb-1 font-medium">항목</th>
                    <th className="pb-1 text-right font-medium">처음</th>
                    <th className="pb-1 text-right font-medium">최종</th>
                    <th className="pb-1 text-right font-medium">변화</th>
                  </tr>
                </thead>
                <tbody>
                  {s.budgetDiff.map((d) => (
                    <tr key={d.key} className="border-t border-line">
                      <td className="py-1">{diffLabel(d.key)}</td>
                      <td className="num py-1 text-right">{formatMan(d.before)}</td>
                      <td className="num py-1 text-right">{formatMan(d.after)}</td>
                      <td className={`num py-1 text-right font-semibold ${d.after > d.before ? 'text-warn' : 'text-text'}`}>
                        {formatSignedWon(d.after - d.before)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p className="mt-2 text-[11px] leading-relaxed text-mute">
              처음과 달라진 항목만 표시합니다. 가계부를 {state.budgetEdits}번 조정했습니다. 고정비는 한 번 바뀌면 매달 따라옵니다.
            </p>
          </section>

          <section className="cut p-5">
            <div className="flex items-baseline justify-between">
              <h2 className="text-[15px] font-bold">도전과제</h2>
              <p className="num text-[11px] text-mute">
                {unlocked} / {s.achievements.length}
              </p>
            </div>
            <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
              {ACHIEVEMENT_ORDER.map((id) => {
                const def = ACHIEVEMENTS[id];
                const got = s.achievements.find((a) => a.id === id)?.unlocked ?? false;
                const hidden = def.hidden && !got;
                return (
                  <li
                    key={id}
                    className={`rounded-[4px] px-2.5 py-2 ${got ? 'bg-paper-2' : 'border border-dashed border-line-strong'}`}
                  >
                    <p className="flex items-center gap-1.5 text-[12px] font-bold">
                      {got ? <Award size={13} className="text-good" aria-hidden /> : hidden ? <Lock size={12} className="text-mute" aria-hidden /> : <span className="size-3 rounded-full border border-line-strong" aria-hidden />}
                      <span className={got ? '' : 'text-mute'}>{hidden ? '???' : def.title}</span>
                    </p>
                    <p className="mt-0.5 text-[10px] leading-snug text-mute">
                      {hidden ? '숨은 도전과제 · 다른 선택으로 열립니다.' : def.description}
                    </p>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>

        <section className="cut p-5">
          <h2 className="text-[15px] font-bold">선택 기록</h2>
          {state.decisions.length === 0 ? (
            <p className="mt-2 text-[13px] text-mute">기록된 선택이 없습니다.</p>
          ) : (
            <ol className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
              {state.decisions.map((d, i) => (
                <li key={`${d.month}-${d.choiceId}-${i}`} className="flex gap-2.5">
                  <span className="num mt-0.5 w-8 shrink-0 text-[11px] font-bold text-mute">{d.month}월</span>
                  <div className="min-w-0">
                    <p className="text-[12px] leading-snug font-semibold">{d.choiceLabel}</p>
                    <p className="num text-[10px] text-mute">
                      {d.eventCode} {d.kind === 'free' ? '돈 쓰지 않음' : d.kind === 'deposit' ? '입금' : d.kind === 'gamble' ? '결과는 나중에' : d.kind === 'budget' ? '가계부 변경' : '지불'}
                      {d.payment?.parts?.length
                        ? ` · ${d.payment.parts.map((p) => `${ACCOUNT_SHORT[p.source]} ${formatMan(p.amount)}`).join(' + ')}`
                        : d.payment?.card
                          ? ` · 카드 ${d.payment.card.months}개월 ${formatMan(d.payment.card.amount)}`
                          : ''}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="cut grid gap-6 p-5 sm:grid-cols-2">
          {CLOSING_TIPS.map((tip) => (
            <div key={tip.title}>
              <h2 className="flex items-center gap-1.5 text-[15px] font-bold">
                <Sparkles size={15} aria-hidden /> {tip.title}
              </h2>
              <ul className="mt-2 grid gap-1.5">
                {tip.items.map((it) => (
                  <li key={it} className="flex gap-2 text-[12px] leading-relaxed text-mute">
                    <span className="mt-1.5 size-1 shrink-0 rounded-full bg-line-strong" aria-hidden />
                    {it}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      </div>
    </AppFrame>
  );
}

function sharesOf(balances: Record<AccountId, number>): Record<AccountId, number> {
  const total = Object.values(balances).reduce((a, b) => a + b, 0) || 1;
  return Object.fromEntries((Object.keys(balances) as AccountId[]).map((id) => [id, Math.max(0, balances[id]) / total])) as Record<AccountId, number>;
}

/** 12개월 순자산 선 그래프: SVG로 직접 그린다 */
export function NetWorthChart({ history, tall = false }: { history: MonthRecord[]; tall?: boolean }) {
  const points = history.length ? [...history.map((h) => h.netWorth)] : [0];
  const max = Math.max(...points, 0);
  const min = Math.min(...points, 0);
  const span = max - min || 1;
  const W = 600;
  const H = tall ? 260 : 150;
  const padX = 8;
  const padY = tall ? 22 : 16;
  const x = (i: number) => padX + (i / Math.max(1, points.length - 1)) * (W - padX * 2);
  const y = (v: number) => padY + (1 - (v - min) / span) * (H - padY * 2);
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p).toFixed(1)}`).join(' ');
  const area = `${line} L${x(points.length - 1).toFixed(1)},${y(min).toFixed(1)} L${x(0).toFixed(1)},${y(min).toFixed(1)} Z`;
  const last = points.at(-1) ?? 0;

  return (
    <figure className="mt-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`1월부터 12월까지 순자산 변화, 마지막 ${formatWon(last)}`}>
        {[0, 0.5, 1].map((f) => (
          <line
            key={f}
            x1={padX}
            x2={W - padX}
            y1={padY + f * (H - padY * 2)}
            y2={padY + f * (H - padY * 2)}
            stroke="var(--color-line)"
            strokeWidth="1"
          />
        ))}
        {min < 0 && <line x1={padX} x2={W - padX} y1={y(0)} y2={y(0)} stroke="var(--color-line-strong)" strokeDasharray="3 3" />}
        <path d={area} fill="var(--color-flash)" opacity="0.5" />
        <path d={line} fill="none" stroke="var(--color-ink)" strokeWidth={tall ? 3 : 2.2} strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={x(points.length - 1)} cy={y(last)} r={tall ? 7 : 4.5} fill="var(--color-ink)" stroke="var(--color-paper)" strokeWidth="2.5" />
        {history.map((h, i) => (
          <text
            key={h.month}
            x={x(i)}
            y={H - 2}
            textAnchor="middle"
            fontSize={tall ? 12 : 8}
            fill="var(--color-mute)"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {h.month}
          </text>
        ))}
      </svg>
      <figcaption className="mt-1 flex justify-between text-[10px] text-mute">
        <span>1월</span>
        <span className="num">최고 {formatMan(max)}</span>
        <span className="num">
          {points.length > 1 ? `1년 변화 ${points.at(-1)! - points[0]! >= 0 ? '+' : ''}${formatMan(points.at(-1)! - points[0]!)}` : '1년 변화 0원'}
        </span>
        <span>12월</span>
      </figcaption>
    </figure>
  );
}

function keyDecisions(state: GameState) {
  const score = (tags: string[]) =>
    tags.reduce((a, t) => a + ({ fraudHit: 3, fraudAvoided: 3, negotiated: 3, heldInvest: 2, soldInvest: 2, resellProfit: 2, plannedJoy: 2, lotteryAgain: 1, deferred: 1 }[t] ?? 0), 0);
  return [...state.decisions]
    .map((d) => ({ d, s: score(d.tags) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.d.month - b.d.month)
    .slice(0, 4)
    .sort((a, b) => a.d.month - b.d.month)
    .map((x) => x.d);
}

function Presentation({ state, settlement, onExit }: { state: GameState; settlement: Settlement; onExit: () => void }) {
  const ending = ENDINGS[settlement.ending];
  const unlocked = settlement.achievements.filter((a) => a.unlocked).length;
  const picks = keyDecisions(state);
  const cover = picks.length ? picks : state.decisions.slice(0, 4);

  return (
    <div className="flex min-h-dvh flex-col bg-ink px-4 py-4 text-frame sm:px-8 sm:py-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[clamp(13px,1.4vw,18px)] font-semibold text-frame-mute">
          {state.profile.nickname} · 첫 월급 1년 결산
        </p>
        <Button variant="ghostInk" size="sm" onClick={onExit}>
          <Minimize2 size={15} /> 작게 보기
        </Button>
      </div>

      <div className="mt-2 flex flex-wrap items-end justify-between gap-x-10 gap-y-3 sm:mt-4">
        <div className="min-w-0">
          <h1 className="text-[clamp(34px,5.4vw,80px)] leading-[0.98] font-extrabold tracking-[-0.04em] text-balance">{ending.title}</h1>
          <p className="mt-2 max-w-[30em] text-[clamp(14px,1.5vw,22px)] leading-snug text-frame-mute">{ending.tagline}</p>
        </div>
        <div className="text-right">
          <p className="text-[clamp(11px,1vw,14px)] font-semibold text-frame-mute">최종 순자산</p>
          <p className="num text-[clamp(28px,4vw,64px)] leading-none font-extrabold tracking-[-0.03em]">{formatWon(settlement.netWorth)}</p>
          <p className="num mt-1 text-[clamp(11px,1vw,15px)] text-frame-mute">
            월급의 {(settlement.netWorth / state.profile.salary).toFixed(1)}배 · 도전과제 {unlocked}/{settlement.achievements.length}
          </p>
        </div>
      </div>

      <div className="mt-3 grid flex-1 gap-3 sm:mt-5 lg:grid-cols-[1.5fr_1fr]">
        <div className="rounded-[6px] bg-paper p-3 text-text sm:p-5">
          <p className="text-[clamp(11px,1vw,14px)] font-bold text-mute">12개월 순자산</p>
          <div className="mt-1">
            <NetWorthChart history={state.history} tall />
          </div>
        </div>
        <div className="grid gap-2">
          <p className="text-[clamp(11px,1vw,14px)] font-bold text-frame-mute">핵심 선택</p>
          {cover.map((d) => (
            <div key={`${d.month}-${d.choiceId}`} className="rounded-[4px] bg-ink-3 px-3 py-2">
              <p className="num text-[clamp(10px,0.9vw,12px)] text-frame-mute">
                {d.month}월 · {d.eventCode}
              </p>
              <p className="text-[clamp(13px,1.35vw,20px)] leading-snug font-semibold">{d.choiceLabel}</p>
            </div>
          ))}
          <div className="mt-auto grid gap-1 text-[clamp(11px,1vw,14px)] text-frame-mute">
            <p className="flex items-center gap-1.5">
              <Eye size={14} aria-hidden /> 적금 만기 <span className="num text-frame">{formatMan(settlement.maturity.principal + settlement.maturity.interestNet)}</span>
            </p>
            <p className="flex items-center gap-1.5">
              <ArrowUpRight size={14} aria-hidden /> 남은 부채 <span className="num text-frame">{settlement.debt > 0 ? formatMan(settlement.debt) : '없음'}</span>
            </p>
          </div>
        </div>
      </div>
      <p className="mt-2 text-center text-[clamp(10px,0.9vw,13px)] text-frame-mute">
        {ENDING_SUB[settlement.ending]} · 금리와 수익률은 수업용 가정값입니다.
      </p>
    </div>
  );
}

const ENDING_SUB: Record<string, string> = {
  balanced: '저축과 즐거움의 균형을 지킨 1년',
  debt: '빚이 내년의 월급을 먼저 쓰고 있습니다',
  frugal: '많이 모았지만 마음은 조금 지쳤습니다',
  yolo: '즐거웠지만 다음 비상이 걱정됩니다',
  ordinary: '큰 사고 없이 버틴 1년',
};
