// Socket.IO 이벤트 연결 (docs/live-api.md §5.2, §5.4).
// 학생 소켓: hello → join → act/draft. 전면·통제 소켓: 쿠키로 역할 확인 후 snapshot.
import type {
  ActivityLogic,
  ClassCode,
  GotoPayload,
  Lesson,
  NextPayload,
  OpenClassInfo,
  CmdAck,
  SnapshotPayload,
  StudentOp,
} from '@gagyebu/live';
import type { Env } from './env.ts';
import { readCookieValue, verifyCookieValue } from './auth.ts';
import type { LiveIOServer, LiveSocket } from './room.ts';
import type { Room } from './room.ts';

export interface ServerContext {
  env: Env;
  io: LiveIOServer;
  rooms: Map<ClassCode, Room>;
  lessons: Record<string, Lesson>;
  activities: Record<string, ActivityLogic<unknown, unknown, unknown, unknown>>;
  /** 역할 소켓 전원(classes 방송용) */
  roleSockets: Set<LiveSocket>;
  getClasses(): OpenClassInfo[];
  /** 수업 열기(서버 수준: 코드 발급·로그 open) */
  openClass(lessonId?: string): Promise<{ ok: true; code: ClassCode } | { ok: false; reason: 'invalid-target' }>;
}

// ── 속도 제한 (§5.4) ───────────────────────────────────────────────────────

const ACT_RATE_PER_SEC = 4;
const CMD_RATE_PER_SEC = 10;
const DRAFT_INTERVAL_MS = 1500;
const HELLO_JOIN_INTERVAL_MS = 5000;

function takeWindow(times: number[] | undefined, now: number, windowMs: number): number[] {
  const list = (times ?? []).filter((t) => now - t < windowMs);
  return list;
}

function withinRate(list: number[], perSec: number): boolean {
  return list.length < perSec;
}

// ── 연결 ───────────────────────────────────────────────────────────────────

/**
 * 소켓 이벤트를 Room에 연결한다.
 * 역할 구분(§5.2 + §14): 전면·통제 클라이언트는 연결 쿼리 `role=stage|control`로
 * 시작하고, 쿠키(gg_stage/gg_control)가 유효해야 한다. 없으면/틀리면 연결을 끊는다.
 * 쿼리가 없으면 학생 소켓이다(hello 대기).
 */
export function attachSockets(ctx: ServerContext): void {
  const { io } = ctx;

  io.on('connection', (socket) => {
    // 통제 명령 next/prev/...는 모든 소켓에 등록해 역할이 아니면 'unauthorized'로
    // 응답하게 한다(학생·전면 소켓이 보내도 ack 없이 끊기지 않게, §5.1 CmdReject).
    registerControlEvents(ctx, socket);
    const role = roleOf(socket);
    if (role) {
      setupRoleSocket(ctx, socket, role);
      return;
    }
    setupStudentSocket(ctx, socket);
  });
}

function roleOf(socket: LiveSocket): 'stage' | 'control' | null {
  const q = socket.handshake.query.role;
  const role = Array.isArray(q) ? q[0] : q;
  return role === 'stage' || role === 'control' ? role : null;
}

function validRoleCookie(ctx: ServerContext, socket: LiveSocket, role: 'stage' | 'control'): boolean {
  const password = role === 'stage' ? ctx.env.stagePassword : ctx.env.controlPassword;
  const value = readCookieValue(socket.handshake.headers, role);
  return verifyCookieValue(ctx.env.cookieSecret, value, role, password, Date.now());
}

// ── 역할 소켓 (전면·통제) ──────────────────────────────────────────────────

function setupRoleSocket(ctx: ServerContext, socket: LiveSocket, role: 'stage' | 'control'): void {
  if (!validRoleCookie(ctx, socket, role)) {
    socket.disconnect(true); // 쿠키가 없거나 서명이 틀리면 연결을 끊는다(§5.2)
    return;
  }
  socket.data.role = role;
  ctx.roleSockets.add(socket);

  // 자동 선택: 하나만 열려 있으면(또는 여럿이면 가장 최근에 연 수업) 그 수업을 본다(§5.8, §14).
  const openRooms = [...ctx.rooms.values()].filter((r) => r.status === 'open');
  if (openRooms.length > 0) {
    selectRoom(ctx, socket, openRooms.sort((a, b) => b.openedAt - a.openedAt)[0]!.code);
  } else {
    // 열린 수업이 없으면 snapshot 대신 classes만 보낸다(§14).
    socket.emit('classes', { classes: ctx.getClasses() });
  }

  registerCommonEvents(ctx, socket);

  socket.on('disconnect', () => {
    ctx.roleSockets.delete(socket);
  });
}

