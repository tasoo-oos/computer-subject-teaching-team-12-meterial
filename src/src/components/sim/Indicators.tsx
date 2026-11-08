import { creditGrade, satisfactionBand, type GameState } from '@gagyebu/core';
import { Money } from '../Money.tsx';

/** 상단 지표: 순자산, 만족도, 신용점수, 비상금 개월 수 */
export function Indicators({ state, netWorth, emergency }: { state: GameState; netWorth: number; emergency: number }) {
  const band = satisfactionBand(state.satisfaction);
  const grade = creditGrade(state.credit);
  return (
    <dl className="grid grid-cols-2 gap-x-5 gap-y-2 sm:grid-cols-4">
      <div>
        <dt className="text-[12px] text-ink-2">순자산</dt>
        <dd className="text-[19px] font-bold leading-tight">
          <Money value={netWorth} unit="man" />
        </dd>
      </div>
      <div>
        <dt className="text-[12px] text-ink-2">
          만족도 <span className="font-semibold text-ink">{band.label}</span>
        </dt>
        <dd className="mt-1 flex items-center gap-2">
          <span className="relative h-2 w-full max-w-24 overflow-hidden rounded-full bg-rule-soft">
            <span className="absolute inset-y-0 left-0 rounded-full bg-ink" style={{ width: `${state.satisfaction}%` }} />
          </span>
          <span className="num text-[15px] font-bold">{state.satisfaction}</span>
        </dd>
      </div>
      <div>
        <dt className="text-[12px] text-ink-2">신용점수</dt>
        <dd className="flex items-baseline gap-1.5">
          <span className="num text-[19px] font-bold leading-tight">{state.credit}</span>
          <span className="rounded-[4px] bg-rule-soft px-1.5 text-[12px] font-semibold text-ink-2">{grade.label}</span>
        </dd>
      </div>
      <div>
        <dt className="text-[12px] text-ink-2">비상금으로 버티기</dt>
        <dd className="num text-[19px] font-bold leading-tight">
          {emergency.toFixed(1)}<span className="text-[13px] font-medium">개월</span>
        </dd>
      </div>
    </dl>
  );
}
