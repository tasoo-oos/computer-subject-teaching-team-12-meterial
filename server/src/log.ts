// 세션 로그: 줄 타입(§8.2) + JSONL 기록·읽기. S2가 기록·재생을 구현한다.
// 서버는 행동을 unknown으로만 기록한다(§1.2 — core 의존 없음).
// 로그는 append-only이고 한 수업의 모든 쓰기는 직렬 큐 안에서 일어나므로 락이 필요 없다(§8.2).
//
// 파손 허용(§14 #141): 비정상 종료로 생긴 찢어진 마지막 줄은 열 때 잘라내고,
// 파싱할 수 없는 줄은 큰 경고와 함께 건너뛴다 — 한 줄·한 세션이 시작을 막지 않는다.
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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

/**
 * 찢어진 마지막 줄을 잘라낸다(§14 #141): 비정상 종료(kill -9 등)로 덧붙이다 만 줄이
 * 새어 있으면 그 줄을 버리고 파일이 줄바꿈으로 끝나게 한다. 이후 append가 깨진 줄에
 * 이어 붙어 한 줄 전체를 망가뜨리지 않는다. 파일이 없거나 이미 온전하면 아무것도 안 한다.
 */
export function repairTornTail(file: string): void {
  if (!existsSync(file)) return;
  let content: string;
  try {
    content = readFileSync(file, 'utf8');
  } catch (err) {
    console.error(`[log] ${file}: 읽기 실패 — 수리 없이 계속한다:`, err);
    return;
  }
  if (content.length === 0 || content.endsWith('\n')) return;
  const cut = content.lastIndexOf('\n') + 1;
  console.error(`[log] ${file}: 마지막 줄이 온전하지 않아 잘라냅니다 (버린 문자 ${content.length - cut})`);
  try {
    writeFileSync(file, content.slice(0, cut), 'utf8');
  } catch (err) {
    console.error(`[log] ${file}: 수리 쓰기 실패 — 그대로 계속한다:`, err);
  }
}

/** 세션 로그를 연다(디렉터리가 없으면 만든다). 찢어진 마지막 줄을 수리한다(§14 #141). */
export function openSessionLog(sessionsDir: string, code: ClassCode): SessionLog {
  const dir = join(sessionsDir, code);
  mkdirSync(dir, { recursive: true });
  const file = join(dir, 'log.jsonl');
  repairTornTail(file);
  return {
    dir,
    file,
    append(line: LogLine): void {
      appendFileSync(file, `${JSON.stringify(line)}\n`, 'utf8');
    },
  };
}

/**
 * 로그 파일을 줄 단위로 읽는다. 없으면 [].
 * 파싱할 수 없는 줄(찢어진 쓰기·손상)은 큰 경고를 남기고 건너뛴다(§14 #141) —
 * 한 줄 때문에 서버 시작이 막히지 않게.
 */
export function readSessionLog(sessionsDir: string, code: ClassCode): LogLine[] {
  const file = join(sessionsDir, code, 'log.jsonl');
  if (!existsSync(file)) return [];
  let content: string;
  try {
    content = readFileSync(file, 'utf8');
  } catch (err) {
    console.error(`[log] ${file}: 읽기 실패 — 빈 로그로 취급한다:`, err);
    return [];
  }
  const out: LogLine[] = [];
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    if (!line.trim()) continue;
    try {
      out.push(JSON.parse(line) as LogLine);
    } catch (err) {
      console.error(
        `[log] ${file}:${i + 1}: 파싱할 수 없는 줄을 건너뜁니다 — ${line.slice(0, 80)}` +
          ` (${err instanceof Error ? err.message : String(err)})`,
      );
    }
  }
  return out;
}
