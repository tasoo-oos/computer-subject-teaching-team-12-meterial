import type { ReactNode } from 'react';
import { SCREEN_LABEL, SCREEN_ORDER, type ScreenId } from '@gagyebu/core';

const SHORT: Record<ScreenId, string> = {
  start: '시작',
  survey: '설문',
  guide: '안내',
  budget: '가계부',
  sim: '1년',
  result: '결산',
};

/** 인화 띠 프레임: 잉크색 바탕에 밝은 컷이 놓인다 */
export function AppFrame({
  screen,
  nickname,
  children,
  wide = false,
}: {
  screen: ScreenId;
  nickname?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  const at = SCREEN_ORDER.indexOf(screen);
  return (
    <div className="flex min-h-dvh flex-col bg-ink text-frame">
      <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1.5 px-4 pt-2 pb-2 sm:px-6">
        <p className="text-[15px] font-bold tracking-[-0.01em]">내 첫 월급, 1년 살아 보기</p>
        <nav aria-label="진행 단계">
          <ol className="flex gap-1">
            {SCREEN_ORDER.map((id, i) => {
              const state = i < at ? 'done' : i === at ? 'now' : 'next';
              return (
                <li
                  key={id}
                  aria-current={state === 'now' ? 'step' : undefined}
                  title={SCREEN_LABEL[id]}
                  className={`flex h-11 min-w-11 items-center justify-center rounded-[3px] px-2 text-xs font-semibold sm:h-7 ${
                    state === 'now'
                      ? 'bg-flash text-ink'
                      : state === 'done'
                        ? 'bg-ink-3 text-frame'
                        : 'border border-ink-4 text-frame-mute'
                  }`}
                >
                  {SHORT[id]}
                </li>
              );
            })}
          </ol>
        </nav>
      </header>
      <main className={`on-paper mx-auto flex w-full flex-1 flex-col px-2.5 sm:px-4 ${wide ? 'max-w-[1340px]' : 'max-w-[1080px]'}`}>
        {children}
      </main>
      <footer className="flex justify-between px-4 pt-2 pb-3 text-xs text-frame-mute sm:px-6">
        <span>{nickname ? `${nickname}의 첫 해` : '첫 해'}</span>
        <span>{SCREEN_LABEL[screen]}</span>
      </footer>
    </div>
  );
}
