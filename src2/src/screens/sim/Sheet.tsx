import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

/** 지불·입금 패널. Esc로 닫히고, 열리면 첫 조작 요소로 포커스가 간다 */
export function Sheet({
  title,
  subtitle,
  onClose,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    // 대화상자 자체에 포커스를 둔다. 입력칸을 바로 잡으면 모바일에서 화면이 밀린다
    ref.current?.focus({ preventScroll: true });
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <>
      {/* 문서 전체를 덮는 배경. 스크린숏에서도 잘리지 않는다 */}
      <div className="absolute inset-0 z-30 bg-hud/55 backdrop-blur-[2px]" aria-hidden onClick={onClose} />
      <div className="fixed inset-0 z-40 flex items-end justify-center p-0 sm:items-center sm:p-4" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={ref}
        role="dialog"
        tabIndex={-1}
        aria-modal="true"
        aria-labelledby="sheet-title"
        className="animate-enter flex max-h-[92dvh] outline-none w-full max-w-[640px] flex-col overflow-hidden rounded-t-[24px] border border-line bg-surface shadow-[var(--shadow-lift)] sm:max-h-[calc(100dvh-32px)] sm:rounded-[24px]"
      >
        <div className="flex items-start gap-3 border-b border-line px-4 py-3">
          <div className="min-w-0">
            <h2 id="sheet-title" className="text-[17px] font-bold tracking-tight text-ink">
              {title}
            </h2>
            {subtitle && <p className="mt-0.5 text-[13px] leading-snug text-ink-2">{subtitle}</p>}
          </div>
          <button type="button" data-close onClick={onClose} aria-label="패널 닫기" className="ml-auto flex size-11 shrink-0 items-center justify-center rounded-xl text-ink-2 hover:bg-ink/5">
            <X size={20} aria-hidden />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">{children}</div>
        <div className="border-t border-line bg-surface-2/60 px-4 py-3">{footer}</div>
      </div>
      </div>
    </>
  );
}