function selectRoom(ctx: ServerContext, socket: LiveSocket, code: ClassCode): void {
  const room = ctx.rooms.get(code);
  if (!room) return;
  leaveRoleRooms(socket);
  socket.data.selectedCode = code;
  socket.join(`class:${code}`);
  socket.join(`class:${code}:${socket.data.role}`);
  socket.emit('snapshot', snapshotFor(socket, room));
}

function leaveRoleRooms(socket: LiveSocket): void {
  const prev = socket.data.selectedCode;
  if (!prev) return;
  socket.leave(`class:${prev}`);
  socket.leave(`class:${prev}:${socket.data.role}`);
  socket.data.selectedCode = undefined;
}

function snapshotFor(socket: LiveSocket, room: Room): SnapshotPayload {
  return socket.data.role === 'control' ? room.snapshotForControl() : room.snapshotForStage();
}

function selectedRoom(ctx: ServerContext, socket: LiveSocket): Room | null {
  const code = socket.data.selectedCode;
  if (!code) return null;
  return ctx.rooms.get(code) ?? null;
}

function registerCommonEvents(ctx: ServerContext, socket: LiveSocket): void {
  // select(§5.1): 전면·통제. 열린 수업이 여럿일 때 어떤 수업을 볼지 고른다.
  socket.on('select', (p, ack) => {
    if (typeof ack !== 'function') return;
    if (socket.data.role !== 'stage' && socket.data.role !== 'control') {
      ack({ ok: false, reason: 'unauthorized' });
      return;
    }
    if (!cmdRateOk(socket)) {
      ack({ ok: false, reason: 'rate-limited' });
      return;
    }
    const code = p?.code;
    const room = typeof code === 'string' ? ctx.rooms.get(code) : undefined;
    if (!room) {
      ack({ ok: false, reason: 'invalid-target' });
      return;
    }
    selectRoom(ctx, socket, code);
    ack({ ok: true });
  });

  // 학생 전용 이벤트를 역할 소켓에서 보내면 조용히 무시한다(ack는 unauthorized).
  registerStudentEvents(ctx, socket, { roleGuard: true });
}

function cmdRateOk(socket: LiveSocket): boolean {
  const now = Date.now();
  const list = takeWindow(socket.data.cmdTimes, now, 1000);
  list.push(now);
  socket.data.cmdTimes = list;
  return withinRate(list, CMD_RATE_PER_SEC);
}

// ── 통제 이벤트 ────────────────────────────────────────────────────────────

function registerControlEvents(ctx: ServerContext, socket: LiveSocket): void {
  requireControl<NextPayload | undefined>(ctx, socket, 'next', (ack, room, p) =>
    room.next(p?.force === true).then(ack),
  );
  requireControl<void>(ctx, socket, 'prev', (ack, room) => room.prev().then(ack));
  requireControl<GotoPayload | undefined>(ctx, socket, 'goto', (ack, room, p) =>
    room.goto(p ?? { segment: 0, beat: 0 }).then(ack),
  );
  requireControl<{ on: boolean } | undefined>(ctx, socket, 'reveal', (ack, room, p) =>
    room.reveal(p?.on === true).then(ack),
  );
  requireControl<{ studentId: string | null } | undefined>(ctx, socket, 'spotlight', (ack, room, p) =>
    room.spotlightCmd(p?.studentId ?? null).then(ack),
  );
  requireControl<StudentOp>(ctx, socket, 'student', (ack, room, p) => room.studentOp(p).then(ack));
  requireControl<{ on: boolean } | undefined>(ctx, socket, 'lockJoin', (ack, room, p) =>
    room.lockJoin(p?.on === true).then(ack),
  );
  requireControl<void>(ctx, socket, 'endClass', (ack, room) => room.endClass().then(ack));

  socket.on('openClass', (p, ack) => {
    if (typeof ack !== 'function') return;
    if (socket.data.role !== 'control') {
      ack({ ok: false, reason: 'unauthorized' });
      return;
    }
    if (!cmdRateOk(socket)) {
      ack({ ok: false, reason: 'rate-limited' });
      return;
    }
    void ctx.openClass(typeof p?.lessonId === 'string' ? p.lessonId : undefined).then((r) => {
      if (r.ok) {
        // 연 직후 그 수업을 보게 한다(§14).
        selectRoom(ctx, socket, r.code);
      }
      ack(r);
    });
  });
}

