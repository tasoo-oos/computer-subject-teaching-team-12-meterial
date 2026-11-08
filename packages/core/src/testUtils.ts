// 테스트 공용 도구. 테스트 파일에서만 쓴다 (index.ts에서 내보내지 않는다).
import { autoDepositTarget, autoPaymentPlan, balanceBudget, fallbackChoice, step } from './engine.ts';
import { getScene } from './selectors.ts';
import type { Action, Budget, GameState, Won } from './types.ts';

/** 시드 난수 (결정적 테스트용) */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 입력 불변 테스트용: 재귀적으로 얼린다 */
export function deepFreeze<T>(x: T): T {
  if (x !== null && (typeof x === 'object' || Array.isArray(x))) {
    Object.freeze(x);
    for (const v of Object.values(x as Record<string, unknown>)) deepFreeze(v);
  }
  return x;
}

export function cloneBudget(b: Budget): Budget {
  return { transfers: { ...b.transfers }, expenses: { ...b.expenses }, livingBuffer: b.livingBuffer };
}

export function play(s: GameState, actions: Action[]): GameState {
  return actions.reduce((st, a) => step(st, a), s);
}

/** live-api §9.3의 월 비트 fallback 규칙을 그대로 흉내 낸 한 걸음 */
export function fallbackStep(s: GameState): GameState {
  if (s.phase === 'sim' && s.step === 'payday') return step(s, { type: 'beginMonth' });
  if (s.phase === 'sim' && s.step === 'scene' && s.current) {
    const scene = getScene(s.current).scene;
    const choice = fallbackChoice(scene);
    if (choice.pay) {
      const amount = choice.pay.adjustable ? choice.pay.adjustable.min : undefined;
      const { plan } = autoPaymentPlan(s, choice.pay);
      return step(s, { type: 'choose', choiceId: choice.id, amount, payment: plan, auto: true });
    }
    if (choice.deposit) {
      return step(s, { type: 'choose', choiceId: choice.id, depositTo: autoDepositTarget(choice.deposit), auto: true });
    }
    return step(s, { type: 'choose', choiceId: choice.id, auto: true });
  }
  if (s.phase === 'sim' && s.step === 'outcome') return step(s, { type: 'continue' });
  if (s.phase === 'sim' && s.step === 'adjust')
    return step(s, { type: 'setBudget', budget: balanceBudget(s.budget, s.profile.salary).budget, auto: true });
  return step(s, { type: 'endMonth' }); // report
}
