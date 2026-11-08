// 가계부 활동 통제 패널 — 2단계(Phase 2)에서 구현한다. 지금은 계약을 채우는 자리표시.
import type { ControlPanelProps } from '../registry.ts';
import type { GameState } from '@gagyebu/core';
import type { GagyebuStats } from '@gagyebu/activity-gagyebu';

export function ControlPanel({ beat }: ControlPanelProps<GameState, GagyebuStats>) {
  return (
    <div className="rounded-panel bg-sheet px-4 py-3 shadow-[0_0_0_1px_var(--color-rule)]">
      <p className="text-[13px] font-bold text-ink-2">가계부 패널 준비 중</p>
      <p className="mt-1 text-[13px] text-ink-3">비트 {beat.label}({beat.id})의 추가 정보 패널은 곧 준비됩니다.</p>
    </div>
  );
}
