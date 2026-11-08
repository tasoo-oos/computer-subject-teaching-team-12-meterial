// 퍼즈 테스트 (감사 B1, §14 #140): 모든 소켓 이벤트에 모양이 잘못된 페이로드를
// (필드 누락·타입 오류·null·거대 문자열·배열 등) 학생·통제 소켓에서 보내도
// 서버는 죽지 않고, ack는 항상 계약의 모양({ ok: boolean, ... })을 지킨다.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { RunningServer } from './main.ts';
import { cleanupTemp, loginControl, startTestServer } from './testutil/server.ts';
import { connect, emitAck, onceEvent, type ClientSocket } from './testutil/client.ts';
import { testLesson } from './testutil/fake.ts';

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

/** 모양이 잘못된 페이로드 후보 — 소켓으로 실릴 수 있는 것들 */
const BAD_PAYLOADS: unknown[] = [
  undefined,
  null,
  0,
  -1,
  NaN,
  '',
  'x',
  true,
  false,
  [],
  ['array'],
  {},
  { nope: true },
  { code: 123 },
  { nickname: 42 },
  { nickname: null },
  { seq: 'x' },
  { beat: 'nope' },
  { beat: { segment: 'x', beat: null } },
  { beat: { segment: 0 } },
  { op: 'rename' }, // B1 재현: nickname 누락 (room.ts doRename이 throw했던 모양)
  { op: 'nonsense', id: 's1' }, // m1: 모르는 op 종류
  { op: 'kick' }, // id 누락
  { op: 'merge', pendingId: 1 },
  { studentId: 99 },
  { on: 'yes' },
  { segment: 'x', beat: 'y' },
  { force: 1 },
  'n'.repeat(50_000), // 거대 문자열
  { huge: 'h'.repeat(50_000) }, // 거대 객체
  { lessonId: { deep: ['x'] } },
];

/** ack가 계약 모양인지: ok는 boolean, 실패면 reason은 문자열 */
function expectWellFormedAck(ack: unknown, label: string): void {
  expect(ack, label).toBeTypeOf('object');
  const a = ack as { ok?: unknown; reason?: unknown };
  expect(a.ok, label).toBeTypeOf('boolean');
  if (a.ok === false) expect(a.reason, label).toBeTypeOf('string');
}

