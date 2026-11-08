// useLive 훅 (docs/live-api.md §10.2 계약 그대로). 학생 소켓의 hello → snapshot 흐름,
// Socket.IO 내장 자동 재접속, version 기반 낡은 메시지 버림(§5.3), 토큰 저장(localStorage['gg_token_<code>']),
// ended/not-found/kicked 시 토큰 삭제, join/joined/merge-pending 흐름(§5.8), dispatch 단일 in-flight,
// draft 2초 묶음 + 제출 직전 flush(§5.4)를 모두 책임진다.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  ActAck,
  ActPayload,
  AutoAppliedNotice,
  Beat,
  ClassState,
  HelloAck,
  JoinAck,
  KickedPayload,
  Lesson,
} from '@gagyebu/live';
import { lessonBeats } from '@gagyebu/live';
import { beatsOf } from '../activities/beatsOf.ts';
import { createStudentSocket, type StudentSocket } from './socket.ts';

export type LiveStatus = 'connecting' | 'open' | 'reconnecting' | 'ended' | 'not-found' | 'join-locked';

export interface UseLiveResult<S = unknown, A = unknown, D = unknown> {
  status: LiveStatus;
  classState: ClassState | null;
  lesson: Lesson | null;
  you: { studentId: string; nickname: string } | null;
  /** 커서의 활동 세그먼트 상태. 슬라이드 세그먼트면 null */
  state: S | null;
  /** live 비트(highMark)에서 이 학생의 완료 여부(서버가 ActAck·state·snapshot의 done으로 알려 줌).
   *  true면 Audience는 대기 화면 */
  submitted: boolean;
  /** 서버가 아직 안 보여 준 자동 처리 안내. 커서 비트가 바뀌면 비운다 */
  autoApplied: AutoAppliedNotice[];
  /** 커서 비트 (lessonBeats로 해석). 없으면 null */
  beat: Beat | null;
  /** 내보내기·merge 거부 (kicked 이벤트, §5.8). §10.2 계약에 더해 덧붙인 필드 — §14 #81 */
  kicked: KickedPayload['reason'] | null;
  join(nickname: string): Promise<JoinAck>;
  dispatch(action: A): Promise<ActAck<S>>;
  /** 2초 간격으로 묶어 draft 이벤트로 전송. 제출 직전 flush는 훅이 한다(§5.4) */
  draft(data: D): void;
}

const tokenKey = (code: string) => `gg_token_${code}`;

/** hello에 실을 기기 종류(§5.1 DeviceKind). UA 기반 근사값 */
function detectDevice(): 'laptop' | 'tablet' | 'phone' {
  const ua = navigator.userAgent;
  if (/iPad|Tablet|Android(?!.*Mobile)/i.test(ua)) return 'tablet';
  if (/Mobi|iPhone|Android/i.test(ua)) return 'phone';
  return 'laptop';
}

