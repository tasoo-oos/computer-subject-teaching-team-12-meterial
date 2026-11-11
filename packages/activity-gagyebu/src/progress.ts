// 비트별 allowed / done / fallback / transition / previewFallback / locate (docs/live-api.md §9.3).
// 계약: fallback은 한 번 호출될 때마다 상태를 반드시 진전시킨다(같은 행동 반복 금지, §14 #6).
// 함수 자체는 어떤 상태에서도 예외를 던지지 않는다(도달 불가능한 상태에 대한 방어 경로는 §14 참조).
import {
  EXPENSES,
  autoDepositTarget,
  autoPaymentPlan,
  balanceBudget,
  canStep,
  createInitialState,
  defaultAnswers,
  fallbackChoice,
  formatMan,
  getScene,
  isBudgetValid,
} from '@gagyebu/core';
import type { Action, Budget, ExpenseId, GameState, PaySpec, Scene } from '@gagyebu/core';
import type { FallbackResult } from '@gagyebu/live';
import { beats } from './beats.ts';
import type { GagyebuConfig } from './config.ts';
import type { GagyebuDraft } from './draft.ts';
import { sceneLabel } from './stats.ts';

/** 비트 인덱스 → 비트 id. 없는 인덱스면 null */
function beatId(cfg: GagyebuConfig, beat: number): string | null {
  return beats(cfg)[beat]?.id ?? null;
}

/** 'm3' → 3. 월 비트가 아니면 null */
function monthOf(id: string | null): number | null {
  const m = /^m(\d+)$/.exec(id ?? '');
  return m ? Number(m[1]) : null;
}

// ---------------------------------------------------------------------------
// allowed (§9.3 — 비트별 학생 행동 허용 목록)

/** 학생이 이 비트에서 이 행동을 받을 수 있는지. 서버는 act의 allowed 검사로 쓴다 */
export function allowed(s: GameState, beat: number, a: Action, cfg: GagyebuConfig): true | string {
  // auto 표시는 서버·활동의 기본값 처리만 붙일 수 있다(core-api §4.2) — 학생 행동에서는 거부
  if ('auto' in a && (a as { auto?: true }).auto === true) {
    return '자동 처리 행동은 보낼 수 없어요.';
  }
  const id = beatId(cfg, beat);
  if (id === null) return '알 수 없는 단계예요.';
  switch (id) {
    case 'survey':
      if (a.type !== 'submitSurvey') return '설문 단계에서는 설문 제출만 할 수 있어요.';
      break;
    case 'budget':
      if (a.type !== 'setBudget' && a.type !== 'confirmBudget') {
        return '가계부 작성 단계에서는 가계부 편집·확정만 할 수 있어요.';
      }
      break;
    default: {
      const month = monthOf(id);
      if (month !== null && month <= 11) {
        if (s.month !== month) return `지금은 ${month}월 단계가 아니에요.`;
        switch (a.type) {
          case 'beginMonth':
          case 'choose':
          case 'continue':
          case 'statusAction':
            break;
          case 'setBudget':
            if (s.step !== 'adjust') return '가계부 조정 단계에서만 가계부를 고칠 수 있어요.';
            break;
          default:
            return '지금은 할 수 없어요.';
        }
        break;
      }
      if (month === 12) {
        if (s.month !== 12) return '지금은 12월 결산 단계가 아니에요.';
        if (a.type !== 'beginMonth') return '12월 결산에서는 결산 시작만 할 수 있어요.';
        break;
      }
      // join·salary·survey-result·guide-*·present — 학생 행동 없음 (reset·goto·endMonth도 여기서 거부)
      return '지금은 선생님이 화면을 넘기는 단계예요.';
    }
  }
  return canStep(s, a);
}

// ---------------------------------------------------------------------------
// done (§9.3 표)

