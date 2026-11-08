// 테스트 공용 도구: 상태 빌더 + 수업 시뮬레이션 하네스(서버 미니 드라이버).
// 하네스는 docs/live-api.md §5.5(next 알고리즘)·§8.3(지각 합류 채우기)을 그대로 흉내 낸다.
import {
  SURVEY,
  autoDepositTarget,
  autoPaymentPlan,
  balanceBudget,
  choiceAvailability,
  defaultAnswers,
  getScene,
  step,
} from '@gagyebu/core';
import type { Action, Choice, GameState, QuestionId } from '@gagyebu/core';
import { beats } from './beats.ts';
import type { GagyebuConfig } from './config.ts';
import { allowed, done, fallback, initState, locate, previewFallback, transition } from './progress.ts';
import { stats } from './stats.ts';
import type { GagyebuStats } from './stats.ts';

export const cfg: GagyebuConfig = { guide: true, monthReveal: true, spotlight: true, confirmForce: true };
export const beatList = beats(cfg);
export const beatIndex = (id: string): number => {
  const i = beatList.findIndex((b) => b.id === id);
  if (i < 0) throw new Error(`비트 없음: ${id}`);
  return i;
};

export const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

export function apply(s: GameState, ...as: Action[]): GameState {
  return as.reduce((acc, a) => step(acc, a), s);
}

/** 기저 + start 행동까지 적용한 학생 (phase 'survey') */
export function student(nickname = '테스트'): GameState {
  const { state, actions } = initState({ nickname, random: () => 0.5 }, cfg);
  return apply(state, ...actions);
}

/** 설문·안내·가계부 확정까지 마친 학생 (phase 'sim', month 1, step 'payday') */
export function simStudent(nickname = '테스트'): GameState {
  return apply(
    student(nickname),
    { type: 'submitSurvey', answers: defaultAnswers({}) },
    { type: 'goto', phase: 'budget' },
    { type: 'confirmBudget' },
  );
}

/** 1월 튜토리얼을 마치고 2월 월급날에 있는 학생 */
export function atFebPayday(): GameState {
  return apply(simStudent(), { type: 'beginMonth' }, { type: 'choose', choiceId: 'ok' }, { type: 'continue' }, { type: 'endMonth' });
}

/** 2월 장면(start)에 서 있는 학생 */
export function atFebScene(): GameState {
  return apply(atFebPayday(), { type: 'beginMonth' });
}

/** done이 될 때까지 fallback을 반복 적용한다(서버의 기본값 루프, §5.5-3) */
export function runFallback(s: GameState, beat: number, draft?: unknown): GameState {
  let cur = s;
  for (let i = 0; i < 60 && !done(cur, beat, cfg); i++) {
    const r = fallback(cur, beat, cfg, draft);
    cur = step(cur, r.action);
  }
  return cur;
}

/** 결정적 시드 난수 (mulberry32) */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// 수업 시뮬레이션 하네스 (§5.5 + §8.3)

export type Behavior =
  | { kind: 'lazy' } // 어떤 work 비트에도 답하지 않는다
  | { kind: 'active' } // 비트가 끝날 때까지 직접 한다
  | { kind: 'partial'; rate: number }; // 참여 확률; 참여해도 중간에 그만둔다 (초안·지불 패널 남기기)

export interface StudentRec {
  id: string;
  nickname: string;
  state: GameState;
  draft: unknown;
  behavior: Behavior;
  /** 서버가 학생별 autoApplied 큐에 쌓는 것과 같은 모양 (§4.2) */
  notices: { beatId: string; message: string }[];
  stalled: boolean;
  /** 월별 자동 처리된 선택 기록 수(auto choose) — stats.autoCount 대조용 */
  autoChoose: Record<number, number>;
  budgetEdited: boolean;
  budgetStopped: boolean;
}

const MAX_FALLBACK_ITERATIONS = 50; // §4.2 기본값 루프 종료 보장

export class ClassHarness {
  cfg: GagyebuConfig = cfg;
  beats: typeof beatList = beatList;
  cursor = 0;
  revealed = false;
  students: StudentRec[] = [];
  rng: () => number;
  /** next 호출 수(공개 단계 포함) */
  nextCalls = 0;

  constructor(seed: number) {
    this.rng = mulberry32(seed);
  }

  // -- 학생 --

  join(nickname: string, behavior: Behavior): StudentRec {
    const num = this.students.length + 1;
    const { state, actions } = initState({ nickname, random: this.rng }, this.cfg);
    let s = state;
    for (const a of actions) s = this.applyTracked(null, s, a);
    const rec: StudentRec = {
      id: `s${num}`,
      nickname,
      state: s,
      draft: undefined,
      behavior,
      notices: [],
      stalled: false,
      autoChoose: {},
      budgetEdited: false,
      budgetStopped: false,
    };
    this.students.push(rec);
    if (this.cursor > 0) this.backfill(rec); // 지각 합류 채우기(§8.3)
    return rec;
  }

