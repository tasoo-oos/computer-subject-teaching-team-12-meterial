import { useState } from 'react';
import type { ScreenProps } from '@gagyebu/draft-kit';
import { ArrowLeft, ArrowRight, Check, Info, Sparkles } from 'lucide-react';
import {
  ACCOUNTS,
  SPENDING_TYPES,
  SURVEY,
  budgetSummary,
  classifySpending,
  formatMan,
  formatPct,
  recommendBudget,
  type QuestionId,
} from '@gagyebu/core';
import { Button, StepDots } from '../components/ui.tsx';
import { AccountShareBar } from '../components/AccountShareBar.tsx';
import { AccountIcon } from '../components/AccountBadge.tsx';
import { LessonBar, LessonFooter } from '../components/LessonBar.tsx';
import { Money } from '../components/Money.tsx';

export function SurveyScreen({ state, ui, go, goScreen }: ScreenProps) {
  const startIndex = ui.surveyIndex ?? 0;
  const [index, setIndex] = useState(startIndex);
  const [answers, setAnswers] = useState<Record<string, string>>({ ...state.survey.answers });
  const isResult = index >= SURVEY.length;

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <LessonBar current="survey" />
      <main className="mx-auto w-full max-w-[860px] flex-1 px-4 py-7 sm:px-6 lg:py-10">
        {isResult ? (
          <SurveyResult state={state} answers={answers} goScreen={goScreen} />
        ) : (
          <QuestionFlow
            index={index}
            answers={answers}
            onSelect={(q, o) => setAnswers((a) => ({ ...a, [q]: o }))}
            onBack={() => (index === 0 ? go('start-reveal') : setIndex((i) => i - 1))}
            onNext={() => setIndex((i) => i + 1)}
          />
        )}
      </main>
      <LessonFooter />
    </div>
  );
}

