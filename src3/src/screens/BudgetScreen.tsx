import { useState } from 'react';
import {
  PROMPTS,
  SURVEY,
  budgetSummary,
  fillTemplate,
  formatMan,
  formatWon,
  type Budget,
} from '@gagyebu/core';
import type { ScreenProps } from '@gagyebu/draft-kit';
import { AppFrame } from '../components/AppFrame.tsx';
import { BudgetEditor } from '../components/BudgetEditor.tsx';

export function BudgetScreen({ state, go }: ScreenProps) {
  const [budget, setBudget] = useState<Budget>(() => structuredClone(state.budget));
  const salary = state.profile.salary;
  const sum = budgetSummary(budget, salary);
  const recommended = state.survey.result?.recommended;
  const answers = state.survey.answers;

  const labelOf = (qid: string) => {
    const q = SURVEY.find((x) => x.id === qid);
    const a = answers[qid as keyof typeof answers];
    return q?.options.find((o) => o.id === a)?.label ?? '보통';
  };

  const prompt = fillTemplate(PROMPTS.budget.template, {
    salary: formatWon(salary).replace('원', ''),
    meal: labelOf('meal'),
    delivery: labelOf('delivery'),
  });

  return (
    <AppFrame screen="budget" nickname={state.profile.nickname}>
      <div className="flex flex-1 flex-col gap-2.5">
        <div className="cut flex flex-wrap items-end justify-between gap-x-6 gap-y-2 px-5 py-4">
          <div>
            <h1 className="text-[22px] leading-tight font-extrabold tracking-[-0.02em]">월급을 여섯 통장으로 나눕니다</h1>
            <p className="mt-1 text-sm text-mute">
              월급 <b className="num text-text">{formatWon(salary)}</b> · 1만 원 단위로 조정 · 자동이체를 먼저 떼고 남은 돈으로 생활합니다.
            </p>
          </div>
          <p className="text-sm text-mute">
            저축률 <b className="num text-text">{Math.round(sum.savingsRate * 1000) / 10}%</b>
            <span className="mx-2 text-line-strong" aria-hidden>|</span>
            생활비 여유 <b className="num text-text">{formatMan(budget.livingBuffer)}</b>
          </p>
        </div>

        <BudgetEditor
          budget={budget}
          salary={salary}
          onChange={setBudget}
          resetTo={recommended}
          resetLabel="추천값으로"
          promptText={prompt}
          confirmLabel="이 가계부로 1년 시작하기"
          onConfirm={() => go('sim-jan-payday')}
        />

        <p className="pb-1 text-center text-xs text-mute">
          금리·수익률은 수업을 위한 가정값입니다. 실제 상품 조건과 다릅니다.
        </p>
      </div>
    </AppFrame>
  );
}
