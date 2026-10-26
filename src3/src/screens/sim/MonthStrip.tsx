import { eventForMonth, monthKind, netWorth, type GameState, type MonthKind } from '@gagyebu/core';

const KIND_LABEL: Record<MonthKind, string> = {
  tutorial: '튜토리얼',
  event: '이벤트',
  quiet: '조용한 달',
  settlement: '결산',
};

/** 인화 띠: 12개월이 한 줄의 컷으로 이어지고, 지나온 달에는 그달의 순자산이 현상된다 */
export function MonthStrip({ state }: { state: GameState }) {
  const current = state.month;
  const marks = state.history.map((h) => h.netWorth);
  const max = Math.max(1, ...marks);
  const min = Math.min(0, ...marks);
  const span = max - min || 1;

  return (
    <ol className="grid grid-cols-6 gap-1 sm:flex" aria-label="1년 진행">
      {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
        const kind = monthKind(m);
        const event = eventForMonth(m);
        const past = m < current || (m === 12 && state.phase === 'result');
        const now = m === current && state.phase !== 'result';
        const label = m === 1 ? '튜토리얼' : kind === 'settlement' ? '결산' : event ? event.code : '조용한 달';
        const record = state.history.find((h) => h.month === m);
        const bar = record ? Math.max(3, Math.round(((record.netWorth - min) / span) * 22)) : 0;
        return (
          <li
            key={m}
            aria-current={now ? 'step' : undefined}
            className={`flex min-w-0 flex-1 flex-col rounded-[3px] px-1 py-0.5 ${
              now ? 'bg-flash text-ink' : past ? 'bg-ink-3 text-frame' : 'border border-ink-4 text-frame-mute'
            }`}
            title={`${m}월 · ${event ? event.title : KIND_LABEL[kind]}`}
          >
            <div className="flex items-baseline justify-between gap-1">
              <span className="num text-[12px] leading-none font-bold">{String(m).padStart(2, '0')}</span>
              {now && <span className="text-[8px] font-bold">지금</span>}
            </div>
            <div className="mt-0.5 flex h-[22px] items-end" aria-hidden>
              {record ? (
                <span className={`w-full rounded-[1px] ${now ? 'bg-ink' : 'bg-frame/70'}`} style={{ height: bar }} />
              ) : now ? (
                <span className="w-full border-t border-dashed border-ink/40" />
              ) : null}
            </div>
            <span className={`mt-0.5 block truncate text-[8px] leading-tight font-semibold ${now ? 'text-ink' : 'text-frame-mute'}`}>{label}</span>
          </li>
        );
      })}
    </ol>
  );
}
