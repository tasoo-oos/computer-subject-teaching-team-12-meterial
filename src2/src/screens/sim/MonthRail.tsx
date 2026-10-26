import { EVENT_TYPE_LABEL, eventForMonth, monthKind, type MonthNo } from '@gagyebu/core';
import { Flag, Sparkles } from 'lucide-react';

const MONTHS: MonthNo[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

function kindLabel(m: MonthNo): string {
  const k = monthKind(m);
  if (k === 'tutorial') return '튜토리얼';
  if (k === 'settlement') return '결산';
  if (k === 'quiet') return '조용한 달';
  const e = eventForMonth(m);
  return e ? EVENT_TYPE_LABEL[e.type] : '이벤트';
}

/** 12개월 진행 레일. 이벤트 달·조용한 달·결산을 구분해 보여 준다 */
export function MonthRail({ month }: { month: MonthNo }) {
  return (
    <nav aria-label="12개월 진행" className="on-dark mt-3">
      <ol className="flex gap-1 overflow-x-auto pb-1 sm:gap-1.5">
        {MONTHS.map((m) => {
          const k = monthKind(m);
          const active = m === month;
          const done = m < month;
          const label = kindLabel(m);
          return (
            <li key={m} className="min-w-0 flex-1">
              <div
                aria-current={active ? 'step' : undefined}
                className={`relative flex h-full min-w-[56px] flex-col items-center gap-1 rounded-xl border px-1 py-1.5 transition-colors ${
                  active
                    ? 'border-accent bg-accent/15'
                    : done
                      ? 'border-white/10 bg-white/5'
                      : 'border-white/10 border-dashed'
                }`}
              >
                <span
                  className={`num flex size-7 items-center justify-center rounded-full text-[13px] font-bold ${
                    active ? 'bg-accent text-hud' : done ? 'bg-white/15 text-hud-ink' : 'text-hud-ink-2/70 ring-1 ring-white/15'
                  }`}
                  aria-hidden
                >
                  {m}
                </span>
                <span className={`truncate text-[10px] font-semibold leading-none ${active ? 'text-accent' : done ? 'text-hud-ink-2' : 'text-hud-ink-2/60'}`}>
                  {m}월
                </span>
                <span className={`flex w-full items-center justify-center gap-0.5 truncate text-[9px] leading-none ${active ? 'text-accent' : 'text-hud-ink-2/55'}`}>
                  {k === 'settlement' ? <Flag size={9} aria-hidden /> : k === 'event' ? <span className="size-1 rounded-full bg-current" aria-hidden /> : k === 'tutorial' ? <Sparkles size={9} aria-hidden /> : null}
                  <span className="truncate">{label}</span>
                </span>
                <span className="sr-only">
                  {m}월 · {label}
                  {done ? ' · 지남' : active ? ' · 지금' : ''}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
