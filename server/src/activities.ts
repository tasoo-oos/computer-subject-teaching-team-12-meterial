// activity id → ActivityLogic 레지스트리 (docs/live-api.md §2.2, §8.6).
// 서버는 @gagyebu/core를 직접 import하지 않는다(§1.2) — 활동 로직은 이 레지스트리로만 쓰고
// 게임 상태·행동은 unknown으로 다룬다. 클라이언트 레지스트리(src/src/activities/registry.ts)의
// ACTIVITY_VIEWS와 id 집합이 같아야 한다.
import type { ActivityLogic } from '@gagyebu/live';
import { gagyebuLogic } from '@gagyebu/activity-gagyebu';

export const activities: Record<string, ActivityLogic<unknown, unknown, unknown, unknown>> = {
  gagyebu: gagyebuLogic,
};
