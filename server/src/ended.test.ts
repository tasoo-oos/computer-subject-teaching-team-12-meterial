// 끝난 수업 처리 (감사 M3, §14 #144): endClass가 ended.json에 기록하고 유예 뒤
// 메모리에서 내려간다. CSV는 로그에서 요청 시 다시 만든다. 시작 시 end 줄이 있는
// 세션은 복원하지 않는다. 끝난 코드로 hello하면 'ended'.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Env } from './env.ts';
import type { RunningServer } from './main.ts';
import { cleanupTemp, loginControl, startTestServer } from './testutil/server.ts';
import { connect, emitAck, waitFor, type ClientSocket } from './testutil/client.ts';
import { fakeSocket } from './testutil/helpers.ts';
import { testLesson } from './testutil/fake.ts';

let server: RunningServer;
let url: string;
const sockets: ClientSocket[] = [];

beforeEach(async () => {
  ({ server, url } = await startTestServer({}, undefined, { endedGraceMs: 30 }));
});

afterEach(async () => {
  for (const s of sockets.splice(0)) s.disconnect();
  await server.close();
  cleanupTemp();
});

function readEndedJson(): Record<string, number> {
  return JSON.parse(readFileSync(join(server.env.dataDir, 'ended.json'), 'utf8')) as Record<string, number>;
}

describe('endClass → ended.json + 메모리 제거 (M3)', () => {
  it('끝내면 ended.json에 코드가 남고, 유예 뒤 Room이 내려가도 CSV는 로그에서 다시 만들어 진다', async () => {
    const opened = await server.openClass(testLesson.id);
    if (!opened.ok) throw new Error('openClass 실패');
    const code = opened.code;
    const room = server.rooms.get(code)!;
    await room.joinStudent(fakeSocket(), { nickname: 'a,b' }); // CSV 이스케이프 확인용 겸

    const cookie = await loginControl(url);
    const before = await fetch(`${url}/api/export/${code}.csv`, { headers: { cookie } });
    expect(before.status).toBe(200);
    const beforeText = await before.text();
    expect(beforeText).toContain('studentId,nickname,count,marks');

    expect((await room.endClass()).ok).toBe(true);
    expect(readEndedJson()[code]).toBeTypeOf('number'); // ended.json 기록(48시간, §8.4)

    // 유예(테스트 30ms) 뒤 메모리에서 내려간다
    await waitFor(() => !server.rooms.has(code), 2000);
    expect(server.rooms.has(code)).toBe(false);

    // CSV 내보내기는 여전히 된다 — 로그에서 요청 시 재구축(§14 #144)
    const after = await fetch(`${url}/api/export/${code}.csv`, { headers: { cookie } });
    expect(after.status).toBe(200);
    expect(await after.text()).toBe(beforeText);

    // 끝난 코드로 hello하면 'ended' (ended.json 기반, §14 #144)
    const s = connect(url);
    sockets.push(s);
    expect(await emitAck(s, 'hello', { code, device: 'laptop' })).toEqual({ ok: false, reason: 'ended' });

    // 같은 코드는 다시 발급되지 않는다(제외 집합, §8.4)
    const again = await server.openClass(testLesson.id);
    if (!again.ok) throw new Error('openClass 실패');
    expect(again.code).not.toBe(code);
  });

  it('시작 시 end 줄이 있는 세션은 복원하지 않고 ended.json에만 남긴다', async () => {
    await server.close();
    cleanupTemp();

    const dataDir = mkdtempSync(join(tmpdir(), 'gg-ended-'));
    const sessionsDir = join(dataDir, 'sessions');
    const writeSession = (code: string, lines: string[]): void => {
      mkdirSync(join(sessionsDir, code), { recursive: true });
      writeFileSync(join(sessionsDir, code, 'log.jsonl'), lines.join('\n') + '\n', 'utf8');
    };
    const open = (code: string): string =>
      JSON.stringify({ t: 'open', ts: 1_000, code, lessonId: testLesson.id });
    // 진행 중이던 수업(복원됨)
    writeSession('1111', [open('1111')]);
    // 끝난 수업(복원 안 함)
    writeSession('2222', [open('2222'), JSON.stringify({ t: 'end', ts: 2_000 })]);

    ({ server, url } = await startTestServer({ dataDir } satisfies Partial<Env>));
    expect(server.rooms.has('1111')).toBe(true);
    expect(server.rooms.has('2222')).toBe(false); // end 줄 — 메모리에 올리지 않는다(§14 #144)
    const ended = JSON.parse(readFileSync(join(dataDir, 'ended.json'), 'utf8')) as Record<string, number>;
    expect(ended['2222']).toBeTypeOf('number');

    // hello는 소켓당 5초에 1회(§5.4) — 건별로 새 소켓으로 확인한다
    const s1 = connect(url);
    sockets.push(s1);
    expect(await emitAck(s1, 'hello', { code: '1111', device: 'laptop' })).toEqual({ ok: true, resumed: false });
    const s2 = connect(url);
    sockets.push(s2);
    expect(await emitAck(s2, 'hello', { code: '2222', device: 'laptop' })).toEqual({ ok: false, reason: 'ended' });

    rmSync(dataDir, { recursive: true, force: true });
  });
});
