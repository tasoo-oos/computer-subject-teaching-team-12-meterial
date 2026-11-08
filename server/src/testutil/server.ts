// 테스트용 서버 조립: 임시 DATA_DIR·dist, startServer + 임시 포트 listen.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Env } from '../env.ts';
import { startServer, type RunningServer } from '../main.ts';
import { testActivities, testLesson, throwingLesson } from './fake.ts';
import type { Lesson } from '@gagyebu/live';

const cleanupFns: Array<() => void> = [];

export function cleanupTemp(): void {
  for (const fn of cleanupFns.splice(0)) fn();
}

export function tempDir(prefix: string): string {
  const d = mkdtempSync(join(tmpdir(), prefix));
  cleanupFns.push(() => rmSync(d, { recursive: true, force: true }));
  return d;
}

/** index.html + assets/app-<hash>.js 하나가 있는 dist 흉내. */
export function makeDist(): string {
  const dist = tempDir('gg-dist-');
  mkdirSync(join(dist, 'assets'), { recursive: true });
  writeFileSync(join(dist, 'index.html'), '<!doctype html><html><body>app</body></html>', 'utf8');
  writeFileSync(join(dist, 'assets', 'app-Bq3xK9.js'), 'console.log("app")', 'utf8');
  return dist;
}

export function testEnv(over: Partial<Env> = {}): Env {
  const dataDir = tempDir('gg-data-');
  return {
    port: 0,
    stagePassword: 'stage-pw',
    controlPassword: 'control-pw',
    cookieSecret: 'x'.repeat(32),
    dataDir,
    soloEnabled: false,
    nodeEnv: 'production',
    trustedProxy: null,
    maxStudents: 60,
    lessonId: 'test-lesson',
    ...over,
  };
}

export interface TestServer {
  server: RunningServer;
  url: string;
  env: Env;
}

/** startServer + listen(0). 기본 레슨: testLesson(+throwingLesson). */
export async function startTestServer(over: Partial<Env> = {}, dist?: string): Promise<TestServer> {
  const env = testEnv(over);
  const lessons: Record<string, Lesson> = { [testLesson.id]: testLesson, [throwingLesson.id]: throwingLesson };
  const server = await startServer({
    env,
    lessons,
    activities: testActivities,
    distDir: dist ?? makeDist(),
    statsIntervalMs: 0,
    random: () => 0.01, // init bonus 0 — 결정적 테스트
  });
  await new Promise<void>((resolve) => server.httpServer.listen(0, () => resolve()));
  const port = (server.httpServer.address() as AddressInfo).port;
  return { server, url: `http://127.0.0.1:${port}`, env };
}

/** 통제 로그인 → 쿠키 문자열. */
export async function loginControl(url: string, password = 'control-pw'): Promise<string> {
  const res = await fetch(`${url}/api/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ role: 'control', password }),
  });
  if (res.status !== 200) throw new Error(`로그인 실패: ${res.status}`);
  return res.headers.getSetCookie().find((c) => c.startsWith('gg_control='))!;
}

export async function loginStage(url: string, password = 'stage-pw'): Promise<string> {
  const res = await fetch(`${url}/api/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ role: 'stage', password }),
  });
  if (res.status !== 200) throw new Error(`로그인 실패: ${res.status}`);
  return res.headers.getSetCookie().find((c) => c.startsWith('gg_stage='))!;
}
