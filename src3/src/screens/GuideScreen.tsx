import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { ACCOUNTS, ACCOUNT_ORDER, GUIDE_CARDS } from '@gagyebu/core';
import type { ScreenProps } from '@gagyebu/draft-kit';
import { AppFrame } from '../components/AppFrame.tsx';
import { Button } from '../components/ui.tsx';
import { ACCOUNT_LOOK } from '../lib/meta.ts';

export function GuideScreen({ state, ui, go, goScreen }: ScreenProps) {
  const index = Math.min(GUIDE_CARDS.length - 1, Math.max(0, ui.guideIndex ?? 0));
  const card = GUIDE_CARDS[index]!;
  const last = index === GUIDE_CARDS.length - 1;

  return (
    <AppFrame screen="guide" nickname={state.profile.nickname}>
      <div className="flex flex-1 flex-col gap-2.5">
        <div className="cut flex flex-1 flex-col p-5 sm:p-8">
          <div className="flex items-center justify-between">
            <p className="num text-sm font-bold">
              <span className="text-[20px]">{index + 1}</span>
              <span className="text-mute"> / {GUIDE_CARDS.length}</span>
            </p>
            <p className="text-sm text-mute">재무 기초 안내</p>
          </div>

          <div className="mt-6 grid flex-1 gap-8 lg:grid-cols-[1.05fr_1fr]">
            <div>
              <h1 className="text-[30px] leading-[1.2] font-extrabold tracking-[-0.03em] text-balance sm:text-[40px]">{card.title}</h1>
              <p className="mt-3 max-w-[26em] text-[17px] leading-relaxed text-mute">{card.lead}</p>
              <ul className="mt-6 grid gap-2.5">
                {card.points.map((p) => (
                  <li key={p} className="flex gap-2.5 text-[15px] leading-relaxed">
                    <Check size={18} className="mt-0.5 shrink-0 text-mute" aria-hidden />
                    <span className="text-pretty">{p}</span>
                  </li>
                ))}
              </ul>
              {card.tip && (
                <p className="mt-5 rounded-[5px] bg-flash-soft px-4 py-3 text-sm leading-relaxed font-medium">{card.tip}</p>
              )}
            </div>

            <div className="cut-2 flex flex-col p-4">
              {card.id === 'split-accounts' ? <AccountBoard /> : <CardSketch index={index} />}
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between gap-3 border-t border-line pt-4">
            <Button variant="quiet" onClick={() => (index === 0 ? go('survey-result') : go(`guide-${index}`))}>
              <ArrowLeft size={17} /> 이전
            </Button>
            <div className="hidden gap-1.5 sm:flex" aria-hidden>
              {GUIDE_CARDS.map((c, i) => (
                <span key={c.id} className={`h-1.5 rounded-full transition-all ${i === index ? 'w-6 bg-ink' : 'w-1.5 bg-line-strong'}`} />
              ))}
            </div>
            <Button variant="plate" size="lg" onClick={() => (last ? goScreen('budget') : go(`guide-${index + 2}`))}>
              {last ? '가계부 짜러 가기' : '다음 카드'} <ArrowRight size={17} />
            </Button>
          </div>
        </div>
      </div>
    </AppFrame>
  );
}

