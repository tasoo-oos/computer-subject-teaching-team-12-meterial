// 쿠키 서명·검증·pwVer, 무차별 대입 429, XFF 신뢰 (docs/live-api.md §6.3~6.4).
import { describe, expect, it } from 'vitest';
import type { IncomingMessage } from 'node:http';
import {
  COOKIE_TTL_MS,
  LoginLimiter,
  clientIp,
  loginSetCookie,
  logoutSetCookie,
  pwVer,
  signCookieValue,
  verifyCookieValue,
} from './auth.ts';

const SECRET = '0123456789abcdef0123456789abcdef';

describe('pwVer (§6.3)', () => {
  it('sha256 앞 8자리(16진수), 비밀번호마다 다르다', () => {
    expect(pwVer('stage-pw')).toMatch(/^[0-9a-f]{8}$/);
    expect(pwVer('a')).not.toBe(pwVer('b'));
    expect(pwVer('a')).toBe(pwVer('a'));
  });
});

describe('쿠키 서명·검증 (§6.3)', () => {
  const now = 1_700_000_000_000;

  it('서명된 쿠키는 검증을 통과한다', () => {
    const value = signCookieValue(SECRET, 'control', 'pw', now);
    expect(value).toMatch(/^v[0-9a-f]{8}\.control\.\d+\.[0-9a-f]{64}$/);
    expect(verifyCookieValue(SECRET, value, 'control', 'pw', now + 1000)).toBe(true);
  });

  it('서명 위조·역할 불일치·만료·비밀번호 변경은 모두 "로그인 없음"', () => {
    const value = signCookieValue(SECRET, 'control', 'pw', now);
    // 위조 서명
    expect(verifyCookieValue(SECRET, `${value.slice(0, -2)}ff`, 'control', 'pw', now)).toBe(false);
    // 다른 secret
    expect(verifyCookieValue('another-secret-32-chars-long-abcdefgh', value, 'control', 'pw', now)).toBe(false);
    // 역할 불일치
    expect(verifyCookieValue(SECRET, value, 'stage', 'pw', now)).toBe(false);
    // 만료
    expect(verifyCookieValue(SECRET, value, 'control', 'pw', now + COOKIE_TTL_MS + 1)).toBe(false);
    // 비밀번호 변경 → pwVer 불일치 → 전원 로그아웃(§6.3)
    expect(verifyCookieValue(SECRET, value, 'control', 'new-pw', now)).toBe(false);
    // 빈 값·모양이 다른 값
    expect(verifyCookieValue(SECRET, undefined, 'control', 'pw', now)).toBe(false);
    expect(verifyCookieValue(SECRET, 'garbage', 'control', 'pw', now)).toBe(false);
  });

  it('Set-Cookie 속성: HttpOnly·SameSite=Strict·Path=/·Max-Age=43200·(production Secure)', () => {
    const prod = loginSetCookie({ secret: SECRET, nodeEnv: 'production' }, 'stage', 'pw', now);
    expect(prod).toContain('gg_stage=');
    expect(prod).toContain('HttpOnly');
    expect(prod).toContain('SameSite=Strict');
    expect(prod).toContain('Path=/');
    expect(prod).toContain('Max-Age=43200');
    expect(prod).toContain('Secure');
    const dev = loginSetCookie({ secret: SECRET, nodeEnv: 'development' }, 'stage', 'pw', now);
    expect(dev).not.toContain('Secure');
    const logout = logoutSetCookie('stage');
    expect(logout).toContain('Max-Age=0');
  });
});

describe('무차별 대입 방지 (§6.4)', () => {
  it('같은 IP 실패 5회/1분 → 60초 429, 성공은 카운터 초기화', () => {
    let t = 0;
    const limiter = new LoginLimiter({ now: () => t });
    for (let i = 0; i < 4; i++) {
      expect(limiter.allowed('1.2.3.4')).toBe(true);
      limiter.fail('1.2.3.4');
    }
    expect(limiter.allowed('1.2.3.4')).toBe(true); // 5번째 시도는 허용
    limiter.fail('1.2.3.4');
    expect(limiter.allowed('1.2.3.4')).toBe(false); // 잠금
    t = 59_999;
    expect(limiter.allowed('1.2.3.4')).toBe(false);
    t = 60_001;
    expect(limiter.allowed('1.2.3.4')).toBe(true); // 잠금 해제

    // 윈도 밖 실패는 누적되지 않는다
    let t2 = 0;
    const limiter2 = new LoginLimiter({ now: () => t2 });
    limiter2.fail('5.6.7.8');
    t2 = 61_000;
    limiter2.fail('5.6.7.8');
    limiter2.fail('5.6.7.8');
    limiter2.fail('5.6.7.8');
    limiter2.fail('5.6.7.8'); // 오래된 것은 만료 — 아직 4개
    expect(limiter2.allowed('5.6.7.8')).toBe(true);

    // 다른 IP는 독립
    const limiter3 = new LoginLimiter();
    for (let i = 0; i < 5; i++) limiter3.fail('9.9.9.9');
    expect(limiter3.allowed('8.8.8.8')).toBe(true);
    limiter3.success('9.9.9.9');
    expect(limiter3.allowed('9.9.9.9')).toBe(true);
  });
});

describe('클라이언트 IP·XFF (§6.4)', () => {
  function req(remote: string, xff?: string): IncomingMessage {
    return {
      socket: { remoteAddress: remote },
      headers: xff === undefined ? {} : { 'x-forwarded-for': xff },
    } as unknown as IncomingMessage;
  }

  it('TRUSTED_PROXY가 없으면 소켓 주소를 쓴다', () => {
    expect(clientIp(req('192.168.0.5', '1.1.1.1'), null)).toBe('192.168.0.5');
  });

  it('신뢰한 프록시에서 온 요청만 XFF의 마지막 값을 쓴다', () => {
    expect(clientIp(req('10.10.2.21', '203.0.113.9, 10.10.2.21'), '10.10.2.21')).toBe('10.10.2.21');
    expect(clientIp(req('::ffff:10.10.2.21', '203.0.113.9'), '10.10.2.21')).toBe('203.0.113.9');
    // 신뢰하지 않은 주소의 XFF는 무시
    expect(clientIp(req('192.168.0.5', '1.1.1.1'), '10.10.2.21')).toBe('192.168.0.5');
  });
});
