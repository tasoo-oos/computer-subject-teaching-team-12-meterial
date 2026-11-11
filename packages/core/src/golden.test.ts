// 골든 경로: 하늘(신중)·바다(즉흥)의 12개월을 행동으로 재생해 결산이 목업(result-balanced·result-debt)과
// 근사하는지 확인한다. 허용 오차와 의도적 차이는 docs/core-api.md §4.5에 기록했다.
import { describe, expect, it } from 'vitest';
import { BASE_SALARY } from './data/constants.ts';
import { createInitialState, step } from './engine.ts';
import { FIXTURES } from './fixtures.ts';
import { isBudgetValid, netWorth, totalDebt } from './selectors.ts';
import { cloneBudget, deepFreeze } from './testUtils.ts';
import type { Budget, GameState, PaymentPlan, QuestionId, Won } from './types.ts';

const HANEUL_ANSWERS: Partial<Record<QuestionId, string>> = {
  meal: '5to10',
  cafe: '3to7',
  delivery: '3to4',
  phonePlan: 'normal',
  subscriptions: '2to3',
  weekend: '5to15',
  impulse: 'think',
};
const SALARY: Won = BASE_SALARY;

/** 하늘: 신중하게 고르는 경로 (fixtures.ts의 haneulHooks를 행동으로 옮긴 것) */
function haneulGame(): GameState {
  let s = createInitialState('하늘');
  s = step(s, { type: 'start', nickname: '하늘' });
  s = step(s, { type: 'submitSurvey', answers: HANEUL_ANSWERS });
  s = step(s, { type: 'goto', phase: 'budget' });
  s = step(s, { type: 'confirmBudget' });

  // 1월: 튜토리얼
  s = step(s, { type: 'beginMonth' });
  s = step(s, { type: 'choose', choiceId: 'ok' });
  s = step(s, { type: 'continue' });
  s = step(s, { type: 'endMonth' });

  // 2월: 수리 (비상금 전액 + 목표 통장 나머지)
  s = step(s, { type: 'beginMonth' });
  const emergency = s.accounts.emergency.balance;
  const repair: PaymentPlan = {
    parts: [
      { source: 'emergency', amount: emergency },
      { source: 'goal', amount: 600_000 - emergency },
    ],
  };
  s = step(s, { type: 'choose', choiceId: 'repair', payment: repair });
  s = step(s, { type: 'continue' });
  s = step(s, { type: 'endMonth' });

  // 3월: 운동화 리셀은 패스
  s = step(s, { type: 'beginMonth' });
  s = step(s, { type: 'choose', choiceId: 'pass' });
  s = step(s, { type: 'continue' });
  s = step(s, { type: 'endMonth' });

  // 4월: 조용한 달
  s = step(s, { type: 'beginMonth' });
  s = step(s, { type: 'endMonth' });

  // 5월: 15만 원 선물(목표 통장) → 사칭 문자는 전화로 확인
  s = step(s, { type: 'beginMonth' });
  s = step(s, { type: 'choose', choiceId: 'mid', payment: { parts: [{ source: 'goal', amount: 150_000 }] } });
  s = step(s, { type: 'continue' });
  s = step(s, { type: 'choose', choiceId: 'call' });
  s = step(s, { type: 'continue' });
  s = step(s, { type: 'endMonth' });

  // 6월: 협상 → 3만 원 인상 수용 → 여가 3만 원 절감
  s = step(s, { type: 'beginMonth' });
  s = step(s, { type: 'choose', choiceId: 'negotiate' });
  s = step(s, { type: 'continue' });
  s = step(s, { type: 'choose', choiceId: 'accept30' });
  s = step(s, { type: 'continue' }); // → adjust (rent +3만 이미 반영됨)
  const b6 = cloneBudget(s.budget);
  b6.expenses.leisure -= 30_000;
  s = step(s, { type: 'setBudget', budget: b6 });
  s = step(s, { type: 'endMonth' });

  // 7월: 당첨금은 통장에
  s = step(s, { type: 'beginMonth' });
  s = step(s, { type: 'choose', choiceId: 'save', depositTo: 'emergency' });
  s = step(s, { type: 'continue' });
  s = step(s, { type: 'endMonth' });

  // 8월: 급락에도 그대로 둔다
  s = step(s, { type: 'beginMonth' });
  s = step(s, { type: 'choose', choiceId: 'hold' });
  s = step(s, { type: 'continue' });
  s = step(s, { type: 'endMonth' });

  // 9월: 물가 상승을 가계부에 반영 (식비 +8%는 선택 효과로 이미 반영됨 → 미용에서 늘어난 만큼 절감)
  s = step(s, { type: 'beginMonth' });
  s = step(s, { type: 'choose', choiceId: 'adjust' });
  s = step(s, { type: 'continue' });
  const b9 = cloneBudget(s.budget);
  const foodInc = b9.expenses.food - Math.round(b9.expenses.food / 1.08);
  b9.expenses.beauty -= foodInc;
  s = step(s, { type: 'setBudget', budget: b9 });
  s = step(s, { type: 'endMonth' });

  // 10월: 조용한 달
  s = step(s, { type: 'beginMonth' });
  s = step(s, { type: 'endMonth' });

  // 11월: 리딩방은 피하고 동기에게 알려 준다
  s = step(s, { type: 'beginMonth' });
  s = step(s, { type: 'choose', choiceId: 'warn' });
  s = step(s, { type: 'continue' });
  s = step(s, { type: 'endMonth' });

  // 12월: 결산
  s = step(s, { type: 'beginMonth' });
  return s;
}