function QuestionFlow({
  index,
  answers,
  onSelect,
  onBack,
  onNext,
}: {
  index: number;
  answers: Record<string, string>;
  onSelect: (q: QuestionId, o: string) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const q = SURVEY[index]!;
  const selected = answers[q.id];
  return (
    <section className="animate-enter">
      <div className="mb-6 flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-2 text-sm font-semibold text-ink-2 transition-colors hover:bg-ink/5"
        >
          <ArrowLeft size={17} aria-hidden /> 이전
        </button>
        <div className="flex-1">
          <StepDots index={index} total={SURVEY.length} label="소비습관 질문" />
        </div>
      </div>

      <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-primary">
        <Sparkles size={15} aria-hidden /> Q{index + 1}
        <span className="font-normal text-ink-3">· {q.linkedTo} 예산과 연결됩니다</span>
      </p>
      <h1 className="text-[clamp(1.5rem,3.2vw,2rem)] font-bold leading-snug tracking-tight text-ink">{q.text}</h1>

      <fieldset className="mt-6">
        <legend className="sr-only">{q.text}</legend>
        <div className="grid gap-2.5 sm:grid-cols-2">
          {q.options.map((o) => {
            const active = selected === o.id;
            return (
              <label
                key={o.id}
                className={`group flex min-h-16 items-center gap-3 rounded-2xl border-2 bg-surface px-4 py-3 transition-[border-color,background-color,transform] duration-150 ${
                  active ? 'border-primary bg-primary-soft/60' : 'border-line hover:border-line-strong hover:bg-surface-2'
                }`}
              >
                <input type="radio" name={q.id} value={o.id} checked={active} onChange={() => onSelect(q.id, o.id)} className="sr-only" />
                <span
                  className={`flex size-6 shrink-0 items-center justify-center rounded-full border-2 ${active ? 'border-primary bg-primary text-white' : 'border-line-strong bg-surface text-transparent'}`}
                  aria-hidden
                >
                  <Check size={14} strokeWidth={3} />
                </span>
                <span className="text-[16px] font-semibold text-ink">{o.label}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="mt-7 flex items-center justify-between gap-3">
        <p className="flex items-start gap-1.5 text-[13px] leading-relaxed text-ink-3">
          <Info size={15} className="mt-0.5 shrink-0" aria-hidden />
          정답은 없어요. 지금의 내 소비를 떠올리며 골라 주세요.
        </p>
        <Button onClick={onNext} disabled={!selected} size="lg">
          {index === SURVEY.length - 1 ? '결과 보기' : '다음 질문'}
          <ArrowRight size={18} aria-hidden />
        </Button>
      </div>
    </section>
  );
}

function SurveyResult({ state, answers, goScreen }: { state: ScreenProps['state']; answers: Record<string, string>; goScreen: ScreenProps['goScreen'] }) {
  const result = state.survey.result ?? recommendBudget(answers, state.profile.salary || 2_600_000);
  const type = SPENDING_TYPES[result.type];
  const { type: computed } = classifySpending(answers);
  const shown = computed === result.type ? result.type : result.type;
  const summary = budgetSummary(result.recommended, state.profile.salary);
  const recommended = result.recommended;
  return (
    <section className="animate-flip">
      <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-primary">
        <Sparkles size={15} aria-hidden /> 소비습관 진단 결과
      </p>
      <div className="grid gap-5 lg:grid-cols-[1fr_1.05fr]">
        <div>
          <div className="rounded-[24px] border-2 border-primary/25 bg-surface p-5 shadow-[var(--shadow-card)]">
            <div className="text-sm font-semibold text-ink-2">나는</div>
            <h1 className="mt-1 text-[clamp(2rem,5vw,2.8rem)] font-bold leading-tight tracking-tight text-primary">{type.label}</h1>
            <p className="mt-2 text-[17px] font-medium leading-relaxed text-ink">{type.oneLiner}</p>
            <p className="mt-3 rounded-xl bg-surface-2 p-3 text-sm leading-relaxed text-ink-2">{type.advice}</p>
            <div className="mt-4 flex items-center justify-between text-xs text-ink-3">
              <span>즉흥 소비 점수</span>
              <span className="num font-semibold text-ink-2">
                {result.impulseScore} / 16
              </span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-2" aria-hidden>
              <span className="block h-full rounded-full bg-accent" style={{ width: `${Math.min(100, (result.impulseScore / 16) * 100)}%` }} />
            </div>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-ink-3">
            점수는 정답·오답이 아니라 ‘바로 사는 편’에 가까운 정도를 나타냅니다. {shown === 'balanced' ? '지금의 균형을 유지하는 계획을 추천합니다.' : '추천 가계부는 아래 비율을 출발점으로 삼았습니다.'}
          </p>
        </div>

        <div className="card p-4">
          <div className="mb-3 flex items-baseline justify-between gap-2">
            <h2 className="text-[17px] font-bold text-ink">추천 가계부 미리보기</h2>
            <span className="text-xs text-ink-3">월급 {formatMan(state.profile.salary)}</span>
          </div>
          <AccountShareBar shares={summary.shares} />
          <dl className="mt-3 divide-y divide-line text-sm">
            {(['emergency', 'savings', 'invest', 'goal', 'housing'] as const).map((id) => (
              <div key={id} className="flex items-center gap-2 py-1.5">
                <AccountIcon id={id} size="sm" />
                <dt className="font-medium text-ink-2">{ACCOUNTS[id].label}</dt>
                <dd className="num ml-auto font-semibold text-ink">
                  <Money value={recommended.transfers[id]} />
                </dd>
                <dd className="num w-12 text-right text-xs text-ink-3">{formatPct(state.profile.salary ? recommended.transfers[id] / state.profile.salary : 0)}</dd>
              </div>
            ))}
            <div className="flex items-center gap-2 py-1.5">
              <AccountIcon id="living" size="sm" />
              <dt className="font-medium text-ink-2">생활비 통장</dt>
              <dd className="num ml-auto font-semibold text-ink">
                <Money value={summary.livingIn} />
              </dd>
              <dd className="num w-12 text-right text-xs text-ink-3">{formatPct(summary.shares.living)}</dd>
            </div>
          </dl>
          <p className="mt-2 text-xs leading-relaxed text-ink-3">다음 단계에서 이 금액을 직접 고칠 수 있습니다. 저축률 {formatPct(summary.savingsRate)}.</p>
          <Button className="mt-3 w-full" size="lg" onClick={() => goScreen('guide')}>
            재무 기초 배우러 가기
            <ArrowRight size={18} aria-hidden />
          </Button>
        </div>
      </div>
    </section>
  );
}
