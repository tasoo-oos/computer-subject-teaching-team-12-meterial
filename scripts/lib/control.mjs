// 통제(교사) 소켓 공용 조각 — bots:public과 scripts/open-class.mjs가 함께 쓴다.
// 앱 패키지(src)의 socket.io-client를 쓴다(서버 의존성에는 없다, docs/live-api.md §1.4).
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const require = createRequire(import.meta.url);
const { io } = require(join(root, 'src/node_modules/socket.io-client'));

/** 통제 비밀번호로 로그인해 쿠키 문자열을 받는다. */
export async function loginControl(base, password) {
  const res = await fetch(`${base}/api/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ role: 'control', password }),
  });
  if (res.status >= 500) {
    throw new Error(`통제 로그인 실패: ${res.status} — 뒤의 게임 서버가 없습니다(서버를 먼저 띄우세요).`);
  }
  if (!res.ok) throw new Error(`통제 로그인 실패: ${res.status} — 통제 비밀번호를 확인하세요.`);
  const cookie = res.headers.getSetCookie().find((c) => c.startsWith('gg_control='));
  if (!cookie) throw new Error('통제 로그인 응답에 쿠키가 없습니다.');
  return cookie;
}

/** 수업을 열고 발급된 코드를 돌려준다. 실패는 예외로 올린다. */
export async function openClass(base, password, { timeoutMs = 5000 } = {}) {
  const cookie = await loginControl(base, password);
  const socket = io(base, { query: { role: 'control' }, extraHeaders: { Cookie: cookie } });
  try {
    return await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('수업 열기 응답 없음(통제 소켓)')), timeoutMs);
      socket.on('connect', () => {
        socket.emit('openClass', {}, (r) => {
          clearTimeout(timer);
          if (r?.ok) resolve(r.code);
          else reject(new Error(`수업 열기 실패: ${r?.reason ?? 'unknown'}`));
        });
      });
      socket.on('connect_error', (err) => {
        clearTimeout(timer);
        reject(new Error(`통제 소켓 연결 실패: ${err.message}`));
      });
    });
  } finally {
    socket.disconnect();
  }
}
