// draft-kit 어댑터 (docs/live-api.md §10.9): 스냅숏 id + 행동 → 다음 스냅숏 id, 스냅숏 id → 라이브 비트.
// 기존 components/sim/routes.ts의 NEXT_FIXTURE/SCENE_FIXTURE 이동표를 이 함수로 흡수했다(§14 #32).
// /dev#/<fixture>와 pnpm shots가 이 표를 그대로 통과해야 한다.
import { gagyebuLogic, type GagyebuConfig } from '@gagyebu/activity-gagyebu';
import { FIXTURES, getScene, type Action } from '@gagyebu/core';
import type { Beat } from '@gagyebu/live';

/** 스냅숏 이동표: 엔진 대신 그럴듯한 다음 스냅숏으로 (구 components/sim/routes.ts) */
const NEXT_FIXTURE: Record<string, string> = {
  'sim-jan-payday': 'sim-feb-scene',
  'sim-feb-scene': 'sim-feb-outcome',
  'sim-feb-pay': 'sim-feb-outcome',
  'sim-feb-seller': 'sim-feb-outcome',
  'sim-feb-outcome': 'sim-mar-resell',
  'sim-mar-resell': 'sim-apr-check',
  'sim-apr-check': 'sim-may-message',
  'sim-may-message': 'sim-jun-adjust',
  'sim-jun-adjust': 'sim-jul-reveal',
  'sim-jul-reveal': 'sim-aug-crash',
  'sim-aug-crash': 'sim-oct-report',
  'sim-aug-deposit': 'sim-oct-report',
  'sim-oct-report': 'sim-nov-locked',
  'sim-nov-invite': 'result-balanced',
  'sim-nov-locked': 'result-debt',
};

/** 같은 달에 이어지는 장면을 보여 주는 스냅숏 (구 components/sim/routes.ts) */
const SCENE_FIXTURE: Record<string, string> = {
  'laptop-spill/seller': 'sim-feb-seller',
  'family-month/message': 'sim-may-message',
};

/**
 * dev 목업의 "이전" 버튼 표시행동. 라이브에는 학생 뒤로 가기가 없어(교사만 prev/goto 리뷰),
 * 대응하는 진짜 행동이 없다. 예약 choiceId로 dev 이동임을 표시한다 — S5가 라이브 화면을
 * 정리하며 이 버튼들을 없앨 때 함께 사라진다(§14 #80).
 */
export const DEV_PREV: Extract<Action, { type: 'choose' }> = { type: 'choose', choiceId: 'dev-prev' };

/** 스냅숏 → 이전 스냅숏 (DEV_PREV로만 온다) */
const PREV_FIXTURE: Record<string, string> = {
  'survey-q1': 'start-reveal',
  'survey-q7': 'survey-q1',
  'survey-result': 'survey-q7',
  'guide-1': 'survey-result',
  'guide-3': 'survey-result',
};

/** 시뮬레이션 스냅숏의 공통 다음 행 (구 next(): NEXT_FIXTURE[fixture.id] ?? 'result-balanced') */
function simNext(fixtureId: string): string | null {
  const next = NEXT_FIXTURE[fixtureId];
  if (next) return next;
  return fixtureId.startsWith('sim-') ? 'result-balanced' : null;
}

/** 장면 선택: 이어지는 장면이면 그 스냅숏으로, 아니면 다음 스냅숏으로 (구 SimScreen.choose 규칙 그대로) */
function chooseNext(fixtureId: string, action: Extract<Action, { type: 'choose' }>): string | null {
  const fixture = FIXTURES.find((f) => f.id === fixtureId);
  const ref = fixture?.state.current;
  if (ref) {
    const fetched = getScene(ref);
    const choice = fetched?.scene.choices.find((c) => c.id === action.choiceId);
    if (choice?.next && !choice.next.delayMonths) {
      const chained = SCENE_FIXTURE[`${ref.eventId}/${choice.next.scene}`];
      if (chained) return chained;
    }
  }
  return simNext(fixtureId);
}

/**
 * 스냅숏 id + 행동 → 이동할 스냅숏 id. null이면 무시.
 * 행동은 라이브에서 학생이 보낼 진짜 행동과 같은 종류를 쓴다(SubmitSurvey·choose·goto·…).
 * 목업 점프(start-reveal→설문, 발표용 크게 보기)는 continue로, dev "이전"은 DEV_PREV로 표시한다.
 */
