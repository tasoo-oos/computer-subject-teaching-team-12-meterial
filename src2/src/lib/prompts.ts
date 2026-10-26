import {
  ACCOUNT_ORDER,
  ACCOUNTS,
  PROMPTS,
  SURVEY,
  fillTemplate,
  formatMan,
  formatWon,
  resolveAmount,
  type GameEvent,
  type GameState,
  type PromptId,
  type Scene,
} from '@gagyebu/core';

function answerLabel(state: GameState, question: 'meal' | 'delivery', fallback: string): string {
  const q = SURVEY.find((x) => x.id === question);
  const opt = q?.options.find((o) => o.id === state.survey.answers[question]);
  return opt?.label ?? fallback;
}

export function budgetPrompt(state: GameState): string {
  return fillTemplate(PROMPTS.budget.template, {
    salary: formatWon(state.profile.salary).replace('원', ''),
    meal: answerLabel(state, 'meal', '5천~1만 원'),
    delivery: answerLabel(state, 'delivery', '1~2번'),
  });
}

/** 이벤트 장면에 맞는 AI 프롬프트를 채운다 */
export function scenePrompt(state: GameState, event: GameEvent, scene: Scene): { id: PromptId; stage: string; text: string } | null {
  if (!event.promptId) return null;
  const tpl = PROMPTS[event.promptId];
  const firstPay = scene.choices.find((c) => c.pay)?.pay;
  const amount = firstPay ? resolveAmount(state, firstPay.amount) : 0;
  const months = Math.max(3, ...scene.choices.flatMap((c) => c.pay?.cardMonths ?? (c.fixedPay?.cardMonths ? [c.fixedPay.cardMonths] : [])));
  const text = fillTemplate(tpl.template, {
    amount: formatWon(amount).replace('원', ''),
    accounts: ACCOUNT_ORDER.map((id) => `${ACCOUNTS[id].label} ${formatMan(state.accounts[id].balance)}`).join(', '),
    item: event.title,
    months,
    message: `"${scene.text}"`,
  });
  return { id: tpl.id, stage: tpl.stage, text };
}
