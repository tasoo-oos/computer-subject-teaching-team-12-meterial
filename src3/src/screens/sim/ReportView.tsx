import { ArrowRight, CalendarClock, TrendingDown, TrendingUp } from 'lucide-react';
import {
  ACCOUNTS,
  ACCOUNT_ORDER,
  EVENT_TYPE_LABEL,
  SCHEDULE,
  EVENTS,
  STATUSES,
  formatMan,
  formatSignedWon,
  formatWon,
  monthKind,
  netWorth,
  type AccountId,
  type GameState,
} from '@gagyebu/core';
import { AccountMark, Button, Delta, Money, Tag } from '../../components/ui.tsx';

/** 이벤트 없는 달의 월말 리포트 (이벤트가 있어도 리포트는 같은 형식) */
export function ReportView({ state, onNext, nextLabel }: { state: GameState; onNext: () => void; nextLabel: string }) {
  const p = state.payday;
  const prev = state.history.at(-1);
  const now = netWorth(state);
  const change = prev ? now - prev.netWorth : now;
  const earnings = Object.entries(p?.earnings ?? {}) as [AccountId, number][];
  const earnTotal = earnings.reduce((a, [, v]) => a + v, 0);
  const short = p?.livingShortfall ?? 0;
  const nextMonth = state.month + 1;
  const nextEvent = SCHEDULE[nextMonth] ? EVENTS[SCHEDULE[nextMonth]!] : null;
  const quiet = monthKind(state.month) === 'quiet';

  return (
    <section className="cut flex flex-1 flex-col p-4" aria-labelledby="report-title">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-[11px] font-bold text-mute">월말 리포트 · 1년 차 · {String(state.month).padStart(2, '0')}월</p>
          <h1 id="report-title" className="mt-0.5 text-[20px] font-bold tracking-[-0.015em]">
            {state.month}월, 한 달을 정리합니다
          </h1>
          <p className="mt-0.5 text-[12px] text-mute">
            {quiet ? '이벤트가 없는 달이라 돈이 쌓이는 것만 지켜봤습니다.' : '선택의 결과가 잔고에 남았습니다.'}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[11px] text-mute">순자산</p>
          <p className="num text-[26px] leading-tight font-extrabold tracking-[-0.02em]">{formatWon(now)}</p>
          <Delta value={change} />
        </div>
      </div>

      <div className="mt-3 grid gap-2.5 lg:grid-cols-[1.15fr_0.9fr_0.9fr]">
        <div className="rounded-[4px] bg-paper-2 p-3">
          <p className="text-[11px] font-bold text-mute">이번 달 현금 흐름</p>
          <dl className="mt-1.5 grid grid-cols-[1fr_auto] gap-y-1 text-[12px]">
            <dt className="text-mute">월급</dt>
            <dd className="num font-semibold">{formatWon(p?.salary ?? 0)}</dd>
            <dt className="text-mute">자동이체로 나간 돈</dt>
            <dd className="num">{formatSignedWon(-(p ? Object.values(p.transfers).reduce((a, b) => a + b, 0) : 0))}</dd>
            <dt className="text-mute">생활비 지출</dt>
            <dd className="num">{formatSignedWon(-(p?.spending ?? 0))}</dd>
            <dt className="text-mute">부채 상환</dt>
            <dd className="num">{formatSignedWon(-(p?.debtPayments ?? 0))}</dd>
            <dt className="text-mute">이자 · 수익</dt>
            <dd className={`num font-semibold ${earnTotal >= 0 ? 'text-good' : 'text-bad'}`}>{formatSignedWon(earnTotal)}</dd>
            <dt className="mt-1 border-t border-line pt-1 font-semibold">생활비 통장 잔고</dt>
            <dd className="mt-1 border-t border-line pt-1">
              <Money value={state.accounts.living.balance} className="font-bold" />
            </dd>
          </dl>
        </div>

        <div className="rounded-[4px] bg-paper-2 p-3">
          <p className="text-[11px] font-bold text-mute">이자 · 수익</p>
          <ul className="mt-1.5 grid gap-1">
            {earnings.length === 0 && <li className="text-[12px] text-mute">이번 달 붙은 이자는 없습니다.</li>}
            {earnings.map(([id, v]) => (
              <li key={id} className="flex items-center gap-2">
                <AccountMark id={id} size={18} />
                <span className="text-[11px] text-mute">{ACCOUNTS[id].label}</span>
                <span className={`num ml-auto text-[12px] font-semibold ${v >= 0 ? 'text-good' : 'text-bad'}`}>{formatSignedWon(v)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[10px] leading-relaxed text-mute">학습용 가정 금리·수익률이 적용됩니다.</p>
        </div>

        <div className="rounded-[4px] bg-paper-2 p-3">
          <p className="text-[11px] font-bold text-mute">남아 있는 효과</p>
          {state.statuses.length === 0 ? (
            <p className="mt-1.5 text-[12px] text-mute">없음</p>
          ) : (
            <ul className="mt-1.5 grid gap-1">
              {state.statuses.map((st) => {
                const def = STATUSES[st.id];
                const Icon = def.tone === 'buff' ? TrendingUp : TrendingDown;
                return (
                  <li key={`${st.id}-${st.since}`} className="flex items-center gap-1.5 text-[11px]">
                    <Icon size={12} className={def.tone === 'debuff' ? 'text-bad' : def.tone === 'buff' ? 'text-good' : 'text-mute'} aria-hidden />
                    <span className="truncate">{def.label}</span>
                    <Tag tone="line" className="ml-auto !text-[10px]">
                      {st.until ? `${Math.max(0, st.until - state.month)}개월` : '계속'}
                    </Tag>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <div className="mt-2.5">
        <p className="text-[11px] font-bold text-mute">통장별 이번 달</p>
        <ul className="mt-1.5 grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-6">
          {ACCOUNT_ORDER.map((id) => {
            const d =
              id === 'living'
                ? (p?.livingIn ?? 0) - (p?.spending ?? 0) - (p?.debtPayments ?? 0)
                : (p?.transfers[id] ?? 0) + (p?.earnings[id] ?? 0);
            return (
              <li key={id} className="rounded-[4px] border border-line px-2.5 py-2">
                <div className="flex items-center gap-1.5">
                  <AccountMark id={id} size={18} />
                  <span className="text-[11px] font-semibold text-mute">{ACCOUNTS[id].label.replace(/ ?(통장|계좌)$/, '')}</span>
                </div>
                <p className="num mt-1 text-[13px] font-bold">{formatWon(state.accounts[id].balance)}</p>
                <Delta value={d} className="text-[11px]" />
              </li>
            );
          })}
        </ul>
      </div>

      {short > 0 && (
        <p className="mt-2.5 flex flex-wrap gap-x-2 rounded-[4px] bg-bad-soft px-3 py-2 text-[12px] leading-snug text-bad">
          <span className="font-bold">생활비 부족</span> 이번 달 생활비가 {formatMan(short)} 모자라 카드값으로 넘어갔습니다. 다음 달 생활비에서 빠지고 만족도가 떨어집니다.
        </p>
      )}

      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
        <p className="flex flex-wrap items-center gap-1.5 text-[11px] text-mute">
          <CalendarClock size={13} aria-hidden />
          {nextEvent ? (
            <>
              다음 달 · <Tag tone="line">{EVENT_TYPE_LABEL[nextEvent.type]}</Tag> {nextEvent.code} {nextEvent.title}
            </>
          ) : nextMonth === 12 ? (
            '다음 달은 12월 결산입니다. 마지막 월급과 적금 만기를 받습니다.'
          ) : (
            '다음 달은 이벤트가 없는 달입니다.'
          )}
        </p>
        <Button variant="plate" onClick={onNext}>
          {nextLabel} <ArrowRight size={16} />
        </Button>
      </div>
    </section>
  );
}
