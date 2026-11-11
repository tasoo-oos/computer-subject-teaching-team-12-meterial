// 로그인 게이트 + 비밀번호 화면 (docs/live-api.md §10.7, §6).
// /stage·/control·/dev는 앱 시작 시 GET /api/me로 확인하고, role이 아니면 비밀번호 입력 화면을 보여 준다.
// 제출 → POST /api/login → 성공 시 같은 경로 다시 렌더링(retry). 429면 "잠시 후 다시" 안내.
import { useCallback, useEffect, useState } from 'react';
import { KeyRound } from 'lucide-react';

export type Role = 'stage' | 'control';

export interface LoginGate {
  checking: boolean;
  role: Role | null;
  /** api에 닿을 수 없을 때(게임 서버 없음 등). 친절한 안내 문구로 쓴다 */
  offline: boolean;
  /** 로그인 성공 등의 순간 다시 확인 */
  retry: () => void;
}

/** GET /api/me로 역할 확인 (200 { role, roles } | 실패). 게이트는 이 페이지의 역할 쿠키가 유효한지(roles)로 판정한다 —
 *  통제로 로그인한 브라우저에서 /stage를 열면 role은 'control'이라 role만 보면 전면 로그인이 끝나지 않는다(§14 #167).
 *  무효한(오래된) 쿠키는 서버가 이 응답에서 지운다. me의 값은 '이 페이지 역할로 로그인했으면 그 역할, 아니면 null' */
export function useLoginGate(role: Role): LoginGate {
  const [checking, setChecking] = useState(true);
  const [me, setMe] = useState<Role | null>(null);
  const [offline, setOffline] = useState(false);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setChecking(true);
    fetch('/api/me', { credentials: 'same-origin' })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        const body = (await res.json()) as { role: Role | null; roles?: Role[] };
        const roles = body.roles ?? (body.role ? [body.role] : []);
        if (!cancelled) {
          setMe(roles.includes(role) ? role : null);
          setOffline(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMe(null);
          setOffline(true);
        }
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [nonce, role]);

  const retry = useCallback(() => setNonce((n) => n + 1), []);
  return { checking, role: me, offline, retry };
}

const ROLE_LABEL: Record<Role, string> = { stage: '전면(TV)', control: '통제(교사)' };

export function GateChecking() {
  return (
    <div className="paper-texture grid min-h-dvh place-items-center">
      <p className="text-[15px] text-ink-2">확인하는 중…</p>
    </div>
  );
}

/** 비밀번호 입력 화면. offline이면 서버 연결 문구를 먼저 보여 준다 */
export function LoginScreen({ role, offline, onSuccess }: { role: Role; offline?: boolean; onSuccess: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ role, password }),
      });
      if (res.ok) {
        onSuccess();
        return;
      }
      if (res.status === 429) setError('시도가 많아 일시적으로 막혔어요. 잠시(1분) 후 다시 시도해 주세요.');
      else if (res.status === 401)
        setError(
          role === 'stage'
            ? '비밀번호가 맞지 않아요. 전면(TV) 비밀번호를 넣어 주세요 — 통제(교사) 비밀번호와 다릅니다.'
            : '비밀번호가 맞지 않아요. 다시 확인해 주세요.',
        );
      else setError(`로그인에 실패했어요 (${res.status}). 잠시 후 다시 시도해 주세요.`);
    } catch {
      setError('서버에 연결할 수 없어요. 네트워크를 확인하고 잠시 후 다시 시도해 주세요.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="paper-texture grid min-h-dvh place-items-center px-5">
      <form onSubmit={submit} className="w-full max-w-[26rem] rounded-panel bg-sheet p-6 shadow-[0_0_0_1px_var(--color-rule),0_20px_40px_-30px_rgba(24,38,74,.5)] sm:p-8">
        <p className="flex items-center gap-2 text-[15px] font-semibold text-ink-2">
          <KeyRound size={18} aria-hidden />
          {ROLE_LABEL[role]} 로그인
        </p>
        <h1 className="display mt-2 text-[33px]">비밀번호를 입력하세요</h1>
        <label className="mt-5 block">
          <span className="mb-1.5 block text-[15px] font-semibold">비밀번호</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            autoFocus
            className="h-12 w-full rounded-[8px] bg-white px-3.5 text-[17px] shadow-[inset_0_0_0_1.5px_var(--color-rule)] focus:shadow-[inset_0_0_0_2px_var(--color-ink)]"
          />
        </label>
        {offline ? (
          <p className="mt-3 rounded-[8px] bg-mark/70 px-3.5 py-2.5 text-[14px]">지금 서버에 연결할 수 없어요. 게임 서버가 켜져 있는지 확인해 주세요.</p>
        ) : null}
        {error ? (
          <p role="alert" className="mt-3 rounded-[8px] bg-seal-soft px-3.5 py-2.5 text-[14px] text-seal">
            {error}
          </p>
        ) : null}
        <button type="submit" disabled={busy || password.length === 0} className="btn btn-primary mt-5 h-12 w-full text-[17px]">
          {busy ? '확인 중…' : '들어가기'}
        </button>
      </form>
    </div>
  );
}
