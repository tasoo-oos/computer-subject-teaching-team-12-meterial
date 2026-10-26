import { creditGrade, emergencyMonths, formatMan, formatPct, netWorth, satisfactionBand, totalDebt, type GameState } from '@gagyebu/core';
import { Gauge, Landmark, ShieldCheck, TrendingDown, TrendingUp } from 'lucide-react';

/** HUD 지표: 순자산, 만족도, 신용점수, 비상금 개월 수 */
export function StatStrip({ state }: { state: GameState }) {
  const worth = netWorth(state);
  const prev = state.history.at(-1)?.netWorth;
  const diff = prev === undefined ? null : worth - prev;
  const debt = totalDebt(state);
  const months = emergencyMonths(state);
  const credit = creditGrade(state.credit);
  const sat = satisfactionBand(state.satisfaction);

  return (
    <div className="on-dark grid grid-cols-2 gap-2 sm:grid-cols-4">
      <div className="rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2">
        <div className="flex items-center gap-1 text-[11px] font-semibold text-hud-ink-2">
          <Landmark size={12} aria-hidden /> 순자산
        </div>
        <div className="num mt-0.5 text-[17px] font-bold leading-tight text-hud-ink">{formatMan(worth)}</div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-1 text-[10px]">
          {diff !== null && (
            <span className={diff >= 0 ? 'text-emerald-300' : 'text-orange-300'}>
              {diff >= 0 ? <TrendingUp size={10} className="mr-0.5 inline" aria-hidden /> : <TrendingDown size={10} className="mr-0.5 inline" aria-hidden />}
              지난달 {diff >= 0 ? '+' : ''}
              {formatMan(diff)}
            </span>
          )}
          {debt > 0 && <span className="text-orange-200">부채 {formatMan(debt)}</span>}
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2">
        <div className="flex items-center gap-1 text-[11px] font-semibold text-hud-ink-2">
          <Gauge size={12} aria-hidden /> 만족도
        </div>
        <div className="mt-0.5 flex items-baseline gap-1.5">
          <span className="num text-[17px] font-bold leading-tight text-hud-ink">{state.satisfaction}</span>
          <span className="text-[10px] text-hud-ink-2">{sat.label}</span>
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/15" role="img" aria-label={`만족도 ${state.satisfaction}점`}>
          <span className="block h-full rounded-full bg-emerald-300" style={{ width: `${state.satisfaction}%` }} />
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2">
        <div className="flex items-center gap-1 text-[11px] font-semibold text-hud-ink-2">
          <ShieldCheck size={12} aria-hidden /> 신용점수
        </div>
        <div className="mt-0.5 flex items-baseline gap-1.5">
          <span className="num text-[17px] font-bold leading-tight text-hud-ink">{state.credit}</span>
          <span className={`rounded px-1 text-[10px] font-bold ${credit.tier <= 2 ? 'bg-emerald-300/20 text-emerald-200' : 'bg-orange-300/20 text-orange-200'}`}>{credit.label}</span>
        </div>
        <div className="mt-0.5 text-[10px] text-hud-ink-2">등급 {credit.tier} / 5</div>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2">
        <div className="flex items-center gap-1 text-[11px] font-semibold text-hud-ink-2">
          <ShieldCheck size={12} aria-hidden /> 비상금
        </div>
        <div className="num mt-0.5 text-[17px] font-bold leading-tight text-hud-ink">{months.toFixed(1)}개월</div>
        <div className="mt-0.5 text-[10px] text-hud-ink-2">
          {formatMan(state.accounts.emergency.balance)} · 생활비의 {formatPct(Math.min(1, months / 3))}
        </div>
      </div>
    </div>
  );
}
