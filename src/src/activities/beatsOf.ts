// 클라이언트 쪽 활동 비트 조회 — lessonBeats(lesson, beatsOf)의 beatsOf 인자(docs/live-api.md §4.1).
// 활동의 beats는 순수 함수(§4.2)라 서버·클라이언트가 같은 목록을 쓴다. 모르는 활동은 빈 목록(로그로 드러난다).
import { gagyebuLogic, type GagyebuConfig } from '@gagyebu/activity-gagyebu';
import type { Beat } from '@gagyebu/live';

export function beatsOf(activityId: string, config: unknown): Beat[] {
  if (activityId === 'gagyebu' && config && typeof config === 'object') {
    return gagyebuLogic.beats(config as GagyebuConfig);
  }
  return [];
}
