// 테스트용 socket.io-client 로더. 앱 패키지(src)의 의존성을 빌려 쓴다 —
// 서버 package.json은 고칠 수 없고(§1.4, S0 소유) socket.io-client는 앱 패키지에만 있다.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

/** 느슨한 클라이언트 소켓 타입(테스트에서 이벤트·ack를 주고받기에 충분) */
export interface ClientSocket {
  id?: string;
  connected: boolean;
  on(event: string, fn: (...args: never[]) => void): void;
  once(event: string, fn: (...args: never[]) => void): void;
  removeListener(event: string, fn: (...args: never[]) => void): void;
  emit(event: string, ...args: unknown[]): void;
  emitWithAck(event: string, ...args: unknown[]): Promise<unknown>;
  connect(): void;
  disconnect(): void;
  close(): void;
}

const require = createRequire(import.meta.url);
// server/src/testutil/ → ../../../ = 저장소 루트 → src/node_modules/socket.io-client
const clientPath = fileURLToPath(new URL('../../../src/node_modules/socket.io-client', import.meta.url));
const { io } = require(clientPath) as {
  io: (url: string, opts?: Record<string, unknown>) => ClientSocket;
};

/** 테스트 소켓 연결. opts: { query, extraHeaders, transports } 등 socket.io-client 옵션 그대로. */
export function connect(url: string, opts: Record<string, unknown> = {}): ClientSocket {
  return io(url, { transports: ['websocket'], reconnection: false, ...opts });
}

/** 소켓 이벤트를 Promise로 기다린다. 타임아웃(기본 2초)에 걸리면 reject. */
export function onceEvent<T = unknown>(socket: ClientSocket, event: string, timeoutMs = 2000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.removeListener?.(event, handler);
      reject(new Error(`이벤트 대기 시간 초과: ${event}`));
    }, timeoutMs);
    const handler = (...args: never[]) => {
      clearTimeout(timer);
      resolve(args.length <= 1 ? (args[0] as T) : (args as unknown as T));
    };
    socket.once(event, handler);
  });
}

/** ack 기반 emit을 Promise로. */
export function emitAck<T = unknown>(socket: ClientSocket, event: string, ...args: unknown[]): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`ack 대기 시간 초과: ${event}`)), 5000);
    socket.emit(event, ...args, (result: T) => {
      clearTimeout(timer);
      resolve(result);
    });
  });
}

/** 조건이 참이 될 때까지 폴링 대기. */
export async function waitFor(cond: () => boolean, timeoutMs = 5000, stepMs = 10): Promise<void> {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > timeoutMs) throw new Error('대기 조건 시간 초과');
    await new Promise((r) => setTimeout(r, stepMs));
  }
}