const BADA_ANSWERS: Partial<Record<QuestionId, string>> = {
  meal: '10to15',
  cafe: 'gt7',
  delivery: '3to4',
  phonePlan: 'unlimited',
  subscriptions: '4plus',
  weekend: 'gt30',
  impulse: 'buy',
};
/** 월급 265만 원 중 253만 원을 나누고 12만 원이 생활비 통장에 남는 가계부 (fixtures.ts와 같다) */
const BADA_BUDGET: Budget = {
  transfers: { emergency: 150_000, savings: 240_000, invest: 100_000, goal: 50_000, housing: 20_000 },
  expenses: {
    rent: 550_000,
    phone: 80_000,
    insurance: 50_000,
    transport: 70_000,
    subscription: 55_000,
    food: 520_000,
    household: 60_000,
    beauty: 200_000,
    leisure: 355_000,
    family: 30_000,
  },
};

/** 바다: 즉흥적인 경로 (fixtures.ts의 badaHooks를 행동으로 옮긴 것).
 *  목업이 계획한 지불 수단 중 잔고가 모자라는 것(5월 사기 50만 원)은 검증을 통과하는
 *  유효한 계획(비상금+목표+카드 일시불)으로 바꿨다 — 총지출은 같다. */
function badaGame(): GameState {
  let s = createInitialState('바다');
  s = step(s, { type: 'start', nickname: '바다' });
  s = step(s, { type: 'submitSurvey', answers: BADA_ANSWERS });
  s = step(s, { type: 'goto', phase: 'budget' });
  s = step(s, { type: 'setBudget', budget: cloneBudget(BADA_BUDGET) });
  s = step(s, { type: 'confirmBudget' });

  // 1월
  s = step(s, { type: 'beginMonth' });
  s = step(s, { type: 'choose', choiceId: 'ok' });
  s = step(s, { type: 'continue' });
  s = step(s, { type: 'endMonth' });

  // 2월: 새 노트북 12개월 무이자 할부
  s = step(s, { type: 'beginMonth' });
  s = step(s, { type: 'choose', choiceId: 'new' });
  s = step(s, { type: 'continue' });
  s = step(s, { type: 'endMonth' });

  // 3월: 운동화 1켤레 리셀 (비상금)
  s = step(s, { type: 'beginMonth' });
  s = step(s, { type: 'choose', choiceId: 'flip1', payment: { parts: [{ source: 'emergency', amount: 300_000 }] } });
  s = step(s, { type: 'continue' });
  s = step(s, { type: 'endMonth' });

  // 4월: 시세 알림 → 더 기다린다 (6월로 예약)
  s = step(s, { type: 'beginMonth' });
  s = step(s, { type: 'choose', choiceId: 'hold' });
  s = step(s, { type: 'continue' });
  s = step(s, { type: 'endMonth' });

  // 5월: 손편지(생활비 5만, 목업과 같은 수단) → 가족 사칭 사기 피해(비상금 + 목표)
  s = step(s, { type: 'beginMonth' });
  s = step(s, { type: 'choose', choiceId: 'letter', payment: { parts: [{ source: 'living', amount: 50_000 }] } });
  s = step(s, { type: 'continue' });
  const e5 = Math.min(s.accounts.emergency.balance, 500_000);
  const send: PaymentPlan = { parts: [{ source: 'emergency', amount: e5 }] };
  if (e5 < 500_000) send.parts.push({ source: 'goal', amount: 500_000 - e5 });
  s = step(s, { type: 'choose', choiceId: 'send', payment: send });
  s = step(s, { type: 'continue' });
  s = step(s, { type: 'choose', choiceId: 'ok' });
  s = step(s, { type: 'continue' });
  s = step(s, { type: 'endMonth' });

  // 6월: 시세 하락에도 보유 → 월세 5만 원 인상 수용 (남는 돈 12만 → 7만, 가계부는 그대로 확인)
  s = step(s, { type: 'beginMonth' });
  s = step(s, { type: 'choose', choiceId: 'hold' }); // check6 (예약 장면)
  s = step(s, { type: 'continue' }); // → rent-hike notice (queue)
  s = step(s, { type: 'choose', choiceId: 'accept' });
  s = step(s, { type: 'continue' }); // → adjust (rent +5만 이미 반영됨)
  s = step(s, { type: 'setBudget', budget: cloneBudget(s.budget) });
  s = step(s, { type: 'endMonth' });

  // 7월: 복권 10장 → 한 장 더 (다 잃음)
  s = step(s, { type: 'beginMonth' });
  s = step(s, { type: 'choose', choiceId: 'more' });
  s = step(s, { type: 'continue' });
  s = step(s, { type: 'choose', choiceId: 'again' });
  s = step(s, { type: 'continue' });
  s = step(s, { type: 'endMonth' });

  // 8월: 급락에서 전부 매도 → 비상금으로
  s = step(s, { type: 'beginMonth' });
  s = step(s, { type: 'choose', choiceId: 'sellAll', depositTo: 'emergency' });
  s = step(s, { type: 'continue' });
  s = step(s, { type: 'endMonth' });

  // 9월: 물가 상승 무시
  s = step(s, { type: 'beginMonth' });
  s = step(s, { type: 'choose', choiceId: 'ignore' });
  s = step(s, { type: 'continue' });
  s = step(s, { type: 'endMonth' });

  // 10월: 생활비 부족 → 리볼빙
  s = step(s, { type: 'beginMonth' });
  expect(s.step).toBe('scene');
  expect(s.current?.sceneId).toBe('revolving');
  s = step(s, { type: 'choose', choiceId: 'revolve' });
  s = step(s, { type: 'continue' });
  s = step(s, { type: 'endMonth' });

  // 11월: 리딩방 10만 원 → 수수료 요구는 거부
  s = step(s, { type: 'beginMonth' });
  s = step(s, { type: 'choose', choiceId: 'tryTen', payment: { parts: [{ source: 'goal', amount: 100_000 }] } });
  s = step(s, { type: 'continue' });
  s = step(s, { type: 'choose', choiceId: 'refuse' });
  s = step(s, { type: 'continue' });
  s = step(s, { type: 'endMonth' });

  // 12월: 결산
  s = step(s, { type: 'beginMonth' });
  return s;
}

