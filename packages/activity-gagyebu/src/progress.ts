// 비트별 done / fallback / transition (docs/live-api.md §9.3). S4가 구현한다.
// 계약: fallback은 한 번 호출될 때마다 상태를 반드시 진전시킨다(같은 행동 반복 금지, §14 #6).
import { NotImplementedError } from '@gagyebu/core';
import type { Action, GameState } from '@gagyebu/core';
import type { FallbackResult } from '@gagyebu/live';
import type { GagyebuConfig } from './config.ts';

/** 이 비트에서 학생이 할 일을 다 했는지 (§9.3 표) */
export function done(_s: GameState, _beat: number, _cfg: GagyebuConfig): boolean {
  throw new NotImplementedError('activity-gagyebu done (§9.3) — S4 구현 예정');
}

/** 끝내지 못한 학생에게 적용할 다음 기본 행동 (§9.3 표 + 월 비트 fallback 규칙) */
export function fallback(_s: GameState, _beat: number, _cfg: GagyebuConfig, _draft: unknown | undefined): FallbackResult<Action> {
  throw new NotImplementedError('activity-gagyebu fallback (§9.3) — S4 구현 예정');
}

/** 비트 이동 시 모든 학생에게 대신 실행하는 전이 (§9.3 표) */
export function transition(_s: GameState, _from: number, _to: number, _cfg: GagyebuConfig): Action[] {
  throw new NotImplementedError('activity-gagyebu transition (§9.3) — S4 구현 예정');
}
