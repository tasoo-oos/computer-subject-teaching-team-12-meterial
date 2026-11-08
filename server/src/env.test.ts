// 시작 검증 (docs/live-api.md §7): 5가지 검증 + 기본값.
import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EnvError, validateEnv } from './env.ts';

const dirs: string[] = [];

afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

function tempDir(): string {
  const d = mkdtempSync(join(tmpdir(), 'gg-env-'));
  dirs.push(d);
  return d;
}

function validSrc(over: Record<string, string> = {}): Record<string, string> {
  return {
    STAGE_PASSWORD: 'stage-pw',
    CONTROL_PASSWORD: 'control-pw',
    COOKIE_SECRET: 'x'.repeat(32),
    DATA_DIR: tempDir(),
    ...over,
  };
}

describe('validateEnv (§7)', () => {
  it('기본값 포함 정상 구성', () => {
    const env = validateEnv(validSrc());
    expect(env.port).toBe(8091);
    expect(env.soloEnabled).toBe(false);
    expect(env.nodeEnv).toBe('production');
    expect(env.trustedProxy).toBeNull();
    expect(env.maxStudents).toBe(60);
    expect(env.lessonId).toBe('first-salary');
    expect(env.dataDir).not.toBe('./data'); // 절대 경로 정규화
  });

  it('비밀번호 누락·동일은 실패 (검증 1·2)', () => {
    expect(() => validateEnv(validSrc({ STAGE_PASSWORD: '' }))).toThrow(EnvError);
    expect(() => validateEnv(validSrc({ CONTROL_PASSWORD: '' }))).toThrow(EnvError);
    expect(() => validateEnv(validSrc({ CONTROL_PASSWORD: 'stage-pw' }))).toThrow(EnvError);
  });

  it('COOKIE_SECRET 32자 미만은 실패 (검증 3)', () => {
    expect(() => validateEnv(validSrc({ COOKIE_SECRET: 'short' }))).toThrow(EnvError);
    expect(() => validateEnv(validSrc({ COOKIE_SECRET: '' }))).toThrow(EnvError);
    expect(() => validateEnv(validSrc({ COOKIE_SECRET: 'y'.repeat(32) }))).not.toThrow();
  });

  it('PORT는 1~65535 정수 (검증 5)', () => {
    expect(() => validateEnv(validSrc({ PORT: '0' }))).toThrow(EnvError);
    expect(() => validateEnv(validSrc({ PORT: '65536' }))).toThrow(EnvError);
    expect(() => validateEnv(validSrc({ PORT: 'abc' }))).toThrow(EnvError);
    expect(() => validateEnv(validSrc({ PORT: '8191' }))).not.toThrow();
  });

  it('DATA_DIR이 없으면 만든다 (검증 4)', () => {
    const dir = join(tempDir(), 'nested', 'deep');
    const env = validateEnv(validSrc({ DATA_DIR: dir }));
    expect(env.dataDir).toBe(dir);
  });

  it('MAX_STUDENTS 이상치는 실패', () => {
    expect(() => validateEnv(validSrc({ MAX_STUDENTS: '0' }))).toThrow(EnvError);
    expect(() => validateEnv(validSrc({ MAX_STUDENTS: 'x' }))).toThrow(EnvError);
  });

  it('여러 문제를 한 번에 보고한다', () => {
    try {
      validateEnv({ STAGE_PASSWORD: '', CONTROL_PASSWORD: '', COOKIE_SECRET: 'x', PORT: 'x' });
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(EnvError);
      expect((err as EnvError).problems.length).toBeGreaterThanOrEqual(4);
    }
  });
});
