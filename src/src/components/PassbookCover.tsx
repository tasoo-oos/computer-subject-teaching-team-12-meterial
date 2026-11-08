import type { ReactNode } from 'react';
import { ACCOUNTS, type AccountId } from '@gagyebu/core';
import { ACCOUNT_COLOR, ACCOUNT_ON } from '../lib/accounts.ts';

/** 통장 표지 한 권. 계좌 6종 시각화의 기본 단위 */
export function PassbookCover({ id, children, compact = false }: { id: AccountId; children?: ReactNode; compact?: boolean }) {
  const meta = ACCOUNTS[id];
  return (
    <div
      className="relative flex flex-col overflow-hidden rounded-cover p-3 shadow-[0_1px_0_rgba(0,0,0,.15),0_8px_16px_-10px_rgba(24,38,74,.5)]"
      style={{ background: ACCOUNT_COLOR[id], color: ACCOUNT_ON[id], minHeight: compact ? 0 : 168 }}
    >
      {/* 통장 표지의 세로 괘선 */}
      <span aria-hidden className="absolute inset-y-0 left-2 w-px bg-current opacity-25" />
      <p className="min-h-[2.2em] pl-2 text-[12px] font-medium leading-snug opacity-90">{meta.product}</p>
      <p className="display mt-1 pl-2 text-[21px]">{meta.label}</p>
      <div className="mt-auto pt-6 pl-2">{children}</div>
    </div>
  );
}
