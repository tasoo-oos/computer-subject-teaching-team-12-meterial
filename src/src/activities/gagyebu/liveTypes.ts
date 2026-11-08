// 소켓 타이핑 좁히기 (docs/live-api.md §5.1). 앱의 활동 계층에서 제네릭 프로토콜을
// 가계부 게임 타입(Action·GameState·GagyebuDraft·GagyebuStats)으로 좁혀 내보낸다.
import type { Action, GameState } from '@gagyebu/core';
import type {
  ActAck,
  ActPayload,
  ClientToServerEvents,
  DraftPayload,
  ServerToClientEvents,
  SnapshotPayload,
  SpotlightStatePayload,
  StatePayload,
  StatsPayload,
} from '@gagyebu/live';
import type { GagyebuDraft, GagyebuStats } from '@gagyebu/activity-gagyebu';

export type LiveClientToServer = ClientToServerEvents<Action, GagyebuDraft>;
export type LiveServerToClient = ServerToClientEvents<GameState, GagyebuStats>;
export type LiveActPayload = ActPayload<Action>;
export type LiveActAck = ActAck<GameState>;
export type LiveSnapshot = SnapshotPayload<GameState>;
export type LiveState = StatePayload<GameState>;
export type LiveStats = StatsPayload<GagyebuStats>;
export type LiveSpotlight = SpotlightStatePayload<GameState>;
export type LiveDraft = DraftPayload<GagyebuDraft>;
