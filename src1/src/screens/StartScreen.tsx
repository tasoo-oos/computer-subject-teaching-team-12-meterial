import { useState } from 'react';
import { BASE_SALARY, SALARY_SPREAD, formatMan, formatWon } from '@gagyebu/core';
import type { ScreenProps } from '@gagyebu/draft-kit';
import { FlowHeader } from '../components/FlowHeader.tsx';
import { useCountUp } from '../lib/motion.ts';

export function StartScreen({ state, ui, go, goScreen }: ScreenProps) {
  const stage = ui.startStage ?? 'name';
  return (
    <div className="paper-texture min-h-dvh">
      <FlowHeader current="start" />
      {stage === 'name' ? <NameStage onSubmit={() => go('start-reveal')} /> : <RevealStage state={state} onNext={() => goScreen('survey')} />}
    </div>
  );
}

function NameStage({ onSubmit }: { onSubmit: (name: string) => void }) {
  const [name, setName] = useState('');
  const valid = name.trim().length > 0;
  return (
    <main className="mx-auto grid max-w-[1200px] items-center gap-10 px-5 py-10 sm:px-8 md:min-h-[calc(100dvh-56px)] md:grid-cols-[1.15fr_1fr] md:py-6">
      <div>
        <p className="text-[17px] font-semibold text-ink-2">입사 1년 차 시뮬레이션</p>
        <h1 className="display mt-3 text-[42px] text-ink sm:text-[56px] lg:text-[64px]">
          여러분은 오늘
          <br />첫 월급을 받았습니다
        </h1>
        <p className="mt-5 max-w-[34em] text-[17px] text-ink-2">
          통장에 돈이 들어왔습니다. 이 돈을 어느 통장에 얼마씩 나눌지 정하고, 1년 동안 생기는 돌발 상황마다 어느 돈을 쓸지 직접
          고릅니다. 고른 대로 다음 달 잔고가 바뀝니다.
        </p>
        <form
          className="mt-8 flex max-w-[30rem] flex-col gap-3 sm:flex-row sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            if (valid) onSubmit(name.trim());
          }}
        >
          <label className="flex-1">
            <span className="mb-1.5 block text-[15px] font-semibold">통장에 찍힐 이름 (닉네임)</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={10}
              placeholder="예: 하늘"
              autoComplete="off"
              className="h-12 w-full rounded-[8px] bg-white px-3.5 text-[17px] shadow-[inset_0_0_0_1.5px_var(--color-rule)] placeholder:text-ink-3 focus:shadow-[inset_0_0_0_2px_var(--color-ink)]"
            />
          </label>
          <button type="submit" disabled={!valid} className="btn btn-primary h-12 px-6 text-[17px]">
            월급 확인하기
          </button>
        </form>
      </div>
      <Payslip nickname={null} amount={null} />
    </main>
  );
}

function RevealStage({ state, onNext }: { state: ScreenProps['state']; onNext: () => void }) {
  const { nickname, salary, baseSalary } = state.profile;
  const shown = useCountUp(salary, 1400, 250);
  const lo = baseSalary * (1 - SALARY_SPREAD);
  const hi = baseSalary * (1 + SALARY_SPREAD);
  const pos = Math.min(1, Math.max(0, (salary - lo) / (hi - lo)));
  return (
    <main className="mx-auto grid max-w-[1200px] items-center gap-10 px-5 py-10 sm:px-8 md:min-h-[calc(100dvh-56px)] md:grid-cols-[1fr_1.1fr] md:py-6">
      <div>
        <p className="text-[17px] font-semibold text-ink-2">축하합니다!</p>
        <h1 className="mt-2 text-[26px] font-bold leading-snug sm:text-[33px]">
          {nickname}님의 첫 월급은
          <span className="num mt-1 block text-[44px] font-bold tracking-tight text-in sm:text-[64px]" aria-live="polite">
            {formatWon(shown)}
          </span>
          입니다
        </h1>
        <div className="mt-8 max-w-[30rem]">
          <p className="text-[15px] text-ink-2">
            월급은 기준 평균소득 {formatMan(BASE_SALARY)}의 ±{Math.round(SALARY_SPREAD * 100)}% 안에서 정해졌어요. 친구와 월급이 달라도, 결과의
            차이는 운이 아니라 선택에서 나옵니다.
          </p>
          <div className="mt-4" role="img" aria-label={`월급 범위 ${formatMan(lo)}에서 ${formatMan(hi)} 사이, ${nickname}님은 ${formatMan(salary)}`}>
            <div className="relative h-2 rounded-full bg-rule">
              <span className="absolute top-1/2 h-4 w-px -translate-y-1/2 bg-ink-3" style={{ left: '50%' }} />
              <span
                className="absolute top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white bg-in shadow"
                style={{ left: `${pos * 100}%` }}
              />
            </div>
            <div className="num mt-2 flex justify-between text-[13px] text-ink-3">
              <span>{formatMan(lo)}</span>
              <span>기준 {formatMan(baseSalary)}</span>
              <span>{formatMan(hi)}</span>
            </div>
          </div>
        </div>
        <button type="button" onClick={onNext} className="btn btn-primary mt-8 h-12 px-6 text-[17px]">
          내 소비습관 알아보기
        </button>
      </div>
      <Payslip nickname={nickname} amount={salary} />
    </main>
  );
}

/** 급여명세서 한 장. 금액이 없으면 봉인된 상태 */
function Payslip({ nickname, amount }: { nickname: string | null; amount: number | null }) {
  const rows: [string, string][] = [
    ['지급일', '1월 25일'],
    ['소속', '입사 1년 차'],
    ['받는 사람', nickname ? `${nickname}님` : '(닉네임)'],
  ];
  return (
    <figure className="relative mx-auto w-full max-w-[26rem] md:rotate-[1.5deg]" aria-label="급여명세서">
      <div className="rounded-[6px] bg-sheet px-6 pt-6 pb-7 shadow-[0_1px_0_var(--color-rule),0_18px_40px_-18px_rgba(24,38,74,.45)]">
        <div className="flex items-baseline justify-between border-b-2 border-ink pb-2">
          <p className="display text-[26px]">급여명세서</p>
          <p className="text-[13px] text-ink-3">세후 실수령</p>
        </div>
        <dl className="mt-3 space-y-1.5 text-[15px]">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between border-b border-dashed border-rule pb-1.5">
              <dt className="text-ink-2">{k}</dt>
              <dd className="font-medium">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-5 flex items-end justify-between">
          <p className="text-[15px] font-semibold">실수령액</p>
          {amount === null ? (
            <p className="flex gap-1" aria-label="아직 공개되지 않음">
              {Array.from({ length: 7 }, (_, i) => (
                <span key={i} className="h-8 w-5 rounded-[3px] bg-ink/85" />
              ))}
            </p>
          ) : (
            <p className="num text-[28px] font-bold text-ink">{formatWon(amount)}</p>
          )}
        </div>
      </div>
      {amount !== null ? (
        <span
          aria-hidden
          className="stamp-in absolute -right-2 -bottom-6 grid size-24 place-items-center rounded-full border-[3px] border-seal text-center text-[15px] leading-tight font-bold text-seal sm:-right-6"
          style={{ transform: 'rotate(-6deg)' }}
        >
          첫 월급
          <br />
          지급
        </span>
      ) : null}
    </figure>
  );
}
