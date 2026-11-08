import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ACCOUNT_ORDER, ACCOUNTS, GUIDE_CARDS, formatPct } from '@gagyebu/core';
import type { ScreenProps } from '@gagyebu/draft-kit';
import { FlowHeader } from '../components/FlowHeader.tsx';
import { PassbookCover } from '../components/PassbookCover.tsx';
import { DEV_PREV } from '../dev/route.ts';

export function GuideScreen({ state, dispatch, ui }: ScreenProps) {
  const [index, setIndex] = useState(ui?.guideIndex ?? 0);
  const card = GUIDE_CARDS[index]!;
  const last = index === GUIDE_CARDS.length - 1;
  const isSplit = card.id === 'split-accounts';
  return (
    <div className="paper-texture min-h-dvh">
      <FlowHeader current="guide" nickname={state.profile.nickname} />
      <main className="mx-auto flex min-h-[calc(100dvh-96px)] max-w-[1100px] flex-col justify-center px-5 py-6 sm:px-8 sm:py-8">
        <nav aria-label="안내 카드" className="flex flex-wrap items-center gap-2">
          {GUIDE_CARDS.map((c, i) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setIndex(i)}
              aria-current={i === index ? 'step' : undefined}
              className={`flex min-h-11 items-center gap-2 rounded-full px-3 text-[14px] ${
                i === index ? 'bg-ink font-semibold text-white' : i < index ? 'text-ink' : 'text-ink-3'
              }`}
            >
              <span className="num">{i + 1}</span>
              <span className={i === index ? '' : 'hidden lg:inline'}>{c.title}</span>
            </button>
          ))}
        </nav>

        <article
          key={card.id}
          className="sheet-in mt-4 rounded-panel bg-sheet p-5 shadow-[0_0_0_1px_var(--color-rule),0_20px_40px_-30px_rgba(24,38,74,.5)] sm:p-8 lg:p-10"
          aria-labelledby="guide-title"
        >
          <div className={isSplit ? '' : 'grid gap-8 md:grid-cols-[1fr_1.1fr]'}>
            <header>
              <p className="num text-[15px] font-semibold text-ink-2">
                {index + 1} / {GUIDE_CARDS.length}
              </p>
              <h1 id="guide-title" className="display mt-1 text-[42px] sm:text-[56px] lg:text-[64px]">
                {card.title}
              </h1>
              <p className="mt-3 max-w-[34em] text-[19px] leading-relaxed font-medium lg:text-[21px]">{card.lead}</p>
            </header>
            {isSplit ? (
              <AccountShelf />
            ) : (
              <ul className="space-y-3 self-center">
                {card.points.map((p) => (
                  <li key={p} className="flex gap-3 border-b border-rule-soft pb-3 text-[17px]">
                    <span aria-hidden className="mt-2.5 size-1.5 flex-none rounded-full bg-ink" />
                    {p}
                  </li>
                ))}
              </ul>
            )}
          </div>
          {isSplit ? (
            <ul className="mt-5 grid gap-x-8 gap-y-1 text-[15px] text-ink-2 md:grid-cols-2">
              {card.points.map((p) => (
                <li key={p} className="flex gap-2.5">
                  <span aria-hidden className="mt-2.5 size-1.5 flex-none rounded-full bg-ink-3" />
                  {p}
                </li>
              ))}
            </ul>
          ) : null}
          {card.tip ? (
            <p className="mt-5 rounded-[8px] bg-mark/70 px-4 py-3 text-[15px]">
              <span className="font-bold">기억할 것 </span>
              {card.tip}
            </p>
          ) : null}
        </article>

        <div className="mt-6 flex items-center justify-between gap-3">
          <button type="button" onClick={() => (index === 0 ? dispatch(DEV_PREV) : setIndex(index - 1))} className="btn btn-quiet">
            <ChevronLeft size={18} aria-hidden />
            이전
          </button>
          <button
            type="button"
            onClick={() => (last ? dispatch({ type: 'goto', phase: 'budget' }) : setIndex(index + 1))}
            className="btn btn-primary px-6"
          >
            {last ? '가계부 짜러 가기' : '다음 카드'}
            {last ? null : <ChevronRight size={18} aria-hidden />}
          </button>
        </div>
      </main>
    </div>
  );
}

/** 계좌 6종을 통장 표지로 한눈에. 이후 화면에서도 같은 색을 쓴다 */
function AccountShelf() {
  return (
    <div className="mt-6">
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {ACCOUNT_ORDER.map((id) => {
          const a = ACCOUNTS[id];
          return (
            <li key={id} className="flex flex-col">
              <PassbookCover id={id}>
                <p className="text-[12px] opacity-90">권장</p>
                <p className="num text-[15px] font-bold leading-tight">{a.guide}</p>
              </PassbookCover>
              <div className="mt-2 px-0.5 text-[13px] leading-snug">
                <p className="font-semibold text-ink">{a.purpose}</p>
                <p className="mt-0.5 text-ink-3">
                  {a.annualRate === null ? (id === 'invest' ? '수익률이 매달 바뀜' : '이자 없음') : `연 ${formatPct(a.annualRate)} (가정)`}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
