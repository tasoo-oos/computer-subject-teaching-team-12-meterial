import { TrendingDown, TrendingUp } from 'lucide-react';
import { ACCOUNTS, ACCOUNT_ORDER, formatMan, monthLabel, netWorth, type GameState } from '@gagyebu/core';
import { Money } from '../Money.tsx';
import { monthDeltas } from '../../lib/month.ts';
import { Spine } from '../Spine.tsx';
import { useActBusy } from '../../lib/actBusy.tsx';

/** 이벤트 없는 달의 월말 리포트. onNext가 없으면 읽기 전용(라이브 대기 화면) */
export function ReportStage({ state, onNext }: { state: GameState; onNext?: () => void }) {
  const busy = useActBusy();
  const p = state.payday;
  const prev = state.history.at(-1)?.netWorth ?? 0;
  const now = netWorth(state);
  const diff = now - prev;
  const earnings = p ? Object.values(p.earnings).reduce((a, b) => a + (b ?? 0), 0) : 0;
  const short = p?.livingShortfall ?? 0;
  return (
    <div className="grid gap-4">
      <section className="sheet-in rounded-panel bg-sheet shadow-[0_0_0_1px_var(--color-rule)]" aria-labelledby="report-title">
        <header className="flex flex-wrap items-end justify-between gap-2 border-b-2 border-ink px-5 py-3">
          <div>
            <p className="text-[12px] font-semibold text-ink-2">{monthLabel(state.month)} 마지막 날</p>
            <h2 id="report-title" className="display text-[26px]">
              월말 리포트
            </h2>
          </div>
          <p className="text-right">
            <span className="block text-[12px] text-ink-2">순자산</span>
            <span className="num text-[24px] font-bold leading-none">{formatMan(now)}</span>
          </p>
        </header>
        <dl className="grid grid-cols-2 gap-x-5 gap-y-3 px-5 py-4 sm:grid-cols-4">
          <div>
            <dt className="text-[12px] text-ink-2">이번 달 월급</dt>
            <dd className="text-[17px] font-bold">
              <Money value={p?.salary ?? 0} unit="man" />
            </dd>
          </div>
          <div>
            <dt className="text-[12px] text-ink-2">생활비 지출</dt>
            <dd className="text-[17px] font-bold">
              <Money value={-(p?.spending ?? 0)} unit="man" />
            </dd>
          </div>
          <div>
            <dt className="text-[12px] text-ink-2">이자·투자 수익</dt>
            <dd className="text-[17px] font-bold">
              <Money value={earnings} signed unit="man" />
            </dd>
          </div>
          <div>
            <dt className="text-[12px] text-ink-2">지난달 대비 순자산</dt>
            <dd className={`num flex items-center gap-1 text-[17px] font-bold ${diff >= 0 ? 'text-in' : 'text-seal'}`}>
              {diff >= 0 ? <TrendingUp size={16} aria-hidden /> : <TrendingDown size={16} aria-hidden />}
              {formatMan(diff)}
            </dd>
          </div>
        </dl>
        {short > 0 ? (
          <p className="mx-5 mb-4 rounded-[8px] bg-seal-soft px-3.5 py-2.5 text-[13px] leading-relaxed text-seal">
            생활비 통장이 {formatMan(short)} 모자라 카드값으로 넘어갔습니다. 다음 달 생활비에서 빠지고, 만족도가 떨어졌어요.
          </p>
        ) : null}
        <div className="border-t border-rule px-5 py-3">
          <h3 className="text-[13px] font-bold text-ink-2">이번 달 통장별 변화</h3>
          <ul className="mt-1 grid gap-x-6 sm:grid-cols-2">
            {ACCOUNT_ORDER.map((id) => (
              <li key={id} className="flex items-center gap-2 border-b border-rule-soft py-1 last:border-0">
                <Spine id={id} className="h-4" />
                <span className="flex-1 text-[13px]">{ACCOUNTS[id].label}</span>
                <Money value={monthDeltas(state)[id]} signed unit="man" className="text-[13px] font-semibold" />
              </li>
            ))}
          </ul>
        </div>
      </section>
      <div className="flex items-center justify-between gap-3">
        <p className="text-[12px] text-ink-3">금리와 수익률은 수업을 위한 가정값입니다.</p>
        {onNext ? (
          <button type="button" onClick={onNext} disabled={busy} className="btn btn-primary px-6">
            다음 달로
          </button>
        ) : null}
      </div>
    </div>
  );
}
