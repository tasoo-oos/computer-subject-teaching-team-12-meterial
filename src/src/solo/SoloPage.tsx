// /solo 혼자하기 페이지 — S5가 구현한다(docs/live-api.md §10.10). 지금은 자리표시자.
// 서버 없이 useReducer(step, createInitialState(…))로 로컬 상태를 굴리고 mode: 'solo'로 ScreenProps를 만든다.
export function SoloPage() {
  return (
    <div className="paper-texture grid min-h-dvh place-items-center px-5">
      <div className="w-full max-w-[30rem] rounded-panel bg-sheet p-6 text-center shadow-[0_0_0_1px_var(--color-rule)] sm:p-8">
        <p className="text-[15px] font-semibold text-ink-2">혼자하기</p>
        <h1 className="display mt-2 text-[33px]">혼자하기 모드는 준비 중이에요</h1>
        <p className="mt-3 text-[14px] text-ink-2">곧 서버 없이 혼자 1년을 진행할 수 있어요.</p>
        <a href="/" className="btn btn-quiet mt-5">
          첫 화면으로
        </a>
      </div>
    </div>
  );
}
