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
  type Action,
  type GameState,
  type QuestionId,
} from '@gagyebu/core';
import type { ScreenProps } from '@gagyebu/draft-kit';
import { FlowHeader } from '../components/FlowHeader.tsx';
import { Money } from '../components/Money.tsx';
import { RatioBar } from '../components/RatioBar.tsx';
import { Spine } from '../components/Spine.tsx';
import { useActBusy } from '../lib/actBusy.tsx';
import { DEV_PREV } from '../dev/route.ts';

export function SurveyScreen({ state, dispatch, mode, beat, ui }: ScreenProps) {
  // dev: 스냅숏 힌트(ui.surveyIndex)로 문항 하나씩(기존 동작 그대로).
  // live·solo: 'survey' 비트는 7문항 한 화면(§8-3), 'survey-result' 비트는 결과만(버튼 없음).
  if (mode !== 'dev') {
    return (
      <div className="paper-texture min-h-dvh">
        <FlowHeader current="survey" nickname={state.profile.nickname} />
        {beat.id === 'survey' ? (
          <SurveyForm state={state} dispatch={dispatch} />
        ) : (
          <Result state={state} />
        )}
      </div>
    );
  }
  const index = ui?.surveyIndex ?? 0;
  return (
    <div className="paper-texture min-h-dvh">
      <FlowHeader current="survey" nickname={state.profile.nickname} />
      {index < SURVEY.length ? (
        <Question
          index={index}
          initial={state.survey.answers[SURVEY[index]!.id] ?? null}
          onPrev={() => dispatch(DEV_PREV)}
          onNext={() => dispatch({ type: 'submitSurvey', answers: {} })}
        />
      ) : (
        <Result state={state} onPrev={() => dispatch(DEV_PREV)} onNext={() => dispatch({ type: 'goto', phase: 'guide' })} />
      )}
    </div>
  );
}

/** 7문항 한 화면 폼(라이브·solo 표준, §8-3). "N/7 답함" 표시와 함께 모두 답해야 제출할 수 있다 */
function SurveyForm({ state, dispatch }: { state: GameState; dispatch: (a: Action) => void }) {
  const busy = useActBusy();
  const [answers, setAnswers] = useState<Partial<Record<QuestionId, string>>>(state.survey.answers);
  const answeredCount = SURVEY.filter((q) => answers[q.id]).length;
  const complete = answeredCount === SURVEY.length;
  const submit = () => {
    if (!complete) return;
    dispatch({ type: 'submitSurvey', answers: answers as Record<QuestionId, string> });
  };
  return (
    <main className="mx-auto max-w-[52rem] px-5 py-8 sm:px-8 sm:py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="display text-[33px] sm:text-[42px]">소비습관 설문</h1>
          <p className="mt-1 text-[15px] text-ink-2">
            7개 문항에 모두 답하면 제출할 수 있어요. 답은 가계부 추천에 그대로 반영됩니다.
          </p>
        </div>
        <p
          className="num rounded-full bg-sheet px-4 py-1.5 text-[17px] font-bold shadow-[0_0_0_1px_var(--color-rule)]"
          aria-label={`${SURVEY.length}문항 중 ${answeredCount}문항 답함`}
        >
          {answeredCount} / {SURVEY.length} 답함
        </p>
      </div>

      <ol className="mt-6 space-y-5">
        {SURVEY.map((q, i) => {
          const picked = answers[q.id] ?? null;
          return (
            <li key={q.id} className="rounded-panel bg-sheet p-4 shadow-[0_0_0_1px_var(--color-rule)] sm:p-5">
              <fieldset>
                <legend className="w-full">
                  <span className="num text-[13px] font-semibold text-ink-2">
                    {i + 1}번 · 이 답은 {q.linkedTo} 예산에 반영됩니다
                  </span>
                  <span className="mt-0.5 block text-[19px] font-bold leading-snug sm:text-[21px]">{q.text}</span>
                </legend>
                <div className="mt-3 grid gap-2">
                  {q.options.map((o) => {
                    const on = picked === o.id;
                    return (
                      <label
                        key={o.id}
                        className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-[10px] px-3.5 text-[15px] transition-colors has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-in sm:text-[16px] ${
                          on ? 'bg-ink font-semibold text-white' : 'bg-paper shadow-[inset_0_0_0_1.5px_var(--color-rule)] hover:bg-white'
                        }`}
                      >
                        <input
                          type="radio"
                          name={q.id}
                          value={o.id}
                          checked={on}
                          onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: o.id }))}
                          className="sr-only"
                        />
                        <span
                          aria-hidden
                          className={`grid size-4.5 flex-none place-items-center rounded-full border-2 ${on ? 'border-white' : 'border-ink-3'}`}
                        >
                          {on ? <span className="size-2 rounded-full bg-white" /> : null}
                        </span>
                        {o.label}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            </li>
          );
        })}
      </ol>

      <div className="sticky bottom-3 mt-6 flex flex-wrap items-center justify-between gap-3 rounded-panel bg-sheet/95 px-4 py-3 shadow-[0_0_0_1px_var(--color-rule),0_12px_28px_-18px_rgba(24,38,74,.6)] backdrop-blur-sm">
        <p className="num text-[14px] font-semibold text-ink-2" aria-live="polite">
          {complete ? '모두 답했어요!' : `아직 ${SURVEY.length - answeredCount}문항이 남았어요`}
        </p>
        <button type="button" onClick={submit} disabled={!complete || busy} className="btn btn-primary px-6">
          제출하기
        </button>
      </div>
    </main>
  );
}

/** 제출한 답의 읽기 전용 요약 — 설문 비트 대기 화면에 쓴다 */
export function SurveyAnswersSummary({ state }: { state: GameState }) {
  return (
    <section className="rounded-panel bg-sheet p-4 shadow-[0_0_0_1px_var(--color-rule)] sm:p-5" aria-labelledby="answers-title">
      <h2 id="answers-title" className="text-[15px] font-bold">
        내가 답한 내용
      </h2>
      <ul className="mt-2 divide-y divide-rule-soft">
        {SURVEY.map((q, i) => {
          const opt = q.options.find((o) => o.id === state.survey.answers[q.id]);
          return (
            <li key={q.id} className="flex items-baseline gap-3 py-2">
              <span className="num flex-none text-[12px] font-semibold text-ink-3">{i + 1}번</span>
              <span className="min-w-0 flex-1 text-[13px] leading-snug text-ink-2">{q.text}</span>
              <span className="max-w-[52%] flex-none text-right text-[14px] font-semibold leading-snug">{opt?.label ?? '—'}</span>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-[12px] text-ink-3">결과는 선생님이 다음 화면으로 넘기면 바로 보여요.</p>
    </section>
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
      <p className="mt-8 text-[15px] font-semibold text-ink-2">이 답은 {q.linkedTo} 예산에 반영됩니다</p>
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

function Result({ state, onPrev, onNext }: { state: ScreenProps['state']; onPrev?: () => void; onNext?: () => void }) {
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
                <span className="block text-[13px] text-ink-3">지출 예산 + 남는 돈</span>
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
      {onNext || onPrev ? (
        <div className="mt-8 flex items-center justify-between gap-3">
          {onPrev ? (
            <button type="button" onClick={onPrev} className="btn btn-quiet">
              <ChevronLeft size={18} aria-hidden />
              이전
            </button>
          ) : (
            <span />
          )}
          {onNext ? (
            <button type="button" onClick={onNext} className="btn btn-primary px-6">
              돈 관리 기초 보기
            </button>
          ) : null}
        </div>
      ) : null}
    </main>
  );
}