describe('퍼즈: 모든 이벤트에 모양이 잘못된 페이로드 (B1)', () => {
  it('학생 소켓 — 서버가 죽지 않고 ack는 항상 계약 모양이다', { timeout: 60_000 }, async () => {
    const opened = await server.openClass(testLesson.id);
    if (!opened.ok) throw new Error('openClass 실패');
    const code = opened.code;

    // hello·join은 소켓당 5초에 1회라서(§5.4) 페이로드마다 새 소켓으로 보낸다.
    for (const [i, p] of BAD_PAYLOADS.entries()) {
      const s = connect(url);
      sockets.push(s);
      const hello = await emitAck(s, 'hello', p);
      expectWellFormedAck(hello, `hello #${i}`);
      const join = await emitAck(s, 'join', p);
      expectWellFormedAck(join, `join #${i}`);
      s.disconnect();
    }

    // act·draft·통제 명령은 한 소켓에서 연속으로 — 속도 제한 ack(too-fast·rate-limited)도 계약 모양이다.
    const s = connect(url);
    sockets.push(s);
    await emitAck(s, 'hello', { code, device: 'laptop' });
    for (const [i, p] of BAD_PAYLOADS.entries()) {
      expectWellFormedAck(await emitAck(s, 'act', p), `act #${i}`);
      // select 핸들러는 역할 소켓에만 등록된다(§5.1) — 학생 소켓의 select는 ack 없다.
      s.emit('select', p);
      expectWellFormedAck(await emitAck(s, 'next', p), `next #${i}`);
      expectWellFormedAck(await emitAck(s, 'prev', p), `prev #${i}`);
      expectWellFormedAck(await emitAck(s, 'goto', p), `goto #${i}`);
      expectWellFormedAck(await emitAck(s, 'reveal', p), `reveal #${i}`);
      expectWellFormedAck(await emitAck(s, 'spotlight', p), `spotlight #${i}`);
      expectWellFormedAck(await emitAck(s, 'student', p), `student #${i}`);
      expectWellFormedAck(await emitAck(s, 'openClass', p), `openClass #${i}`);
      expectWellFormedAck(await emitAck(s, 'endClass', p), `endClass #${i}`);
      expectWellFormedAck(await emitAck(s, 'lockJoin', p), `lockJoin #${i}`);
      // draft는 ack가 없다 — 그냥 보내도 서버가 죽지 않는 것만 확인한다
      s.emit('draft', p);
    }

    // 서버는 여전히 산다 — 정상 흐름이 그대로 동작한다
    const res = await fetch(`${url}/api/me`);
    expect(res.status).toBe(200);
  });

  it('통제 소켓 — 모든 통제 이벤트가 잘못된 페이로드에도 계약 모양 ack를 한다 (B1 재현 포함)', { timeout: 60_000 }, async () => {
    const opened = await server.openClass(testLesson.id);
    if (!opened.ok) throw new Error('openClass 실패');
    const cookie = await loginControl(url);
    const s = connect(url, { query: { role: 'control' }, extraHeaders: { Cookie: cookie } });
    sockets.push(s);
    await onceEvent(s, 'snapshot');

    for (const [i, p] of BAD_PAYLOADS.entries()) {
      expectWellFormedAck(await emitAck(s, 'select', p), `select #${i}`);
      expectWellFormedAck(await emitAck(s, 'next', p), `next #${i}`);
      expectWellFormedAck(await emitAck(s, 'prev', p), `prev #${i}`);
      expectWellFormedAck(await emitAck(s, 'goto', p), `goto #${i}`);
      expectWellFormedAck(await emitAck(s, 'reveal', p), `reveal #${i}`);
      expectWellFormedAck(await emitAck(s, 'spotlight', p), `spotlight #${i}`);
      expectWellFormedAck(await emitAck(s, 'student', p), `student #${i}`);
      expectWellFormedAck(await emitAck(s, 'lockJoin', p), `lockJoin #${i}`);
      expectWellFormedAck(await emitAck(s, 'endClass', p), `endClass #${i}`);
      // 학생 이벤트를 통제 소켓이 보내도 죽지 않는다 — hello는 조용히 무시되고(§5.2)
      // join은 5초 제한으로 조용히 버려질 수 있으니(§5.4) ack 없이 보내기만 한다.
      s.emit('hello', p);
      s.emit('join', p);
      expectWellFormedAck(await emitAck(s, 'act', p), `act(role) #${i}`);
      s.emit('draft', p);
    }

    // 위 반복에서 endClass(페이로드 없음)가 수업을 실제로 끝냈고 통제 속도 제한(초당 10회,
    // §5.4)도 채웠다 — 재현 확인은 새 수업 + 새 통제 소켓으로.
    const reopened = await server.openClass(testLesson.id);
    if (!reopened.ok) throw new Error('openClass 실패');
    const s2 = connect(url, { query: { role: 'control' }, extraHeaders: { Cookie: cookie } });
    sockets.push(s2);
    await onceEvent(s2, 'snapshot');
    // B1 재현: nickname 누락 rename — 크래시 대신 invalid-target
    expect(await emitAck(s2, 'student', { op: 'rename', id: 's1' })).toEqual({ ok: false, reason: 'invalid-target' });
    // m1: 모르는 op 종류 — null 대신 invalid-target
    expect(await emitAck(s2, 'student', { op: 'wat', id: 's1' })).toEqual({ ok: false, reason: 'invalid-target' });

    // 서버는 여전히 산다 — 수업이 계속 진행된다
    expect(((await emitAck(s2, 'next', {})) as { ok: boolean }).ok).toBe(true);
    const res = await fetch(`${url}/api/me`);
    expect(res.status).toBe(200);
  });
});
