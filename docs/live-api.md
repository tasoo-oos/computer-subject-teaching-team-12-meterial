# 수업 모드 API 명세 (`packages/live`, `server`, `lesson`, `packages/activity-gagyebu`)

- 작성일: 2026-11-09
- 상태: 명세(구현 전). 이 문서가 구현 계약이다. 여러 에이전트가 서로 말하지 않고 이 문서만 보고 구현할 수 있어야 한다.
- 관련 문서: `docs/live-classroom-plan.md`(계획·근거, 이 문서보다 위에 없다), `docs/core-api.md`(core API), `가계부-시나리오-수업-기획서.md` 5~6장(시뮬레이션 규칙), `src/DESIGN.md`(디자인 토큰·화면)
- 읽는 법: 모든 TypeScript 블록은 그대로 내보내야 하는 시그니처이다. 본문은 한국어, 식별자는 영어. 계획이 침묵하거나 코드와 어긋난 부분은 §14 「결정 사항」에 모두 적어 두었다.

## 0. 요약

교사가 통제 페이지에서 넘기면 반 전체가 같은 단계에 있는 중앙 통제식 수업 모드의 구현 계약.

| 페이지 | 주소 | 역할 |
| --- | --- | --- |
| 학생 | `/<숫자 4자리>` | 슬라이드 보기, 게임 조작, 제출 뒤 대기 |
| 전면 | `/stage` (전면 비밀번호) | 슬라이드, 장면, 익명 집계, 발표 |
| 통제 | `/control` (통제 비밀번호) | 수업 열기·끝내기, 다음/이전, 완료 인원, 학생 관리 |
| 개발 | `/dev` (통제 비밀번호) | 스냅숏 셸 (`pnpm shots`) |
| 혼자 | `/solo` (`SOLO_ENABLED=true`일 때만) | 네트워크 장애 시 비상용 로컬 모드 |

서버는 Node 24 단일 프로세스로 Socket.IO + 정적 파일 + 세션 로그를 함께 맡고, 빌드 단계 없이 `node --env-file=.env server/src/main.ts`로 실행한다. 게임 규칙은 `@gagyebu/core`의 `step()`(core-api.md §4), 진행·통신은 이 문서의 `@gagyebu/live` 프로토콜이 정한다.

---

## 1. 범위와 패키지 구조

### 1.1 새 워크스페이스 패키지

`pnpm-workspace.yaml`을 아래로 바꾼다.

```yaml
packages:
  - packages/*
  - src
  - server
  - lesson
```

| 패키지 | 폴더 | `exports` 진입 파일 | 역할 |
| --- | --- | --- | --- |
| `@gagyebu/live` (신규) | `packages/live` | `./src/index.ts` | 레슨·비트·커서 타입, 프로토콜, `ActivityLogic` 인터페이스, 슬라이드 세그먼트 논리 |
| `@gagyebu/activity-gagyebu` (신규) | `packages/activity-gagyebu` | `./src/index.ts` | 가계부 활동의 순수 로직: 비트 목록, 진행 판정, 기본값, 집계 |
| `@gagyebu/server` (신규) | `server` | `./src/main.ts` | Node 서버: Socket.IO, Room, 큐, 세션 로그, 비밀번호 로그인, 정적 파일 |
| `@gagyebu/lesson` (신규) | `lesson` | `./lesson.ts` | 수업 콘텐츠: 세그먼트 순서·설정, 덱 매니페스트(데이터만) |
| `@gagyebu/core` (기존, 확장) | `packages/core` | `./src/index.ts` | 게임 규칙·데이터 + `step()` (core-api.md 참조) |
| `@gagyebu/draft-kit` (기존) | `packages/draft-kit` | `./src/index.tsx` | 스냅숏 셸. §10.9의 새 어댑터 계약으로 바뀜 |
| `@gagyebu/app` (기존, 확장) | `src` | `./index.html` + Vite | 화면 앱. 수업 모드 셸·활동 화면·통제 페이지 추가 |

모든 신규 패키지의 `exports`는 소스 `.ts` 파일을 직접 가리킨다(빌드 없음). 서버 실행은 Node 24의 네이티브 타입 스트리핑에 의존한다.

### 1.2 의존 그래프 (import 가능 방향)

```
live (의존 없음) ←─ activity-gagyebu (core + live) ←─ lesson (live + activity-gagyebu)
                        ↑ core                                ↑
                        └────────────── server (live + activity-gagyebu + lesson)
                                                              ↑
src(app): 전부 + socket.io-client, qrcode
```

- `@gagyebu/core`: 의존 없음(기존 그대로). 게임 규칙·데이터만.
- `@gagyebu/live`: **의존 없음.** 플랫폼은 게임 규칙을 모른다(계획 §5.2의 3층 경계). 프로토콜의 게임 페이로드는 전부 제네릭 `unknown` 기본값(§5.1). **React·DOM·Node 전용 API 금지.**
- `@gagyebu/activity-gagyebu`: `core` + `live`. **React·DOM·Node 전용 API 금지.** 순수 함수만. core 타입(`GameState`·`Action`)을 아는 유일한 live 계층.
- `@gagyebu/lesson`: `live` + `activity-gagyebu`(설정 타입). 데이터만 담는다. **React 금지.**
- `@gagyebu/server`: `live` + `activity-gagyebu` + `lesson` + `socket.io`, `cookie`. Node 전용. **`@gagyebu/core`를 직접 import하지 않는다** — 활동 로직은 오직 `server/src/activities.ts` 레지스트리를 통해서만 쓰고, 게임 상태·행동은 `unknown`으로 다룬다. 다른 실습이 core를 갈아끼워도 서버는 그대로다.
- `@gagyebu/app`: 전부 + `socket.io-client`, `qrcode`. React 화면. 소켓 타이핑을 활동 계층(`useLive<S, A, D>`·`ActivityViews<S, A, Stats>`·`liveTypes.ts`, §5.1)에서 좁힌다.

금지 규칙(정적 검증 가능해야 한다): `packages/live`, `packages/activity-gagyebu`에서 `react`, `react-dom`, `node:*`, `DOM` 타입(`window`, `document`) import 금지. `packages/live`에서 `@gagyebu/core` import 금지. 타입만 쓸 때는 `import type`으로.

### 1.3 Node 24 네이티브 실행 제약 (서버가 import하는 모든 것)

서버는 빌드 단계가 없으므로, 서버 모듈 그래프 안(`server/**`, `packages/live/**`, `packages/activity-gagyebu/**`, `lesson/**`, `packages/core/**`)의 TS는 **지울 수 있는 구문(erasable syntax)** 만 쓴다.

- 금지: `enum`, `namespace`, 파라미터 프로퍼티(`constructor(private x: T)`), 데코레이터, JSX.
- 허용: `type`, `interface`, `as`, `satisfies`, 제네릭, 일반 `class`(JS 구문), `const`.
- import는 상대 경로 + 명시적 `.ts` 확장자(`import { x } from './types.ts'`). 타입은 `import type`.
- 패키지 간 import는 패키지 이름(`@gagyebu/live`)으로 하고, 각 `package.json`의 `exports`가 `./src/index.ts`를 가리킨다(pnpm 심볼릭 링크로 Node가 `.ts` 소스를 그대로 적재한다. core에서 동작 확인됨).
- `tsconfig.base.json`은 이미 `verbatimModuleSyntax` + `allowImportingTsExtensions`가 있다. **`erasableSyntaxOnly: true`를 `tsconfig.base.json`에 추가할 것을 권장**한다(위반을 컴파일 타임에 잡는다).

### 1.4 외부 의존성 (패키지별 완전 목록 — S0이 한 번에 설치)

vitest는 **설치된 vite(8.x)의 peer 범위에 맞는 메이저 버전**을 쓴다. 버전은 `pnpm view vitest peerDependencies`(후보마다)로 확인해 고정한다 — 문서에 버전을 박지 않는다.

| 패키지 | `dependencies` | `devDependencies` |
| --- | --- | --- |
| `@gagyebu/core` | (없음) | `vitest` |
| `@gagyebu/live` | (없음) | `vitest` |
| `@gagyebu/activity-gagyebu` | `@gagyebu/core`, `@gagyebu/live` (`workspace:*`) | `vitest` |
| `@gagyebu/lesson` | `@gagyebu/live`, `@gagyebu/activity-gagyebu` (`workspace:*`) | (없음) |
| `@gagyebu/server` | `@gagyebu/live`, `@gagyebu/activity-gagyebu`, `@gagyebu/lesson` (`workspace:*`), `socket.io@^4`, `cookie@^1` | `vitest`, `@types/cookie`, `@types/node` |
| `@gagyebu/app` (src) | `@gagyebu/core`, `@gagyebu/live`, `@gagyebu/activity-gagyebu`, `@gagyebu/lesson`, `@gagyebu/draft-kit` (`workspace:*`), `socket.io-client@^4`, `qrcode@^1` (+ 기존 react 등) | `@types/qrcode` (+ 기존) |
| 루트 (`gagyebu-sim`) | (기존 그대로) | `typescript`, `vite`, `playwright`, `vite-plugin-singlefile` (기존) |

- 테스트 스크립트: `core`·`live`·`activity-gagyebu`·`server` 각 `package.json`에 `"test": "vitest run"`. 루트 `pnpm test`는 `pnpm -r test` (§11.3).
- 루트 `package.json` 스크립트에 `server`, `test`, `bots` 추가(§11.3).
- **이 표의 설치는 S0(scaffold)이 전부 한다**(§13). 이후 스트림은 `package.json`·`pnpm-lock.yaml`을 건드리지 않는다.

---

## 2. 레슨 데이터와 화면의 분리

### 2.1 문제

서버는 모든 레슨의 세그먼트·비트(각 슬라이드 덱의 장 수, `steps`, 발표자 노트 포함)를 알아야 하지만, 슬라이드는 React 컴포넌트라 Node가 import할 수 없다.

### 2.2 해결: 데이터 매니페스트(서버 안전) + 렌더 레지스트리(클라이언트 전용)

- **덱 매니페스트** — `lesson/decks/*.ts`, 데이터만 있는 서버 안전 `.ts`:

```ts
// packages/live/src/types.ts
export interface SlideManifest {
  id: string;
  /** 통제 타임라인에 표시할 라벨. 없으면 슬라이드 id */
  label?: string;
  /** 한 장 안에서 항목을 하나씩 드러내는 단계 수. 없으면 1비트 */
  steps?: number;
  /** 발표자 노트 (통제 페이지에만 표시) */
  notes?: string;
}

export interface DeckManifest {
  id: string;
  title: string;
  slides: SlideManifest[];
}
```

- **슬라이드 렌더 레지스트리** — `src/src/activities/slides/registry.tsx`, 클라이언트 전용. 키는 `덱 id + 슬라이드 id`:

```tsx
// src/src/activities/slides/registry.tsx (계약)
import type { ComponentType } from 'react';

/** `${deckId}/${slideId}` → 슬라이드 렌더 컴포넌트 */
export const SLIDE_RENDERERS: Record<string, ComponentType<{ step: number }>>;
```

슬라이드 컴포넌트는 `src/src/activities/slides/decks/<deckId>.tsx`에 들어 있고 레지스트리만 import한다. 레지스트리에 없는 키가 오면 자리표시 오류 슬라이드를 보여 준다(개발 중 드러남).

- **활동도 같은 분리**: 규칙은 `packages/activity-gagyebu`(서버 안전, 순수 함수), 화면은 `src/src/activities/gagyebu/`(클라이언트). 서버는 레지스트리 `server/src/activities.ts`에서 `activity id → ActivityLogic`을, 클라이언트는 `src/src/activities/registry.ts`에서 `activity id → ActivityViews`를 찾는다. 두 레지스트리의 id 집합이 같아야 한다.

### 2.3 레슨 스크립트

```ts
// lesson/lesson.ts (계약; lesson/decks/*.ts는 DeckManifest만 내보냄)
import type { Lesson } from '@gagyebu/live';
import { introDeck } from './decks/intro.ts';
import { wrapUpDeck } from './decks/wrap-up.ts';

export const lesson: Lesson = {
  id: 'first-salary',
  title: '내 첫 월급, 1년 살아 보기',
  settings: { showProgressOnStage: false },
  segments: [
    { kind: 'slides', id: 'intro', deck: introDeck }, // 슬라이드가 들어오기 전까지 slides: [] 로 비워 둠
    {
      kind: 'activity',
      id: 'game',
      activity: 'gagyebu',
      config: { guide: true, monthReveal: true, spotlight: true, confirmForce: true },
    },
    { kind: 'slides', id: 'wrap-up', deck: wrapUpDeck },
  ],
};
```

---

## 3. core API 변경 요약

`@gagyebu/core`에 승인된 변경(계획 §13 1~9 + `step()`)이 들어간다. 시그니처·세부 의미는 **`docs/core-api.md` §4가 정식 명세**다. 요약:

| 변경 | 시그니처 |
| --- | --- |
| `start` 행동에 월급 | `{ type: 'start'; nickname: string; salary: Won }` |
| 설문 한 번에 제출 | `{ type: 'submitSurvey'; answers: Partial<Record<QuestionId, string>> }` (`answer`/`finishSurvey` 삭제) |
| 기본 선택지 표시 | `Choice.fallback?: true` |
| 자동 처리 기록 | `DecisionRecord.auto?: boolean`, 행동에 `auto?: true` |
| 합계 맞추기 | `balanceBudget(budget, salary): { budget: Budget; changes: BudgetChange[] }` |
| 설문 기본값 | `defaultAnswers(answers)` |
| 기본 선택지 조회 | `fallbackChoice(scene): Choice` |
| 자동 지불 계획 | `autoPaymentPlan(state, pay): { plan: PaymentPlan; shortfall: Won }` |
| 자동 입금 계좌 | `autoDepositTarget(deposit): AccountId` |
| 지불 계획 검증 | `validatePayment(state, pay, plan): { ok: true } \| { ok: false; issue: PaymentIssue }` |
| 집계용 선택자 | `monthChoices(state, month): DecisionRecord[]` |
| 행동 사전 검사 | `canStep(state, action): true \| string`, `StepError { code }` |

---

## 4. `@gagyebu/live` 타입

파일 구성: `src/index.ts`(전부 re-export), `src/types.ts`, `src/activity.ts`, `src/protocol.ts`, `src/slides.ts`.

### 4.1 진행 모델

```ts
// packages/live/src/types.ts
export type ClassCode = string; // 숫자 4자리 ("4821"). 학생 주소 /<code>

/** 교사가 "다음"을 눌러 넘기는 한 칸 */
export interface Beat {
  /** 세그먼트 안에서 유일. 예: 'survey', 'guide-3', 'm2', 'why--1' */
  id: string;
  /** 통제 타임라인 표시 */
  label: string;
  mode: 'show' | 'work';
  /** 공개 토글이 있는 비트 (work에만 붙는다) */
  reveal?: boolean;
  /** 발표자 노트 (통제 페이지에만) */
  notes?: string;
}

/** 비트 주소: 세그먼트 인덱스 + 세그먼트 안 비트 인덱스. 전역 인덱스는 서버가 평탄화해서만 계산한다 */
export interface BeatRef {
  segment: number;
  beat: number;
}

export interface Cursor {
  segment: number;
  beat: number;
  revealed: boolean;
}

export type ClassStatus = 'open' | 'ended';

export interface LessonSettings {
  /** 공개 전 응답 중 완료 인원을 TV에도 보일지. 기본 false (통제 페이지에만) */
  showProgressOnStage: boolean;
}

export type Segment =
  | { kind: 'slides'; id: string; deck: DeckManifest }
  | { kind: 'activity'; id: string; activity: string; config: unknown };

export interface Lesson {
  id: string;
  title: string;
  settings: LessonSettings;
  segments: Segment[];
}

export interface ClassState {
  code: ClassCode;
  status: ClassStatus;
  /** 변경마다 +1. 모든 서버→클라이언트 메시지에 실려 낡은 메시지를 버리는 기준 */
  version: number;
  lessonId: string;
  cursor: Cursor;
  /** 가장 멀리 간 적 있는 비트 = "live 비트". 진행·집계는 항상 이 비트 기준 */
  highMark: BeatRef;
  /** highMark 비트의 공개 상태. 리뷰에서 돌아올 때 복원한다 */
  highRevealed: boolean;
  spotlight: string | null; // 발표자 studentId
  joinLocked: boolean;
}

export interface ProgressInfo {
  done: number;
  connected: number;
  total: number;
}

export interface RosterEntry {
  studentId: string;
  nickname: string;
  connected: boolean;
  /** 현재 비트 완료 여부 */
  done: boolean;
  /** 지각 합류 (들어올 때 과거 작업 비트를 기본값으로 채움) */
  late: boolean;
  device: 'laptop' | 'tablet' | 'phone';
  /** 활동이 주는 "지금 있는 장면" 짧은 문구 (미완료 명단용). 없으면 null */
  scene: string | null;
  /** 기본값 루프 50회 초과로 멈춘 학생(§4.2). 이후 비트에서 done이 되면 다시 false */
  stalled: boolean;
  /** 기록 이어받기 승인 대기 중인 새 접속 */
  pendingMerge: boolean;
}
```

**비트 주소 결정**: 주소는 `{ segment, beat }` 인덱스(계획 §5.4의 `Cursor` 그대로). `Beat.id`는 표시·디버깅용이고 세그먼트 안에서만 유일하면 된다. 프로토콜은 인덱스만 오간다.

**슬라이드 `steps` → 비트 매핑 결정**: `steps: n`이 있는 슬라이드는 **비트 n개**가 된다. 비트 k(0부터)는 항목 0..k까지 드러낸 상태를 그린다. `steps`가 없으면 비트 1개. 비트 id는 `steps`가 없으면 `${slideId}`, 있으면 `${slideId}--${k}`. `packages/live/src/slides.ts`:

```ts
/** 덱 매니페스트를 show 비트 목록으로 만든다 (서버·클라이언트 공용).
 *  비트 라벨은 SlideManifest.label ?? slideId. steps가 있으면 " (k/n)"을 덧붙인다
 *  (k는 사람 표기 기준 1부터 — 예: (1/3). 비트 id의 k는 0부터, §14 #64). */
export function deckBeats(deck: DeckManifest): Beat[];
```

레슨 전체 비트 목록은 서버와 클라이언트가 같은 함수로 계산한다(서버: `deckBeats` + 활동 `beats(cfg)`; 클라이언트도 동일하게, `packages/live/src/index.ts`에 헬퍼를 둔다):

```ts
/** 레슨의 모든 세그먼트를 순서대로 평탄화. 세그먼트별 비트 수와 BeatRef 계산에 쓴다 */
export function lessonBeats(lesson: Lesson, beatsOf: (activityId: string, config: unknown) => Beat[]): { segment: number; beats: Beat[] }[];
```

**커서와 리뷰 모드 (결정).** `highMark`가 "live 비트"다. 교사가 `prev`/`goto`로 show 비트를 되돌아 보면 `cursor < highMark`인 **리뷰 상태**가 된다.

- 리뷰 중에는 아무 것도 재실행하지 않는다: `next`는 커서를 앞의 show 비트들 순서대로, 끝에서는 `highMark` 자신으로만 전진시킨다(마감·확인·기본값·전이 없음). 지나간 비트의 마감/전이를 다시 돌리면(예: 이미 sim에 들어간 학생에게 `goto budget` 재적용) `StepError`가 나므로 금지한다.
- 리뷰 중 학생 `act`는 `'stale-beat'`로 거부된다.
- 커서가 `highMark`로 돌아오면 `cursor.revealed = highRevealed`로 공개 상태를 복원한다.
- **TV는 커서를 따라간다** — 리뷰 중에는 되돌아본 비트(예: 월급 분포, 안내 카드)를 보여 준다. 서버는 리뷰 이동(prev·goto·리뷰 중 next)마다 **커서 비트 기준** `stats`를 다시 계산해 보내고, `StatsPayload.beat`로 어느 비트의 통계인지 알려 준다. `progress`·`fallbackPreview`는 **항상 highMark 기준**으로 실린다.
- 완료 인원·미완료 명단(`progress`·roster의 done)은 **항상 highMark 비트 기준**이다.
- 학생·TV의 표시형 비트 화면은 `beat.id` + (세그먼트) 상태 데이터만으로 그린다 — 학생의 `phase`·`step`을 보지 않는다. 그래야 5월에 안내 카드 3장을 리뷰로 다시 보여 줄 수 있다.

### 4.2 `ActivityLogic` (계획 §5.4 정제)

