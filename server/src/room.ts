// Room: 수업 하나 = Room 하나. 직렬 큐, next/prev/fallback/전이, 로그, 스로틀 (docs/live-api.md §5, §8).
// 서버는 활동 로직을 오직 activities 레지스트리로만 쓰고 게임 상태·행동은 unknown으로 다룬다(§1.2).
import { randomBytes } from 'node:crypto';
import type { DefaultEventsMap, Server as IOServer, Socket as IOSocket } from 'socket.io';
import type {
  ActivityLogic,
  AutoAppliedNotice,
  Beat,
  BeatRef,
  ClassCode,
  ClassState,
  Cursor,
  DeviceKind,
  Lesson,
  OpenClassInfo,
  ProgressInfo,
  RosterEntry,
  SnapshotPayload,
  SpotlightStatePayload,
  StatePayload,
  StatsPayload,
  ActAck,
  ActPayload,
  CmdAck,
  ClientToServerEvents,
  DraftPayload,
  HelloAck,
  HelloPayload,
  JoinAck,
  JoinPayload,
  ServerToClientEvents,
  StudentOp,
} from '@gagyebu/live';
import { beforeBeat, lessonBeats, sameBeat } from '@gagyebu/live';
import type { LogLine, SessionLog } from './log.ts';

// ── 소켓 타입 ─────────────────────────────────────────────────────────────

/** 소켓에 붙는 서버 측 상태 */
export interface LiveSocketData {
  /** 역할 소켓(stage/control)만. 학생 소켓은 undefined */
  role?: 'stage' | 'control';
  /** 학생 소켓이 hello로 지정한 수업 */
  room?: Room;
  /** hello(재접속)·join·merge 승인 뒤 묶인 학생 기록 */
  student?: StudentRecord;
  /** nickname-taken 대기 요청(§5.8) */
  pendingId?: string;
  /** 역할 소켓이 select한 수업 코드 */
  selectedCode?: string;
  /** act 진행 중(ack 전 다음 행동 금지, §5.4) */
  actBusy?: boolean;
  /** act 속도 제한 창(초당 4회) */
  actTimes?: number[];
  /** draft 스로틀(1.5초 1회) */
  lastDraft?: number;
  /** hello·join 속도 제한(5초 1회) */
  lastHello?: number;
  lastJoin?: number;
  /** 통제 명령 속도 제한(초당 10회) */
  cmdTimes?: number[];
  /** hello에서 받은 기기 */
  device?: DeviceKind;
}

export type LiveSocket = IOSocket<ClientToServerEvents, ServerToClientEvents, DefaultEventsMap, LiveSocketData>;
export type LiveIOServer = IOServer<ClientToServerEvents, ServerToClientEvents, DefaultEventsMap, LiveSocketData>;

// ── 학생 기록 ──────────────────────────────────────────────────────────────

export interface StudentRecord {
  id: string;
  token: string;
  nickname: string;
  /** 활동 세그먼트 id → 상태(§8.1). init이 실패한 세그먼트는 없다(degraded) */
  states: Record<string, unknown>;
  /** 메모리에만 있는 초안(§4.2 — 로그에 남기지 않는다) */
  draft: unknown;
  connected: boolean;
  socket: LiveSocket | null;
  late: boolean;
  /** 기본값 루프 50회 초과(§4.2). 이후 비트에서 done이 되면 풀린다 */
  stalled: boolean;
  device: DeviceKind;
  /** 학생에게 아직 안 보낸 자동 처리 통지(§4.2) */
  autoApplied: AutoAppliedNotice[];
  /** 마지막 act의 학생별 증가 번호 */
  seq: number;
}

// ── Room ───────────────────────────────────────────────────────────────────

export interface RoomHooks {
  /** 열린 수업 목록(classes) — snapshot·classes 이벤트에 싣는다 */
  getClasses(): OpenClassInfo[];
  /** openClass·endClass로 목록이 바뀌면 */
  onClassesChange?(): void;
  /** 수업이 끝났을 때(ended.json 기록·유예 뒤 메모리 제거, §14 #144) */
  onEnd?(code: ClassCode): void;
}

export interface RoomOptions {
  code: ClassCode;
  lesson: Lesson;
  activities: Record<string, ActivityLogic<unknown, unknown, unknown, unknown>>;
  log: SessionLog;
  io: LiveIOServer | null;
  maxStudents?: number;
  /** 집계 스로틀 간격(§5.6, 기본 250ms). 0이면 즉시 전송(테스트용) */
  statsIntervalMs?: number;
  random?: () => number;
  now?: () => number;
  hooks?: RoomHooks;
  /** 로그 재생으로 복원된 Room인지(appendOpen 등 초기 로그 생략) */
  replayed?: boolean;
}

interface ActivitySegInfo {
  /** 세그먼트 id (states 키) */
  id: string;
  activity: string;
  cfg: unknown;
  logic: ActivityLogic<unknown, unknown, unknown, unknown>;
}

interface PendingMerge {
  socket: LiveSocket;
  nickname: string;
  device: DeviceKind;
}

const MAX_FALLBACK_ITERATIONS = 50; // §4.2 기본값 루프 종료 보장
/** draft 직렬화 상한(§14 #147). 초과 초안은 버린다 — 통제망·메모리 보호. */
const MAX_DRAFT_BYTES = 8 * 1024;

export class Room {
  readonly code: ClassCode;
  readonly lesson: Lesson;
  readonly openedAt: number;
  private readonly activities: Record<string, ActivityLogic<unknown, unknown, unknown, unknown>>;
  private readonly log: SessionLog;
  private readonly io: LiveIOServer | null;
  private readonly maxStudents: number;
  private readonly statsIntervalMs: number;
  private readonly random: () => number;
  private readonly now: () => number;
  private readonly hooks: RoomHooks;
  private readonly segBeats: { segment: number; beats: Beat[] }[];
  private readonly flat: { ref: BeatRef; beat: Beat }[];
  private readonly segInfo: (ActivitySegInfo | null)[];

  status: 'open' | 'ended' = 'open';
  version = 0;
  cursor: Cursor;
  highMark: BeatRef;
  highRevealed = false;
  spotlight: string | null = null;
  joinLocked = false;

  readonly students = new Map<string, StudentRecord>();
  private readonly byNickname = new Map<string, StudentRecord>();
  private readonly byToken = new Map<string, StudentRecord>();
  private readonly pendingMerges = new Map<string, PendingMerge>();
  /** 내보내진 닉네임 — 이 수업에서 다시 입장·개명할 수 없다(§14 #148) */
  private readonly kickedNicknames = new Set<string>();
  private studentNum = 0;
  private pendingNum = 0;

  private queue: Promise<unknown> = Promise.resolve();
  private statsDirtyFlag = false;
  private rosterDirtyFlag = false;
  private statsTimer: ReturnType<typeof setTimeout> | null = null;
  private lastStatsSend = 0;
  private closed = false;

