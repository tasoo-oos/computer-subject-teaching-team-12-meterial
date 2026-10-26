import { useState } from 'react';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import {
  SPENDING_TYPES,
  SURVEY,
  budgetSummary,
  formatMan,
  formatPct,
  type SurveyOption,
} from '@gagyebu/core';
import type { ScreenProps } from '@gagyebu/draft-kit';
import { AppFrame } from '../components/AppFrame.tsx';
import { Button, Money } from '../components/ui.tsx';
import { ShareBar } from '../components/ShareBar.tsx';

export function SurveyScreen({ state, ui, go, goScreen }: ScreenProps) {
  const index = ui.surveyIndex ?? 0;
  const result = state.survey.result;

  return (
    <AppFrame screen="survey" nickname={state.profile.nickname}>
      <div className="cut flex flex-1 flex-col p-5 sm:p-8">
        {index >= SURVEY.length && result ? (
          <Result result={result} salary={state.profile.salary} onNext={() => goScreen('guide')} />
        ) : (
          <Question index={index} answers={state.survey.answers} onAnswer={(opt) => go(index === SURVEY.length - 1 ? 'survey-result' : `survey-q${index + 2}`)} onBack={() => go(index === 0 ? 'start-reveal' : `survey-q${index}`)} />
        )}
      </div>
    </AppFrame>
  );
}

function Question({
  index,
  answers,
  onAnswer,
  onBack,
}: {
  index: number;
  answers: Record<string, string | undefined>;
  onAnswer: (option: SurveyOption) => void;
  onBack: () => void;
}) {
  const q = SURVEY[index]!;
  const [picked, setPicked] = useState<string | null>(answers[q.id] ?? null);
  const total = SURVEY.length;

  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-1 flex-col">
      <div className="flex items-center justify-between">
        <p className="num text-sm font-bold">
          <span className="text-[20px]">{index + 1}</span>
          <span className="text-mute"> / {total}</span>
        </p>
        <p className="text-sm text-mute">내 소비습관 알아보기</p>
      </div>

      <ol className="mt-3 flex gap-1" aria-label={`설문 ${total}문항 중 ${index + 1}번째`}>
        {SURVEY.map((s, i) => (
          <li
            key={s.id}
            className={`h-1.5 flex-1 rounded-full ${i < index ? 'bg-ink' : i === index ? 'bg-flash' : 'bg-paper-3'}`}
            aria-hidden
          />
        ))}
      </ol>

      <div className="mt-6 flex flex-1 flex-col justify-center pb-6">
        <p className="text-sm font-semibold text-mute">{q.linkedTo}에 반영됩니다</p>
        <h1 className="mt-2 text-[28px] leading-[1.3] font-extrabold tracking-[-0.025em] text-balance sm:text-[34px]">{q.text}</h1>

        <div className="mt-7 grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label={q.text}>
          {q.options.map((o) => {
            const active = picked === o.id;
            return (
              <button
                key={o.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setPicked(o.id)}
                className={`flex min-h-14 items-center gap-3 rounded-[5px] border px-4 text-left text-[16px] font-semibold transition-colors ${
                  active ? 'border-ink bg-ink text-frame' : 'border-line-strong bg-paper hover:border-ink-4 hover:bg-paper-2'
                }`}
              >
                <span
                  aria-hidden
                  className={`flex size-5 shrink-0 items-center justify-center rounded-full border ${active ? 'border-frame bg-flash text-ink' : 'border-line-strong'}`}
                >
                  {active && <Check size={13} strokeWidth={3} />}
                </span>
                {o.label}
              </button>
            );
          })}
        </div>

      </div>

      <div className="flex items-center justify-between gap-3 border-t border-line pt-4">
        <Button variant="quiet" onClick={onBack}>
          <ArrowLeft size={17} /> 이전
        </Button>
        <Button variant="plate" size="lg" disabled={!picked} onClick={() => picked && onAnswer(q.options.find((o) => o.id === picked)!)}>
          {index === SURVEY.length - 1 ? '결과 보기' : '다음 질문'} <ArrowRight size={17} />
        </Button>
      </div>
    </div>
  );
}

