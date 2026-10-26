import { TRANSFER_ORDER, ACCOUNTS, formatMan, formatWon, type GameState } from '@gagyebu/core';
import { useSequence } from '../../lib/motion.ts';
import { Money } from '../Money.tsx';
import { Spine } from '../Spine.tsx';

/** 월급날: 통장에 거래가 한 줄씩 인쇄된다 */
export function PaydayStage({ state, onNext, step }: { state: GameState; onNext: () => void; step: string }) {
  const p = state.payday;
  const lines: { label: string; sub?: string; amount: number; tone?: 'in' | 'out' }[] = p
    ? [
        { label: '월급 입금', sub: '회사 → 생활비 통장', amount: p.salary, tone: 'in' },
        ...TRANSFER_ORDER.map((id) => ({ label: `자동이체 → ${ACCOUNTS[id].label}`, amount: p.transfers[id], tone: 'out' as const })),
        { label: '생활비 입금', sub: '지출 예산 + 여유분', amount: p.livingIn, tone: 'in' },
        {
          label: '생활비 지출',
          sub: p.debtPayments > 0 ? `예산 집행 + 할부·카드값 ${formatMan(p.debtPayments)}` : '예산만큼 카드·현금으로 나감',
          amount: -(p.spending + p.debtPayments),
          tone: 'out',
        },
        ...Object.entries(p.earnings).map(([id, v]) => ({
          label: `${ACCOUNTS[id as keyof typeof ACCOUNTS].label} 이자·수익`,
          sub: id === 'invest' ? `이번 달 수익률 ${(p.investReturnPct * 100).toFixed(0)}%` : '학습용 가정 금리',
          amount: v ?? 0,
          tone: 'in' as const,
        })),
      ]
    : [];
  const [shown] = useSequence(lines.length, 380, 200);
  return (
    <div className="grid gap-4">
      <section className="sheet-in overflow-hidden rounded-panel bg-sheet shadow-[0_0_0_1px_var(--color-rule)]" aria-labelledby="payday-title">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-ink px-5 py-3">
          <div>
            <p className="text-[12px] font-semibold text-ink-2">{state.month}월 월급날</p>
            <h2 id="payday-title" className="display text-[26px]">
              통장에 돈이 들어왔습니다
            </h2>
          </div>
          <p className="num text-right text-[28px] font-bold leading-none text-in">+{formatMan(p?.salary ?? 0)}</p>
        </header>
        <table className="w-full text-[14px]">
          <caption className="sr-only">월급날 거래 내역</caption>
          <thead>
            <tr className="border-b border-rule text-left text-[12px] text-ink-3">
              <th scope="col" className="py-1.5 pl-5 font-medium">적요</th>
              <th scope="col" className="py-1.5 pr-5 text-right font-medium">금액</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={l.label} className={`ledger-row ${i < shown ? 'print-in' : 'opacity-0'}`}>
                <td className="py-2 pl-5">
                  <span className="font-medium">{l.label}</span>
                  {l.sub ? <span className="ml-2 text-[12px] text-ink-3">{l.sub}</span> : null}
                </td>
                <td className="py-2 pr-5 text-right">
                  <Money value={l.amount} signed className="font-semibold" />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className="py-2.5 pl-5 text-[13px] font-semibold text-ink-2">생활비 통장 잔액</td>
              <td className="py-2.5 pr-5 text-right">
                <Money value={state.accounts.living.balance} className="text-[16px] font-bold" />
              </td>
            </tr>
          </tfoot>
        </table>
      </section>
      {step === 'payday' && state.month === 1 ? <TutorialNote onNext={onNext} /> : null}
      {state.month !== 1 ? (
        <div className="flex justify-end">
          <button type="button" onClick={onNext} className="btn btn-primary px-6">
            이번 달 시작하기
          </button>
        </div>
      ) : null}
    </div>
  );
}

function TutorialNote({ onNext }: { onNext: () => void }) {
  return (
    <section className="rounded-panel bg-ink p-4 text-white sm:p-5" aria-labelledby="tutorial-title">
      <h3 id="tutorial-title" className="display text-[21px]">
        1월은 연습입니다
      </h3>
      <p className="mt-1 text-[14px] leading-relaxed text-white/85">
        월급이 들어오면 자동이체가 먼저 돈을 나눠 두고, 생활비 통장에 남은 돈으로 한 달을 삽니다. 이 순서만 기억하면 됩니다. 2월부터는
        예상하지 못한 일이 생깁니다.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="button" onClick={onNext} className="btn bg-white px-5 text-ink hover:bg-mark">
          2월로 넘어가기
        </button>
        <p className="text-[12px] text-white/70">금리와 수익률은 수업을 위한 가정값입니다.</p>
      </div>
    </section>
  );
}

/** 통장 6권 미리보기 (월급날 강조용) */
export function AccountRise({ state, highlight }: { state: GameState; highlight?: string[] }) {
  return (
    <ul className="grid grid-cols-3 gap-2">
      {(['emergency', 'savings', 'invest'] as const).map((id) => (
        <li key={id} className="rounded-[8px] bg-sheet px-2.5 py-2 shadow-[0_0_0_1px_var(--color-rule)]">
          <p className="flex items-center gap-1.5 text-[12px] text-ink-2">
            <Spine id={id} className="h-4" />
            {ACCOUNTS[id].label}
          </p>
          <Money value={state.accounts[id].balance} unit="man" className={`block text-[15px] font-bold ${highlight?.includes(id) ? 'text-in' : ''}`} />
        </li>
      ))}
    </ul>
  );
}

export function won(n: number) {
  return formatWon(n);
}
