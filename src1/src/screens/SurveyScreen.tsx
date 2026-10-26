import { useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import {
  ACCOUNTS,
  SPENDING_TYPES,
  SURVEY,
  TRANSFER_ORDER,
  budgetSummary,
  formatMan,
  formatPct,
} from '@gagyebu/core';
import type { ScreenProps } from '@gagyebu/draft-kit';
import { FlowHeader } from '../components/FlowHeader.tsx';
import { Money } from '../components/Money.tsx';
import { RatioBar } from '../components/RatioBar.tsx';
import { Spine } from '../components/Spine.tsx';

export function SurveyScreen({ state, ui, go, goScreen }: ScreenProps) {
  const index = ui.surveyIndex ?? 0;
  return (
    <div className="paper-texture min-h-dvh">
      <FlowHeader current="survey" nickname={state.profile.nickname} />
      {index < SURVEY.length ? (
        <Question
          index={index}
          initial={state.survey.answers[SURVEY[index]!.id] ?? null}
          onPrev={() => (index === 0 ? go('start-reveal') : go('survey-q1'))}
          onNext={() => go(index === SURVEY.length - 1 ? 'survey-result' : 'survey-q7')}
        />
      ) : (
        <Result state={state} onPrev={() => go('survey-q7')} onNext={() => goScreen('guide')} />
      )}
    </div>
  );
}

function Progress({ index }: { index: number }) {
  return (
    <div className="flex items-center gap-3">
      <ol className="flex flex-1 gap-1.5" aria-hidden>
        {SURVEY.map((q, i) => (
          <li key={q.id} className={`h-1.5 flex-1 rounded-full ${i <= index ? 'bg-ink' : 'bg-rule'}`} />
        ))}
      </ol>
      <p className="num text-[15px] font-semibold" aria-label={`${SURVEY.length}문항 중 ${index + 1}번째`}>
        {index + 1} / {SURVEY.length}
      </p>
    </div>
  );
}

function Question({
  index,
  initial,
  onPrev,
  onNext,
}: {
  index: number;
  initial: string | null;
  onPrev: () => void;
  onNext: () => void;
}) {
  const q = SURVEY[index]!;
  const [picked, setPicked] = useState<string | null>(initial);
  return (
    <main className="mx-auto max-w-[44rem] px-5 py-8 sm:px-8 sm:py-12">
      <Progress index={index} />
      <p className="mt-8 text-[15px] font-semibold text-ink-2">{q.linkedTo}와 이어지는 질문</p>
      <h1 className="display mt-2 text-[33px] sm:text-[42px]">{q.text}</h1>
      <fieldset className="mt-7">
        <legend className="sr-only">{q.text}</legend>
        <div className="grid gap-2.5">
          {q.options.map((o) => {
            const on = picked === o.id;
            return (
              <label
                key={o.id}
                className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-[10px] px-4 text-[17px] transition-colors has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-in ${
                  on ? 'bg-ink font-semibold text-white' : 'bg-sheet shadow-[inset_0_0_0_1.5px_var(--color-rule)] hover:bg-white'
                }`}
              >
                <input type="radio" name={q.id} value={o.id} checked={on} onChange={() => setPicked(o.id)} className="sr-only" />
                <span
                  aria-hidden
                  className={`grid size-5 flex-none place-items-center rounded-full border-2 ${on ? 'border-white' : 'border-ink-3'}`}
                >
                  {on ? <span className="size-2.5 rounded-full bg-white" /> : null}
                </span>
                {o.label}
              </label>
            );
          })}
        </div>
      </fieldset>
      <div className="mt-8 flex items-center justify-between gap-3">
        <button type="button" onClick={onPrev} className="btn btn-quiet">
          <ChevronLeft size={18} aria-hidden />
          이전
        </button>
        <button type="button" onClick={onNext} disabled={!picked} className="btn btn-primary px-6">
          {index === SURVEY.length - 1 ? '결과 보기' : '다음 질문'}
        </button>
      </div>
    </main>
  );
}

function Result({ state, onPrev, onNext }: { state: ScreenProps['state']; onPrev: () => void; onNext: () => void }) {
  const result = state.survey.result;
  if (!result) return null;
  const type = SPENDING_TYPES[result.type];
  const rec = result.recommended;
  const sum = budgetSummary(rec, state.profile.salary);
  return (
    <main className="mx-auto max-w-[1100px] px-5 py-8 sm:px-8 sm:py-10">
      <div className="grid gap-8 lg:grid-cols-[1fr_1.15fr] lg:gap-12">
        <section>
          <p className="text-[15px] font-semibold text-ink-2">{state.profile.nickname}님의 소비 성향</p>
          <h1 className="display mt-2 text-[56px] leading-none sm:text-[64px]">{type.label}</h1>
          <p className="mt-4 text-[21px] font-semibold leading-snug">{type.oneLiner}</p>
          <div className="mt-6 rounded-[10px] bg-sheet p-4 shadow-[inset_4px_0_0_var(--color-ink)]">
            <p className="text-[13px] font-semibold text-ink-2">조언</p>
            <p className="mt-1 text-[17px]">{type.advice}</p>
          </div>
          <p className="mt-5 text-[15px] text-ink-2">
            답한 내용으로 한 달 지출 예산 {formatMan(sum.expenseTotal)}을 잡고, 남은 돈을 통장마다 나눈 추천 가계부를 만들었어요. 다음
            단계에서 내 마음대로 고칠 수 있어요.
          </p>
        </section>
        <section aria-labelledby="rec-title" className="rounded-panel bg-sheet p-5 shadow-[0_0_0_1px_var(--color-rule)] sm:p-6">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="rec-title" className="text-[21px] font-bold">
              추천 가계부 미리보기
            </h2>
            <p className="text-[14px] text-ink-2">
              저축률 <span className="num text-[17px] font-bold text-ink">{formatPct(sum.savingsRate)}</span>
            </p>
          </div>
          <div className="mt-4">
            <RatioBar shares={sum.shares} height={22} />
          </div>
          <ul className="mt-5 divide-y divide-rule-soft">
            <li className="flex items-center gap-3 py-2">
              <Spine id="living" className="h-8" />
              <span className="flex-1">
                <span className="font-semibold">{ACCOUNTS.living.label}</span>
                <span className="block text-[13px] text-ink-3">지출 예산 + 여유분</span>
              </span>
              <Money value={sum.livingIn} className="font-semibold" />
            </li>
            {TRANSFER_ORDER.map((id) => (
              <li key={id} className="flex items-center gap-3 py-2">
                <Spine id={id} className="h-8" />
                <span className="flex-1">
                  <span className="font-semibold">{ACCOUNTS[id].label}</span>
                  <span className="block text-[13px] text-ink-3">{ACCOUNTS[id].purpose}</span>
                </span>
                <Money value={rec.transfers[id]} className="font-semibold" />
              </li>
            ))}
          </ul>
        </section>
      </div>
      <div className="mt-8 flex items-center justify-between gap-3">
        <button type="button" onClick={onPrev} className="btn btn-quiet">
          <ChevronLeft size={18} aria-hidden />
          이전
        </button>
        <button type="button" onClick={onNext} className="btn btn-primary px-6">
          돈 관리 기초 보기
        </button>
      </div>
    </main>
  );
}
