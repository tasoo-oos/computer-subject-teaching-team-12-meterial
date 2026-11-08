import { SCREEN_LABEL, SCREEN_ORDER, type ScreenId } from '@gagyebu/core';

const SHORT: Record<ScreenId, string> = {
  start: '시작',
  survey: '설문',
  guide: '안내',
  budget: '가계부',
  sim: '1년 살기',
  result: '결산',
};

/** 수업 단계 표시줄 (시작 → 결산). 실제 순서가 있어 번호를 붙인다 */
export function FlowHeader({ current, nickname }: { current: ScreenId; nickname?: string }) {
  const idx = SCREEN_ORDER.indexOf(current);
  return (
    <header className="border-b border-rule bg-sheet/80">
      <div className="mx-auto flex max-w-[1200px] items-center gap-3 px-4 py-2.5 sm:px-6">
        <p className="display text-[15px] text-ink sm:text-[17px]">내 첫 월급, 1년 살아 보기</p>
        <p className="num ml-auto text-[12px] font-semibold text-ink-2 sm:hidden">
          {idx + 1}단계 {SHORT[current]}
        </p>
        <ol className="ml-auto hidden items-center gap-1 sm:flex" aria-label="수업 단계">
          {SCREEN_ORDER.map((s, i) => {
            const state = i < idx ? 'done' : i === idx ? 'now' : 'todo';
            return (
              <li
                key={s}
                aria-current={state === 'now' ? 'step' : undefined}
                title={SCREEN_LABEL[s]}
                className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] ${
                  state === 'now' ? 'bg-ink font-semibold text-white' : state === 'done' ? 'text-ink' : 'text-ink-3'
                }`}
              >
                <span className="num text-[12px]">{i + 1}</span>
                <span className={state === 'now' ? '' : 'hidden md:inline'}>{SHORT[s]}</span>
              </li>
            );
          })}
        </ol>
        {nickname ? <p className="hidden text-[13px] text-ink-2 lg:block">{nickname}님</p> : null}
      </div>
      <div className="mx-auto flex max-w-[1200px] gap-1 px-4 pb-2 sm:hidden" aria-hidden>
        {SCREEN_ORDER.map((s, i) => (
          <span key={s} className={`h-1 flex-1 rounded-full ${i <= idx ? 'bg-ink' : 'bg-rule'}`} />
        ))}
      </div>
    </header>
  );
}
