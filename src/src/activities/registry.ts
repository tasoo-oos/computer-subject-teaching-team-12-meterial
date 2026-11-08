// 활동 화면 계약 (docs/live-api.md §4.3). 클라이언트 전용 — React 타입을 쓰므로 packages/live에 들어가지 못한다(§14 #10).
// 서버 레지스트리(server/src/activities.ts)의 id 집합과 ACTIVITY_VIEWS의 id 집합이 같아야 한다.
import type { ComponentType } from 'react';
import type { Beat, ProgressInfo, RosterEntry } from '@gagyebu/live';
import type { Action, GameState } from '@gagyebu/core';
import type { GagyebuStats } from '@gagyebu/activity-gagyebu';
import { Audience } from './gagyebu/Audience.tsx';
import { ControlPanel } from './gagyebu/ControlPanel.tsx';
import { Stage } from './gagyebu/Stage.tsx';

export interface AudienceProps<S, A> {
  state: S;
  beat: Beat;
  revealed: boolean;
  /** 이 비트에서 제출을 마쳤으면 true (대기 화면) */
  submitted: boolean;
  mode: 'live' | 'solo' | 'dev';
  dispatch: (a: A) => void;
  draft: (d: unknown) => void;
}

export interface StageProps<S, Stats> {
  beat: Beat;
  revealed: boolean;
  stats: Stats | null;
  /** 발표자의 상태 (spotlight 없으면 null) */
  spotlight: S | null;
  /** 발표자 닉네임 (spotlight 없으면 null). 전면 표시용(§5.1, §14 #132) */
  spotlightName: string | null;
  /** lesson.settings.showProgressOnStage일 때만 null이 아님 */
  progress: ProgressInfo | null;
}

export interface ControlPanelProps<S, Stats> {
  beat: Beat;
  revealed: boolean;
  stats: Stats | null;
  roster: RosterEntry[];
}

export interface ActivityViews<S, A, Stats> {
  Audience: ComponentType<AudienceProps<S, A>>;
  Stage: ComponentType<StageProps<S, Stats>>;
  ControlPanel?: ComponentType<ControlPanelProps<S, Stats>>;
}

/** 앱 타입으로 좁힌 가계부 화면 묶음. Audience는 상태가 없는(degraded) 학생을 위해 S를 GameState | null로 넓힌다(§14 #110). */
const gagyebuViews: ActivityViews<GameState | null, Action, GagyebuStats> = {
  Audience,
  Stage: Stage as unknown as ComponentType<StageProps<GameState | null, GagyebuStats>>,
  ControlPanel: ControlPanel as unknown as ComponentType<ControlPanelProps<GameState | null, GagyebuStats>>,
};

/** activity id → 화면. 서버 레지스트리(server/src/activities.ts)의 id 집합과 같아야 한다. */
export const ACTIVITY_VIEWS: Record<string, ActivityViews<unknown, unknown, unknown>> = {
  gagyebu: gagyebuViews as unknown as ActivityViews<unknown, unknown, unknown>,
};
