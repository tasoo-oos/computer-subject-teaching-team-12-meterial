import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import {
  emergencyMonths,
  getScene,
  monthKind,
  netWorth,
  type AccountId,
  type Choice,
  type GameState,
} from '@gagyebu/core';
import type { ScreenProps } from '@gagyebu/draft-kit';
import { FlowHeader } from '../components/FlowHeader.tsx';
import { PromptCopy } from '../components/PromptCopy.tsx';
import { AccountsPanel, BudgetGlance } from '../components/sim/AccountsPanel.tsx';
import { AdjustStage } from '../components/sim/AdjustStage.tsx';
import { ChoiceList } from '../components/sim/ChoiceList.tsx';
import { Indicators } from '../components/sim/Indicators.tsx';
import { MonthStrip } from '../components/sim/MonthStrip.tsx';
import { OutcomeStage } from '../components/sim/OutcomeStage.tsx';
import { PayPanel, DepositPanel } from '../components/sim/PayPanel.tsx';
import { PaydayStage } from '../components/sim/PaydayStage.tsx';
import { ReportStage } from '../components/sim/ReportStage.tsx';
import { SceneCard } from '../components/sim/SceneCard.tsx';
import { StatusPanel } from '../components/sim/StatusPanel.tsx';
import { NEXT_FIXTURE, SCENE_FIXTURE } from '../components/sim/routes.ts';
import { scenePrompt } from '../lib/prompts.ts';

export function SimScreen({ state, ui, fixture, go, goScreen }: ScreenProps) {
  const [step, setStep] = useState(state.step);
  const [openChoice, setOpenChoice] = useState<string | null>(ui.openChoiceId ?? null);
  const [reason, setReason] = useState<string | null>(null);
  const next = () => go(NEXT_FIXTURE[fixture.id] ?? 'result-balanced');
  const sceneRef = state.current;
  const fetched = sceneRef ? getScene(sceneRef) : null;
  const opened = fetched?.scene.choices.find((c) => c.id === openChoice) ?? null;

  const choose = (c: Choice) => {
    if (c.kind === 'budget') {
      const open = c.effects?.find((e) => e.kind === 'openBudget');
      setReason(open && open.kind === 'openBudget' ? open.reason : c.feedback);
      setOpenChoice(null);
      setStep('adjust');
      return;
    }
    if (c.pay || c.fixedPay || c.deposit) {
      setOpenChoice(c.id);
      return;
    }
    if (c.next) {
      const key = `${sceneRef?.eventId ?? ''}/${c.next.scene}`;
      // 같은 달에 이어지는 장면이면 그 장면 스냅숏으로. 예약 장면이면 다음 스냅숏으로
      if (!c.next.delayMonths && SCENE_FIXTURE[key]) go(SCENE_FIXTURE[key]!);
      else next();
      return;
    }
    next();
  };

  const closePanel = () => setOpenChoice(null);

  const confirmPanel = () => {
    setOpenChoice(null);
    next();
  };

  return (
    <div className="paper-texture min-h-dvh">
      <FlowHeader current="sim" nickname={state.profile.nickname} />
      <div className="border-b border-rule bg-sheet/60">
        <div className="mx-auto max-w-[1320px] px-4 py-2 sm:px-6">
          <div className="flex flex-wrap items-end gap-x-8 gap-y-2">
            <div className="min-w-[220px] flex-1">
              <div className="mb-1 flex items-baseline justify-between gap-2">
                <p className="text-[13px] font-bold">
                  {state.profile.nickname}님의 1년 <span className="num text-ink-2">· {state.month}월</span>
                </p>
                <p className="text-[11px] text-ink-3">
                  {state.month === 1
                    ? '연습 달'
                    : monthKind(state.month) === 'settlement'
                      ? '12월 결산'
                      : monthKind(state.month) === 'quiet'
                        ? '조용한 달'
                        : '사건 있는 달'}
                  {step === 'report' ? ' · 월말 정리' : ''}
                </p>
              </div>
              <MonthStrip month={state.month} />
            </div>
            <Indicators state={state} netWorth={netWorth(state)} emergency={emergencyMonths(state)} />
          </div>
        </div>
      </div>

      <main className="mx-auto grid max-w-[1320px] items-start gap-4 px-4 py-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">
          {step === 'adjust' ? (
            <AdjustStage state={withReason(state, reason)} onNext={next} />
          ) : step === 'payday' ? (
            <PaydayStage state={state} step={step} onNext={next} />
          ) : step === 'outcome' ? (
            <OutcomeStage state={state} onContinue={next} />
          ) : step === 'report' ? (
            <ReportStage state={state} onNext={next} />
          ) : fetched ? (
            <div className="grid gap-3">
              <SceneCard event={fetched.event} scene={fetched.scene} compact={Boolean(opened)} />
              {opened ? (
                opened.deposit ? (
                  <DepositPanel state={state} choice={opened} onClose={closePanel} onConfirm={confirmPanel} />
                ) : (
                  <PayPanel state={state} choice={opened} onClose={closePanel} onConfirm={confirmPanel} />
                )
              ) : (
                <>
                  <ChoiceList state={state} choices={fetched.scene.choices} onChoose={choose} />
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="max-w-[36rem] text-[12px] leading-snug text-ink-3">
                      고른 대로 다음 달 잔고가 달라집니다. 지금 정답을 고르는 화면이 아니라, 1년 뒤에 무엇이 남는지 확인하는 화면입니다.
                    </p>
                    {fetched.event.promptId ? (
                      <PromptCopy text={scenePrompt(state, fetched.event, fetched.scene) ?? ''} compact />
                    ) : null}
                  </div>
                </>
              )}
            </div>
          ) : null}
        </div>

        <aside className="grid gap-3 lg:sticky lg:top-3">
          <AccountsPanel state={state} highlight={highlightAccounts(opened)} />
          <StatusPanel state={state} />
          <div className="rounded-panel bg-sheet px-3.5 py-3 shadow-[0_0_0_1px_var(--color-rule)]">
            <BudgetGlance state={state} />
            <p className="mt-2 border-t border-rule-soft pt-2 text-[11px] leading-snug text-ink-3">
              금리·수익률은 수업을 위한 가정값입니다. 실제 상품 금리가 아닙니다.
            </p>
          </div>
          {step !== 'adjust' && state.month === 12 ? (
            <button type="button" onClick={() => goScreen('result')} className="btn btn-primary w-full">
              1년 결산 보기
              <ChevronRight size={16} aria-hidden />
            </button>
          ) : null}
        </aside>
      </main>
    </div>
  );
}

/** 조정 단계에서 이벤트 이유를 화면에 넘긴다 (스냅숏 상태를 고치지 않고 사본만) */
function withReason(state: GameState, reason: string | null): GameState {
  if (!reason) return state;
  const next = { ...state, lastOutcome: state.lastOutcome ? { ...state.lastOutcome, budgetReason: reason } : null };
  return next;
}

function highlightAccounts(choice: Choice | null): AccountId[] | undefined {
  if (!choice) return undefined;
  if (choice.deposit) return choice.deposit.targets;
  if (choice.pay) return choice.pay.sources.filter((s): s is AccountId => s !== 'card');
  return undefined;
}
