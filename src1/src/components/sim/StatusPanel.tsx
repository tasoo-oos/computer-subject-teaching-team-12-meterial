import { CalendarClock, TrendingUp, CircleAlert, CircleCheck, Minus } from 'lucide-react';
import { STATUSES, formatWon, sneakerValue, type GameState, type StatusId } from '@gagyebu/core';

const TONE: Record<'buff' | 'debuff' | 'neutral', { icon: typeof CircleCheck; label: string; cls: string }> = {
  buff: { icon: TrendingUp, label: '도움', cls: 'text-acc-savings' },
  debuff: { icon: CircleAlert, label: '부담', cls: 'text-seal' },
  neutral: { icon: Minus, label: '유지', cls: 'text-ink-2' },
};

/** 지속 효과 + 예약된 장면 예고. 효과의 좋고 나쁨은 성격(tone)만 표시한다 */
export function StatusPanel({ state, onSellSneakers }: { state: GameState; onSellSneakers?: () => void }) {
  return (
    <section aria-labelledby="status-title" className="rounded-panel bg-sheet p-3.5 shadow-[0_0_0_1px_var(--color-rule)]">
      <h2 id="status-title" className="text-[15px] font-bold">
        남아 있는 효과
      </h2>
      {state.statuses.length === 0 ? (
        <p className="mt-1 text-[13px] text-ink-3">지금은 남아 있는 효과가 없어요.</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {state.statuses.map((s) => {
            const def = STATUSES[s.id as StatusId];
            const tone = TONE[def.tone];
            const Icon = tone.icon;
            const left = s.until ? Math.max(0, s.until - state.month) : null;
            return (
              <li key={s.id} className="rounded-[8px] bg-paper px-2.5 py-2">
                <div className="flex items-center gap-1.5">
                  <Icon size={14} className={`${tone.cls} flex-none`} aria-hidden />
                  <p className="min-w-0 flex-1 text-[13px] font-semibold leading-tight">
                    {def.label}
                    {s.count && s.count > 1 ? ` ${s.count}켤레` : ''}
                  </p>
                  <span className="num shrink-0 rounded-[3px] bg-white px-1.5 text-[11px] text-ink-2">
                    {tone.label}
                    {left !== null ? ` · ${left}개월` : ''}
                  </span>
                </div>
                <p className="mt-0.5 text-[11.5px] leading-snug text-ink-2">
                  {s.note ?? def.description}
                  {s.note ? ` · 팔면 ${formatWon(sneakerValue(state))}` : ''}
                </p>
                {def.actions?.length && s.id === 'sneakers' ? (
                  <button type="button" onClick={onSellSneakers} className="btn btn-quiet mt-1.5 min-h-11 px-2.5 text-[12px]">
                    {def.actions[0]!.label}
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      {state.scheduled.length ? (
        <div className="mt-3 border-t border-rule-soft pt-2">
          <h3 className="flex items-center gap-1.5 text-[12px] font-bold text-ink-2">
            <CalendarClock size={13} aria-hidden />
            예약된 장면
          </h3>
          <ul className="mt-1 space-y-1">
            {state.scheduled.map((x) => (
              <li key={`${x.eventId}-${x.sceneId}`} className="text-[12px] leading-snug text-ink-2">
                <span className="num font-semibold text-ink">{x.month}월</span> · {x.reason}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-2 border-t border-rule-soft pt-2 text-[12px] text-ink-3">예약된 장면은 없습니다.</p>
      )}
    </section>
  );
}
