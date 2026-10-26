import { useEffect, useRef, useState } from 'react';
import type { ScreenProps } from '@gagyebu/draft-kit';
import { ArrowLeft, ArrowRight, Info, Lightbulb } from 'lucide-react';
import { ACCOUNT_ORDER, ACCOUNTS, GUIDE_CARDS, PROMPTS, formatPct } from '@gagyebu/core';
import { Button } from '../components/ui.tsx';
import { AccountIcon } from '../components/AccountBadge.tsx';
import { PromptCopy } from '../components/PromptCopy.tsx';
import { LessonBar, LessonFooter } from '../components/LessonBar.tsx';

export function GuideScreen({ ui, goScreen }: ScreenProps) {
  const [index, setIndex] = useState(ui.guideIndex ?? 0);
  const card = GUIDE_CARDS[index]!;
  const last = index === GUIDE_CARDS.length - 1;
  const activeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const el = activeRef.current;
    const box = el?.parentElement?.parentElement;
    if (!el || !box || box.scrollWidth <= box.clientWidth) return;
    box.scrollTo({ left: Math.max(0, el.offsetLeft - box.clientWidth / 2 + el.clientWidth / 2), behavior: 'auto' });
  }, [index]);

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <LessonBar current="guide" />
      <main className="mx-auto w-full max-w-[1180px] flex-1 px-4 py-6 sm:px-6">
        <div className="grid gap-5 lg:grid-cols-[248px_minmax(0,1fr)]">
          <nav aria-label="안내 카드 목록" className="min-w-0 lg:sticky lg:top-4 lg:self-start">
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="text-sm font-bold text-ink-2">재무 기초 6장</h2>
              <span className="num text-xs text-ink-3">
                {index + 1} / {GUIDE_CARDS.length}
              </span>
            </div>
            <ol className="flex gap-1.5 overflow-x-auto pb-1 lg:flex-col lg:gap-1 lg:overflow-visible">
              {GUIDE_CARDS.map((g, i) => (
                <li key={g.id} className="shrink-0 lg:shrink">
                  <button
                    ref={i === index ? activeRef : undefined}
                    type="button"
                    onClick={() => setIndex(i)}
                    aria-current={i === index ? 'true' : undefined}
                    className={`flex min-h-11 w-full items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left text-sm transition-colors ${
                      i === index
                        ? 'border-primary bg-primary-soft font-bold text-primary'
                        : i < index
                          ? 'border-transparent bg-surface/60 text-ink-2 hover:bg-surface'
                          : 'border-transparent text-ink-3 hover:bg-surface/80'
                    }`}
                  >
                    <span className={`num flex size-6 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${i === index ? 'bg-primary text-white' : 'bg-surface-2 text-ink-2'}`} aria-hidden>
                      {i + 1}
                    </span>
                    <span className="whitespace-nowrap lg:whitespace-normal">{g.title}</span>
                  </button>
                </li>
              ))}
            </ol>
            <p className="mt-3 hidden items-start gap-1.5 rounded-xl bg-surface-2 p-2.5 text-xs leading-relaxed text-ink-3 lg:flex">
              <Info size={14} className="mt-0.5 shrink-0" aria-hidden />
              카드는 넘겨 보기만 해도 됩니다. 3장의 계좌 6종은 이후 가계부와 시뮬레이션에서도 같은 색과 아이콘으로 나옵니다.
            </p>
          </nav>

          <section className="min-w-0 animate-enter" key={card.id}>
            <article className="card overflow-hidden">
              <div className="flex items-start gap-3 border-b border-line bg-surface-2/70 px-5 py-4">
                <span className="num flex size-10 shrink-0 items-center justify-center rounded-2xl bg-hud text-lg font-bold text-accent">{index + 1}</span>
                <div>
                  <p className="text-xs font-semibold tracking-wide text-ink-3">재무 기초 {index + 1}</p>
                  <h1 className="mt-0.5 text-[clamp(1.35rem,2.6vw,1.75rem)] font-bold leading-tight tracking-tight text-ink">{card.title}</h1>
                </div>
              </div>
              <div className="px-5 py-4">
                <p className="max-w-[62ch] text-[17px] font-medium leading-relaxed text-ink">{card.lead}</p>
                <ul className="mt-4 grid gap-2">
                  {card.points.map((p) => (
                    <li key={p} className="flex items-start gap-2.5 text-[15px] leading-relaxed text-ink-2">
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
                {card.tip && (
                  <p className="mt-4 flex items-start gap-2 rounded-xl border border-accent/40 bg-accent-soft px-3 py-2.5 text-sm leading-relaxed text-accent-ink">
                    <Lightbulb size={17} className="mt-0.5 shrink-0" aria-hidden />
                    <span>{card.tip}</span>
                  </p>
                )}

                {card.id === 'pay-first' && <RatioVisual />}
                {card.id === 'split-accounts' && <AccountMap />}
                {card.id === 'save-vs-invest' && (
                  <div className="mt-4">
                    <PromptCopy text={PROMPTS.accounts.template} stage="계좌 분리" compact />
                  </div>
                )}
              </div>
            </article>

            <div className="mt-4 flex items-center justify-between gap-3">
              <div className="hidden items-center gap-1.5 sm:flex" aria-hidden>
                {GUIDE_CARDS.map((_, i) => (
                  <span key={i} className={`h-1.5 rounded-full transition-all ${i === index ? 'w-6 bg-primary' : 'w-1.5 bg-line-strong'}`} />
                ))}
              </div>
              <div className="flex w-full gap-2 sm:w-auto">
                <Button
                  variant="secondary"
                  className="flex-1 sm:flex-none"
                  onClick={() => (index === 0 ? goScreen('survey') : setIndex((i) => i - 1))}
                >
                  <ArrowLeft size={17} aria-hidden /> 이전
                </Button>
                {last ? (
                  <Button className="flex-1 sm:flex-none" onClick={() => goScreen('budget')} size="lg">
                    가계부 만들기 <ArrowRight size={18} aria-hidden />
                  </Button>
                ) : (
                  <Button className="flex-1 sm:flex-none" onClick={() => setIndex((i) => i + 1)} size="lg">
                    다음 카드 <ArrowRight size={18} aria-hidden />
                  </Button>
                )}
              </div>
            </div>
          </section>
        </div>
      </main>
      <LessonFooter />
    </div>
  );
}

/** 안내 카드 1: 50/30/20 규칙 시각화 */
function RatioVisual() {
  const rows = [
    { label: '필수 지출', pct: 50, desc: '월세, 통신비, 식비', cls: 'bg-acc-living', soft: 'bg-acc-living-soft text-acc-living' },
    { label: '선택 지출', pct: 30, desc: '여가, 취미, 모임', cls: 'bg-acc-goal', soft: 'bg-acc-goal-soft text-acc-goal' },
    { label: '저축', pct: 20, desc: '비상금, 적금, 투자', cls: 'bg-acc-savings', soft: 'bg-acc-savings-soft text-acc-savings' },
  ];
  return (
    <div className="mt-4">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-sm font-bold text-ink-2">출발점: 50 / 30 / 20</h2>
        <span className="text-xs text-ink-3">월급을 100이라 할 때</span>
      </div>
      <div className="flex h-4 overflow-hidden rounded-full bg-line" aria-hidden>
        {rows.map((r) => (
          <span key={r.label} className={`${r.cls} h-full border-r-2 border-surface last:border-r-0`} style={{ width: `${r.pct}%` }} />
        ))}
      </div>
      <ul className="mt-2 grid gap-1.5 sm:grid-cols-3">
        {rows.map((r) => (
          <li key={r.label} className={`rounded-xl px-2.5 py-2 ${r.soft}`}>
            <div className="num text-lg font-bold leading-none">{r.pct}%</div>
            <div className="mt-1 text-[12px] font-bold">{r.label}</div>
            <div className="text-[11px] opacity-80">{r.desc}</div>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[11px] text-ink-3">비율은 기준일 뿐입니다. 월급과 생활비가 다르면 내 상황에 맞게 바꿉니다.</p>
    </div>
  );
}

/** 안내 카드 3: 계좌 6종 한눈에 보기. 이후 화면과 같은 색·아이콘을 쓴다 */
function AccountMap() {
  return (
    <div className="mt-5">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-bold text-ink-2">계좌 6종 지도</h2>
        <span className="text-xs text-ink-3">생활비 → 비상금 → 묶어 둘 돈 → 즐거움</span>
      </div>
      <ol className="grid gap-2 sm:grid-cols-2">
        {ACCOUNT_ORDER.map((id) => {
          const a = ACCOUNTS[id];
          return (
            <li key={id} className="rounded-2xl border border-line bg-surface p-3">
              <div className="flex items-start gap-2">
                <AccountIcon id={id} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                    <span className="text-sm font-bold text-ink">{a.label}</span>
                    <span className="num shrink-0 text-[11px] font-bold text-ink-3">{a.guide}</span>
                  </div>
                  <div className="text-[11px] leading-snug text-ink-3">{a.product}</div>
                </div>
              </div>
              <p className="mt-2 text-[13px] font-medium leading-snug text-ink-2">{a.purpose}</p>
              <p className="mt-1 text-[11px] leading-snug text-ink-3">
                {a.annualRate !== null ? `연 ${formatPct(a.annualRate)} (가정) · ` : '수익률 변동 · 가정값 · '}
                {a.withdrawRule}
              </p>
            </li>
          );
        })}
      </ol>
      <p className="mt-2 text-xs text-ink-3">생활비 통장에는 지출 예산과 여유분이 들어가고, 나머지 다섯 통장은 월급날 자동이체로 채워집니다.</p>
    </div>
  );
}
