// 가계부 활동의 순수 로직 (docs/live-api.md §9). apply는 core.step을 감싼다.
// beats는 S0이 구현했고 나머지 메서드는 S4가 구현한다(M4·M5).
import { NotImplementedError } from '@gagyebu/core';
import type { Action, GameState } from '@gagyebu/core';
import type { ActivityLogic } from '@gagyebu/live';
import { beats } from './beats.ts';
import type { GagyebuConfig } from './config.ts';
import type { GagyebuDraft } from './draft.ts';
import { exportColumns, exportRows } from './export.ts';
import { done, fallback, transition } from './progress.ts';
import type { GagyebuStats, MonthEntryTally, SceneTally } from './stats.ts';

const unimplemented = (what: string): never => {
  throw new NotImplementedError(`gagyebuLogic.${what} — S4 구현 예정`);
};

export const gagyebuLogic: ActivityLogic<GagyebuConfig, GameState, Action, GagyebuStats> = {
  id: 'gagyebu',
  beats,
  init: () => unimplemented('init'),
  allowed: () => unimplemented('allowed'),
  apply: () => unimplemented('apply'),
  done,
  fallback,
  transition,
  stats: () => unimplemented('stats'),
  exportColumns,
  exportRows,
};

export type { GagyebuConfig } from './config.ts';
export type { GagyebuDraft } from './draft.ts';
export type { GagyebuStats, MonthEntryTally, SceneTally } from './stats.ts';
export { exportColumns, exportRows } from './export.ts';
export { done, fallback, transition } from './progress.ts';
