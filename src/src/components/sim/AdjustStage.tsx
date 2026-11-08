import { useState } from 'react';
import { CircleAlert } from 'lucide-react';
import { isBudgetValid, type Budget, type GameState } from '@gagyebu/core';
import { BudgetEditor } from '../BudgetEditor.tsx';
import { InlineTotals } from '../BudgetTotals.tsx';
import { useActBusy } from '../../lib/actBusy.tsx';

/** 이벤트 때문에 달라진 가계부를 다시 맞추는 단계.
 *  onNext(budget): 편집한 안을 그대로 넘긴다(라이브·solo는 setBudget 行動, dev는 이동표만). */
export function AdjustStage({
  state,
  onNext,
  onDraft,
}: {
  state: GameState;
  onNext: (budget: Budget) => void;
  /** 편집 중인 안을 초안으로 실어 보낸다(라이브: 자동 처리 대비. dev·solo는 no-op) */
  onDraft?: (data: unknown) => void;
}) {
  const busy = useActBusy();
  const [budget, setBudget] = useState<Budget>(state.budget);
  const reason = state.lastOutcome?.budgetReason ?? '가계부를 다시 맞춰 주세요.';
  const valid = isBudgetValid(budget, state.profile.salary);
  const marks: Partial<Record<string, string>> = {};
  for (const d of state.lastOutcome?.deltas ?? []) {
    if (d.kind !== 'budget') continue;
    const won = Math.round(d.amount / 10_000);
    marks[d.key] = won > 0 ? `+${won}만` : `${won}만`;
  }
  const change = (b: Budget) => {
    setBudget(b);
    onDraft?.({ kind: 'budget', budget: b });
  };
  return (
    <div className="grid gap-4">
      <section className="rounded-panel bg-sheet p-4 shadow-[0_0_0_1px_var(--color-rule)] sm:p-5" aria-labelledby="adjust-title">
        <p className="flex items-center gap-1.5 text-[12px] font-semibold text-seal">
          <CircleAlert size={14} aria-hidden />
          가계부 조정
        </p>
        <h2 id="adjust-title" className="mt-1 text-[21px] font-bold leading-snug">
          {reason}
        </h2>
        <p className="mt-1 text-[14px] text-ink-2">
          이번 달 지출은 이미 지나갔습니다. 여기서 맞춘 금액이 다음 달부터 적용됩니다. 합계가 월급과 같아야 넘어갈 수 있어요.
        </p>
      </section>

      <InlineTotals budget={budget} salary={state.profile.salary}>
        <span className="text-[12px] text-ink-2">맞추고 나면 다음 달부터 적용됩니다.</span>
        <button type="button" disabled={!valid || busy} onClick={() => onNext(budget)} className="btn btn-primary px-5">
          조정 완료
        </button>
      </InlineTotals>

      <div className="rounded-panel bg-sheet p-4 shadow-[0_0_0_1px_var(--color-rule)] sm:p-5">
        <BudgetEditor budget={budget} onChange={change} marks={marks} layout="split" />
      </div>

      <div className="flex items-center justify-end gap-3">
        <button type="button" disabled={!valid || busy} onClick={() => onNext(budget)} className="btn btn-primary px-6">
          조정 완료, 이번 달 마치기
        </button>
      </div>
    </div>
  );
}