/** 이 비트에서 학생이 할 일을 다 했는지. 완료 인원·next 마감 판정에 쓴다 */
export function done(s: GameState, beat: number, cfg: GagyebuConfig): boolean {
  const id = beatId(cfg, beat);
  if (id === null) return true; // 모르는 비트 — 마감 판정을 방해하지 않는다
  if (id === 'survey') return s.survey.result !== null;
  if (id === 'budget') return s.phase === 'sim';
  const month = monthOf(id);
  if (month !== null && month <= 11) return s.month === month && s.step === 'report';
  if (month === 12) return s.phase === 'result';
  return true; // join·salary·survey-result·guide-*·present (§9.3: 항상 true)
}

// ---------------------------------------------------------------------------
// 공용 조각

/** 초안에서 가계부를 꺼낸다(§9.5 — 초안은 가계부 편집 중인 안만 실린다) */
function draftBudget(draft: unknown | undefined): Budget | null {
  if (draft && typeof draft === 'object' && (draft as GagyebuDraft).kind === 'budget') {
    const b = (draft as GagyebuDraft).budget;
    // 알려진 필드만 꺼낸다(예전 초안의 livingBuffer 같은 필드는 버린다)
    if (b && typeof b === 'object' && b.transfers && b.expenses) return { transfers: b.transfers, expenses: b.expenses };
  }
  return null;
}

/** balanceBudget 결과로 만드는 안내 문구 (§9.3 예시 문형) */
function budgetNotice(changes: { key: string; before: number; after: number }[]): string {
  const total = changes.reduce((acc, c) => acc + (c.after - c.before), 0);
  if (total < 0) {
    const first = changes[0];
    const where = first ? (EXPENSES[first.key as ExpenseId]?.label ?? '여가·문화') : '여가·문화';
    return `제출하지 않아 월급을 넘은 ${formatMan(-total)}을(를) ${where}에서 줄였어요`;
  }
  return '제출하지 않아 가계부 합계를 자동으로 맞췄어요';
}

/** 조정 단계(adjust)의 기본값: 합계를 맞춘 가계부. 이걸로 조정 단계가 저절로 끝난다(§9.3, 통합 메모 b) */
function adjustFallback(s: GameState, draft: unknown | undefined): FallbackResult<Action> {
  const src = draftBudget(draft) ?? s.budget;
  const { budget, changes } = balanceBudget(src, s.profile.salary);
  return { action: { type: 'setBudget', budget, auto: true }, notice: budgetNotice(changes) };
}

/** 장면의 기본 선택지를 고르는 choose 행동 (§9.3 규칙 3 — 선택지 kind가 아니라 pay/deposit 존재 기준).
 *  선택지가 하나뿐인 확인 장면(welcome·aftermath·vanished)은 안내 없이 넘어간다(§14 #123 — 절차적 걸음). */
function chooseFallback(s: GameState, scene: Scene): FallbackResult<Action> {
  const choice = fallbackChoice(scene);
  const action: Extract<Action, { type: 'choose' }> = { type: 'choose', choiceId: choice.id, auto: true };
  if (choice.pay) {
    const pay: PaySpec = choice.pay;
    action.payment = autoPaymentPlan(s, pay).plan;
    if (pay.adjustable) action.amount = pay.adjustable.min; // adjustable이면 금액을 행동에 명시적으로 싣는다
  }
  if (choice.deposit) action.depositTo = autoDepositTarget(choice.deposit);
  return {
    action,
    notice:
      scene.choices.length > 1
        ? `시간 안에 고르지 못해 '${choice.label}'이(가) 자동으로 선택됐어요`
        : '', // 대안이 없는 확인 장면 — 알림 없음
  };
}

/** 월 비트(m1..m11, m12)의 기본값 한 걸음 (§9.3 월 비트 fallback 규칙 1~5).
 *  순수 절차적 걸음(auto beginMonth·continue·재현 endMonth)의 notice는 '' — 학생 안내가 없다(§14 #123). */
