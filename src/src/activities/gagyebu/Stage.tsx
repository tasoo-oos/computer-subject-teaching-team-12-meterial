// 가계부 활동 전면(TV) 화면 — 2단계(Phase 2)에서 S6의 재사용 부품(StageFrame 등)으로 구현한다.
// 지금은 등록 계약(ActivityViews.Stage)을 채우는 자리표시: 비트 라벨과 준비 중 안내만 보여 준다.
import type { StageProps } from '../registry.ts';
import type { GameState } from '@gagyebu/core';
import type { GagyebuStats } from '@gagyebu/activity-gagyebu';

export function Stage({ beat, revealed }: StageProps<GameState, GagyebuStats>) {
  return (
    <div className="paper-texture grid min-h-dvh place-items-center px-6">
      <div className="w-full max-w-[40rem] rounded-panel bg-sheet p-8 text-center shadow-[0_0_0_1px_var(--color-rule)]">
        <p className="text-[15px] font-semibold text-ink-2">전면 화면 준비 중</p>
        <h1 className="display mt-2 text-[42px]">{beat.label}</h1>
        <p className="num mt-3 text-[14px] text-ink-3">
          beat: {beat.id} · mode: {beat.mode}
          {beat.reveal ? ` · revealed: ${String(revealed)}` : ''}
        </p>
        <p className="mt-3 text-[14px] text-ink-2">이 비트의 전면 화면은 곧 준비됩니다.</p>
      </div>
    </div>
  );
}
