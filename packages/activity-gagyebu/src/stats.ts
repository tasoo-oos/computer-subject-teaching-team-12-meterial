// 비트별 익명 집계 타입 (docs/live-api.md §9.4). 계산 함수는 S4가 구현한다.
import type { AccountId, EndingId, EventId, SceneChannel, SceneId, Won } from '@gagyebu/core';

export interface SceneTally {
  sceneId: SceneId;
  title: string;
  /** 그 장면까지 도달한 학생 수 (도달한 학생만 분모) */
  reached: number;
  /** 데이터 순서 그대로 */
  choices: { choiceId: string; label: string; count: number }[];
}

export interface MonthEntryTally {
  eventId: EventId;
  sceneId: SceneId;
  title: string;
  channel: SceneChannel;
  choices: { choiceId: string; label: string; count: number }[];
}

export type GagyebuStats =
  | { kind: 'none' } // survey, survey-result, guide-*, present, 슬라이드 — 집계 없음
  | { kind: 'join'; joined: number; connected: number; nicknames: string[] }
  | { kind: 'salary'; baseSalary: Won; salaries: Won[] } // 기준 ±10% 띠 위 점들
  | {
      kind: 'budget';
      savingsRates: number[]; // 학생별 저축률 (평균은 Stage에서)
      shares: Record<AccountId, number>[]; // 학생별 계좌 배분 (계좌 6종)
      autoCount: number;
    }
  | {
      kind: 'month';
      month: number; // 1~11
      entry: MonthEntryTally | null; // 그 달 배치 이벤트의 첫 장면. 조용한 달(4·10)은 null
      /** 같은 달에 바로 이어진 장면 (예: 2월 seller, 5월 message) */
      chained: SceneTally[];
      /** 예약 후속 장면 — 그 달에 예약돼 나타난 장면 (예: 4월 check4, 6월 check6, 10월 revolving) */
      scheduled: SceneTally[];
      /** 지금 이어진 장면(연쇄·예약 포함)에 서 있는 학생 수 */
      inChained: number;
      netWorths: number[]; // 조용한 달 순자산 분포 변화용
      autoCount: number;
    }
  | {
      kind: 'settlement'; // m12
      endings: { endingId: EndingId; label: string; count: number }[]; // ENDING_ORDER 순서
      achievements: { achievementId: string; label: string; rate: number }[]; // ACHIEVEMENT_ORDER 순서
      netWorths: number[];
      autoCount: number;
    };