```ts
// packages/live/src/activity.ts — @gagyebu/core를 import하지 않는다(§1.2)
import type { Beat } from './types.ts';

export interface ActivityInitCtx {
  nickname: string;
  /** 서버가 주입하는 난수 함수. init 안에서만 쓴다(월급). 결과 행동에 값이 박히므로 로그로 재현 가능 */
  random: () => number;
}

/** 기본값 적용 한 걸음의 결과 */
export interface FallbackResult<A> {
  action: A;
  /** 학생에게 보여 줄 안내 문구. 예: "시간 안에 고르지 못해 '○○'이(가) 자동으로 선택됐어요" */
  notice: string;
}

export interface AutoAppliedNotice {
  beatId: string;
  message: string;
}

/**
 * 활동 모듈 계약. 모든 메서드는 순수 함수여야 한다:
 * - Math.random / Date.now / DOM / I/O 금지. 난수는 ActivityInitCtx.random으로만 주입받는다.
 * - apply는 원본을 고치지 않고 새 상태를 반환한다.
 * - 같은 (state, action)에 대해 항상 같은 결과. 서버 로그 재생이 곧 상태 복원이다.
 */
export interface ActivityLogic<Cfg, S, A, Stats> {
  id: string;
  /** 세그먼트의 비트 목록. openClass 때 한 번, 이후 cfg 불변이라 캐시한다 */
  beats(cfg: Cfg): Beat[];
  /** 학생 입장(join 승인) 때 서버가 호출. 반환한 actions를 서버가 곧바로 적용하고 로그에 남긴다(월급 등 주입값 포함).
   *  state는 "기저 상태": 난수를 소비하지 않아야 하고(모든 무작위값은 actions에 박혀야 함)
   *  같은 (nickname, cfg)에 대해 항상 같아야 한다. 재생은 기저 + 로그의 actions로 복원한다. */
  init(ctx: ActivityInitCtx, cfg: Cfg): { state: S; actions: A[] };
  /** 이 비트에서 이 행동을 받을 수 있는지. 서버는 act의 allowed 검사로 쓴다 */
  allowed(s: S, beat: number, a: A, cfg: Cfg): true | string;
  /** 행동 적용. gagyebu는 core.step을 감싼다 */
  apply(s: S, a: A, cfg: Cfg): S;
  /** 이 비트에서 학생이 할 일을 다 했는지. 완료 인원·next 마감 판정에 쓴다 */
  done(s: S, beat: number, cfg: Cfg): boolean;
  /** 끝내지 못한 학생에게 적용할 다음 기본 행동. done이 될 때까지 서버가 반복 호출한다 */
  fallback(s: S, beat: number, cfg: Cfg, draft: unknown | undefined): FallbackResult<A>;
  /** 비트를 떠날 때 서버가 "모든" 학생에게 대신 실행하는 전이. 해당 없으면 [].
   *  from·to는 이 활동 세그먼트 안의 비트 인덱스. 커서가 세그먼트 경계를 넘을 때는
   *  서버가 transition을 호출하지 않는다(활동의 마지막 비트까지 done이면 충분해야 한다). */
  transition(s: S, from: number, to: number, cfg: Cfg): A[];
  /** 익명 집계 (TV·통제용). 서버가 초당 최대 4회로 묶어 보낸다 */
  stats(states: S[], beat: number, cfg: Cfg): Stats;
  /** 미완료 명단용 "지금 있는 장면" 문구 */
  locate?(s: S): string | null;
  /** 통제 페이지 "기본값 미리보기"용, 지금 넘기면 적용될 선택지 이름 */
  previewFallback?(s: S, beat: number, cfg: Cfg): string | null;
  /** CSV 내보내기(§8.5). 열 순서와 행 변환을 활동이 정의하고 서버는 조립만 한다 */
  exportColumns?: string[];
  exportRows?(s: S, student: { studentId: string; nickname: string }): Record<string, string | number | boolean>[];
}
```

**서버가 각 메서드를 부르는 정확한 시점**

| 메서드 | 시점 |
| --- | --- |
| `beats` | `openClass` 직후(타임라인·커서 계산). 이후 변경 없음 |
| `init` | 학생 `join` 승인 시 1회. 반환한 `actions`를 `apply`로 즉시 적용하고 로그(`join` 줄에 행동 포함)에 남긴다 |
| `allowed` | 학생 `act`마다. `false`면 ack 거부 |
| `apply` | `act`, `fallback`, `transition`, `init` 결과 적용 시 |
| `done` | `act` 처리 뒤(완료 인원), `next` 마감 판정, 지각 입장 채우기 |
| `fallback` | `next` 마감의 기본값 루프, 지각 입장 채우기. `done`이 true가 될 때까지 반복 |
| `transition` | `next`로 커서가 옮겨질 때, 모든 학생(완료 학생 포함)에 대해 1회 |
| `stats` | `act`·`next`·`reveal` 뒤 재계산. 전송은 초당 최대 4회로 묶음 |
| `locate` | `roster` 방송 직전, 학생별 1회 |
| `previewFallback` | `stats`와 함께 계산해 통제 `stats` 페이로드의 `fallbackPreview`에 싣는다. 대상은 미완료 학생 중 studentId 오름차순 첫 학생(§9.4) |
| `exportColumns`·`exportRows` | CSV 내보내기 요청(`GET /api/export/<code>.csv`) 때 학생마다 1회 (§8.5) |

**기본값 루프의 종료 보장**: `fallback`은 한 번 호출될 때마다 상태를 반드시 진전시켜야 한다(같은 행동을 두 번 반환하면 안 된다). 서버는 학생·비트마다 **최대 50회** 반복하고, 50회를 넘기면 루프를 끊고 그 학생을 `stalled`로 표시한다(로그 `auto` 줄에 `overflow: true`, roster에 표시). 수업은 계속 진행되고 서버는 죽지 않는다. `stalled` 학생은 이후 비트에서 `done`이 true로 판정되면 다시 정상 흐름에 합류한다.

**난수 주입과 로그**: 유일한 난수는 월급이다. 서버가 `init`에 `random`을 넣고, 나온 `actions`(`start { salary }`)를 로그에 남긴다. `init`의 기저 상태는 결정적이어야 하므로(위 계약), 재시작 후 로그 재생은 "기저 + 로그의 actions"로 결정적으로 복원된다. `fallback`·`transition`은 난수 없이 상태만으로 결정된다.

