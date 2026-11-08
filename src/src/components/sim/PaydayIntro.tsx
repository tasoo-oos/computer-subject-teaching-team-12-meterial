// 월급날 소개 카드 (S5 2단계, §14 #122). beginMonth를 보내기 전엔 state.payday가 null이라
// 월급날 내역을 그릴 수 없다 — 라이브·solo에서는 먼저 이 카드로 무슨 일이 일어날지 알려 주고
// "월급 받기"를 눌러 beginMonth를 보내면 실제 내역(PaydayStage)이 인쇄된다.
import type { GameState } from '@gagyebu/core';
import { useActBusy } from '../../lib/actBusy.tsx';

/** 12월은 결산 버튼 문구로 (SimScreen의 paydayLabel 규칙과 같다) */
export function PaydayIntro({ state, onNext, nextLabel }: { state: GameState; onNext: () => void; nextLabel: string }) {
  const busy = useActBusy();
  const m = state.month;
  const isSettlement = m === 12;
  return (
    <section className="sheet-in rounded-panel bg-sheet shadow-[0_0_0_1px_var(--color-rule)]" aria-labelledby="payday-intro-title">
      <header className="flex flex-wrap items-end justify-between gap-2 border-b-2 border-ink px-5 py-3">
        <div>
          <p className="text-[12px] font-semibold text-ink-2">{m}월 {isSettlement ? '마지막 날' : '월급날'}</p>
          <h2 id="payday-intro-title" className="display text-[26px]">
            {isSettlement ? '1년 결산을 시작합니다' : `${m}월 월급날이에요`}
          </h2>
        </div>
      </header>
      <div className="px-5 py-4">
        <p className="max-w-[42rem] text-[15px] leading-relaxed text-ink-2">
          {isSettlement
            ? '12월 월급과 함께 적금이 만기되고, 1년 결산(최종 잔고·순자산·엔딩·도전과제)이 한 번에 정리됩니다.'
            : '월급이 생활비 통장에 들어오면 자동이체가 먼저 저축을 떼어 둡니다. 그다음 한 달 생활비가 정해지고, 이자와 수익이 붙어요. 통장에 거래가 한 줄씩 인쇄됩니다.'}
        </p>
        {m === 1 ? (
          <p className="mt-3 rounded-[8px] bg-ink px-4 py-3 text-[14px] leading-relaxed text-white">
            <strong className="display text-[15px]">1월은 연습입니다. </strong>
            월급이 들어오면 자동이체가 먼저 돈을 나눠 두고, 생활비 통장에 남은 돈으로 한 달을 삽니다. 이 순서만 기억하면 됩니다. 2월부터는
            예상하지 못한 일이 생깁니다.
          </p>
        ) : null}
        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-[12px] text-ink-3">금리와 수익률은 수업을 위한 가정값입니다.</p>
          <button type="button" onClick={onNext} disabled={busy} className="btn btn-primary px-6">
            {nextLabel}
          </button>
        </div>
      </div>
    </section>
  );
}