  constructor(opts: RoomOptions) {
    this.code = opts.code;
    this.lesson = opts.lesson;
    this.openedAt = opts.now?.() ?? Date.now();
    this.activities = opts.activities;
    this.log = opts.log;
    this.io = opts.io;
    this.maxStudents = opts.maxStudents ?? 60;
    this.statsIntervalMs = opts.statsIntervalMs ?? 250;
    this.random = opts.random ?? Math.random;
    this.now = opts.now ?? Date.now;
    this.hooks = opts.hooks ?? { getClasses: () => [] };

    this.segBeats = lessonBeats(opts.lesson, (activityId, cfg) => {
      const logic = opts.activities[activityId];
      if (!logic) throw new Error(`활동 "${activityId}"이(가) 레지스트리에 없습니다.`);
      return logic.beats(cfg);
    });
    this.flat = [];
    for (const { segment, beats } of this.segBeats) {
      beats.forEach((beat, i) => this.flat.push({ ref: { segment, beat: i }, beat }));
    }
    this.segInfo = opts.lesson.segments.map((seg) =>
      seg.kind === 'activity'
        ? {
            id: seg.id,
            activity: seg.activity,
            cfg: seg.config,
            logic: this.requireLogic(seg.activity),
          }
        : null,
    );
    this.cursor = { segment: 0, beat: 0, revealed: false };
    this.highMark = { segment: 0, beat: 0 };
  }

  /** openClass 로그 줄(§8.2). Room 생성 직후 서버가 한 번 부른다. */
  appendOpen(): void {
    this.log.append({ t: 'open', ts: this.now(), code: this.code, lessonId: this.lesson.id });
  }

  // ── 직렬 큐 (§8.1) ─────────────────────────────────────────────────────

