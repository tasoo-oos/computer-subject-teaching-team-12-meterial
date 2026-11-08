// /control 통제(교사) 페이지 — S6이 본판을 짠다(§10.6). 지금은 로그인 게이트 + 자리표시자.
// useRoleLive<GameState, GagyebuStats>()의 명령 헬퍼(next·prev·goto·reveal·spotlight·student·
// openClass·endClass·lockJoin·select)와 beats(타임라인), stats, roster, SlidePreview를 쓴다.
import { GateChecking, LoginScreen, useLoginGate } from '../live/LoginScreen.tsx';

export function ControlPage() {
  const gate = useLoginGate('control');
  if (gate.checking) return <GateChecking />;
  if (gate.role !== 'control') return <LoginScreen role="control" offline={gate.offline} onSuccess={gate.retry} />;
  return (
    <div className="paper-texture grid min-h-dvh place-items-center px-5">
      <div className="w-full max-w-[30rem] rounded-panel bg-sheet p-6 text-center shadow-[0_0_0_1px_var(--color-rule)] sm:p-8">
        <p className="text-[15px] font-semibold text-ink-2">통제(교사) 화면</p>
        <h1 className="display mt-2 text-[33px]">통제 화면은 준비 중이에요</h1>
        <p className="mt-3 text-[14px] text-ink-2">곧 수업 열기·타임라인·완료 현황이 이 자리에 들어옵니다.</p>
      </div>
    </div>
  );
}
