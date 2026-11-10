#!/usr/bin/env node
// LAN 공개 봇 리허설 (docs/live-api.md §11.3):
//   pnpm bots:public --code 4821 --n 60 --lazy 0.1 --auto-next --control-password <pw>
//   pnpm bots:public --open-class --n 60 --lazy 0.1 --auto-next --control-password <pw>
//
// 하는 일:
//   1. 게임 서버(GAME_PORT, 기본 8092)가 없으면 띄운다 — `pnpm server:dev`와 같은 명령
//      (`node --env-file=.env --env-file-if-exists=.env.dev server/src/main.ts`).
//   2. LAN 공개 Vite(PORT, 기본 8091)가 없으면 띄운다 — `scripts/dev-public.config.ts`.
//   3. 이 컴퓨터의 LAN IPv4로 `scripts/bots.mjs`를 실행한다.
//   4. 끝나면(성공·실패·Ctrl-C) 이 스크립트가 띄운 프로세스만 정리한다.
//      이미 떠 있던 서버(Vite·게임 서버)는 건드리지 않는다.
//
// 전제: live-classroom/.env (STAGE_PASSWORD·CONTROL_PASSWORD·COOKIE_SECRET…)와
//       .env.dev (PORT=8092, NODE_ENV=development). 없으면 게임 서버가 즉시 죽고,
//       이 스크립트가 그 출력을 그대로 보여 준다.
import { spawn } from 'node:child_process';
import { networkInterfaces } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openClass as openClassOn } from './lib/control.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);

const vitePort = Number(process.env.PORT ?? 8091);
const gamePort = Number(process.env.GAME_PORT ?? 8092);
const lanIp =
  Object.values(networkInterfaces())
    .flat()
    .find((a) => a && a.family === 'IPv4' && !a.internal)?.address ?? 'localhost';
const url = `http://${lanIp}:${vitePort}`;

const log = (...parts) => console.log(`[bots:public] ${parts.join(' ')}`);

// ── 준비 상태 확인 ──────────────────────────────────────────────────────────

