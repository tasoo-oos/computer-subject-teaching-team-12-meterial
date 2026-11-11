// HTTP 라우트·캐시·로그인·무차별 대입·CSV 내보내기 (docs/live-api.md §6, §8.5).
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Env } from './env.ts';
import type { RunningServer } from './main.ts';
import { fakeSocket } from './testutil/helpers.ts';
import { cleanupTemp, loginControl, startTestServer } from './testutil/server.ts';
import { testLesson } from './testutil/fake.ts';

let server: RunningServer;
let url: string;

beforeEach(async () => {
  ({ server, url } = await startTestServer());
});

afterEach(async () => {
  await server.close();
  cleanupTemp();
});

function head(path: string, headers: Record<string, string> = {}) {
  return fetch(`${url}${path}`, { method: 'HEAD', headers });
}

describe('라우트 표·404 정책·캐시 헤더 (§6.1, §6.5)', () => {
  it('/ · /<4자리> · /stage · /control · /dev는 index.html no-store', async () => {
    for (const path of ['/', '/4821', '/stage', '/control', '/dev']) {
      const res = await head(path);
      expect(res.status, path).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/html');
      expect(res.headers.get('cache-control')).toBe('no-store');
    }
  });

  it('/solo는 SOLO_ENABLED=false면 404 (§14 #25)', async () => {
    expect((await head('/solo')).status).toBe(404);
  });

  it('오타 경로·빈 코드·5자리 코드는 404 — 앱 폴백 없음', async () => {
    for (const path of ['/contorl', '/stag', '/12345', '/123', '/abcd', '/api/unknown', '/deep/nested/path']) {
      expect((await head(path)).status, path).toBe(404);
    }
  });

  it('/assets/*는 immutable 캐시, 없는 파일은 404, 경로 조작은 404', async () => {
    const res = await head('/assets/app-Bq3xK9.js');
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
    expect((await head('/assets/missing.js')).status).toBe(404);
    expect((await head('/assets/%2e%2e/%2e%2e/package.json')).status).toBe(404);
  });
});

