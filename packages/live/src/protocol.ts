// Socket.IO v4 프로토콜 (docs/live-api.md §5.1). @gagyebu/core를 import하지 않는다(§1.2).
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
  | 'stale-beat' // live 비트가 아님: 이미 넘어갔거나 리뷰 중
  | 'not-allowed' // allowed 검사 실패
  | 'class-ended'
  | 'too-fast' // ack 전 행동 또는 속도 제한
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
  | 'invalid-target' // prev/goto 대상이 없거나 규칙 위반, 마지막 비트의 next 등
  | 'confirm-required' // 미완료가 있는데 force 없음. pending이 함께 온다
  | 'rate-limited' // 통제 명령 속도 제한 초과
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
  spotlightState?: S | null; // 전면만
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
  openClass: (
    p: OpenClassPayload,
    ack: (r: { ok: true; code: ClassCode } | { ok: false; reason: CmdReject }) => void,
  ) => void; // 통제
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
