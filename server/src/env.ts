// .env 읽기·시작 검증 (docs/live-api.md §7).
// 실행은 `node --env-file=.env server/src/main.ts` — 값은 process.env에 이미 실려 있다.
import { mkdirSync, accessSync, constants } from 'node:fs';
import { resolve } from 'node:path';

export interface Env {
  port: number;
  stagePassword: string;
  controlPassword: string;
  cookieSecret: string;
  /** 세션 로그 루트 (절대 경로로 정규화) */
  dataDir: string;
  soloEnabled: boolean;
  nodeEnv: 'production' | 'development';
  /** 이 주소에서 온 요청만 X-Forwarded-For를 신뢰 (§6.4). 없으면 null */
  trustedProxy: string | null;
  maxStudents: number;
  lessonId: string;
}

export class EnvError extends Error {
  readonly problems: string[];
  constructor(problems: string[]) {
    super(`환경설정 오류:\n  - ${problems.join('\n  - ')}`);
    this.name = 'EnvError';
    this.problems = problems;
  }
}

/**
 * 원시 환경변수 맵을 검증한다 (§7 시작 검증 1~5). 하나라도 어기면 EnvError.
 * DATA_DIR이 없으면 만들고(§7-4), 반환값은 절대 경로다.
 */
export function validateEnv(src: Record<string, string | undefined>): Env {
  const problems: string[] = [];

  const stagePassword = src.STAGE_PASSWORD ?? '';
  const controlPassword = src.CONTROL_PASSWORD ?? '';
  const cookieSecret = src.COOKIE_SECRET ?? '';

  if (!stagePassword) problems.push('STAGE_PASSWORD가 비어 있습니다 (필수).');
  if (!controlPassword) problems.push('CONTROL_PASSWORD가 비어 있습니다 (필수).');
  if (stagePassword && controlPassword && stagePassword === controlPassword) {
    problems.push('STAGE_PASSWORD와 CONTROL_PASSWORD가 같습니다. 달라야 합니다.');
  }
  if (!cookieSecret) {
    problems.push('COOKIE_SECRET가 비어 있습니다 (필수, 32자 이상).');
  } else if (cookieSecret.length < 32) {
    problems.push(`COOKIE_SECRET가 32자 미만입니다 (현재 ${cookieSecret.length}자).`);
  }

  const portRaw = src.PORT ?? '8091';
  const port = Number(portRaw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    problems.push(`PORT가 1~65535 정수여야 합니다 (현재 "${portRaw}").`);
  }

  const dataDir = resolve(src.DATA_DIR && src.DATA_DIR.trim() ? src.DATA_DIR : './data');
  try {
    mkdirSync(dataDir, { recursive: true });
    accessSync(dataDir, constants.W_OK);
  } catch (err) {
    problems.push(`DATA_DIR("${dataDir}")을 만들거나 쓸 수 없습니다: ${(err as Error).message}`);
  }

  const maxStudentsRaw = src.MAX_STUDENTS ?? '60';
  const maxStudents = Number(maxStudentsRaw);
  if (!Number.isInteger(maxStudents) || maxStudents < 1 || maxStudents > 1000) {
    problems.push(`MAX_STUDENTS가 1 이상 정수여야 합니다 (현재 "${maxStudentsRaw}").`);
  }

  if (problems.length > 0) throw new EnvError(problems);

  const nodeEnv = src.NODE_ENV === 'development' ? 'development' : 'production';
  const trustedProxy = src.TRUSTED_PROXY && src.TRUSTED_PROXY.trim() ? src.TRUSTED_PROXY.trim() : null;

  return {
    port,
    stagePassword,
    controlPassword,
    cookieSecret,
    dataDir,
    soloEnabled: src.SOLO_ENABLED === 'true',
    nodeEnv,
    trustedProxy,
    maxStudents,
    lessonId: src.LESSON_ID && src.LESSON_ID.trim() ? src.LESSON_ID.trim() : 'first-salary',
  };
}
