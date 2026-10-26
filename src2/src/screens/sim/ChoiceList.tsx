import type { GameState, Scene, Choice, ChoiceKind } from '@gagyebu/core';
import { choiceAvailability } from '@gagyebu/core';
import { Ban, BanknoteArrowDown, ChevronRight, CreditCard, Dices, Lock, SlidersHorizontal, Wallet } from 'lucide-react';
import { Chip } from '../../components/ui.tsx';

const KIND: Record<ChoiceKind, { label: string; Icon: typeof Wallet; cls: string; hint: string }> = {
  pay: { label: '지불형', Icon: Wallet, cls: 'bg-primary-soft text-primary', hint: '낼 계좌를 직접 고릅니다' },
  fixedPay: { label: '고정 지불', Icon: CreditCard, cls: 'bg-slate-200 text-slate-800', hint: '지불 방식이 정해져 있습니다' },
  free: { label: '무지출', Icon: Ban, cls: 'bg-surface-2 text-ink-2 ring-1 ring-line', hint: '돈이 나가지 않습니다' },
  deposit: { label: '입금형', Icon: BanknoteArrowDown, cls: 'bg-teal-100 text-teal-900', hint: '넣을 계좌를 고릅니다' },
  gamble: { label: '도박형', Icon: Dices, cls: 'bg-violet-100 text-violet-900', hint: '결과가 다음 장면으로 이어집니다' },
  budget: { label: '가계부 변경', Icon: SlidersHorizontal, cls: 'bg-amber-100 text-amber-900', hint: '선택 뒤 가계부를 다시 맞춥니다' },
};

/** 선택지 목록. 생김새는 kind에만 따라 달라지고, 좋고 나쁨을 색으로 표시하지 않는다 */
export function ChoiceList({ state, scene, onChoose }: { state: GameState; scene: Scene; onChoose: (c: Choice) => void }) {
  return (
    <section className="mt-4" aria-label="선택지">
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="text-sm font-bold text-ink">어떻게 할까요?</h3>
        <span className="text-[11px] text-ink-3">{scene.choices.length}개 중 하나</span>
      </div>
      <ul className="flex flex-col gap-2">
        {scene.choices.map((c) => {
          const { enabled, reason } = choiceAvailability(state, c);
          const k = KIND[c.kind];
          const payLabel = c.fixedPay?.label;
          return (
            <li key={c.id}>
              <button
                type="button"
                disabled={!enabled}
                onClick={() => onChoose(c)}
                aria-describedby={!enabled ? `lock-${c.id}` : undefined}
                className={`group flex w-full items-start gap-3 rounded-2xl border-2 bg-surface px-3 py-2.5 text-left transition-[border-color,background-color,transform,box-shadow] duration-150 ${
                  enabled
                    ? 'border-line shadow-[var(--shadow-card)] hover:-translate-y-px hover:border-primary/50 hover:shadow-[var(--shadow-lift)] active:translate-y-0'
                    : 'border-dashed border-line-strong bg-surface-2/60'
                }`}
              >
                <span className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl ${enabled ? k.cls : 'bg-line text-ink-3'}`} aria-hidden>
                  {enabled ? <k.Icon size={18} strokeWidth={2.2} /> : <Lock size={17} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className={`text-[15px] font-bold leading-snug ${enabled ? 'text-ink' : 'text-ink-3'}`}>{c.label}</span>
                    <Chip className={enabled ? k.cls : 'bg-line/70 text-ink-3'}>{k.label}</Chip>
                    {c.next && (
                      <span className="rounded-full border border-line bg-surface-2 px-1.5 py-0.5 text-[10px] font-semibold text-ink-3">
                        {c.next.delayMonths ? `${c.next.delayMonths}개월 뒤로 이어짐` : '이어지는 장면 있음'}
                      </span>
                    )}
                  </span>
                  {(c.detail || payLabel) && (
                    <span className="num mt-0.5 block text-[13px] font-semibold text-ink-2">{payLabel ?? c.detail}</span>
                  )}
                  {c.fixedPay && !c.fixedPay.interestFree && c.fixedPay.cardMonths ? (
                    <span className="mt-0.5 block text-[11px] text-ink-3">할부 수수료가 붙습니다</span>
                  ) : null}
                  {!enabled && reason && (
                    <span id={`lock-${c.id}`} className="mt-1.5 flex items-start gap-1 rounded-lg bg-warn-soft px-2 py-1 text-[12px] leading-snug font-semibold text-warn">
                      <Lock size={12} className="mt-0.5 shrink-0" aria-hidden />
                      {reason}
                    </span>
                  )}
                </span>
                {enabled && <ChevronRight size={18} className="mt-2 shrink-0 text-ink-3 transition-transform group-hover:translate-x-0.5" aria-hidden />}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
