import { RATES, formatWon, type SavingsMaturity } from '@gagyebu/core';

/** 적금 만기 영수증. 원금, 세전 이자, 세금, 세후 이자를 함께 보여 준다 */
export function MaturityReceipt({ maturity }: { maturity: SavingsMaturity }) {
  return (
    <section aria-labelledby="maturity-title" className="relative overflow-hidden rounded-[6px] bg-sheet p-4 shadow-[0_0_0_1px_var(--color-rule)] sm:p-5">
      <div className="flex items-baseline justify-between border-b-2 border-ink pb-2">
        <h2 id="maturity-title" className="display text-[21px]">
          적금 만기
        </h2>
        <p className="text-[12px] text-ink-2">12개월, 연 {Math.round(RATES.savings * 1000) / 10}% 단리</p>
      </div>
      <dl className="mt-2 space-y-1 text-[14px]">
        <div className="flex justify-between border-b border-dashed border-rule pb-1">
          <dt className="text-ink-2">납입 원금 (12회)</dt>
          <dd className="num font-semibold">{formatWon(maturity.principal)}</dd>
        </div>
        <div className="flex justify-between border-b border-dashed border-rule pb-1">
          <dt className="text-ink-2">세전 이자</dt>
          <dd className="num font-semibold text-in">{formatWon(maturity.interestGross)}</dd>
        </div>
        <div className="flex justify-between border-b border-dashed border-rule pb-1">
          <dt className="text-ink-2">이자소득세 {Math.round(RATES.interestTax * 1000) / 10}%</dt>
          <dd className="num">-{formatWon(maturity.tax)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3 pt-1">
          <dt className="font-bold">세후 이자</dt>
          <dd className="num text-[21px] font-bold text-in">+{formatWon(maturity.interestNet)}</dd>
        </div>
      </dl>
      <div className="mt-2 flex items-end justify-between gap-3">
        <p className={`text-[12px] leading-snug ${maturity.broken ? 'text-seal' : 'text-ink-2'}`}>
          {maturity.broken ? '중도 해지되어 이자가 연 0.5%로 줄었습니다.' : '12회를 모두 넣어 만기를 채웠습니다.'}
        </p>
        <span
          aria-hidden
          className="stamp-in -mr-1 -mb-2 grid size-[74px] flex-none place-items-center rounded-full border-[3px] border-seal text-center text-[13px] font-bold leading-tight text-seal"
          style={{ transform: 'rotate(-8deg)' }}
        >
          만기
          <br />
          지급
        </span>
      </div>
    </section>
  );
}
