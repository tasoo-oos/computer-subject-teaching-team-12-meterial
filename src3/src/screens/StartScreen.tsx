import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { BASE_SALARY, SALARY_SPREAD, formatMan, formatWon } from '@gagyebu/core';
import type { ScreenProps } from '@gagyebu/draft-kit';
import { AppFrame } from '../components/AppFrame.tsx';
import { Button } from '../components/ui.tsx';
import { useCountUp } from '../lib/hooks.ts';

const MIN = BASE_SALARY * (1 - SALARY_SPREAD);
const MAX = BASE_SALARY * (1 + SALARY_SPREAD);

const STEPS = [
  ['소비습관 설문', '7문항'],
  ['재무 기초 안내', '카드 6장'],
  ['가계부 작성', '통장 6개로 나누기'],
  ['1년 살아 보기', '12개월, 돌발 상황'],
  ['결산과 발표', '엔딩과 도전과제'],
] as const;

export function StartScreen({ state, ui, go, goScreen }: ScreenProps) {
  const reveal = ui.startStage === 'reveal';
  const [name, setName] = useState(state.profile.nickname);
  const trimmed = name.trim();

  return (
    <AppFrame screen="start" nickname={reveal ? state.profile.nickname : undefined}>
      <div className="grid flex-1 gap-2.5 py-1 lg:grid-cols-[1.1fr_1fr]">
        <section className="cut flex flex-col justify-between gap-8 p-6 sm:p-10">
          <div>
            <h1 className="text-[34px] leading-[1.18] font-extrabold tracking-[-0.03em] text-balance sm:text-[44px]">
              여러분은 오늘
              <br />첫 월급을 받았습니다.
            </h1>
            <p className="mt-5 max-w-[34em] text-[17px] leading-relaxed text-mute">
              입사 첫 달, 통장에 월급이 들어왔습니다. 이 돈을 목적별 통장으로 나누고, 1년 동안 생기는 일마다 어느 돈을 어떻게 쓸지 직접 정해 봅니다.
            </p>
          </div>
          <ol className="grid grid-cols-1 gap-1.5 sm:grid-cols-5">
            {STEPS.map(([title, sub], i) => (
              <li key={title} className="cut-2 flex items-baseline gap-3 px-3 py-2.5 sm:flex-col sm:gap-1">
                <span className="num text-xs font-bold text-mute">{i + 1}</span>
                <span className="text-sm font-bold">{title}</span>
                <span className="text-xs text-mute">{sub}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="cut flex flex-col p-6 sm:p-10" aria-live="polite">
          {reveal ? (
            <Reveal nickname={state.profile.nickname} salary={state.profile.salary} onNext={() => goScreen('survey')} />
          ) : (
            <form
              className="flex flex-1 flex-col"
              onSubmit={(e) => {
                e.preventDefault();
                if (trimmed) go('start-reveal');
              }}
            >
              <Payslip name={trimmed || '이름 없음'} />
              <label htmlFor="nick" className="mt-8 text-sm font-bold">
                닉네임
              </label>
              <input
                id="nick"
                value={name}
                maxLength={10}
                autoComplete="off"
                onChange={(e) => setName(e.target.value)}
                placeholder="발표 때 불릴 이름 (예: 하늘)"
                className="mt-2 h-14 rounded-[5px] border border-line-strong bg-paper px-4 text-[18px] font-semibold placeholder:font-normal placeholder:text-mute focus:border-ink focus:outline-none"
              />
              <p className="mt-3 text-sm leading-relaxed text-mute">
                월급은 기준 평균소득 <b className="num text-text">{formatMan(BASE_SALARY)}</b>의 ±{SALARY_SPREAD * 100}% 안에서 1만 원 단위로 정해집니다. 친구와 월급이 조금씩 다를 수 있어요.
              </p>
              <Button type="submit" variant="plate" size="lg" className="mt-auto w-full" disabled={!trimmed}>
                월급 확인하기 <ArrowRight size={18} />
              </Button>
            </form>
          )}
        </section>
      </div>
    </AppFrame>
  );
}

function Payslip({ name, amount }: { name: string; amount?: number }) {
  return (
    <div className="rounded-[5px] border border-line p-5">
      <div className="flex items-baseline justify-between border-b border-line pb-3">
        <span className="text-sm font-bold">급여 명세서</span>
        <span className="text-xs text-mute">1년 차 · 01월</span>
      </div>
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
        <dt className="text-mute">받는 사람</dt>
        <dd className="text-right font-semibold">{name}</dd>
        <dt className="text-mute">실수령액</dt>
        <dd className="text-right">
          {amount === undefined ? (
            <span aria-label="아직 모름" className="inline-block h-4 w-28 rounded-[2px] bg-paper-3 align-middle" />
          ) : (
            <span className="num font-bold">{formatWon(amount)}</span>
          )}
        </dd>
      </dl>
    </div>
  );
}

function Reveal({ nickname, salary, onNext }: { nickname: string; salary: number; onNext: () => void }) {
  const shown = useCountUp(salary, { from: Math.round(MIN), duration: 480 });
  const pos = ((salary - MIN) / (MAX - MIN)) * 100;
  return (
    <div className="flex flex-1 flex-col">
      <p className="text-[17px] font-semibold">축하합니다!</p>
      <h2 className="mt-1 text-[22px] leading-snug font-bold tracking-[-0.02em]">{nickname}님의 첫 월급은</h2>
      <p className="shutter develop mt-4 rounded-[5px] bg-flash px-5 py-4">
        <span className="num block text-[44px] leading-none font-extrabold tracking-[-0.03em] sm:text-[56px]">{formatWon(shown)}</span>
      </p>
      <p className="mt-2 text-[17px] font-semibold">입니다.</p>

      <figure className="mt-8">
        <figcaption className="text-sm text-mute">월급이 정해지는 범위 (기준 {formatMan(BASE_SALARY)} ±10%)</figcaption>
        <div className="relative mt-6 h-2 rounded-full bg-paper-3">
          <span className="absolute top-1/2 left-1/2 h-4 w-px -translate-y-1/2 bg-line-strong" aria-hidden />
          <span
            className="absolute top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-paper bg-ink shadow-[0_1px_4px_rgb(0_0_0/0.3)]"
            style={{ left: `${pos}%` }}
            aria-hidden
          />
        </div>
        <div className="num mt-2 flex justify-between text-xs text-mute">
          <span>{formatMan(MIN)}</span>
          <span>기준 {formatMan(BASE_SALARY)}</span>
          <span>{formatMan(MAX)}</span>
        </div>
      </figure>

      <Button variant="plate" size="lg" className="mt-auto w-full" onClick={onNext}>
        내 소비습관부터 알아보기 <ArrowRight size={18} />
      </Button>
    </div>
  );
}