function monthFallback(s: GameState, target: number, draft: unknown | undefined): FallbackResult<Action> {
  if (s.phase !== 'sim') return genericFallback(s, draft);
  if (s.step === 'report') {
    if (s.month < target) {
      // 재현 규칙(§9.3 규칙 1): stalled 학생이 뒤처진 달을 따라잡는다 — 여러 번 나올 수 있다
      return { action: { type: 'endMonth' }, notice: '' };
    }
    return { action: { type: 'continue' }, notice: '' }; // done 상태 — 호출되지 않는다(방어)
  }
  if (s.step === 'payday') {
    return { action: { type: 'beginMonth' }, notice: '' };
  }
  if (s.step === 'scene' && s.current) {
    const { scene } = getScene(s.current);
    return chooseFallback(s, scene);
  }
  if (s.step === 'outcome') {
    return { action: { type: 'continue' }, notice: '' };
  }
  return adjustFallback(s, draft); // step === 'adjust'
}

/** 가계부 작성 비트의 기본값 (§9.3: setBudget으로 합계 맞추기 → confirmBudget, 각각 notice).
 *  이미 합계가 맞으면 setBudget을 건너뛰고 confirmBudget 한 걸음으로 끝낸다(진전 보장, §14). */
function budgetBeatFallback(s: GameState, draft: unknown | undefined): FallbackResult<Action> {
  if (s.phase !== 'budget') return genericFallback(s, draft);
  if (isBudgetValid(s.budget, s.profile.salary)) {
    return { action: { type: 'confirmBudget', auto: true }, notice: '제출하지 않아 지금 가계부가 자동으로 확정됐어요' };
  }
  const src = draftBudget(draft) ?? s.budget;
  const { budget, changes } = balanceBudget(src, s.profile.salary);
  return { action: { type: 'setBudget', budget, auto: true }, notice: budgetNotice(changes) };
}

/** 도달할 수 없는 상태(전이 누락 등)를 위한 방어 기본값 — 어떤 상태든 예외 없이 다음 걸음을 만든다 */
function genericFallback(s: GameState, draft: unknown | undefined): FallbackResult<Action> {
  switch (s.phase) {
    case 'start':
      return {
        action: { type: 'start', nickname: s.profile.nickname || '학생' },
        notice: '시작 처리가 자동으로 진행됐어요',
      };
    case 'survey':
      return {
        action: { type: 'submitSurvey', answers: defaultAnswers({}), auto: true },
        notice: '제출하지 않아 모든 문항이 기본 답안으로 제출됐어요',
      };
    case 'guide':
      return { action: { type: 'goto', phase: 'budget' }, notice: '다음 단계로 자동으로 넘어갔어요' };
    case 'budget':
      return budgetBeatFallback(s, draft);
    case 'sim':
      if (s.step === 'adjust') return adjustFallback(s, draft);
      if (s.step === 'scene' && s.current) {
        const { scene } = getScene(s.current);
        return chooseFallback(s, scene);
      }
      if (s.step === 'outcome') return { action: { type: 'continue' }, notice: '' };
      if (s.step === 'payday') return { action: { type: 'beginMonth' }, notice: '' };
      return { action: { type: 'endMonth' }, notice: '' };
    case 'result':
      return { action: { type: 'continue' }, notice: '이미 1년을 마쳤어요' }; // 도달 불가 — done이 항상 true
  }
}

// ---------------------------------------------------------------------------
// fallback (§9.3 표 + 월 비트 규칙)

/** 끝내지 못한 학생에게 적용할 다음 기본 행동 */
export function fallback(
  s: GameState,
  beat: number,
  cfg: GagyebuConfig,
  draft: unknown | undefined,
): FallbackResult<Action> {
  const id = beatId(cfg, beat);
  if (id === 'survey') {
    return {
      action: { type: 'submitSurvey', answers: defaultAnswers({}), auto: true },
      notice: '제출하지 않아 모든 문항이 기본 답안으로 제출됐어요',
    };
  }
  if (id === 'budget') return budgetBeatFallback(s, draft);
  const month = monthOf(id);
  if (month !== null) return monthFallback(s, month, draft);
  // join·salary·survey-result·guide-*·present: done이 항상 true라 서버가 호출하지 않는다(방어)
  return genericFallback(s, draft);
}

