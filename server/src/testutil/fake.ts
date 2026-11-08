// 테스트 전용 가짜 활동·테스트 레슨 (docs/live-api.md §4.2 계약을 따름).
// 프로덕션 레지스트리(server/src/activities.ts)에는 등록하지 않는다.
// 서버가 ActivityLogic에 대해 제네릭으로 동작함을 검증한다: work 비트·공개·
// 여러 걸음 기본값·전이·집계·CSV 내보내기.
import type { ActivityLogic, ActivityInitCtx, Beat, DeckManifest, FallbackResult, Lesson } from '@gagyebu/live';

export interface FakeState {
  name: string;
  count: number;
  marks: string[];
}

export type FakeAction =
  | { type: 'start'; nickname: string; bonus: number } // init이 주입 난수를 여기 박는다(§4.2)
  | { type: 'add'; n: number }
  | { type: 'mark'; label: string };

export interface FakeStats {
  kind: 'counter';
  beat: number;
  sum: number;
  doneCount: number;
  names: string[];
}

export interface FakeConfig {
  confirmForce?: boolean;
  /** true면 fallback이 상태를 진전시키지 않는다(50회 가드 → stalled 검증) */
  stuck?: boolean;
  /** true면 fallback notice로 ''을 반환한다(빈 안내 무시 검증, §14 #134) */
  emptyNotice?: boolean;
}

/** 비트: 0 join(work) · 1 setup(work) · 2 mid(work+reveal) · 3 show(show) · 4 final(work) */
export const fakeBeats: Beat[] = [
  { id: 'join', label: '입장', mode: 'work' },
  { id: 'setup', label: '준비', mode: 'work' },
  { id: 'mid', label: '중간', mode: 'work', reveal: true, notes: '발표자 노트' },
  { id: 'show', label: '보기', mode: 'show' },
  { id: 'final', label: '마무리', mode: 'work' },
];

export const fakeLogic: ActivityLogic<FakeConfig, FakeState, FakeAction, FakeStats> = {
  id: 'fake',
  beats: () => fakeBeats,
  init: (ctx: ActivityInitCtx, cfg: FakeConfig): { state: FakeState; actions: FakeAction[] } => {
    // 기저 상태는 결정적(난수 소비 금지) — 난수값은 행동에 박힌다(§4.2).
    void cfg;
    const base: FakeState = { name: ctx.nickname, count: 0, marks: [] };
    const bonus = Math.floor(ctx.random() * 10);
    return { state: base, actions: [{ type: 'start', nickname: ctx.nickname, bonus }] };
  },
  allowed: (s, beat, a): true | string => {
    if (s.count < 0) return 'state-broken';
    if (a.type === 'mark') return true;
    if (a.type === 'add') return beat === 0 ? 'add는 입장 비트에서 못 한다' : true;
    return 'start는 이미 처리됐다';
  },
  apply: (s, a): FakeState => {
    switch (a.type) {
      case 'start':
        return { ...s, count: s.count + a.bonus };
      case 'add':
        return { ...s, count: s.count + a.n };
      case 'mark':
        return { ...s, marks: [...s.marks, a.label] };
    }
  },
  done: (s, beat): boolean => {
    if (beat === 0) return true; // 입장 — 플랫폼 판정(§9.6)
    if (beat === 1) return s.count >= 1;
    if (beat === 2) return s.count >= 3;
    if (beat === 4) return s.count >= 5;
    return true; // show 비트
  },
  fallback: (s, beat, cfg): FallbackResult<FakeAction> => {
    if (cfg.stuck) return { action: { type: 'add', n: 0 }, notice: '멈춤' }; // 진전 없음 → 50회 가드
    if (cfg.emptyNotice) return { action: { type: 'add', n: 1 }, notice: '' }; // 순차 처리 걸음 — 안내 없음
    void s;
    void beat;
    return { action: { type: 'add', n: 1 }, notice: `자동 +1 (비트 ${beat})` };
  },
  transition: (s, from, to): FakeAction[] => {
    void s;
    if (from === 1 && to === 2) return [{ type: 'mark', label: 't12' }];
    if (from === 3 && to === 4) return [{ type: 'mark', label: 't34' }];
    return [];
  },
  stats: (states, beat): FakeStats => ({
    kind: 'counter',
    beat,
    sum: states.reduce((acc, s) => acc + s.count, 0),
    doneCount: states.filter((s) => fakeLogic.done(s, beat, {})).length,
    names: states.map((s) => s.name),
  }),
  locate: (s) => `카운트 ${s.count}`,
  previewFallback: (s) => `+1로 자동 (현재 ${s.count})`,
  exportColumns: ['studentId', 'nickname', 'count', 'marks'],
  exportRows: (s, student) => [
    { studentId: student.studentId, nickname: student.nickname, count: s.count, marks: s.marks.join('|') },
  ],
};

