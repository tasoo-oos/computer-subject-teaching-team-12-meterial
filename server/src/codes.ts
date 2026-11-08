// 수업 코드 발급 (docs/live-api.md §8.4).
// 숫자 4자리, 무작위. 제외 집합 = 현재 열린 수업의 코드 + 최근에 끝난 수업의 코드.
// 끝난 목록은 DATA_DIR/ended.json({ [code]: endedAt })에 보관하고 48시간이 지나면 지운다.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const ENDED_TTL_MS = 48 * 60 * 60 * 1000;

/** 무작위 4자리 숫자 코드. "0000"~"9999". */
export function randomCode(randomInt: (min: number, max: number) => number): string {
  return String(randomInt(0, 10000)).padStart(4, '0');
}

/**
 * isTaken에 걸리지 않는 코드를 찾을 때까지 다시 뽑는다.
 * 10^4에서 제외 집합을 뺀 것이 남아 있으므로(§8.4) 사실상 충돌이 없다.
 */
export function issueCode(
  randomInt: (min: number, max: number) => number,
  isTaken: (code: string) => boolean,
): string {
  for (let i = 0; i < 1000; i++) {
    const code = randomCode(randomInt);
    if (!isTaken(code)) return code;
  }
  // 1000연속 실패는 사실상 불가능하지만 무한루프 방지를 위해 마지막 수를 쓴다.
  return randomCode(randomInt);
}

/** 끝난 수업 코드 목록(ended.json) 관리. 48시간 지나면 항목을 지운다(§8.4). */
export class EndedCodes {
  private readonly file: string;
  private ended: Record<string, number> = {};

  constructor(dataDir: string) {
    this.file = join(dataDir, 'ended.json');
  }

  load(now: number): void {
    if (!existsSync(this.file)) {
      this.ended = {};
      return;
    }
    try {
      const parsed = JSON.parse(readFileSync(this.file, 'utf8')) as Record<string, number>;
      this.ended = {};
      for (const [code, endedAt] of Object.entries(parsed)) {
        if (typeof endedAt === 'number' && now - endedAt < ENDED_TTL_MS) {
          this.ended[code] = endedAt;
        }
      }
      this.save();
    } catch {
      this.ended = {};
    }
  }

  add(code: string, now: number): void {
    this.ended[code] = now;
    this.save();
  }

  has(code: string): boolean {
    return Object.hasOwn(this.ended, code);
  }

  private save(): void {
    mkdirSync(join(this.file, '..'), { recursive: true });
    writeFileSync(this.file, `${JSON.stringify(this.ended, null, 2)}\n`, 'utf8');
  }
}
