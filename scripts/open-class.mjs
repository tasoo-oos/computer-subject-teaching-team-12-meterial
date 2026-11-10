#!/usr/bin/env node
// 수업 열기 CLI — tmux 실습 스크립트(scripts/lab.sh)가 코드를 받아 쓰기 좋게,
// 성공하면 발급된 코드만 stdout에 한 줄로 찍는다.
//
//   node scripts/open-class.mjs --url http://127.0.0.1:8091 --password <통제 비밀번호>
//
// --password를 생략하면 live-classroom/.env의 CONTROL_PASSWORD를 읽는다.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openClass } from './lib/control.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function flag(name) {
  const i = process.argv.indexOf(name);
  return i === -1 ? undefined : process.argv[i + 1];
}

function envPassword() {
  try {
    const line = readFileSync(join(root, '.env'), 'utf8')
      .split('\n')
      .find((l) => l.startsWith('CONTROL_PASSWORD='));
    return line?.slice('CONTROL_PASSWORD='.length).trim();
  } catch {
    return undefined;
  }
}

const base = flag('--url') ?? `http://127.0.0.1:${process.env.PORT ?? 8091}`;
const password = flag('--password') ?? flag('--control-password') ?? envPassword();

if (!password) {
  console.error('사용법: node scripts/open-class.mjs --url http://127.0.0.1:8091 --password <통제 비밀번호>');
  process.exit(2);
}

try {
  const code = await openClass(base, password);
  console.log(code);
} catch (err) {
  console.error(`[open-class] ${err.message}`);
  process.exit(1);
}