describe('로그인·me·logout (§6.3)', () => {
  it('틀린 비밀번호 401, 맞으면 200 + Set-Cookie, /api/me가 반영한다', async () => {
    const bad = await fetch(`${url}/api/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ role: 'control', password: 'wrong' }),
    });
    expect(bad.status).toBe(401);

    const me0 = (await (await fetch(`${url}/api/me`)).json()) as { role: string | null };
    expect(me0.role).toBeNull();

    const ok = await fetch(`${url}/api/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ role: 'control', password: 'control-pw' }),
    });
    expect(ok.status).toBe(200);
    expect(((await ok.json()) as { role: string }).role).toBe('control');
    const setCookie = ok.headers.getSetCookie();
    expect(setCookie.some((c) => c.startsWith('gg_control='))).toBe(true);
    const cookie = setCookie.find((c) => c.startsWith('gg_control='))!;

    const me = (await (await fetch(`${url}/api/me`, { headers: { cookie } })).json()) as { role: string | null };
    expect(me.role).toBe('control');

    // logout은 쿠키를 만료한다
    const out = await fetch(`${url}/api/logout`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ role: 'control' }),
    });
    expect(out.status).toBe(200);
    const expired = out.headers.getSetCookie().find((c) => c.startsWith('gg_control='));
    expect(expired).toContain('Max-Age=0');
    // 쿠키는 상태가 없다(§6.3): 로그아웃은 브라우저가 쿠키를 지우는 것.
    // 서버 재검증까지 무효화하는 방법은 비밀번호 변경(pwVer)뿐이다.
  });

  it('/api/me는 유효한 역할 쿠키를 모두 roles로 알려 주고, 무효한 쿠키는 지운다 (§14 #167)', async () => {
    const login = async (role: 'stage' | 'control', password: string) => {
      const res = await fetch(`${url}/api/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ role, password }),
      });
      return res.headers.getSetCookie().find((c) => c.startsWith(`gg_${role}=`))!.split(';')[0]!;
    };
    const control = await login('control', 'control-pw');
    const stage = await login('stage', 'stage-pw');
    // 통제·전면 둘 다 로그인한 브라우저: role은 예전처럼 control, roles에는 둘 다
    const both = (await (await fetch(`${url}/api/me`, { headers: { cookie: `${control}; ${stage}` } })).json()) as {
      role: string | null;
      roles: string[];
    };
    expect(both).toEqual({ role: 'control', roles: ['control', 'stage'] });

    // 다른 서버(다른 COOKIE_SECRET)가 남긴 전면 쿠키: 무효 → roles에 없고 응답이 그 쿠키를 만료시킨다
    const stale = 'gg_stage=v00000000.stage.9999999999999.deadbeef';
    const res = await fetch(`${url}/api/me`, { headers: { cookie: `${control}; ${stale}` } });
    expect(await res.json()).toEqual({ role: 'control', roles: ['control'] });
    const cleared = res.headers.getSetCookie();
    expect(cleared).toHaveLength(1);
    expect(cleared[0]).toMatch(/^gg_stage=;/);
    expect(cleared[0]).toContain('Max-Age=0');

    // 쿠키가 없으면 지울 것도 없다
    const none = await fetch(`${url}/api/me`);
    expect(await none.json()).toEqual({ role: null, roles: [] });
    expect(none.headers.getSetCookie()).toHaveLength(0);
  });

  it('stage 비밀번호로 stage 쿠키를 받는다', async () => {
    const res = await fetch(`${url}/api/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ role: 'stage', password: 'stage-pw' }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.getSetCookie().some((c) => c.startsWith('gg_stage='))).toBe(true);
  });

  it('무차별 대입: 같은 IP 실패 5회 → 60초 429 (§6.4)', async () => {
    const body = JSON.stringify({ role: 'control', password: 'nope' });
    for (let i = 0; i < 5; i++) {
      const res = await fetch(`${url}/api/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
      });
      expect(res.status).toBe(401);
    }
    const blocked = await fetch(`${url}/api/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ role: 'control', password: 'control-pw' }), // 맞아도 잠금
    });
    expect(blocked.status).toBe(429);
  });
});

describe('CSV 내보내기 (§8.5)', () => {
  it('통제 쿠키 필요: 401/404/200 + BOM·이스케이프', async () => {
    // 수업을 열고 학생을 넣는다
    const opened = await server.openClass(testLesson.id);
    if (!opened.ok) throw new Error('openClass 실패');
    const room = server.rooms.get(opened.code)!;
    await room.joinStudent(fakeSocket(), { nickname: 'a,b' }); // 쉼표 닉네임 → 이스케이프 검증
    await room.joinStudent(fakeSocket(), { nickname: 'plain' });

    const code = opened.code;
    expect((await fetch(`${url}/api/export/${code}.csv`)).status).toBe(401); // 쿠키 없음
    expect((await fetch(`${url}/api/export/9999.csv`)).status).toBe(401); // 통제 쿠키 없으면 코드 무관 401

    const cookie = await loginControl(url);

    expect((await fetch(`${url}/api/export/9999.csv`, { headers: { cookie } })).status).toBe(404); // 없는 코드

    const res = await fetch(`${url}/api/export/${code}.csv`, { headers: { cookie } });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/csv');
    const buf = new Uint8Array(await res.arrayBuffer());
    expect([buf[0], buf[1], buf[2]]).toEqual([0xef, 0xbb, 0xbf]); // BOM(§8.5)
    const text = new TextDecoder('utf-8').decode(buf.slice(3));
    const lines = text.split(/\r?\n/).filter(Boolean);
    expect(lines[0]).toBe('studentId,nickname,count,marks');
    expect(lines.some((l) => l.includes('"a,b"'))).toBe(true); // 쉼표 이스케이프
    expect(lines.some((l) => l.includes('plain'))).toBe(true);
  });
});

describe('SOLO_ENABLED=true면 /solo 200', () => {
  it('정적 라우트에 solo가 추가된다', async () => {
    await server.close();
    ({ server, url } = await startTestServer({ soloEnabled: true } satisfies Partial<Env>));
    const res = await head('/solo');
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
  });
});
