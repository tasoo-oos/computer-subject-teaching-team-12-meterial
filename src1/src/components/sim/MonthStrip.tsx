import { eventForMonth, monthKind } from '@gagyebu/core';

const KIND_NOTE: Record<string, string> = {
  tutorial: '첫 월급',
  event: '사건',
  quiet: '조용한 달',
  settlement: '결산',
};

/** 1~12월 진행. 이벤트가 있는 달과 없는 달을 구분한다 */
export function MonthStrip({ month }: { month: number }) {
  return (
    <ol className="flex items-end gap-1" aria-label={`12개월 중 ${month}월`}>
      {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
        const kind = monthKind(m);
        const ev = eventForMonth(m);
        const done = m < month;
        const now = m === month;
        return (
          <li key={m} className="flex flex-1 flex-col items-center gap-1" title={`${m}월 · ${ev ? ev.title : KIND_NOTE[kind]}`}>
            <span
              aria-hidden
              className={`h-1.5 w-full rounded-full ${
                now ? 'bg-ink' : done ? 'bg-ink/45' : kind === 'quiet' || kind === 'settlement' ? 'bg-rule-soft' : 'bg-rule'
              }`}
            />
            <span
              className={`num text-[11px] leading-none ${
                now ? 'font-bold text-ink' : done ? 'text-ink-2' : 'text-ink-3'
              }`}
            >
              {m}
            </span>
            <span aria-hidden className={`size-1.5 rounded-full ${now ? 'bg-ink' : ev && m > month ? 'bg-ink-3' : 'bg-transparent'}`} />
          </li>
        );
      })}
    </ol>
  );
}
