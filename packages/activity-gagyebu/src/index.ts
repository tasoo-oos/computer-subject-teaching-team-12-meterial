// 가계부 활동의 순수 로직 (docs/live-api.md §9). apply는 core.step을 감싼다.
// beats는 S0이 구현했고 나머지 메서드는 S4가 구현했다(M4·M5).
import { step } from '@gagyebu/core';
import type { Action, GameState } from '@gagyebu/core';
import type { ActivityLogic } from '@gagyebu/live';
import { beats } from './beats.ts';
import type { GagyebuConfig } from './config.ts';
import type { GagyebuDraft } from './draft.ts';
import { exportColumns, exportRows } from './export.ts';
import { allowed, done, fallback, initState, locate, previewFallback, transition } from './progress.ts';
import { stats } from './stats.ts';
import type { GagyebuStats, MonthEntryTally, SceneTally } from './stats.ts';

export const gagyebuLogic: ActivityLogic<GagyebuConfig, GameState, Action, GagyebuStats> = {
  id: 'gagyebu',
  beats,
  init: initState,
  allowed,
  apply: (s: GameState, a: Action, _cfg: GagyebuConfig): GameState => step(s, a),
  done,
  fallback,
  transition,
  stats,
  locate,
  previewFallback,
  exportColumns,
  exportRows,
};

export type { GagyebuConfig } from './config.ts';
export type { GagyebuDraft } from './draft.ts';
export type { GagyebuStats, LeaderEntry, MonthEntryTally, SceneTally } from './stats.ts';
export { exportColumns, exportRows, formatPaymentPlan } from './export.ts';
export { allowed, done, fallback, transition, locate, previewFallback } from './progress.ts';
export { stats, sceneLabel } from './stats.ts';
