// /stage 전면(TV) 페이지 — S6이 본판을 짠다(§10.5). 지금은 로그인 게이트 + 자리표시자.
// useRoleLive<GameState, GagyebuStats>()(src/src/live/useRoleLive.ts)로 snapshot·class·stats·
// spotlightState·classes를 받고, 커서 비트에 따라 SlideCanvas 또는 ACTIVITY_VIEWS[id].Stage를 그린다.
import { GateChecking, LoginScreen, useLoginGate } from '../live/LoginScreen.tsx';

export function StagePage() {
  const gate = useLoginGate('stage');
  if (gate.checking) return <GateChecking />;
  if (gate.role !== 'stage') return <LoginScreen role="stage" offline={gate.offline} onSuccess={gate.retry} />;
  return (
    <div className="paper-texture grid min-h-dvh place-items-center px-5">
      <div className="w-full max-w-[30rem] rounded-panel bg-sheet p-6 text-center shadow-[0_0_0_1px_var(--color-rule)] sm:p-8">
        <p className="text-[15px] font-semibold text-ink-2">전면(TV) 화면</p>
        <h1 className="display mt-2 text-[33px]">전면 화면은 준비 중이에요</h1>
        <p className="mt-3 text-[14px] text-ink-2">곧 수업 화면이 이 자리에 들어옵니다.</p>
      </div>
    </div>
  );
}