export function useLive<S = unknown, A = unknown, D = unknown>(code: string): UseLiveResult<S, A, D> {
  const [status, setStatus] = useState<LiveStatus>('connecting');
  const [classState, setClassState] = useState<ClassState | null>(null);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [you, setYou] = useState<{ studentId: string; nickname: string } | null>(null);
  const [state, setState] = useState<S | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [autoApplied, setAutoApplied] = useState<AutoAppliedNotice[]>([]);
  const [kicked, setKicked] = useState<KickedPayload['reason'] | null>(null);

  const socketRef = useRef<StudentSocket<S, A, D> | null>(null);
  const classRef = useRef<ClassState | null>(null);
  const versionRef = useRef(-1);
  const beatKeyRef = useRef('');
  const pendingActRef = useRef(false);
  const seqRef = useRef(0);
  const draftRef = useRef<{ data: D | null; dirty: boolean; timer: number }>({ data: null, dirty: false, timer: 0 });

  classRef.current = classState;

  useEffect(() => {
    const socket = createStudentSocket<S, A, D>();
    socketRef.current = socket;
    versionRef.current = -1;
    beatKeyRef.current = '';

    const pushAutoApplied = (notices: AutoAppliedNotice[]) => setAutoApplied((prev) => [...prev, ...notices]);

    // 커서 비트가 바뀌면 지난 비트의 자동 처리 안내를 비운다
    const onClass = (next: ClassState) => {
      const key = `${next.cursor.segment}:${next.cursor.beat}`;
      if (beatKeyRef.current !== key) {
        beatKeyRef.current = key;
        setAutoApplied([]);
      }
    };

    const sendHello = () => {
      const token = localStorage.getItem(tokenKey(code));
      socket.emit('hello', { code, token: token ?? undefined, device: detectDevice() }, (ack: HelloAck) => {
        if (ack.ok) return; // snapshot이 status를 'open'으로 바꾼다
        localStorage.removeItem(tokenKey(code));
        setStatus(ack.reason === 'ended' ? 'ended' : 'not-found');
      });
    };

    socket.on('connect', sendHello);
    socket.on('snapshot', (p) => {
      versionRef.current = p.class.version;
      beatKeyRef.current = `${p.class.cursor.segment}:${p.class.cursor.beat}`;
      setClassState(p.class);
      setLesson(p.lesson);
      setYou(p.you ? { studentId: p.you.studentId, nickname: p.you.nickname } : null);
      setState((p.state ?? null) as S | null);
      setSubmitted(p.you?.done ?? false);
      if (p.autoApplied?.length) pushAutoApplied(p.autoApplied);
      setStatus((prev) => (prev === 'ended' || prev === 'not-found' ? prev : 'open'));
    });
    socket.on('class', (p) => {
      if (p.class.version < versionRef.current) return; // 낡은 메시지 조용히 버림(§5.3)
      versionRef.current = p.class.version;
      onClass(p.class);
      setClassState(p.class);
      if (p.class.status === 'ended') {
        localStorage.removeItem(tokenKey(code));
        setStatus('ended');
      }
    });
    socket.on('state', (p) => {
      if (p.version < versionRef.current) return;
      versionRef.current = p.version;
      setState((p.state ?? null) as S | null);
      setSubmitted(p.done);
      if (p.autoApplied?.length) pushAutoApplied(p.autoApplied);
    });
    socket.on('joined', (p) => {
      // merge 승인: 대기 소켓이 기록을 이어받았다(§5.8). snapshot이 이어서 온다
      localStorage.setItem(tokenKey(code), p.token);
      setYou({ studentId: p.studentId, nickname: p.nickname });
      setKicked(null);
    });
    socket.on('kicked', (p) => {
      localStorage.removeItem(tokenKey(code));
      setKicked(p.reason);
      setYou(null);
    });
    socket.on('disconnect', () => {
      setStatus((prev) => (prev === 'ended' || prev === 'not-found' ? prev : 'reconnecting'));
    });

    return () => {
      if (draftRef.current.timer) window.clearTimeout(draftRef.current.timer);
      draftRef.current = { data: null, dirty: false, timer: 0 };
      socket.disconnect();
      socketRef.current = null;
    };
  }, [code]);

  const sendDraft = useCallback(() => {
    const socket = socketRef.current;
    const cls = classRef.current;
    const d = draftRef.current;
    if (!d.dirty || d.data === null || !socket || !cls) return;
    d.dirty = false;
    socket.emit('draft', {
      beat: { segment: cls.cursor.segment, beat: cls.cursor.beat },
      data: d.data,
    });
  }, []);

  const draft = useCallback(
    (data: D) => {
      draftRef.current.data = data;
      draftRef.current.dirty = true;
      if (!draftRef.current.timer) {
        draftRef.current.timer = window.setTimeout(() => {
          draftRef.current.timer = 0;
          sendDraft();
        }, 2000);
      }
    },
    [sendDraft],
  );

  const join = useCallback(
    (nickname: string): Promise<JoinAck> =>
      new Promise((resolve) => {
        const socket = socketRef.current;
        if (!socket) {
          resolve({ ok: false, reason: 'join-locked' });
          return;
        }
        socket.emit('join', { nickname }, (ack: JoinAck) => {
          if (ack.ok) {
            localStorage.setItem(tokenKey(code), ack.token);
            setYou({ studentId: ack.studentId, nickname });
            setKicked(null);
          } else if (ack.reason === 'join-locked') {
            setStatus('join-locked');
          }
          resolve(ack);
        });
      }),
    [code],
  );

  const dispatch = useCallback(
    (action: A): Promise<ActAck<S>> =>
      new Promise((resolve) => {
        const socket = socketRef.current;
        const cls = classRef.current;
        if (!socket || !cls) {
          resolve({ ok: false, reason: 'server-error', message: '아직 수업에 연결되지 않았어요' });
          return;
        }
        if (pendingActRef.current) {
          // ack 전 다음 행동은 큐에 쌓지 않고 무시한다(터치 연타 방지, §10.2)
          resolve({ ok: false, reason: 'too-fast' });
          return;
        }
        pendingActRef.current = true;
        // 제출 직전 마지막 초안을 즉시 flush(§5.4)
        if (draftRef.current.timer) {
          window.clearTimeout(draftRef.current.timer);
          draftRef.current.timer = 0;
        }
        sendDraft();
        const payload: ActPayload<A> = {
          seq: (seqRef.current += 1),
          beat: { segment: cls.cursor.segment, beat: cls.cursor.beat },
          action,
        };
        socket.emit('act', payload, (ack: ActAck<unknown>) => {
          pendingActRef.current = false;
          const r = ack as ActAck<S>;
          if (r.ok) {
            versionRef.current = Math.max(versionRef.current, r.version);
            setState(r.state);
            setSubmitted(r.done);
          } else if (r.reason === 'class-ended') {
            localStorage.removeItem(tokenKey(code));
            setStatus('ended');
          }
          resolve(r);
        });
      }),
    [code, sendDraft],
  );

  const beat = useMemo<Beat | null>(() => {
    if (!lesson || !classState) return null;
    const seg = lessonBeats(lesson, beatsOf)[classState.cursor.segment];
    return seg?.beats[classState.cursor.beat] ?? null;
  }, [lesson, classState]);

  return { status, classState, lesson, you, state, submitted, autoApplied, beat, kicked, join, dispatch, draft };
}
