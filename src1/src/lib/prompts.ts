import { PROMPTS, SURVEY, fillTemplate, formatWon, type GameState, type QuestionId } from '@gagyebu/core';

function answerLabel(state: GameState, q: QuestionId, fallback: string): string {
  const id = state.survey.answers[q];
  const opt = SURVEY.find((x) => x.id === q)?.options.find((o) => o.id === id);
  return opt?.label ?? fallback;
}

export function budgetPrompt(state: GameState): string {
  return fillTemplate(PROMPTS.budget.template, {
    salary: formatWon(state.profile.salary).replace('원', ''),
    meal: answerLabel(state, 'meal', '5천~1만 원'),
    delivery: answerLabel(state, 'delivery', '1~2번'),
  });
}

import { ACCOUNT_ORDER, ACCOUNTS, PROMPTS as P, formatMan, resolveAmount, type GameEvent, type Scene } from '@gagyebu/core';

/** 이벤트의 promptId에 맞춰 지금 상황을 채운 프롬프트 */
export function scenePrompt(state: GameState, event: GameEvent, scene: Scene): string | null {
  if (!event.promptId) return null;
  const t = P[event.promptId];
  const firstPay = scene.choices.find((c) => c.pay)?.pay;
  const accounts = ACCOUNT_ORDER.filter((id) => state.accounts[id].balance > 0)
    .map((id) => `${ACCOUNTS[id].label} ${formatMan(state.accounts[id].balance)}`)
    .join(', ');
  return fillTemplate(t.template, {
    amount: firstPay ? formatWon(resolveAmount(state, firstPay.amount)).replace('원', '') : '',
    accounts,
    item: event.title,
    months: 3,
    message: `"${scene.text}"`,
  });
}