  /** 행동 적용 + 자동 선택 기록 추적 */
  private applyTracked(rec: StudentRec | null, s: GameState, a: Action): GameState {
    const ns = step(s, a);
    if (rec && a.type === 'choose' && a.auto === true) {
      rec.autoChoose[ns.month] = (rec.autoChoose[ns.month] ?? 0) + 1;
    }
    return ns;
  }

  /** 학생이 서버에 보내듯 행동을 검사·적용한다 (allowed → apply) */
  dispatch(rec: StudentRec, a: Action): void {
    const verdict = allowed(rec.state, this.cursor, a, this.cfg);
    if (verdict !== true) {
      throw new Error(`하네스: 학생 행동 거부 (${rec.id} @ ${this.beats[this.cursor]?.id}): ${verdict}`);
    }
    rec.state = this.applyTracked(rec, rec.state, a);
  }

  /** 이 학생이 지금 상태에서 보낼 다음 행동. 그만두면 null */
  private nextStudentAction(rec: StudentRec): Action | null {
    const s = rec.state;
    const beatId = this.beats[this.cursor]?.id ?? '';
    if (beatId === 'survey') {
      if (s.phase !== 'survey') return null;
      const answers: Partial<Record<QuestionId, string>> = {};
      for (const q of SURVEY) {
        const opts = q.options;
        answers[q.id] = opts[Math.floor(this.rng() * opts.length)]?.id;
      }
      return { type: 'submitSurvey', answers };
    }
    if (beatId === 'budget') {
      if (s.phase !== 'budget') return null;
      if (rec.behavior.kind === 'partial') {
        // 참여한 부분 게으른 학생: 가계부를 고쳐 놓고(초안O) 확정하지 않은 채 그만둔다
        if (rec.budgetStopped) return null;
        if (!rec.budgetEdited) {
          const edited = clone(s.budget);
          edited.transfers.emergency += 100_000; // 10만 원 초과 — 합계가 맞지 않는 편집 중인 안
          rec.budgetEdited = true;
          rec.budgetStopped = true;
          rec.draft = { kind: 'budget', budget: edited };
          return { type: 'setBudget', budget: edited };
        }
        return null;
      }
      // 활발한 학생: 절반은 가계부를 편집한 뒤(balanceBudget으로 합계 맞춤) 확정
      if (!rec.budgetEdited) {
        rec.budgetEdited = true;
        if (this.rng() < 0.5) {
          const edited = clone(s.budget);
          edited.transfers.emergency += 50_000;
          const { budget } = balanceBudget(edited, s.profile.salary);
          return { type: 'setBudget', budget };
        }
        return { type: 'confirmBudget' };
      }
      return { type: 'confirmBudget' };
    }
    // 월 비트 (m1..m12)
    if (s.phase === 'result') return null;
    if (s.step === 'payday') return { type: 'beginMonth' };
    if (s.step === 'scene' && s.current) {
      // 부분 게으른 학생은 장면(지불 패널 포함) 앞에서 자주 멈춘다
      if (rec.behavior.kind === 'partial' && this.rng() < 0.5) return null;
      // 가끔 운동화를 판다 (statusAction)
      const sneakers = s.statuses.find((x) => x.id === 'sneakers');
      if (sneakers && this.rng() < 0.15) {
        const targets = ['living', 'emergency', 'goal', 'invest'] as const;
        return {
          type: 'statusAction',
          status: 'sneakers',
          action: 'sellSneakers',
          depositTo: targets[Math.floor(this.rng() * targets.length)] ?? 'emergency',
        };
      }
      const { scene } = getScene(s.current);
      const enabled = scene.choices.filter((c) => choiceAvailability(s, c).enabled);
      const choice: Choice | undefined = enabled[Math.floor(this.rng() * enabled.length)];
      if (!choice) return null;
      const a: Extract<Action, { type: 'choose' }> = { type: 'choose', choiceId: choice.id };
      if (choice.pay) {
        a.payment = autoPaymentPlan(s, choice.pay).plan;
        if (choice.pay.adjustable) a.amount = choice.pay.adjustable.min;
      }
      if (choice.deposit) a.depositTo = autoDepositTarget(choice.deposit);
      return a;
    }
    if (s.step === 'outcome') return { type: 'continue' };
    if (s.step === 'adjust') {
      // 편집: 여가를 1만 원 줄이고 balanceBudget으로 합계를 맞춘다
      const edited = clone(s.budget);
      edited.expenses.leisure = Math.max(0, edited.expenses.leisure - 10_000);
      const { budget } = balanceBudget(edited, s.profile.salary);
      return { type: 'setBudget', budget };
    }
    return null; // report — 이 비트에서 할 일 끝
  }