export function route(fixtureId: string, action: Action): string | null {
  if (action.type === 'choose' && action.choiceId === DEV_PREV.choiceId) return PREV_FIXTURE[fixtureId] ?? null;
  switch (action.type) {
    case 'start':
      return fixtureId === 'start-name' ? 'start-reveal' : null;
    case 'submitSurvey':
      if (fixtureId === 'survey-q1') return 'survey-q7'; // 목업 점프: 마지막 문항 스냅숏으로
      if (fixtureId === 'survey-q7') return 'survey-result'; // 마지막 문항 제출 = 실제 제출과 같은 행동
      return null;
    case 'goto':
      if (fixtureId === 'survey-result') return 'guide-1';
      if (fixtureId === 'guide-1' || fixtureId === 'guide-3') return 'budget-ok';
      if (fixtureId === 'budget-ok' || fixtureId === 'budget-over') return 'guide-1';
      return null;
    case 'setBudget': // 6월 조정 단계 완료
    case 'beginMonth': // 월급날 → 장면
    case 'endMonth': // 월말 리포트 → 다음 달 (12월 결산 보기 포함)
      return simNext(fixtureId);
    case 'continue':
      if (fixtureId === 'start-reveal') return 'survey-q1'; // 표시형 비트 진행 (dev/solo)
      if (fixtureId === 'result-balanced' || fixtureId === 'result-debt') return 'result-present'; // 발표용 크게 보기
      if (fixtureId === 'result-present') return 'result-balanced'; // 크게 보기 닫기
      return simNext(fixtureId); // 선택 결과 피드백 → 다음
    case 'choose':
      return chooseNext(fixtureId, action);
    case 'confirmBudget':
      return fixtureId === 'budget-ok' ? 'sim-jan-payday' : null; // 초과(budget-over)는 유효하지 않아 원래 버튼이 꺼져 있다
    case 'reset':
      return fixtureId === 'result-balanced' || fixtureId === 'result-debt' ? 'start-name' : null;
    default:
      return null;
  }
}

/** 스냅숏 → 라이브 비트 id (§9.2 비트 표 기준) */
const FIXTURE_BEAT: Record<string, string> = {
  'start-name': 'join',
  'start-reveal': 'salary',
  'survey-q1': 'survey',
  'survey-q7': 'survey',
  'survey-result': 'survey-result',
  'guide-1': 'guide-1',
  'guide-3': 'guide-3',
  'budget-ok': 'budget',
  'budget-over': 'budget',
  'sim-jan-payday': 'm1',
  'sim-feb-scene': 'm2',
  'sim-feb-pay': 'm2',
  'sim-feb-seller': 'm2',
  'sim-feb-outcome': 'm2',
  'sim-mar-resell': 'm3',
  'sim-apr-check': 'm4',
  'sim-may-message': 'm5',
  'sim-jun-adjust': 'm6',
  'sim-jul-reveal': 'm7',
  'sim-aug-crash': 'm8',
  'sim-aug-deposit': 'm8',
  'sim-oct-report': 'm10',
  'sim-nov-invite': 'm11',
  'sim-nov-locked': 'm11',
  'result-balanced': 'm12',
  'result-debt': 'm12',
  'result-present': 'present',
};

/** lesson.ts의 가계부 활동 설정과 같은 값 */
const GAGYEBU_CONFIG: GagyebuConfig = { guide: true, monthReveal: true, spotlight: true, confirmForce: true };

/** 비트 목록은 활동의 순수 함수(§9.2)에서 가져온다 — 라벨·reveal·노트가 라이브와 같다 */
const GAGYEBU_BEATS: Beat[] = gagyebuLogic.beats(GAGYEBU_CONFIG);

/** 스냅숏 id → 비트 (§10.9 beatOf). 라이브 비트 id와 같은 id를 쓴다 */
export function beatOf(fixtureId: string): Beat {
  const id = FIXTURE_BEAT[fixtureId];
  return GAGYEBU_BEATS.find((b) => b.id === id) ?? { id: fixtureId, label: fixtureId, mode: 'show' };
}
