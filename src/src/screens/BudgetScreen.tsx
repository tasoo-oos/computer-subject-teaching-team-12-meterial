import { useState } from 'react';
import { ChevronLeft, RotateCcw } from 'lucide-react';
import { isBudgetValid, formatMan } from '@gagyebu/core';
import type { ScreenProps } from '@gagyebu/draft-kit';
import { BudgetEditor } from '../components/BudgetEditor.tsx';
import { BudgetTotals } from '../components/BudgetTotals.tsx';
import { FlowHeader } from '../components/FlowHeader.tsx';
import { PromptCopy } from '../components/PromptCopy.tsx';
import { budgetPrompt } from '../lib/prompts.ts';

export function BudgetScreen({ state, go, goScreen }: ScreenProps) {
  const [budget, setBudget] = useState(state.budget);
  const salary = state.profile.salary;
  const recommended = state.survey.result?.recommended ?? null;
  const valid = isBudgetValid(budget, salary);
  return (
    <div className="paper-texture min-h-dvh">
      <FlowHeader current="budget" nickname={state.profile.nickname} />
      <main className="mx-auto max-w-[1200px] px-5 py-6 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="display text-[42px]">한 달 가계부 짜기</h1>
            <p className="mt-1 max-w-[40em] text-[16px] text-ink-2">
              월급 {formatMan(salary)}을 남김없이 나눠 주세요. 자동이체로 먼저 떼어 둘 돈과, 생활비 통장에서 한 달 동안 쓸 돈을 정합니다. 버튼
              한 번에 1만 원씩 바뀌어요.
            </p>
          </div>
          <PromptCopy text={budgetPrompt(state)} />
        </div>
        <div className="mt-6 grid items-start gap-6 lg:grid-cols-[1fr_380px]">
          <div className="rounded-panel bg-sheet p-4 shadow-[0_0_0_1px_var(--color-rule)] sm:p-6">
            <BudgetEditor budget={budget} onChange={setBudget} />
          </div>
          <aside className="lg:sticky lg:top-4">
            <BudgetTotals budget={budget} salary={salary}>
              <button
                type="button"
                className="btn btn-quiet"
                disabled={!recommended}
                onClick={() => recommended && setBudget(structuredClone(recommended))}
              >
                <RotateCcw size={16} aria-hidden />
                추천값으로 되돌리기
              </button>
            </BudgetTotals>
            <div className="mt-4 flex items-center justify-between gap-3">
              <button type="button" onClick={() => go('guide-1')} className="btn btn-quiet">
                <ChevronLeft size={18} aria-hidden />
                이전
              </button>
              <button type="button" disabled={!valid} onClick={() => goScreen('sim')} className="btn btn-primary flex-1 px-5">
                이 가계부로 1년 시작
              </button>
            </div>
            {!valid ? <p className="mt-2 text-right text-[13px] text-ink-2">남은 금액이 0원이 되면 시작할 수 있어요.</p> : null}
          </aside>
        </div>
      </main>
    </div>
  );
}
