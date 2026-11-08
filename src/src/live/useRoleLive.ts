// 전면(stage)·통제(control) 소켓 훅 (docs/live-api.md §5.2, §10.5~10.6).
// 연결 쿼리 role(§14 S2-#66)로 역할을 밝히고 쿠키 인증은 자동. hello 없이 snapshot을 바로 받는다.
// S6이 통제·전면 페이지를 이 훅 위에 짠다: snapshot/class/stats/roster/classes/spotlightState 수신 +
// ack 있는 명령 헬퍼(next·prev·goto·reveal·spotlight·student·openClass·endClass·lockJoin·select).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  Beat,
  BeatRef,
  ClassCode,
  ClassState,
  CmdAck,
  CmdReject,
  Lesson,
  OpenClassInfo,
  RosterEntry,
  SpotlightStatePayload,
  StatsPayload,
  StudentOp,
} from '@gagyebu/live';
import { lessonBeats } from '@gagyebu/live';
import { beatsOf } from '../activities/beatsOf.ts';
import { createRoleSocket, type RoleSocket } from './socket.ts';

export type RoleStatus = 'connecting' | 'open' | 'reconnecting' | 'unauthorized' | 'error';

export interface UseRoleLiveResult<S = unknown, St = unknown> {
  status: RoleStatus;
  classState: ClassState | null;
  lesson: Lesson | null;
  /** 열린 수업 목록(여럿이면 select로 고른다, §5.8) */
  classes: OpenClassInfo[];
  /** 최신 stats. stats.beat가 지금 그리는 비트와 같을 때만 활동 통계로 쓴다(§5.7 — 다르면 null로 취급) */
  stats: StatsPayload<St> | null;
  roster: RosterEntry[];
  spotlightState: S | null;
  /** 발표자 닉네임 (spotlight 없으면 null). spotlightState 페이로드에 실려 온다(§5.1) */
  spotlightName: string | null;
  /** lessonBeats(lesson, beatsOf) — 타임라인·비트 해석용 */
  beats: { segment: number; beats: Beat[] }[] | null;
  select(code: ClassCode): Promise<CmdAck>;
  next(force?: boolean): Promise<CmdAck>;
  prev(): Promise<CmdAck>;
  goto(ref: BeatRef): Promise<CmdAck>;
  reveal(on: boolean): Promise<CmdAck>;
  spotlight(studentId: string | null): Promise<CmdAck>;
  student(op: StudentOp): Promise<CmdAck>;
  openClass(lessonId?: string): Promise<{ ok: true; code: ClassCode } | { ok: false; reason: CmdReject }>;
  endClass(): Promise<CmdAck>;
  lockJoin(on: boolean): Promise<CmdAck>;
}

export function useRoleLive<S = unknown, St = unknown>(role: 'stage' | 'control'): UseRoleLiveResult<S, St> {
  const [status, setStatus] = useState<RoleStatus>('connecting');
  const [classState, setClassState] = useState<ClassState | null>(null);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [classes, setClasses] = useState<OpenClassInfo[]>([]);
  const [stats, setStats] = useState<StatsPayload<St> | null>(null);
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [spotlightState, setSpotlightState] = useState<S | null>(null);
  const [spotlightName, setSpotlightName] = useState<string | null>(null);

  const socketRef = useRef<RoleSocket<S, St> | null>(null);
  const versionRef = useRef(-1);
  const gotSnapshotRef = useRef(false);

  useEffect(() => {
    const socket = createRoleSocket<S, St>(role);
    socketRef.current = socket;
    versionRef.current = -1;
    gotSnapshotRef.current = false;

    socket.on('snapshot', (p) => {
      gotSnapshotRef.current = true;
      versionRef.current = p.class.version;
      setClassState(p.class);
      setLesson(p.lesson);
      setClasses(p.classes);
      if (p.roster) setRoster(p.roster);
      if (p.spotlightState !== undefined) {
        setSpotlightState((p.spotlightState.state ?? null) as S | null);
        setSpotlightName(p.spotlightState.nickname ?? null);
      }
      setStatus('open');
    });
    socket.on('class', (p) => {
      if (p.class.version < versionRef.current) return; // 낡은 메시지 버림(§5.3)
      versionRef.current = p.class.version;
      setClassState(p.class);
    });
    socket.on('stats', (p) => setStats(p));
    socket.on('roster', (p) => setRoster(p.entries));
    socket.on('classes', (p) => {
      // 열린 수업이 없으면 snapshot 대신 classes만 온다(§14 S2-#67). 연결 자체는 정상
      setClasses(p.classes);
      setStatus((prev) => (prev === 'connecting' ? 'open' : prev));
    });
    socket.on('spotlightState', (p: SpotlightStatePayload<S>) => {
      setSpotlightState((p.state ?? null) as S | null);
      setSpotlightName(p.nickname ?? null);
    });
    socket.on('disconnect', () => {
      // snapshot을 한 번도 안 받았는데 끊기면 쿠키 거부(§14 S2-#66)일 가능성이 크다 — 로그인 화면 유도
      setStatus(gotSnapshotRef.current ? 'reconnecting' : 'unauthorized');
    });
    socket.on('connect_error', () => setStatus((prev) => (prev === 'open' || prev === 'reconnecting' ? 'unauthorized' : prev)));

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [role]);

  // ack 있는 명령 헬퍼. 속도 제한(초당 10회, §5.4)은 서버가 지키고 초과분은 'rate-limited' ack로 돌아온다
  const cmd = useCallback(
    <T,>(event: string, payload: unknown): Promise<T> => {
      const socket = socketRef.current;
      if (!socket) return Promise.resolve({ ok: false, reason: 'server-error' } as T);
      return new Promise<T>((resolve) => {
        (socket.emit as unknown as (e: string, p: unknown, ack: (r: T) => void) => void)(event, payload, resolve);
      });
    },
    [],
  );

  const select = useCallback((code: ClassCode) => cmd<CmdAck>('select', { code }), [cmd]);
  const next = useCallback((force?: boolean) => cmd<CmdAck>('next', force ? { force: true } : {}), [cmd]);
  const prev = useCallback(() => cmd<CmdAck>('prev', undefined), [cmd]);
  const goto = useCallback((ref: BeatRef) => cmd<CmdAck>('goto', { segment: ref.segment, beat: ref.beat }), [cmd]);
  const reveal = useCallback((on: boolean) => cmd<CmdAck>('reveal', { on }), [cmd]);
  const spotlight = useCallback((studentId: string | null) => cmd<CmdAck>('spotlight', { studentId }), [cmd]);
  const student = useCallback((op: StudentOp) => cmd<CmdAck>('student', op), [cmd]);
  const openClass = useCallback(
    (lessonId?: string) => cmd<{ ok: true; code: ClassCode } | { ok: false; reason: CmdReject }>('openClass', lessonId ? { lessonId } : {}),
    [cmd],
  );
  const endClass = useCallback(() => cmd<CmdAck>('endClass', undefined), [cmd]);
  const lockJoin = useCallback((on: boolean) => cmd<CmdAck>('lockJoin', { on }), [cmd]);

  const beats = useMemo(() => (lesson ? lessonBeats(lesson, beatsOf) : null), [lesson]);

  return {
    status,
    classState,
    lesson,
    classes,
    stats,
    roster,
    spotlightState,
    spotlightName,
    beats,
    select,
    next,
    prev,
    goto,
    reveal,
    spotlight,
    student,
    openClass,
    endClass,
    lockJoin,
  };
}
