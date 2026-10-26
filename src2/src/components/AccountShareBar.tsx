import { ACCOUNT_ORDER, ACCOUNTS, formatMan, formatPct, type AccountId } from '@gagyebu/core';
import { ACCOUNT_LOOK } from '../lib/accounts.tsx';

/** 계좌별 비율 막대 + 범례 */
export function AccountShareBar({
  shares,
  amounts,
  legend = true,
  height = 'h-4',
}: {
  shares: Record<AccountId, number>;
  amounts?: Record<AccountId, number>;
  legend?: boolean;
  height?: string;
}) {
  return (
    <div>
      <div className={`flex w-full overflow-hidden rounded-full bg-line ${height}`} role="img" aria-label={ACCOUNT_ORDER.map((id) => `${ACCOUNTS[id].label} ${formatPct(shares[id])}`).join(', ')}>
        {ACCOUNT_ORDER.map((id) =>
          shares[id] > 0 ? (
            <span
              key={id}
              className={`${ACCOUNT_LOOK[id].bg} h-full border-r-2 border-surface transition-[flex-grow] duration-300 last:border-r-0`}
              style={{ flexGrow: shares[id], flexBasis: 0 }}
            />
          ) : null,
        )}
      </div>
      {legend && (
        <ul className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1 text-[13px] sm:grid-cols-3">
          {ACCOUNT_ORDER.map((id) => {
            const L = ACCOUNT_LOOK[id];
            return (
              <li key={id} className="flex items-center gap-1.5 text-ink-2">
                <L.Icon size={14} className={L.text} aria-hidden strokeWidth={2.4} />
                <span>{L.short}</span>
                <span className="num ml-auto font-semibold text-ink">{formatPct(shares[id])}</span>
                {amounts && <span className="num sr-only">{formatMan(amounts[id])}</span>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