/** 활동 로직이 예외를 던져도 서버가 죽지 않는지 검증용 */
export const throwingLogic: ActivityLogic<unknown, unknown, unknown, unknown> = {
  id: 'throwing',
  beats: () => [{ id: 'w', label: '작업', mode: 'work' }],
  init: () => {
    throw new Error('init stub');
  },
  allowed: () => {
    throw new Error('allowed stub');
  },
  apply: () => {
    throw new Error('apply stub');
  },
  done: () => {
    throw new Error('done stub');
  },
  fallback: () => {
    throw new Error('fallback stub');
  },
  transition: () => {
    throw new Error('transition stub');
  },
  stats: () => {
    throw new Error('stats stub');
  },
};

// ── 테스트 레슨 ────────────────────────────────────────────────────────────

const introDeck: DeckManifest = {
  id: 'intro',
  title: '도입',
  slides: [
    { id: 'hello', label: '인사', notes: '발표자 노트(통제 전용이어야 한다)' },
    { id: 'why', label: '이유', steps: 2 },
  ],
};

const outroDeck: DeckManifest = {
  id: 'outro',
  title: '마무리',
  slides: [{ id: 'bye', label: '끝', notes: '마무리 노트' }],
};

/** 슬라이드 3비트 + 가짜 활동 5비트 + 슬라이드 1비트 = 9비트 */
export const testLesson: Lesson = {
  id: 'test-lesson',
  title: '테스트 레슨',
  settings: { showProgressOnStage: false },
  segments: [
    { kind: 'slides', id: 'intro', deck: introDeck },
    { kind: 'activity', id: 'game', activity: 'fake', config: { confirmForce: true } },
    { kind: 'slides', id: 'outro', deck: outroDeck },
  ],
};

/** confirmForce 없는 변형(강제 확인 없이 바로 기본값) */
export const noConfirmLesson: Lesson = {
  ...testLesson,
  id: 'test-noconfirm',
  segments: [
    { kind: 'slides', id: 'intro', deck: introDeck },
    { kind: 'activity', id: 'game', activity: 'fake', config: { confirmForce: false } },
    { kind: 'slides', id: 'outro', deck: outroDeck },
  ],
};

/** stuck 활동: fallback이 진전하지 않는다(50회 가드 → stalled) */
export const stuckLesson: Lesson = {
  ...testLesson,
  id: 'test-stuck',
  segments: [
    { kind: 'slides', id: 'intro', deck: introDeck },
    { kind: 'activity', id: 'game', activity: 'fake', config: { confirmForce: true, stuck: true } },
    { kind: 'slides', id: 'outro', deck: outroDeck },
  ],
};

/** 빈 안내 fallback: notice가 ''인 걸음 — 큐에 쌓이지 않는다(§14 #134) */
export const quietLesson: Lesson = {
  ...testLesson,
  id: 'test-quiet',
  segments: [
    { kind: 'slides', id: 'intro', deck: introDeck },
    { kind: 'activity', id: 'game', activity: 'fake', config: { confirmForce: true, emptyNotice: true } },
    { kind: 'slides', id: 'outro', deck: outroDeck },
  ],
};

/** 슬라이드만 있는 레슨(봇·스모크용) */
export const slidesOnlyLesson: Lesson = {
  id: 'test-slides',
  title: '슬라이드만',
  settings: { showProgressOnStage: false },
  segments: [
    { kind: 'slides', id: 'intro', deck: introDeck },
    { kind: 'slides', id: 'outro', deck: outroDeck },
  ],
};

/** 활동 로직이 예외를 던지는 레슨(degraded join 검증) */
export const throwingLesson: Lesson = {
  ...testLesson,
  id: 'test-throwing',
  segments: [
    { kind: 'slides', id: 'intro', deck: introDeck },
    { kind: 'activity', id: 'boom', activity: 'throwing', config: {} },
    { kind: 'slides', id: 'outro', deck: outroDeck },
  ],
};

export const testActivities = { fake: fakeLogic, throwing: throwingLogic };
