import { Lock } from 'lucide-react';
import { choiceAvailability, type Choice, type GameState } from '@gagyebu/core';
import { KIND_META } from './kinds.ts';
import { useActBusy } from '../../lib/actBusy.tsx';

interface ChoiceListProps {
  state: GameState;
  choices: Choice[];
  onChoose: (choice: Choice) => void;
  /** 이 선택을 이미 펼쳐서 패널이 열려 있으면 강조 표시 */
  activeId?: string;
}

export function ChoiceList({ state, choices, onChoose, activeId }: ChoiceListProps) {
  const busy = useActBusy();
  return (
    <div>
      <h3 className="mt-0 mb-2 text-[15px] font-bold text-ink-2">어떻게 할까요?</h3>
      <ul className="grid gap-2 sm:grid-cols-2">
        {choices.map((c) => {
          const { enabled, reason } = choiceAvailability(state, c);
          const meta = KIND_META[c.kind];
          const Icon = meta.icon;
          const active = activeId === c.id;
          return (
            <li key={c.id} className="flex">
              <button
                type="button"
                disabled={!enabled || busy}
                aria-pressed={active}
                onClick={() => onChoose(c)}
                className={`flex w-full gap-2.5 rounded-[8px] px-3 py-2.5 text-left transition-colors ${
                  active
                    ? 'bg-ink text-white shadow-[inset_0_0_0_2px_var(--color-ink)]'
                    : enabled
                      ? 'bg-sheet shadow-[inset_0_0_0_1.5px_var(--color-rule)] hover:bg-white hover:shadow-[inset_0_0_0_1.5px_var(--color-ink-3)]'
                      : 'hatch bg-paper text-ink-2 shadow-[inset_0_0_0_1.5px_dashed_var(--color-rule)]'
                }`}
              >
                <Icon size={18} className="mt-0.5 flex-none" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] leading-snug font-semibold">{c.label}</span>
                  {c.detail ? <span className={`num block text-[13px] ${active ? 'text-white/80' : 'text-ink-2'}`}>{c.detail}</span> : null}
                  <span className={`mt-0.5 flex items-center gap-1 text-[12px] ${active ? 'text-white/75' : 'text-ink-3'}`}>
                    {enabled ? meta.label : <><Lock size={12} aria-hidden /> 지금은 고를 수 없어요</>}
                  </span>
                  {!enabled && reason ? (
                    <span className="mt-1 block rounded-[4px] bg-white px-2 py-1 text-[12px] leading-snug text-ink-2">{reason}</span>
                  ) : null}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
