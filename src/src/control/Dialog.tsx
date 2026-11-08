// 확인 대화상자 (confirm-required §5.5-2, 수업 끝내기·내보내기 확인).
// 키보드: Enter = 확인, Esc = 취소. 대화상자가 열려 있는 동안 useTeacherKeys는 enabled=false다.
import { useEffect, useRef } from 'react';
import { TriangleAlert } from 'lucide-react';

export interface DialogProps {
  title: string;
  children?: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  /** 위험 동작(끝내기·내보내기) — 확인 버튼이 인주 빨강 */
  danger?: boolean;
  /** 안내 아이콘 없이 조용한 대화상자 */
  quiet?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function Dialog({
  title,
  children,
  confirmLabel,
  cancelLabel = '취소',
  danger,
  quiet,
  onConfirm,
  onCancel,
}: DialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    confirmRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        onConfirm();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onCancel();
      }
    };
    window.addEventListener('keydown', onKey, true); // 캡처 — 교사 키(→/Space)보다 먼저
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onConfirm, onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-ink/35 px-5"
      role="alertdialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="sheet-in w-full max-w-[26rem] rounded-panel bg-sheet p-6 shadow-[0_0_0_1px_var(--color-rule),0_30px_60px_-30px_rgba(24,38,74,.6)]">
        <div className="flex items-start gap-3">
          {danger && !quiet ? <TriangleAlert size={22} className="mt-0.5 shrink-0 text-seal" aria-hidden /> : null}
          <h2 className="display text-[24px] leading-snug">{title}</h2>
        </div>
        {children ? <div className="mt-3 text-[14px] leading-relaxed text-ink-2">{children}</div> : null}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn btn-quiet h-11" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            ref={confirmRef}
            className={`btn h-11 px-5 text-white ${danger ? 'bg-seal hover:bg-[#a12229]' : 'btn-primary'}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
