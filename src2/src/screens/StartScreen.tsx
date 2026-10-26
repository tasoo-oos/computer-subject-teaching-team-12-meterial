import { useMemo, useState } from 'react';
import type { ScreenProps } from '@gagyebu/draft-kit';
import { ArrowRight, BadgeCheck, CalendarCheck2, ShieldCheck, Sparkles, Wallet } from 'lucide-react';
import { SALARY_SPREAD, formatWon } from '@gagyebu/core';
import { Button } from '../components/ui.tsx';
import { CountMoney } from '../components/Money.tsx';
import { LessonBar, LessonFooter } from '../components/LessonBar.tsx';

const nf = new Intl.NumberFormat('ko-KR');

export function StartScreen({ state, ui, go }: ScreenProps) {
  const stage = ui.startStage ?? 'name';
  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <LessonBar current="start" />
      <main className="mx-auto grid w-full max-w-[1280px] flex-1 items-center gap-10 px-4 py-8 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:py-12">
        {stage === 'reveal' ? <Reveal state={state} go={go} /> : <Intro state={state} go={go} />}
        <PaycheckPreview salary={stage === 'reveal' ? state.profile.salary : null} nickname={stage === 'reveal' ? state.profile.nickname : ''} />
      </main>
      <LessonFooter />
    </div>
  );
}