/** 카드 3: 통장 6종을 한눈에. 이후 가계부·시뮬레이션에서도 같은 색·표지를 쓴다 */
function AccountBoard() {
  return (
    <div className="flex flex-1 flex-col">
      <p className="text-xs font-semibold text-mute">통장 6개, 이름표 6개</p>
      <ul className="mt-3 grid flex-1 gap-1.5">
        {ACCOUNT_ORDER.map((id) => {
          const look = ACCOUNT_LOOK[id];
          const meta = ACCOUNTS[id];
          const Icon = look.icon;
          return (
            <li key={id} className="flex items-center gap-3 rounded-[4px] bg-paper px-3 py-2.5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-[4px] text-white" style={{ background: look.color }} aria-hidden>
                <Icon size={20} strokeWidth={2.2} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold">
                  {look.short}
                  <span className="ml-2 text-xs font-normal text-mute">{meta.guide}</span>
                </p>
                <p className="truncate text-xs text-mute">{meta.purpose}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** 나머지 카드의 도해: 50/30/20 비율, 고정비/변동비, 비상금 3~6개월, 저축/투자, 제도 */
function CardSketch({ index }: { index: number }) {
  if (index === 0) {
    const rows = [
      { label: '필수 지출', pct: 50, color: 'var(--color-acc-living)', note: '월세, 식비, 교통' },
      { label: '선택 지출', pct: 30, color: 'var(--color-acc-goal)', note: '여가, 취미, 모임' },
      { label: '저축·투자', pct: 20, color: 'var(--color-acc-savings)', note: '비상금, 적금, 투자' },
    ];
    return (
      <div className="flex flex-1 flex-col justify-center">
        <p className="text-xs font-semibold text-mute">50 / 30 / 20, 출발점으로만</p>
        <div className="mt-4 flex h-6 overflow-hidden rounded-[3px]" aria-hidden>
          {rows.map((r) => (
            <span key={r.label} style={{ width: `${r.pct}%`, background: r.color }} />
          ))}
        </div>
        <ul className="mt-4 grid gap-2">
          {rows.map((r) => (
            <li key={r.label} className="flex items-center gap-2 text-sm">
              <span className="size-2.5 rounded-[2px]" style={{ background: r.color }} aria-hidden />
              <span className="font-semibold">{r.label}</span>
              <span className="num text-mute">{r.pct}%</span>
              <span className="ml-auto text-xs text-mute">{r.note}</span>
            </li>
          ))}
        </ul>
        <p className="mt-5 text-xs leading-relaxed text-mute">비율은 기준일 뿐입니다. 내 상황에 맞게 바꿔도 됩니다.</p>
      </div>
    );
  }
  if (index === 1) {
    return (
      <div className="flex flex-1 flex-col justify-center gap-2">
        {[
          ['고정비', ['월세·관리비', '통신비', '보험료', '교통비', '구독료'], '한 번 줄이면 매달 효과'],
          ['변동비', ['식비', '생활용품', '의류·미용', '여가·문화', '경조사비'], '내가 조절할 수 있는 돈'],
        ].map(([title, items, note]) => (
          <div key={title as string} className="rounded-[4px] bg-paper p-3.5">
            <p className="text-sm font-bold">{title as string}</p>
            <p className="num mt-1 text-xs text-mute">{(items as string[]).join(' · ')}</p>
            <p className="mt-1 text-xs text-mute">{note as string}</p>
          </div>
        ))}
      </div>
    );
  }
  if (index === 3) {
    return (
      <div className="flex flex-1 flex-col justify-center">
        <p className="text-xs font-semibold text-mute">생활비 3~6개월분</p>
        <div className="mt-4 grid grid-cols-6 gap-1" aria-hidden>
          {Array.from({ length: 6 }).map((_, i) => (
            <span key={i} className={`h-12 rounded-[3px] ${i < 3 ? 'bg-[var(--color-acc-emergency)]' : 'border border-dashed border-line-strong'}`} />
          ))}
        </div>
        <p className="mt-3 text-xs text-mute">채워진 3칸이 최소 목표, 6칸이 넉넉한 목표입니다.</p>
        <p className="mt-5 text-[15px] leading-relaxed font-semibold">사고나 병원비는 비상이고, 세일은 비상이 아닙니다.</p>
      </div>
    );
  }
  if (index === 4) {
    return (
      <div className="flex flex-1 flex-col justify-center gap-2">
        {[
          ['저축', '원금이 보장됩니다. 예금자보호 1억 원.', 'var(--color-acc-savings)'],
          ['투자', '더 벌 수도, 원금을 잃을 수도 있습니다.', 'var(--color-acc-invest)'],
        ].map(([title, note, color]) => (
          <div key={title} className="flex gap-3 rounded-[4px] bg-paper p-3.5">
            <span className="mt-1 h-10 w-1 rounded-full" style={{ background: color }} aria-hidden />
            <div>
              <p className="text-sm font-bold">{title}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-mute">{note}</p>
            </div>
          </div>
        ))}
        <p className="mt-2 text-xs font-semibold">순서: 비상금 → 저축 습관 → 소액 투자</p>
      </div>
    );
  }
  return (
    <div className="flex flex-1 flex-col justify-center gap-2">
      {[
        ['청년미래적금', '만 19~34세, 월 최대 50만 원, 3년'],
        ['체크카드 소득공제 30%', '신용카드는 15%'],
        ['할부는 총액으로', '리볼빙은 연 18% 고금리 빚'],
        ['문자 링크·송금 요구', '누르지 말고 전화로 확인'],
      ].map(([t, s]) => (
        <div key={t} className="rounded-[4px] bg-paper px-3.5 py-2.5">
          <p className="text-sm font-bold">{t}</p>
          <p className="text-xs text-mute">{s}</p>
        </div>
      ))}
    </div>
  );
}
