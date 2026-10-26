import { ACCOUNT_ORDER, formatPct, type AccountId } from '@gagyebu/core';
import { ACCOUNT_LOOK } from '../lib/meta.ts';

/** 계좌별 비율 막대. 6색 컷이 한 줄로 이어진다 */
export function ShareBar({ shares, height = 14, labels = true }: { shares: Record<AccountId, number>; height?: number; labels?: boolean }) {
  return (
    <div>
      <div className="flex gap-[2px] overflow-hidden rounded-[3px]" style={{ height }} role="img" aria-label={ACCOUNT_ORDER.map((id) => `${ACCOUNT_LOOK[id].short} ${formatPct(shares[id])}`).join(', ')}>
        {ACCOUNT_ORDER.map((id) =>
          shares[id] > 0 ? (
            <span key={id} className="h-full transition-[flex-grow] duration-200" style={{ flexGrow: shares[id], flexBasis: 0, background: ACCOUNT_LOOK[id].color }} />
          ) : null,
        )}
      </div>
      {labels && (
        <ul className="mt-2 grid grid-cols-3 gap-x-3 gap-y-1 text-xs">
          {ACCOUNT_ORDER.map((id) => (
            <li key={id} className="flex items-center gap-1.5">
              <span aria-hidden className="size-2 shrink-0 rounded-[2px]" style={{ background: ACCOUNT_LOOK[id].color }} />
              <span className="text-mute">{ACCOUNT_LOOK[id].short}</span>
              <span className="num ml-auto font-semibold">{formatPct(shares[id])}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
