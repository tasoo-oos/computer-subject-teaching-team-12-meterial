import type { ReactNode } from 'react';
import { CircleCheck, TriangleAlert } from 'lucide-react';
import {
  ACCOUNTS,
  EXPENSES,
  budgetIssues,
  budgetSummary,
  formatMan,
  formatPct,
  type Budget,
  type BudgetIssue,
  type Won,
} from '@gagyebu/core';
import { Money } from './Money.tsx';
import { RatioBar } from './RatioBar.tsx';

export function issueText(issue: BudgetIssue): string {
  switch (issue.kind) {
    case 'over':
      return `월급보다 ${formatMan(issue.amount)} 많이 나눴어요. 어느 항목을 줄일지 정하세요.`;
    case 'under':
      return `${formatMan(issue.amount)}이 아직 이름표 없이 남았어요. 남은 돈도 어느 통장에 둘지 정하세요.`;
    case 'negative': {
      const name =
        issue.key === 'livingBuffer'
          ? '생활비 여유분'
          : issue.key in EXPENSES
            ? EXPENSES[issue.key as keyof typeof EXPENSES].label
            : ACCOUNTS[issue.key as keyof typeof ACCOUNTS].label;
      return `${name}이 0원보다 적어요.`;
    }
  }
}

/** 가계부 실시간 합계: 월급, 나눈 돈, 남은 금액, 저축률, 계좌별 비율 */
export function BudgetTotals({ budget, salary, children }: { budget: Budget; salary: Won; children?: ReactNode }) {
  const s = budgetSummary(budget, salary);
  const issues = budgetIssues(budget, salary);
  const ok = issues.length === 0;
  return (
    <div className="rounded-panel bg-sheet p-4 shadow-[0_0_0_1px_var(--color-rule)] sm:p-5">
      <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-[15px]">
        <dt className="text-ink-2">월급</dt>
        <dd className="text-right">
          <Money value={salary} className="font-semibold" />
        </dd>
        <dt className="text-ink-2">자동이체 합계</dt>
        <dd className="text-right">
          <Money value={s.transferTotal} />
        </dd>
        <dt className="text-ink-2">생활비 통장 입금</dt>
        <dd className="text-right">
          <Money value={s.livingIn} />
        </dd>
        <dt className="pl-3 text-[13px] text-ink-3">고정비 / 변동비 / 여유분</dt>
        <dd className="num text-right text-[13px] text-ink-3">
          {formatMan(s.fixedTotal)} / {formatMan(s.variableTotal)} / {formatMan(budget.livingBuffer)}
        </dd>
      </dl>

      <div
        className={`mt-3 flex items-center justify-between gap-3 rounded-[8px] px-3 py-2.5 ${ok ? 'bg-in-soft' : 'bg-seal-soft'}`}
        aria-live="polite"
      >
        <span className={`flex items-center gap-1.5 font-semibold ${ok ? 'text-in' : 'text-seal'}`}>
          {ok ? <CircleCheck size={18} aria-hidden /> : <TriangleAlert size={18} aria-hidden />}
          {s.remaining === 0 ? '남은 금액' : s.remaining < 0 ? '초과한 금액' : '남은 금액'}
        </span>
        <span className={`num text-[26px] font-bold leading-none ${ok ? 'text-in' : 'text-seal'}`}>
          {s.remaining === 0 ? '0원' : formatMan(Math.abs(s.remaining))}
        </span>
      </div>
      {issues.length ? (
        <ul className="mt-2 space-y-1 text-[14px] text-seal">
          {issues.map((i, n) => (
            <li key={n}>{issueText(i)}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-[14px] text-ink-2">월급을 남김없이 나눴어요. 이대로 확정할 수 있어요.</p>
      )}

      <div className="mt-4 flex items-baseline justify-between">
        <h3 className="font-bold">통장별로 나눈 비율</h3>
        <p className="text-[14px] text-ink-2">
          저축률 <span className="num text-[17px] font-bold text-ink">{formatPct(s.savingsRate)}</span>
        </p>
      </div>
      <div className="mt-2">
        <RatioBar shares={s.shares} />
      </div>
      {children ? <div className="mt-4 flex flex-wrap gap-2">{children}</div> : null}
    </div>
  );
}


/** 조정 단계용 한 줄 요약. 편집기 위에 얹어 남은 금액만 크게 본다 */
export function InlineTotals({ budget, salary, children }: { budget: Budget; salary: Won; children?: ReactNode }) {
  const s = budgetSummary(budget, salary);
  const issues = budgetIssues(budget, salary);
  const ok = issues.length === 0;
  return (
    <div className="rounded-panel bg-sheet px-4 py-3 shadow-[0_0_0_1px_var(--color-rule)]">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <dl className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[13px]">
          <div className="flex items-baseline gap-1.5">
            <dt className="text-ink-2">월급</dt>
            <dd className="num font-semibold">{formatMan(salary)}</dd>
          </div>
          <div className="flex items-baseline gap-1.5">
            <dt className="text-ink-2">자동이체</dt>
            <dd className="num font-semibold">{formatMan(s.transferTotal)}</dd>
          </div>
          <div className="flex items-baseline gap-1.5">
            <dt className="text-ink-2">생활비 입금</dt>
            <dd className="num font-semibold">{formatMan(s.livingIn)}</dd>
          </div>
          <div className="flex items-baseline gap-1.5">
            <dt className="text-ink-2">저축률</dt>
            <dd className="num font-semibold">{formatPct(s.savingsRate)}</dd>
          </div>
        </dl>
        <p className={`ml-auto flex items-baseline gap-2 rounded-[6px] px-3 py-1 ${ok ? 'bg-in-soft' : 'bg-seal-soft'}`} aria-live="polite">
          <span className={`text-[13px] font-semibold ${ok ? 'text-in' : 'text-seal'}`}>{ok ? '남은 금액' : s.remaining < 0 ? '초과' : '아직 남은 돈'}</span>
          <span className={`num text-[22px] font-bold leading-none ${ok ? 'text-in' : 'text-seal'}`}>
            {s.remaining === 0 ? '0원' : formatMan(Math.abs(s.remaining))}
          </span>
        </p>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
        {ok ? <p className="text-[13px] text-ink-2">합계가 맞았습니다. 이대로 다음 달부터 적용됩니다.</p> : <p className="text-[13px] text-seal">{issueText(issues[0]!)}</p>}
        {children ? <div className="ml-auto flex items-center gap-2">{children}</div> : null}
      </div>
    </div>
  );
}
