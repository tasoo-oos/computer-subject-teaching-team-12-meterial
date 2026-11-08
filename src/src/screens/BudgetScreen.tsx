import { useState } from 'react';
import { ChevronLeft, RotateCcw } from 'lucide-react';
import { isBudgetValid, formatMan, type Budget } from '@gagyebu/core';
import type { ScreenProps } from '@gagyebu/draft-kit';
import { BudgetEditor } from '../components/BudgetEditor.tsx';
import { BudgetTotals } from '../components/BudgetTotals.tsx';
import { FlowHeader } from '../components/FlowHeader.tsx';
import { PromptCopy } from '../components/PromptCopy.tsx';
import { useActBusy } from '../lib/actBusy.tsx';
import { budgetPrompt } from '../lib/prompts.ts';

export function BudgetScreen({ state, dispatch, draft, mode }: ScreenProps) {
  const busy = useActBusy();
  const live = mode !== 'dev';
  const [budget, setBudget] = useState(state.budget);
  const salary = state.profile.salary;
  const recommended = state.survey.result?.recommended ?? null;
  const valid = isBudgetValid(budget, salary);

  // 편집 중인 안을 초안으로 실어 보낸다(라이브: 2초 묶음 + 제출 직전 flush, §5.4. dev·solo는 no-op)
  const change = (b: Budget) => {
    setBudget(b);
    draft({ kind: 'budget', budget: b });
  };

  // 확정: 라이브·solo는 편집한 안을 먼저 setBudget로 저장하고 confirmBudget로 확정한다(두 行動 순서 보장).
  // dev 어댑터는 setBudget를 무시하고 confirmBudget만 이동표로 바꾼다(기존 동작 그대로).
  const confirm = () => {
    if (live) dispatch({ type: 'setBudget', budget });
    dispatch({ type: 'confirmBudget' });
  };

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
            <BudgetEditor budget={budget} onChange={change} />
          </div>
          <aside className="lg:sticky lg:top-4">
            <BudgetTotals budget={budget} salary={salary}>
              <button
                type="button"
                className="btn btn-quiet"
                disabled={!recommended}
                onClick={() => recommended && change(structuredClone(recommended))}
              >
                <RotateCcw size={16} aria-hidden />
                추천값으로 되돌리기
              </button>
            </BudgetTotals>
            <div className="mt-4 flex items-center justify-between gap-3">
              {live ? (
                <p className="text-[13px] text-ink-3">확정하면 1년 시뮬레이션이 시작돼요.</p>
              ) : (
                <button type="button" onClick={() => dispatch({ type: 'goto', phase: 'guide' })} className="btn btn-quiet">
                  <ChevronLeft size={18} aria-hidden />
                  이전
                </button>
              )}
              <button
                type="button"
                disabled={!valid || busy}
                onClick={confirm}
                className="btn btn-primary flex-1 px-5"
              >
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
