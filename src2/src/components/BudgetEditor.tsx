import {
  ACCOUNTS,
  EXPENSE_ORDER,
  EXPENSES,
  TRANSFER_ORDER,
  formatMan,
  formatPct,
  type Budget,
  type ExpenseId,
  type TransferAccountId,
} from '@gagyebu/core';
import { CalendarClock, ShoppingBasket, Wallet } from 'lucide-react';
import type { ReactNode } from 'react';
import { AccountIcon } from './AccountBadge.tsx';
import { MoneyStepper } from './MoneyStepper.tsx';

export type BudgetKey = TransferAccountId | ExpenseId | 'livingBuffer';

function getValue(b: Budget, key: BudgetKey): number {
  if (key === 'livingBuffer') return b.livingBuffer;
  if ((TRANSFER_ORDER as string[]).includes(key)) return b.transfers[key as TransferAccountId];
  return b.expenses[key as ExpenseId];
}

export function setBudgetValue(b: Budget, key: BudgetKey, v: number): Budget {
  if (key === 'livingBuffer') return { ...b, livingBuffer: v };
  if ((TRANSFER_ORDER as string[]).includes(key)) return { ...b, transfers: { ...b.transfers, [key]: v } };
  return { ...b, expenses: { ...b.expenses, [key]: v } };
}

export function budgetKeyLabel(key: BudgetKey): string {
  if (key === 'livingBuffer') return '생활비 여유분';
  if ((TRANSFER_ORDER as string[]).includes(key)) return ACCOUNTS[key as TransferAccountId].label;
  return EXPENSES[key as ExpenseId].label;
}

interface Group {
  id: string;
  title: string;
  hint: string;
  icon: ReactNode;
  keys: BudgetKey[];
}

const GROUPS: Group[] = [
  {
    id: 'transfers',
    title: '자동이체',
    hint: '월급날 먼저 빠져나가는 돈',
    icon: <CalendarClock size={16} aria-hidden />,
    keys: TRANSFER_ORDER,
  },
  {
    id: 'fixed',
    title: '고정비',
    hint: '매달 거의 같은 돈',
    icon: <Wallet size={16} aria-hidden />,
    keys: EXPENSE_ORDER.filter((id) => EXPENSES[id].group === 'fixed'),
  },
  {
    id: 'variable',
    title: '변동비',
    hint: '내가 조절할 수 있는 돈',
    icon: <ShoppingBasket size={16} aria-hidden />,
    keys: [...EXPENSE_ORDER.filter((id) => EXPENSES[id].group === 'variable'), 'livingBuffer'],
  },
];

/**
 * 가계부 편집기. 가계부 작성 화면과 시뮬레이션의 조정 단계에서 함께 쓴다.
 * 값은 부모가 들고 있고(제어 컴포넌트), 합계와 경고는 BudgetSummaryPanel이 보여 준다.
 */
export function BudgetEditor({
  budget,
  salary,
  onChange,
  reference,
  highlight = [],
  layout = 'columns',
}: {
  budget: Budget;
  salary: number;
  onChange: (b: Budget) => void;
  /** 비교 기준 (추천 가계부, 조정 전 가계부). 달라진 항목에 증감 표시 */
  reference?: Budget;
  /** 이벤트로 바뀐 항목 */
  highlight?: BudgetKey[];
  layout?: 'columns' | 'stack';
}) {
  const grid = layout === 'columns' ? 'grid gap-4 md:grid-cols-2 xl:grid-cols-3' : 'grid gap-4 md:grid-cols-2';
  return (
    <div className={grid}>
      {GROUPS.map((g) => (
        <fieldset key={g.id} className="card min-w-0 p-3.5">
          <legend className="sr-only">{g.title}</legend>
          <div className="mb-2 flex items-baseline justify-between gap-2 px-0.5">
            <h3 className="flex items-center gap-1.5 text-[15px] font-bold text-ink">
              <span className="text-ink-3">{g.icon}</span>
              {g.title}
            </h3>
            <span className="text-xs text-ink-3">{g.hint}</span>
          </div>
          <ul className="flex flex-col gap-1">
            {g.keys.map((key) => {
              const v = getValue(budget, key);
              const ref = reference ? getValue(reference, key) : undefined;
              const diff = ref === undefined ? 0 : v - ref;
              const isTransfer = (TRANSFER_ORDER as string[]).includes(key);
              const hot = highlight.includes(key);
              const sub =
                key === 'livingBuffer'
                  ? '쓰지 않으면 다음 달로 이월'
                  : isTransfer
                    ? `권장 ${ACCOUNTS[key as TransferAccountId].guide} · 지금 ${formatPct(salary > 0 ? v / salary : 0)}`
                    : EXPENSES[key as ExpenseId].example;
              return (
                <li
                  key={key}
                  className={`grid grid-cols-[minmax(0,1fr)_minmax(150px,176px)] items-center gap-2 rounded-xl px-1.5 py-1 ${hot ? 'bg-accent-soft ring-1 ring-accent' : ''}`}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    {isTransfer && <AccountIcon id={key as TransferAccountId} size="sm" />}
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-x-1.5 text-[15px] font-semibold leading-tight text-ink">
                        {budgetKeyLabel(key)}
                        {diff !== 0 && (
                          <span className={`num text-xs font-bold ${hot ? 'text-accent-ink' : 'text-primary'}`}>
                            {diff > 0 ? '+' : ''}
                            {formatMan(diff)}
                          </span>
                        )}
                      </div>
                      <div className="truncate text-xs text-ink-3">{hot ? '이번 일로 바뀐 항목' : sub}</div>
                    </div>
                  </div>
                  <MoneyStepper
                    size="sm"
                    label={budgetKeyLabel(key)}
                    value={v}
                    invalid={v < 0}
                    onChange={(nv) => onChange(setBudgetValue(budget, key, nv))}
                  />
                </li>
              );
            })}
          </ul>
        </fieldset>
      ))}
    </div>
  );
}
