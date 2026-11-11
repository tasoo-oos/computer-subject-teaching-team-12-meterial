import type { ReactNode } from 'react';
import {
  ACCOUNTS,
  EXPENSE_ORDER,
  EXPENSES,
  TRANSFER_ORDER,
  type Budget,
  type ExpenseGroup,
  type ExpenseId,
  type TransferAccountId,
} from '@gagyebu/core';
import { Money } from './Money.tsx';
import { Spine } from './Spine.tsx';
import { Stepper } from './Stepper.tsx';

export type BudgetKey = TransferAccountId | ExpenseId;

interface BudgetEditorProps {
  budget: Budget;
  onChange: (b: Budget) => void;
  /** split: 넓은 화면에서 두 단으로 나눠 세로 길이를 줄인다 */
  layout?: 'stack' | 'split';
  /** 항목 옆에 붙일 짧은 표시 (예: 이번 이벤트로 바뀐 항목) */
  marks?: Partial<Record<BudgetKey, string>>;
}

function setKey(b: Budget, key: BudgetKey, v: number): Budget {
  if ((TRANSFER_ORDER as string[]).includes(key)) return { ...b, transfers: { ...b.transfers, [key]: v } };
  return { ...b, expenses: { ...b.expenses, [key]: v } };
}

const GROUP_LABEL: Record<ExpenseGroup, string> = { fixed: '고정비', variable: '변동비' };

/** 가계부 편집기. 가계부 작성 화면과 시뮬레이션 조정 단계에서 함께 쓴다.
 *  월급 − 자동이체 − 지출 예산(남는 돈)은 따로 정하지 않는다 — 생활비 통장에 그대로 남는다(합계 표시는 BudgetTotals) */
export function BudgetEditor({ budget, onChange, marks = {}, layout = 'stack' }: BudgetEditorProps) {
  const row = (key: BudgetKey, title: string, sub: string, value: number, lead?: ReactNode) => (
    <li key={key} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2">
      {lead}
      <div className="min-w-0 flex-1 basis-40">
        <p className="flex flex-wrap items-center gap-x-2 font-semibold leading-snug">
          {title}
          {marks[key] ? (
            <span className="rounded-[4px] bg-mark px-1.5 py-px text-[12px] font-semibold text-ink">{marks[key]}</span>
          ) : null}
        </p>
        <p className="text-[13px] leading-snug text-ink-3">{sub}</p>
      </div>
      <Stepper label={title} value={value} onChange={(v) => onChange(setKey(budget, key, v))} />
    </li>
  );

  const groupTotal = (g: ExpenseGroup) =>
    EXPENSE_ORDER.filter((id) => EXPENSES[id].group === g).reduce((a, id) => a + budget.expenses[id], 0);

  const transfers = (
    <section aria-labelledby="be-transfers">
      <SectionHead id="be-transfers" title="월급날 자동이체" note="월급이 들어오자마자 먼저 떼어 두는 돈" />
      <ul className="divide-y divide-rule-soft">
        {TRANSFER_ORDER.map((id) =>
          row(id, ACCOUNTS[id].label, `${ACCOUNTS[id].product}, 권장 ${ACCOUNTS[id].guide}`, budget.transfers[id], <Spine id={id} />),
        )}
      </ul>
    </section>
  );

  const expenseSection = (g: ExpenseGroup) => (
    <section key={g} aria-labelledby={`be-${g}`}>
      <SectionHead
        id={`be-${g}`}
        title={`생활비 통장에서 나가는 돈: ${GROUP_LABEL[g]}`}
        note={g === 'fixed' ? '매달 거의 같은 돈' : '내가 조절할 수 있는 돈'}
        total={groupTotal(g)}
      />
      <ul className="divide-y divide-rule-soft">
        {EXPENSE_ORDER.filter((id) => EXPENSES[id].group === g).map((id) =>
          row(id, EXPENSES[id].label, EXPENSES[id].example, budget.expenses[id]),
        )}
      </ul>
    </section>
  );

  if (layout === 'split') {
    return (
      <div className="grid gap-x-8 gap-y-5 lg:grid-cols-2">
        <div className="space-y-5">
          {transfers}
          {expenseSection('fixed')}
        </div>
        <div className="space-y-5">
          {expenseSection('variable')}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {transfers}
      {expenseSection('fixed')}
      {expenseSection('variable')}
    </div>
  );
}

function SectionHead({ id, title, note, total }: { id: string; title: string; note: string; total?: number }) {
  return (
    <div className="mb-1 flex items-end justify-between gap-3 border-b-2 border-ink pb-1.5">
      <div>
        <h3 id={id} className="text-[17px] font-bold leading-tight">
          {title}
        </h3>
        <p className="text-[13px] text-ink-3">{note}</p>
      </div>
      {total !== undefined ? <Money value={total} className="text-[15px] font-semibold" /> : null}
    </div>
  );
}
