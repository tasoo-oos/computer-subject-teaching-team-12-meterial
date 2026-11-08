// 소켓 팩토리 (docs/live-api.md §5.2). 같은 origin으로 연결한다 — 역할 쿠키(HttpOnly)는 자동으로 실린다.
// 재접속은 Socket.IO 내장 자동 재접속을 그대로 쓴다(§10.2).
import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@gagyebu/live';

/** 학생 소켓: 쿠키 없음, hello → snapshot으로 시작(§5.2) */
export type StudentSocket<S = unknown, A = unknown, D = unknown> = Socket<ServerToClientEvents<S, unknown>, ClientToServerEvents<A, D>>;

/** 전면·통제 소켓: 연결 쿼리 role으로 역할을 밝히고(§14 S2-#66) 쿠키(gg_stage/gg_control)를 검증받는다.
 *  hello 없이 snapshot을 바로 받는다. 열린 수업이 없으면 snapshot 대신 classes만 받는다(§14 S2-#67). */
export type RoleSocket<S = unknown, St = unknown> = Socket<ServerToClientEvents<S, St>, ClientToServerEvents<unknown, unknown>>;

export function createStudentSocket<S = unknown, A = unknown, D = unknown>(): StudentSocket<S, A, D> {
  return io({ withCredentials: true }) as unknown as StudentSocket<S, A, D>;
}

export function createRoleSocket<S = unknown, St = unknown>(role: 'stage' | 'control'): RoleSocket<S, St> {
  return io({ withCredentials: true, query: { role } }) as unknown as RoleSocket<S, St>;
}
