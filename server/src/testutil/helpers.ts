// Room 단위 테스트용 조립 도구: 메모리 로그, 가짜 소켓, Room 팩토리.
import type { ClassCode, Lesson } from '@gagyebu/live';
import type { ActivityLogic } from '@gagyebu/live';
import type { LogLine, SessionLog } from '../log.ts';
import { openSessionLog } from '../log.ts';
import { Room, type LiveSocket, type RoomOptions } from '../room.ts';

/** 메모리 로그(파일 안 씀). lines로 재생 검증에도 쓴다. */
export function memLog(): SessionLog & { lines: LogLine[] } {
  const lines: LogLine[] = [];
  return {
    dir: 'mem',
    file: 'mem/log.jsonl',
    lines,
    append(line) {
      lines.push(line);
    },
  };
}

export interface Captured {
  event: string;
  payload: unknown;
}

/** 소켓 흉내: emit은 captured에 기록하고 room 조작에 필요한 메서드만 있다. */
export function fakeSocket(captured?: Captured[]): LiveSocket {
  const data: Record<string, unknown> = {};
  return {
    data,
    join: () => {},
    leave: () => {},
    emit: (event: string, payload: unknown) => {
      captured?.push({ event, payload });
    },
    disconnect: () => {},
    removeAllListeners: () => {},
    removeListener: () => {},
  } as unknown as LiveSocket;
}

export interface MakeRoomOpts {
  lesson: Lesson;
  activities?: Record<string, ActivityLogic<unknown, unknown, unknown, unknown>>;
  code?: ClassCode;
  log?: SessionLog;
  statsIntervalMs?: number;
  random?: () => number;
  now?: () => number;
  hooks?: RoomOptions['hooks'];
}

/** io 없는 Room(단위 테스트). next/prev/goto/act 등 큐 연산만 검증한다. */
export function makeRoom(opts: MakeRoomOpts): Room {
  const room = new Room({
    code: opts.code ?? '1234',
    lesson: opts.lesson,
    activities: opts.activities ?? {},
    log: opts.log ?? memLog(),
    io: null,
    statsIntervalMs: opts.statsIntervalMs ?? 0,
    random: opts.random ?? (() => 0), // 기본: 난수 0 → init bonus 0
    now: opts.now ?? (() => 0),
    hooks: opts.hooks ?? { getClasses: () => [] },
  });
  room.appendOpen();
  return room;
}

/** 파일 기반 세션 로그(재생 테스트용). */
export function fileLog(sessionsDir: string, code: ClassCode): SessionLog {
  return openSessionLog(sessionsDir, code);
}
