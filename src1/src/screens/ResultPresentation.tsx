import { X } from 'lucide-react';
import { ENDINGS, formatMan, satisfactionBand, totalDebt, type GameState } from '@gagyebu/core';
import { NetWorthChart } from '../components/result/NetWorthChart.tsx';

/** 교실 프로젝터용 크게 보기. 멀리서도 읽히는 것만 남긴다 */
export function PresentationView({ state, onExit }: { state: GameState; onExit: () => void }) {
  const s = state.settlement;
  if (!s) return null;
  const ending = ENDINGS[s.ending];
  const debt = totalDebt(state);
  const keyMonths = [2, 6, 8, 11];
  const picks = keyMonths
    .map((m) => state.decisions.find((d) => d.month === m))
    .filter((d): d is NonNullable<typeof d> => Boolean(d))
    .slice(0, 4);
  const achievements = s.achievements.filter((a) => a.unlocked).length;
  return (
    <div className="paper-texture flex min-h-dvh flex-col px-[4vw] py-[3vh]">
      <header className="flex items-center justify-between gap-4">
        <p className="text-[clamp(16px,1.5vw,22px)] text-ink-2">
          {state.profile.nickname}님의 첫 월급 1년 · <span className="num">12월 결산</span>
        </p>
        <button type="button" onClick={onExit} className="btn btn-quiet px-3 text-[15px]">
          <X size={18} aria-hidden />
          <span className="hidden sm:inline">크게 보기 닫기</span>
        </button>
      </header>

      <div className="mt-[3vh] grid flex-1 items-center gap-[4vw] lg:grid-cols-[1.25fr_1fr]">
        <section>
          <h1 className="display text-[clamp(52px,7.5vw,104px)] leading-[1.02]">{ending.title}</h1>
          <p className="mt-[1.6vh] max-w-[22em] text-[clamp(19px,2.1vw,30px)] font-medium leading-snug">{ending.tagline}</p>
          <dl className="mt-[3vh] flex flex-wrap items-end gap-x-[4vw] gap-y-[1.5vh] border-t-2 border-ink pt-[2vh]">
            <div>
              <dt className="text-[clamp(13px,1.2vw,17px)] text-ink-2">최종 순자산</dt>
              <dd className="num text-[clamp(38px,5.2vw,72px)] font-bold leading-none">{formatMan(s.netWorth)}</dd>
            </div>
            <div className="num text-[clamp(15px,1.5vw,21px)] leading-snug text-ink-2">
              <p>
                월급의 <strong className="num whitespace-nowrap text-ink">{(s.netWorth / state.profile.salary).toFixed(1)}배</strong>
              </p>
              <p>
                만족도 <strong className="num whitespace-nowrap text-ink">{state.satisfaction}</strong> ({satisfactionBand(state.satisfaction).label})
              </p>
              <p>{debt > 0 ? `남은 부채 ${formatMan(debt)}` : '부채 없음'}</p>
            </div>
          </dl>
        </section>

        <figure className="m-0 rounded-panel bg-sheet p-[2vw] shadow-[0_0_0_1px_var(--color-rule)]">
          <figcaption className="flex items-baseline justify-between gap-2">
            <span className="text-[clamp(14px,1.3vw,19px)] font-bold text-ink-2">12개월 순자산</span>
            <span className="num text-[clamp(13px,1.2vw,17px)] text-ink-3">
              {formatMan(state.history[0]?.netWorth ?? 0)} → {formatMan(s.netWorth)}
            </span>
          </figcaption>
          <NetWorthChart state={state} large height={330} />
        </figure>
      </div>

      <div className="mt-[3vh] grid gap-[1.2vw] sm:grid-cols-2 lg:grid-cols-[repeat(4,1fr)_auto]">
        {picks.map((d) => (
          <div key={`${d.month}-${d.choiceId}`} className="rounded-[6px] bg-sheet px-[1.2vw] py-[1.2vh] shadow-[inset_0_0_0_1px_var(--color-rule)]">
            <p className="num text-[clamp(12px,1.1vw,16px)] font-semibold text-ink-2">
              {d.month}월 · 사건 {d.eventCode}
            </p>
            <p className="mt-0.5 text-[clamp(14px,1.35vw,20px)] font-semibold leading-snug">{d.choiceLabel}</p>
          </div>
        ))}
        <div className="flex flex-col justify-center rounded-[6px] bg-ink px-[1.2vw] py-[1.2vh] text-white">
          <p className="text-[clamp(12px,1.1vw,16px)] text-white/75">도전과제</p>
          <p className="num text-[clamp(24px,2.6vw,40px)] font-bold leading-none">
            {achievements}
            <span className="text-[clamp(14px,1.3vw,19px)] font-medium text-white/70"> / {s.achievements.length}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
