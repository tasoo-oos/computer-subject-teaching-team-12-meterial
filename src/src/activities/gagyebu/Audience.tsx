// 가계부 활동 학생(Audience) 화면 (docs/live-api.md §4.3 AudienceProps, §10.4).
// 비트 id별로 기존 6개 화면(screens/*)을 재사용해 그린다:
//   join → 입장 완료 안내, salary → 월급 연출, survey → 7문항 한 화면, survey-result → 내 유형,
//   guide-N → 카드 한 장, budget → 가계부 편집, m1..m12 → 한 달 시뮬레이션, present → 내 결과.
// 라이브에서 제출을 마친(marked done) 작업 비트는 대기 화면(§10.3) — 읽기 전용 요약 + AI 프롬프트 복사.
// 표시형 비트는 학생의 phase·step과 무관하게 beat.id + 상태 데이터만으로 그린다(§4.1 리뷰 모드).
import { useRef, useState, type ComponentType, type ReactNode } from 'react';
import type { ActAck, Beat } from '@gagyebu/live';
import { eventForMonth, getScene, type Action, type GameState, type ScreenId } from '@gagyebu/core';
import type { ScreenProps } from '@gagyebu/draft-kit';
import { BudgetTotals } from '../../components/BudgetTotals.tsx';
import { PromptCopy } from '../../components/PromptCopy.tsx';
import { AccountsPanel } from '../../components/sim/AccountsPanel.tsx';
import { ReportStage } from '../../components/sim/ReportStage.tsx';
import { WaitingScreen } from '../../live/WaitingScreen.tsx';
import { ActBusyContext } from '../../lib/actBusy.tsx';
import { actRejectText } from '../../lib/actNotice.ts';
import { budgetPrompt, scenePrompt } from '../../lib/prompts.ts';
import { BudgetScreen } from '../../screens/BudgetScreen.tsx';
import { GuideScreen } from '../../screens/GuideScreen.tsx';
import { ResultScreen } from '../../screens/ResultScreen.tsx';
import { SimScreen } from '../../screens/SimScreen.tsx';
import { StartScreen } from '../../screens/StartScreen.tsx';
import { SurveyAnswersSummary, SurveyScreen } from '../../screens/SurveyScreen.tsx';

/** 가계부 Audience props — 등록 계약(AudienceProps)을 앱 타입으로 좁힌 모양.
 *  dispatch는 라이브에서 ack Promise를 돌려주는 useLive.dispatch다(계약 타입이 void라 여기서 다시 넓힌다). */
export interface GagyebuAudienceProps {
  state: GameState | null;
  beat: Beat;
  revealed: boolean;
  submitted: boolean;
  mode: 'live' | 'solo' | 'dev';
  dispatch: (a: Action) => void | Promise<ActAck<GameState>>;
  draft: (d: unknown) => void;
}

const SCREENS: Record<ScreenId, ComponentType<ScreenProps>> = {
  start: StartScreen,
  survey: SurveyScreen,
  guide: GuideScreen,
  budget: BudgetScreen,
  sim: SimScreen,
  result: ResultScreen,
};

function isMonth(beatId: string): boolean {
  return /^m\d+$/.test(beatId);
}

