// 세션 로그 줄 타입 (docs/live-api.md §8.2). S2가 기록·재생을 구현한다.
// 서버는 행동을 unknown으로만 기록한다(§1.2 — core 의존 없음).
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
