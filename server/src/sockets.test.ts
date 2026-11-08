// 소켓 계층 (docs/live-api.md §5.2, §5.4): hello/join/act 흐름, 속도 제한,
// 역할 소켓 쿠키·snapshot, 권한 없는 명령, 활동 예외로도 서버 생존.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { RunningServer } from './main.ts';
import { cleanupTemp, loginControl, loginStage, startTestServer } from './testutil/server.ts';
import { connect, emitAck, onceEvent, waitFor, type ClientSocket } from './testutil/client.ts';
import { testLesson, throwingLesson } from './testutil/fake.ts';

let server: RunningServer;
let url: string;
const sockets: ClientSocket[] = [];

beforeEach(async () => {
  ({ server, url } = await startTestServer());
});

afterEach(async () => {
  for (const s of sockets.splice(0)) s.disconnect();
  await server.close();
  cleanupTemp();
});

function studentSocket(): ClientSocket {
  const s = connect(url, { transports: ['websocket'] });
  sockets.push(s);
  return s;
}

async function joinStudent(
  code: string,
  nickname: string,
): Promise<{ socket: ClientSocket; token: string; id: string; snapshot: Record<string, unknown> }> {
  const s = connect(url);
  sockets.push(s);
  const hello = await emitAck<{ ok: boolean; resumed: boolean }>(s, 'hello', { code, device: 'laptop' });
  expect(hello.ok).toBe(true);
  const snapshotP = onceEvent<Record<string, unknown>>(s, 'snapshot');
  const join = await emitAck<{ ok: boolean; studentId?: string; token?: string; reason?: string }>(
    s,
    'join',
    { nickname },
  );
  expect(join.ok, join.reason).toBe(true);
  const snapshot = await snapshotP;
  return { socket: s, token: join.token!, id: join.studentId!, snapshot };
}

describe('학생 소켓 (§5.2)', () => {
  it('없는 코드는 not-found, 열린 수업은 join 후 snapshot·state를 받는다', async () => {
    const opened = await server.openClass(testLesson.id);
    if (!opened.ok) throw new Error('openClass 실패');
    const code = opened.code;

    const s = connect(url);
    sockets.push(s);
    const hello = await emitAck<{ ok: boolean; reason?: string }>(s, 'hello', { code: '9999', device: 'laptop' });
    expect(hello).toEqual({ ok: false, reason: 'not-found' });

    const { token, id, snapshot } = await joinStudent(code, '학생');
    expect(token).toMatch(/^[A-Za-z0-9_-]{20,}$/); // base64url 128비트(§8.3)
    expect((snapshot.class as { code: string }).code).toBe(code);
    expect((snapshot.you as { studentId: string }).studentId).toBe(id);
  });

  it('act ack에 state·done이 오고, 잘못된 비트는 stale-beat', async () => {
    const opened = await server.openClass(testLesson.id);
    if (!opened.ok) throw new Error('openClass 실패');
    const { socket } = await joinStudent(opened.code, 'a');

    // 활동 work 비트(setup)까지 진행 — 통제 소켓 대신 서버 메서드로
    const room = server.rooms.get(opened.code)!;
    for (let i = 0; i < 4; i++) await room.next(true);

    const ack = await emitAck<{ ok: boolean; state?: unknown; done?: boolean }>(socket, 'act', {
      seq: 1,
      beat: { segment: 1, beat: 1 },
      action: { type: 'add', n: 2 },
    });
    expect(ack.ok).toBe(true);
    expect((ack.state as { count: number }).count).toBe(2);
    expect(ack.done).toBe(true);

    // 낡은 비트로 보내면 stale-beat
    const stale = await emitAck<{ ok: boolean; reason?: string }>(socket, 'act', {
      seq: 2,
      beat: { segment: 0, beat: 0 },
      action: { type: 'add', n: 1 },
    });
    expect(stale).toEqual({ ok: false, reason: 'stale-beat' });
  });

  it('act 속도 제한: ack 전 연속 행동은 too-fast (§5.4)', async () => {
    const opened = await server.openClass(testLesson.id);
    if (!opened.ok) throw new Error('openClass 실패');
    const { socket } = await joinStudent(opened.code, 'a');
    const room = server.rooms.get(opened.code)!;
    for (let i = 0; i < 4; i++) await room.next(true);

    // ack를 기다리지 않고 두 개를 보낸다 — 두 번째는 too-fast
    const first = emitAck(socket, 'act', {
      seq: 1,
      beat: { segment: 1, beat: 1 },
      action: { type: 'add', n: 1 },
    });
    const second = emitAck<{ ok: boolean; reason?: string }>(socket, 'act', {
      seq: 2,
      beat: { segment: 1, beat: 1 },
      action: { type: 'add', n: 1 },
    });
    await first;
    expect(await second).toEqual({ ok: false, reason: 'too-fast' });
  });

  it('hello 속도 제한 초과는 조용히 무시된다(§5.4)', async () => {
    const opened = await server.openClass(testLesson.id);
    if (!opened.ok) throw new Error('openClass 실패');
    const s = connect(url);
    sockets.push(s);
    const first = emitAck(s, 'hello', { code: opened.code, device: 'laptop' });
    const second = emitAck(s, 'hello', { code: opened.code, device: 'laptop' });
    await first;
    // 두 번째는 ack가 오지 않는다 — 무시(§5.4). 타임아웃 대신 짧게 기다려본다.
    const raced = await Promise.race([
      second.then(() => 'acked'),
      new Promise((r) => setTimeout(() => r('ignored'), 150)),
    ]);
    expect(raced).toBe('ignored');
  });
});