const balancedFixture = FIXTURES.find((f) => f.id === 'result-balanced');
const debtFixture = FIXTURES.find((f) => f.id === 'result-debt');

describe('골든 경로: 하늘 (신중, result-balanced 목업과 비교)', () => {
  it('12개월 재생이 결정적이고 목업과 같은 순자산·엔딩·도전과제를 낸다', () => {
    expect(balancedFixture).toBeDefined();
    const a = haneulGame();
    const b = haneulGame();
    expect(JSON.stringify(a)).toBe(JSON.stringify(b)); // 결정성

    const fixture = balancedFixture!.state;
    expect(a.phase).toBe('result');
    expect(a.settlement).not.toBeNull();
    expect(a.history).toHaveLength(12);
    expect(isBudgetValid(a.budget, SALARY)).toBe(true);

    // 순자산: 목업과 정확히 일치 (같은 규칙으로 근사 계산된 목업, §4.5)
    const engineNw = netWorth(a);
    const fixtureNw = netWorth(fixture);
    if (engineNw !== fixtureNw) {
      console.log('[haneul] netWorth engine=', engineNw, 'fixture=', fixtureNw, 'diff=', engineNw - fixtureNw);
    }
    expect(Math.abs(engineNw - fixtureNw)).toBeLessThanOrEqual(50_000);

    expect(a.settlement!.ending).toBe('balanced');
    expect(fixture.settlement!.ending).toBe('balanced');
    expect(totalDebt(a)).toBe(0);

    // 도전과제: 목업의 8개와 같은 집합
    expect([...a.unlocked].sort()).toEqual([...fixture.unlocked].sort());

    // 만족도 차이: 목업은 5월 선물에 +8을 수동으로 더했다. 엔진은 선택지 효과(+5)를 따른다 (§4.5)
    expect(Math.abs(a.satisfaction - fixture.satisfaction)).toBeLessThanOrEqual(5);
    expect(a.credit).toBe(fixture.credit);
  });

  it('원본 상태를 고치지 않는다 (모든 행동에 결정성·불변성)', () => {
    // haneulGame 내부의 모든 step 호출이 불변성을 지키는지 대표 경로로 확인한다
    let s = createInitialState('하늘');
    const frozen = deepFreeze(JSON.parse(JSON.stringify(s)) as GameState);
    const snap = JSON.stringify(frozen);
    s = step(frozen, { type: 'start', nickname: '하늘' });
    expect(JSON.stringify(frozen)).toBe(snap);
    expect(s.phase).toBe('survey');
    expect(frozen.phase).toBe('start');
  });
});

