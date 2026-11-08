import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import {
  ACCOUNT_ORDER,
  ACCOUNTS,
  emergencyMonths,
  formatWon,
  getScene,
  monthKind,
  netWorth,
  sneakerValue,
  type AccountId,
  type Action,
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
import { PayPanel, DepositPanel, type ChoiceConfirm } from '../components/sim/PayPanel.tsx';
import { PaydayStage } from '../components/sim/PaydayStage.tsx';
import { ReportStage } from '../components/sim/ReportStage.tsx';
import { SceneCard } from '../components/sim/SceneCard.tsx';
import { StatusPanel } from '../components/sim/StatusPanel.tsx';
import { useActBusy } from '../lib/actBusy.tsx';
import { scenePrompt } from '../lib/prompts.ts';

export function SimScreen({ state, dispatch, draft, mode, ui }: ScreenProps) {
  const busy = useActBusy();
  // 라이브·solo는 서버/로컬 상태의 step을 그대로 따라간다(낙관적 업데이트 없음).
  // dev는 스냅숏 안에서 화면이 스스로 단계를 바꾸던 기존 동작을 유지한다.
  const live = mode !== 'dev';
  const [devStep, setDevStep] = useState(state.step);
  const [openChoice, setOpenChoice] = useState<string | null>(ui?.openChoiceId ?? null);
  const [reason, setReason] = useState<string | null>(null);
  const [sellOpen, setSellOpen] = useState(false);
  const step = live ? state.step : devStep;
  const next = () => {
    if (step === 'payday') dispatch({ type: 'beginMonth' });
    else if (step === 'outcome') dispatch({ type: 'continue' });
    else if (step === 'report') dispatch({ type: 'endMonth' }); // solo 전용(라이브 대기 화면·dev 이동표)
    else dispatch({ type: 'endMonth' });
  };
  const sceneRef = state.current;
  const fetched = sceneRef ? getScene(sceneRef) : null;
  const opened = fetched?.scene.choices.find((c) => c.id === openChoice) ?? null;

  const choose = (c: Choice) => {
    if (c.kind === 'budget' && !live) {
      // dev 목업: 결과를 건너뛰고 조정 스냅숏으로 바로 이동하던 기존 동작
      const open = c.effects?.find((e) => e.kind === 'openBudget');
      setReason(open && open.kind === 'openBudget' ? open.reason : c.feedback);
      setOpenChoice(null);
      setDevStep('adjust');
      return;
    }
    if (c.pay || c.fixedPay || c.deposit) {
      setOpenChoice(c.id);
      return;
    }
    // 라이브·solo에서 가계부형 선택도 choose 行動으로 보낸다 — 엔진이 결과 → 조정 단계로 넘긴다
    dispatch({ type: 'choose', choiceId: c.id });
  };

  const closePanel = () => setOpenChoice(null);

  // 패널 확정: 계좌별 계획·입금 계좌·adjustable 금액을 行動에 실어 보낸다(라이브 서버가 같은 규칙으로 검증)
  const confirmPanel = (confirm: ChoiceConfirm) => {
    setOpenChoice(null);
    if (!opened) return;
    const action: Extract<Action, { type: 'choose' }> = { type: 'choose', choiceId: opened.id };
    if (confirm.payment) action.payment = confirm.payment;
    if (confirm.depositTo) action.depositTo = confirm.depositTo;
    if (confirm.amount !== undefined) action.amount = confirm.amount;
    dispatch(action);
  };

  // 상태 카드 행동(운동화 팔기): 입금 계좌를 고르면 statusAction으로 보낸다
  const sellSneakers = live ? () => setSellOpen((v) => !v) : undefined;
  const confirmSell = (depositTo: AccountId) => {
    setSellOpen(false);
    dispatch({ type: 'statusAction', status: 'sneakers', action: 'sellSneakers', depositTo });
  };

  // 월급날 버튼 문구: 라이브는 "확인", 12월은 "결과 보기"(dev는 기존 문구 그대로)
  const paydayLabel = live ? (state.month === 12 ? '결과 보기' : '확인') : undefined;

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
            <AdjustStage
              state={live ? state : withReason(state, reason)}
              onNext={(budget) => dispatch({ type: 'setBudget', budget })}
              onDraft={draft}
            />
          ) : step === 'payday' ? (
            <PaydayStage state={state} step={step} onNext={next} nextLabel={paydayLabel} />
          ) : step === 'outcome' ? (
            <OutcomeStage state={state} onContinue={next} />
          ) : step === 'report' ? (
            /* 라이브: 리포트 = done → Audience가 대기 화면을 그린다(여기는 읽기 전용 방어 렌더). solo·dev: "다음 달로" */
            <ReportStage state={state} onNext={mode === 'live' ? undefined : next} />
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
          <StatusPanel state={state} onSellSneakers={sellSneakers} />
          {sellOpen ? <SellSneakerPanel state={state} busy={busy} onConfirm={confirmSell} /> : null}
          <div className="rounded-panel bg-sheet px-3.5 py-3 shadow-[0_0_0_1px_var(--color-rule)]">
            <BudgetGlance state={state} />
            <p className="mt-2 border-t border-rule-soft pt-2 text-[11px] leading-snug text-ink-3">
              금리·수익률은 수업을 위한 가정값입니다. 실제 상품 금리가 아닙니다.
            </p>
          </div>
          {mode === 'dev' && step !== 'adjust' && state.month === 12 ? (
            <button type="button" onClick={() => dispatch({ type: 'endMonth' })} className="btn btn-primary w-full">
              1년 결산 보기
              <ChevronRight size={16} aria-hidden />
            </button>
          ) : null}
        </aside>
      </main>
    </div>
  );
}

/** 운동화 팔기: 입금 계좌 고르기 (statusAction 行動, docs/core-api.md §4.2) */
function SellSneakerPanel({ state, busy, onConfirm }: { state: GameState; busy: boolean; onConfirm: (id: AccountId) => void }) {
  const value = sneakerValue(state);
  return (
    <section aria-labelledby="sell-title" className="sheet-in rounded-panel bg-sheet p-3.5 shadow-[0_0_0_1px_var(--color-rule)]">
      <h2 id="sell-title" className="text-[14px] font-bold">
        운동화 팔기 — 어느 통장으로 받을까요?
      </h2>
      <p className="num mt-0.5 text-[12px] text-ink-2">지금 시세로 {formatWon(value)}을(를) 받아요.</p>
      <ul className="mt-2 grid gap-1.5">
        {ACCOUNT_ORDER.map((id) => (
          <li key={id}>
            <button
              type="button"
              disabled={busy}
              onClick={() => onConfirm(id)}
              className="flex w-full items-center justify-between gap-2 rounded-[8px] bg-paper px-3 py-2 text-left hover:bg-white"
            >
              <span className="text-[13px] font-semibold">{ACCOUNTS[id].label}</span>
              <span className="num text-[13px] text-ink-2">+{formatWon(value)}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
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
