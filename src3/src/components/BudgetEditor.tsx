import type { ReactNode } from 'react';
import { Check, Copy, Minus, Plus, RotateCcw, TriangleAlert } from 'lucide-react';
import {
  ACCOUNTS,
  EXPENSES,
  EXPENSE_ORDER,
  TRANSFER_ORDER,
  budgetIssues,
  budgetSummary,
  formatMan,
  formatPct,
  formatWon,
  type Budget,
  type BudgetIssue,
  type ExpenseId,
  type TransferAccountId,
} from '@gagyebu/core';
import { useCopy } from '../lib/hooks.ts';
import { AccountMark, Button, Money } from './ui.tsx';
import { ShareBar } from './ShareBar.tsx';

const STEP = 10_000;

type Key = TransferAccountId | ExpenseId | 'livingBuffer';

function labelOf(key: Key): string {
  if (key === 'livingBuffer') return '생활비 여유분';
  if (key in EXPENSES) return EXPENSES[key as ExpenseId].label;
  return ACCOUNTS[key as TransferAccountId].label;
}

export function issueText(issue: BudgetIssue): string {
  if (issue.kind === 'over') return `월급보다 ${formatWon(issue.amount)} 많이 나눴습니다. 그만큼 줄여 주세요.`;
  if (issue.kind === 'under') return `${formatWon(issue.amount)}이 아직 어느 통장에도 배정되지 않았습니다.`;
  return `${labelOf(issue.key)} 금액이 0원보다 작습니다.`;
}

function get(b: Budget, key: Key): number {
  if (key === 'livingBuffer') return b.livingBuffer;
  if (key in b.expenses) return b.expenses[key as ExpenseId];
  return b.transfers[key as TransferAccountId];
}
function set(b: Budget, key: Key, v: number): Budget {
  if (key === 'livingBuffer') return { ...b, livingBuffer: v };
  if (key in b.expenses) return { ...b, expenses: { ...b.expenses, [key]: v } };
  return { ...b, transfers: { ...b.transfers, [key]: v } };
}

/** 1만 원 단위 스테퍼 + 직접 입력 (만 원) */
export function Stepper({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  const man = Math.round((value / 10_000) * 10) / 10;
  return (
    <div className="flex items-stretch rounded-[5px] border border-line-strong bg-paper focus-within:border-ink">
      <button
        type="button"
        aria-label={`${label} 1만 원 줄이기`}
        onClick={() => onChange(Math.max(0, value - STEP))}
        disabled={value <= 0}
        className="flex w-11 items-center justify-center text-mute hover:bg-paper-2 hover:text-text disabled:opacity-40"
      >
        <Minus size={16} />
      </button>
      <label className="flex min-w-0 flex-1 items-center border-x border-line px-2">
        <input
          type="number"
          inputMode="decimal"
          step={1}
          min={0}
          value={man}
          aria-label={`${label} (만 원)`}
          onChange={(e) => {
            const n = Number.parseFloat(e.target.value);
            onChange(Number.isFinite(n) ? Math.max(0, Math.round(n * 10) * 1_000) : 0);
          }}
          className="num h-11 w-full min-w-0 bg-transparent text-right text-[15px] font-semibold focus:outline-none"
        />
        <span className="ml-1 shrink-0 text-xs text-mute">만 원</span>
      </label>
      <button
        type="button"
        aria-label={`${label} 1만 원 늘리기`}
        onClick={() => onChange(value + STEP)}
        className="flex w-11 items-center justify-center text-mute hover:bg-paper-2 hover:text-text"
      >
        <Plus size={16} />
      </button>
    </div>
  );
}

function Row({
  k,
  budget,
  before,
  onChange,
  mark,
  sub,
}: {
  k: Key;
  budget: Budget;
  before?: Budget;
  onChange: (b: Budget) => void;
  mark?: ReactNode;
  sub?: string;
}) {
  const v = get(budget, k);
  const diff = before ? v - get(before, k) : 0;
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_164px] items-center gap-2 py-1.5">
      <div className="flex min-w-0 items-center gap-2.5">
        {mark}
        <div className="min-w-0">
          <p className="text-[14px] leading-tight font-semibold">{labelOf(k)}</p>
          {(sub || diff !== 0) && (
            <p className="text-[11px] leading-snug text-mute">
              {diff !== 0 ? (
                <span className={`num font-semibold ${diff > 0 ? 'text-warn' : 'text-text'}`}>
                  처음 {formatMan(get(before!, k))} → {diff > 0 ? '+' : ''}
                  {formatMan(diff)}
                </span>
              ) : (
                sub
              )}
            </p>
          )}
        </div>
      </div>
      <Stepper value={v} label={labelOf(k)} onChange={(nv) => onChange(set(budget, k, nv))} />
    </li>
  );
}

function Group({ title, total, children, note }: { title: string; total: number; children: ReactNode; note?: string }) {
  return (
    <section>
      <header className="flex items-baseline justify-between border-b border-line pb-2">
        <h3 className="text-[15px] font-bold">{title}</h3>
        <Money value={total} className="text-sm font-semibold text-mute" />
      </header>
      {note && <p className="mt-2 text-xs leading-relaxed text-mute">{note}</p>}
      <ul className="mt-1">{children}</ul>
    </section>
  );
}

