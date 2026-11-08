// 세션 로그: 줄 타입(§8.2) + JSONL 기록·읽기. S2가 기록·재생을 구현한다.
// 서버는 행동을 unknown으로만 기록한다(§1.2 — core 의존 없음).
// 로그는 append-only이고 한 수업의 모든 쓰기는 직렬 큐 안에서 일어나므로 락이 필요 없다(§8.2).
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { BeatRef, ClassCode, Cursor } from '@gagyebu/live';

export type LogLine =
  | { t: 'open'; ts: number; code: ClassCode; lessonId: string }
  | {
      t: 'join';
      ts: number;
      studentId: string;
      nickname: string;
      token: string;
      late: boolean;
      inits: { segmentId: string; actions: unknown[] }[]; // 월급 같은 주입 난수 값이 행동에 박혀 있음
    }
  | { t: 'act'; ts: number; studentId: string; seq: number; beat: BeatRef; action: unknown }
  | {
      t: 'auto';
      ts: number;
      studentId: string;
      beat: BeatRef;
      actions: unknown[];
      notices: string[];
      overflow: boolean;
      kind: 'fallback' | 'backfill';
    }
  | { t: 'transition'; ts: number; studentId: string; from: BeatRef; to: BeatRef; actions: unknown[] }
  | { t: 'cursor'; ts: number; cursor: Cursor }
  | { t: 'reveal'; ts: number; on: boolean }
  | { t: 'spotlight'; ts: number; studentId: string | null }
  | {
      t: 'admin';
      ts: number;
      op:
        | { kind: 'rename'; id: string; nickname: string }
        | { kind: 'kick'; id: string }
        | { kind: 'merge'; pendingId: string; intoId: string; token: string } // 새 토큰을 함께 기록(재생 복원용)
        | { kind: 'lockJoin'; on: boolean };
    }
  | { t: 'end'; ts: number };

/** 한 수업의 로그 파일. append는 직렬 큐 안에서만 호출된다(§8.2). */
export interface SessionLog {
  /** 로그 디렉터리 (DATA_DIR/sessions/<code>) */
  dir: string;
  file: string;
  append(line: LogLine): void;
}

/** 세션 로그를 연다(디렉터리가 없으면 만든다). */
export function openSessionLog(sessionsDir: string, code: ClassCode): SessionLog {
  const dir = join(sessionsDir, code);
  mkdirSync(dir, { recursive: true });
  const file = join(dir, 'log.jsonl');
  return {
    dir,
    file,
    append(line: LogLine): void {
      appendFileSync(file, `${JSON.stringify(line)}\n`, 'utf8');
    },
  };
}

/** 로그 파일을 줄 단위로 읽는다. 없으면 []. */
export function readSessionLog(sessionsDir: string, code: ClassCode): LogLine[] {
  const file = join(sessionsDir, code, 'log.jsonl');
  if (!existsSync(file)) return [];
  const lines = readFileSync(file, 'utf8').split('\n');
  const out: LogLine[] = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    out.push(JSON.parse(line) as LogLine);
  }
  return out;
}
