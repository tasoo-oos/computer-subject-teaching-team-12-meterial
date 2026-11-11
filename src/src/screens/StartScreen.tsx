import { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { formatWon } from '@gagyebu/core';
import type { ScreenProps } from '@gagyebu/draft-kit';
import { FlowHeader } from '../components/FlowHeader.tsx';
import { useCountUp } from '../lib/motion.ts';

export function StartScreen({ state, dispatch, mode, beat, ui }: ScreenProps) {
  // dev: 스냅숏 힌트(ui.startStage)로 이름/공개 중 하나를 그린다(기존 동작 그대로).
  // live·solo: 비트 id로 그린다 — 'join'은 입장 완료 안내, 'salary'는 내 월급 연출(버튼 없음).
  if (mode !== 'dev') {
    return (
      <div className="paper-texture min-h-dvh">
        <FlowHeader current="start" nickname={state.profile.nickname} />
        {beat.id === 'join' ? (
          <JoinedNotice nickname={state.profile.nickname} />
        ) : (
          <RevealStage state={state} />
        )}
      </div>
    );
  }
  const stage = ui?.startStage ?? 'name';
  return (
    <div className="paper-texture min-h-dvh">
      <FlowHeader current="start" />
      {stage === 'name' ? (
        <NameStage onSubmit={(nickname) => dispatch({ type: 'start', nickname })} />
      ) : (
        <RevealStage state={state} onNext={() => dispatch({ type: 'continue' })} />
      )}
    </div>
  );
}

/** 입장 비트(live): 학생은 이미 입장했다 — 닉네임과 함께 짧게 안내한다. 조작 요소 없음 */
function JoinedNotice({ nickname }: { nickname: string }) {
  return (
    <main className="grid min-h-[calc(100dvh-56px)] place-items-center px-5 py-10">
      <div className="sheet-in w-full max-w-[30rem] rounded-panel bg-sheet p-6 text-center shadow-[0_0_0_1px_var(--color-rule),0_20px_40px_-30px_rgba(24,38,74,.5)] sm:p-8">
        <div className="mx-auto grid size-12 place-items-center rounded-full bg-in-soft text-in">
          <CheckCircle2 size={22} aria-hidden />
        </div>
        <h1 className="display mt-3 text-[33px]">입장 완료</h1>
        <p className="mt-2 text-[17px] font-semibold">
          {nickname ? `${nickname}님, 곧 시작해요` : '곧 시작해요'}
        </p>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-2">
          선생님이 화면을 넘기면 이 화면은 자동으로 바뀝니다. 기다리는 동안 자리를 정돈해 주세요.
        </p>
      </div>
    </main>
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

function RevealStage({ state, onNext }: { state: ScreenProps['state']; onNext?: () => void }) {
  const { nickname, salary } = state.profile;
  const shown = useCountUp(salary, 1400, 250);
  return (
    <main className="mx-auto grid max-w-[1200px] items-center gap-10 px-5 py-10 sm:px-8 md:min-h-[calc(100dvh-56px)] md:grid-cols-[1fr_1.1fr] md:py-6">
      <div>
        <p className="text-[17px] font-semibold text-ink-2">축하합니다!</p>
        <h1 className="mt-2 text-[26px] font-bold leading-snug sm:text-[33px]">
          {nickname}님의 첫 월급은
          <span className="num mt-1 block text-[42px] font-bold tracking-tight text-in sm:text-[62px]" aria-live="polite">
            {formatWon(shown)}
            <span className="ml-1 align-baseline text-[0.42em] font-bold tracking-normal text-ink">입니다</span>
          </span>
        </h1>
        {onNext ? (
          <button type="button" onClick={onNext} className="btn btn-primary mt-8 h-12 px-6 text-[17px]">
            내 소비습관 알아보기
          </button>
        ) : null}
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
        <div className="mt-5 flex items-end justify-between gap-3">
          <div>
            <p className="text-[15px] font-semibold">실수령액</p>
            {amount === null ? (
              <p className="mt-1 flex gap-1" aria-label="아직 공개되지 않음">
                {Array.from({ length: 7 }, (_, i) => (
                  <span key={i} className="h-8 w-5 rounded-[3px] bg-ink/85" />
                ))}
              </p>
            ) : (
              <p className="num text-[27px] font-bold text-ink sm:text-[28px]">{formatWon(amount)}</p>
            )}
          </div>
          {amount !== null ? (
            <span
              aria-hidden
              className="stamp-in grid size-[68px] flex-none place-items-center rounded-full border-[3px] border-seal text-center text-[14px] leading-tight font-bold text-seal"
              style={{ transform: 'rotate(-6deg)' }}
            >
              첫 월급
              <br />
              지급
            </span>
          ) : null}
        </div>
      </div>
    </figure>
  );
}
