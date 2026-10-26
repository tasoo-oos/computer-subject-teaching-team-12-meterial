import type { FundingSource } from '@gagyebu/core';
import { ACCOUNT_LOOK } from '../lib/accounts.tsx';

/** 계좌 아이콘 타일. 색만으로 구분하지 않도록 항상 아이콘을 함께 쓴다 */
export function AccountIcon({ id, size = 'md' }: { id: FundingSource; size?: 'sm' | 'md' | 'lg' }) {
  const look = ACCOUNT_LOOK[id];
  const box = size === 'lg' ? 'size-12 rounded-2xl' : size === 'sm' ? 'size-7 rounded-lg' : 'size-9 rounded-xl';
  const icon = size === 'lg' ? 26 : size === 'sm' ? 15 : 19;
  return (
    <span className={`inline-flex shrink-0 items-center justify-center ${box} ${look.soft} ${look.text}`} aria-hidden>
      <look.Icon size={icon} strokeWidth={2.2} />
    </span>
  );
}
