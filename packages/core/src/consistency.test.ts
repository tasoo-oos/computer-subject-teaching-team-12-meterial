// canStep/step 일치: 무작위(시드 고정) 행동 시퀀스에 대해 canStep이 true인 경우 step이 성공,
// 문구를 돌려주는 경우 같은 이유의 StepError가 나는지 확인한다 (§4.4).
// 모든 step 호출은 얼린 입력으로 원본 불변도 함께 검사한다.
import { describe, expect, it } from 'vitest';
import {
  autoPaymentPlan,
  balanceBudget,
  canStep,
  createInitialState,
  defaultAnswers,
  step,
  StepError,
} from './engine.ts';
import { BASE_SALARY } from './data/constants.ts';
import { getScene } from './selectors.ts';
import { cloneBudget, deepFreeze, fallbackStep, mulberry32 } from './testUtils.ts';
import type { Action, GameState, PaymentPlan, Won } from './types.ts';

const SALARIES: Won[] = [BASE_SALARY];

function newGame(rand: () => number): GameState {
  const salary = SALARIES[Math.floor(rand() * SALARIES.length)] as Won;
  let s = createInitialState('씨앗');
  s = step(s, { type: 'start', nickname: '씨앗' });
  s = step(s, { type: 'submitSurvey', answers: defaultAnswers(rand() < 0.5 ? {} : { meal: 'gt15', impulse: 'buy' }) });
  s = step(s, { type: 'goto', phase: 'budget' });
  s = step(s, { type: 'setBudget', budget: balanceBudget(s.budget, salary).budget });
  s = step(s, { type: 'confirmBudget' });
  return s;
}

/** 상태를 보고 그럴듯한 무작위 행동을 만든다 (유효한 것과 깨진 것을 섞는다) */
function randomAction(rand: () => number, s: GameState): Action {
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)] as T;
  const types = [
    'start',
    'submitSurvey',
    'goto',
    'setBudget',
    'confirmBudget',
    'beginMonth',
    'choose',
    'continue',
    'statusAction',
    'endMonth',
    'reset',
  ] as const;
  const type = pick(types);
  switch (type) {
    case 'start':
      return { type: 'start', nickname: pick(['하늘', '', '열글자를넘는닉네임입니다', '바']) };
    case 'submitSurvey':
      return {
        type: 'submitSurvey',
        answers: pick([defaultAnswers({}), { meal: '5to10' }, { meal: '없는보기' }, {}] as const),
      };
    case 'goto':
      return { type: 'goto', phase: pick(['budget', 'guide'] as const) };
    case 'setBudget': {
      const b = cloneBudget(s.budget);
      if (rand() < 0.3) b.expenses.food = -1; // 음수 항목
      else if (rand() < 0.5) b.expenses.leisure += 3_000_000; // 월급 초과
      return { type: 'setBudget', budget: b };
    }
    case 'confirmBudget':
      return { type: 'confirmBudget' };
    case 'beginMonth':
      return { type: 'beginMonth' };
    case 'choose': {
      if (!s.current) return { type: 'choose', choiceId: 'nope' };
      const scene = getScene(s.current).scene;
      const choiceId = rand() < 0.2 ? 'nope' : pick(scene.choices).id;
      const choice = scene.choices.find((c) => c.id === choiceId);
      if (!choice?.pay) return { type: 'choose', choiceId };
      if (rand() < 0.4) {
        // 유효한 자동 계획 (adjustable이면 최솟값)
        const amount = choice.pay.adjustable ? choice.pay.adjustable.min : undefined;
        const { plan } = autoPaymentPlan(s, choice.pay);
        return { type: 'choose', choiceId, amount, payment: plan };
      }
      // 깨진 계획들
      const broken: PaymentPlan[] = [
        { parts: [{ source: 'living', amount: 1 }] }, // 합계 불일치
        { parts: [{ source: 'living', amount: 999_999_999 }] }, // 잔고 초과
        { parts: [{ source: 'housing', amount: 1 }] }, // 허용 밖 수단일 수 있음
        { parts: [], card: { amount: 1, months: 6 } }, // 개월 위반 가능
        { parts: [{ source: 'living', amount: -5 }] }, // 음수
      ];
      return { type: 'choose', choiceId, payment: pick(broken) };
    }
    case 'continue':
      return { type: 'continue' };
    case 'statusAction':
      return {
        type: 'statusAction',
        status: pick(['sneakers', 'noLaptop', 'revolving'] as const),
        action: (rand() < 0.5 ? 'sellSneakers' : 'bogus') as 'sellSneakers',
        depositTo: rand() < 0.5 ? 'emergency' : undefined,
      };
    case 'endMonth':
      return { type: 'endMonth' };
    case 'reset':
      return { type: 'reset' };
  }
}

describe('canStep/step 일치 (시드 무작위 행동)', () => {
  it('canStep이 true면 step이 성공, 문구면 같은 이유의 StepError, 원본 불변', () => {
    for (const seed of [7, 42, 2026]) {
      const rand = mulberry32(seed);
      let s = newGame(rand);
      expect(s.phase).toBe('sim');
      let applied = 0;
      for (let i = 0; i < 300; i++) {
        // reset 등으로 시뮬레이션을 벗어나면 새 게임을 시작한다
        if (s.phase !== 'sim') s = newGame(rand);
        // 진행용: 자주 올바른 행동을 적용한다 (기본값 경로, 얼린 입력으로 불변성 검사)
        if (rand() < 0.65) {
          const before = JSON.stringify(s);
          const frozen = deepFreeze(JSON.parse(before) as GameState);
          s = fallbackStep(frozen);
          expect(JSON.stringify(frozen)).toBe(before);
          applied += 1;
        }
        for (let k = 0; k < 4; k++) {
          const action = randomAction(rand, s);
          const before = JSON.stringify(s);
          const frozen = deepFreeze(JSON.parse(before) as GameState);
          const allowed = canStep(frozen, action);
          expect(JSON.stringify(frozen)).toBe(before); // canStep도 원본을 고치지 않는다
          if (allowed === true) {
            const next = step(frozen, action);
            expect(JSON.stringify(frozen)).toBe(before); // step은 입력을 고치지 않는다
            s = next;
            applied += 1;
          } else {
            let code: string | undefined;
            try {
              step(frozen, action);
            } catch (e) {
              expect(e).toBeInstanceOf(StepError);
              code = (e as StepError).code;
            }
            expect(code, `seed=${seed} i=${i} action=${JSON.stringify(action)}`).toBeDefined();
            expect(typeof allowed).toBe('string');
          }
        }
      }
      expect(applied).toBeGreaterThan(0);
    }
  });

  it('결정성: 같은 시드의 무작위 시퀀스를 두 번 돌리면 같은 상태가 나온다', () => {
    const run = (seed: number): string => {
      const rand = mulberry32(seed);
      let s = newGame(rand);
      for (let i = 0; i < 200; i++) {
        if (s.phase !== 'sim') break;
        if (rand() < 0.7) s = fallbackStep(s);
        else {
          const action = randomAction(rand, s);
          if (canStep(s, action) === true) s = step(s, action);
        }
      }
      return JSON.stringify(s);
    };
    expect(run(99)).toBe(run(99));
  });
});