export function Audience({ state, beat, revealed, submitted, mode, dispatch, draft }: GagyebuAudienceProps) {
  // 행동 큐(라이브): ack 전 다음 행동을 무시하지 않고 순서대로 보낸다(가계부 setBudget → confirmBudget 연속 제출).
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const queueRef = useRef<Action[]>([]);
  const runningRef = useRef(false);
  const noticeTimerRef = useRef(0);

  const showNotice = (message: string) => {
    setNotice(message);
    window.clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = window.setTimeout(() => setNotice(null), 5000);
  };

  const queuedDispatch = (a: Action) => {
    if (mode !== 'live') {
      void dispatch(a);
      return;
    }
    queueRef.current.push(a);
    void (async () => {
      if (runningRef.current) return;
      runningRef.current = true;
      setBusy(true);
      try {
        while (queueRef.current.length > 0) {
          const action = queueRef.current.shift()!;
          const ack = await dispatch(action);
          if (ack && typeof ack === 'object' && !ack.ok) {
            // 거부: 남은 순서는 버리고 안내만 잠깐 보여 준다. 화면은 다음 state/class로 다시 동기화된다.
            queueRef.current.length = 0;
            showNotice(actRejectText(ack));
          }
        }
      } finally {
        runningRef.current = false;
        setBusy(false);
      }
    })();
  };

  // 상태를 못 받은 학생(degraded, §14 S2-#68): 화면이 깨지지 않게 안내만 보여 준다
  if (!state) {
    return <DegradedScreen beat={beat} />;
  }

  // 12월 결산·발표 비트: 결과 화면이 곧 비트 내용이다(라이브에서는 단계 이동 버튼이 없다)
  const resultBeat = beat.id === 'present' || (isMonth(beat.id) && state.phase === 'result');
  if (resultBeat && !state.settlement) {
    return <DegradedScreen beat={beat} />;
  }

  // 라이브 제출 완료 → 대기 화면(§10.3). join(입장)과 12월 결산(결과 화면 자체)은 제외.
  if (mode === 'live' && submitted && beat.mode === 'work' && beat.id !== 'join' && !resultBeat) {
    return (
      <ActBusyContext.Provider value={false}>
        <WaitingScreen>{waitingChildren(beat.id, state)}</WaitingScreen>
      </ActBusyContext.Provider>
    );
  }

  const screenId: ScreenId = resultBeat
    ? 'result'
    : beat.id === 'join' || beat.id === 'salary'
      ? 'start'
      : beat.id === 'survey' || beat.id === 'survey-result'
        ? 'survey'
        : /^guide-\d+$/.test(beat.id)
          ? 'guide'
          : beat.id === 'budget'
            ? 'budget'
            : 'sim';
  const Screen = SCREENS[screenId]!;

  return (
    <ActBusyContext.Provider value={busy}>
      <Screen state={state} beat={beat} revealed={revealed} submitted={submitted} mode={mode} dispatch={queuedDispatch} draft={draft} />
      {notice ? (
        <div className="fixed inset-x-0 bottom-4 z-50 grid justify-center gap-2 px-4" role="status" aria-live="polite">
          <p className="sheet-in max-w-[26rem] rounded-[10px] bg-sheet px-4 py-3 text-[14px] font-medium shadow-[0_0_0_1px_var(--color-rule),0_12px_28px_-14px_rgba(24,38,74,.6)]">
            {notice}
          </p>
        </div>
      ) : null}
    </ActBusyContext.Provider>
  );
}

/** 대기 화면의 읽기 전용 요약(§10.3 "제출 전 화면과 같은 부품"): 비트별로 다르다 */
function waitingChildren(beatId: string, state: GameState): ReactNode {
  if (beatId === 'survey') {
    return <SurveyAnswersSummary state={state} />;
  }
  if (beatId === 'budget') {
    return (
      <>
        <BudgetTotals budget={state.budget} salary={state.profile.salary} />
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-panel bg-sheet px-4 py-3 shadow-[0_0_0_1px_var(--color-rule)]">
          <p className="text-[14px] font-semibold">확정한 가계부로 1년이 시작돼요.</p>
          <PromptCopy text={budgetPrompt(state)} />
        </div>
      </>
    );
  }
  if (isMonth(beatId)) {
    const event = eventForMonth(state.month);
    const prompt =
      event?.promptId && event.entry
        ? scenePrompt(state, event, getScene({ eventId: event.id, sceneId: event.entry }).scene)
        : null;
    return (
      <>
        <ReportStage state={state} />
        <AccountsPanel state={state} />
        {prompt ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-panel bg-sheet px-4 py-3 shadow-[0_0_0_1px_var(--color-rule)]">
            <p className="text-[14px] font-semibold">이번 달 선택을 AI에게 물어보고 싶다면:</p>
            <PromptCopy text={prompt} />
          </div>
        ) : null}
      </>
    );
  }
  return null;
}

/** 활동 상태를 못 받았을 때(degraded 세그먼트, §14 S2-#68) */
function DegradedScreen({ beat }: { beat: Beat }) {
  return (
    <div className="paper-texture grid min-h-dvh place-items-center px-5">
      <div className="w-full max-w-[30rem] rounded-panel bg-sheet p-6 text-center shadow-[0_0_0_1px_var(--color-rule),0_20px_40px_-30px_rgba(24,38,74,.5)] sm:p-8">
        <p className="text-[15px] font-semibold text-ink-2">잠시 화면을 준비하지 못했어요</p>
        <h1 className="display mt-2 text-[33px]">선생님이 넘기면 다시 따라와요</h1>
        <p className="mt-3 text-[14px] leading-relaxed text-ink-2">
          지금 단계({beat.label})의 내용을 불러오지 못했어요. 수업은 계속 진행되고 다음 단계로 넘어가면 자동으로 이어집니다.
        </p>
      </div>
    </div>
  );
}