  /** 학생이 이 live 비트에서 행동한다 (행동 유형별) */
  act(rec: StudentRec): void {
    const beat = this.beats[this.cursor];
    if (!beat || beat.mode !== 'work') return;
    if (rec.behavior.kind === 'lazy') return;
    if (rec.behavior.kind === 'partial' && this.rng() >= rec.behavior.rate) return;
    const maxSteps = rec.behavior.kind === 'active' ? 60 : 1 + Math.floor(this.rng() * 4);
    for (let i = 0; i < maxSteps; i++) {
      if (done(rec.state, this.cursor, this.cfg)) break;
      const a = this.nextStudentAction(rec);
      if (!a) break;
      this.dispatch(rec, a);
    }
  }

  studentTurn(): void {
    for (const rec of this.students) this.act(rec);
  }

  // -- 교사 next (§5.5) --

  /** 기본값 루프(§5.5-3). 통지는 notify가 true일 때만 학생 큐에 쌓는다(지각 채우기는 통지 없음, §8.3) */
  private fallbackLoop(rec: StudentRec, beat: number, notify: boolean): void {
    const beatId = this.beats[beat]?.id ?? `${beat}`;
    const notices: string[] = [];
    let overflow = false;
    let s = rec.state;
    for (let i = 0; i < MAX_FALLBACK_ITERATIONS; i++) {
      if (done(s, beat, this.cfg)) break;
      const r = fallback(s, beat, this.cfg, rec.draft);
      s = this.applyTracked(rec, s, r.action);
      notices.push(r.notice);
    }
    if (!done(s, beat, this.cfg)) {
      overflow = true;
      rec.stalled = true;
    }
    rec.state = s;
    rec.draft = undefined; // 초안은 이 비트에서 소진(§4.2)
    if (notify) {
      for (const message of notices) rec.notices.push({ beatId, message });
    }
    if (overflow) throw new Error(`하네스: 기본값 루프 50회 초과 (${rec.id} @ ${beatId})`);
  }

  /** 지각 합류 채우기(§8.3): live 비트 "바로 앞"까지 — work 비트마다 루프, 매 걸음 전이(live 비트로 들어가는 전이 포함) */
  private backfill(rec: StudentRec): void {
    for (let b = 0; b < this.cursor; b++) {
      if (this.beats[b]?.mode === 'work') this.fallbackLoop(rec, b, false);
      for (const a of transition(rec.state, b, b + 1, this.cfg)) {
        rec.state = this.applyTracked(rec, rec.state, a);
      }
    }
  }

  /** 교사 "다음" — 공개 단계 먼저, 마감·기본값·전이·커서 이동 (§5.5) */
  nextBeat(): void {
    this.nextCalls++;
    const beat = this.beats[this.cursor];
    if (beat?.reveal && !this.revealed) {
      this.revealed = true; // §5.5-1: "다음" 하나가 공개 → 다음 비트 순서로 동작
      return;
    }
    if (this.cursor >= this.beats.length - 1) throw new Error('하네스: 마지막 비트에서 next');
    const to = this.cursor + 1;
    for (const rec of this.students) {
      if (done(rec.state, this.cursor, this.cfg)) continue;
      this.fallbackLoop(rec, this.cursor, true); // §5.5-3 마감
    }
    for (const rec of this.students) {
      for (const a of transition(rec.state, this.cursor, to, this.cfg)) {
        rec.state = this.applyTracked(rec, rec.state, a); // §5.5-4 전이 — 완료 학생 포함 전원
      }
    }
    this.cursor = to; // §5.5-5
    this.revealed = false;
  }

  /** 커서 비트의 통계(§5.1의 stats 계산과 같은 것) */
  statsAt(beat: number): GagyebuStats {
    return stats(this.students.map((r) => r.state), beat, this.cfg);
  }

  /** 수업 끝까지 진행 (마지막 비트 present에서 멈춘다). 공개 비트는 next 두 번으로 넘어간다 */
  runToEnd(): void {
    while (this.cursor < this.beats.length - 1) {
      this.studentTurn();
      this.nextBeat(); // 공개 비트면 첫 호출은 공개(§5.5-1), 다음 반복에서 넘어간다
    }
  }

  /** 미완료 학생 수 (진행 판정용) */
  pendingCount(): number {
    return this.students.filter((r) => !done(r.state, this.cursor, this.cfg)).length;
  }

  /** 모든 학생 상태에서 locate·previewFallback·fallback을 불러도 예외가 없는지 (fuzz) */
  fuzzDisplayHelpers(): void {
    for (const rec of this.students) {
      void locate(rec.state);
      void previewFallback(rec.state, this.cursor, this.cfg);
      if (!done(rec.state, this.cursor, this.cfg)) {
        void fallback(rec.state, this.cursor, this.cfg, rec.draft); // 예외 없이 걸음을 만드는지
      }
    }
  }
}
