// /api/* 라우트 (docs/live-api.md §6.1~6.5): login, logout, me, CSV 내보내기.
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ClassCode } from '@gagyebu/live';
import type { Env } from './env.ts';
import {
  LoginLimiter,
  clientIp,
  loginSetCookie,
  logoutSetCookie,
  readCookieValue,
  safeEqual,
  verifyCookieValue,
  type Role,
} from './auth.ts';
import type { Room } from './room.ts';

export interface HttpCtx {
  env: Env;
  limiter: LoginLimiter;
  rooms: Map<ClassCode, Room>;
  now?: () => number;
}

const MAX_BODY = 8 * 1024;

/** /api/* 요청을 처리한다. true를 반환하면 응답 완료. */
export async function handleApi(req: IncomingMessage, res: ServerResponse, ctx: HttpCtx, pathname: string): Promise<boolean> {
  const now = ctx.now ?? Date.now;
  if (!pathname.startsWith('/api/')) return false;

  if (req.method === 'POST' && pathname === '/api/login') {
    await handleLogin(req, res, ctx, now());
    return true;
  }
  if (req.method === 'POST' && pathname === '/api/logout') {
    await handleLogout(req, res, ctx, now());
    return true;
  }
  if (req.method === 'GET' && pathname === '/api/me') {
    handleMe(req, res, ctx, now());
    return true;
  }
  const exportMatch = /^\/api\/export\/([0-9]{4})\.csv$/.exec(pathname);
  if (req.method === 'GET' && exportMatch) {
    await handleExport(req, res, ctx, exportMatch[1] ?? '');
    return true;
  }

  sendJson(res, 404, { error: 'not-found' });
  return true;
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY) throw new Error('body-too-large');
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(json),
  });
  res.end(json);
}

function rolePassword(ctx: HttpCtx, role: Role): string {
  return role === 'stage' ? ctx.env.stagePassword : ctx.env.controlPassword;
}

// POST /api/login (§6.3): 200 { role } + Set-Cookie / 401 / 429.
async function handleLogin(req: IncomingMessage, res: ServerResponse, ctx: HttpCtx, now: number): Promise<void> {
  const ip = clientIp(req, ctx.env.trustedProxy);
  if (!ctx.limiter.allowed(ip)) {
    sendJson(res, 429, { error: 'too-many-failures' });
    return;
  }
  let body: { role?: unknown; password?: unknown };
  try {
    body = JSON.parse(await readBody(req)) as { role?: unknown; password?: unknown };
  } catch {
    sendJson(res, 400, { error: 'bad-request' });
    return;
  }
  const role = body.role;
  const password = body.password;
  if (
    (role !== 'stage' && role !== 'control') ||
    typeof password !== 'string'
  ) {
    ctx.limiter.fail(ip);
    sendJson(res, 401, { error: 'unauthorized' });
    return;
  }
  // timingSafeEqual로 비교 — 성공/실패 응답 시간이 같다(§6.2).
  if (!safeEqual(password, rolePassword(ctx, role))) {
    ctx.limiter.fail(ip);
    sendJson(res, 401, { error: 'unauthorized' });
    return;
  }
  ctx.limiter.success(ip);
  res.writeHead(200, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'set-cookie': loginSetCookie(
      { secret: ctx.env.cookieSecret, nodeEnv: ctx.env.nodeEnv },
      role,
      rolePassword(ctx, role),
      now,
    ),
  });
  res.end(JSON.stringify({ role }));
}

// POST /api/logout (§6.3): 로그인된 역할의 쿠키 만료.
async function handleLogout(req: IncomingMessage, res: ServerResponse, ctx: HttpCtx, now: number): Promise<void> {
  let body: { role?: unknown };
  try {
    body = JSON.parse(await readBody(req)) as { role?: unknown };
  } catch {
    sendJson(res, 400, { error: 'bad-request' });
    return;
  }
  const role = body.role;
  if (role !== 'stage' && role !== 'control') {
    sendJson(res, 401, { error: 'unauthorized' });
    return;
  }
  const value = readCookieValue(req.headers, role);
  if (!verifyCookieValue(ctx.env.cookieSecret, value, role, rolePassword(ctx, role), now)) {
    sendJson(res, 401, { error: 'unauthorized' });
    return;
  }
  res.writeHead(200, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'set-cookie': logoutSetCookie(role),
  });
  res.end('{}');
}

// GET /api/me (§6.1): 200 { role: 'stage' | 'control' | null }. control 쿠키가 우선한다.
function handleMe(req: IncomingMessage, res: ServerResponse, ctx: HttpCtx, now: number): void {
  let role: Role | null = null;
  for (const candidate of ['control', 'stage'] as const) {
    const value = readCookieValue(req.headers, candidate);
    if (verifyCookieValue(ctx.env.cookieSecret, value, candidate, rolePassword(ctx, candidate), now)) {
      role = candidate;
      break;
    }
  }
  sendJson(res, 200, { role });
}

// GET /api/export/<code>.csv (§8.5): 통제 쿠키 필수. 활동 계약으로 CSV를 조립한다.
async function handleExport(req: IncomingMessage, res: ServerResponse, ctx: HttpCtx, code: string): Promise<void> {
  const value = readCookieValue(req.headers, 'control');
  const ok = verifyCookieValue(ctx.env.cookieSecret, value, 'control', ctx.env.controlPassword, (ctx.now ?? Date.now)());
  if (!ok) {
    sendJson(res, 401, { error: 'unauthorized' });
    return;
  }
  const room = ctx.rooms.get(code);
  if (!room) {
    sendJson(res, 404, { error: 'not-found' });
    return;
  }
  const csv = room.exportCsv();
  if (csv === null) {
    sendJson(res, 404, { error: 'not-found' }); // 내보낼 활동이 없는 레슨
    return;
  }
  const body = `\uFEFF${csv}`; // BOM(§8.5)
  res.writeHead(200, {
    'content-type': 'text/csv; charset=utf-8',
    'cache-control': 'no-store',
    'content-disposition': `attachment; filename="${code}.csv"`,
    'content-length': Buffer.byteLength(body),
  });
  res.end(body);
}
