import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

/** "AI에게 물어보기": 프롬프트를 클립보드에 복사한다 */
export function PromptCopy({ text, label = 'AI에게 물어보기', compact = false }: { text: string; label?: string; compact?: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // 클립보드 권한이 없으면 아무것도 하지 않는다 (교실 브라우저 대비)
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };
  return (
    <button
      type="button"
      onClick={copy}
      title={text}
      className={`btn btn-quiet ${compact ? 'px-3 text-[14px]' : ''}`}
      aria-live="polite"
    >
      {copied ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}
      {copied ? '프롬프트를 복사했어요' : label}
    </button>
  );
}