function Intro({ state, go }: { state: ScreenProps['state']; go: ScreenProps['go'] }) {
  const [nickname, setNickname] = useState(state.profile.nickname);
  const ready = nickname.trim().length > 0;
  return (
    <section className="max-w-xl animate-enter">
      <p className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-accent/50 bg-accent-soft px-3 py-1 text-sm font-semibold text-accent-ink">
        <Sparkles size={15} aria-hidden /> 입사 첫날, 첫 월급날
      </p>
      <h1 className="text-[clamp(2rem,4.2vw,3.1rem)] font-bold leading-[1.18] tracking-tight text-ink">
        여러분은 오늘
        <br />
        <span className="text-primary">첫 월급</span>을 받았습니다
      </h1>
      <p className="mt-4 max-w-[46ch] text-[17px] leading-relaxed text-ink-2">
        이제 1년 동안 월급을 어떻게 나누고 쓸지 직접 정합니다. 목적별 통장을 만들고, 예상하지 못한 일이 생길 때마다 어느 돈을 쓸지
        판단해 보세요.
      </p>

      <form
        className="mt-7 max-w-md"
        onSubmit={(e) => {
          e.preventDefault();
          if (ready) go('start-reveal');
        }}
      >
        <label htmlFor="nickname" className="mb-1.5 block text-sm font-bold text-ink">
          이름 또는 닉네임
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id="nickname"
            value={nickname}
            maxLength={12}
            autoComplete="nickname"
            onChange={(e) => setNickname(e.target.value)}
            placeholder="예: 하늘"
            aria-describedby="nickname-hint"
            className="min-h-12 flex-1 rounded-xl border border-line-strong bg-surface px-4 text-[17px] text-ink placeholder:text-ink-3/70 focus:border-primary focus:ring-2 focus:ring-primary/25 focus:outline-none"
          />
          <Button type="submit" size="lg" disabled={!ready} className="sm:w-auto">
            월급 확인하기
            <ArrowRight size={18} aria-hidden />
          </Button>
        </div>
        <p id="nickname-hint" className="mt-2 text-[13px] leading-relaxed text-ink-3">
          발표 화면과 결과에 이 이름이 나옵니다. 실명이 아니어도 괜찮아요.
        </p>
      </form>

      <ul className="mt-8 grid gap-2 text-sm text-ink-2 sm:grid-cols-3">
        {[
          { icon: Wallet, text: '월급은 기준소득 ±10%에서 정해집니다' },
          { icon: CalendarCheck2, text: '1월부터 12월까지 12개월' },
          { icon: ShieldCheck, text: '같은 선택에는 항상 같은 결과' },
        ].map((x) => (
          <li key={x.text} className="flex items-start gap-2 rounded-2xl border border-line bg-surface/70 p-3">
            <x.icon size={17} className="mt-0.5 shrink-0 text-primary" aria-hidden />
            <span className="leading-snug">{x.text}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Reveal({ state, go }: { state: ScreenProps['state']; go: ScreenProps['go'] }) {
  const salary = state.profile.salary;
  const base = state.profile.baseSalary;
  const min = Math.round((base * (1 - SALARY_SPREAD)) / 10_000) * 10_000;
  const max = Math.round((base * (1 + SALARY_SPREAD)) / 10_000) * 10_000;
  const pos = Math.min(100, Math.max(0, ((salary - min) / (max - min)) * 100));
  return (
    <section className="max-w-xl animate-flip">
      <p className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-up-soft px-3 py-1 text-sm font-bold text-up">
        <BadgeCheck size={16} aria-hidden /> 월급이 배정되었습니다
      </p>
      <h1 className="text-[clamp(1.6rem,3.4vw,2.3rem)] font-bold leading-snug tracking-tight text-ink">
        축하합니다! {state.profile.nickname}님의 첫 월급은
      </h1>
      <p className="mt-1 flex flex-wrap items-baseline gap-x-2">
        <CountMoney value={salary} duration={1100} className="text-[clamp(2.6rem,7vw,4rem)] font-bold leading-none tracking-tight text-primary" />
        <span className="text-xl font-semibold text-ink-2">입니다</span>
      </p>

      <div className="mt-7 rounded-2xl border border-line bg-surface p-4">
        <div className="flex items-baseline justify-between text-sm">
          <span className="font-semibold text-ink-2">기준 평균소득 {formatWon(base)}</span>
          <span className="text-ink-3">±10% 범위</span>
        </div>
        <div className="relative mt-3 h-3 rounded-full bg-surface-2 ring-1 ring-line ring-inset">
          <span className="absolute inset-y-0 left-0 rounded-full bg-primary/15" style={{ width: '100%' }} aria-hidden />
          <span className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-surface bg-primary shadow" style={{ left: `${pos}%` }} aria-hidden />
        </div>
        <div className="num mt-1.5 flex justify-between text-xs text-ink-3">
          <span>{nf.format(min)}원</span>
          <span className="font-bold text-primary">내 월급 {nf.format(salary)}원</span>
          <span>{nf.format(max)}원</span>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-ink-2">
          월급은 기준 평균소득의 ±10% 안에서 1만 원 단위로 정해집니다. 친구와 월급이 달라도, 1년의 결과는 <strong className="text-ink">선택</strong>에서 갈립니다.
        </p>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Button size="lg" onClick={() => go('survey-q1')}>
          소비습관 알아보기
          <ArrowRight size={18} aria-hidden />
        </Button>
        <span className="text-sm text-ink-3">다음: 7개 질문 · 약 4분</span>
      </div>
    </section>
  );
}

function PaycheckPreview({ salary, nickname }: { salary: number | null; nickname: string }) {
  const d = useMemo(() => new Date(2026, 0, 25), []);
  return (
    <div className="relative mx-auto w-full max-w-md animate-enter lg:mx-0 lg:justify-self-end" aria-hidden>
      <div className="absolute -inset-4 -z-10 rounded-[32px] bg-gradient-to-br from-primary/10 via-transparent to-accent/15" />
      <div className="rotate-[-1.2deg] rounded-[24px] border border-line bg-surface p-5 shadow-[var(--shadow-lift)]">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs font-semibold tracking-wide text-ink-3">급여명세서 · 2026년 1월</div>
            <div className="mt-1 text-lg font-bold text-ink">{nickname || '○○'}님</div>
          </div>
          <span className="rounded-lg bg-primary-soft px-2 py-1 text-xs font-bold text-primary">첫 급여</span>
        </div>
        <div className="mt-5 border-t border-dashed border-line pt-4">
          <div className="text-xs font-semibold text-ink-3">실수령액</div>
          <div className="mt-0.5 text-3xl font-bold text-ink">
            {salary === null ? <span className="text-ink-3">• • •</span> : <CountMoney value={salary} duration={1200} />}
          </div>
        </div>
        <dl className="num mt-4 grid grid-cols-3 gap-2 border-t border-line pt-3 text-xs">
          {[
            ['기본급', '2,600,000'],
            ['식대', '200,000'],
            ['공제', '-170,000'],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-ink-3">{k}</dt>
              <dd className="mt-0.5 font-semibold text-ink-2">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-4 flex items-center justify-between rounded-xl bg-surface-2 px-3 py-2 text-xs text-ink-3">
          <span>{d.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })} 입금</span>
          <span className="num">00-123-456789</span>
        </div>
      </div>
      <div className="absolute -right-3 -bottom-3 rotate-3 rounded-xl border border-accent/40 bg-accent-soft px-3 py-1.5 text-xs font-bold text-accent-ink shadow">
        1년 살아 보기 시작
      </div>
    </div>
  );
}
