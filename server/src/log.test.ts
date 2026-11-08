// 로그 파손 허용 (감사 B2, §14 #141): 찢어진 마지막 줄·가비지 줄·빈 파일·
// 깨진 세션 하나가 서버 시작을 막지 않는다.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Env } from './env.ts';
import type { RunningServer } from './main.ts';
import { cleanupTemp, startTestServer } from './testutil/server.ts';
import { openSessionLog, readSessionLog, repairTornTail } from './log.ts';
import { testLesson } from './testutil/fake.ts';

let server: RunningServer;
let url: string;

beforeEach(() => {
  server = undefined as unknown as RunningServer;
  url = '';
});

afterEach(async () => {
  if (server) await server.close();
  cleanupTemp();
});

function tempSessions(): string {
  return mkdtempSync(join(tmpdir(), 'gg-logtest-'));
}

function sessionFile(sessionsDir: string, code: string): string {
  return join(sessionsDir, code, 'log.jsonl');
}

function writeRaw(sessionsDir: string, code: string, content: string): void {
  mkdirSync(join(sessionsDir, code), { recursive: true });
  writeFileSync(sessionFile(sessionsDir, code), content, 'utf8');
}

const openLine = (code: string): string =>
  `${JSON.stringify({ t: 'open', ts: 1_000, code, lessonId: testLesson.id })}\n`;

describe('readSessionLog: 파싱할 수 없는 줄은 건너뛴다 (B2)', () => {
  it('가비지 중간 줄을 건너뛰고 온전한 줄만 돌려준다', () => {
    const dir = tempSessions();
    writeRaw(
      dir,
      '1111',
      openLine('1111') + '{이건 json이 아니에요\n' + `${JSON.stringify({ t: 'end', ts: 2000 })}\n`,
    );
    const lines = readSessionLog(dir, '1111');
    expect(lines).toHaveLength(2);
    expect(lines[0]!.t).toBe('open');
    expect(lines[1]!.t).toBe('end');
    rmSync(dir, { recursive: true, force: true });
  });

  it('찢어진 마지막 줄(개행 없음)도 건너뛴다', () => {
    const dir = tempSessions();
    writeRaw(dir, '2222', openLine('2222') + '{"t":"cursor","ts":3,"cursor":{"seg'); // 끊긴 채 끝
    const lines = readSessionLog(dir, '2222');
    expect(lines).toHaveLength(1);
    expect(lines[0]!.t).toBe('open');
    rmSync(dir, { recursive: true, force: true });
  });

  it('빈 파일·없는 파일은 []', () => {
    const dir = tempSessions();
    writeRaw(dir, '3333', '');
    expect(readSessionLog(dir, '3333')).toEqual([]);
    expect(readSessionLog(dir, '9999')).toEqual([]);
    rmSync(dir, { recursive: true, force: true });
  });
});

describe('repairTornTail: 찢어진 마지막 줄을 잘라낸다 (B2)', () => {
  it('개행 없이 끝나는 파일은 마지막 온전한 줄까지로 잘리고 이후 append는 깨지지 않는다', () => {
    const dir = tempSessions();
    writeRaw(dir, '4444', openLine('4444') + '{"t":"cursor","ts":3,"cur');
    repairTornTail(sessionFile(dir, '4444'));
    expect(readFileSync(sessionFile(dir, '4444'), 'utf8')).toBe(openLine('4444'));

    const log = openSessionLog(dir, '4444');
    log.append({ t: 'end', ts: 5_000 });
    const lines = readSessionLog(dir, '4444');
    expect(lines).toHaveLength(2);
    expect(lines[1]!.t).toBe('end');
    rmSync(dir, { recursive: true, force: true });
  });

  it('온전한 파일·없는 파일은 그대로 둔다', () => {
    const dir = tempSessions();
    writeRaw(dir, '5555', openLine('5555'));
    repairTornTail(sessionFile(dir, '5555'));
    expect(readFileSync(sessionFile(dir, '5555'), 'utf8')).toBe(openLine('5555'));
    repairTornTail(sessionFile(dir, '9999')); // 없는 파일 — 조용히 통과
    expect(existsSync(sessionFile(dir, '9999'))).toBe(false);
    rmSync(dir, { recursive: true, force: true });
  });
});

describe('시작 복원: 깨진 세션이 하나여도 나머지는 복원된다 (B2)', () => {
  it('깨진 세션·빈 세션은 건너뛰고 온전한 세션만 Room이 된다', async () => {
    const dataDir = makeDataDir();
    const sessionsDir = join(dataDir, 'sessions');
    // 온전: open만
    writeRaw(sessionsDir, '1111', openLine('1111'));
    // 가비지뿐
    writeRaw(sessionsDir, '2222', '이것은 json이 아니다\n{{{\n');
    // open + 가비지 중간 줄 + end — 읽히지만 end 줄이 있어 복원에서 제외된다(§14 #144)
    writeRaw(
      sessionsDir,
      '3333',
      openLine('3333') + 'garbage\n' + `${JSON.stringify({ t: 'end', ts: 2000 })}\n`,
    );
    // 찢어진 마지막 줄 — 수리 후 open 줄만 남는다
    writeRaw(sessionsDir, '4444', openLine('4444') + '{"t":"rev');
    // 빈 파일
    writeRaw(sessionsDir, '5555', '');

    ({ server, url } = await startTestServer({ dataDir } satisfies Partial<Env>));
    expect(server.rooms.has('1111')).toBe(true);
    expect(server.rooms.has('2222')).toBe(false);
    expect(server.rooms.has('3333')).toBe(false); // end 줄 — 끝난 수업은 올리지 않는다(§14 #144)
    expect(server.rooms.has('4444')).toBe(true); // 찢어진 꼬리는 수리되고 open 줄이 살았다
    expect(server.rooms.has('5555')).toBe(false);

    // 서버는 살아 있다
    const res = await fetch(`${url}/api/me`);
    expect(res.status).toBe(200);
    rmSync(dataDir, { recursive: true, force: true });
  });
});

/** 테스트용 데이터 디렉터리(세션 디렉터리 포함) — 시작 복원 시나리오를 미리 써 둔다. */
function makeDataDir(): string {
  const d = mkdtempSync(join(tmpdir(), 'gg-logrestore-'));
  mkdirSync(join(d, 'sessions'), { recursive: true });
  return d;
}
