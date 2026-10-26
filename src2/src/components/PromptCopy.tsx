import { useState } from 'react';
import { Bot, Check, Copy } from 'lucide-react';
import { copyText } from '../lib/clipboard.ts';

/** "AI에게 물어보기" 프롬프트 복사. 펼치면 복사될 문장을 미리 보여 준다 */
export function PromptCopy({ text, stage, compact = false }: { text: string; stage: string; compact?: boolean }) {
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);
  const onCopy = async () => {
    const ok = await copyText(text);
    setCopied(ok);
    if (ok) window.setTimeout(() => setCopied(false), 2500);
  };
  return (
    <div className={compact ? '' : 'rounded-2xl border border-line bg-surface-2 p-3'}>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onCopy}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-primary/30 bg-primary-soft px-3.5 text-sm font-semibold text-primary transition-colors hover:border-primary"
        >
          {copied ? <Check size={17} aria-hidden /> : <Bot size={17} aria-hidden />}
          {copied ? '복사했어요' : 'AI에게 물어보기'}
          {!copied && <Copy size={14} aria-hidden className="opacity-70" />}
        </button>
        {!compact && (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="min-h-11 rounded-xl px-2 text-sm font-medium text-ink-2 underline-offset-4 hover:underline"
          >
            {open ? '질문 접기' : '복사될 질문 보기'}
          </button>
        )}
        <span role="status" className="sr-only">
          {copied ? `${stage} 질문을 복사했습니다` : ''}
        </span>
      </div>
      {open && !compact && <p className="mt-2 rounded-xl bg-surface p-3 text-sm leading-relaxed text-ink-2">{text}</p>}
    </div>
  );
}
