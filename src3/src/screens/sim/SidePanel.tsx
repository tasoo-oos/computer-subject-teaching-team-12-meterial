import { useState } from 'react';
import {
  ACCOUNTS,
  ACCOUNT_ORDER,
  STATUSES,
  creditGrade,
  describeScheduled,
  formatMan,
  formatWon,
  totalDebt,
  type GameState,
  type StatusInstance,
  type Won,
} from '@gagyebu/core';
import { ArrowRight, ShieldAlert, TrendingDown, TrendingUp, CalendarClock, Info } from 'lucide-react';
import { AccountMark, Button, Delta, Money, Tag } from '../../components/ui.tsx';
import { stamp } from '../../lib/meta.ts';

function monthDelta(state: GameState, id: (typeof ACCOUNT_ORDER)[number]): Won {
  const p = state.payday;
  if (id === 'living') {
    if (!p) return 0;
    return p.livingIn - p.spending - p.debtPayments;
  }
  if (!p) return 0;
  return (p.transfers[id] ?? 0) + (p.earnings[id] ?? 0);
}

export function SidePanel({ state, onSellSneakers }: { state: GameState; onSellSneakers: (s: StatusInstance) => void }) {
  const debt = totalDebt(state);
  const grade = creditGrade(state.credit);
  const short = typeof state.flags.livingShortfall === 'number' ? state.flags.livingShortfall : 0;

  return (
    <aside className="flex flex-col gap-2.5">
      <section className="cut p-4">
        <header className="flex items-baseline justify-between">
          <h2 className="text-[15px] font-bold">통장 {ACCOUNT_ORDER.length}개</h2>
          <span className="text-xs text-mute">{stamp(state.month)}</span>
        </header>
        <div className="mt-2 flex items-center justify-between text-[10px] font-semibold text-mute">
          <span>잔고</span>
          <span>이번 달 변화</span>
        </div>
        <ul className="mt-0.5 grid gap-0.5">
          {ACCOUNT_ORDER.map((id) => {
            const a = state.accounts[id];
            const d = monthDelta(state, id);
            return (
              <li key={id} className="flex items-center gap-2.5 rounded-[3px] py-1.5">
                <AccountMark id={id} size={26} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold">{ACCOUNTS[id].label}</p>
                  <p className="num truncate text-[13px] font-bold">{formatWon(a.balance)}</p>
                </div>
                <div className="text-right">
                  <Delta value={d} className="text-[12px]" />
                </div>
              </li>
            );
          })}
        </ul>
        {debt > 0 && (
          <div className="mt-3 border-t border-line pt-3">
            <div className="flex items-baseline justify-between">
              <p className="flex items-center gap-1.5 text-[13px] font-bold text-bad">
                <ShieldAlert size={14} aria-hidden /> 남은 부채
              </p>
              <Money value={debt} className="text-[13px] font-bold text-bad" />
            </div>
            <ul className="mt-1.5 grid gap-1">
              {state.debts.map((d) => (
                <li key={d.id} className="flex items-baseline justify-between gap-3 text-[11px] text-mute">
                  <span className="truncate">
                    {d.label}
                    {d.kind === 'revolving' ? ' · 연 18%' : d.monthsLeft > 0 ? ` · ${d.monthsLeft}개월 남음` : ''}
                  </span>
                  <span className="num shrink-0 font-semibold text-text">{formatMan(d.monthly)}/월</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {(state.statuses.length > 0 || state.scheduled.length > 0) && (
        <section className="cut p-4">
          <h2 className="text-[15px] font-bold">남아 있는 효과</h2>
          {state.statuses.length === 0 ? (
            <p className="mt-1.5 text-xs text-mute">지금은 남아 있는 효과가 없습니다.</p>
          ) : (
            <ul className="mt-2 grid gap-1.5">
              {state.statuses.map((st) => (
                <StatusRow key={`${st.id}-${st.since}`} st={st} month={state.month} onSell={onSellSneakers} />
              ))}
            </ul>
          )}

          {state.scheduled.length > 0 && (
            <div className="mt-3 border-t border-line pt-3">
              <p className="flex items-center gap-1.5 text-[12px] font-bold text-mute">
                <CalendarClock size={14} aria-hidden /> 예약된 장면
              </p>
              <ul className="mt-1.5 grid gap-1">
                {state.scheduled.map((s) => (
                  <li key={`${s.month}-${s.sceneId}`} className="text-[11px] leading-snug text-mute">
                    {describeScheduled(s)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {short > 0 && (
        <section className="rounded-[6px] bg-bad-soft p-4 text-bad">
          <p className="text-[13px] font-bold">생활비가 {formatMan(short)} 모자랐습니다</p>
          <p className="mt-1 text-xs leading-relaxed">부족분은 카드값으로 넘어갑니다. 다음 달 생활비에서 빠지고 만족도가 떨어집니다.</p>
        </section>
      )}

      <section className="cut-2 px-4 py-3">
        <div className="flex items-center justify-between text-[12px]">
          <span className="flex items-center gap-1.5 font-semibold text-mute">
            <Info size={13} aria-hidden /> 신용점수
          </span>
          <span className="num font-bold">
            {state.credit} <span className="font-medium text-mute">· {grade.label}</span>
          </span>
        </div>
        <p className="mt-1.5 text-[10px] leading-relaxed text-mute">금리와 수익률은 수업을 위한 가정값입니다. 실제 상품 조건과 다릅니다.</p>
      </section>
    </aside>
  );
}

function StatusRow({ st, month, onSell }: { st: StatusInstance; month: number; onSell: (s: StatusInstance) => void }) {
  const [open, setOpen] = useState(false);
  const def = STATUSES[st.id];
  const left = st.until ? Math.max(0, st.until - month) : null;
  const tone = def.tone === 'buff' ? 'good' : def.tone === 'debuff' ? 'bad' : 'ink';
  const Icon = def.tone === 'buff' ? TrendingUp : def.tone === 'debuff' ? TrendingDown : Info;
  return (
    <li className="rounded-[4px] bg-paper-2 px-2.5 py-2">
      <div className="flex items-start gap-2">
        <Icon size={14} className={`mt-0.5 shrink-0 ${def.tone === 'buff' ? 'text-good' : def.tone === 'debuff' ? 'text-bad' : 'text-mute'}`} aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[12px] font-semibold">{def.label}</span>
            <Tag tone={tone} className="!text-[10px]">
              {def.tone === 'buff' ? '이득' : def.tone === 'debuff' ? '부담' : '중립'}
              {left !== null ? ` · ${left}개월` : ''}
            </Tag>
          </div>
          <p className="mt-0.5 text-[11px] leading-snug text-mute">{st.note ?? def.description}</p>
        </div>
        {def.actions?.length ? (
          <Button size="sm" className="!min-h-9 shrink-0 !px-2 !text-[11px]" onClick={() => (open ? onSell(st) : setOpen(true))}>
            {open ? '팔기' : '팔까?'} <ArrowRight size={12} />
          </Button>
        ) : null}
      </div>
      {open && (
        <p className="mt-1.5 text-[11px] leading-snug text-mute">
          {st.note ?? ''} 수수료 10%를 뺀 금액이 입금됩니다. 넣을 통장은 다음 화면에서 고릅니다.
        </p>
      )}
    </li>
  );
}