// ---------------------------------------------------------------------------
// transition (§9.3 표)

/** 비트 이동 시 모든 학생에게 대신 실행하는 전이. 해당 없으면 [] */
export function transition(s: GameState, from: number, to: number, cfg: GagyebuConfig): Action[] {
  if (to !== from + 1) return []; // next는 한 비트씩만 움직인다(방어)
  const fromId = beatId(cfg, from);
  const toId = beatId(cfg, to);
  if (fromId === null || toId === null) return [];
  if (toId === 'budget') {
    // 안내 마지막(cfg.guide=false면 설문 결과) → 가계부: 안내 단계 학생만 (§9.3)
    return s.phase === 'guide' ? [{ type: 'goto', phase: 'budget' }] : [];
  }
  const fromMonth = monthOf(fromId);
  const toMonth = monthOf(toId);
  if (fromMonth !== null && toMonth === fromMonth + 1) {
    // m(N) → m(N+1): 리포트 단계만 endMonth — 마감 루프를 거치면 항상 report다(§9.3 방어 코드)
    return s.phase === 'sim' && s.step === 'report' ? [{ type: 'endMonth' }] : [];
  }
  return [];
}

// ---------------------------------------------------------------------------
// previewFallback / locate (§9.4, §4.2)

/** 통제 "기본값 미리보기" — §9.4 정의 그대로: 현재 장면의 기본 선택지 라벨. 장면 밖 단계는 null */
export function previewFallback(s: GameState, _beat: number, _cfg: GagyebuConfig): string | null {
  if (s.step !== 'scene' || !s.current) return null;
  try {
    const { scene } = getScene(s.current);
    return fallbackChoice(scene).label;
  } catch {
    return null;
  }
}

/** 미완료 명단용 "지금 있는 장면" 짧은 문구 (예: "2월 · 중고거래 판매자") */
export function locate(s: GameState): string | null {
  switch (s.phase) {
    case 'start':
      return '시작 화면';
    case 'survey':
      return '소비습관 설문';
    case 'guide':
      return '안내 카드';
    case 'budget':
      return '가계부 작성';
    case 'sim': {
      const m = `${s.month}월`;
      if (s.step === 'payday') return `${m} · 월급날`;
      if (s.step === 'outcome') return `${m} · 결과 확인`;
      if (s.step === 'adjust') return `${m} · 가계부 조정`;
      if (s.step === 'report') return `${m} · 월말 리포트`;
      if (s.current) {
        try {
          const { event, scene } = getScene(s.current);
          // 시작 장면은 이벤트 제목이 더 알려 주지만, 이어진 장면이 이벤트 제목으로
          // 떨어지면 정체를 알 수 없다 — 장면 스스로의 이름(§14 #125)으로 폴백한다
          const isEntry =
            event.entry === scene.id || (event.entryVariants ?? []).some((v) => v.scene === scene.id);
          const name = scene.title ?? scene.speaker ?? (isEntry ? event.title : sceneLabel(scene));
          return `${m} · ${name}`;
        } catch {
          return `${m} · 장면`;
        }
      }
      return `${m} · 장면`;
    }
    case 'result':
      return '1년 결산 완료';
  }
}

// ---------------------------------------------------------------------------
// init (§4.2) — index.ts가 쓴다

/** 학생 입장 때의 기저 상태 + 즉시 적용할 행동. 월급은 모두 같아 난수를 쓰지 않는다(§4.2) */
export function initState(
  ctx: { nickname: string; random: () => number },
  _cfg: GagyebuConfig,
): { state: GameState; actions: Action[] } {
  return {
    state: createInitialState(ctx.nickname),
    actions: [{ type: 'start', nickname: ctx.nickname }],
  };
}
