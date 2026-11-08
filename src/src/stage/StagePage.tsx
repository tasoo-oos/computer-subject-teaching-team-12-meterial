// /stage 전면(TV) 페이지 (docs/live-api.md §10.5). 로그인 게이트 → 본판(StageShell) 구조(§14 S3-#88):
// useRoleLive는 게이트를 통과한 뒤에만 마운트한다. 로그인 전 소켓이 먼저 연결되면 서버가 쿠키 없는
// 연결을 끊고(§14 S2-#66) socket.io는 서버가 끊은 연결을 자동 재접속하지 않아 로그인 뒤에도
// 소켓이 죽어 있기 때문이다.
// 본판: 열린 수업 없음 → "수업 준비 중" 대기, 여럿 → 수업 고르기(유일한 조작 상태),
// 그 외 → StageFrame(레터박스) 안의 StageContent. 로그인 뒤에는 버튼·조작 요소가 없다.
import { useEffect, useState } from 'react';
import type { OpenClassInfo } from '@gagyebu/live';
import { GateChecking, LoginScreen, useLoginGate } from '../live/LoginScreen.tsx';
import { ReconnectBanner } from '../live/banner.tsx';
import { useRoleLive } from '../live/useRoleLive.ts';
import { useWakeLock } from '../live/useWakeLock.ts';
import { StageFrame } from './ScaledSurface.tsx';
import { StageContent, StageMessage } from './StageContent.tsx';

export function StagePage() {
  const gate = useLoginGate('stage');
  // 소켓이 unauthorized를 알리면(쿠키 만료 등) 다시 비밀번호 화면으로
  const [forceLogin, setForceLogin] = useState(false);
  if (gate.checking) return <GateChecking />;
  if (gate.role !== 'stage' || forceLogin) {
    return (
      <LoginScreen
        role="stage"
        offline={gate.offline}
        onSuccess={() => {
          setForceLogin(false);
          gate.retry();
        }}
      />
    );
  }
  return <StageShell onUnauthorized={() => setForceLogin(true)} />;
}

function StageShell({ onUnauthorized }: { onUnauthorized: () => void }) {
  const role = useRoleLive('stage');
  useWakeLock(); // TV 화면 꺼짐 방지(지원 브라우저에서만, §10.3)
  // 전면 고르기: 서버는 연결 때 가장 최근 수업을 자동 선택해 snapshot을 보내지만(§14 S2-#67),
  // 열린 수업이 여럿이면 TV 앞에서 직접 고르게 한다(§10.5 "여럿이면 고르기" — 유일한 조작 상태).
  // 한 번 고르면 이후 새로 열리는 수업 때문에 다시 뜨지 않는다.
  const [picked, setPicked] = useState(false);
  const pick = (code: string) => {
    setPicked(true);
    void role.select(code);
  };

  useEffect(() => {
    if (role.status === 'unauthorized') onUnauthorized();
  }, [role.status, onUnauthorized]);

  const cls = role.classState;
  const chooser =
    (!picked && role.classes.length > 1) || // 연결 때 여럿 열려 있음
    (cls?.status === 'ended' && role.classes.length > 0); // 보던 수업이 끝나고 다른 수업이 열려 있음

  return (
    <>
      <ReconnectBanner show={role.status === 'reconnecting'} />
      {role.status === 'connecting' ? (
        <StageWaitingScreen title="수업 서버에 연결하는 중…" />
      ) : chooser ? (
        <StageChooser classes={role.classes} current={cls?.code} onPick={pick} />
      ) : !cls ? (
        <StageWaitingScreen title="수업 준비 중" sub="선생님이 수업을 열면 이 화면에 표시됩니다" />
      ) : cls.status === 'ended' ? (
        <StageWaitingScreen title="수업이 끝났어요" />
      ) : !role.lesson || !role.beats ? (
        <StageWaitingScreen title="수업 준비 중" />
      ) : (
        <StageFrame>
          <StageContent
            classState={cls}
            lesson={role.lesson}
            beats={role.beats}
            stats={role.stats}
            spotlight={role.spotlightState}
          />
        </StageFrame>
      )}
    </>
  );
}

function StageWaitingScreen({ title, sub }: { title: string; sub?: string }) {
  return (
    <StageFrame>
      <StageMessage title={title} sub={sub} />
    </StageFrame>
  );
}

/** 열린 수업이 여럿일 때 고르기 — 전면 화면의 유일한 조작 상태(§10.5) */
function StageChooser({ classes, current, onPick }: { classes: OpenClassInfo[]; current?: string; onPick: (code: string) => void }) {
  return (
    <div className="paper-texture grid min-h-dvh place-items-center px-6">
      <div className="w-full max-w-[44rem] rounded-panel bg-sheet p-8 shadow-[0_0_0_1px_var(--color-rule)]">
        <p className="text-[15px] font-semibold text-ink-2">지금 열려 있는 수업</p>
        <h1 className="display mt-2 text-[33px]">화면에 표시할 수업을 골라 주세요</h1>
        <ul className="mt-6 grid gap-3">
          {classes.map((c) => (
            <li key={c.code}>
              <button
                type="button"
                onClick={() => onPick(c.code)}
                className={`btn w-full justify-between px-5 py-4 text-left ${
                  current === c.code ? 'bg-in-soft shadow-[inset_0_0_0_2px_var(--color-in)]' : 'btn-quiet'
                }`}
              >
                <span className="num display text-[26px]">{c.code}</span>
                <span className="text-[14px] text-ink-2">
                  {c.lessonId} ·{' '}
                  {new Date(c.openedAt).toLocaleTimeString('ko-KR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}{' '}
                  시작
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
