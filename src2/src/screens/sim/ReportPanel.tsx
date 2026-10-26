import { formatWon, monthLabel, netWorth, totalDebt, creditGrade, type GameState } from '@gagyebu/core';
import { ArrowRight, ChartLine, CircleAlert, Coins, ReceiptText, Wallet } from 'lucide-react';
import { Button } from '../../components/ui.tsx';
import { Money } from '../../components/Money.tsx';

/** 월말 리포트: 수입·지출·이자, 순자산 변화, 부족 경고, 다음 달 */
export function ReportPanel({ state, onNext }: { state: GameState; onNext: () => void }) {
  const p = state.payday;
  const prev = state.history.at(-1);
  const worth = netWorth(state);
  const worthDiff = prev ? worth - prev.netWorth : worth;
  const earnings = Object.values(p?.earnings ?? {}).reduce((a, b) => a + (b ?? 0), 0);
  const spend = (p?.spending ?? 0) + (p?.debtPayments ?? 0);
  const grade = creditGrade(state.credit);
  const creditDiff = prev ? state.credit - prev.credit : 0;

  return (
    <section className="animate-enter">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-xs font-semibold tracking-wide text-primary">월말 리포트</p>
          <h1 className="text-[clamp(1.4rem,2.6vw,1.85rem)] font-bold tracking-tight text-ink">
            {monthLabel(state.month)}을 마무리합니다
          </h1>
        </div>
        <p className="text-sm text-ink-2">이번 달은 예정된 장면이 없는 달이었습니다</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Tile icon={<ReceiptText size={16} aria-hidden />} label="수입" value={p?.salary ?? 0} tone="up" />
        <Tile icon={<Wallet size={16} aria-hidden />} label="지출" value={-spend} tone="ink" />
        <Tile icon={<Coins size={16} aria-hidden />} label="이자 · 수익" value={earnings} tone="up" />
      </div>

      <div className="card mt-3 p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="flex items-center gap-1.5 text-sm font-bold text-ink-2">
            <ChartLine size={15} aria-hidden /> 순자산 변화
          </h2>
          <span className="text-[11px] text-ink-3">{prev ? `${monthLabel(prev.month)} 말 ${formatWon(prev.netWorth)}` : '시작 0원'}</span>
        </div>
        <div className="mt-1 flex flex-wrap items-baseline gap-2">
          <Money value={worth} className="text-3xl font-bold text-ink" />
          <Money value={worthDiff} signed tone className="text-[15px] font-bold" />
        </div>
        <div className="mt-2 flex flex-wrap gap-2 text-[12px]">
          <span className="rounded-lg bg-surface-2 px-2 py-1">
            남은 부채 <Money value={totalDebt(state)} className="font-bold" />
          </span>
          <span className="rounded-lg bg-surface-2 px-2 py-1">
            신용점수 <span className="num font-bold">{state.credit}</span> {grade.label}
            {creditDiff !== 0 && <span className={creditDiff < 0 ? 'text-danger' : 'text-up'}> ({creditDiff > 0 ? '+' : ''}{creditDiff})</span>}
          </span>
          <span className="rounded-lg bg-surface-2 px-2 py-1">
            생활비 여유분 <Money value={state.accounts.living.balance} className="font-bold" />
          </span>
        </div>
      </div>

      {p && p.livingShortfall > 0 && (
        <div className="mt-3 rounded-2xl border-2 border-danger/40 bg-danger-soft p-3.5">
          <div className="flex items-center gap-1.5 text-[13px] font-bold text-danger">
            <CircleAlert size={16} aria-hidden /> 생활비가 바닥났습니다
          </div>
          <p className="num mt-1 text-[13px] leading-relaxed text-ink">
            이번 달 생활비가 {formatWon(p.livingShortfall)} 모자라 카드값으로 넘어갔습니다. 다음 달 생활비에서 빠지고, 만족도가 떨어집니다.
          </p>
          <p className="mt-1 text-[12px] text-ink-2">가계부의 변동비나 여유분을 다시 확인해 보세요.</p>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[12px] text-ink-3">지속 효과와 계좌 잔고는 오른쪽에서 계속 확인할 수 있습니다.</p>
        <Button size="lg" onClick={onNext}>
          {state.month >= 11 ? '12월 결산 보기' : '다음 달로'} <ArrowRight size={18} aria-hidden />
        </Button>
      </div>
    </section>
  );
}

function Tile({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone: 'up' | 'ink' }) {
  return (
    <div className="card p-3.5">
      <div className="flex items-center gap-1.5 text-[12px] font-semibold text-ink-3">
        {icon}
        {label}
      </div>
      <div className={`mt-1 text-xl font-bold ${tone === 'up' ? 'text-up' : 'text-ink'}`}>
        <Money value={value} signed={tone === 'up'} />
      </div>
    </div>
  );
}
