// 아무것도 안 하는 학생: 모든 단계를 §4.3 기본값 함수로만 채워 1년을 완주한다 (§4.4).
// live-api §9.3의 fallback 루프를 그대로 흉내 낸다.
import { describe, expect, it } from 'vitest';
import { BASE_SALARY } from './data/constants.ts';
import { balanceBudget, createInitialState, defaultAnswers, step } from './engine.ts';
import { isBudgetValid, totalDebt } from './selectors.ts';
import { fallbackStep } from './testUtils.ts';
import type { EndingId, GameState, QuestionId, Won } from './types.ts';

// 월급은 모두 같다 (BASE_SALARY)
const SALARIES: Won[] = [BASE_SALARY];

const ANSWER_SETS: { label: string; answers: Partial<Record<QuestionId, string>> }[] = [
  { label: '모두 중간 답', answers: {} },
  {
    label: '즉흥형',
    answers: {
      meal: 'gt15',
      cafe: 'gt7',
      delivery: '5plus',
      phonePlan: 'unlimited',
      subscriptions: '4plus',
      weekend: 'gt30',
      impulse: 'buy',
    },
  },
  {
    label: '계획형',
    answers: {
      meal: 'lt5',
      cafe: 'none',
      delivery: '0',
      phonePlan: 'budget',
      subscriptions: '0',
      weekend: 'lt5',
      impulse: 'hold',
    },
  },
  { label: '일부만 답함', answers: { meal: '5to10', impulse: 'think' } },
];

/** 기본값만으로 1년을 돌린다. 중간에 isBudgetValid 위반이 없어야 한다 */
function autoYear(salary: Won, answers: Partial<Record<QuestionId, string>>): GameState {
  let s = createInitialState('무응답');
  s = step(s, { type: 'start', nickname: '무응답' });
  s = step(s, { type: 'submitSurvey', answers: defaultAnswers(answers), auto: true });
  s = step(s, { type: 'goto', phase: 'budget' });
  s = step(s, { type: 'setBudget', budget: balanceBudget(s.budget, salary).budget, auto: true });
  s = step(s, { type: 'confirmBudget', auto: true });

  let guard = 0;
  while (s.phase !== 'result') {
    s = fallbackStep(s);
    // 월말·다음 달 월급날에는 항상 합계가 맞는 가계부여야 한다
    if (s.phase === 'sim' && (s.step === 'report' || s.step === 'payday')) {
      expect(isBudgetValid(s.budget, salary)).toBe(true);
    }
    guard += 1;
    expect(guard).toBeLessThan(400); // 12달 × (payday+scene+outcome+report) 남짓이면 충분
  }
  return s;
}

describe('아무것도 안 하는 학생 (기본값 함수만으로 1년 완주)', () => {
  for (const salary of SALARIES) {
    for (const { label, answers } of ANSWER_SETS) {
      it(`월급 ${salary}원 · ${label}: 예외 없이 결산까지`, () => {
        const s = autoYear(salary, answers);
        expect(s.phase).toBe('result');
        expect(s.settlement).not.toBeNull();
        expect(s.history).toHaveLength(12);
        expect(s.settlement!.achievements).toHaveLength(13);
        // 모든 선택은 자동 처리로 기록됐다
        expect(s.decisions.length).toBeGreaterThan(0);
        expect(s.decisions.every((d) => d.auto === true)).toBe(true);
        // 기본값만 고른 학생은 늘 '빚과의 동거'로 끝난다: 2월 기본값 splurge(12개월 할부)가
        // 12월 결산 시점에 2개월치 남아 있기 때문이다 (부록 A 임시 수치, §4.5)
        const ending: EndingId = s.settlement!.ending;
        expect(ending).toBe('debt');
        expect(totalDebt(s)).toBeGreaterThan(0);
      });
    }
  }

  it('같은 입력은 항상 같은 1년이 된다 (결정성)', () => {
    const a = autoYear(BASE_SALARY, {});
    const b = autoYear(BASE_SALARY, {});
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
