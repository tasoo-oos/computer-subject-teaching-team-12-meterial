import { useMemo, useState } from 'react';
import type { ScreenProps } from '@gagyebu/draft-kit';
import { ArrowRight, RotateCcw, Wallet } from 'lucide-react';
import { budgetIssues, formatMan, type Budget } from '@gagyebu/core';
import { BudgetEditor } from '../components/BudgetEditor.tsx';
import { BudgetSummaryPanel } from '../components/BudgetSummaryPanel.tsx';
import { PromptCopy } from '../components/PromptCopy.tsx';
import { Button } from '../components/ui.tsx';
import { LessonBar, LessonFooter } from '../components/LessonBar.tsx';
import { budgetPrompt } from '../lib/prompts.ts';

export function BudgetScreen({ state, goScreen }: ScreenProps) {
  const recommended = state.survey.result?.recommended ?? state.budget;
  const [budget, setBudget] = useState<Budget>(() => structuredClone(state.budget));
  const salary = state.profile.salary;
  const issues = useMemo(() => budgetIssues(budget, salary), [budget, salary]);
  const valid = issues.length === 0;
  const over = issues.find((i) => i.kind === 'over');

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <LessonBar current="budget" />
      <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 py-5 sm:px-6">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-wide text-primary">4단계 · 가계부 작성</p>
            <h1 className="mt-0.5 text-[clamp(1.4rem,2.6vw,1.8rem)] font-bold tracking-tight text-ink">
              {state.profile.nickname}님의 월급 <span className="num">{formatMan(salary)}</span>을 나눠 보세요
            </h1>
            <p className="mt-1 text-sm text-ink-2">
              자동이체와 지출 예산을 고치면 합계·저축률·계좌 비율이 바로 바뀝니다. <strong className="font-semibold text-ink">합계가 월급과 같아야</strong> 시작할 수 있어요.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => setBudget(structuredClone(recommended))}>
              <RotateCcw size={15} aria-hidden /> 추천값으로 되돌리기
            </Button>
            <PromptCopy text={budgetPrompt(state)} stage="가계부 작성" compact />
          </div>
        </div>

        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_344px]">
          <div>
            <BudgetEditor budget={budget} salary={salary} onChange={setBudget} reference={recommended} />
            <p className="mt-3 rounded-xl border border-line bg-surface/60 px-3 py-2 text-xs leading-relaxed text-ink-3">
              자동이체는 월급날 먼저 빠져나갑니다. 생활비 통장에는 ‘지출 예산 + 여유분’이 들어가고, 쓰고 남은 여유분은 다음 달로 넘어갑니다.
              버튼이나 입력칸에서 ↑/↓ 키로도 1만 원씩 조정할 수 있습니다.
            </p>
          </div>

          <div className="xl:sticky xl:top-4">
            <BudgetSummaryPanel budget={budget} salary={salary}>
              <Button size="lg" disabled={!valid} onClick={() => goScreen('sim')} className="w-full">
                <Wallet size={18} aria-hidden />
                1년 시뮬레이션 시작
                <ArrowRight size={18} aria-hidden />
              </Button>
              {!valid && (
                <p className="-mt-1 text-center text-xs text-ink-3">
                  {over ? `초과 ${formatMan(over.amount)}을 줄이면 시작할 수 있어요` : '남은 금액을 0원으로 맞추면 시작할 수 있어요'}
                </p>
              )}
            </BudgetSummaryPanel>
          </div>
        </div>
      </main>
      <LessonFooter />
    </div>
  );
}
