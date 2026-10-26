import { useMemo, useState } from 'react';
import { budgetIssues, formatMan, getScene, type Budget, type GameState } from '@gagyebu/core';
import { ArrowRight, MessageSquareText, SlidersHorizontal } from 'lucide-react';
import { BudgetEditor } from '../../components/BudgetEditor.tsx';
import { BudgetBalanceBar } from '../../components/BudgetSummaryPanel.tsx';
import { Button } from '../../components/ui.tsx';
import { AccountPanel } from './AccountPanel.tsx';
import { SceneCard } from './SceneCard.tsx';

/** 가계부 조정 단계: 이벤트로 바뀐 예산을 맞춘다. 조정을 부른 장면도 함께 보여 준다 */
export function AdjustPanel({ state, onConfirm }: { state: GameState; onConfirm: () => void }) {
  const [budget, setBudget] = useState<Budget>(() => structuredClone(state.budget));
  const issues = useMemo(() => budgetIssues(budget, state.profile.salary), [budget, state.profile.salary]);
  const valid = issues.length === 0;
  const over = issues.find((i) => i.kind === 'over');
  const reason = state.lastOutcome?.budgetReason ?? '가계부를 다시 맞춰 주세요.';
  const recap = state.lastOutcome ? getScene(state.lastOutcome.ref) : null;

  return (
    <section className="animate-enter">
      <div className="mb-3">
        <p className="text-xs font-semibold tracking-wide text-primary">가계부 조정</p>
        <h1 className="text-[clamp(1.3rem,2.5vw,1.7rem)] font-bold tracking-tight text-ink">달라진 조건에 맞춰 계획을 고칩니다</h1>
      </div>

      <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,460px)]">
        <div className="flex flex-col gap-2">
          <div className="flex items-start gap-2 rounded-2xl border-2 border-accent/50 bg-accent-soft p-3">
            <SlidersHorizontal size={18} className="mt-0.5 shrink-0 text-accent-ink" aria-hidden />
            <div>
              <p className="text-[14px] font-bold text-accent-ink">{reason}</p>
              <p className="mt-0.5 text-[12px] text-accent-ink">
                {over ? `지금 ${formatMan(over.amount)} 초과 상태입니다. ` : ''}합계가 월급과 같아지면 다음으로 넘어갑니다.
              </p>
            </div>
          </div>
          <AccountPanel state={state} layout="grid" />
        </div>
        {recap && (
          <div>
            <p className="mb-1.5 flex items-center gap-1.5 text-[12px] font-semibold text-ink-3">
              <MessageSquareText size={13} aria-hidden /> 이 조정을 부른 장면
            </p>
            <SceneCard event={recap.event} scene={recap.scene} />
          </div>
        )}
      </div>

      <div className="mt-3">
        <BudgetBalanceBar budget={budget} salary={state.profile.salary}>
          <Button disabled={!valid} onClick={onConfirm} className="w-full sm:w-auto">
            조정 완료 <ArrowRight size={17} aria-hidden />
          </Button>
        </BudgetBalanceBar>
      </div>

      <div className="mt-3">
        <BudgetEditor budget={budget} salary={state.profile.salary} onChange={setBudget} reference={state.budget} layout="stack" />
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-ink-3">
        조정 횟수는 결과 화면에 기록됩니다. 가계부를 고치는 것은 계획이 틀렸다는 뜻이 아니라, 조건이 바뀌었다는 신호입니다.
      </p>
    </section>
  );
}
