import { ACCOUNTS, formatWon, type DecisionRecord, type GameState } from '@gagyebu/core';
import { sourceLabel } from '../../lib/accounts.ts';

/** 선택 기록: 그달에 무엇을 골랐는지. 다음 학생의 발표 자료가 된다 */
export function DecisionTimeline({ decisions, state }: { decisions: DecisionRecord[]; state: GameState }) {
  const months = [...new Set(decisions.map((d) => d.month))].sort((a, b) => a - b);
  return (
    <section aria-labelledby="decisions-title">
      <h2 id="decisions-title" className="display text-[26px]">
        선택 기록
      </h2>
      <ol className="mt-3 space-y-0">
        {months.map((m) => {
          const items = decisions.filter((d) => d.month === m);
          return (
            <li key={m} className="grid grid-cols-[3rem_1fr] gap-x-3">
              <p className="num pt-2 text-[14px] font-bold text-ink-2">{m}월</p>
              <ul className="border-l border-rule pb-3 pl-4">
                {items.map((d, i) => {
                  const paid = d.payment?.parts.reduce((a, p) => a + p.amount, 0) ?? 0;
                  const card = d.payment?.card;
                  return (
                    <li key={`${d.sceneId}-${d.choiceId}-${i}`} className="relative py-1.5">
                      <span aria-hidden className="absolute top-3 -left-[1.32rem] size-2 rounded-full bg-ink" />
                      <p className="flex flex-wrap items-center gap-1.5 text-[14px] font-semibold leading-snug">
                        {d.choiceLabel}
                        {d.auto ? (
                          <span className="rounded-[4px] border border-rule bg-paper px-1.5 py-px text-[11px] font-semibold text-ink-2">
                            자동 선택
                          </span>
                        ) : null}
                      </p>
                      <p className="text-[12px] text-ink-3">
                        사건 {d.eventCode}
                        {paid > 0 ? ` · ${d.payment!.parts.map((p) => `${sourceLabel(p.source)} ${formatWon(p.amount)}`).join(' + ')}` : ''}
                        {card ? ` · 카드 ${formatWon(card.amount)} ${card.months === 1 ? '일시불' : `${card.months}개월`}` : ''}
                      </p>
                    </li>
                  );
                })}
              </ul>
            </li>
          );
        })}
      </ol>
      <p className="mt-2 text-[12px] text-ink-3">{state.profile.nickname}님의 선택 {decisions.length}개</p>
    </section>
  );
}