/** url이 200을 주면 true. 서버가 없거나 프록시 대상이 없으면(502) false. */
async function reachable(target) {
  try {
    const res = await fetch(target, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

const gameReady = () => reachable(`http://127.0.0.1:${gamePort}/socket.io/?EIO=4&transport=polling`);
// Vite인지 구분한다: `/`만 보면 운영 게임 서버(8091)도 200이라 봇을 운영에 붙이게 된다.
const viteReady = () => reachable(`http://127.0.0.1:${vitePort}/@vite/client`);
const portOccupied = () => reachable(`http://127.0.0.1:${vitePort}/`);

/** ms 동안 cond가 참이 될 때까지 기다린다. 프로세스가 죽으면 즉시 false. */
async function waitFor(cond, ms, child) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    if (child && child.exitCode !== null) return false;
    if (await cond()) return true;
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
}

// ── 자식 프로세스 ───────────────────────────────────────────────────────────

const started = []; // 이 스크립트가 띄운 것만 — 종료 시 정리

function start(name, cmd, argv, cwd, env) {
  const child = spawn(cmd, argv, { cwd, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  child.label = name;
  child.tail = [];
  const collect = (chunk) => {
    for (const line of chunk.toString().split('\n')) {
      if (!line.trim()) continue;
      child.tail.push(line);
      if (child.tail.length > 40) child.tail.shift();
      if (process.env.BOTS_PUBLIC_VERBOSE) console.log(`[${name}] ${line}`);
    }
  };
  child.stdout.on('data', collect);
  child.stderr.on('data', collect);
  started.push(child);
  return child;
}

function stopAll() {
  for (const child of started) {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
  }
  // 3초 뒤에도 살아 있으면 강제 종료
  setTimeout(() => {
    for (const child of started) {
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    }
  }, 3000).unref();
}

function failWith(name, child, message) {
  log(message);
  if (child?.tail?.length) {
    log(`${name} 출력 마지막 줄:`);
    for (const line of child.tail.slice(-12)) console.log(`  ${line}`);
  }
  stopAll();
  process.exit(1);
}

// ── 환경 열기 ───────────────────────────────────────────────────────────────

async function ensureGameServer() {
  if (await gameReady()) {
    log(`게임 서버 재사용: 127.0.0.1:${gamePort}`);
    return;
  }
  log(`게임 서버 시작: 127.0.0.1:${gamePort} (node --env-file=.env --env-file-if-exists=.env.dev)`);
  const child = start(
    'server',
    'node',
    ['--env-file=.env', '--env-file-if-exists=.env.dev', 'server/src/main.ts'],
    root,
    { PORT: String(gamePort) },
  );
  if (!(await waitFor(gameReady, 15_000, child))) {
    failWith(
      'server',
      child,
      `게임 서버가 ${gamePort}에서 뜨지 않았습니다. live-classroom/.env(STAGE_PASSWORD·CONTROL_PASSWORD·COOKIE_SECRET)와 .env.dev(PORT=${gamePort})를 확인하세요.`,
    );
  }
  log(`게임 서버 준비됨: 127.0.0.1:${gamePort}`);
}

async function ensureVite() {
  if (await viteReady()) {
    log(`Vite 재사용: 127.0.0.1:${vitePort}`);
    return;
  }
  if (await portOccupied()) {
    // 8091은 운영 게임 서버와 같은 포트다 — 봇을 운영에 붙이지 않도록 멈춘다.
    failWith(
      'vite',
      null,
      `${vitePort}에 Vite가 아닌 서버가 떠 있습니다(운영 게임 서버일 수 있음). 먼저 끄거나 PORT=<다른 포트>로 실행하세요.`,
    );
  }
  log(`Vite 시작: 0.0.0.0:${vitePort} → 게임 서버 ${gamePort}`);
  const child = start(
    'vite',
    'pnpm',
    ['exec', 'vite', '--config', '../scripts/dev-public.config.ts'],
    join(root, 'src'),
    { PORT: String(vitePort), GAME_PORT: String(gamePort) },
  );
  if (!(await waitFor(viteReady, 20_000, child))) {
    failWith(
      'vite',
      child,
      `Vite가 ${vitePort}에서 뜨지 않았습니다. 포트가 이미 쓰이고 있으면 PORT=<다른 포트>로 실행하세요.`,
    );
  }
  log(`Vite 준비됨: http://${lanIp}:${vitePort}`);
}

// ── 수업 열기 (--open-class) ────────────────────────────────────────────────

/** args에서 `--flag value`의 값을 읽는다(인자는 그대로 둔다). */
function flagValue(argv, flag) {
  const i = argv.indexOf(flag);
  return i === -1 ? undefined : argv[i + 1];
}

/** args에서 `--flag value` 쌍을 뺀 나머지. */
function withoutFlag(argv, flag) {
  const i = argv.indexOf(flag);
  return i === -1 ? argv : [...argv.slice(0, i), ...argv.slice(i + 2)];
}

/**
 * 통제 비밀번호로 로그인해 수업을 열고 발급된 코드를 돌려준다.
 * --code로 넘긴 코드가 없을 때(수업을 아직 안 열었을 때) 리허설을 바로 시작하려는 용도.
 */
async function openClass() {
  const password = flagValue(args, '--control-password');
  if (!password) {
    failWith('control', null, '--open-class에는 --control-password가 필요합니다(통제 비밀번호).');
  }
  // --url을 줬으면 그 서버에 수업을 연다(환경은 이미 떠 있다고 본 경우)
  const base = flagValue(args, '--url') ?? `http://127.0.0.1:${vitePort}`;
  try {
    const code = await openClassOn(base, password);
    const studentUrl = flagValue(args, '--url') ?? `http://${lanIp}:${vitePort}/`;
    log(`수업 열림: 코드 ${code} — 학생·TV 주소 ${studentUrl}`);
    return code;
  } catch (err) {
    failWith('control', null, err.message);
  }
}

// ── main ────────────────────────────────────────────────────────────────────

async function main() {
  // --url을 직접 줬으면 환경은 사용자가 알아서 띄운 것으로 보고 그대로 실행한다.
  if (!args.includes('--url')) {
    await ensureGameServer();
    await ensureVite();
  }

  // --open-class: 수업을 아직 안 열었어도 리허설이 바로 시작되게, 이 스크립트가 열고 코드를 받는다.
  let botArgs = args;
  if (args.includes('--open-class')) {
    const code = await openClass();
    // --code는 열린 코드로 바꾸고, 이 스크립트 전용 플래그는 봇에 넘기지 않는다
    botArgs = ['--code', code, ...withoutFlag(args, '--code').filter((a) => a !== '--open-class')];
  }

  const bots = spawn('node', ['scripts/bots.mjs', '--url', url, ...botArgs], {
    cwd: root,
    stdio: 'inherit',
  });

  const forward = (sig) => {
    bots.kill(sig);
    stopAll();
  };
  process.on('SIGINT', () => forward('SIGINT'));
  process.on('SIGTERM', () => forward('SIGTERM'));

  bots.on('exit', (code, signal) => {
    stopAll();
    process.exit(signal ? 1 : (code ?? 1));
  });
}

void main().catch((err) => {
  console.error('[bots:public] 오류:', err);
  stopAll();
  process.exit(1);
});