function requireControl<P>(
  ctx: ServerContext,
  socket: LiveSocket,
  event: 'next' | 'prev' | 'goto' | 'reveal' | 'spotlight' | 'student' | 'lockJoin' | 'endClass',
  run: (ack: (r: CmdAck) => void, room: Room, p: P) => void,
): void {
  // 이벤트마다 페이로드 타입이 다르므로 소켓 타이핑을 느슨하게 푼다(호출부에서 P를 명시).
  const loose = socket as unknown as {
    on(e: string, h: (p: P, ack: (r: CmdAck) => void) => void): void;
  };
  loose.on(event, (p, ack) => {
    if (socket.data.role !== 'control') {
      ack({ ok: false, reason: 'unauthorized' });
      return;
    }
    if (!cmdRateOk(socket)) {
      ack({ ok: false, reason: 'rate-limited' });
      return;
    }
    const room = selectedRoom(ctx, socket);
    if (!room) {
      ack({ ok: false, reason: 'invalid-target' });
      return;
    }
    run(ack, room, p);
  });
}

// ── 학생 소켓 ───────────────────────────────────────────────────────────────

interface StudentEventOpts {
  /** 역할 소켓이 학생 이벤트를 보낼 때 unauthorized로 응답한다 */
  roleGuard?: boolean;
}

function setupStudentSocket(ctx: ServerContext, socket: LiveSocket): void {
  registerStudentEvents(ctx, socket, {});
  socket.on('disconnect', () => {
    const room = socket.data.room;
    if (room) room.studentDisconnected(socket);
  });
}

function registerStudentEvents(ctx: ServerContext, socket: LiveSocket, opts: StudentEventOpts): void {
  // hello(§5.2): 토큰이 유효하면 재접속. 속도 초과분은 무시(§5.4).
  socket.on('hello', (p, ack) => {
    if (typeof ack !== 'function') return;
    const now = Date.now();
    if (socket.data.lastHello && now - socket.data.lastHello < HELLO_JOIN_INTERVAL_MS) return;
    socket.data.lastHello = now;
    if (opts.roleGuard && socket.data.role) {
      return; // 역할 소켓의 hello는 조용히 무시
    }
    const code = p?.code;
    const room = typeof code === 'string' ? ctx.rooms.get(code) : undefined;
    if (!room) {
      ack({ ok: false, reason: 'not-found' });
      return;
    }
    void room
      .helloStudent(socket, { code, token: p?.token, device: p?.device ?? 'laptop' })
      .then(ack, (err) => {
        console.error('[hello] 서버 오류:', err);
        ack({ ok: false, reason: 'not-found' });
      });
  });

  // join(§5.2): 닉네임 입력. 속도 초과분은 무시(§5.4).
  socket.on('join', (p, ack) => {
    if (typeof ack !== 'function') return;
    const now = Date.now();
    if (socket.data.lastJoin && now - socket.data.lastJoin < HELLO_JOIN_INTERVAL_MS) return;
    socket.data.lastJoin = now;
    if (opts.roleGuard && socket.data.role) {
      ack({ ok: false, reason: 'join-locked' });
      return;
    }
    const room = socket.data.room;
    if (!room) {
      ack({ ok: false, reason: 'join-locked' });
      return;
    }
    void room
      .joinStudent(socket, { nickname: p?.nickname ?? '' })
      .then(ack, (err) => {
        console.error('[join] 서버 오류:', err);
        ack({ ok: false, reason: 'join-locked' });
      });
  });

  // act(§5.4): 소켓당 초당 4회 + 동시 1개. 위반은 'too-fast'.
  socket.on('act', (p, ack) => {
    if (typeof ack !== 'function') return;
    if (opts.roleGuard && socket.data.role) {
      ack({ ok: false, reason: 'not-allowed' });
      return;
    }
    const now = Date.now();
    const list = takeWindow(socket.data.actTimes, now, 1000);
    if (socket.data.actBusy || !withinRate(list, ACT_RATE_PER_SEC)) {
      ack({ ok: false, reason: 'too-fast' });
      return;
    }
    list.push(now);
    socket.data.actTimes = list;
    const room = socket.data.room;
    if (!room) {
      ack({ ok: false, reason: 'stale-beat' });
      return;
    }
    socket.data.actBusy = true;
    void room
      .act(socket, p)
      .then(ack, (err) => {
        console.error('[act] 서버 오류:', err);
        ack({ ok: false, reason: 'server-error' });
      })
      .finally(() => {
        socket.data.actBusy = false;
      });
  });

  // draft(§5.4): 소켓당 1.5초에 1회만 받고 초과분은 조용히 버린다.
  socket.on('draft', (p) => {
    if (opts.roleGuard && socket.data.role) return;
    const now = Date.now();
    if (socket.data.lastDraft && now - socket.data.lastDraft < DRAFT_INTERVAL_MS) return;
    socket.data.lastDraft = now;
    const room = socket.data.room;
    if (!room) return;
    room.saveDraft(socket, p);
  });
}
