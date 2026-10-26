import { budgetIssues, budgetSummary, formatPct, formatWon, type Budget } from '@gagyebu/core';
import { CircleAlert, CircleCheck } from 'lucide-react';
import type { ReactNode } from 'react';
import { budgetKeyLabel } from './BudgetEditor.tsx';
import { AccountShareBar } from './AccountShareBar.tsx';
import { Money } from './Money.tsx';

/** 가계부 실시간 합계: 남은 금액, 저축률, 계좌별 비율, 확정 가능 여부 */
export function BudgetSummaryPanel({ budget, salary, children }: { budget: Budget; salary: number; children?: ReactNode }) {
  const s = budgetSummary(budget, salary);
  const issues = budgetIssues(budget, salary);
  const over = issues.find((i) => i.kind === 'over');
  const under = issues.find((i) => i.kind === 'under');
  const negatives = issues.filter((i) => i.kind === 'negative');
  const ok = issues.length === 0;

  return (
    <section className="card flex flex-col gap-4 p-4" aria-label="가계부 합계">
      <div>
        <div className="text-sm font-semibold text-ink-2">월급</div>
        <Money value={salary} className="text-2xl font-bold" />
      </div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
        <dt className="text-ink-2">자동이체 합계</dt>
        <dd className="text-right font-semibold">
          <Money value={s.transferTotal} />
        </dd>
        <dt className="text-ink-2">생활비 통장 입금</dt>
        <dd className="text-right font-semibold">
          <Money value={s.livingIn} />
        </dd>
        <dt className="pl-3 text-ink-3">ㄴ 고정비</dt>
        <dd className="text-right text-ink-2">
          <Money value={s.fixedTotal} />
        </dd>
        <dt className="pl-3 text-ink-3">ㄴ 변동비</dt>
        <dd className="text-right text-ink-2">
          <Money value={s.variableTotal} />
        </dd>
        <dt className="pl-3 text-ink-3">ㄴ 여유분</dt>
        <dd className="text-right text-ink-2">
          <Money value={budget.livingBuffer} />
        </dd>
        <dt className="text-ink-2">저축률</dt>
        <dd className="num text-right font-semibold">{formatPct(s.savingsRate)}</dd>
      </dl>

      <div
        role="status"
        aria-live="polite"
        className={`rounded-2xl border-2 p-3 ${ok ? 'border-up bg-up-soft' : over ? 'border-danger bg-danger-soft' : 'border-warn bg-warn-soft'}`}
      >
        <div className="flex items-center gap-2 text-sm font-bold">
          {ok ? <CircleCheck size={18} className="text-up" aria-hidden /> : <CircleAlert size={18} className={over ? 'text-danger' : 'text-warn'} aria-hidden />}
          <span className={ok ? 'text-up' : over ? 'text-danger' : 'text-warn'}>
            {ok ? '합계가 월급과 딱 맞아요' : over ? '월급보다 많이 배정했어요' : under ? '아직 배정하지 않은 돈이 있어요' : '고칠 항목이 있어요'}
          </span>
        </div>
        <div className="mt-1 flex items-baseline justify-between gap-2">
          <span className="text-sm text-ink-2">{over ? '초과' : '남은 금액'}</span>
          <Money value={over ? over.amount : s.remaining} className={`text-2xl font-bold ${ok ? 'text-up' : over ? 'text-danger' : 'text-warn'}`} />
        </div>
        {over && <p className="mt-1 text-sm text-ink-2">어느 항목을 줄일지 정해 합계를 맞추세요.</p>}
        {under && <p className="mt-1 text-sm text-ink-2">남은 돈을 자동이체나 여유분에 배정하세요.</p>}
        {negatives.map((n) => (n.kind === 'negative' ? <p key={n.key} className="mt-1 text-sm text-danger">{budgetKeyLabel(n.key)}이(가) 0원보다 작아요.</p> : null))}
      </div>

      <div>
        <div className="mb-2 text-sm font-semibold text-ink-2">계좌별 비율</div>
        <AccountShareBar shares={s.shares} />
      </div>
      {children}
    </section>
  );
}

/** 조정 단계용 압축 합계 바: 남은 금액과 확정 버튼이 항상 보인다 */
export function BudgetBalanceBar({ budget, salary, children }: { budget: Budget; salary: number; children?: ReactNode }) {
  const s = budgetSummary(budget, salary);
  const issues = budgetIssues(budget, salary);
  const over = issues.find((i) => i.kind === 'over');
  const under = issues.find((i) => i.kind === 'under');
  const ok = issues.length === 0;
  return (
    <section
      aria-label="가계부 합계"
      className={`sticky top-2 z-20 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl border-2 bg-surface px-3.5 py-2.5 shadow-[var(--shadow-lift)] ${ok ? 'border-up' : over ? 'border-danger' : 'border-warn'}`}
    >
      <div>
        <div className="text-[11px] font-semibold text-ink-3">월급</div>
        <Money value={salary} className="text-[15px] font-bold" />
      </div>
      <div>
        <div className="text-[11px] font-semibold text-ink-3">배정 합계</div>
        <Money value={s.transferTotal + s.livingIn} className="text-[15px] font-bold" />
      </div>
      <div>
        <div className="text-[11px] font-semibold text-ink-3">저축률</div>
        <div className="num text-[15px] font-bold">{formatPct(s.savingsRate)}</div>
      </div>
      <div aria-live="polite" className="min-w-[128px]">
        <div className="text-[11px] font-semibold text-ink-3">{over ? '초과' : ok ? '남은 금액' : '남은 금액'}</div>
        <div className={`num text-lg font-bold ${ok ? 'text-up' : over ? 'text-danger' : 'text-warn'}`}>
          {formatWon(over ? over.amount : s.remaining)}
        </div>
      </div>
      <div className="ml-auto flex items-center gap-3">
        <span className={`hidden text-[12px] font-semibold sm:block ${ok ? 'text-up' : over ? 'text-danger' : 'text-warn'}`}>
          {ok ? '합계가 맞았습니다' : over ? '초과분을 줄이세요' : under ? '남은 돈을 배정하세요' : '고칠 항목이 있어요'}
        </span>
        {children}
      </div>
    </section>
  );
}