describe('역할 소켓 (§5.2)', () => {
  it('쿠키 없는 role=stage 연결은 끊긴다', async () => {
    const s = connect(url, { query: { role: 'stage' }, reconnection: false });
    const closed = onceEvent(s, 'disconnect');
    await closed;
    expect(s.connected).toBe(false);
  });

  it('쿠키 있는 통제 소켓은 snapshot을 바로 받고 next로 진행한다', async () => {
    const opened = await server.openClass(testLesson.id);
    if (!opened.ok) throw new Error('openClass 실패');
    const cookie = await loginControl(url);
    const s = connect(url, { query: { role: 'control' }, extraHeaders: { Cookie: cookie } });
    sockets.push(s);
    const snapshot = await onceEvent<{
      class: { code: string; cursor: { segment: number; beat: number } };
      lesson: { segments: unknown[] };
      roster: unknown[];
    }>(s, 'snapshot');
    expect(snapshot.class.code).toBe(opened.code); // 자동 선택
    expect(Array.isArray(snapshot.roster)).toBe(true); // 통제 전용 roster(§5.1)

    const ack = await emitAck<{ ok: boolean }>(s, 'next', {});
    expect(ack.ok).toBe(true);
  });

  it('stage 소켓의 통제 명령은 unauthorized, 학생 소켓도 마찬가지', async () => {
    const opened = await server.openClass(testLesson.id);
    if (!opened.ok) throw new Error('openClass 실패');
    const stageCookie = await loginStage(url);
    const stage = connect(url, { query: { role: 'stage' }, extraHeaders: { Cookie: stageCookie } });
    sockets.push(stage);
    await onceEvent(stage, 'snapshot');
    expect(await emitAck(stage, 'next', {})).toEqual({ ok: false, reason: 'unauthorized' });

    const { socket: student } = await joinStudent(opened.code, 'a');
    expect(await emitAck(student, 'next', {})).toEqual({ ok: false, reason: 'unauthorized' });
    expect(await emitAck(student, 'openClass', {})).toEqual({ ok: false, reason: 'unauthorized' });
  });

  it('발표자 노트는 통제에만: 학생·전면 스냅숏의 lesson에 notes가 없다 (§5.2)', async () => {
    const opened = await server.openClass(testLesson.id);
    if (!opened.ok) throw new Error('openClass 실패');
    const { snapshot: studentSnap } = await joinStudent(opened.code, 'a');
    const stageCookie = await loginStage(url);
    const stage = connect(url, { query: { role: 'stage' }, extraHeaders: { Cookie: stageCookie } });
    sockets.push(stage);

    const stageSnap = await onceEvent<{ lesson: unknown }>(stage, 'snapshot');
    expect(JSON.stringify(studentSnap.lesson)).not.toContain('발표자 노트');
    expect(JSON.stringify(stageSnap.lesson)).not.toContain('마무리 노트');
  });

  it('select로 다른 수업을 고를 수 있다 (여러 수업, §5.8)', async () => {
    const a = await server.openClass(testLesson.id);
    const b = await server.openClass(testLesson.id);
    if (!a.ok || !b.ok) throw new Error('openClass 실패');
    const cookie = await loginControl(url);
    const s = connect(url, { query: { role: 'control' }, extraHeaders: { Cookie: cookie } });
    sockets.push(s);
    const first = await onceEvent<{ class: { code: string } }>(s, 'snapshot');
    expect([a.code, b.code]).toContain(first.class.code); // 가장 최근 수업 자동 선택
    const snapP = onceEvent<{ class: { code: string } }>(s, 'snapshot');
    const ack = await emitAck<{ ok: boolean }>(s, 'select', { code: a.code });
    expect(ack.ok).toBe(true);
    expect((await snapP).class.code).toBe(a.code);
  });
});

