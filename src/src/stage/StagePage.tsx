// /stage 전면(TV) 페이지 — S6이 본판을 짠다(§10.5). 지금은 로그인 게이트 + 자리표시자.
// useRoleLive는 게이트를 통과한 뒤에만 마운트한다: 로그인 전 소켓이 먼저 연결되면
// 서버가 쿠키 없는 연결을 끊고(§14 S2-#66), socket.io는 서버가 끊은 연결을 자동 재접속하지
// 않아 로그인 뒤에도 소켓이 죽어 있기 때문이다. S6은 StageShell 자리에 본판을 짠다
// (snapshot·class·stats·spotlightState·classes → 커서 비트의 SlideCanvas 또는 ACTIVITY_VIEWS[id].Stage).
import { GateChecking, LoginScreen, useLoginGate } from '../live/LoginScreen.tsx';
import { useRoleLive } from '../live/useRoleLive.ts';

const STATUS_TEXT: Record<string, string> = {
  connecting: '수업 서버에 연결하는 중…',
  open: '수업 서버에 연결됨',
  reconnecting: '다시 연결 중…',
  unauthorized: '연결 권한이 없어요 (다시 로그인해 주세요)',
  error: '연결 오류',
};

export function StagePage() {
  const gate = useLoginGate('stage');
  if (gate.checking) return <GateChecking />;
  if (gate.role !== 'stage') return <LoginScreen role="stage" offline={gate.offline} onSuccess={gate.retry} />;
  return <StageShell />;
}

function StageShell() {
  const role = useRoleLive('stage');
  return (
    <div className="paper-texture grid min-h-dvh place-items-center px-5">
      <div className="w-full max-w-[30rem] rounded-panel bg-sheet p-6 text-center shadow-[0_0_0_1px_var(--color-rule)] sm:p-8">
        <p className="text-[15px] font-semibold text-ink-2">전면(TV) 화면</p>
        <h1 className="display mt-2 text-[33px]">전면 화면은 준비 중이에요</h1>
        <p className="mt-3 text-[14px] text-ink-2">곧 수업 화면이 이 자리에 들어옵니다.</p>
        <p className="mt-4 border-t border-rule-soft pt-3 text-[13px] text-ink-2" data-testid="role-socket-status">
          {STATUS_TEXT[role.status] ?? role.status}
          {role.classState ? (
            <>
              {' · 수업 '}
              <span className="num font-bold">{role.classState.code}</span>
            </>
          ) : (
            ' · 열린 수업 없음'
          )}
        </p>
      </div>
    </div>
  );
}