**`autoApplied` 통지 모양**: 서버가 기본값 루프에서 모은 `FallbackResult.notice`를 학생별 큐에 쌓고, 그 학생에게 보내는 다음 `state`/`snapshot` 메시지의 `autoApplied`에 `AutoAppliedNotice[]`로 실어 보낸다(클라이언트가 받으면 화면에 보여 주고 서버는 큐를 비운다). 전이(`transition`) 행동에는 통지가 없다. **빈 문구(`''` — 순차 처리 걸음)는 큐에 넣지 않는다**(§14 #134): 활동이 안내가 필요 없는 걸음에 `''`을 돌려주면 서버·클라이언트 어디에서도 세지 않는다.

**초안(draft) 처리**: `draft { beat, data }`는 서버 메모리에만 있다(로그에 남기지 않는다 — §14 결정 #8). `next` 마감 때 `fallback`의 `draft` 인자로 넘어가고, 그 결과 행동은 `auto` 줄에 남는다. 서버가 비트 도중 재시작하면 초안은 사라지고 기본값은 "초안 없음" 경로로 간다.

### 4.3 활동 화면 계약 (클라이언트 전용 — React 타입을 쓰므로 `src/src/activities/registry.ts`에 둔다)

```tsx
// src/src/activities/registry.ts (계약)
import type { ComponentType } from 'react';
import type { Beat, ProgressInfo, RosterEntry } from '@gagyebu/live';

export interface AudienceProps<S, A> {
  state: S;
  beat: Beat;
  revealed: boolean;
  /** 이 비트에서 제출을 마쳤으면 true (대기 화면) */
  submitted: boolean;
  mode: 'live' | 'solo' | 'dev';
  dispatch: (a: A) => void;
  draft: (d: unknown) => void;
}

export interface StageProps<S, Stats> {
  beat: Beat;
  revealed: boolean;
  stats: Stats | null;
  /** 발표자의 상태 (spotlight 없으면 null) */
  spotlight: S | null;
  /** 발표자 닉네임 (spotlight 없으면 null). 전면 표시용(§5.1, §14 #132) */
  spotlightName: string | null;
  /** lesson.settings.showProgressOnStage일 때만 null이 아님 */
  progress: ProgressInfo | null;
}

export interface ControlPanelProps<S, Stats> {
  beat: Beat;
  revealed: boolean;
  stats: Stats | null;
  roster: RosterEntry[];
}

export interface ActivityViews<S, A, Stats> {
  Audience: ComponentType<AudienceProps<S, A>>;
  Stage: ComponentType<StageProps<S, Stats>>;
  ControlPanel?: ComponentType<ControlPanelProps<S, Stats>>;
}

/** activity id → 화면. 서버 레지스트리(server/src/activities.ts)의 id 집합과 같아야 한다 */
export const ACTIVITY_VIEWS: Record<string, ActivityViews<unknown, unknown, unknown>>;
```

---

## 5. 프로토콜 (`packages/live/src/protocol.ts`)

Socket.IO v4. 모든 이벤트 이름·페이로드·ack 모양을 이 절에서 정한다. 서버·클라이언트가 같은 타입을 쓴다.

### 5.1 이벤트와 페이로드

```ts
// packages/live/src/protocol.ts — @gagyebu/core를 import하지 않는다(§1.2).
// 게임 페이로드는 전부 제네릭이고 기본값이 unknown이다. 앱의 활동 계층이 좁힌다.
import type { BeatRef, ClassCode, ClassState, Lesson, ProgressInfo, RosterEntry } from './types.ts';
import type { AutoAppliedNotice } from './activity.ts';

export type DeviceKind = 'laptop' | 'tablet' | 'phone';

// ── 학생 → 서버 ────────────────────────────────────────────
export interface HelloPayload {
  code: ClassCode;
  /** localStorage['gg_token_<code>'] */
  token?: string;
  device: DeviceKind;
}

export type HelloAck =
  | { ok: true; resumed: boolean } // resumed: 토큰으로 기존 학생 재접속
  | { ok: false; reason: 'not-found' | 'ended' };

export interface JoinPayload {
  nickname: string; // 1~10자
}

export type JoinAck =
  | { ok: true; studentId: string; token: string }
  | { ok: false; reason: 'join-locked' | 'class-full' }
  // 잘못된 닉네임(빈 값·공백만·trim 뒤 10자 초과). 'join-locked'은 실제로 잠긴 수업에만 쓴다(§14 #130)
  | { ok: false; reason: 'invalid-nickname' }
  // 같은 닉네임이 이미 있을 때: 서버가 대기 요청을 만들고 pendingId를 돌려준다(§5.8).
  // 학생은 "선생님 승인을 기다리는 중" 화면 or 다른 닉네임으로 다시 join
  | { ok: false; reason: 'nickname-taken'; pendingId: string };

export interface ActPayload<A = unknown> {
  /** 학생별 증가 번호. 로그·디버깅용 */
  seq: number;
  /** 학생이 보고 있는 비트. live 비트(highMark)와 다르면 'stale-beat'로 거부 (리뷰 중 포함) */
  beat: BeatRef;
  action: A;
}

export type ActReject =
  | 'stale-beat'      // live 비트가 아님: 이미 넘어갔거나 리뷰 중
  | 'not-allowed'     // allowed 검사 실패
  | 'class-ended'
  | 'too-fast'        // ack 전 행동 또는 속도 제한
  | 'server-error';

export type ActAck<S = unknown> =
  | { ok: true; state: S; done: boolean; version: number } // done: live 비트에서 이 학생의 완료 여부
  | { ok: false; reason: ActReject; message?: string };

export interface DraftPayload<D = unknown> {
  beat: BeatRef;
  data: D; // 가계부 활동: GagyebuDraft (§9.5)
}

// ── 전면·통제 → 서버 (해당 역할 쿠키 필수) ──────────────────
export interface SelectPayload {
  code: ClassCode; // 열린 수업이 여럿일 때 어떤 수업을 볼지
}

export interface NextPayload {
  /** confirmForce로 거부된 뒤 대화상자 확인 재전송 */
  force?: boolean;
}

export interface GotoPayload {
  segment: number;
  beat: number;
}

export type StudentOp =
  | { op: 'rename'; id: string; nickname: string }
  | { op: 'kick'; id: string }
  /** 기록 이어받기: pendingMerge 새 접속(pendingId)을 기존 기록(intoId)으로 합침 */
  | { op: 'merge'; pendingId: string; intoId: string };

export interface OpenClassPayload {
  /** 생략하면 LESSON_ID(§7) */
  lessonId?: string;
}

export type CmdReject =
  | 'unauthorized'
  | 'invalid-target'   // prev/goto 대상이 없거나 규칙 위반, 마지막 비트의 next 등
  | 'confirm-required' // 미완료가 있는데 force 없음. pending이 함께 온다
  | 'rate-limited'     // 통제 명령 속도 제한 초과
  | 'server-error';

export type CmdAck = { ok: true } | { ok: false; reason: CmdReject; pending?: number };

// ── 서버 → 클라이언트 ──────────────────────────────────────
export interface OpenClassInfo {
  code: ClassCode;
  lessonId: string;
  openedAt: number;
}

export interface SnapshotPayload<S = unknown> {
  class: ClassState;
  /** 학생·전면이 받는 lesson에서는 Beat.notes·SlideManifest.notes가 서버에서 제거된다
   *  (발표자 노트는 통제 전용). 통제는 온전한 lesson을 받는다. */
  lesson: Lesson;
  classes: OpenClassInfo[]; // 열린 수업 목록 (여럿이면 고르기)
  you?: { studentId: string; nickname: string; done: boolean }; // 학생만. done = live 비트 기준
  /** 커서의 활동 세그먼트 인덱스. 커서가 슬라이드 세그먼트면 -1 */
  segment?: number;
  /** 커서의 활동 세그먼트 상태. 슬라이드 세그먼트면 null (학생만) */
  state?: S | null;
  autoApplied?: AutoAppliedNotice[]; // 학생만
  roster?: RosterEntry[]; // 통제만
  spotlightState?: SpotlightStatePayload<S>; // 전면만 (상태 + 발표자 닉네임, §14 #132)
}

export interface ClassPayload {
  class: ClassState;
}

export interface StatePayload<S = unknown> {
  /** 커서의 활동 세그먼트 상태. 슬라이드 세그먼트면 null */
  state: S | null;
  /** 커서의 활동 세그먼트 인덱스. 슬라이드 세그먼트면 -1 */
  segment: number;
  /** live 비트(highMark)에서 이 학생의 완료 여부 */
  done: boolean;
  /** ClassState.version. 클라이언트는 자기가 본 version보다 낮으면 버린다 */
  version: number;
  autoApplied?: AutoAppliedNotice[];
}

export interface StatsPayload<Stats = unknown> {
  /** 이 통계가 속한 비트. 라이브에서는 highMark와 같고, 리뷰 중에는 커서 비트(§5.7).
   *  수신자는 자기가 그리는 비트와 같을 때만 활동 통계를 그린다(다르면 null로 취급). */
  beat: BeatRef;
  stats: Stats; // 활동별 Stats (§9.4). show 비트는 { kind: 'none' } (§9.4)
  /** 완료 인원 — 항상 live 비트(highMark) 기준 (리뷰 중에도) */
  progress: ProgressInfo; // Stage는 showProgressOnStage일 때만 그린다
  /** 미완료 학생이 있으면 그중 첫 미완료 학생(studentId 오름차순)의 현재 장면에서
   *  적용될 기본 선택지 라벨. 미완료가 없으면 null — 항상 highMark 기준 (통제 기본값 미리보기) */
  fallbackPreview: string | null;
}

export interface RosterPayload {
  entries: RosterEntry[];
}

export interface SpotlightStatePayload<S = unknown> {
  state: S | null;
  /** 발표자 닉네임 (spotlight 없으면 null). 전면은 roster를 받지 않으므로(§5.2) 페이로드에 직접 실린다(§14 #132) */
  nickname: string | null;
}

export interface ClassesPayload {
  classes: OpenClassInfo[];
}

/** join 승인 결과. 일반 join은 JoinAck로 끝나지만, merge 승인은 이 이벤트로 전달된다(§5.8) */
export interface JoinedPayload {
  studentId: string;
  token: string;
  nickname: string;
}

export interface KickedPayload {
  reason: 'kicked' | 'merge-rejected';
}

// ── socket.io 타이핑 (기본값 = unknown; 앱은 src/src/activities/gagyebu/liveTypes.ts에서
//    ClientToServerEvents<Action, GagyebuDraft>·ServerToClientEvents<GameState, GagyebuStats>로 좁혀 내보낸다) ──
export interface ClientToServerEvents<A = unknown, D = unknown> {
  hello: (p: HelloPayload, ack: (r: HelloAck) => void) => void;
  join: (p: JoinPayload, ack: (r: JoinAck) => void) => void;
  act: (p: ActPayload<A>, ack: (r: ActAck) => void) => void;
  draft: (p: DraftPayload<D>) => void;
  select: (p: SelectPayload, ack: (r: CmdAck) => void) => void; // 전면·통제
  next: (p: NextPayload, ack: (r: CmdAck) => void) => void; // 통제
  prev: (p: void, ack: (r: CmdAck) => void) => void; // 통제
  goto: (p: GotoPayload, ack: (r: CmdAck) => void) => void; // 통제
  reveal: (p: { on: boolean }, ack: (r: CmdAck) => void) => void; // 통제
  spotlight: (p: { studentId: string | null }, ack: (r: CmdAck) => void) => void; // 통제
  student: (p: StudentOp, ack: (r: CmdAck) => void) => void; // 통제
  openClass: (p: OpenClassPayload, ack: (r: { ok: true; code: ClassCode } | { ok: false; reason: CmdReject }) => void) => void; // 통제
  endClass: (p: void, ack: (r: CmdAck) => void) => void; // 통제
  lockJoin: (p: { on: boolean }, ack: (r: CmdAck) => void) => void; // 통제
}

export interface ServerToClientEvents<S = unknown, St = unknown> {
  snapshot: (p: SnapshotPayload<S>) => void;
  class: (p: ClassPayload) => void;
  state: (p: StatePayload<S>) => void; // 해당 학생 소켓에만
  stats: (p: StatsPayload<St>) => void; // :stage·:control 룸만 (§5.2)
  roster: (p: RosterPayload) => void; // :control 룸
  spotlightState: (p: SpotlightStatePayload<S>) => void; // :stage 룸
  classes: (p: ClassesPayload) => void; // :stage·:control 룸
  joined: (p: JoinedPayload) => void; // 승인 대기 소켓에만 (§5.8)
  kicked: (p: KickedPayload) => void; // 내보내기·merge 거부된 소켓에만 (§5.8)
}
```

앱의 활동 계층에서 좁힌 타입(`src/src/activities/gagyebu/liveTypes.ts`, 계약):

```ts
// src/src/activities/gagyebu/liveTypes.ts
import type { Action, GameState } from '@gagyebu/core';
import type {
  ClientToServerEvents, ServerToClientEvents, DraftPayload, ActPayload, ActAck,
  SnapshotPayload, StatePayload, StatsPayload, SpotlightStatePayload,
} from '@gagyebu/live';
import type { GagyebuDraft, GagyebuStats } from '@gagyebu/activity-gagyebu';

export type LiveClientToServer = ClientToServerEvents<Action, GagyebuDraft>;
export type LiveServerToClient = ServerToClientEvents<GameState, GagyebuStats>;
export type LiveActPayload = ActPayload<Action>;
export type LiveActAck = ActAck<GameState>;
export type LiveSnapshot = SnapshotPayload<GameState>;
export type LiveState = StatePayload<GameState>;
export type LiveStats = StatsPayload<GagyebuStats>;
export type LiveSpotlight = SpotlightStatePayload<GameState>;
export type LiveDraft = DraftPayload<GagyebuDraft>;
```

### 5.2 연결·인증·룸

- **학생 소켓**: 쿠키 없음. `hello { code, token?, device }`로 시작한다. 토큰이 유효하면 기존 학생으로 재접속(`resumed: true`), 없으면 `join`을 기다린다. 진행 중이 아니면 `not-found`/`ended`로 응답하고 클라이언트는 그 코드의 토큰을 지운 뒤 끝난/없는 수업 화면을 보여 준다.
- **전면·통제 소켓**: 연결 시 HTTP 쿠키(`gg_stage`/`gg_control`, §6.3)로 역할을 확인한다. 쿠키가 없거나 서명이 틀리면 서버가 연결을 끊는다. `hello` 없이 `snapshot`을 바로 받는다.
- **룸**: 수업마다 `class:<code>`(전체)와 역할 룸 `class:<code>:student`, `:stage`, `:control`. `class`는 수업 룸 전체에, `stats`는 **`:stage`·`:control`에만**(학생에게는 가지 않는다), `roster`는 `:control`, `spotlightState`는 `:stage`, `state`는 해당 학생 소켓에만 보낸다.
- **발표자 노트는 통제 전용**: 서버가 학생·전면에 보내는 `snapshot.lesson`에서는 `Beat.notes`·`SlideManifest.notes`를 제거한다. 통제는 온전한 lesson을 받는다.

### 5.3 버전 관리(낡은 메시지 버리기)·페이로드 크기

- `ClassState.version`은 수업의 모든 변경(커서·공개·발표자·잠금·종료)마다 +1된다.
- `class`·`state`·`stats` 페이로드는 모두 그 순간의 version(또는 ClassState 전체)을 싣는다.
- 클라이언트는 마지막으로 본 version보다 **낮은** 메시지는 조용히 버린다. 재접속 후에는 `snapshot`이 기준을 다시 맞춘다.
- 학생 `act`는 ack를 받기 전까지 다음 행동을 보내지 않는다(클라이언트 규칙). 서버는 위반 시 `'too-fast'`.
- **전체 상태 전송의 근거**: 12개월이 끝난 게임 상태는 JSON로 약 15~25KB(`history` 12 + `decisions` 20여 개 + 계좌·상태·결산)다. 60명 전체를 Room 메모리에 두어도 ~1.5MB이고, 한 번의 `state` 메시지(수신자 1명)는 ~25KB — partial patch 없이 항상 전체 상태를 보내도 부하는 무시할 수 있다.

### 5.4 속도 제한

| 대상 | 제한 | 위반 응답 |
| --- | --- | --- |
| 학생 `act` | 소켓당 초당 4회 + 동시 1개 | `'too-fast'` |
| 학생 `draft` | 서버는 소켓당 1.5초에 1회만 받고 초과분은 조용히 버림. 클라이언트는 2초 간격으로 묶어 보내고 **제출(`act`) 직전에 마지막 초안을 즉시 flush** | 없음(버림) |
| 학생 `join` | 소켓당 5초에 1회 | 초과분은 무시(클라이언트가 재전송하지 않음) |
| 학생 `hello` | 소켓당 5초에 1회 | 초과분은 무시(재접속 백오프는 Socket.IO 내장) |
| 통제 명령 | 소켓당 초당 10회 | 초과분은 ack `{ ok: false, reason: 'rate-limited' }` |
| HTTP 로그인 | IP당 분당 실패 5회 (§6.3) | `429` |

### 5.5 `next` 알고리즘 (정확한 순서)

모든 학생 행동과 교사 명령은 수업 하나의 **직렬 큐**(§8.1)로 들어가 순서대로 처리된다. `next` 하나의 처리:

0. **리뷰 복귀.** `cursor < highMark`(리뷰 중)면 마감·확인·기본값·전이를 전혀 실행하지 않는다. 커서를 **앞의 show 비트들 순서대로**, 더 없으면 `highMark` 자신으로 전진한다. `highMark`에 도착하면 `cursor.revealed = highRevealed`로 공개 상태를 복원한다. 이동한 비트 기준 `stats`를 다시 계산해 `:stage`·`:control`에 방송(§5.7), version++, 로그 `cursor`, `class` 방송, ack `{ ok: true }`. 끝.
1. **공개 단계 먼저.** 현재(live) 비트가 `reveal: true`이고 `cursor.revealed === false`면 `revealed = true`(`highRevealed = true`도 함께), version++, 로그 `reveal`, 전체에 `class` 방송, `stats` 재계산·방송. 끝. ("다음" 키 하나가 `공개 → 다음 비트` 순서로 동작한다)
2. **마감 확인.** `pending` = live 비트에서 `done(s, beat)`이 false인 학생 수. `pending > 0`이고 활동 설정 `confirmForce`이고 `force`가 없으면 ack `{ ok: false, reason: 'confirm-required', pending }`. 통제 페이지가 대화상자를 띄우고 확인하면 `next { force: true }`로 다시 보낸다.
3. **기본값 루프.** pending 학생 각각에 대해: `r = fallback(s, beat, cfg, draft)` → `apply(r.action)` → `s` 교체, `r.notice`를 그 학생의 autoApplied 큐에 추가 → `done`이 true가 될 때까지 반복(최대 50회, 초과 시 §4.2의 `stalled` 처리). 학생 하나의 루프 전체(적용된 행동·통지·overflow 여부)를 로그 `auto` 줄 하나로 기록한다.
4. **전이.** 커서의 이전 비트와 다음 비트가 **같은 활동 세그먼트에 있을 때만**, 모든 학생(완료 학생 포함)에 대해 `transition(s, from, to, cfg)`의 행동을 순서대로 `apply`. **적용한 전이 행동은 학생마다 로그 `transition` 줄로 기록한다**(재생이 live와 같은 순서로 적용하도록 — §8.2). 세그먼트 경계를 넘는 이동에는 전이가 없다(§4.2). 활동은 해당 없는 학생에게 `[]`를 반환한다(예: `step !== 'report'`면 `endMonth` 없음).
5. **커서 이동.** 다음 비트로 `cursor = { segment, beat, revealed: false }`, `highMark` 갱신, `highRevealed = false`, version++, 로그 `cursor`.
6. **방송.** 전체에 `class`; 상태가 바뀐 모든 학생에게 `state`(+`autoApplied`, `done`); `stats`·`roster` 재계산해 `:stage`·`:control`에 방송(스로틀 §5.6). ack `{ ok: true }`.

마지막 비트에서 `next`는 ack `{ ok: false, reason: 'invalid-target' }`.

### 5.6 집계 스로틀

학생 행동이 들어올 때마다 `stats`를 다시 계산하되 **전송은 수업당 초당 최대 4회(250ms)**로 묶는다. 타이머에 쌓인 마지막 계산 결과만 보낸다. 60명이어도 부하는 무시할 수 있다.

### 5.7 `prev` / `goto` 제한 (리뷰)

- 학생 게임 상태는 절대 되감지 않는다. 이동은 커서만.
- `goto` 대상: `highMark` 이내의 **show 비트**, 또는 **`highMark` 자신**(live 비트로 돌아가기 — work 비트여도 된다). 현재보다 앞으로의 건너뛰기는 없다(작업 비트를 건너뛴 학생 상태가 생기지 않게).
- `prev`: 현재보다 앞선 show 비트 중 가장 가까운 것으로 이동. 없으면 `'invalid-target'`.
- 이동해서 `cursor < highMark`가 되면 **리뷰 상태**(§4.1): `cursor.revealed = false`, version++, 로그 `cursor`, `class` 방송. 학생 `act`는 `'stale-beat'` 거부. `highMark`로 돌아오면 `highRevealed` 복원.
- **리뷰 이동(prev·goto·리뷰 중 next)마다 서버는 커서 비트 기준 `stats`를 다시 계산해 보낸다**(TV가 되돌아본 비트를 그리므로). `StatsPayload.beat`가 어느 비트의 통계인지 알려 주고, `progress`·`fallbackPreview`는 highMark 기준값을 계속 실는다. Stage·통제는 **`stats.beat`가 자기가 그리는 비트와 같을 때만** 활동 통계를 그리고, 다르면 null로 취급한다. 통제의 완료 현황은 항상 highMark 기준(progress).

### 5.8 교사·학생 관리 명령

- `openClass { lessonId? }`: 서버가 4자리 코드 발급(§8.4), Room 생성, 로그 `open`. `lessonId` 생략 시 `LESSON_ID`(§7). 여러 수업을 동시에 열 수 있다(리허설용). 통제 페이지의 수업 목록은 `classes`로 받는다.
- `endClass`: `status: 'ended'`, 로그 `end`. 학생 링크는 막히고(들어오면 `ended`), 로그는 남아 CSV 내보내기 가능(코드는 `ended.json`에 48시간 보존, Room은 유예 후 메모리에서 제거 — CSV는 로그에서 요청 시 재구축, §14 #144). 학생 소켓에는 `class`가 전달되고 클라이언트가 끝난 수업 화면을 보여 준다.
- `lockJoin { on }`: 입장 마감. `join`은 `'join-locked'` 거부.
- `reveal { on }`: 공개 토글 수동 제어(on→off도 허용). live 비트에서 바뀌면 `highRevealed`도 함께 갱신.
- `spotlight { studentId | null }`: 발표자 지정·해제. `:stage` 룸에 `spotlightState`(발표자의 활동 상태 또는 null + **발표자 닉네임**, §14 #132)를 방송한다.
- `student rename { id, nickname }`: 이름 변경(1~10자, 수업 내 유일). 발표자의 이름이 바뀌면 `spotlightState`를 다시 방송해 전면 표시 닉네임도 따라간다.
- `student kick { id }`: 내보내기. 해당 소켓에 `kicked { reason: 'kicked' }`를 보내고 연결을 끊는다. 토큰 무효화, roster에서 제거, 로그 `admin`. 상태는 로그에 남는다(재생에도 그 학생의 기록이 이어지다가 `admin kick`에서 끝난다).
- `student merge { pendingId, intoId }`: **기록 이어받기 승인.** 아래 생명주기 참조.

**`nickname-taken` → merge 생명주기 (결정)**

1. `join { nickname }`에서 닉네임이 이미 있으면: 서버는 **대기 요청**(roster에 `pendingMerge: true` 항목, 상태 없음)을 만들고 `JoinAck { ok: false, reason: 'nickname-taken', pendingId }`를 돌려준다. 승인 전까지 그 소켓은 아무 행동도 못 한다.
2. 대기 학생 화면: "선생님 승인을 기다리는 중" + 다른 닉네임으로 다시 `join`할 수 있는 입력란(다시 join하면 대기 요청은 취소된다).
3. 통제 페이지 roster에 대기 항목이 "기록 이어받기 승인" 버튼과 함께 보인다. 승인: `student merge { pendingId, intoId }` → 서버가 ① `intoId`의 기존 소켓이 아직 연결돼 있으면 `kicked { reason: 'kicked' }`로 끊고 기존 토큰을 무효화한다 ② 대기 소켓이 `intoId`의 기록(상태·닉네임)을 이어받는다 ③ 새 토큰을 발급해 대기 소켓에 `joined { studentId, token, nickname }`을 보내고 `snapshot`을 전달한다 ④ 로그 `admin merge`(줄에 **새 토큰을 포함**해 기록 — 재생이 그 토큰을 복원한다). 거부: `student kick { pendingId }` → 대기 소켓에 `kicked { reason: 'merge-rejected' }`, 화면은 "승인되지 않았습니다. 다른 닉네임으로 다시 시도해 주세요" (다시 `join` 가능).
4. **재생 의미**: `admin merge` 줄(새 토큰 포함)이 오면 재생은 `intoId` 기록이 **그 토큰**을 갖는 것으로 복원한다(merge 시점 이전의 `intoId` 행동은 그대로 이어지고, merge 뒤 행동은 새 소켓이 한 것과 동일하게 순서대로 적용). `admin kick` 줄이 오면 그 학생의 기록은 거기서 끝난다.

---

## 6. HTTP

### 6.1 라우트 표

| 주소 | 메서드 | 접근 | 응답 |
| --- | --- | --- | --- |
| `/` | GET | 누구나 | `index.html` (`no-store`). 앱이 수업 코드 입력 화면 |
| `/<숫자 4자리>` | GET | 누구나 | `index.html` (`no-store`). 열림·끝남·없음 구분은 앱이 `hello` ack로 |
| `/stage` | GET | 누구나(정적) | `index.html`. 앱이 `/api/me`로 로그인 판별 후 전면 비밀번호 화면 |
| `/control` | GET | 누구나(정적) | `index.html`. 통제 비밀번호 화면 |
| `/dev` | GET | 누구나(정적) | `index.html`. 앱이 통제 로그인 쿠키 확인 후 스냅숏 셸 |
| `/solo` | GET | `SOLO_ENABLED=true`일 때만 | 200 `index.html`, 아니면 **404** |
| `/assets/*` | GET | 누구나 | 빌드 산출물. `cache-control: public, max-age=31536000, immutable` |
| `/socket.io/*` | — | — | Socket.IO 핸들셰이크 |
| `/api/login` | POST | 누구나 | `200 { role }` + `Set-Cookie` / `401` / `429` |
| `/api/logout` | POST | 로그인된 역할 | `200` + 쿠키 만료 |
| `/api/me` | GET | 누구나 | `200 { role: 'stage' \| 'control' \| null }` |
| `/api/export/<code>.csv` | GET | 통제 쿠키 | `200 text/csv` / `401` / `404` |
| 그 외 모든 경로 | * | — | **404** |

**404 정책**: 서버는 위 표의 경로만 앱으로 보낸다. `/contorl` 같은 오타가 학생 화면이 되지 않게 한다. 정적 파일은 `src/dist`에서 서빙하고 `scripts/serve.mjs`의 역할을 흡수한다.

### 6.2 상태 코드

- `200` 성공. `401` 비밀번호 불일치/쿠키 없음. `404` 모르는 경로·없는 수업 코드(export). `429` 무차별 대입 잠금(60초). `500` 서버 오류.
- 로그인 요청은 `timingSafeEqual`로 비교한다. 성공/실패 응답 시간이 같아야 한다.

### 6.3 쿠키

| 이름 | 역할 | 속성 |
| --- | --- | --- |
| `gg_stage` | 전면 | `HttpOnly`, `Secure`(NODE_ENV=production), `SameSite=Strict`, `Path=/`, `Max-Age=43200`(12시간) |
| `gg_control` | 통제 | 위와 같음 |

- **요청·응답 모양**: `POST /api/login` 본문 `{ role: 'stage' | 'control'; password: string }` → 성공 `200 { role }` + `Set-Cookie`, 실패 `401`. `POST /api/logout` 본문 `{ role }` → 그 역할 쿠키 만료(`Max-Age=0`).
- **값**: `v<pwVer>.<role>.<exp>.<sig>`
  - `pwVer` = sha256(해당 비밀번호) 앞 8자리(16진수). `.env`의 비밀번호를 바꾸고 서버를 재시작하면 `pwVer`가 달라져 **기존 로그인이 모두 풀린다**(계획 §7.1).
  - `sig` = HMAC-SHA256(COOKIE_SECRET, `${pwVer}.${role}.${exp}`)의 16진수.
  - `exp` = 만료 epoch 밀리초.
- 서명 검증 실패·만료·역할 불일치는 "로그인 없음"으로 취급한다(오류 구분 없음).
- 소켓 연결 때 같은 쿠키가 자동으로 실려 서버가 역할을 확인한다(§5.2).

### 6.4 무차별 대입 방지

- 같은 IP에서 로그인 실패 5회/1분 → 60초간 그 IP의 `/api/login`은 `429`.
- IP는 소켓 원격 주소를 기본으로 쓰고, `TRUSTED_PROXY`가 설정돼 있고 요청이 그 주소에서 왔을 때만 `X-Forwarded-For`의 **마지막** 값을 클라이언트 IP로 쓴다.

### 6.5 캐시 헤더

- `index.html`(및 앱 라우트로 서빙되는 모든 HTML): `cache-control: no-store`.
- `/assets/*`(Vite 해시 파일명): `cache-control: public, max-age=31536000, immutable`. 60대가 같은 와이파이로 받아도 재접속마다 다시 받지 않는다.
- `/socket.io/*`: Socket.IO 기본값.

### 6.6 개발 환경

- 게임 서버: `pnpm server` → `http://localhost:8091` (PORT).
- Vite 개발 서버: `pnpm dev` → `http://localhost:5173`. `src/vite.config.ts`에 프록시를 추가한다:

```ts
server: {
  proxy: {
    '/socket.io': { target: 'http://localhost:8091', ws: true },
    '/api': 'http://localhost:8091',
  },
}
```

- 개발 중 Vite의 SPA 폴백은 모든 경로를 `index.html`로 준다(앱 라우터가 모르는 코드·경로에 끝난/없는 화면을 보여 준다). 알려진 경로만 서빙하는 404 정책은 **배포 서버의 규칙**이다.
- 앱의 `base`를 `'./'`에서 `'/'`로 바꾼다(계획 §8-8). 단일 HTML 빌드(`scripts/build-single.mjs`)는 자기 설정을 유지한다.

---

## 7. `.env`와 시작 검증

설정은 저장소 루트의 `.env`(gitignore)에 두고 빈 값의 `.env.example`을 커밋한다. 서버는 `node --env-file=.env server/src/main.ts`로만 실행한다.

| 변수 | 기본값 | 설명 |
| --- | --- | --- |
| `PORT` | `8091` | HTTP·소켓 포트 |
| `STAGE_PASSWORD` | (필수) | 전면 비밀번호 |
| `CONTROL_PASSWORD` | (필수) | 통제 비밀번호. `STAGE_PASSWORD`와 달라야 함 |
| `COOKIE_SECRET` | (필수) | 쿠키 서명용 무작열 문자열. 32자 이상 |
| `DATA_DIR` | `./data` | 세션 로그 루트 (gitignore) |
| `SOLO_ENABLED` | `false` | `true`일 때만 `/solo` 200 |
| `NODE_ENV` | `production` | `development`면 쿠키 `Secure` 끔 |
| `TRUSTED_PROXY` | (없음) | 이 주소에서 온 요청만 `X-Forwarded-For` 신뢰 |
| `MAX_STUDENTS` | `60` | 수업별 최대 학생 수 |
| `LESSON_ID` | `first-salary` | `openClass`의 기본 레슨 |

커밋되는 `.env.example`은 **미리 채워 둔다**(비밀번호만 빈 값): `PORT=8091`, `TRUSTED_PROXY=10.10.2.21`(§12.1 배포 사실), `DATA_DIR=./data`, `SOLO_ENABLED=false`, `NODE_ENV=production`, `MAX_STUDENTS=60`, `LESSON_ID=first-salary`. `.gitignore`에 `.env`과 `data/`를 추가한다(S0 소유, §13).

**시작 검증** — 서버는 다음을 확인하고 하나라도 어기면 오류 메시지를 출력하고 `process.exit(1)`:

1. `STAGE_PASSWORD`, `CONTROL_PASSWORD`가 비어 있으면 안 됨.
2. 두 비밀번호가 같으면 안 됨.
3. `COOKIE_SECRET`이 비어 있거나 32자 미만이면 안 됨.
4. `DATA_DIR`이 없으면 만들고, 쓸 수 없으면 안 됨.
5. `PORT`가 1~65535 정수여야 함.

---

## 8. 서버 내부

### 8.1 Room과 직렬 큐

- **Room 하나 = 수업 하나.** `openClass` 때 만들어지고 코드로 조회된다. 열린 수업이 여럿일 수 있다(리허설).
- **모든 학생 행동(`act`, `draft`, `join`)과 교사 명령(`next`, `prev`, …)은 수업별 큐 하나에 들어가 순차 처리된다.** 교사의 `next`와 학생의 마지막 제출이 동시에 와도 상태가 섞이지 않는다. 큐는 promise 체인(뮤텍스)으로 충분하다 — 워커가 필요 없다.
- Room 상태: `ClassState`, 학생별 `StudentRecord { id, token, nickname, states: Record<string /* 세그먼트 id */, unknown>, draft, connected, late, stalled, pendingMerge, device, autoAppliedQueue, seq }`. **활동 상태는 세그먼트 id를 키로 따로 보관한다** — 활동 세그먼트가 여러 개인 레슨이어도 서버는 활동 구현을 몰라도 된다.
- **`join` 승인 시 서버는 레슨의 모든 활동 세그먼트마다 `init`을 호출한다**(세그먼트 순서대로). 각 `init`의 기저 상태를 `states[segmentId]`에 넣고, 반환한 행동을 그 세그먼트의 상태에 곧바로 적용·기록한다(월급 등 주입값 포함). 활동이 하나뿐인 지금 레슨에서도 같은 규칙을 따른다.

### 8.2 이벤트 소싱 로그

`DATA_DIR/sessions/<code>/log.jsonl`에 한 줄씩 덧붖인다(재생용). 서버는 행동을 `unknown`으로만 기록한다(§1.2 — core 의존 없음). 줄 타입:

```ts
// server/src/log.ts (계약) — Action 타입을 모른다. unknown으로 기록한다.
import type { BeatRef, ClassCode, Cursor } from '@gagyebu/live';

export type LogLine =
  | { t: 'open'; ts: number; code: ClassCode; lessonId: string }
  | { t: 'join'; ts: number; studentId: string; nickname: string; token: string; late: boolean;
      inits: { segmentId: string; actions: unknown[] }[] } // 월급 같은 주입 난수 값이 행동에 박혀 있음
  | { t: 'act'; ts: number; studentId: string; seq: number; beat: BeatRef; action: unknown }
  | { t: 'auto'; ts: number; studentId: string; beat: BeatRef; actions: unknown[];
      notices: string[]; overflow: boolean; kind: 'fallback' | 'backfill' }
  | { t: 'transition'; ts: number; studentId: string; from: BeatRef; to: BeatRef; actions: unknown[] }
  | { t: 'cursor'; ts: number; cursor: Cursor }
  | { t: 'reveal'; ts: number; on: boolean }
  | { t: 'spotlight'; ts: number; studentId: string | null }
  | { t: 'admin'; ts: number;
      op: { kind: 'rename'; id: string; nickname: string }
        | { kind: 'kick'; id: string }
        | { kind: 'merge'; pendingId: string; intoId: string; token: string } // 새 토큰을 함께 기록(재생 복원용)
        | { kind: 'lockJoin'; on: boolean } }
  | { t: 'end'; ts: number };
```

- **전이 행동도 기록한다**(`transition` 줄): 재생이 live와 정확히 같은 순서로 적용하도록. 없으면 재생 결과가 실제 수업과 달라진다(감사 B1).
- **draft는 로그에 남기지 않는다**(§4.2). 기본값 루프의 결과는 `auto` 줄에 남는다.
- **재생**: 서버 시작 시 각 세션 디렉터리를 읽어 줄 순서대로 적용한다 — `join`은 각 활동 세그먼트의 `init` 기저 + `inits.actions`, 이후 `act`·`auto`·`transition`은 레지스트리의 `apply`로, `cursor`·`reveal`은 ClassState에. `end` 줄이 없으면 그 수업은 열린 채 복원되고, 학생들은 토큰으로 재접속한다. `end` 줄이 있으면 Room으로 복원하지 않고 `ended.json`에만 남긴다(§14 #144). 로그에 없는 것(초안, 스로틀 상태, 무차별 대입 카운터, 연결 여부)은 복원 대상이 아니다. 파싱할 수 없는 줄은 경고와 함께 건너뛰고 세션 하나가 깨져도 나머지는 복원된다(§14 #141).
- 로그는 append-only이고 한 수업의 모든 쓰기는 직렬 큐 안에서 일어나므로 락이 필요 없다. 세션 로그를 열 때 찢어진 마지막 줄(비정상 종료로 덧붙이다 만 줄)은 잘라내서 이후 append가 깨진 줄에 이어 붙지 않게 한다(§14 #141).

### 8.3 토큰·재접속·지각·연결 끊김

- **토큰**: `crypto.randomBytes(16)`의 base64url(128비트). `join` 승인 때 발급, 클라이언트는 `localStorage['gg_token_<code>']`에 저장. 코드별로 저장하므로 지난 수업 탭이 자동 재접속해 섞이지 않는다.
- **재접속**: `hello { token }` → 기존 `StudentRecord`로 재접속, `snapshot` 전체 전달. 끊긴 동안 자동 처리된 내용은 `autoApplied`로 전달된다.
- **연결 끊김**: 상태는 서버에 있으므로 똑같이 `next`의 기본값 루프로 처리되고, 다시 연결되면 현재 비트로 바로 들어온다. roster에 `connected: false`로 표시.
- **입장 시점 규칙 (결정)**:
  - 커서가 `join` 비트보다 **앞의 슬라이드 세그먼트**에 있을 때 입장하면 지각이 아니다 — `init`만 하고 현재 비트에서 기다린다.
  - 활동 세그먼트가 이미 **끝난 뒤**(뒤 슬라이드 등) 입장하면 지각 합류로 **활동 전체**를 채운다.
  - 입장하지 않은 접속자는 `join`이 잠기지 않는 한 모든 비트에서 닉네임 입력 화면을 본다(클라이언트 규칙, §10.4).
- **지각 합류 채우기 (결정)**: `join` 승인 시 서버는 **live 비트 "바로 앞"까지의 비트들**(활동 세그먼트 처음부터 highMark 직전까지)을 순서대로 걷는다. 각 `work` 비트에서 기본값 루프를 돌리고(§5.5의 3단계와 같은 규칙, 통지 없음), 비트 b에서 b+1으로 넘어갈 때 `transition(b, b+1)`을 **`next`와 똑같이** 적용한다 — **live 비트로 들어가는 전이도 포함**(안 그러면 guide-6→budget의 `goto`가 건너뛰어져 `confirmBudget`이 실패한다). 매 걸음을 `auto { kind: 'backfill' }`·`transition` 줄로 기록한다. show 비트는 상태 조작 없이 건너뛴다. **live 비트 자체는 채우지 않는다** — work 비트면 그 학생은 그 비트에서 정상적으로 참여하고, show 비트면 그냥 보면 된다.

### 8.4 수업 코드

- 숫자 4자리, `crypto` 무작위. `stage`·`solo` 같은 경로와 겹치지 않는다(전부 4자리 숫자 패턴으로만 판별).
- **제외 집합**: 현재 열린 수업의 코드 + 최근에 끝난 수업의 코드. 끝난 목록은 `DATA_DIR/ended.json`(`{ [code]: endedAt }`)에 보관하고 **48시간**이 지나면 항목을 지운다. 8천 개(10^4에서 제외 집합을 뺀 것)가 남아 있으므로 충돌은 사실상 없다.

### 8.5 CSV 내보내기

`GET /api/export/<code>.csv`(통제 쿠키 필수). 서버는 core를 모르므로 **활동 레지스트리의 내보내기 계약(`exportColumns`·`exportRows`, §4.2)으로 일반적으로 조립**한다:

- 열 머리글 = 활동의 `exportColumns`. 각 학생의 최종 상태에 `exportRows(s, { studentId, nickname })`를 호출해 행을 얻는다. 이 문서의 서버는 BOM 추가, CSV 이스케이프(`"`·쉼표·줄바꿈), 인코딩만 책임진다.
- 가계부 활동의 열(활동이 정의): `studentId, nickname, month, eventCode, sceneId, choiceId, choiceLabel, kind, auto, tags, payment`. `payment` 등 `PaymentPlan`을 문자열로 만드는 방식(예: `emergency:520000;card:80000/3`)은 **activity-gagyebu가** 구현한다(§9). `auto` 열은 자동 처리된 선택 `true`.
- 로그 재생으로 복원한 상태에서 뽑는다(재생은 §8.2 규칙).

### 8.6 파일 구성

```
server/
  package.json             (@gagyebu/server, exports: ./src/main.ts)
  src/
    main.ts     // 진입점: env 검증 → http 서버 → socket.io 붙이기 → 로그 재생
    env.ts      // .env 읽기·검증 (§7)
    auth.ts     // 쿠키 서명·검증, 무차별 대입 제한 (§6.3~6.4)
    http.ts     // /api/* 라우트, CSV 내보내기
    static.ts   // 정적 파일 + 캐시 헤더 + 알려진 경로만 앱(§6.1)
    room.ts     // Room, 직렬 큐, next/prev/fallback/전이 (§5.5, §8.1)
    log.ts      // JSONL 기록·재생 (§8.2)
    codes.ts    // 수업 코드 발급 (§8.4)
    activities.ts  // activity id → ActivityLogic 레지스트리 (gagyebu만 등록)
```

---

## 9. `@gagyebu/activity-gagyebu`

가계부 활동의 순수 로직. `ActivityLogic<GagyebuConfig, GameState, Action, GagyebuStats>`을 구현한다. `apply`는 `core.step`을 감싸고, 기본값은 core-api.md §4.3의 함수들을 쓴다.

### 9.1 설정

```ts
// packages/activity-gagyebu/src/config.ts
export interface GagyebuConfig {
  /** 안내 카드 1~6 비트 포함 (기본 true) */
  guide: boolean;
  /** N월 비트의 공개 토글 (기본 true). false면 reveal 없는 work 비트 */
  monthReveal: boolean;
  /** 발표 비트 포함 (기본 true) */
  spotlight: boolean;
  /** 미완료가 있을 때 next에 확인 대화상자 (기본 true) */
  confirmForce: boolean;
}
```

`showProgressOnStage`(TV에 완료 인원 표시)는 활동 설정이 아니라 **레슨 설정**(`Lesson.settings`, §4.1)이다. 기본 false.

### 9.2 비트 목록

`beats(cfg)`가 내보내는 순서. `reveal`은 `cfg.monthReveal`이 true일 때만 붙는다.

| # | id | 라벨 | mode | reveal | notes(예) |
| --- | --- | --- | --- | --- | --- |
| 1 | `join` | 입장 | work | | QR·링크 안내 |
| 2 | `salary` | 월급 공개 | show | | 기준 ±10% 설명 |
| 3 | `survey` | 소비습관 설문 | work | | 7문항 한 화면 |
| 4 | `survey-result` | 설문 결과 | show | | 분포 없음 |
| 5~10 | `guide-1`..`guide-6` | 안내 n | show | | 카드별 발표자 노트 (cfg.guide) |
| 11 | `budget` | 가계부 작성 | work | ○ | 추천값·프롬프트 안내 |
| 12~22 | `m1`..`m11` | N월 | work | ○ (2·3·5·6·7·8·9·11월; cfg.monthReveal) | 달마다 교훈 |
| 23 | `m12` | 12월 결산 | work | ○ | |
| 24 | `present` | 발표 | show | | 발표 진행 순서 (cfg.spotlight) |

`m4`·`m10`(조용한 달)과 `m1`(튜토리얼)은 reveal이 없다. 한 달을 한 비트로 두므로 1년은 교사 클릭 20번 안팎이다.

### 9.3 비트별 done / fallback / transition

| 비트 | done | fallback(한 걸음) | transition(비트 이동 시) |
| --- | --- | --- | --- |
| `join` | 플랫폼이 판정(입장 승인됨). 활동은 항상 true | 없음(플랫폼이 지각 규칙으로 채움, §8.3) | 없음 |
| `salary` | show — 항상 true | 없음 | 없음 |
| `survey` | `survey.result !== null` | `submitSurvey { answers: defaultAnswers({}), auto: true }`. **설문 초안은 없다** — 제출 전 답은 서버에 오지 않으므로 기본값은 전 문항 중간 답 | 없음(`submitSurvey`가 이미 `phase: 'guide'`) |
| `survey-result`~`guide-6` | show — 항상 true | 없음 | `guide-6 → budget`: `goto { phase: 'budget' }` |
| `budget` | `phase === 'sim'` | `setBudget { budget: balanceBudget(초안 ?? state.budget, salary).budget, auto: true }` → `confirmBudget` (두 걸음, 각각 notice) | 없음(`confirmBudget`이 `phase: 'sim'`, `month: 1`, `step: 'payday'`) |
| `m1`..`m11` | `month === N && step === 'report'` | 아래 월 비트 규칙 | `m(N) → m(N+1)`: `step === 'report'`면 `endMonth`, 아니면 `[]`(방어 코드 — 마감 루프를 거치면 항상 report) |
| `m12` | `phase === 'result'` | 위 월 비트 규칙과 같되: `month < 12 && step === 'report'` → `endMonth`(재현, 규칙 1), `month === 12 && step === 'payday'` → `beginMonth`(12월 결산 처리). 이미 result면 없음 | 없음 |
| `present` | show — 항상 true | 없음 | 없음 |

월 비트 fallback 규칙 (`m1`..`m11`, `step` 우선순위대로):

1. `month < N && step === 'report'` → **`endMonth` (반복)** — stalled 학생이 뒤처진 달을 따라잡는 재현 규칙(감사 B2). `done`은 `month === N`일 때만 true이므로 이 걸음이 여러 번 나올 수 있다.
2. `step === 'payday'` → `beginMonth`.
3. `step === 'scene'` → `fallbackChoice(scene)`을 고르고, **선택지의 `kind`가 아니라 `pay`/`deposit`의 존재로** 나눈다(감사 B3 — `tryTen`·`flip3`처럼 `gamble`+`pay`가 있다):
   - `choice.pay`가 있으면: `choose { choiceId, amount: pay.adjustable ? pay.adjustable.min : undefined, payment: autoPaymentPlan(그 amount 기준).plan, auto: true }`. `to`가 있어도 같은 계획 규칙. `adjustable`일 때는 행동에 `amount`를 **명시적으로** 싣는다.
   - `choice.deposit`가 있으면: `choose { choiceId, depositTo: autoDepositTarget(deposit), auto: true }`.
   - 둘 다 없으면(`free`·`fixedPay`·`gamble` 단독·`budget`): `choose { choiceId, auto: true }`.
   - 지불 패널 작성 중(제출 전)이어도 서버는 패널 내용을 모르므로 같은 규칙을 쓴다(계획 §2.3).
4. `step === 'outcome'` → `continue`.
5. `step === 'adjust'` → `setBudget { budget: balanceBudget(초안 ?? state.budget, salary).budget, auto: true }`.

- **초안**: `budget`·`adjust`에서만 쓴다(§9.5). `GagyebuDraft`가 있으면 그 안에서, 없으면 `state.budget`에서 `balanceBudget`로 합계를 맞춘다. 편집을 한 번도 안 한 학생의 `state.budget`은 추천 가계부다.
- **notice 문구**는 활동이 만든다: 선택지 fallback은 `"시간 안에 고르지 못해 '<선택지 라벨>'이(가) 자동으로 선택됐어요"`, 가계부는 balanceBudget의 `changes`로 `"제출하지 않아 남는 돈 3만 원이 생활비 여유분으로 들어갔어요"` / `"제출하지 않아 여유 부족분 3만 원을 여가에서 줄였어요"` 형태.

**fallback notice 문구 전체 목록 (S4 구현 확정 — 서버는 전달만 하고 학생 화면은 그대로 보여 준다)**:

| 걸음 | notice |
| --- | --- |
| 설문 제출 | `제출하지 않아 모든 문항이 기본 답안으로 제출됐어요` |
| 가계부 setBudget — 남는 돈 | `제출하지 않아 남는 돈 <formatMan(남는금액)>이(가) 생활비 여유분으로 들어갔어요` |
| 가계부 setBudget — 부족분 | `제출하지 않아 여유 부족분 <formatMan(부족금액)>을(를) <생활비 여유분 \| 절감 항목 라벨(예: 여가·문화)>에서 줄였어요` |
| 가계부 확정 | `제출하지 않아 지금 가계부가 자동으로 확정됐어요` |
| beginMonth (1~11월) | `시간 안에 시작하지 않아 <N>월이 자동으로 시작됐어요` |
| beginMonth (12월 결산) | `시간 안에 시작하지 않아 12월 결산이 자동으로 진행됐어요` |
| choose (장면 선택) | `시간 안에 고르지 못해 '<선택지 라벨>'이(가) 자동으로 선택됐어요` |
| continue (결과 넘기기) | `시간 안에 넘기지 않아 결과 화면이 자동으로 넘어갔어요` |
| endMonth (뒤처진 달 재현) | `따라잡기 위해 <N>월을 자동으로 마쳤어요` |

가계부 비트의 fallback은 합계가 이미 맞는 학생(편집을 한 번도 안 한 학생의 추천 가계부 등)은 `setBudget`을 건너뛰고 `confirmBudget` 한 걸음으로 끝낸다(진전 보장, §14 #89).

### 9.4 비트별 Stats (모두 익명, 데이터 순서)

판별자는 `kind`다(비트 id 판별자는 `m12`와 `` `m${number}` ``이 겹쳐 모호해져 폐기 — 감사 R9). 표시형 비트·설문은 `{ kind: 'none' }`을 반환하고 화면이 알아서 그린다.

```ts
// packages/activity-gagyebu/src/stats.ts
import type { AccountId, EndingId, EventId, SceneChannel, SceneId, Won } from '@gagyebu/core';

export interface SceneTally {
  sceneId: SceneId;
  title: string;
  /** 그 장면까지 도달한 학생 수 (도달한 학생만 분모) */
  reached: number;
  /** 데이터 순서 그대로 */
  choices: { choiceId: string; label: string; count: number }[];
}

export interface MonthEntryTally {
  eventId: EventId;
  sceneId: SceneId;
  title: string;
  channel: SceneChannel;
  choices: { choiceId: string; label: string; count: number }[];
}

export type GagyebuStats =
  | { kind: 'none' } // survey, survey-result, guide-*, present, 슬라이드 — 집계 없음
  | { kind: 'join'; joined: number; connected: number; nicknames: string[] }
  | { kind: 'salary'; baseSalary: Won; salaries: Won[] } // 기준 ±10% 띠 위 점들
  | {
      kind: 'budget';
      savingsRates: number[];               // 학생별 저축률 (평균은 Stage에서)
      shares: Record<AccountId, number>[]; // 학생별 계좌 배분 (계좌 6종)
      autoCount: number;
    }
  | {
      kind: 'month';
      month: number;                        // 1~11
      entry: MonthEntryTally | null;        // 그 달 배치 이벤트의 첫 장면. 조용한 달(4·10)은 null
      /** 같은 달에 바로 이어진 장면 (예: 2월 seller, 5월 message) */
      chained: SceneTally[];
      /** 예약 후속 장면 — 그 달에 예약돼 나타난 장면 (예: 4월 check4, 6월 check6, 10월 revolving) */
      scheduled: SceneTally[];
      /** 지금 이어진 장면(연쇄·예약 포함)에 서 있는 학생 수 */
      inChained: number;
      netWorths: number[];                  // 조용한 달 순자산 분포 변화용
      autoCount: number;
    }
  | {
      kind: 'settlement';                   // m12
      endings: { endingId: EndingId; label: string; count: number }[];        // ENDING_ORDER 순서
      achievements: { achievementId: string; label: string; rate: number }[]; // ACHIEVEMENT_ORDER 순서
      netWorths: number[];
      autoCount: number;
    };
```

- `scheduled`는 `chained`와 같은 모양이지만 그 달 **예약 목록**(`scheduled` 필드의 실행 기록)에서 나온다 — 이벤트 없는 4·10월에도 시세·리볼빙 장면 분포가 나온다(감사 M2).
- 선택 분포 막대는 모두 같은 색, 데이터 순서 그대로. 자동 처리 응답은 분포에서 빼고 `autoCount`로 따로 센다.
- `m1`·`m4`·`m10`처럼 선택 장면이 없는 달은 `entry: null`(예약 장면은 `scheduled`에), `netWorths`로 "돈이 쌓이는 달" 연출.
- 설문 답·소비 성향은 개인 성향 정보이므로 어디에도 분포로 나오지 않는다.
- **`fallbackPreview`(§5.1)의 정의**: 미완료 학생 중 studentId 오름차순 첫 학생의 현재 장면에서 `fallbackChoice`의 라벨. 미완료가 없으면 `null`. `previewFallback`(§4.2)은 이 한 학생에 대해서만 계산한다.

### 9.5 초안 타입

```ts
// packages/activity-gagyebu/src/draft.ts
import type { Budget } from '@gagyebu/core';

/** 가계부 작성·조정 비트에서 2초 간격으로 묶어 보내는 편집 중인 안.
 *  클라이언트는 제출(act) 직전에 마지막 초안을 즉시 flush한다(§5.4). */
export interface GagyebuDraft {
  kind: 'budget';
  budget: Budget;
}
```

### 9.6 입장·닉네임 소유권 (결정)

**플랫폼이 소유한다.** 토큰 발급, roster, 이름 유효성(1~10자, 수업 내 유일), rename·kick·merge, 지각 입장 규칙은 전부 `@gagyebu/live`/서버에 있다. 활동은 `init`으로 닉네임을 받아 `start` 행동에 넣을 뿐이다. `join` 비트의 `done`은 플랫폼이 판정하고(입장 승인 = done), 활동은 `join` 비트에서 항상 true를 반환한다.

### 9.7 CSV 내보내기 구현

`ActivityLogic`의 `exportColumns`·`exportRows`(§4.2)를 아래처럼 구현한다:

- `exportColumns`: `['studentId', 'nickname', 'month', 'eventCode', 'sceneId', 'choiceId', 'choiceLabel', 'kind', 'auto', 'tags', 'payment']`
- `exportRows(state, { studentId, nickname })`: `state.decisions`를 기록 순서대로 행으로 펼친다. `studentId`·`nickname`은 인자 값을, 나머지 열은 `DecisionRecord` 필드에서. `payment`는 `PaymentPlan` → `"emergency:520000;card:80000/3"` 형식 문자열, `tags`는 `;` 결합, `auto`는 boolean. (이 변환은 core에 두지 않고 activity-gagyebu가 소유한다 — 서버가 core를 모르기 때문, §1.2.)

### 9.8 파일 구성

```
packages/activity-gagyebu/
  package.json       (@gagyebu/activity-gagyebu)
  src/
    index.ts         // gagyebuLogic: ActivityLogic<GagyebuConfig, GameState, Action, GagyebuStats>
    config.ts        // GagyebuConfig
    beats.ts         // 비트 목록 (§9.2)
    progress.ts      // done/fallback/transition (§9.3)
    stats.ts         // GagyebuStats 계산 (§9.4)
    draft.ts         // GagyebuDraft
    export.ts        // exportColumns·exportRows (§9.7)
```

---

## 10. 클라이언트 (`src/`)

### 10.1 라우트와 코드 분할

`src/vite.config.ts`의 `base: '/'`. 라우팅은 라이브러리 없이 `window.location.pathname`으로 직접 (라우터 의존성 추가 없음):

| 주소 | 컴포넌트 | 분할 |
| --- | --- | --- |
| `/` | `CodeEntryPage` | 기본 청크 |
| `/<4자리>` | `StudentPage` | 동적 import |
| `/stage` | `StagePage` | 동적 import |
| `/control` | `ControlPage` | 동적 import |
| `/dev` | `DevPage`(DraftShell) | 동적 import |
| `/solo` | `SoloPage` | 동적 import |

전면·통제·개발·혼자 화면은 서로 다른 청크로 나뉜다(학생이 받는 JS에 통제 코드가 없게). 끝난 수업(`hello` → `ended`), 없는 수업(`not-found`), 입장 마감은 학생 화면 안의 상태로 렌더링한다.

### 10.2 `useLive` 훅

```ts
// src/src/live/useLive.ts (계약) — 게임 타입은 제네릭으로 감춘다(§1.2).
// 앱의 활동 계층이 useLive<GameState, Action, GagyebuDraft>로 좁힌다(liveTypes.ts, §5.1).
export type LiveStatus =
  | 'connecting' | 'open' | 'reconnecting'
  | 'ended' | 'not-found' | 'join-locked';

export interface UseLiveResult<S = unknown, A = unknown, D = unknown> {
  status: LiveStatus;
  classState: ClassState | null;
  lesson: Lesson | null;
  you: { studentId: string; nickname: string } | null;
  /** 커서의 활동 세그먼트 상태. 슬라이드 세그먼트면 null */
  state: S | null;
  /** live 비트(highMark)에서 이 학생의 완료 여부(서버가 ActAck·state·snapshot의 done으로 알려 줌).
   *  true면 Audience는 대기 화면 */
  submitted: boolean;
  /** 서버가 아직 안 보여 준 자동 처리 안내 */
  autoApplied: AutoAppliedNotice[];
  /** 커서 비트 (lessonBeats로 해석). 없으면 null */
  beat: Beat | null;
  join(nickname: string): Promise<JoinAck>;
  dispatch(action: A): Promise<ActAck<S>>;
  /** 2초 간격으로 묶어 draft 이벤트로 전송. 제출 직전 flush는 훅이 한다(§5.4) */
  draft(data: D): void;
}

export function useLive<S = unknown, A = unknown, D = unknown>(code: string): UseLiveResult<S, A, D>;
```

- `useLive`는 `hello` → `snapshot` 흐름, 재접속(Socket.IO 내장 자동 재접속), version 기반 낡은 메시지 버림(§5.3), 토큰 저장(`localStorage['gg_token_<code>']`), `ended`/`not-found` 시 토큰 삭제를 모두 책임진다.
- `submitted`는 마지막으로 받은 `done`(ActAck·`state`·`snapshot`)이다. 리뷰 중에도 live 비트 기준 값이 유지된다.
- `dispatch`는 ack 전 다음 행동을 큐에 쌓지 않고 무시한다(터치 연타 방지). 화면은 ack의 `state`를 곧바로 그린다(낙관적 업데이트 없음). `dispatch` 직전에 마지막 draft를 즉시 전송한다(§5.4).

### 10.3 연결 표시·Wake Lock·대기 화면

- **재접속 띠**: `status === 'reconnecting'`이면 모든 학생 화면 상단에 "다시 연결 중" 띠. 복구되면 `snapshot`으로 전체 복원.
- **Wake Lock**: `useWakeLock()` — 학생 화면 마운트 시 `navigator.wakeLock.request('screen')`, 언마운트·숨김 시 해제. 미지원 브라우저는 조용히 넘어간다.
- **대기 화면**: `submitted && beat.mode === 'work'`이면 Audience는 `"선생님이 다음으로 넘기면 계속됩니다"` + 자기 계좌·이번 달 결과 읽기 전용 + AI 프롬프트 복사를 보여 준다(`src/src/live/WaitingScreen.tsx`). 제출 전 화면과 같은 부품을 읽기 전용으로 재사용한다.

### 10.4 학생 화면 구성

```
StudentPage = 코드/닉네임/끝남/없음 상태 화면
           | 입장하지 않았으면(join 승인 전) → 모든 비트에서 닉네임 입력 화면 (join 잠금 전까지, §8.3)
           | 커서 비트가 슬라이드 세그먼트 → SlideCanvas (버튼 없음)
           | 커서 비트가 활동 세그먼트 → ACTIVITY_VIEWS[activityId].Audience
```

- **슬라이드 표시기** `SlideCanvas({ deckId, slideId, step })`: 1920×1080 논리 캔버스를 그리고 기기 화면에 맞춰 비율을 유지해 축소·확대(남는 곳은 여백). TV와 노트북·태블릿·휴대폰이 같은 구도. 조작 요소·진행 표시·커서 반응 없음. 디자인 토큰(색·서체)은 `src/DESIGN.md`를 그대로 쓴다.
- **자동 처리 안내 카드**: `autoApplied` 알림이 있으면 **하나의 중립 카드**로 정상 흐름 맨 위(콘텐츠 위, 오버레이 아님)에 보여 준다 — 제목 "자동으로 처리된 내용", 짧은 글머리 목록, "닫기" 버튼. 커서 비트가 바뀌면 서버 큐가 비워지므로 카드도 사라진다(§14 #134).
- 이동 버튼은 라이브 모드에서 모두 숨긴다(§10.8 ScreenProps 계약). 표시형 비트는 버튼이 하나도 없는 화면.
- **표시형 비트의 Audience·Stage는 `beat.id` + 세그먼트 상태 데이터만으로 그린다** — 학생의 `phase`·`step`을 보지 않는다(§4.1 리뷰 모드: 5월에 안내 카드를 다시 보여 줘야 하므로).

### 10.5 전면 화면 (Stage)

- **TV는 커서를 따라간다**(리뷰 중에는 되돌아본 비트를 그린다). 같은 `SlideCanvas`(슬라이드 비트), 활동 비트는 `ACTIVITY_VIEWS[id].Stage` + `stats` + `spotlightState`.
- **`stats`는 `stats.beat`가 지금 그리는 비트와 같을 때만** 활동 통계로 넘긴다(다르면 null로 취급, §5.7). 리뷰 중 커서 비트의 통계(예: 월급 분포)는 이 규칙으로 그려진다.
- 입장 비트: QR 코드(`qrcode` 라이브러리), 큰 주소 `gagyebu.taesoo.uk/<code>`, 입장 인원, 닉네임 벽.
- `lesson.settings.showProgressOnStage`일 때만 `progress`를 그린다(항상 highMark 기준). 기본은 통제 페이지에만 완료 인원이 보인다.

### 10.6 통제 페이지 (Control) — 계획 §10

| 영역 | 내용 |
| --- | --- |
| 수업 | 수업 열기(코드 발급, 화면에 크게), 끝내기, 학생 링크 복사, TV 화면 열기(`/stage` 새 탭), 로그아웃(`POST /api/logout`) |
| 타임라인 | 세그먼트·비트 목록(`lessonBeats`). 현재 위치 강조, 표시형 비트는 클릭해 `goto` |
| 다음 | 큰 버튼. 키보드 **→ / Space / PageDown = next**, **← / PageUp = prev** (발표용 클리커 호환) |
| 완료 현황 | live 비트 완료/접속/전체(`stats.progress`, **항상 highMark 기준** — 리뷰 중에도), 미완료 명단(이름, 연결 상태, `roster[].scene`) |
| 기본값 미리보기 | `stats.fallbackPreview` + 지금 넘기면 자동 처리될 인원(미완료 수) |
| TV 미리보기 | 지금 TV에 보이는 화면의 축소 모형(같은 컴포넌트를 작게). 발표자 **닉네임**은 통제 소켓이 `spotlightState`를 받지 못하므로(§5.2) roster + `classState.spotlight`에서 클라이언트가 만들어 넘긴다(§14 #132). 발표자 **상태**는 여전히 null — 최종 확인은 실제 `/stage` 탭 |
| 발표 | 학생 목록에서 `spotlight` 지정·해제 |
| 학생 관리 | 이름 변경, 내보내기, 기록 이어받기 승인(`pendingMerge` 항목), 입장 마감(`lockJoin`) |
| 비트별 패널 | `ACTIVITY_VIEWS[id].ControlPanel` (예: 이어진 장면에 있는 학생 수) |
| 확인 대화상자 | `next` ack가 `confirm-required`면 `"N명이 아직 고르는 중입니다. 기본 선택지로 넘길까요?"` → 확인 시 `next { force: true }` |

### 10.7 로그인·코드 입력 화면

- `/stage`·`/control`·`/dev`: 앱 시작 시 `GET /api/me`로 확인. `role`이 아니면 비밀번호 입력 화면(주소창의 역할로 어느 비밀번호인지 표시). 제출 → `POST /api/login` → 성공 시 같은 경로 다시 렌더링. `429`면 "잠시 후 다시" 안내.
- `/` (코드 입력): 4자리 숫자 입력 → `/<code>`로 이동. 진행 중인 수업이 없으면 학생 화면이 "지금 진행 중인 수업이 없어요"를 보여 준다.
- **끝난 수업 화면**: "끝난 수업입니다" + 그 코드의 토큰 삭제. **없는 수업 화면**: "수업 코드를 확인해 주세요".

### 10.8 기존 화면의 새 `ScreenProps` 계약

`packages/draft-kit`의 `ScreenProps`를 아래로 바꾼다. 기존 6개 화면 컴포넌트(`src/src/screens/*.tsx`)는 이 계약으로 고쳐 연결한다.

```ts
// packages/draft-kit/src/index.tsx (계약)
import type { Action, GameState } from '@gagyebu/core';
import type { Beat } from '@gagyebu/live';
import type { FixtureUi } from '@gagyebu/core';

export interface ScreenProps {
  state: GameState;
  /** 현재 비트. id로 세부 표시 결정: 'survey', 'guide-3', 'm2', 'present' … */
  beat: Beat;
  revealed: boolean;
  /** 이 비트 제출 완료 (라이브: 서버 판정 / dev·solo: false) */
  submitted: boolean;
  mode: 'live' | 'solo' | 'dev';
  dispatch: (action: Action) => void;
  draft: (data: unknown) => void;
  /** dev 모드에서만 (스냅숏 힌트). 라이브·solo에서는 undefined */
  ui?: FixtureUi;
}
```

- 화면은 **`beat.id`를 먼저** 보고 렌더링한다. `ui` 힌트는 dev 모드 전용이다(라이브 모드에서 설문은 한 화면 7문항, 안내는 비트당 1장이므로 `ui.surveyIndex`·`ui.guideIndex`가 필요 없다).
- `mode === 'live'`에서는 이전/다음/"처음부터 다시"/"발표용 크게 보기" 버튼을 렌더링하지 않는다. 제출 버튼만 남긴다.
- `mode === 'solo' | 'dev'`에서는 화면 스스로 다음 단계로 넘어가는 UI를 가질 수 있다(§10.9 어댑터, §10.10 solo).

### 10.9 draft-kit 어댑터 (dev 호환)

`DraftShell`은 스냅숏 id를 그대로 쓰되 화면에는 §10.8 계약을 맞춰 준다.

```tsx
// packages/draft-kit/src/index.tsx (계약, DraftShell 시그니처)
export function DraftShell(props: {
  screens: Record<ScreenId, ComponentType<ScreenProps>>;
  title: string;
  /** 스냅숏 id + 행동 → 이동할 스냅숏 id. null이면 무시 */
  route: (fixtureId: string, action: Action) => string | null;
  /** 스냅숏 id → 비트 (라이브 비트 id와 같은 id를 쓴다) */
  beatOf: (fixtureId: string) => Beat;
}): ReactElement;
```

- DraftShell이 만드는 props: `state` = `structuredClone(fixture.state)`, `beat` = `beatOf(fixture.id)`, `revealed: true`, `submitted: false`, `mode: 'dev'`, `dispatch` = `(a) => { const next = route(fixture.id, a); if (next) go(next); }`, `draft` = no-op, `ui` = `fixture.ui`.
- `src/src/dev/`가 `route`·`beatOf`를 제공한다: 기존 `components/sim/routes.ts`의 `NEXT_FIXTURE`/`SCENE_FIXTURE` 이동표를 `(fixtureId, action) → fixtureId` 함수로 다시 쓰고, `packages/core/src/fixtures.ts`의 스냅숏마다 대응하는 라이브 비트 id(`beatOf`)를 둔다. `/dev#/<fixture>`와 `pnpm shots`가 그대로 통과해야 한다.

### 10.10 `/solo` 로컬 모드

- 서버 없이 같은 화면 자산으로 혼자 진행. `useReducer(step, createInitialState(...))`로 로컬 상태를 굴리고, `mode: 'solo'`로 `ScreenProps`를 만든다.
- show 비트에는 "다음" 버튼이 있고(로컬 커서만 이동), work 비트는 `dispatch`로 진행한다. 공개(reveal) 토글·확인 대화상자·대기 화면 없음(넘길 때 자동으로 공개 상태). 월급은 `rollSalary(Math.random)`.
- 가계부 초안 전송 없음, 기본값 루프 없음. 학생이 직접 모든 단계를 마쳐야 한다.

### 10.11 기기 대응 (노트북 우선, 모든 기기 가능)

- 기준은 노트북(1366×768). 태블릿 세로·휴대폰: 시뮬레이션 오른쪽 기둥(계좌·상태·가계부)을 접는 패널로, 지불 패널은 "수단 고르기 → 금액" 2단계로(DESIGN.md 6장 기존 문제). `pnpm shots`의 laptop·tablet·tabletPortrait·phone 4종 기준을 수업 모드 화면에도 적용한다.

### 10.12 파일 구성

```
src/src/
  routes.tsx          // 주소 → 페이지 (§10.1)
  live/               // useLive.ts, socket.ts, banner.tsx, useWakeLock.ts, WaitingScreen.tsx
  activities/
    registry.ts       // ACTIVITY_VIEWS (§4.3)
    gagyebu/          // liveTypes.ts(§5.1), Audience.tsx, Stage.tsx, ControlPanel.tsx (기존 screens/ 재사용)
    slides/           // SlideCanvas.tsx, registry.tsx, decks/*.tsx
  stage/              // StagePage.tsx
  control/            // ControlPage.tsx (§10.6 영역별 컴포넌트)
  solo/               // SoloPage.tsx
  dev/                // draft-kit 어댑터: route(), beatOf() (§10.9)
  screens/            // 기존 6화면, ScreenProps 새 계약으로 (§10.8)
  components/         // 기존 부품 + TV 재사용 부품(장면 카드 큰 모양, 읽기 전용 선택지, 분포 막대)
```

---

## 11. 스크립트

### 11.1 `scripts/bots.mjs`

```bash
node scripts/bots.mjs --url http://localhost:8091 --code 4821 --n 60 --lazy 0.1 --seed 42
```

| 인자 | 기본 | 설명 |
| --- | --- | --- |
| `--url` | `http://localhost:8091` | 서버 주소 |
| `--code` | (필수) | 수업 코드 |
| `--n` | `60` | 학생 수 |
| `--lazy` | `0.1` | 10%는 어떤 work 비트에도 답하지 않음(기본값 처리 검증) |
| `--seed` | `42` | 선택 재현용 시드 |
| `--auto-next` | (끔) | 교사 역할도 스크립트가 대신: work 비트마다 잠시 기다렸다가 `next` 전송 |
| `--control-password` | (없음) | `--auto-next`에 필요. 통제 비밀번호. `POST /api/login { role: 'control' }`로 쿠키를 받아 통제 소켓 연결에 싣는다 |

동작 계약:

- 봇마다 소켓 하나. `hello`+`join`(닉네임 `bot-01`…) 후 `snapshot`으로 상태를 유지한다.
- `class`가 오면 커서 비트를 따라가고, work 비트에서 lazy가 아니면 행동한다: 설문 → 시드로 고른 답, 가계부 → 추천 가계부 확정(`recommendBudget`+`confirmBudget`), 장면 → `choiceAvailability`로 열린 선택지 중 시드로 하나 + `pay`가 있으면 `autoPaymentPlan` + `deposit`이 있으면 첫 계좌. core와 활동 로직을 상대 경로(`../packages/.../src/index.ts`)로 직접 import해 계산한다(Node 24 타입 스트리핑).
- lazy 봇은 아무것도 보내지 않는다. `--auto-next`가 없으면 교사 역할은 사람이 통제 페이지에서 한다.
- 행동 간 250ms 간격을 두고 `too-fast`(소켓당 초당 4회, §5.4)는 잠시 뒤 재시도한다. `--auto-next`는 work 비트에서 비lazy 봇이 할 일을 마칠 때까지(최대 6s) 기다렸다가 `next { force: true }`를 보낸다.
- 서버 재시작 등으로 연결이 끊기면 발급받은 토큰으로 재접속 hello를 보내 기존 학생으로 이어서 행동한다(§8.3). 끊기는 순간 소켓.io 버퍼에 쌓인 행동은 버린다(재접속 hello보다 먼저 나가 `not-allowed`로 죽는 것을 막는다).
- 매 비트마다 한 줄 진행 로그, 마지막에 요약(완주/자동 처리/실패 인원). 모든 비lazy 봇이 `present` 비트에 도달하면 종료 코드 0.

### 11.2 `scripts/shots.mjs` 변경

> **결정(구현 편차, §14 #79)**: 임시 게임 서버를 띄우지 않는다. 대신 Playwright이 `GET /api/me`를 가로채
> (`page.route`) `{ role: 'control' }`로 응답하게 해 `/dev` 게이트를 통과시키고, 스크린숏은 Vite 개발 서버에서
> `/dev#/<fixture>?shot`으로 찍는다(기존과 같은 방식). 서버 소스(`server/**`, S2 소유)에 의존하지 않아
> 클라이언트 변경 검증이 서버 구현 진도에 막히지 않는다. `--only`, `--viewports`(laptop·tablet·tabletPortrait·phone),
> 페이지 오류 종료 코드 2 규칙은 그대로다.

### 11.3 루트 `package.json` 스크립트

| 명령 | 내용 |
| --- | --- |
| `pnpm server` | `node --env-file=.env server/src/main.ts` |
| `pnpm test` | `pnpm -r test` (vitest: core, live, activity-gagyebu, server) |
| `pnpm bots` | `node scripts/bots.mjs --url http://localhost:8091` (코드는 필수 인자로 전달) |

---

## 12. 마일스톤별 완료 기준 (M0~M8)

### 12.1 M0 사전 확인·배포 사실 (구현 전에 알아야 하는 것)

**배포 환경 (확인된 사실)**:

- 리버스 프록시는 **Nginx Proxy Guard**, `10.10.2.21` → 게임 서버 `10.10.2.23:8091`. 호스트 `gagyebu.taesoo.uk`.
- 프록시 설정: **WebSocket on**, 타임아웃 24시간(장시간 수업·재접속 대기), **버퍼링 off**(실시간 방송 지연 방지), **WAF off**(Socket.IO 페이로드 오탐 방지).
- 그래서 `.env.example`의 기본값이 `PORT=8091`, `TRUSTED_PROXY=10.10.2.21`(§7).
- 실행: `tmux new-session -d -s gagyebu-live -c <repo> 'node --env-file=.env server/src/main.ts'`.
- **주의**: 지금 개발 서버 tmux 세션 `gagyebu-dev`가 8091을 차지하고 있다(`scripts/dev-public.config.ts`의 Vite). 게임 서버로 넘기기 전에 **사용자가 직접** `tmux kill-session -t gagyebu-dev`로 끄고 새 세션을 띄워야 한다(에이전트가 임의로 끄지 않는다).
- M0 완료 기준: 프록시를 거친 Socket.IO 연결 확인(노트북, 휴대폰 LTE, 가능하면 학교 와이파이). 노트북 덮개 닫았다 열기·휴대폰 30초 잠금 뒤 자동 재접속.
- **M9(리허설·운영 체크리스트·CSV 실사용)는 이번 문서 범위 밖**이다. 이 문서는 M1~M8의 구현 계약까지만 정한다.

### 12.2 M1~M8

| 단계 | 완료 기준(명령·검증) |
| --- | --- |
| M1 엔진 | `pnpm --filter @gagyebu/core test` — 하늘·바다 골든 경로 12개월 재생이 결정적이고 결과가 목업(`FIXTURES`)과 근사. `canStep`/`StepError` 일치 테스트 통과 |
| M1' 기본값 | 같은 테스트 실행 — "아무것도 안 하는 학생이 1년을 완주"(기본값만으로), "모든 장면에 `fallback` 정확히 하나, `requires` 없음", `balanceBudget`·`autoPaymentPlan`·`defaultAnswers` 단위 테스트 통과 |
| M2 플랫폼 골격 | `pnpm server` 띄운 뒤 통제 페이지에서 `openClass` → `node scripts/bots.mjs --code <발급 코드> --n 60`으로 슬라이드·비트 넘기기. 서버 종료 후 재시작 → 커서·학생 상태 복원(로그 재생). `curl -I localhost:8091/assets/<해시 파일>`이 `immutable`, 모르는 경로 `curl -I localhost:8091/contorl`이 404 |
| M3 클라이언트 셸 | `pnpm shots`가 `/dev`에서 27개 스냅숏 전 크기 통과(로그인 쿠키 자동 처리). `pnpm --filter @gagyebu/app typecheck`. 재접속 띠·Wake Lock·대기 화면 수동 확인 |
| M4 가계부 활동 ① | 봇 60(lazy 10%)으로 입장·월급·설문·안내·가계부까지 진행. 미완료 학생이 있을 때 `next` → 확인 대화상자 → 강제 진행 → "자동 선택됨" 안내 확인 |
| M5 가계부 활동 ② | 봇 60(일부 미완료)이 1년 완주. 전이(`endMonth`) 자동 실행, 장면 중간 강제 진행, 결산, 공개 집계(선택 분포·엔딩 분포·autoCount) 확인 |
| M6 통제 페이지 | 키보드만으로 전체 수업 진행(→/Space/PageDown, ←/PageUp). 완료 인원·미완료 명단·기본값 미리보기·학생 관리·CSV 내보내기 확인 |
| M7 기기 대응 | `pnpm shots --viewports=laptop,tablet,tabletPortrait,phone` 통과 + 라이브 화면 4크기에서 모든 단계(지불 패널 2단계 포함) 조작 수동 확인 |
| M8 슬라이드 | 시험용 덱 1개로 표시기(1920×1080 스케일), `steps`, 통제 미리보기·노트 확인. 실제 덱은 `lesson/lesson.ts`에 넣기만 하면 됨 |

---

## 13. 병렬 작업 스트림과 파일 소유권

여러 에이전트가 parallel worktree에서 나란히 작업한다. **S0이 먼저** 계약 파일을 만들고 merge한 뒤 나머지가 시작한다. 각 스트림은 아래 파일만 고친다(그 외 충돌은 스트림 책임자가 조정).

| 스트림 | 소유 폴더·파일 | 마일스톤 |
| --- | --- | --- |
| **S0 scaffold** (한 명, 먼저) | `packages/live/**`, `packages/activity-gagyebu/**` 뼈대(시그니처만), `lesson/**`, `server/package.json` + 뼈대, `pnpm-workspace.yaml`, **모든 `package.json`(§1.4 의존성을 전부 여기서 설치)**, **`pnpm-lock.yaml`**, **`.gitignore`(`.env`, `data/` 추가)**, **모든 `tsconfig*`**(`tsconfig.base.json`에 `erasableSyntaxOnly` 추가 포함), `.env.example`(§7 기본값), 루트 `package.json` 스크립트, 이 문서가 정한 모든 타입 파일. **S0 이후 어떤 스트림도 `package.json`·lockfile·tsconfig를 고치지 않는다.** | — |
| S1 core 엔진 | `packages/core/**` — 단 `package.json`은 제외(S0 소유). engine, types, data/events, selectors + 테스트 | M1, M1' |
| S2 live+서버 | `server/**`, `scripts/bots.mjs`, `packages/live/src/slides.ts` 구현 | M2 |
| S3 클라이언트 셸+슬라이드 | `src/src/live/**`, `src/src/routes.tsx`, `src/src/activities/slides/**`, `src/vite.config.ts`, `packages/draft-kit/**`, `src/src/dev/**`, `scripts/shots.mjs` | M3, M8 |
| S4 활동 로직 | `packages/activity-gagyebu/src/**` | M4·M5의 로직 |
| S5 활동 화면 | `src/src/activities/gagyebu/**`, `src/src/screens/**`, `src/src/solo/**` | M4·M5의 화면 |
| S6 통제·전면 | `src/src/control/**`, `src/src/stage/**` | M6 |
| S7 기기 대응 | `src/src/components/sim/PayPanel.tsx`, `AccountsPanel.tsx` 및 반응형 스타일 파일 | M7 |

- S5와 S7이 `src/src/components/**`를 공유할 수 있다. S7은 S5 merge 뒤에 시작하거나, S5가 먼저 dispatch 연결을 끝낸 컴포넌트만 만진다.
- **계약 파일**(S0이 만들고 다른 스트림이 import만 한다): `packages/live/src/types.ts`, `protocol.ts`, `activity.ts`, `slides.ts`(시그니처), `packages/activity-gagyebu/src/index.ts`(타입·비트 목록), `lesson/lesson.ts`, `src/src/activities/registry.ts`(인터페이스), `docs/live-api.md`(이 문서), `docs/core-api.md`.
- 스트림 사이의 모든 상호작용은 이 문서의 타입·이벤트 이름으로만 일어난다. 이름을 바꿔야 하면 문서를 먼저 고친다.

---

## 14. 결정 사항 (문서에서 정함)

계획(`docs/live-classroom-plan.md`)이 침묵하거나 모호했거나 코드와 어긋나서 이 문서에서 정한 것 전부. 구현 중 되돌아오면 이 목록을 먼저 고친다.

### 진행 모델

1. **비트 주소는 `{ segment, beat }` 인덱스** (계획 §5.4 그대로). 전역 인덱스는 서버 내부 계산값일 뿐 프로토콜에 안 나온다. `Beat.id`는 표시용, 세그먼트 안에서만 유일.
2. **슬라이드 `steps`는 별도 비트로 매핑**한다: `steps: n`인 슬라이드 = 비트 n개(비트 k는 항목 0..k 공개), `steps` 없는 슬라이드 = 비트 1개. 비트 id는 `${slideId}--${k}` / `${slideId}`. "next 한 번 = 진행 한 단계" 규칙을 전 레슨에서 균일하게 유지하기 위함.
3. **공개(reveal) 후에도 학생 행동을 허용**한다(비트 마감 전까지). 낡은 분포가 잠깐 보일 수 있지만, 느린 학생이 답을 잃는 것보다 낫다. 마감은 오직 `next`.
4. **`prev`는 "가장 가까운 이전 show 비트"**, `goto`는 "현재보다 앞선 show 비트만"(`highMark` 이내). 앞으로 건너뛰기 금지 — 작업 비트를 건너뛴 학생 상태가 생기지 않게. `highMark`를 `ClassState`에 추가했다.
5. **마지막 비트에서 `next`**는 `invalid-target` 거부(결과 화면 이후 없음).

### ActivityLogic

6. **기본값 루프 최대 50회**, 초과 시 학생을 `stalled`로 표시하고 수업은 계속. `fallback`은 한 번에 상태를 반드시 진전시켜야 한다(같은 행동 반복 금지)를 계약에 넣었다.
7. **`fallback`은 `FallbackResult { action, notice }`**를 반환한다. 안내 문구를 활동이 만들고 서버는 전달만 한다. 전이(`transition`) 행동에는 통지가 없다.
8. **draft는 로그에 남기지 않는다.** 메모리에만 있고 `next` 마감의 `fallback(draft)`에만 쓴다. 서버가 비트 도중 재시작하면 초안을 잃고 기본값은 "초안 없음" 경로로 간다. 전체 재현성은 `auto` 줄의 행동이 책임진다.
9. **init의 난수는 월급뿐**이고, 결과가 `start { salary }` 행동에 박혀 로그로 재현된다. `fallback`·`transition`·`stats`는 완전 결정적.
10. **`ActivityViews` 인터페이스는 클라이언트(`src/src/activities/registry.ts`)에 둔다.** React 타입을 쓰므로 React가 없는 `packages/live`에는 들어갈 수 없다. 서버 레지스트리는 `ActivityLogic`만 담는다.
11. **입장·닉네임은 플랫폼 소유**(§9.6). 활동은 `init`으로 닉네임을 받기만 한다.

### 프로토콜·서버

12. **`stats` 페이로드에 `progress`와 `fallbackPreview`를 항상** 실어 보낸다. Stage는 `showProgressOnStage`일 때만 progress를 그린다(계획 §12 남은 항목 b의 기본값: 통제에만 표시).
13. **집계 스로틀은 250ms(초당 4회)**, 최신값만 전송.
14. **속도 제한**: act 4/s + 동시 1개(ack 전 다음 행동 금지, 위반 `'too-fast'`), draft는 클라이언트 2초 묶음 + 제출 직전 flush·서버 1.5초 1회, join·hello 5초 1회(초과분 무시), 통제 10/s(초과 `'rate-limited'`).
15. **여러 수업 동시 허용**(리허설용). 전면·통제는 `classes` 목록에서 `select`로 고르고, 하나만 열려 있으면 자동 선택.
16. **끝난 수업 코드 48시간 재사용 금지**, 목록은 `DATA_DIR/ended.json`.
17. **토큰은 128비트**(base64url), `localStorage['gg_token_<code>']`에 코드별 저장.
18. **같은 닉네임 재입장 = `nickname-taken` + roster `pendingMerge` 항목**. 통제의 `merge` 승인으로 기록을 이어받고 새 토큰을 발급한다. 거부는 `kick`.
19. **`act`의 `beat` 불일치는 `'stale-beat'`** ("이미 다음 단계로 넘어갔어요"). 리뷰 중(cursor < highMark)의 모든 행동도 `'stale-beat'`다. 클라이언트는 이때 `snapshot` 없이 최신 `class`로 동기화한다.
20. **CSV 내보내기는 HTTP `GET /api/export/<code>.csv`** (통제 쿠키). 소켓 이벤트가 아니라 링크로 내려받는다.

### HTTP·보안

21. **`/<4자리>`는 코드의 실제 상태와 무관하게 앱을 서빙**한다. 열림/끝남/없음 구분은 `hello` ack가 담당하고, 클라이언트가 맞는 화면(진행·끝난·없는 수업)을 보여 준다.
22. **쿠키 값에 비밀번호 버전 포함**(`pwVer` = sha256 앞 8자리). 비밀번호 변경 + 재시작 = 전원 로그아웃. 서명은 HMAC-SHA256, 만료 12시간.
23. **무차별 대입**: IP당 실패 5회/분 → 60초 `429`. `X-Forwarded-For`는 `TRUSTED_PROXY`에서 온 요청만 신뢰(마지막 값).
24. **`/dev` 보호는 앱 수준**(통제 로그인 쿠키 확인)이다. JS 번들은 어차피 공개 정적 파일이므로 서버가 경로를 막는 것은 의미가 없고(계획 §7.1 "보호 범위"), 목적은 학생이 목업 화면에 들어가 헷갈리지 않게 하는 것. `shots.mjs`는 임시 서버 + 로그인으로 통과한다(§11.2).
25. **`/solo`는 서버가 `SOLO_ENABLED=true`일 때만 200**, 아니면 404. 앱 안 스위치가 아니라 서버 스위치.

### core (docs/core-api.md와 중복되는 요약)

26. **`answer`·`finishSurvey` 삭제, `submitSurvey` 추가.** `goto`는 유지(활동 전이 `guide-6 → budget`와 solo가 씀)하되 허용 범위를 `guide → budget`로 좁힌다. `reset` 유지(solo 전용).
27. **자동 처리 표시는 행동에 `auto?: true`**를 싣는 방식. 서버·활동만 설정하고 학생 행동에서는 서버가 뗀다. `step`이 `DecisionRecord.auto`로 복사한다.
28. **부록 A 선택지 8개를 데이터 대조해 확정**(core-api.md 부록 A 참조). 계획 문면의 장면 id는 `data/events.ts`와 전부 일치했고(교정 불필요), 선택지 id를 새로 지었다: `splurge`(laptop-spill start/scammed/again), `flip3`(sneaker-resell start), `luxury`(family-month gift), `ignore`(rent-hike notice), `hangUp`(rent-hike counter), `tipStock`(market-crash dropNoInvest).
29. **계획 부록 A와 데이터의 충돌 처리**: 데이터에 이미 있는 `new`(150만 원 무이자 할부), `flip2`(2켤레), `big`(30만 원) 그대로 두고, 계획이 정한 "더 나빠 보이는" 선택지를 **별도로 추가**해 `fallback: true`를 붙인다. 기존 선택지는 일반 선택지로 남는다.
30. **`showProgressOnStage`는 레슨 설정**(`Lesson.settings`)이고 기본 false. 활동 설정(`GagyebuConfig.confirmForce` 등)과 분리했다.

### 클라이언트

31. **`ScreenProps`의 `ui`는 dev 전용**이 되고 라이브 화면은 `beat.id` + `state`만으로 그린다. `submitted`·`mode`·`draft`가 새로 들어온다(§10.8).
32. **draft-kit 어댑터는 `route(fixtureId, action)` 함수**로 일반화한다. 스냅숏 id → 비트 매핑(`beatOf`)을 `src/src/dev/`에 둔다. 기존 이동표 `NEXT_FIXTURE`/`SCENE_FIXTURE`는 이 함수로 흡수.
33. **라우터 라이브러리를 추가하지 않는다.** `window.location.pathname` 6경로면 충분하고 번들이 커지지 않게 하기 위함.
34. **설문 한 화면(7문항)·안내 카드 비트당 1장**은 라이브 모드 표준. dev 스냅숏은 기존 1문항·카드 진행 힌트(`ui`)를 그대로 쓴다.

### 그 외

35. **`tsconfig.base.json`에 `erasableSyntaxOnly: true` 추가 권장.** 서버의 빌드 없는 실행 제약(§1.3)을 컴파일 타임에 강제한다.
36. **앱 `base: '/'`**로 바꾼다. 단일 HTML 빌드(`pnpm single`)는 기존 `base: './'` 설정을 유지한다.
37. **정적 서버 `scripts/serve.mjs`는 흡수**되지만 당장 삭제하지 않는다. 배포 전환 확인 뒤 제거한다(삭제도 이 문서의 범위 밖 구현 단계에서).

### 감사 반영 (2026-11-09 2차, 문서 개정으로 정한 것)

38. **live의 core 의존 제거 (R1).** 플랫폼은 게임 규칙을 모른다. 프로토콜 페이로드는 전부 `unknown` 기본 제네릭(`ActPayload<A>`·`ActAck<S>`·`SnapshotPayload<S>`·`StatePayload<S>`·`SpotlightStatePayload<S>`), 로그 행동은 `unknown`. 서버는 활동 레지스트리로만 활동 로직을 쓰고 core를 직접 import하지 않는다. 학생 상태는 세그먼트 id별(`StudentRecord.states`), `join` 때 모든 활동 세그먼트마다 `init`. `state` 메시지는 커서의 활동 세그먼트 상태(+세그먼트 인덱스), 슬라이드 세그먼트면 null.
39. **리뷰 모드 (R2).** live 비트 = `highMark`. 리뷰 중 `next`는 커서만 전진(show 비트 순서대로, 끝은 highMark 자신), 마감·확인·기본값·전이 재실행 없음(지나간 전이를 다시 돌리면 `goto budget`이 sim 학생에게 `StepError`). 학생 행동은 `'stale-beat'` 거부. `highMark` 복귀 시 `highRevealed`로 공개 상태 복원. 완료 인원은 항상 highMark 기준(집계의 커서 추종은 59번 참조). 표시형 비트 화면은 `beat.id`+상태만으로 렌더(학생 `phase`/`step` 아님).
40. **전이 행동 로그 (R3).** `transition` 줄을 추가하고 재생이 live와 같은 순서로 적용한다. 없으면 재생 결과가 실제와 달라진다.
41. **지각 채우기·stalled 재현 (R4).** 채우기는 활동 세그먼트 처음부터 순서대로 "work 비트마다 fallback 루프 → `transition(b, b+1)`"을 `next`와 똑같이 실행(로그: `auto { kind: 'backfill' }`·`transition`). 월 비트 fallback에 `month < N && step === 'report' → endMonth(반복)` 추가. 슬라이드 도중 입장은 지각 아님(init만), 입장 전 접속자는 모든 비트에서 닉네임 화면, 활동이 끝난 뒤 입장하면 활동 전체를 채움.
42. **fallback 선택 규칙은 `kind`가 아니라 `pay`/`deposit` 존재 기준 (R5).** `gamble`+`pay`(`tryTen`·`flip3`) 포함. `adjustable`이면 행동에 `amount: min`을 명시하고 그 금액 기준으로 지불 계획.
43. **`done` 신호 (R6).** `ActAck`·`StatePayload`·학생 `snapshot`에 `done: boolean`(live 비트 기준) — `submitted`의 근거.
44. **stats는 `:stage`·`:control`에만 (R7)** (§5.2와 §5.1의 모순 해소). 발표자 노트(`Beat.notes`·`SlideManifest.notes`)는 통제 전용 — 학생·전면 스냅숏에서 서버가 제거.
45. **merge 생명주기 (R8).** `JoinAck { reason: 'nickname-taken', pendingId }` → 대기 화면("승인 기다리는 중" + 다른 닉네임 재시도) → 승인 시 `joined { studentId, token, nickname }`, 거부·내보내기 시 `kicked { reason }`. 승인 시 `intoId`의 기존 소켓은 `kicked`로 끊고 기존 토큰 무효화. 재생: `admin merge`는 "intoId 기록이 새 토큰을 가짐", `admin kick`은 "기록이 거기서 끝남".
46. **`GagyebuStats` 판별자 `kind`로 교체 (R9)** (`m12`와 `` `m${number}` `` 충돌 해소), 표시형 비트는 `{ kind: 'none' }`, 예약 장면 버킷 `scheduled` 추가(4월 check4·6월 check6·10월 revolving), `fallbackPreview` = 첫 미완료 학생의 현재 장면 기본 선택지 라벨(없으면 null).
47. **`init`은 기저+행동 분리 (R10).** 기저는 결정적(난수 소비 금지), 모든 무작위값은 행동에 박힘. 재생 = 기저 + 로그의 `inits.actions`.
48. **`SlideManifest.label` 추가, 비트 id 예시 정정 (R11)** (`intro/why--1` → `why--1`, 세그먼트 안 유일).
49. **S0 소유권 확대 (R12).** 모든 `package.json`·`pnpm-lock.yaml`·`.gitignore`(`.env`, `data/`)·`tsconfig*`·`.env.example`과 외부 의존성 설치 전부. vitest는 "설치된 vite의 peer 범위에 맞는 메이저"(버전 문서 고정 안 함). 패키지별 의존성 완전 목록은 §1.4.
50. **설문 초안 없음 (minor).** 제출 전 답은 서버에 오지 않는다. 설문 기본값 = `submitSurvey { answers: defaultAnswers({}) }`.
51. **draft 스로틀 정렬 (minor).** 클라이언트 2초 묶음 + 제출 직전 flush, 서버 1.5초 1회.
52. **hello·join 속도 초과는 조용히 무시 (minor).** `HelloAck`·`JoinAck`에서 `rate-limited` 제거(재접속 백오프는 Socket.IO 내장). 통제 명령 초과는 전용 이유 `'rate-limited'`.
53. **`OpenClassPayload.lessonId` 선택적 (minor).** 생략 시 `LESSON_ID`.
54. **`bots.mjs --auto-next` 통제 인증 (minor).** `--control-password`로 `POST /api/login` 후 쿠키를 통제 소켓에.
55. **M0 배포 사실 (minor).** 프록시 Nginx Proxy Guard `10.10.2.21` → `10.10.2.23:8091`(WebSocket on, 24h 타임아웃, 버퍼링 off, WAF off), `.env.example` 기본값 `TRUSTED_PROXY=10.10.2.21`·`PORT=8091`, tmux `gagyebu-live` 실행 명령, 기존 `gagyebu-dev`(8091 점유)는 사용자가 직접 종료. M9(리허설·운영)는 이번 범위 밖.
56. **전체 상태 전송의 근거 (minor).** 12개월 GameState ≈ 15~25KB JSON, 60명 ≈ 1.5MB 메모리, `state` 메시지 1건 ≈ 25KB — partial patch 없이 전체 전송(§5.3).
57. **덱 매니페스트/렌더 레지스트리 분리는 계획 §9와의 차이 (minor).** 계획은 `lesson/slides/<덱>/index.ts`가 렌더 컴포넌트까지 내보내게 했지만, 그러면 서버가 React를 import해야 한다. §2.2의 분리(매니페스트는 서버 안전 데이터, 렌더는 `src/src/activities/slides/registry.tsx`)로 바꿨다.

### 재감사 반영 (2026-11-09 3차)

58. **CSV 내보내기는 활동 계약으로 일반화.** `ActivityLogic`에 `exportColumns?`·`exportRows?` 추가. 서버(§8.5)는 레지스트리에서 열·행을 받아 BOM·이스케이프만 담당하고, 열 정의와 `PaymentPlan`→문자열 변환은 activity-gagyebu가 소유(§9.7). 서버가 core를 모르므로(R1) 이 경로여야 한다.
59. **리뷰 중 TV는 커서를 따라간다.** 리뷰 이동(prev·goto·리뷰 중 next)마다 서버는 **커서 비트 기준** stats를 다시 계산해 보내고 `StatsPayload.beat`로 소속 비트를 알린다. `progress`·`fallbackPreview`는 항상 highMark 기준. Stage·통제는 `stats.beat`가 그리는 비트와 같을 때만 활동 통계를 그린다(다르면 null). 통제 완료 현황은 항상 highMark.
60. **지각 채우기는 live 비트 "바로 앞"까지.** live 비트로 들어가는 전이는 포함하고 live 비트 자체는 채우지 않는다 — work 비트면 정상 참여(§8.3).
61. **소켓 이벤트 맵도 제네릭.** `ClientToServerEvents<A, D>`·`ServerToClientEvents<S, St>`. 앱은 `src/src/activities/gagyebu/liveTypes.ts`에서 `ClientToServerEvents<Action, GagyebuDraft>`·`ServerToClientEvents<GameState, GagyebuStats>`로 좁히고 `useLive<S, A, D>`가 받는다.
62. **`DecisionRecord.eventId`는 `EventId | ''`** (core-api.md §4.2). 현재 장면이 없는 statusAction 기록을 위한 빈 문자열 sentinel.
63. **`admin merge` 로그 줄에 새 토큰 포함**(join 줄과 같은 방식) — 재생이 merge 뒤 유효한 토큰을 복원한다(§8.2·§5.8).

### S0 구현 중 확정 (2026-11-08)

64. **덱 비트 라벨의 " (k/n)"은 1부터.** §4.1의 라벨 접미사 k는 사람 표기 기준 1부터(예: " (1/3)", " (2/3)"). 비트 id의 `${slideId}--${k}`에 쓰는 k는 0부터(비트 k = 항목 0..k 공개) 그대로다. 통제 타임라인에 "(0/3)"이 보이는 것이 어색해 S0이 확정했다.
65. **core `fixtures.ts`의 `structuredClone`을 JSON 복제로 교체.** `packages/activity-gagyebu`의 tsconfig가 DOM·Node lib 없이(`lib: ["ES2022"]`) core를 함께 검사하므로(§1.2 금지 규칙의 정적 검증), DOM 전역인 `structuredClone`이 있는 `fixtures.ts`가 컴파일을 실패했다. 스냅숏 상태는 순수 JSON 값이라 `JSON.parse(JSON.stringify(x))` 복제로 바꿨다(동작 동일). draft-kit 어댑터(§10.9)의 `structuredClone(fixture.state)`은 클라이언트 전용이라 그대로다.

### S2(라이브 서버) 구현 중 확정 (2026-11-08, M2)

66. **역할 소켓은 연결 쿼리 `role=stage|control`로 시작한다.** 서버는 쿠키만으로 학생 소켓과 역할 소켓을 구별할 수 없다(학생은 쿠키가 없다). 전면·통제 클라이언트는 `io(url, { query: { role } })`로 연결하고, 서버가 `gg_stage`/`gg_control` 쿠키를 검증해 실패하면(없음·서명 불일치·만료·pwVer 불일치) 연결을 끊는다(§5.2). 성공하면 `hello` 없이 snapshot을 바로 보낸다. 쿼리가 없으면 학생 소켓이다. **S3·S6 클라이언트는 이 쿼리를 실어야 한다.**
67. **열린 수업이 없을 때 역할 소켓은 snapshot 대신 `classes` 이벤트만 받는다.** `SnapshotPayload.class`는 필수라 "빈 수업" snapshot을 만들 수 없다. 자동 선택 규칙: 연결 시점에 열린 수업이 있으면(여럿이면) 가장 최근에 연 수업을 자동 선택해 snapshot을 보내고, `openClass`를 호출한 통제 소켓은 새 수업을 자동 선택한다.
68. **활동 `init`이 예외를 던지면 학생은 degraded로 입장한다.** `JoinAck`에 server-error 이유가 없어 입장을 거부하는 대신, 그 활동 세그먼트 상태 없이 입장을 승인하고 오류는 서버 로그만 남긴다(§4.2 "활동 예외로 서버 생존"의 연장). 해당 세그먼트에서 그 학생의 `act`는 `'server-error'`, `done`은 false, fallback도 상태가 없어 건너뛴다(확인 → force → 진행). `stats`·CSV 내보내기에서는 상태 없는 학생을 제외한다. 슬라이드 구간은 정상 진행되므로 활동이 미구현(stub)이어도 수업 전체를 넘길 수 있다. 활동이 구현되면 이 경로는 발생하지 않는다.
69. **`auto` 로그 줄은 적용한 것이 있을 때만 남긴다.** 기본값 루프에서 행동·overflow가 모두 없으면(이미 done인 비트의 backfill 등) `auto` 줄을 쓰지 않는다. 재생 결과는 동일하다.
70. **`join` 로그 줄이 backfill(`auto`·`transition`) 줄보다 먼저다.** 지각 채우기의 줄은 학생 기록이 만들어진 뒤에 적용되어야 하므로, 서버는 `join` 줄을 먼저 기록하고 채우기를 실행한다(§8.2 재생 순서 보장).
71. **리뷰 중 `next`의 show 비트 탐색은 highMark 이내로 제한한다.** §5.5-0의 "앞의 show 비트들"은 커서와 highMark **사이의** show 비트를 뜻한다. 사이에 show 비트가 없으면 highMark 자신으로 간다(highMark가 work 비트여도 같다).
72. **학생 기기(`device`)는 로그에 남지 않아 재생 뒤 기본값 `'laptop'`으로 복원된다.** 재접속 `hello`에서 실제 기기로 갱신된다. RosterEntry 표시에만 영향이 있다.
73. **로그아웃은 브라우저의 쿠키 삭제일 뿐 서버 상태를 무효화하지 않는다.** 쿠키가 상태 없는 서명값(§6.3)이므로, 서버 재검증까지 무효화하는 방법은 비밀번호 변경(pwVer)뿐이다.
74. **CSV 내보내기의 오류 조건**: 통제 쿠키가 없으면 401, 수업 코드가 없거나 레슨에 `exportColumns`가 있는 활동이 없으면 404. 활동 세그먼트가 여러 개면 활동마다 머리글을 붙인 표를 빈 줄로 구분해 이어 붙인다.
75. **서버 시작 시 재생은 세션 디렉터리(`DATA_DIR/sessions/<code>`) 전부를 읽는다.** `end` 줄이 없으면 열린 채, 있으면 ended로 복원하고 그 코드는 발급 제외 집합(§8.4)에 포함된다. 레슨을 찾을 수 없는 세션은 경고를 남기고 건너뛴다.
76. **`/api/me`는 control 쿠키를 우선한다.** 두 역할 쿠키가 모두 유효한 브라우저에서 `{ role: 'control' }`을 돌려준다.
77. **잘못된 닉네임(빈 값·10자 초과)의 `join`은 `'join-locked'`로 거부한다.** `JoinAck`에 별도 이유가 없고 클라이언트가 1~10자를 이미 검증하므로 정상 흐름에서는 발생하지 않는다. **→ S8에서 해결(#130)**: `JoinAck`에 `'invalid-nickname'` 이유가 생겼고, 서버가 빈 값·공백만·trim 뒤 10자 초과를 이 이유로 거부한다. `'join-locked'`은 실제로 입장이 잠긴(또는 끝난) 수업에만 쓰인다.
78. **`bots.mjs --auto-next`는 `next { force: true }`를 보낸다.** 확인 대화상자(§5.5-2)를 스크립트가 사람 대신 넘기기 위함이다.

### S3(클라이언트 셸·슬라이드) 구현 중 확정 (2026-11-08, M3·M8)

> 번호 66~78은 S2(라이브 서버) worktree(`live/s2-server`)에서 이미 쓰고 있다. 이 목록은 79번부터 센다(merge 시 순서 유지).

79. **`shots.mjs`는 임시 게임 서버 대신 Playwright `/api/me` 가로채기(§11.2 편차).** `page.route('**/api/me')`가 `{ role: 'control' }`로 응답하게 해 `/dev` 게이트를 통과시키고, 스크린숏은 Vite 개발 서버의 `/dev#/<fixture>?shot`으로 찍는다(기존 방식). 서버 구현(`server/**`, S2 소유)에 의존하지 않아 클라이언트 검증이 서버 진도에 막히지 않는다. `--only`·`--viewports`·페이지 오류 종료 코드 2 규칙은 그대로.
80. **dev 목업의 "이전" 버튼은 표시행동 `choose { choiceId: 'dev-prev' }`(`DEV_PREV`).** 라이브에는 학생 뒤로 가기가 없어(교사만 prev/goto 리뷰) 대응하는 진짜 Action이 없다. `src/src/dev/route.ts`의 예약 choiceId로 dev 이동임을 표시한다. S5가 라이브 화면(한 화면 설문·비트당 안내 1장)을 정리하며 이 버튼들이 사라지면 함께 없앤다. 그 외 화면 이동은 라이브에서 실제로 나가는 행동(`start`·`submitSurvey`·`goto`·`setBudget`·`confirmBudget`·`beginMonth`·`choose`·`continue`·`endMonth`·`reset`)을 그대로 dispatch하고 `route()`가 같은 스냅숏 그래프로 바꿔 치운다.
81. **`UseLiveResult`에 `kicked: 'kicked' | 'merge-rejected' | null` 필드를 추가.** §10.2 계약에 없는 덧붙임이다. `kicked` 이벤트(§5.8)로 "승인되지 않았습니다" 화면을 그리려면 학생 페이지가 이유를 알아야 한다. 나머지 필드·시그니처는 계약 그대로. `autoApplied`는 커서 비트가 바뀌면 비운다(통지는 비트마다 의미가 있으므로).
82. **클라이언트의 `beatsOf`는 `@gagyebu/activity-gagyebu`의 `beats`를 직접 import해 쓴다.** `lessonBeats(lesson, beatsOf)`로 커서 비트를 해석하려면(§10.2 `beat`) 활동의 비트 목록이 클라이언트에도 필요한데, `beats`는 순수 함수(§4.2)라 클라이언트 import가 안전하다. 모르는 활동은 빈 목록(로그로 드러난다). `src/src/activities/beatsOf.ts`.
83. **단일 HTML 빌드(`pnpm single`)는 `file:` 프로토콜·`*.html` 경로에서 게이트 없이 목업 셸로 돌아간다.** 라우터는 모르는 http 경로를 "없는 수업" 화면(§6.6)으로 보내지만, 단일 HTML 산출물을 브라우저로 바로 열면 스냅숏 목업(`#/<fixture>`)이 통제 로그인 없이 그대로 돌아가야 한다. `mockup` 라우트로 구분한다(`App`→`DevPage mockup`).
84. **슬라이드 표시기 스모크는 dev 전용 화면 `/dev#/slides`.** M8 검증용. 시험용 덱(sample)을 `rehearsalLesson`의 첫 세그먼트에서 가져와 SlideCanvas로 그리고(단계 공개 포함), 통제 미리보기(SlidePreview)도 함께 둔다. `scripts/smoke-slides.mjs`가 laptop·tablet·tabletPortrait·phone 4크기로 찍는다(오류 있으면 종료 코드 2).
85. **draft-kit의 `Beat`는 로컬 구조 타입.** draft-kit의 `package.json`(§1.4 의존 목록)에 `@gagyebu/live`가 없는데 패키지.json은 S0 소유라 여기서 더할 수 없다. §4.1 `Beat`와 같은 모양의 로컬 인터페이스를 쓰면 구조 타이핑으로 상호 할당 가능해 계약 모양은 그대로다. **→ S8에서 해결(#133)**: draft-kit `package.json`에 `@gagyebu/live`(`workspace:*`)를 추가하고 로컬 타입을 `import type { Beat } from '@gagyebu/live'` re-export로 바꿨다.
86. **`join-locked` 거부는 닉네임 양식 안에 일반 안내문으로 보여 준다.** 입장 마감과 잘못된 닉네임(§14 S2-#77)이 같은 이유로 돌아와 구분할 수 없으므로, `useLive`가 status를 `'join-locked'`로 바꾸면 학생 페이지는 죽은 화면 대신 "지금은 입장할 수 없어요 … 닉네임(1~10자)을 확인하고 다시 시도해 주세요" 안내문을 닉네임 양식과 함께 보여 준다(다시 시도 가능). **→ S8에서 해결(#130)**: 잘못된 닉네임은 전용 이유 `'invalid-nickname'`로 구분된다. `join-locked` 안내문은 입장 마감만 다루고, 잘못된 닉네임은 "닉네임은 1~10자로 입력해 주세요"로 보여 준다.

### S3 라이브 스모크 중 확정 (2026-11-08, feat/live-classroom 병합 검증)

87. **입장하지 않은 학생은 `hello` ack ok만으로 `useLive` status가 `'open'`이 된다.** 서버는 join 승인 전까지 그 학생에게 snapshot을 보내지 않으므로(§8.3), snapshot 수신만으로 status를 바꾸면 닉네임 입력 화면(§10.4)이 영영 뜨지 않는다. hello ok = "수업이 열려 있음"이고, 페이지는 status open + 입장 전 조합으로 닉네입 입력 화면을 그린다. 재접속(resumed)이면 이어서 오는 snapshot이 기준을 다시 맞춘다.
88. **역할 소켓(useRoleLive)은 로그인 게이트를 통과한 뒤에 마운트한다.** 쿠키 없이 연결하면 서버가 즉시 끊고(§14 #66), socket.io는 **서버가 끊은** 연결을 자동 재접속하지 않아 로그인 뒤에도 소켓이 죽어 있다. 그래서 /stage·/control 페이지는 게이트 컴포넌트와 본판 컴포넌트를 나누고, 본판 안에서만 useRoleLive를 쓴다(S6이 페이지를 짤 때도 이 구조를 유지해야 한다).

> 번호 66~88은 S2(라이브 서버)·S3(클라이언트 셸)에서 이미 쓰고 있다. 이 목록은 89번부터 센다(merge 시 순서 유지).

### S4 활동 로직 구현 중 확정 (2026-11-08)

89. **가계부 비트 fallback의 진전 보장.** 합계가 이미 맞는 학생(편집을 한 번도 안 한 추천 가계부 등)은 `setBudget`(무변화 걸음)을 건너뛰고 `confirmBudget` 한 걸음으로 끝낸다. 합계가 안 맞는 편집 중 학생만 `setBudget(balanceBudget(초안 ?? state.budget))` → `confirmBudget` 두 걸음. §9.3의 "두 걸음"은 이 일반적인 경우를 가리킨다.
90. **`stats` join kind의 `connected`는 활동이 알 수 없다.** `ActivityLogic.stats`는 states 배열만 받으므로(§4.2) 접속 여부를 상태에서 알 수 없다. `connected = states.length`(= joined)로 채우고, **실제 접속 인원은 `StatsPayload.progress.connected`가 담당한다**(항상 실린다, §5.1). 스테이지의 입장 비트 화면은 joined·닉네임 벽만 쓰면 된다. (S2·S5 참고)
91. **`stats` budget kind: 분포는 확정한 학생만.** `savingsRates`·`shares`는 `initialBudget !== null`(확정) 학생의 `initialBudget` 기준. 아직 제출하지 않은 학생은 분포에서 빼고 `autoCount`로 센다 — 라이브 비트 동안 `autoCount` = "지금 넘기면 자동 처리될 인원"(= 미제출 인원, progress의 pending과 같은 값). 리뷰에서는 전원이 확정했으므로 `autoCount` 0.
92. **`stats` month kind `autoCount` = 그 달의 자동 처리된 선택 기록 수.** `DecisionRecord.auto === true`인 장면 선택만 센다(statusAction 기록은 선택지가 아니고, 가계부 조정 `setBudget`은 기록 자체가 없으므로 제외). `SceneTally.reached`는 자동 학생 포함 "도달한 학생 수", 막대 `count`는 수동 응답만(§9.4 "분포에서 빼고 autoCount로"). 라이브 비트 동안에는 아직 자동 처리가 돌지 않았으므로 0이고, 리뷰로 돌아볼 때 실제 값이 보인다.
93. **`stats` month kind `entry`: 시작 장면이 여럿이면 한 덩어리.** 배치 이벤트의 시작 장면이 `entryVariants`로 갈릴 때(8월 `drop`/`dropNoInvest`) 선택지 목록을 데이터 순서로 이어 붙여 하나의 `MonthEntryTally`로 합친다. `sceneId`·`title`·`channel`은 기본 시작 장면(`event.entry`) 기준. 선택지 id는 겹치지 않아 라벨로 구분된다.
94. **`stats` month kind `chained`/`scheduled` 구분은 장면 단위 정적 분류.** 어떤 선택지의 `next`가 `delayMonths`로 그 장면을 가리키면 '예약'(`scheduled`), `delayMonths` 없이 가리키면 '연쇄'(`chained`), 들어오는 간선이 없으면 시작 장면(entry). 4월 `again`·`check4`, 6월 `check6`, 10월 `revolving`이 scheduled 버킷에 들어간다(§9.4 감사 M2). 장면 배열 순서는 이벤트·장면 데이터 순서(결정적).
95. **`stats` settlement kind `autoCount` = 자동 처리 기록이 하나라도 있는 학생 수.** 12월에는 선택 장면이 없어 "그 달의 자동 응답 수"가 항상 0이므로, 교사에게 유용한 "1년 동안 자동 처리를 거친 학생 수"로 정의했다. 도전과제 `rate`의 분모는 전체 학생 수.
96. **`previewFallback`은 §9.4 정의 그대로.** 장면 단계에서만 기본 선택지 라벨을 돌려주고, 그 외 단계(월급날·결과·조정·리포트·설문·가계부)는 `null`. 통제의 기본값 미리보기가 장면 밖 단계에서 비어 보이는 것은 의도된 동작이다(미완료 인원은 progress·fallbackPreview 옆의 pending 수로 보여 준다).
97. **`allowed` 세부 규칙.** 월 비트 `m1`..`m11`은 `state.month === N`일 때만 `beginMonth`·`choose`·`continue`·`statusAction`(그리고 `step === 'adjust'`일 때만 `setBudget`)를 받는다. `m12` 비트는 `beginMonth`만 받는다(운동화 판매 등 statusAction도 11월 비트에서 하게 한다). `reset`·`goto`·`endMonth`는 모든 비트에서 학생이 보낼 수 없고, `auto` 표시가 붙은 학생 행동은 무조건 거부한다.
98. **`cfg.guide=false`일 때 가계부로 들어가는 전이.** §9.3의 `guide-6 → budget`와 같은 규칙이 `survey-result → budget`에도 적용된다(`phase === 'guide'`인 학생에게 `goto`). 전이는 항상 "가계부 비트로 들어가는 한 걸음"에 붙는다.
99. **`init` 기저 상태.** `createInitialState(nickname, 0)` — 월급 0인 결정적 기저에 `start { nickname, salary: rollSalary(ctx.random) }` 행동을 얹는다(§4.2 "기저 + 로그의 actions" 재생 규칙). 난수 소비는 `rollSalary` 호출 한 번뿐이다.
100. **`locate` 문구.** 시뮬레이션 중 `"N월 · 장면이름"`(장면 title ?? speaker ?? 이벤트 제목), 단계별로 `"N월 · 월급날"`/`"N월 · 결과 확인"`/`"N월 · 가계부 조정"`/`"N월 · 월말 리포트"`. 밖은 `"소비습관 설문"`/`"안내 카드"`/`"가계부 작성"`/`"1년 결산 완료"`. (S5·S6의 미완료 명단 표시 그대로 쓴다.)

### S6(통제·전면) 구현 중 확정 (2026-11-08, M6)

> 번호 79~100은 S2·S3·S4(worktree별)에서 이미 쓰고 있다. 이 목록은 101번부터 센다(merge 시 순서 유지).

101. **통제의 레슨 선택자는 클라이언트가 `@gagyebu/lesson`에서 만든다.** 서버에 레슨 목록 HTTP 엔드포인트(`/api/lessons`)가 없어(§6.1 라우트 표), 통제 페이지의 "수업 열기" 선택자는 앱 의존성에 이미 있는 `@gagyebu/lesson`의 `lesson`·`rehearsalLesson`에서 만든다. `openClass(lessonId)`의 서버 쪽 유효성 검사와 같은 id 집합이라 어긋나지 않는다. 나중에 레슨이 서버 전용으로 늘어나면 엔드포인트를 추가하고 이 선택자를 갈아끼운다.
102. **전면의 "여러 수업 고르기"는 클라이언트가 띄운다.** 서버는 역할 소켓 연결 때 열린 수업이 있으면(여럿이어도) 가장 최근 수업을 자동 선택해 snapshot을 보낸다(§14 S2-#67). 그래서 /stage는 첫 snapshot에서 `classes.length > 1`이면 자동 선택과 무관하게 고르기 화면을 먼저 보여 주고(자동 선택된 코드를 강조), 한 번 고르면 이후 `classes` 갱신(다른 곳에서 수업 열기)으로 다시 뜨지 않는다. 보고 있던 수업이 끝나고 다른 열린 수업이 있으면 다시 고르기, 없으면 "수업이 끝났어요"를 보여 준다.
103. **통제의 TV 미리보기에서 발표자 상태는 항상 null이다.** `spotlightState`는 `:stage` 룸에만 방송되므로(§5.2) 통제 소켓은 받지 못한다. 미리보기는 같은 `StageContent` 컴포넌트로 그리지만 발표자 화면의 최종 확인은 실제 `/stage` 탭에서 해야 한다. **→ S8 부분 해결(#132)**: 발표자 **상태**는 여전히 null이지만 **닉네임**은 roster + `classState.spotlight`에서 클라이언트가 만들어 미리보기에 넘긴다.
104. **`RosterEntry`에 `stalled` 필드가 없어 통제 명단에 stalled 표시를 둘 수 없다.** §4.2는 "roster에 표시"라 하지만 §4.1 타입에는 필드가 없다. 서버(S2 소유)가 `RosterEntry.stalled?: boolean`을 추가하면 통제의 미완료 명단·학생 관리가 바로 표시한다. 지금은 미완료로만 보인다. **→ S8에서 해결(#131)**: `RosterEntry.stalled: boolean`이 추가됐다. 서버가 학생 기록의 stalled 플래그(기본값 루프 50회 초과)를 그대로 실고, 통제의 미완료 명단·학생 관리에 중립 "멈춤" 표시가 붙는다.
105. **통제에 "새 수업" 버튼을 둔다.** 수업이 열려 있는 동안에는 "수업 열기" 양식이 사라지는데, 리허설로 수업을 하나 더 열어야 할 때가 있다(여러 수업 동시 허용, §5.8). 수업 코드 옆의 "＋ 새 수업"은 기본 레슨(`LESSON_ID`)으로 수업을 하나 더 열고, 서버가 openClass를 호출한 소켓에 새 수업을 자동 선택한다(§14 S2-#67). 열린 수업은 머리글 오른쪽 칩으로 고른다.
106. **TV 재사용 부품은 `src/src/stage/`에서 내보낸다.** `StageFrame`(레터박스 전체 표시기), `StageThumb`·`AutoStageThumb`(고정·자동 폭 축소 모형), `StageContent`(지금 TV 화면 본체 — 통제 미리보기가 같은 것을 축소해 쓴다), `JoinWall`(QR + 큰 주소 + 입장/접속 인원 + 닉네임 벽, 60명까지), `DistributionBars`(같은 색·데이터 순서·"자동 처리 N명" 별도 줄), `StatTile`(큰 숫자 타일). 전부 1920×1080 논리 px 기준이라 `StageContent` 안(또는 같은 논리 캔버스)에서 쓴다. S5는 활동 Stage 화면에서 이 부품들을 import해 조립한다.
107. **발표 비트의 TV 화면에는 발표자 닉네임을 표시할 통로가 없다.** `StageProps`(§4.3)는 `spotlight: S | null`(상태)만 주고 닉네임을 주지 않으며, 전면 소켓은 roster를 받지 않는다(§5.2). 계획 §3은 발표 화면에 이름 표시를 전제로 하므로, S5가 발표 화면을 짤 때 닉네임이 필요하면 `spotlightState` 페이로드(또는 `StageProps`)에 닉네임을 실어야 한다 — 서버·문서(S2·S0 소유) 변경이 필요하다. 그 전까지는 닉네임 없이 그리거나 S5가 로컬 완화책을 제안한다. **→ S8에서 해결(#132)**: `SpotlightStatePayload`에 `nickname: string | null`이 추가됐고 전면 스냅숏의 `spotlightState`도 같은 모양(`{ state, nickname }`)으로 바뀌었다. `useRoleLive.spotlightName` → `StageProps.spotlightName`으로 전면 화면에 전달된다.
108. **확인 대화상자의 기본 선택지 문구는 `stats.fallbackPreview`가 있을 때만 나온다.** 활동이 `previewFallback`을 주지 않으면(초기 stub 시절의 gagyebu) 문구가 생략되고 "N명이 자동으로 처리됩니다" 안내만 보인다. 활동이 구현되면 같은 코드 경로로 문구가 채워진다 — 통제 화면 변경이 필요 없다.
> 번호 101~108은 S6(통제·전면) worktree가 사용 중이다(merge 시 순서 유지). S5는 109번부터 센다.

### S5 활동 화면 구현 중 확정 (2026-11-08, M4·M5 화면)

109. **Audience의 행동 큐(라이브).** `AudienceProps.dispatch`는 ack을 돌려주는 `useLive.dispatch`지만 계약 타입이 `void`라, Audience가 내부에서 `(a) => void | Promise<ActAck>`로 다시 넓혀 쓴다. 화면이 건넨 행동은 큐에 쌓고 한 개씩 ack을 기다려 보낸다(§5.4 "ack 전 1개" 규칙 위반 방지) — 가계부 확정의 `setBudget → confirmBudget` 연속 제출이 이 순서 보장으로 이뤄진다. 거부(stale-beat·too-fast·not-allowed 등)가 오면 남은 큐를 버리고 화면 아래에 5초짜리 짧은 안내(`src/src/lib/actNotice.ts` 문구)를 보여 준다. 화면 자체는 다음 `state`/`class`로 다시 동기화된다(§5.3).
110. **등록 타입 좁히기.** `ACTIVITY_VIEWS['gagyebu']`는 `ActivityViews<GameState | null, Action, GagyebuStats>`로 선언해 등록 계약(unknown 제네릭)으로 한 번만 구조 캐스팅한다. S를 `GameState | null`로 넓히는 이유는 `StudentPage`가 degraded 학생(§14 S2-#68)에게 `state: null`을 넘기기 때문 — Audience는 "선생님이 넘기면 다시 따라와요" 안내 화면(DegradedScreen)을 보여 준다.
111. **busy 컨텍스트.** `ScreenProps`(draft-kit 계약)는 못 바꾸므로 진행 중 표시를 `ActBusyContext`(`src/src/lib/actBusy.tsx`)로 전달한다. 라이브에서 행동 큐가 비어 있지 않으면 true이고, 설문 제출·가계부 확정·선택지·패널 확정·단계 진행 버튼이 `useActBusy()`로 disabled된다. dev·solo는 기본값 false라 기존 화면과 완전히 같다.
112. **라이브 대기 화면의 비트별 내용(§10.3).** 설문 → 내가 답한 내용 읽기 전용 요약(`SurveyAnswersSummary`), 가계부 → `BudgetTotals` 읽기 전용 + 가계부 AI 프롬프트 복사, m1~m11 → 읽기 전용 `ReportStage` + `AccountsPanel` + 그 달 이벤트의 AI 프롬프트 복사(`event.promptId`가 있을 때만). `join` 비트는 done이 항상 true라 submitted가 늘 true지만 대기 화면 대신 "입장 완료 — 곧 시작해요" 안내를 보여 준다. `m12`는 결과 화면 자체가 비트 내용이라 대기 화면을 쓰지 않는다.
113. **live·solo 렌더링은 beat.id 기준, dev는 ui 힌트 기준 그대로.** 각 화면 컴포넌트는 `mode === 'dev'` 분기를 먼저 두고 기존 스냅숏 동작(ui.startStage·ui.surveyIndex·ui.guideIndex·DEV_PREV "이전" 버튼)을 그대로 유지한다 — `pnpm shots` 27개 전부 bdaff71과 md5 동일. DEV_PREV는 라이브 정리 후에도 dev 전용으로 남는다(라이브 화면에는 처음부터 없음).
114. **가계부형(budget kind) 선택의 라이브 진행.** 라이브·solo에서는 `choose` 행동을 그대로 보내 엔진의 정상 흐름(결과 화면 → budgetReason → 조정 단계)을 따른다. dev 목업이 결과를 건너뛰고 조정 스냅숏으로 바로 가던 단축은 `mode === 'dev'`에만 남긴다.
115. **지불·입금 패널이 계획을 올린다.** `PayPanel`·`DepositPanel`의 `onConfirm`이 이제 `{ payment?, depositTo?, amount? }`(`ChoiceConfirm`)를 넘기고 SimScreen이 그대로 `choose` 행동에 실어 보낸다 — `validatePayment`와 같은 모양(계좌 parts + 카드 별도, adjustable 금액 명시). `AdjustStage`의 `onNext`는 편집한 가계부를 인자로 넘기고(`setBudget` 行動), `onDraft`로 편집 중인 안을 2초 묶음 초안에 실는다.
116. **상태 카드 행동(운동화 팔기).** 라이브·solo에서 StatusPanel의 행동 버튼을 누르면 입금 계좌를 고르는 작은 패널이 열리고(`SellSneakerPanel`), 고르면 `statusAction { status: 'sneakers', action: 'sellSneakers', depositTo }`를 보낸다(§4.2 statusAction 규칙). dev는 기존대로 동작 없는 버튼(스냅숏 변화 없음).
117. **리포트 = 라이브 대기, 월급날 버튼 문구.** 라이브에서 `step === 'report'`가 되면 done → Audience가 대기 화면(112번)으로 바꾸므로 학생은 "다음 달로" 버튼을 보지 않는다(`endMonth`는 서버 전이 전용, `allowed`가 학생 행동을 거부). SimScreen의 리포트 방어 렌더도 라이브에서는 읽기 전용. solo는 "다음 달로"가 `endMonth` 行動 자체를 dispatch한다. 월급날 버튼 문구는 라이브·solo에서 "확인"(12월은 "결과 보기"), dev는 기존 문구("이번 달 시작하기"/"2월로 넘어가기") 그대로.
118. **autoApplied 안내 표시는 StudentPage 소유.** 자동 처리 안내는 `src/src/live/StudentPage.tsx`(S3 소유)가 상단 고정 `role="status"` 띠로 이미 보여 주며 커서 비트가 바뀌면 비워진다. "닫기" 버튼을 붙이려면 S5 소유 밖 파일을 고쳐야 하므로 그대로 두었다. S5의 Audience는 act 거부 안내(109번)만 별도의 하단 일시 표시로 추가했다. 자동 선택 구분은 결과 화면 선택 기록에 중립 태그("자동 선택", 테두리+종이색 배경 — 색 판단 없음)로 표시한다. **→ S8에서 해결(#134)**: 자동 처리 안내는 정상 흐름 맨 위의 중립 카드(제목 + 글머리 목록 + "닫기")로 바뀌었고 빈 문구는 표시되지 않는다.
119. **결과 화면의 단계 이동 버튼은 모드별로.** 라이브: "발표용 크게 보기"·"처음부터 다시" 모두 없음(§8-2). solo: "처음부터 다시"(reset, §10.10)만. dev: 둘 다(기존 그대로). 발표용 크게 보기(PresentationView)는 dev 전용 `ui.presentation`으로 유지한다.
120. **/solo 커서 규칙.** `SoloPage`는 `useReducer(step, …)`로 상태를 굴리고 커서는 `gagyebuLogic.beats(lesson 설정)` 위를 로컬로 움직인다. show 비트는 오른쪽 아래 "다음" 버튼(누르면 `transition()` 行動 — 안내 마지막 → 가계부의 `goto` 포함 — 을 적용해 한 칸 전진). work 비트는 "지나쳤을 때" 자동 전진한다: 설문(result ≠ null), 가계부(phase sim), m1~m11(`state.month > N` — 리포트에서 "다음 달로"를 눌렀을 때), m12는 자동 전진 없음(결과 화면이 종점, "처음부터 다시"로 재시작). `join` 비트는 SoloPage의 닉네임 양식이 대신하므로 건너뛰고 `salary` 비트부터 시작하며, 월급은 `rollSalary(Math.random)`. 같은 클릭 안의 연속 행동(setBudget → confirmBudget)을 위해 상태 미러 ref를 두어 항상 최신 상태에 대해 `step`을 검증한다.

### S8(플랫폼 계약 후속) 구현 중 확정 (2026-11-08)

> 번호 109~129는 다른 스트림(S5 등)이 쓰고 있다. 이 목록은 130번부터 센다(merge 시 순서 유지).

130. **잘못된 닉네임은 전용 이유 `'invalid-nickname'`로 거부한다.** `JoinAck`(§5.1)에 이유가 추가됐다. 서버는 trim 뒤 빈 값·10자 초과를 이 이유로 돌려주고, `'join-locked'`은 실제로 입장이 잠긴(또는 끝난) 수업에만 쓴다(#77·#86 해결). 클라이언트 닉네임 양식은 **서버 판정을 따르게** 바뀌었다 — 제출 단계에서 미리 막지 않고 그대로 보내며, `'invalid-nickname'` ack에 "닉네임은 1~10자로 입력해 주세요" 안내문을 양식 안에 보여 준다(status는 'open'을 유지해 양식이 사라지지 않는다).
131. **`RosterEntry.stalled: boolean` 추가(§4.1).** 서버는 학생 기록의 stalled 플래그(기본값 루프 50회 초과, §4.2)를 roster에 그대로 실고, 학생이 이후 비트에서 done으로 판정되면 다시 false로 내린다. `pendingMerge` 대기 항목은 항상 false. 통제의 미완료 명단(ProgressPanel)·학생 관리(StudentPanel)에 중립 "멈춤" 표시가 붙는다(#104 해결).
132. **발표자 닉네임은 `spotlightState` 페이로드로 전면에 전달한다.** `SpotlightStatePayload`가 `{ state, nickname }` 모양이 되고(§5.1), 전면 스냅숏의 `spotlightState` 필드도 같은 모양으로 바뀌었다(재연결 복원용). 발표자 rename 시에도 다시 방송된다. 클라이언트는 `useRoleLive.spotlightName`으로 노출하고 `StageProps.spotlightName`(§4.3)을 거쳐 활동 Stage 화면에 전달한다(#107 해결). **통제의 TV 미리보기는 서버 변경 없이 클라이언트에서 파생한다**: 통제 소켓은 `spotlightState`를 받지 못하므로(#103) roster에서 `classState.spotlight` 학생의 닉네임을 찾아 넘긴다(발표자 *상태*는 여전히 null).
133. **draft-kit의 `Beat`는 `@gagyebu/live`의 타입을 그대로 쓴다.** draft-kit `package.json`의 `dependencies`에 `"@gagyebu/live": "workspace:*"`를 추가하고(lockfile 반영), 로컬 구조 타입을 `import type { Beat } from '@gagyebu/live'` re-export로 대체했다(#85 해결). 하위 호환을 위해 `Beat`는 draft-kit에서도 그대로 export된다.
134. **자동 처리 안내는 하나의 중립 카드로, 빈 문구는 어디에도 세지 않는다.** 학생 화면의 `autoApplied` 표시가 겹친 오버레이 토스트에서 **정상 흐름 맨 위의 카드 하나**(제목 "자동으로 처리된 내용" + 글머리 목록 + "닫기")로 바뀌었다. 커서 비트가 바뀌면 서버 큐가 비워지므로 카드도 사라진다(기존 규칙 그대로). 활동이 안내가 필요 없는 걸음(월 자동 시작·자동 넘기기 등 순차 처리)에 `notice: ''`을 돌려주면 **서버는 큐에 넣지 않고** 클라이언트도 무시한다(§4.2).

### S9(감사 수정) 구현 중 확정 (2026-11-08)

> 번호 135~139는 다른 스트림이 쓸 수 있으므로 이 목록은 140번부터 센다(merge 시 순서 유지).

140. **소켓 페이로드는 전부 신뢰하지 않는다 (B1).** 서버는 모든 이벤트(hello·join·act·draft·select·next·prev·goto·reveal·spotlight·student·openClass·endClass·lockJoin)의 페이로드를 모양(typeof) 검증하고, 어긋나면 계약의 실패 이유로 ack한다 — hello `'not-found'`, join `'invalid-nickname'`, act `'not-allowed'`, 통제 명령 `'invalid-target'`. 모든 ack 체인은 공용 `settle()`로 마무리해 어떤 예외·거부도 `{ ok: false, reason: 'server-error' }`(hello·join은 계약상 남은 이유)로 돌아오고 unhandled rejection이 나지 않는다. CLI 진입점에는 `process.on('unhandledRejection'|'uncaughtException')` 안전망이 있어 놓친 예외도 로그만 남기고 계속 서비스한다.
141. **로그 한 줄·한 세션이 시작을 막지 않는다 (B2).** `readSessionLog`는 파싱할 수 없는 줄을 큰 경고와 함께 건너뛴다(찢어진 마지막 줄 포함). 세션 복원은 세션별 try/catch로 묶어 하나가 깨져도 나머지는 복원된다. `openSessionLog`는 열 때 개행 없이 끝나는 찢어진 마지막 줄을 잘라낸다 — 이후 append가 깨진 줄에 이어 붙아 한 줄 전체를 망가뜨리지 않게 한다.
142. **`connect_error`는 재접속 중일 뿐이다 (M1).** 전면·통제 소켓의 `connect_error`는 네트워크 문제·서버 재시작으로 치고 status `'reconnecting'`("다시 연결 중" 띠, 판은 그대로)로만 바뀐다. `'unauthorized'`(비밀번호 화면)는 첫 snapshot을 받기 전에 서버가 끊은 연결(쿠키 거부, §14 #66)이나 `/api/me`의 401일 때뿐이다.
143. **서버가 끊은 학생 소켓은 클라이언트가 다시 연결한다 (M2).** socket.io는 서버가 `disconnect(true)`한 연결을 자동 재접속하지 않는다. `kicked`를 받은 뒤 끊기면 useLive가 `socket.connect()`로 다시 연결해 "다시 입장하기"가 새 연결에서 동작하게 하고, 끊긴 동안 쌓인 송신 버퍼를 비워 join이 hello보다 먼저 나가는 것을 막는다. `kicked` 없이 서버가 끊으면 같은 기록의 다른 탭이 이 소켓을 대체한 것이므로(§5.8) status `'replaced'`로 "다른 창에서 접속했어요" 화면을 보여 준다(재접속하면 그 탭의 기록을 다시 훔치게 되므로 자동 이어보기 없음). `join`·`dispatch`는 10초 타임아웃으로 항상 결말이 나서 UI가 멈추지 않는다.
144. **끝난 수업은 메모리에 두지 않는다 (M3).** `endClass`는 `ended.json`에 코드를 기록하고(48시간, §8.4 — 코드 재사용 금지 + `hello`의 `'ended'` 응답용), Room은 유예(기본 60초) 후 메모리에서 내려간다. CSV 내보내기는 메모리에 없는 코드를 요청받으면 로그에서 Room을 다시 만들어 응답한다(append 없는 읽기 전용 재생). 시작 복원도 `end` 줄이 있는 세션은 Room으로 올리지 않고 `ended.json`에만 남긴다(#75의 "ended로 복원"을 대체).
145. **`student` op는 서버에서도 모양을 검증한다 (m1).** 모르는 op 종류·누락 필드는 `{ ok: false, reason: 'invalid-target' }`로 ack한다(기존에 unknown op가 ack `null`을 새던 것을 막음). 소켓 계층과 Room 양쪽에서 검증한다.
146. **`hello.device`는 화이트리스트로 검증하고 기본값은 `'laptop'`이다 (m2).** `'laptop'|'tablet'|'phone'` 밖의 값은 `'laptop'`으로 치환해 받는다(거부하지 않는다 — 기기 값은 roster 표시에만 쓰인다).
147. **draft는 직렬화해 8KB까지 (m3).** 초과 초안은 서버가 조용히 버린다(거부 ack 없음 — draft는 원래 ack가 없는 이벤트). 초안은 메모리에만 있으므로(§14 #8) 버려도 진행에 영향이 없고 기본값은 "초안 없음" 경로를 쓴다.
148. **내보내진 닉네임은 그 수업에서 다시 쓸 수 없다 (m4).** `kick`된 학생의 닉네임은 세션 동안 차단 목록에 남아, 같은 닉네임의 재입장은 `'join-locked'`, 그 닉네임으로의 개명은 `'invalid-target'`으로 거부한다(다른 닉네임으로의 재입장은 가능). 계약에 전용 이유가 없으므로 `'join-locked'`를 재사용한다 — 클라이언트는 입장 마감과 같은 안내문을 보여 준다. 재생도 `admin kick` 줄에서 닉네임을 복원해 같게 차단한다.
149. **join 재시도 스로틀은 클라이언트 버튼 카운트다운이다 (m5).** 계약(`JoinAck`)은 그대로 두고, 클라이언트가 마지막 join 시도부터 5초 동안 입장/재시도 버튼을 잠그고 "잠시 후 다시 시도 (N초)"를 보여 준다. useLive도 5초 안의 재시도를 서버가 조용히 버리기 전에 즉시 `'join-locked'` ack로 돌려준다(UI가 멈추지 않게).
150. **발표자 노트의 비밀성은 서버 전송 범위로 한정한다 (m6).** 노트 내용은 어차피 공개 정적 번들에 있으므로 클라이언트 쪽에서는 비밀이 아니다. 서버는 계속 학생·전면 스냅숏에서 `SlideManifest.notes`를 제거한다(§5.2 — 통제 전용). 이 규칙은 그대로 유지된다.
151. **전이 줄에는 실제로 적용된 행동만 기록한다 (m7).** `transition`의 행동을 적용하다 예외가 나면, 나머지를 버리고 지금까지 적용된 행동만 로그에 남긴다 — 재생이 live와 같은 상태를 만든다(§8.2). 기본값 루프(`auto` 줄)는 원래부터 적용된 행동만 기록했다.
152. **두 번째 hello로 다른 방에 들어갈 때 이전 방을 먼저 뗀다 (m8).** 학생 소켓이 이미 한 방에 묶여 있는데 다른(존재하는) 방으로 hello하면, 서버는 이전 방의 대기 요청(pendingMerge)·기록 연결·룸 조합을 해제하고 join 속도 창도 새로 시작한다. 방 전환은 재시도가 아니므로 hello 5초 창을 적용하지 않는다. 이전 방 roster에는 그 학생이 `connected: false`로 남는다(기록은 그대로, §8.3).