describe('join 거부 이유가 소켓 계층까지 그대로 전달된다 (§5.1, §14 #130)', () => {
  it('빈 값·공백만·10자 초과 닉네임은 invalid-nickname ack, 올바른 닉네임은 입장된다', async () => {
    const opened = await server.openClass(testLesson.id);
    if (!opened.ok) throw new Error('openClass 실패');
    // join은 소켓당 5초에 1회(§5.4) — 시도마다 새 소켓으로 hello+join 한다
    const tryJoin = async (nickname: string) => {
      const s = connect(url);
      sockets.push(s);
      await emitAck(s, 'hello', { code: opened.code, device: 'laptop' });
      return emitAck<{ ok: boolean; reason?: string; studentId?: string }>(s, 'join', { nickname });
    };
    expect(await tryJoin('')).toEqual({ ok: false, reason: 'invalid-nickname' });
    expect(await tryJoin('   ')).toEqual({ ok: false, reason: 'invalid-nickname' });
    expect(await tryJoin('열한글자이상닉네임입니다')).toEqual({ ok: false, reason: 'invalid-nickname' }); // 12자
    const ok = await tryJoin('하늘');
    expect(ok.ok).toBe(true);
  });
});

describe('발표자 닉네임 방송 (§5.1, §14 #132)', () => {
  it('spotlight 지정·해제마다 :stage에 nickname이 실린다. 스냅숏에도 들어 있다', async () => {
    const opened = await server.openClass(testLesson.id);
    if (!opened.ok) throw new Error('openClass 실패');
    const { id } = await joinStudent(opened.code, '하늘');
    const stageCookie = await loginStage(url);
    const stage = connect(url, { query: { role: 'stage' }, extraHeaders: { Cookie: stageCookie } });
    sockets.push(stage);
    await onceEvent(stage, 'snapshot');

    const room = server.rooms.get(opened.code)!;
    const evP = onceEvent<{ state: unknown; nickname: string | null }>(stage, 'spotlightState');
    expect(await room.spotlightCmd(id)).toEqual({ ok: true });
    const ev = await evP;
    expect(ev.nickname).toBe('하늘'); // 커서가 슬라이드여도 닉네임은 실린다(상태는 null)

    const clearP = onceEvent<{ state: unknown; nickname: string | null }>(stage, 'spotlightState');
    await room.spotlightCmd(null);
    expect((await clearP).nickname).toBeNull();

    // 다시 지정한 뒤 새로 연결하는 전면 소켓의 snapshot에도 닉네임이 있다(재연결 복원)
    await room.spotlightCmd(id);
    const stage2 = connect(url, { query: { role: 'stage' }, extraHeaders: { Cookie: stageCookie } });
    sockets.push(stage2);
    const snap = await onceEvent<{ spotlightState: { state: unknown; nickname: string | null } }>(stage2, 'snapshot');
    expect(snap.spotlightState.nickname).toBe('하늘');
  });

  it('발표자 이름 변경(rename) 시 :stage의 닉네임도 따라간다', async () => {
    const opened = await server.openClass(testLesson.id);
    if (!opened.ok) throw new Error('openClass 실패');
    const { id } = await joinStudent(opened.code, '하늘');
    const stageCookie = await loginStage(url);
    const stage = connect(url, { query: { role: 'stage' }, extraHeaders: { Cookie: stageCookie } });
    sockets.push(stage);
    await onceEvent(stage, 'snapshot');

    const room = server.rooms.get(opened.code)!;
    const setP = onceEvent(stage, 'spotlightState');
    await room.spotlightCmd(id);
    await setP; // 지정 이벤트를 먼저 소비한다
    const evP = onceEvent<{ nickname: string | null }>(stage, 'spotlightState');
    expect(await room.studentOp({ op: 'rename', id, nickname: '구름' })).toEqual({ ok: true });
    expect((await evP).nickname).toBe('구름');
  });
});

describe('활동 예외로도 서버 생존 (§4.2, §14)', () => {
  it('init이 던지는 활동: join은 되고(degraded) act는 server-error, next도 계속된다', async () => {
    const opened = await server.openClass(throwingLesson.id);
    if (!opened.ok) throw new Error('openClass 실패');
    const { socket } = await joinStudent(opened.code, 'a'); // init 예외에도 입장
    const room = server.rooms.get(opened.code)!;
    // 슬라이드 3비트를 지나 활동 work 비트로
    for (let i = 0; i < 3; i++) {
      const ack = await room.next(true);
      expect(ack.ok).toBe(true);
    }

    const act = await emitAck<{ ok: boolean; reason?: string }>(socket, 'act', {
      seq: 1,
      beat: room.highMark,
      action: { type: 'x' },
    });
    expect(act).toEqual({ ok: false, reason: 'server-error', message: '활동 상태가 없습니다.' });

    // next도 죽지 않고 진행된다(stalled 처리)
    const next = await room.next(true);
    expect(next.ok).toBe(true);
    // 서버 프로세스는 살아 있다
    const res = await fetch(`${url}/api/me`);
    expect(res.status).toBe(200);
  });
});
