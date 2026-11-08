// 재접속 띠 (docs/live-api.md §10.3). status === 'reconnecting'이면 모든 학생·전면·통제 화면 상단에 뜬다.
// 복구되면 snapshot이 전체를 다시 맞춘다.
export function ReconnectBanner({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div role="alert" className="fixed inset-x-0 top-0 z-50 flex justify-center bg-ink px-4 py-2 text-white shadow-[0_2px_8px_rgba(24,38,74,.35)]">
      <p className="flex items-center gap-2 text-[15px] font-semibold">
        <span aria-hidden className="size-2 animate-pulse rounded-full bg-white" />
        다시 연결 중… 잠시만 기다려 주세요
      </p>
    </div>
  );
}