function Result({
  result,
  salary,
  onNext,
}: {
  result: NonNullable<ScreenProps['state']['survey']['result']>;
  salary: number;
  onNext: () => void;
}) {
  const type = SPENDING_TYPES[result.type];
  const sum = budgetSummary(result.recommended, salary);
  const r = result.recommended;

  return (
    <div className="flex flex-1 flex-col gap-7">
      <div>
        <p className="text-sm font-semibold text-mute">7문항을 다 답했습니다</p>
        <div className="mt-3 flex flex-wrap items-end gap-x-4 gap-y-1">
          <h1 className="text-[38px] leading-none font-extrabold tracking-[-0.03em] sm:text-[52px]">{type.label}</h1>
          <p className="pb-1 text-[17px] font-semibold text-mute">{type.oneLiner}</p>
        </div>
        <p className="mt-4 max-w-[46em] text-[16px] leading-relaxed">{type.advice}</p>
      </div>

      <div className="grid gap-2.5 lg:grid-cols-[1fr_1fr]">
        <section className="cut-2 p-5">
          <div className="flex items-baseline justify-between">
            <h2 className="text-[16px] font-bold">추천 가계부</h2>
            <span className="num text-sm text-mute">저축률 {formatPct(sum.savingsRate)}</span>
          </div>
          <div className="mt-4">
            <ShareBar shares={sum.shares} height={18} labels={false} />
          </div>
          <dl className="mt-4 grid grid-cols-[1fr_auto] gap-y-1.5 text-sm">
            <dt className="text-mute">자동이체 합계</dt>
            <dd><Money value={sum.transferTotal} mode="man" className="font-semibold" /></dd>
            <dt className="text-mute">생활비 통장 (지출+여유)</dt>
            <dd><Money value={sum.livingIn} mode="man" className="font-semibold" /></dd>
            <dt className="text-mute">비상금</dt>
            <dd><Money value={r.transfers.emergency} mode="man" className="font-semibold" /></dd>
            <dt className="text-mute">적금 · 투자 · 목표 · 청약</dt>
            <dd>
              <Money value={r.transfers.savings + r.transfers.invest + r.transfers.goal + r.transfers.housing} mode="man" className="font-semibold" />
            </dd>
          </dl>
          <p className="mt-3 text-xs leading-relaxed text-mute">다음 화면에서 이 값을 시작점으로 직접 고칠 수 있습니다.</p>
        </section>

        <section className="cut-2 p-5">
          <h2 className="text-[16px] font-bold">통장 6개로 나눈 첫 달</h2>
          <ul className="mt-3 grid gap-1.5">
            {(['living', 'emergency', 'savings', 'invest', 'goal', 'housing'] as const).map((id) => (
              <li key={id}>
                <AccountLine id={id} amount={id === 'living' ? sum.livingIn : r.transfers[id]} total={sum.livingIn + sum.transferTotal} />
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="mt-auto flex justify-end">
        <Button variant="plate" size="lg" onClick={onNext}>
          돈을 나누는 이유부터 보기 <ArrowRight size={18} />
        </Button>
      </div>
    </div>
  );
}

function AccountLine({ id, amount, total }: { id: 'living' | 'emergency' | 'savings' | 'invest' | 'goal' | 'housing'; amount: number; total: number }) {
  const label = { living: '생활비', emergency: '비상금', savings: '적금', invest: '투자', goal: '목표', housing: '청약' }[id];
  const color = {
    living: 'var(--color-acc-living)',
    emergency: 'var(--color-acc-emergency)',
    savings: 'var(--color-acc-savings)',
    invest: 'var(--color-acc-invest)',
    goal: 'var(--color-acc-goal)',
    housing: 'var(--color-acc-housing)',
  }[id];
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="size-2.5 shrink-0 rounded-[2px]" style={{ background: color }} aria-hidden />
      <span className="w-12 shrink-0 text-mute">{label}</span>
      <span className="h-2 flex-1 overflow-hidden rounded-[2px] bg-paper-3">
        <span className="block h-full" style={{ width: `${Math.min(100, (amount / total) * 100)}%`, background: color }} />
      </span>
      <Money value={amount} mode="man" className="w-20 text-right font-semibold" />
    </div>
  );
}
