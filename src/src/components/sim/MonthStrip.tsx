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
    <div>
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
                now
                  ? 'bg-ink'
                  : done
                    ? 'bg-ink/45'
                    : kind === 'settlement'
                      ? 'bg-seal/70'
                      : kind === 'quiet'
                        ? 'bg-rule-soft'
                        : 'bg-rule'
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
      <p className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[10px] leading-none text-ink-3">
        <span className="flex items-center gap-1"><span aria-hidden className="h-1 w-3 rounded-full bg-rule" />사건 있는 달</span>
        <span className="flex items-center gap-1"><span aria-hidden className="h-1 w-3 rounded-full bg-rule-soft" />조용한 달</span>
        <span className="flex items-center gap-1"><span aria-hidden className="h-1 w-3 rounded-full bg-seal/70" />12월 결산</span>
      </p>
    </div>
  );
}
