import { BadgeCheck, Lock } from 'lucide-react';
import { ACHIEVEMENT_ORDER, ACHIEVEMENTS, type Settlement } from '@gagyebu/core';

/** 도전과제: 달성 / 미달성 / 숨김(???). 놓친 것이 다음 대화의 재료가 된다 */
export function Achievements({ settlement }: { settlement: Settlement }) {
  const unlockedIds = settlement.achievements.filter((a) => a.unlocked).map((a) => a.id);
  const done = unlockedIds.length;
  return (
    <section aria-labelledby="ach-title">
      <div className="flex items-end justify-between gap-3">
        <h2 id="ach-title" className="display text-[26px]">
          도전과제
        </h2>
        <p className="num text-[15px] font-semibold text-ink-2">
          {done} / {ACHIEVEMENT_ORDER.length} 달성
        </p>
      </div>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {ACHIEVEMENT_ORDER.map((id) => {
          const def = ACHIEVEMENTS[id];
          const on = unlockedIds.includes(id);
          if (def.hidden && !on) {
            return (
              <li key={id} className="hatch flex gap-2.5 rounded-[8px] bg-paper px-3 py-2.5 text-ink-3 shadow-[inset_0_0_0_1px_var(--color-rule)]">
                <Lock size={16} className="mt-0.5 flex-none" aria-hidden />
                <div>
                  <p className="font-bold">???</p>
                  <p className="text-[12px] leading-snug">
                    숨은 도전과제입니다. {def.months.length ? `${def.months.join('·')}월의 선택을 떠올려 보세요.` : '아직 밝혀지지 않았어요.'}
                  </p>
                </div>
              </li>
            );
          }
          return (
            <li
              key={id}
              className={`flex gap-2.5 rounded-[8px] px-3 py-2.5 shadow-[inset_0_0_0_1px_var(--color-rule)] ${
                on ? 'bg-sheet' : 'bg-paper/60'
              }`}
            >
              {on ? (
                <BadgeCheck size={17} className="mt-0.5 flex-none text-in" aria-hidden />
              ) : (
                <span aria-hidden className="mt-1.5 size-3 flex-none rounded-full border-2 border-rule" />
              )}
              <div className={on ? '' : 'text-ink-3'}>
                <p className={`font-bold ${on ? 'text-ink' : ''}`}>{def.title}</p>
                <p className="text-[12px] leading-snug">{def.description}</p>
                {!on ? <p className="mt-0.5 text-[11px] font-semibold">놓친 도전과제</p> : null}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