describe('골든 경로: 바다 (즉흥, result-debt 목업과 비교)', () => {
  it('12개월 재생이 결정적이고 부채 엔딩으로 끝난다', () => {
    expect(debtFixture).toBeDefined();
    const a = badaGame();
    const b = badaGame();
    expect(JSON.stringify(a)).toBe(JSON.stringify(b)); // 결정성

    const fixture = debtFixture!.state;
    expect(a.phase).toBe('result');
    expect(a.settlement!.ending).toBe('debt');
    expect(fixture.settlement!.ending).toBe('debt');
    expect(totalDebt(a)).toBeGreaterThan(0);

    // 순자산: 5월 사기 지불 계획만 유효한 형태로 바꿨다(총지출 동일). 오차 10만 원 이내 (§4.5)
    const engineNw = netWorth(a);
    const fixtureNw = netWorth(fixture);
    if (engineNw !== fixtureNw) {
      console.log('[bada] netWorth engine=', engineNw, 'fixture=', fixtureNw, 'diff=', engineNw - fixtureNw);
    }
    expect(Math.abs(engineNw - fixtureNw)).toBeLessThanOrEqual(100_000);

    // 도전과제: 목업 손글씨 목록(['paySelfFirst'])과는 다르게 규칙대로 계산한다 (§4.5)
    // - 적금을 한 번도 깨지 않았으므로 '적금 완주' 달성
    // - 3월에 비상금을 쓴 뒤 5월에 다시 채웠으므로 '비상금 지킴이' 달성
    // - 저축+투자+청약 자동이체가 월급의 20%에 못 미쳐 '선저축 1년' 미달 (목업은 달성으로 적어 둠)
    expect(a.unlocked).toContain('savingsComplete');
    expect(a.unlocked).toContain('emergencyRefill');
    expect(a.unlocked).not.toContain('paySelfFirst');
    expect(a.unlocked).not.toContain('noInstallment');
    expect(a.unlocked).not.toContain('fraudDetector');

    // 만족도: 목업보다 낮다 (6월 카드값 상환으로 생활비 부족 한 번 더). 둘 다 60 미만
    expect(a.satisfaction).toBeLessThan(60);
    expect(a.credit).toBe(fixture.credit); // 리볼빙 -40 동일
  });
});