export interface BudgetEditorProps {
  budget: Budget;
  salary: number;
  onChange: (b: Budget) => void;
  /** 비교 기준 (조정 단계에서 바뀌기 전 가계부) */
  before?: Budget;
  /** 되돌리기 값 */
  resetTo?: Budget;
  resetLabel?: string;
  promptText?: string;
  confirmLabel: string;
  onConfirm: () => void;
}

/** 가계부 편집기. 가계부 작성 화면과 시뮬레이션 조정 단계에서 함께 쓴다 */
export function BudgetEditor({ budget, salary, onChange, before, resetTo, resetLabel = '추천값으로 되돌리기', promptText, confirmLabel, onConfirm }: BudgetEditorProps) {
  const sum = budgetSummary(budget, salary);
  const issues = budgetIssues(budget, salary);
  const valid = issues.length === 0;
  const [copied, copy] = useCopy();
  const fixed = EXPENSE_ORDER.filter((id) => EXPENSES[id].group === 'fixed');
  const variable = EXPENSE_ORDER.filter((id) => EXPENSES[id].group === 'variable');
  const over = sum.remaining < 0;

  return (
    <div className="grid gap-2.5 xl:grid-cols-[1fr_1fr_336px] lg:grid-cols-[1fr_1fr]">
      <div className="cut flex flex-col gap-6 p-5">
        <Group title="월급날 자동이체" total={sum.transferTotal} note="월급이 들어오면 먼저 떼어 각 통장으로 보냅니다.">
          {TRANSFER_ORDER.map((id) => (
            <Row key={id} k={id} budget={budget} before={before} onChange={onChange} mark={<AccountMark id={id} />} sub={`권장 ${ACCOUNTS[id].guide.split(' (')[0]}`} />
          ))}
        </Group>
        <Group title="생활비 통장 여유분" total={budget.livingBuffer} note="쓰고 남으면 다음 달로 넘어갑니다. 갑자기 오른 지출을 받아 줍니다.">
          <Row k="livingBuffer" budget={budget} before={before} onChange={onChange} mark={<AccountMark id="living" />} sub="예산 밖 여유" />
        </Group>
      </div>

      <div className="cut flex flex-col gap-6 p-5">
        <Group title="고정비" total={sum.fixedTotal}>
          {fixed.map((id) => (
            <Row key={id} k={id} budget={budget} before={before} onChange={onChange} sub={EXPENSES[id].example} />
          ))}
        </Group>
        <Group title="변동비" total={sum.variableTotal}>
          {variable.map((id) => (
            <Row key={id} k={id} budget={budget} before={before} onChange={onChange} sub={EXPENSES[id].example} />
          ))}
        </Group>
      </div>

      <aside className="cut flex flex-col gap-5 p-5 lg:col-span-2 xl:col-span-1" aria-live="polite">
        <dl className="grid grid-cols-[1fr_auto] gap-y-1.5 text-sm">
          <dt className="text-mute">월급</dt>
          <dd><Money value={salary} className="font-semibold" /></dd>
          <dt className="text-mute">자동이체 합계</dt>
          <dd><Money value={sum.transferTotal} /></dd>
          <dt className="text-mute">생활비 통장 입금 (지출 + 여유분)</dt>
          <dd><Money value={sum.livingIn} /></dd>
          <dt className="text-mute">저축률</dt>
          <dd className="num font-semibold">{formatPct(sum.savingsRate)}</dd>
        </dl>

        <div className={`rounded-[5px] px-4 py-3 ${valid ? 'bg-paper-2' : over ? 'bg-bad-soft' : 'bg-warn-soft'}`}>
          <p className={`text-sm font-semibold ${valid ? 'text-mute' : over ? 'text-bad' : 'text-warn'}`}>
            {valid ? '남은 금액' : over ? '초과한 금액' : '아직 남은 금액'}
          </p>
          <p className={`num mt-0.5 text-[30px] leading-tight font-extrabold tracking-[-0.02em] ${valid ? 'text-text' : over ? 'text-bad' : 'text-warn'}`}>
            {formatWon(Math.abs(sum.remaining))}
          </p>
          {issues.map((it, i) => (
            <p key={i} className={`mt-1.5 flex gap-1.5 text-sm leading-snug ${it.kind === 'over' || it.kind === 'negative' ? 'text-bad' : 'text-warn'}`}>
              <TriangleAlert size={16} className="mt-0.5 shrink-0" aria-hidden />
              {issueText(it)}
            </p>
          ))}
          {valid && (
            <p className="mt-1.5 flex items-center gap-1.5 text-sm text-text">
              <Check size={16} aria-hidden /> 월급을 빈틈없이 나눴습니다.
            </p>
          )}
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold">통장별 비율</p>
          <ShareBar shares={sum.shares} />
        </div>

        <div className="mt-auto flex flex-col gap-2">
          <Button variant="plate" size="lg" disabled={!valid} onClick={onConfirm} aria-describedby={valid ? undefined : 'budget-why'}>
            {confirmLabel}
          </Button>
          {!valid && (
            <p id="budget-why" className="text-center text-xs text-mute">
              합계가 월급과 같아야 확정할 수 있습니다.
            </p>
          )}
          <div className="grid grid-cols-2 gap-2">
            {resetTo && (
              <Button size="sm" onClick={() => onChange(structuredClone(resetTo))}>
                <RotateCcw size={15} /> {resetLabel}
              </Button>
            )}
            {promptText && (
              <Button size="sm" onClick={() => copy(promptText)} aria-live="polite" className={resetTo ? '' : 'col-span-2'}>
                {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? '복사했어요' : 'AI에게 물어보기'}
              </Button>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}

