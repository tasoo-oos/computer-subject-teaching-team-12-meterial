import type { AccountId } from '@gagyebu/core';
import { ACCOUNT_COLOR } from '../lib/accounts.ts';

/** 통장 표지 색 띠. 계좌를 알아보는 공통 표시 */
export function Spine({ id, className = '' }: { id: AccountId; className?: string }) {
  return <span aria-hidden className={`spine ${className}`} style={{ background: ACCOUNT_COLOR[id] }} />;
}

/** 작은 통장 표지 (계좌 6종 시각화, 범례) */
export function CoverDot({ id, size = 12 }: { id: AccountId; size?: number }) {
  return (
    <span
      aria-hidden
      className="inline-block flex-none rounded-[2px]"
      style={{ width: size * 0.78, height: size, background: ACCOUNT_COLOR[id] }}
    />
  );
}
