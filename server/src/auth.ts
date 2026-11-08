// 쿠키 서명·검증, 무차별 대입 제한, 클라이언트 IP (docs/live-api.md §6.3~6.4).
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import { parse, serialize } from 'cookie';

export type Role = 'stage' | 'control';

export const COOKIE_NAMES: Record<Role, string> = { stage: 'gg_stage', control: 'gg_control' };

/** 쿠키 만료 12시간 (§6.3 Max-Age=43200) */
export const COOKIE_TTL_MS = 12 * 60 * 60 * 1000;

/** 비밀번호 버전: sha256(비밀번호) 앞 8자리(16진수). 비밀번호를 바꾸면 기존 로그인이 모두 풀린다 (§6.3) */
export function pwVer(password: string): string {
  return createHash('sha256').update(password, 'utf8').digest('hex').slice(0, 8);
}

/** 길이가 달라도 안전한 비교: 양쪽 모두 sha256 다이제스트로 만들어 timingSafeEqual (§6.2) */
export function safeEqual(a: string, b: string): boolean {
  const da = createHash('sha256').update(a, 'utf8').digest();
  const db = createHash('sha256').update(b, 'utf8').digest();
  return timingSafeEqual(da, db);
}

/** 쿠키 값 `v<pwVer>.<role>.<exp>.<sig>` (§6.3). sig = HMAC-SHA256(secret, `${pwVer}.${role}.${exp}`) */
export function signCookieValue(secret: string, role: Role, password: string, now: number): string {
  const ver = pwVer(password);
  const exp = now + COOKIE_TTL_MS;
  const sig = createHmac('sha256', secret).update(`${ver}.${role}.${exp}`).digest('hex');
  return `v${ver}.${role}.${exp}.${sig}`;
}

export interface CookieCheck {
  valid: boolean;
}

/**
 * 쿠키 값을 검증한다. 서명 실패·만료·역할 불일치·pwVer 불일치는 전부 "로그인 없음"으로
 * 같게 취급한다 (§6.3 — 오류 구분 없음). secret은 서버의 COOKIE_SECRET, password는 현재
 * 해당 역할의 비밀번호 (pwVer 비교용).
 */
export function verifyCookieValue(
  secret: string,
  value: string | undefined,
  role: Role,
  password: string,
  now: number,
): boolean {
  if (!value) return false;
  const parts = value.split('.');
  if (parts.length !== 4) return false;
  const [v, r, expRaw, sig] = parts;
  if (v === undefined || r === undefined || expRaw === undefined || sig === undefined) return false;
  if (r !== role) return false;
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || exp <= now) return false;
  const ver = v.replace(/^v/, '');
  if (ver !== pwVer(password)) return false;
  const expected = createHmac('sha256', secret).update(`${ver}.${role}.${expRaw}`).digest('hex');
  return safeEqual(sig, expected);
}

/** 요청에서 역할 쿠키 원문 값을 꺼낸다 (소켓 핸드셰이크 헤더 포함). */
export function readCookieValue(headers: { cookie?: string | string[] | undefined }, role: Role): string | undefined {
  const raw = headers.cookie;
  if (!raw) return undefined;
  const cookieHeader = Array.isArray(raw) ? raw.join('; ') : raw;
  return parse(cookieHeader)[COOKIE_NAMES[role]];
}

export interface CookieSerdeOpts {
  secret: string;
  nodeEnv: 'production' | 'development';
}

/** 성공 응답의 Set-Cookie 헤더 값 (§6.3 속성). */
export function loginSetCookie(opts: CookieSerdeOpts, role: Role, password: string, now: number): string {
  return serialize(COOKIE_NAMES[role], signCookieValue(opts.secret, role, password, now), {
    httpOnly: true,
    secure: opts.nodeEnv === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: Math.floor(COOKIE_TTL_MS / 1000),
  });
}

/** 로그아웃: 쿠키 만료(Max-Age=0) (§6.3). */
export function logoutSetCookie(role: Role): string {
  return serialize(COOKIE_NAMES[role], '', {
    httpOnly: true,
    secure: false, // 만료 쿠키라 서명이 없다 — Secure 속성과 무관하게 지워지도록 한다
    sameSite: 'strict',
    path: '/',
    maxAge: 0,
  });
}

// ── 무차별 대입 방지 (§6.4) ────────────────────────────────────────────────

export interface LoginLimiterOpts {
  windowMs?: number; // 실패 기록 윈도 (기본 60초)
  maxFails?: number; // 윈도 안 최대 실패 (기본 5)
  blockMs?: number; // 잠금 시간 (기본 60초)
  now?: () => number;
}

/** 같은 IP에서 로그인 실패 5회/1분 → 60초간 429 (§6.4). */
export class LoginLimiter {
  private readonly fails = new Map<string, number[]>();
  private readonly blocked = new Map<string, number>();
  private readonly windowMs: number;
  private readonly maxFails: number;
  private readonly blockMs: number;
  private readonly now: () => number;

  constructor(opts: LoginLimiterOpts = {}) {
    this.windowMs = opts.windowMs ?? 60_000;
    this.maxFails = opts.maxFails ?? 5;
    this.blockMs = opts.blockMs ?? 60_000;
    this.now = opts.now ?? Date.now;
  }

  /** 지금 이 IP가 로그인을 시도해도 되는지 (잠금 중이면 false → 429) */
  allowed(ip: string): boolean {
    const until = this.blocked.get(ip);
    if (until === undefined) return true;
    if (this.now() < until) return false;
    this.blocked.delete(ip);
    this.fails.delete(ip);
    return true;
  }

  fail(ip: string): void {
    const now = this.now();
    const list = (this.fails.get(ip) ?? []).filter((t) => now - t < this.windowMs);
    list.push(now);
    this.fails.set(ip, list);
    if (list.length >= this.maxFails) {
      this.blocked.set(ip, now + this.blockMs);
      this.fails.delete(ip);
    }
  }

  success(ip: string): void {
    this.fails.delete(ip);
    this.blocked.delete(ip);
  }
}

// ── 클라이언트 IP (§6.4) ──────────────────────────────────────────────────

function normalizeIp(addr: string | undefined): string {
  if (!addr) return '';
  return addr.replace(/^::ffff:/, '');
}

/**
 * 클라이언트 IP. 기본은 소켓 원격 주소이고, TRUSTED_PROXY가 설정돼 있고 요청이
 * 그 주소에서 왔을 때만 X-Forwarded-For의 **마지막** 값을 쓴다 (§6.4).
 */
export function clientIp(req: IncomingMessage, trustedProxy: string | null): string {
  const remote = normalizeIp(req.socket.remoteAddress);
  if (trustedProxy && remote && normalizeIp(trustedProxy) === remote) {
    const xff = req.headers['x-forwarded-for'];
    if (typeof xff === 'string' && xff.trim()) {
      const parts = xff.split(',').map((s) => s.trim()).filter(Boolean);
      const last = parts.at(-1);
      if (last) return last;
    }
  }
  return remote;
}
