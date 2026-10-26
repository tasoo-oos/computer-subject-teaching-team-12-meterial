import { ACCOUNTS, type AccountId } from '@gagyebu/core';
import { ACCOUNT_LOOK } from '../lib/accounts.tsx';
import { AccountIcon } from './AccountBadge.tsx';
import { CountMoney, Money } from './Money.tsx';

/** 시뮬레이션의 계좌 카드: 잔고, 이번 달 변화, 보조 정보 */
export function AccountCard({
  id,
  balance,
  delta,
  from,
  extra,
  dim = false,
  duration = 900,
}: {
  id: AccountId;
  balance: number;
  delta?: number;
  from?: number;
  extra?: string;
  dim?: boolean;
  duration?: number;
}) {
  const look = ACCOUNT_LOOK[id];
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-line bg-surface p-3 shadow-[var(--shadow-card)] transition-opacity ${dim ? 'opacity-60' : ''}`}
    >
      <span className={`absolute inset-y-0 left-0 w-1 ${look.bg}`} aria-hidden />
      <div className="flex items-center gap-2">
        <AccountIcon id={id} size="sm" />
        <span className="truncate text-[13px] font-semibold text-ink-2">{ACCOUNTS[id].label}</span>
      </div>
      <div className="mt-1.5 text-[19px] leading-tight font-bold text-ink">
        {from !== undefined ? <CountMoney value={balance} from={from} duration={duration} /> : <Money value={balance} />}
      </div>
      <div className="mt-0.5 flex min-h-5 flex-wrap items-center gap-x-2 text-xs">
        {delta !== undefined && delta !== 0 && (
          <span className="font-semibold">
            <span className="sr-only">이번 달 변화 </span>
            <Money value={delta} short signed tone />
          </span>
        )}
        {delta === 0 && <span className="text-ink-3">변화 없음</span>}
        {extra && <span className="text-ink-3">{extra}</span>}
      </div>
    </div>
  );
}
