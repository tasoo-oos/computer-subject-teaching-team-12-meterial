import { SCREEN_LABEL, SCREEN_ORDER, type ScreenId } from '@gagyebu/core';

const ORDER: ScreenId[] = ['start', 'survey', 'guide', 'budget', 'sim', 'result'];
const NUM: Record<ScreenId, string> = { start: '1', survey: '2', guide: '3', budget: '4', sim: '5', result: '6' };

/** 수업 진행 표시. 현재 화면이 어디인지 항상 알 수 있게 한다 */
export function LessonBar({ current, right }: { current: ScreenId; right?: React.ReactNode }) {
  return (
    <header className="border-b border-line bg-surface/85 backdrop-blur">
      <div className="mx-auto flex max-w-[1280px] items-center gap-4 px-4 py-2.5 sm:px-6">
        <span className="flex shrink-0 items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-xl bg-hud text-sm font-bold text-accent" aria-hidden>
            ₩
          </span>
          <span className="text-[15px] font-bold tracking-tight text-ink">
            내 첫 월급 <span className="font-medium text-ink-3">1년 살아 보기</span>
          </span>
        </span>
        <ol className="ml-auto hidden items-center gap-1 xl:flex" aria-label="수업 단계">
          {ORDER.map((id, i) => {
            const active = id === current;
            const done = ORDER.indexOf(current) > i;
            return (
              <li key={id} className="flex items-center gap-1">
                <span
                  aria-current={active ? 'step' : undefined}
                  className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${
                    active ? 'bg-primary text-white' : done ? 'text-primary' : 'text-ink-3'
                  }`}
                >
                  <span className={`num flex size-4 items-center justify-center rounded-full text-[10px] ${active ? 'bg-white/25' : done ? 'bg-primary-soft' : 'bg-surface-2'}`} aria-hidden>
                    {NUM[id]}
                  </span>
                  {SCREEN_LABEL[id]}
                  <span className="sr-only">{active ? ' (지금 단계)' : ''}</span>
                </span>
                {i < ORDER.length - 1 && <span className="h-px w-3 bg-line" aria-hidden />}
              </li>
            );
          })}
        </ol>
        <span className="ml-auto hidden items-center gap-1.5 text-xs font-semibold text-ink-2 sm:flex xl:hidden">
          <span className="num rounded-md bg-surface-2 px-1.5 py-0.5 font-bold text-ink">{ORDER.indexOf(current) + 1}/6</span>
          <span className="max-w-[9rem] truncate">{SCREEN_LABEL[current]}</span>
        </span>
        {right && <span className="ml-auto shrink-0 xl:ml-3">{right}</span>}
      </div>
    </header>
  );
}

/** 화면 하단 공통 각주 */
export function LessonFooter({ children }: { children?: React.ReactNode }) {
  return (
    <footer className="mx-auto w-full max-w-[1280px] px-4 pt-6 pb-10 text-xs leading-relaxed text-ink-3 sm:px-6">
      {children}
      <p className="mt-1">금리·수익률은 수업을 위한 학습용 가정값이며 실제 금융상품 조건과 다릅니다. 화면의 인물과 금액은 예시입니다.</p>
    </footer>
  );
}
