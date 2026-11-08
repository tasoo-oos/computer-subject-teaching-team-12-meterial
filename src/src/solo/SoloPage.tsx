// /solo 혼자하기 페이지 (docs/live-api.md §10.10). 서버 없이 같은 화면 자산으로 혼자 1년을 진행한다.
//   - useReducer(step, …)로 게임 상태를 로컬에서 굴린다. 월급은 rollSalary(Math.random).
//   - 커서는 가계부 비트 목록 위를 로컬로 움직인다: show 비트는 "다음" 버튼, work 비트는 학생이 끝내면 넘어간다.
//   - 비트 사이 전이(guide-6 → budget의 goto, m(N) → m(N+1)의 endMonth)는 활동 로직의 transition 그대로 쓴다.
//   - 공개(reveal) 토글·대기 화면·초안 전송·기본값 루프가 없다. 학생이 모든 단계를 직접 마친다.
import { useReducer, useRef, useState } from 'react';
import { createInitialState, rollSalary, step, type Action, type GameState } from '@gagyebu/core';
import { gagyebuLogic, type GagyebuConfig } from '@gagyebu/activity-gagyebu';
import { lesson } from '@gagyebu/lesson';
import type { Beat } from '@gagyebu/live';
import { Audience } from '../activities/gagyebu/Audience.tsx';

/** lesson.ts의 가계부 활동 설정(같은 비트 순서를 쓴다) */
const gagyebuSegment = lesson.segments.find((s): s is Extract<typeof s, { kind: 'activity' }> => s.kind === 'activity' && s.activity === 'gagyebu');
const SOLO_CONFIG: GagyebuConfig = (gagyebuSegment?.config ?? { guide: true, monthReveal: true, spotlight: true, confirmForce: true }) as GagyebuConfig;
const SOLO_BEATS: Beat[] = gagyebuLogic.beats(SOLO_CONFIG);
const SALARY_BEAT = SOLO_BEATS.findIndex((b) => b.id === 'salary');

/** 이 work 비트를 학생이 다 지나쳤는지(커서 자동 진행 판정). show 비트는 항상 false. */
function passed(beatId: string, s: GameState): boolean {
  if (beatId === 'survey') return s.survey.result !== null;
  if (beatId === 'budget') return s.phase === 'sim';
  const m = /^m(\d+)$/.exec(beatId);
  if (m) {
    const n = Number(m[1]);
    if (n === 12) return false; // 12월 결산 결과 화면이 마지막 — 자동으로 넘기지 않는다
    return s.month > n; // 리포트에서 "다음 달로"(endMonth)를 누르면 다음 비트로
  }
  return false;
}

export function SoloPage() {
  const [state, dispatchRaw] = useReducer(step, undefined, () => createInitialState('', 0));
  const [cursor, setCursor] = useState(0);
  // 같은 클릭 안에서 연속 行動(가계부 setBudget → confirmBudget)도 최신 상태를 보게 하는 미러
  const stateRef = useRef(state);
  const cursorRef = useRef(cursor);

  const started = state.phase !== 'start';

  const start = (nickname: string) => {
    dispatch({ type: 'start', nickname, salary: rollSalary(Math.random) });
    cursorRef.current = SALARY_BEAT;
    setCursor(SALARY_BEAT);
  };

  /** 행동 적용 → 끝낸 work 비트는 전이와 함께 커서를 맞춘다(전이는 활동 로직 transition 그대로) */
  const dispatch = (a: Action) => {
    let s = step(stateRef.current, a);
    stateRef.current = s;
    const pending: Action[] = [a];
    let cur = cursorRef.current;
    while (cur < SOLO_BEATS.length - 1 && passed(SOLO_BEATS[cur]!.id, s)) {
      for (const t of gagyebuLogic.transition(s, cur, cur + 1, SOLO_CONFIG)) {
        s = step(s, t);
        pending.push(t);
      }
      stateRef.current = s;
      cur++;
    }
    for (const p of pending) dispatchRaw(p);
    cursorRef.current = cur;
    setCursor(cur);
  };

  /** show 비트의 "다음": 커서만 앞으로. 비트 경계의 전이(안내 → 가계부)도 같이 적용한다 */
  const advance = () => {
    if (cursorRef.current >= SOLO_BEATS.length - 1) return;
    const actions = gagyebuLogic.transition(stateRef.current, cursorRef.current, cursorRef.current + 1, SOLO_CONFIG);
    let s = stateRef.current;
    for (const t of actions) {
      s = step(s, t);
      stateRef.current = s;
      dispatchRaw(t);
    }
    cursorRef.current += 1;
    setCursor(cursorRef.current);
  };

  if (!started) return <SoloStart onSubmit={start} />;

  const beat = SOLO_BEATS[cursor] ?? SOLO_BEATS[SOLO_BEATS.length - 1]!;
  return (
    <div className="relative">
      <Audience
        state={state}
        beat={beat}
        revealed={true}
        submitted={false}
        mode="solo"
        dispatch={dispatch}
        draft={() => {}}
      />
      {beat.mode === 'show' ? (
        <div className="fixed bottom-5 right-5 z-30">
          <button type="button" onClick={advance} className="btn btn-primary h-13 px-7 text-[17px] shadow-[0_12px_28px_-14px_rgba(24,38,74,.7)]">
            다음
          </button>
        </div>
      ) : null}
    </div>
  );
}

/** 혼자하기 시작: 닉네임을 정하면 rollSalary로 월급을 정해 1년을 시작한다 */
function SoloStart({ onSubmit }: { onSubmit: (nickname: string) => void }) {
  const [name, setName] = useState('');
  const valid = name.trim().length > 0 && name.trim().length <= 10;
  return (
    <div className="paper-texture grid min-h-dvh place-items-center px-5">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) onSubmit(name.trim());
        }}
        className="w-full max-w-[26rem] rounded-panel bg-sheet p-6 shadow-[0_0_0_1px_var(--color-rule),0_20px_40px_-30px_rgba(24,38,74,.5)] sm:p-8"
      >
        <p className="text-[15px] font-semibold text-ink-2">혼자하기 · 네트워크 없이</p>
        <h1 className="display mt-2 text-[33px]">첫 월급 1년, 혼자 해 보기</h1>
        <p className="mt-2 text-[14px] leading-relaxed text-ink-2">
          선생님이 없이 내 속도로 진행해요. 월급은 기준 월급 ±10% 안에서 무작위로 정해집니다. 닉네임(1~10자)을 정하고 시작하세요.
        </p>
        <label className="mt-5 block">
          <span className="mb-1.5 block text-[15px] font-semibold">닉네임</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={10}
            placeholder="예: 하늘"
            autoComplete="off"
            className="h-12 w-full rounded-[8px] bg-white px-3.5 text-[17px] shadow-[inset_0_0_0_1.5px_var(--color-rule)] placeholder:text-ink-3 focus:shadow-[inset_0_0_0_2px_var(--color-ink)]"
          />
        </label>
        <button type="submit" disabled={!valid} className="btn btn-primary mt-5 h-12 w-full text-[17px]">
          1년 시작하기
        </button>
      </form>
    </div>
  );
}