  /** 모든 학생 행동·교사 명령을 수업별 큐 하나에 넣어 순차 처리한다(§8.1). */
  enqueue<T>(fn: () => T | Promise<T>): Promise<T> {
    const run = this.queue.then(async () => fn());
    this.queue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  // ── 조회 ───────────────────────────────────────────────────────────────

  classState(): ClassState {
    return {
      code: this.code,
      status: this.status,
      version: this.version,
      lessonId: this.lesson.id,
      cursor: { ...this.cursor },
      highMark: { ...this.highMark },
      highRevealed: this.highRevealed,
      spotlight: this.spotlight,
      joinLocked: this.joinLocked,
    };
  }

  /** 학생 수(제한 판정·roster용) */
  get studentCount(): number {
    return this.students.size;
  }

  private requireLogic(activityId: string): ActivityLogic<unknown, unknown, unknown, unknown> {
    const logic = this.activities[activityId];
    if (!logic) throw new Error(`활동 "${activityId}"이(가) 레지스트리에 없습니다.`);
    return logic;
  }

  private activitySegOf(segment: number): ActivitySegInfo | null {
    return this.segInfo[segment] ?? null;
  }

  private beatAt(ref: BeatRef): Beat | null {
    return this.flat.find((f) => sameBeat(f.ref, ref))?.beat ?? null;
  }

  private isValidRef(ref: BeatRef): boolean {
    return this.flat.some((f) => sameBeat(f.ref, ref));
  }

  private isShowAt(ref: BeatRef): boolean {
    return this.beatAt(ref)?.mode === 'show';
  }

  /** 전역 순서의 다음 비트. 없으면(마지막 비트) null */
  private nextRefOf(ref: BeatRef): BeatRef | null {
    let beat = ref.beat + 1;
    for (let segment = ref.segment; segment < this.segBeats.length; segment++, beat = 0) {
      const count = this.segBeats[segment]?.beats.length ?? 0;
      if (beat < count) return { segment, beat };
    }
    return null;
  }

  /** ref 바로 다음의 show 비트(리뷰 중 next용, §5.5-0). limit(highMark) 이내만 — 없으면 null */
  private nextShowAfter(ref: BeatRef, limit: BeatRef): BeatRef | null {
    let i = this.flat.findIndex((f) => sameBeat(f.ref, ref));
    for (i += 1; i < this.flat.length; i++) {
      const f = this.flat[i];
      if (!f || !beforeBeat(f.ref, limit)) break; // highMark를 넘지 않는다
      if (f.beat.mode === 'show') return { ...f.ref };
    }
    return null;
  }

  /** ref보다 앞선 가장 가까운 show 비트(prev용, §5.7). 없으면 null */
  private prevShowBefore(ref: BeatRef): BeatRef | null {
    const i = this.flat.findIndex((f) => sameBeat(f.ref, ref));
    for (let j = i - 1; j >= 0; j--) {
      const f = this.flat[j];
      if (f && f.beat.mode === 'show') return { ...f.ref };
    }
    return null;
  }

  /** 활동 설정의 confirmForce (§5.5-2). 서버는 config을 unknown으로 다루므로 안전하게 읽는다. */
  private confirmForceOf(cfg: unknown): boolean {
    return (cfg as { confirmForce?: boolean } | null | undefined)?.confirmForce !== false;
  }

  /** done 판정. 활동 예외는 false로 처리하고 로그만 남긴다(서버는 죽지 않는다). */
  private safeDone(seg: ActivitySegInfo, s: unknown, beat: number): boolean {
    if (s === undefined) return false;
    try {
      return !!seg.logic.done(s, beat, seg.cfg);
    } catch (err) {
      console.error(`[room ${this.code}] done(${seg.activity}) 예외:`, err);
      return false;
    }
  }

  /** 학생 id 오름차순(숫자 인식: s2 < s10) */
  private sortedStudents(): StudentRecord[] {
    return [...this.students.values()].sort((a, b) => cmpStudentId(a.id, b.id));
  }

  /** live 비트(highMark)에서 이 학생의 완료 여부. 슬라이드 비트면 항상 true */
  private doneAt(ref: BeatRef, rec: StudentRecord): boolean {
    const seg = this.activitySegOf(ref.segment);
    if (!seg) return true;
    return this.safeDone(seg, rec.states[seg.id], ref.beat);
  }

  // ── 방송 ───────────────────────────────────────────────────────────────

  private classRoomName(): string {
    return `class:${this.code}`;
  }

  private stageRoomName(): string {
    return `class:${this.code}:stage`;
  }

  private controlRoomName(): string {
    return `class:${this.code}:control`;
  }

  private studentRoomName(): string {
    return `class:${this.code}:student`;
  }

  broadcastClass(): void {
    this.io?.to(this.classRoomName()).emit('class', { class: this.classState() });
  }

  /** 커서가 이동할 때마다 version++·로그·방송. highMark 갱신 규칙(§5.5-5, 재생)도 여기 있다. */
  private setCursor(cursor: Cursor): void {
    this.cursor = { ...cursor };
    if (beforeBeat(this.highMark, this.cursor)) {
      this.highMark = { segment: cursor.segment, beat: cursor.beat };
      this.highRevealed = cursor.revealed;
    }
    this.version++;
    this.log.append({ t: 'cursor', ts: this.now(), cursor: { ...this.cursor } });
  }

  private flushNow(): void {
    if (this.statsTimer) {
      clearTimeout(this.statsTimer);
      this.statsTimer = null;
    }
    this.lastStatsSend = this.now();
    if (this.statsDirtyFlag) {
      this.statsDirtyFlag = false;
      const payload = this.statsPayload();
      this.io?.to(this.stageRoomName()).emit('stats', payload);
      this.io?.to(this.controlRoomName()).emit('stats', payload);
    }
    if (this.rosterDirtyFlag) {
      this.rosterDirtyFlag = false;
      this.io?.to(this.controlRoomName()).emit('roster', { entries: this.rosterEntries() });
    }
  }

  /** 집계 재계산 요청. 전송은 수업당 초당 최대 4회(250ms)로 묶고 마지막 값만 보낸다(§5.6). */
  private statsDirty(): void {
    this.statsDirtyFlag = true;
    this.scheduleFlush();
  }

  private rosterDirty(): void {
    this.rosterDirtyFlag = true;
    this.scheduleFlush();
  }

  private scheduleFlush(): void {
    if (this.closed) return;
    if (this.statsIntervalMs <= 0) {
      this.flushNow();
      return;
    }
    if (this.statsTimer) return;
    const wait = Math.max(0, this.statsIntervalMs - (this.now() - this.lastStatsSend));
    this.statsTimer = setTimeout(() => {
      this.statsTimer = null;
      this.flushNow();
    }, wait);
  }

  /** 커서 비트 기준 stats + 항상 highMark 기준 progress·fallbackPreview(§5.1, §5.7) */
  statsPayload(): StatsPayload {
    const cursorRef: BeatRef = { segment: this.cursor.segment, beat: this.cursor.beat };
    return {
      beat: cursorRef,
      stats: this.statsFor(cursorRef),
      progress: this.progressAt(this.highMark),
      fallbackPreview: this.fallbackPreview(),
    };
  }

  private statsFor(ref: BeatRef): unknown {
    const seg = this.activitySegOf(ref.segment);
    if (!seg) return { kind: 'none' }; // 슬라이드 비트 — 집계 없음(§9.4)
    const states = this.sortedStudents()
      .map((rec) => rec.states[seg.id])
      .filter((s) => s !== undefined);
    try {
      return seg.logic.stats(states, ref.beat, seg.cfg);
    } catch (err) {
      console.error(`[room ${this.code}] stats(${seg.activity}) 예외:`, err);
      return { kind: 'none' };
    }
  }

  private progressAt(ref: BeatRef): ProgressInfo {
    let done = 0;
    let connected = 0;
    for (const rec of this.students.values()) {
      if (rec.connected) connected++;
      if (this.doneAt(ref, rec)) done++;
    }
    return { done, connected, total: this.students.size };
  }

  /** 미완료 학생 중 studentId 오름차순 첫 학생의 기본 선택지 라벨(§9.4). 없으면 null */
  private fallbackPreview(): string | null {
    const seg = this.activitySegOf(this.highMark.segment);
    if (!seg) return null;
    for (const rec of this.sortedStudents()) {
      if (this.doneAt(this.highMark, rec)) continue;
      const s = rec.states[seg.id];
      if (s === undefined) continue;
      try {
        return seg.logic.previewFallback?.(s, this.highMark.beat, seg.cfg) ?? null;
      } catch (err) {
        console.error(`[room ${this.code}] previewFallback(${seg.activity}) 예외:`, err);
        return null;
      }
    }
    return null;
  }

  rosterEntries(): RosterEntry[] {
    const entries: RosterEntry[] = this.sortedStudents().map((rec) => ({
      studentId: rec.id,
      nickname: rec.nickname,
      connected: rec.connected,
      done: this.doneAt(this.highMark, rec),
      late: rec.late,
      device: rec.device,
      scene: this.locateOf(rec),
      stalled: rec.stalled,
      pendingMerge: false,
    }));
    for (const [pendingId, p] of this.pendingMerges) {
      entries.push({
        studentId: pendingId,
        nickname: p.nickname,
        connected: true,
        done: false,
        late: false,
        device: p.device,
        scene: null,
        stalled: false,
        pendingMerge: true,
      });
    }
    return entries;
  }

  /** 미완료 명단용 "지금 있는 장면" 문구(§4.2 locate) */
  private locateOf(rec: StudentRecord): string | null {
    const seg = this.activitySegOf(this.highMark.segment);
    if (!seg) return null;
    const s = rec.states[seg.id];
    if (s === undefined) return null;
    try {
      return seg.logic.locate?.(s) ?? null;
    } catch (err) {
      console.error(`[room ${this.code}] locate(${seg.activity}) 예외:`, err);
      return null;
    }
  }

  // ── snapshot ────────────────────────────────────────────────────────────

  /** 학생·전면용 lesson: 발표자 노트(SlideManifest.notes)를 제거한다(§5.2). */
  private strippedLesson(): Lesson {
    const copy = JSON.parse(JSON.stringify(this.lesson)) as Lesson;
    for (const seg of copy.segments) {
      if (seg.kind === 'slides') {
        for (const slide of seg.deck.slides) delete slide.notes;
      }
    }
    return copy;
  }

  snapshotForStudent(rec: StudentRecord): SnapshotPayload {
    const seg = this.activitySegOf(this.cursor.segment);
    const state = seg ? (rec.states[seg.id] ?? null) : null;
    const autoApplied = this.takeAutoApplied(rec);
    return {
      class: this.classState(),
      lesson: this.strippedLesson(),
      classes: this.hooks.getClasses(),
      you: { studentId: rec.id, nickname: rec.nickname, done: this.doneAt(this.highMark, rec) },
      segment: seg ? this.cursor.segment : -1,
      state,
      ...(autoApplied.length > 0 ? { autoApplied } : {}),
    };
  }

  snapshotForStage(): SnapshotPayload {
    return {
      class: this.classState(),
      lesson: this.strippedLesson(),
      classes: this.hooks.getClasses(),
      spotlightState: this.spotlightPayload(),
    };
  }

  snapshotForControl(): SnapshotPayload {
    return {
      class: this.classState(),
      lesson: this.lesson, // 통제는 온전한 lesson(노트 포함, §5.2)
      classes: this.hooks.getClasses(),
      roster: this.rosterEntries(),
    };
  }

  /** 발표자의 활동 상태(§5.1 spotlightState). spotlight 없으면 null */
  private spotlightState(): unknown {
    if (this.spotlight === null) return null;
    const rec = this.students.get(this.spotlight);
    if (!rec) return null;
    const seg = this.activitySegOf(this.cursor.segment);
    if (!seg) return null;
    return rec.states[seg.id] ?? null;
  }

  /** 발표자 닉네임(§5.1). 전면은 roster를 받지 않으므로(§5.2) 페이로드에 직접 싣는다 */
  private spotlightNickname(): string | null {
    if (this.spotlight === null) return null;
    return this.students.get(this.spotlight)?.nickname ?? null;
  }

  private spotlightPayload(): SpotlightStatePayload {
    return { state: this.spotlightState(), nickname: this.spotlightNickname() };
  }

  private emitSpotlightState(): void {
    this.io?.to(this.stageRoomName()).emit('spotlightState', this.spotlightPayload());
  }

  private takeAutoApplied(rec: StudentRecord): AutoAppliedNotice[] {
    const out = rec.autoApplied;
    rec.autoApplied = [];
    return out;
  }

  private statePayloadFor(rec: StudentRecord): StatePayload {
    const seg = this.activitySegOf(this.cursor.segment);
    const state = seg ? (rec.states[seg.id] ?? null) : null;
    const autoApplied = this.takeAutoApplied(rec);
    return {
      state,
      segment: seg ? this.cursor.segment : -1,
      done: this.doneAt(this.highMark, rec),
      version: this.version,
      ...(autoApplied.length > 0 ? { autoApplied } : {}),
    };
  }

  /** 상태가 바뀐 모든(=전체) 학생에게 state 방송(§5.5-6). */
  private sendStateToAll(): void {
    for (const rec of this.students.values()) {
      if (rec.connected && rec.socket) {
        rec.socket.emit('state', this.statePayloadFor(rec));
      }
    }
  }

  // ── 학생 소켓 이벤트 ────────────────────────────────────────────────────

  /** hello(§5.2). 방이 없으면 서버측에서 not-found로 이미 처리된 뒤 들어온다. */
  helloStudent(socket: LiveSocket, p: HelloPayload): Promise<HelloAck> {
    return this.enqueue(() => {
      socket.data.device = p.device;
      if (this.status === 'ended') return { ok: false, reason: 'ended' };
      if (p.token) {
        const rec = this.byToken.get(p.token);
        if (rec) {
          rec.device = p.device; // 재접속한 기기로 갱신(§8.3 — 기기는 로그에 없다)
          this.bindStudentSocket(socket, rec);
          socket.emit('snapshot', this.snapshotForStudent(rec));
          this.rosterDirty();
          this.statsDirty();
          return { ok: true, resumed: true };
        }
      }
      socket.data.room = this;
      return { ok: true, resumed: false };
    });
  }

  private bindStudentSocket(socket: LiveSocket, rec: StudentRecord): void {
    // 같은 기록의 이전 소켓(다른 탭)이 있으면 조용히 대체한다.
    if (rec.socket && rec.socket !== socket) {
      const old = rec.socket;
      old.data.student = undefined;
      old.data.room = undefined;
      old.disconnect(true);
    }
    rec.socket = socket;
    rec.connected = true;
    socket.data.room = this;
    socket.data.student = rec;
    socket.join(this.classRoomName());
    socket.join(this.studentRoomName());
  }

  /** join(§5.2, §8.3). 승인 시 모든 활동 세그먼트마다 init을 호출한다(§8.1). */
  joinStudent(socket: LiveSocket, p: JoinPayload): Promise<JoinAck> {
    return this.enqueue(() => this.doJoin(socket, p));
  }

  private doJoin(socket: LiveSocket, p: JoinPayload): JoinAck {
    const nickname = typeof p.nickname === 'string' ? p.nickname.trim() : '';
    if (this.status === 'ended') return { ok: false, reason: 'join-locked' };
    // 잘못된 닉네임(빈 값·공백만·10자 초과)은 전용 이유로 거부한다(§5.1, §14 #130).
    // 'join-locked'은 실제로 입장이 잠긴 수업에만 쓴다.
    if (nickname.length < 1 || nickname.length > 10) {
      return { ok: false, reason: 'invalid-nickname' };
    }
    if (this.joinLocked) return { ok: false, reason: 'join-locked' };
    // 내보내진 닉네임은 이 수업에서 다시 입장할 수 없다(§14 #148). 다른 닉네임은 가능.
    // 계약에 전용 이유가 없으므로 'join-locked'로 돌려준다(클라이언트는 입장 마감 안내문을 보여 준다).
    if (this.kickedNicknames.has(nickname)) return { ok: false, reason: 'join-locked' };
    if (this.students.size >= this.maxStudents) return { ok: false, reason: 'class-full' };

    this.cancelPendingOf(socket);

    const existing = this.byNickname.get(nickname);
    if (existing) {
      // 기록 이어받기 대기 요청(§5.8)
      const pendingId = `p${++this.pendingNum}`;
      this.pendingMerges.set(pendingId, {
        socket,
        nickname,
        device: socket.data.device ?? 'laptop',
      });
      socket.data.pendingId = pendingId;
      socket.data.room = this;
      this.rosterDirty();
      return { ok: false, reason: 'nickname-taken', pendingId };
    }

    // 학생 생성: 모든 활동 세그먼트 init(기저 + actions 즉시 적용, §8.1)
    const rec: StudentRecord = {
      id: `s${++this.studentNum}`,
      token: randomToken(),
      nickname,
      states: {},
      draft: undefined,
      connected: true,
      socket,
      late: false,
      stalled: false,
      device: socket.data.device ?? 'laptop',
      autoApplied: [],
      seq: 0,
    };
    const inits: { segmentId: string; actions: unknown[] }[] = [];
    for (let i = 0; i < this.segInfo.length; i++) {
      const seg = this.segInfo[i];
      if (!seg) continue;
      try {
        const r = seg.logic.init({ nickname, random: this.random }, seg.cfg);
        let s: unknown = r.state;
        for (const a of r.actions) s = seg.logic.apply(s, a, seg.cfg);
        rec.states[seg.id] = s;
        inits.push({ segmentId: seg.id, actions: r.actions });
      } catch (err) {
        // 활동 init 예외(예: 미구현 stub) — 학생은 슬라이드 구간에서라도 참여할 수 있게
        // degraded로 입장시키고, 그 세그먼트 상태는 없는 채로 둔다(§14 참조).
        console.error(`[room ${this.code}] init(${seg.activity}) 예외:`, err);
      }
    }

    // 지각 여부(§8.3): highMark 앞에 활동 비트가 있으면 채워야 한다.
    const late = this.hasActivityBeatsBefore(this.highMark);
    rec.late = late;

    this.students.set(rec.id, rec);
    this.byNickname.set(nickname, rec);
    this.byToken.set(rec.token, rec);
    // join 줄이 먼저(§8.2): 재생이 학생을 만든 뒤 backfill 줄을 적용해야 한다.
    this.log.append({
      t: 'join',
      ts: this.now(),
      studentId: rec.id,
      nickname,
      token: rec.token,
      late,
      inits,
    });

    if (late) this.backfill(rec);

    this.bindStudentSocket(socket, rec);
    socket.emit('snapshot', this.snapshotForStudent(rec));
    this.rosterDirty();
    this.statsDirty();
    return { ok: true, studentId: rec.id, token: rec.token };
  }

  /** ref보다 앞선 활동 세그먼트 비트가 있는지(지각 판정, §8.3) */
  private hasActivityBeatsBefore(ref: BeatRef): boolean {
    return this.flat.some((f) => beforeBeat(f.ref, ref) && this.activitySegOf(f.ref.segment) !== null);
  }

  /**
   * 지각 합류 채우기(§8.3): live 비트 "바로 앞"까지의 활동 비트를 순서대로 걷는다.
   * work 비트마다 기본값 루프(통지 없음), 비트 b→b+1 전이는 next와 똑같이(live 비트로
   * 들어가는 전이도 포함). show 비트는 건너뛴다. live 비트 자체는 채우지 않는다.
   */
  private backfill(rec: StudentRecord): void {
    for (const { ref, beat } of this.flat) {
      if (!beforeBeat(ref, this.highMark)) break;
      const seg = this.activitySegOf(ref.segment);
      if (!seg) continue;
      if (beat.mode === 'work') {
        this.fallbackLoop(rec, ref, 'backfill', false);
      }
      const to = this.nextRefOf(ref);
      if (to && to.segment === ref.segment) {
        this.applyTransition(rec, ref, to);
      }
    }
  }

  /** 학생 act(§5.1). 속도 제한(too-fast)은 소켓 계층에서 이미 처리된다. */
  act(socket: LiveSocket, p: ActPayload): Promise<ActAck> {
    return this.enqueue(() => this.doAct(socket, p));
  }

  private doAct(socket: LiveSocket, p: ActPayload): ActAck {
    const rec = socket.data.student;
    if (!rec || socket.data.room !== this) {
      return { ok: false, reason: 'not-allowed', message: '입장하지 않았습니다.' };
    }
    if (this.status === 'ended') return { ok: false, reason: 'class-ended' };
    if (beforeBeat(this.cursor, this.highMark)) return { ok: false, reason: 'stale-beat' }; // 리뷰 중(§5.7)
    if (!sameBeat(p.beat, this.highMark)) return { ok: false, reason: 'stale-beat' };

    const seg = this.activitySegOf(this.highMark.segment);
    if (!seg) return { ok: false, reason: 'not-allowed', message: '표시 비트에서는 조작할 수 없습니다.' };
    const cur = rec.states[seg.id];
    if (cur === undefined) return { ok: false, reason: 'server-error', message: '활동 상태가 없습니다.' };

    let verdict: true | string;
    try {
      verdict = seg.logic.allowed(cur, this.highMark.beat, p.action, seg.cfg);
    } catch (err) {
      console.error(`[room ${this.code}] allowed(${seg.activity}) 예외:`, err);
      return { ok: false, reason: 'server-error' };
    }
    if (verdict !== true) return { ok: false, reason: 'not-allowed', message: verdict };

    let next: unknown;
    try {
      next = seg.logic.apply(cur, p.action, seg.cfg);
    } catch (err) {
      console.error(`[room ${this.code}] apply(${seg.activity}) 예외:`, err);
      return { ok: false, reason: 'server-error' };
    }
    rec.states[seg.id] = next;
    rec.seq = p.seq;
    const done = this.safeDone(seg, next, this.highMark.beat);
    if (done) rec.stalled = false;

    this.log.append({
      t: 'act',
      ts: this.now(),
      studentId: rec.id,
      seq: p.seq,
      beat: { segment: this.highMark.segment, beat: this.highMark.beat },
      action: p.action,
    });
    this.statsDirty();
    this.rosterDirty();
    if (this.spotlight === rec.id) this.emitSpotlightState();
    return { ok: true, state: next, done, version: this.version };
  }

  /** draft(§4.2): 메모리에만 저장. 로그에 남기지 않는다(§14 #8).
   *  직렬화해 8KB를 넘는 초안은 버린다(§14 #147) — 서버는 ack 없이 조용히 놓아둔다. */
  saveDraft(socket: LiveSocket, p: DraftPayload): void {
    this.enqueue(() => {
      const rec = socket.data.student;
      if (!rec || socket.data.room !== this) return;
      if (beforeBeat(this.cursor, this.highMark)) return;
      if (p?.beat === undefined || !sameBeat(p.beat, this.highMark)) return;
      if (draftSizeOf(p.data) > MAX_DRAFT_BYTES) return;
      rec.draft = p.data;
    }).catch(() => undefined);
  }

  // ── 교사 명령 (§5.5, §5.7, §5.8) ───────────────────────────────────────

  next(force = false): Promise<CmdAck> {
    return this.enqueue(() => this.doNext(force));
  }

  private doNext(force: boolean): CmdAck {
    if (this.status === 'ended') return { ok: false, reason: 'invalid-target' };

    // 0. 리뷰 복귀(§5.5-0): 마감·확인·기본값·전이 없이 커서만 전진.
    //    앞의 show 비트들 순서대로, 더 없으면 highMark 자신으로.
    if (beforeBeat(this.cursor, this.highMark)) {
      const target = this.nextShowAfter(this.cursor, this.highMark) ?? {
        segment: this.highMark.segment,
        beat: this.highMark.beat,
      };
      const revealed = sameBeat(target, this.highMark) ? this.highRevealed : false;
      this.setCursor({ segment: target.segment, beat: target.beat, revealed });
      this.broadcastClass();
      this.statsDirty();
      return { ok: true };
    }

    // 1. 공개 단계 먼저(§5.5-1). "다음" 하나가 공개 → 다음 비트 순서로 동작한다.
    const beat = this.beatAt(this.cursor);
    if (beat?.reveal && !this.cursor.revealed) {
      this.cursor.revealed = true;
      this.highRevealed = true;
      this.version++;
      this.log.append({ t: 'reveal', ts: this.now(), on: true });
      this.broadcastClass();
      this.statsDirty();
      return { ok: true };
    }

    const to = this.nextRefOf(this.cursor);
    if (!to) return { ok: false, reason: 'invalid-target' }; // 마지막 비트(§14 #5)

    // 2. 마감 확인(§5.5-2).
    const seg = this.activitySegOf(this.cursor.segment);
    const pending = seg ? this.pendingStudents(seg, this.cursor.beat) : [];
    if (pending.length > 0 && !force && this.confirmForceOf(seg?.cfg)) {
      return { ok: false, reason: 'confirm-required', pending: pending.length };
    }

    // 3. 기본값 루프(§5.5-3). 학생 하나의 루프 전체를 로그 auto 줄 하나로.
    for (const rec of pending) {
      this.fallbackLoop(rec, this.highMark, 'fallback', true);
    }

    // 4. 전이(§5.5-4): 커서의 이전·다음 비트가 같은 활동 세그먼트에 있을 때만.
    if (to.segment === this.cursor.segment) {
      for (const rec of this.students.values()) {
        this.applyTransition(rec, this.cursor, to);
      }
    }

    // 5. 커서 이동(§5.5-5).
    this.setCursor({ segment: to.segment, beat: to.beat, revealed: false });

    // 6. 방송(§5.5-6).
    this.broadcastClass();
    this.sendStateToAll();
    this.statsDirty();
    this.rosterDirty();
    return { ok: true };
  }

  /** live 비트에서 done이 false인 학생 목록(§5.5-2). */
  private pendingStudents(seg: ActivitySegInfo, beat: number): StudentRecord[] {
    return this.sortedStudents().filter((rec) => !this.safeDone(seg, rec.states[seg.id], beat));
  }

  /**
   * 기본값 루프(§5.5-3, §4.2): done이 될 때까지 fallback→apply 반복(최대 50회).
   * 초과·예외 시 학생을 stalled로 표시하고 수업은 계속한다(§4.2).
   */
  private fallbackLoop(rec: StudentRecord, ref: BeatRef, kind: 'fallback' | 'backfill', notify: boolean): void {
    const seg = this.activitySegOf(ref.segment);
    if (!seg) return;
    const beat = this.beatAt(ref);
    let s = rec.states[seg.id];
    if (s === undefined) return; // degraded — 적용할 상태가 없다
    const actions: unknown[] = [];
    const notices: string[] = [];
    let overflow = false;
    try {
      for (let i = 0; i < MAX_FALLBACK_ITERATIONS; i++) {
        if (this.safeDone(seg, s, ref.beat)) break;
        const r = seg.logic.fallback(s, ref.beat, seg.cfg, rec.draft);
        s = seg.logic.apply(s, r.action, seg.cfg);
        actions.push(r.action);
        notices.push(r.notice);
      }
      if (!this.safeDone(seg, s, ref.beat)) {
        overflow = true;
        rec.stalled = true;
      } else {
        rec.stalled = false;
      }
    } catch (err) {
      console.error(`[room ${this.code}] fallback(${seg.activity}) 예외:`, err);
      overflow = true;
      rec.stalled = true;
    }
    rec.states[seg.id] = s;
    rec.draft = undefined; // 초안은 이 비트에서 소진(§4.2)
    if (notify) {
      const beatId = beat?.id ?? `${ref.segment}/${ref.beat}`;
      // 빈 안내 문구('' — 순차 처리 걸음 등)는 큐에 넣지 않는다(§14 #134). 화면에도 세지 않는다.
      for (const message of notices) {
        if (message) rec.autoApplied.push({ beatId, message });
      }
    }
    if (actions.length === 0 && !overflow) return; // 적용한 것이 없으면 줄을 남기지 않는다
    this.log.append({
      t: 'auto',
      ts: this.now(),
      studentId: rec.id,
      beat: { segment: ref.segment, beat: ref.beat },
      actions,
      notices,
      overflow,
      kind,
    });
  }

  /** 전이(§5.5-4): 실제로 적용된 행동만 로그에 남긴다(§14 #151) —
   *  도중에 apply가 예외를 던지면 나머지는 버리고 적용된 만큼만 기록해 재생과 live가 같아진다. */
  private applyTransition(rec: StudentRecord, from: BeatRef, to: BeatRef): void {
    if (from.segment !== to.segment) return; // 세그먼트 경계 전이 없음(§4.2)
    const seg = this.activitySegOf(from.segment);
    if (!seg) return;
    const s = rec.states[seg.id];
    if (s === undefined) return;
    let actions: unknown[] = [];
    try {
      actions = seg.logic.transition(s, from.beat, to.beat, seg.cfg) ?? [];
    } catch (err) {
      console.error(`[room ${this.code}] transition(${seg.activity}) 예외:`, err);
      return;
    }
    if (actions.length === 0) return;
    const applied: unknown[] = [];
    let ns: unknown = s;
    try {
      for (const a of actions) {
        ns = seg.logic.apply(ns, a, seg.cfg);
        applied.push(a);
      }
    } catch (err) {
      console.error(`[room ${this.code}] transition apply(${seg.activity}) 예외:`, err);
    }
    rec.states[seg.id] = ns;
    if (applied.length === 0) return;
    this.log.append({
      t: 'transition',
      ts: this.now(),
      studentId: rec.id,
      from: { segment: from.segment, beat: from.beat },
      to: { segment: to.segment, beat: to.beat },
      actions: applied,
    });
  }

  prev(): Promise<CmdAck> {
    return this.enqueue(() => {
      const target = this.prevShowBefore(this.cursor);
      if (!target) return { ok: false, reason: 'invalid-target' };
      this.setCursor({ segment: target.segment, beat: target.beat, revealed: false });
      this.broadcastClass();
      this.statsDirty();
      this.rosterDirty();
      return { ok: true };
    });
  }

  goto(p: { segment: number; beat: number }): Promise<CmdAck> {
    return this.enqueue(() => {
      const target: BeatRef = { segment: p.segment, beat: p.beat };
      if (!this.isValidRef(target)) return { ok: false, reason: 'invalid-target' };
      if (beforeBeat(target, this.highMark)) {
        // highMark 이내의 show 비트만(§5.7)
        if (!this.isShowAt(target)) return { ok: false, reason: 'invalid-target' };
        this.setCursor({ segment: target.segment, beat: target.beat, revealed: false });
      } else if (sameBeat(target, this.highMark)) {
        // live 비트로 돌아가기 — 공개 상태 복원(§5.7)
        this.setCursor({ segment: target.segment, beat: target.beat, revealed: this.highRevealed });
      } else {
        return { ok: false, reason: 'invalid-target' }; // 앞으로 건너뛄기 금지
      }
      this.broadcastClass();
      this.statsDirty();
      this.rosterDirty();
      return { ok: true };
    });
  }

  reveal(on: boolean): Promise<CmdAck> {
    return this.enqueue(() => {
      this.cursor.revealed = on;
      if (sameBeat(this.cursor, this.highMark)) this.highRevealed = on;
      this.version++;
      this.log.append({ t: 'reveal', ts: this.now(), on });
      this.broadcastClass();
      this.statsDirty();
      return { ok: true };
    });
  }

  spotlightCmd(studentId: string | null): Promise<CmdAck> {
    return this.enqueue(() => {
      if (studentId !== null && !this.students.has(studentId)) {
        return { ok: false, reason: 'invalid-target' };
      }
      this.spotlight = studentId;
      this.version++;
      this.log.append({ t: 'spotlight', ts: this.now(), studentId });
      this.broadcastClass();
      this.emitSpotlightState();
      return { ok: true };
    });
  }

  lockJoin(on: boolean): Promise<CmdAck> {
    return this.enqueue(() => {
      this.joinLocked = on;
      this.version++;
      this.log.append({ t: 'admin', ts: this.now(), op: { kind: 'lockJoin', on } });
      this.broadcastClass();
      return { ok: true };
    });
  }

  endClass(): Promise<CmdAck> {
    return this.enqueue(() => {
      if (this.status === 'ended') return { ok: true };
      this.status = 'ended';
      this.version++;
      this.log.append({ t: 'end', ts: this.now() });
      this.broadcastClass();
      this.hooks.onClassesChange?.();
      this.hooks.onEnd?.(this.code); // ended.json 기록·메모리 유예 후 제거(§14 #144)
      return { ok: true };
    });
  }

  /** 교사·학생 관리(§5.8): rename·kick·merge. 모양이 아니면 invalid-target(§14 #145). */
  studentOp(op: StudentOp): Promise<CmdAck> {
    return this.enqueue(() => {
      const raw = op as { op?: unknown; id?: unknown; nickname?: unknown; pendingId?: unknown; intoId?: unknown };
      switch (raw?.op) {
        case 'rename':
          if (typeof raw.id !== 'string' || typeof raw.nickname !== 'string') {
            return { ok: false, reason: 'invalid-target' };
          }
          return this.doRename(raw.id, raw.nickname);
        case 'kick':
          if (typeof raw.id !== 'string') return { ok: false, reason: 'invalid-target' };
          return this.doKick(raw.id);
        case 'merge':
          if (typeof raw.pendingId !== 'string' || typeof raw.intoId !== 'string') {
            return { ok: false, reason: 'invalid-target' };
          }
          return this.doMerge(raw.pendingId, raw.intoId);
        default:
          // 모르는 op 종류 — null ack가 새는 것을 막는다(§14 #145)
          return { ok: false, reason: 'invalid-target' };
      }
    });
  }

  private doRename(id: string, nicknameRaw: string): CmdAck {
    const nickname = typeof nicknameRaw === 'string' ? nicknameRaw.trim() : '';
    const rec = this.students.get(id);
    if (!rec || nickname.length < 1 || nickname.length > 10) return { ok: false, reason: 'invalid-target' };
    // 내보내진 닉네임으로는 개명할 수 없다(§14 #148)
    if (this.kickedNicknames.has(nickname)) return { ok: false, reason: 'invalid-target' };
    const other = this.byNickname.get(nickname);
    if (other && other !== rec) return { ok: false, reason: 'invalid-target' }; // 수업 내 유일(§5.8)
    this.byNickname.delete(rec.nickname);
    rec.nickname = nickname;
    this.byNickname.set(nickname, rec);
    this.log.append({ t: 'admin', ts: this.now(), op: { kind: 'rename', id, nickname } });
    this.rosterDirty();
    // 발표자 이름이 바뀌면 전면 표시(닉네임)도 따라간다(§5.1 spotlightState)
    if (this.spotlight === id) this.emitSpotlightState();
    return { ok: true };
  }

  private doKick(id: string): CmdAck {
    // 대기 요청(pendingMerge) 거부 = merge 거부(§5.8-3)
    const pending = this.pendingMerges.get(id);
    if (pending) {
      this.pendingMerges.delete(id);
      pending.socket.data.pendingId = undefined;
      pending.socket.emit('kicked', { reason: 'merge-rejected' });
      pending.socket.disconnect(true);
      this.log.append({ t: 'admin', ts: this.now(), op: { kind: 'kick', id } });
      this.rosterDirty();
      return { ok: true };
    }
    const rec = this.students.get(id);
    if (!rec) return { ok: false, reason: 'invalid-target' };
    this.kickedNicknames.add(rec.nickname); // 이 수업에서 이 이름으로 재입장 금지(§14 #148)
    if (rec.socket) {
      const socket = rec.socket;
      socket.data.student = undefined;
      socket.data.room = undefined;
      socket.emit('kicked', { reason: 'kicked' });
      socket.disconnect(true);
    }
    this.removeStudent(rec);
    this.log.append({ t: 'admin', ts: this.now(), op: { kind: 'kick', id } });
    this.rosterDirty();
    this.statsDirty();
    return { ok: true };
  }

  private removeStudent(rec: StudentRecord): void {
    this.students.delete(rec.id);
    this.byNickname.delete(rec.nickname);
    this.byToken.delete(rec.token);
    if (this.spotlight === rec.id) this.spotlight = null;
  }

  /** 기록 이어받기 승인(§5.8-3): 대기 소켓이 intoId의 기록을 이어받는다. */
  private doMerge(pendingId: string, intoId: string): CmdAck {
    const pending = this.pendingMerges.get(pendingId);
    const into = this.students.get(intoId);
    if (!pending || !into) return { ok: false, reason: 'invalid-target' };

    // ① intoId의 기존 소켓이 연결돼 있으면 끊고 기존 토큰 무효화
    if (into.socket) {
      const old = into.socket;
      old.data.student = undefined;
      old.data.room = undefined;
      old.emit('kicked', { reason: 'kicked' });
      old.disconnect(true);
    }
    this.byToken.delete(into.token);

    // ② 대기 소켓이 기록을 이어받는다 ③ 새 토큰 발급
    const token = randomToken();
    into.token = token;
    into.device = pending.device;
    this.byToken.set(token, into);
    this.pendingMerges.delete(pendingId);
    pending.socket.data.pendingId = undefined;
    this.bindStudentSocket(pending.socket, into);
    pending.socket.emit('joined', { studentId: into.id, token, nickname: into.nickname });
    pending.socket.emit('snapshot', this.snapshotForStudent(into));

    // ④ 로그 admin merge — 줄에 새 토큰을 포함해 재생이 복원한다(§8.2)
    this.log.append({
      t: 'admin',
      ts: this.now(),
      op: { kind: 'merge', pendingId, intoId, token },
    });
    this.rosterDirty();
    this.statsDirty();
    return { ok: true };
  }

  private cancelPendingOf(socket: LiveSocket): void {
    const pendingId = socket.data.pendingId;
    if (!pendingId) return;
    if (this.pendingMerges.get(pendingId)?.socket === socket) {
      this.pendingMerges.delete(pendingId);
      this.rosterDirty();
    }
    socket.data.pendingId = undefined;
  }

  // ── 연결 끊김 ───────────────────────────────────────────────────────────

  /** 학생 소켓 끊김: 상태는 서버에 있으므로 기록은 그대로(§8.3). */
  studentDisconnected(socket: LiveSocket): void {
    this.enqueue(() => {
      const pendingId = socket.data.pendingId;
      if (pendingId) {
        const pending = this.pendingMerges.get(pendingId);
        if (pending && pending.socket === socket) {
          this.pendingMerges.delete(pendingId);
          this.rosterDirty();
        }
      }
      const rec = socket.data.student;
      if (!rec || rec.socket !== socket) return;
      rec.socket = null;
      rec.connected = false;
      this.rosterDirty();
      this.statsDirty();
    }).catch(() => undefined);
  }

  /**
   * 학생 소켓을 이 방에서 뗀다(§14 #152): 두 번째 hello로 다른 방에 들어갈 때 먼저 불러
   * 이전 방의 대기 요청·기록 연결·룸 조합을 정리한다. 큐에 넣지 않고 즉시 뗀다 —
   * 새 방의 hello가 같은 소켓의 data를 다시 쓰기 때문이다.
   */
  detachSocket(socket: LiveSocket): void {
    const pendingId = socket.data.pendingId;
    if (pendingId) {
      const pending = this.pendingMerges.get(pendingId);
      if (pending && pending.socket === socket) this.pendingMerges.delete(pendingId);
      socket.data.pendingId = undefined;
    }
    const rec = socket.data.student;
    if (rec && rec.socket === socket) {
      rec.socket = null;
      rec.connected = false;
    }
    socket.data.student = undefined;
    socket.data.room = undefined;
    socket.leave(this.classRoomName());
    socket.leave(this.studentRoomName());
  }

  // ── CSV 내보내기 (§8.5) ────────────────────────────────────────────────

  /** 활동의 exportColumns·exportRows로 CSV 본문을 조립한다(§8.5). 내보낼 활동이 없으면 null. */
  exportCsv(): string | null {
    const tables: string[] = [];
    for (let i = 0; i < this.segInfo.length; i++) {
      const seg = this.segInfo[i];
      if (!seg) continue;
      const columns = seg.logic.exportColumns;
      if (!columns || !seg.logic.exportRows) continue;
      const lines: string[] = [columns.map(csvCell).join(',')];
      for (const rec of this.sortedStudents()) {
        const s = rec.states[seg.id];
        if (s === undefined) continue;
        let rows: Record<string, string | number | boolean>[] = [];
        try {
          rows = seg.logic.exportRows(s, { studentId: rec.id, nickname: rec.nickname });
        } catch (err) {
          console.error(`[room ${this.code}] exportRows(${seg.activity}) 예외:`, err);
          continue;
        }
        for (const row of rows) {
          lines.push(columns.map((c) => csvCell(row[c] ?? '')).join(','));
        }
      }
      tables.push(lines.join('\r\n'));
    }
    if (tables.length === 0) return null;
    return tables.join('\r\n\r\n') + '\r\n';
  }

  // ── 종료 ───────────────────────────────────────────────────────────────

  /** 타이머 정리(테스트·서버 종료). */
  close(): void {
    this.closed = true;
    if (this.statsTimer) {
      clearTimeout(this.statsTimer);
      this.statsTimer = null;
    }
  }

  // ── 로그 재생 (§8.2) ───────────────────────────────────────────────────

  /** 로그 한 줄을 재생 적용한다(§8.2). 재생 중에는 방송을 하지 않는다. */
  applyLogLine(line: LogLine): void {
    switch (line.t) {
      case 'open':
        return; // Room 생성이 이미 처리
      case 'join': {
        const rec: StudentRecord = {
          id: line.studentId,
          token: line.token,
          nickname: line.nickname,
          states: {},
          draft: undefined,
          connected: false,
          socket: null,
          late: line.late,
          stalled: false,
          device: 'laptop', // 기기는 로그에 없다 — 재접속 hello에서 갱신된다(§14)
          autoApplied: [],
          seq: 0,
        };
        for (const init of line.inits) {
          const seg = this.segInfo.find((s) => s?.id === init.segmentId);
          if (!seg) continue;
          try {
            const r = seg.logic.init({ nickname: line.nickname, random: () => 0 }, seg.cfg);
            let s: unknown = r.state; // 기저 상태는 결정적(§4.2) — 난수는 actions에 박혀 있다
            for (const a of init.actions) s = seg.logic.apply(s, a, seg.cfg);
            rec.states[seg.id] = s;
          } catch (err) {
            console.error(`[room ${this.code}] 재생 init(${seg.activity}) 예외:`, err);
          }
        }
        this.students.set(rec.id, rec);
        this.byNickname.set(rec.nickname, rec);
        this.byToken.set(rec.token, rec);
        this.studentNum = Math.max(this.studentNum, parseNumSuffix(rec.id));
        return;
      }
      case 'act': {
        const rec = this.students.get(line.studentId);
        const seg = this.activitySegOf(line.beat.segment);
        if (!rec || !seg) return;
        try {
          const cur = rec.states[seg.id];
          if (cur !== undefined) {
            rec.states[seg.id] = seg.logic.apply(cur, line.action, seg.cfg);
          }
        } catch (err) {
          console.error(`[room ${this.code}] 재생 apply(${seg.activity}) 예외:`, err);
        }
        rec.seq = line.seq;
        if (this.safeDone(seg, rec.states[seg.id], line.beat.beat)) rec.stalled = false;
        return;
      }
      case 'auto': {
        const rec = this.students.get(line.studentId);
        const seg = this.activitySegOf(line.beat.segment);
        if (!rec || !seg) return;
        try {
          let s = rec.states[seg.id];
          for (const a of line.actions) {
            if (s === undefined) break;
            s = seg.logic.apply(s, a, seg.cfg);
          }
          if (s !== undefined) rec.states[seg.id] = s;
        } catch (err) {
          console.error(`[room ${this.code}] 재생 auto apply(${seg.activity}) 예외:`, err);
        }
        rec.stalled = line.overflow;
        return;
      }
      case 'transition': {
        const rec = this.students.get(line.studentId);
        const seg = this.activitySegOf(line.from.segment);
        if (!rec || !seg) return;
        try {
          let s = rec.states[seg.id];
          for (const a of line.actions) {
            if (s === undefined) break;
            s = seg.logic.apply(s, a, seg.cfg);
          }
          if (s !== undefined) rec.states[seg.id] = s;
        } catch (err) {
          console.error(`[room ${this.code}] 재생 transition apply(${seg.activity}) 예외:`, err);
        }
        return;
      }
      case 'cursor': {
        this.cursor = { ...line.cursor };
        if (beforeBeat(this.highMark, this.cursor)) {
          this.highMark = { segment: line.cursor.segment, beat: line.cursor.beat };
          this.highRevealed = line.cursor.revealed;
        }
        this.version++;
        return;
      }
      case 'reveal': {
        this.cursor.revealed = line.on;
        if (sameBeat(this.cursor, this.highMark)) this.highRevealed = line.on;
        this.version++;
        return;
      }
      case 'spotlight': {
        this.spotlight = line.studentId;
        this.version++;
        return;
      }
      case 'admin': {
        if (line.op.kind === 'rename') {
          const rec = this.students.get(line.op.id);
          if (rec) {
            this.byNickname.delete(rec.nickname);
            rec.nickname = line.op.nickname;
            this.byNickname.set(rec.nickname, rec);
          }
        } else if (line.op.kind === 'kick') {
          const rec = this.students.get(line.op.id);
          if (rec) {
            this.kickedNicknames.add(rec.nickname); // 재생도 내보낸 이름을 막는다(§14 #148)
            this.removeStudent(rec); // 이 학생의 기록은 여기서 끝난다(§8.2)
          }
        } else if (line.op.kind === 'merge') {
          const into = this.students.get(line.op.intoId);
          if (into) {
            this.byToken.delete(into.token);
            into.token = line.op.token; // admin merge 줄의 새 토큰(§14 #63)
            this.byToken.set(into.token, into);
          }
        } else {
          this.joinLocked = line.op.on;
          this.version++;
        }
        return;
      }
      case 'end': {
        this.status = 'ended';
        this.version++;
        return;
      }
    }
  }

  /** 테스트·디버깅용: 재생 비교가능한 직렬화 상태. */
  debugState(): unknown {
    return {
      code: this.code,
      status: this.status,
      version: this.version,
      lessonId: this.lesson.id,
      cursor: this.cursor,
      highMark: this.highMark,
      highRevealed: this.highRevealed,
      spotlight: this.spotlight,
      joinLocked: this.joinLocked,
      students: this.sortedStudents().map((r) => ({
        id: r.id,
        token: r.token,
        nickname: r.nickname,
        states: r.states,
        late: r.late,
        stalled: r.stalled,
        seq: r.seq,
      })),
    };
  }
}

// ── helpers ────────────────────────────────────────────────────────────────

function randomToken(): string {
  return randomBytes(16).toString('base64url'); // 128비트(§8.3)
}

/** 초안의 직렬화 크기(바이트). JSON이 아니면 0으로 친다(§14 #147). */
function draftSizeOf(data: unknown): number {
  try {
    return Buffer.byteLength(JSON.stringify(data) ?? '', 'utf8');
  } catch {
    return Number.MAX_SAFE_INTEGER; // 순환 참조 등 직렬화 불가 초안은 무조건 버린다
  }
}

function parseNumSuffix(id: string): number {
  const m = /^s(\d+)$/.exec(id);
  return m ? Number(m[1]) : 0;
}

/** 학생 id 오름차순 — s2 < s10(숫자 인식) */
export function cmpStudentId(a: string, b: string): number {
  const ma = /^s(\d+)$/.exec(a);
  const mb = /^s(\d+)$/.exec(b);
  if (ma && mb) return Number(ma[1]) - Number(mb[1]);
  return a < b ? -1 : a > b ? 1 : 0;
}

/** RFC 4180 이스케이프. BOM·인코딩은 서버 책임(§8.5), 조립은 이 함수만. */
export function csvCell(v: string | number | boolean): string {
  const s = typeof v === 'string' ? v : String(v);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// ── 로그 재생으로 Room 복원 (§8.2) ────────────────────────────────────────

export interface RestoreOpts {
  lessons: Record<string, Lesson>;
  activities: Record<string, ActivityLogic<unknown, unknown, unknown, unknown>>;
  log: SessionLog;
  io: LiveIOServer | null;
  maxStudents?: number;
  statsIntervalMs?: number;
  hooks?: RoomHooks;
}

/**
 * 세션 로그를 읽어 Room을 복원한다(§8.2 재생). open 줄의 lessonId로 레슨을 찾는다.
 * 레슨을 못 찾거나 로그가 비었으면 null. end 줄이 없으면 열린 채 복원된다.
 */
export function restoreRoom(lines: LogLine[], opts: RestoreOpts): Room | null {
  const open = lines[0];
  if (!open || open.t !== 'open') return null;
  const lesson = opts.lessons[open.lessonId];
  if (!lesson) {
    console.error(`[replay] 세션 ${open.code}: 레슨 "${open.lessonId}"을(를) 찾을 수 없어 건너뜁니다.`);
    return null;
  }
  const room = new Room({
    code: open.code,
    lesson,
    activities: opts.activities,
    log: opts.log,
    io: opts.io,
    maxStudents: opts.maxStudents,
    statsIntervalMs: opts.statsIntervalMs,
    hooks: opts.hooks,
  });
  for (const line of lines.slice(1)) {
    room.applyLogLine(line);
  }
  return room;
}
