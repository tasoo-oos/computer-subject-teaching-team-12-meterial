import { ACCOUNT_ORDER, ACCOUNTS, formatPct, type AccountId } from '@gagyebu/core';
import { ACCOUNT_COLOR, ACCOUNT_SHORT } from '../lib/accounts.ts';
import { CoverDot } from './Spine.tsx';

/** 계좌별 비율 막대. 월급을 통장 6권에 나눈 모양 */
export function RatioBar({
  shares,
  legend = true,
  height = 18,
}: {
  shares: Record<AccountId, number>;
  legend?: boolean;
  height?: number;
}) {
  return (
    <div>
      <div
        className="flex w-full overflow-hidden rounded-[4px] bg-rule-soft"
        style={{ height }}
        role="img"
        aria-label={ACCOUNT_ORDER.map((id) => `${ACCOUNTS[id].label} ${formatPct(shares[id])}`).join(', ')}
      >
        {ACCOUNT_ORDER.map((id) =>
          shares[id] > 0 ? (
            <span
              key={id}
              className="h-full transition-[width] duration-200 first:rounded-l-[4px] last:rounded-r-[4px]"
              style={{ width: `${shares[id] * 100}%`, background: ACCOUNT_COLOR[id], boxShadow: 'inset -1px 0 0 rgba(255,255,255,.7)' }}
            />
          ) : null,
        )}
      </div>
      {legend ? (
        <ul className="mt-2 grid grid-cols-3 gap-x-3 gap-y-1 text-[13px] sm:grid-cols-6">
          {ACCOUNT_ORDER.map((id) => (
            <li key={id} className="flex items-center gap-1.5">
              <CoverDot id={id} />
              <span className="text-ink-2">{ACCOUNT_SHORT[id]}</span>
              <span className="num ml-auto font-semibold sm:ml-0">{formatPct(shares[id])}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
