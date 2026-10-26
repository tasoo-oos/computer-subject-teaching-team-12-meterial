import { useMemo, useState } from 'react';
import type { ScreenProps } from '@gagyebu/draft-kit';
import {
  EVENTS,
  SCREEN_LABEL,
  formatMan,
  getScene,
  monthKind,
  sneakerValue,
  type Choice,
  type GameState,
  type Outcome,
  type PaymentPlan,
  type SceneRef,
} from '@gagyebu/core';
import { CheckCircle2, ChevronRight, Sparkles } from 'lucide-react';
import { PromptCopy } from '../components/PromptCopy.tsx';
import { scenePrompt } from '../lib/prompts.ts';
import { MonthRail } from './sim/MonthRail.tsx';
import { StatStrip } from './sim/StatStrip.tsx';
import { AccountPanel, ScheduledPanel, StatusPanel } from './sim/AccountPanel.tsx';
import { SceneCard } from './sim/SceneCard.tsx';
import { ChoiceList } from './sim/ChoiceList.tsx';
import { PaymentPanel } from './sim/PaymentPanel.tsx';
import { DepositPanel } from './sim/DepositPanel.tsx';
import { FixedPayPanel } from './sim/FixedPayPanel.tsx';
import { PaydayPanel } from './sim/PaydayPanel.tsx';
import { OutcomePanel } from './sim/OutcomePanel.tsx';
import { ReportPanel } from './sim/ReportPanel.tsx';
import { AdjustPanel } from './sim/AdjustPanel.tsx';

/** 스냅숏 사이를 잇는 그럴듯한 다음 화면 */
const AFTER: Record<string, string> = {
  'sim-jan-payday': 'sim-feb-scene',
  'sim-feb-scene': 'sim-feb-outcome',
  'sim-feb-pay': 'sim-feb-outcome',
  'sim-feb-seller': 'sim-feb-outcome',
  'sim-feb-outcome': 'sim-apr-check',
  'sim-mar-resell': 'sim-apr-check',
  'sim-apr-check': 'sim-may-message',
  'sim-may-message': 'sim-jun-adjust',
  'sim-jun-adjust': 'sim-jul-reveal',
  'sim-jul-reveal': 'sim-aug-crash',
  'sim-aug-crash': 'sim-oct-report',
  'sim-aug-deposit': 'sim-oct-report',
  'sim-oct-report': 'sim-nov-invite',
  'sim-nov-invite': 'result-balanced',
  'sim-nov-locked': 'result-debt',
};

const KIND_LABEL: Record<string, string> = {
  tutorial: '튜토리얼 달',
  event: '장면이 있는 달',
  quiet: '조용한 달',
  settlement: '결산 달',
};

export function SimScreen({ state: initial, ui, fixture, go, goScreen }: ScreenProps) {
  const [game, setGame] = useState<GameState>(() => initial);
  const [preview, setPreview] = useState<Outcome | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const scene = game.current ? getScene(game.current) : null;
  const aiPrompt = scene ? scenePrompt(game, scene.event, scene.scene) : null;
  const [panel, setPanel] = useState<{ choice: Choice; kind: 'pay' | 'deposit' | 'fixed' } | null>(() => {
    if (!ui.openChoiceId || !scene) return null;
    const c = scene.scene.choices.find((x) => x.id === ui.openChoiceId);
    if (!c) return null;
    if (c.kind === 'pay' || c.kind === 'gamble') return { choice: c, kind: 'pay' };
    if (c.kind === 'deposit') return { choice: c, kind: 'deposit' };
    if (c.kind === 'fixedPay') return { choice: c, kind: 'fixed' };
    return null;
  });

  const advance = () => {
    setPreview(null);
    go(AFTER[fixture.id] ?? 'sim-feb-scene');
  };

  const handleChoice = (choice: Choice) => {
    if (!scene) return;
    if ((choice.kind === 'pay' || (choice.kind === 'gamble' && choice.pay)) && choice.pay) {
      setPanel({ choice, kind: 'pay' });
      return;
    }
    if (choice.kind === 'fixedPay' && choice.fixedPay) {
      setPanel({ choice, kind: 'fixed' });
      return;
    }
    if (choice.kind === 'deposit' && choice.deposit) {
      // 8월 급락 매도는 입금 패널 스냅숏으로 이어 간다
      if (fixture.id === 'sim-aug-crash' && choice.id === 'sellAll') {
        go('sim-aug-deposit');
        return;
      }
      setPanel({ choice, kind: 'deposit' });
      return;
    }
    if (choice.kind === 'budget') {
      go(fixture.id === 'sim-jul-reveal' ? 'sim-aug-crash' : 'sim-jun-adjust');
      return;
    }
    // 무지출형·도박형 등: 이 장면의 결과를 로컬로 미리 보여 준다
    setPreview(buildPreview(game, scene.event, scene.scene, choice));
  };

  const confirmPayment = (_plan: PaymentPlan) => {
    setPanel(null);
    go(fixture.id === 'sim-aug-crash' ? 'sim-oct-report' : (AFTER[fixture.id] ?? 'sim-feb-outcome'));
  };

  const confirmDeposit = (_target: keyof GameState['accounts']) => {
    setPanel(null);
    go(fixture.id === 'sim-aug-deposit' || fixture.id === 'sim-aug-crash' ? 'sim-oct-report' : (AFTER[fixture.id] ?? 'sim-feb-outcome'));
  };

  const sellSneakers = () => {
    const value = sneakerValue(game);
    setGame((g) => ({
      ...g,
      accounts: { ...g.accounts, emergency: { ...g.accounts.emergency, balance: g.accounts.emergency.balance + value } },
      statuses: g.statuses.filter((s) => s.id !== 'sneakers'),
    }));
    setToast(`운동화를 ${formatMan(value)}에 팔아 비상금 통장에 넣었습니다.`);
  };

  return (
    <div className="relative flex min-h-dvh flex-col bg-bg">
      <header className="on-dark bg-hud pb-3 text-hud-ink">
        <div className="mx-auto max-w-[1320px] px-3 pt-3 sm:px-5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <span className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg bg-white/10 text-sm font-bold text-accent" aria-hidden>
                ₩
              </span>
              <span className="text-[13px] font-bold">내 첫 월급, 1년 살아 보기</span>
            </span>
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-hud-ink-2">{SCREEN_LABEL.sim}</span>
            <span className="ml-auto flex items-center gap-2 text-[12px] text-hud-ink-2">
              <span className="font-semibold text-white">{game.profile.nickname}</span>님의 1년
              <span className="rounded-md bg-accent px-1.5 py-0.5 text-[11px] font-bold whitespace-nowrap text-hud">
                {game.month}월<span className="hidden sm:inline"> · {KIND_LABEL[monthKind(game.month)]}</span>
              </span>
            </span>
          </div>

          <div className="mt-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <div className="text-[11px] font-semibold text-hud-ink-2">이번 달</div>
              <div className="flex items-baseline gap-2">
                <h1 className="num text-[26px] leading-none font-bold text-white">{game.month}월</h1>
                <span className="text-[12px] text-hud-ink-2">
                  {scene ? `${scene.event.code} ${scene.event.title}` : KIND_LABEL[monthKind(game.month)]}
                </span>
              </div>
            </div>
            <StatStrip state={game} />
          </div>

          <MonthRail month={game.month} />
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-[1320px] flex-1 items-start gap-3 px-3 py-3 sm:px-5 lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_336px]">
        <div className="min-w-0">
          {preview ? (
            <OutcomePanel state={{ ...game, lastOutcome: preview }} onContinue={advance} onAdjust={() => go('sim-jun-adjust')} />
          ) : game.step === 'payday' ? (
            <PaydayPanel state={game} onContinue={advance} />
          ) : game.step === 'scene' && scene ? (
            <>
              <SceneCard event={scene.event} scene={scene.scene} />
              <ChoiceList state={game} scene={scene.scene} onChoose={handleChoice} />
              {aiPrompt && (
                <div className="mt-3 rounded-2xl border border-line bg-surface p-3">
                  <p className="mb-1.5 text-[12px] font-semibold text-ink-2">
                    판단이 어려울 때 AI에게 물어볼 수 있습니다. <span className="font-normal text-ink-3">질문만 복사되고, 답은 내가 고릅니다.</span>
                  </p>
                  <PromptCopy text={aiPrompt.text} stage={aiPrompt.stage} compact />
                </div>
              )}
              {game.queue.length > 0 && (
                <p className="mt-3 flex items-center gap-1.5 rounded-xl border border-dashed border-line-strong bg-surface/70 px-3 py-2 text-[12px] text-ink-2">
                  <ChevronRight size={14} aria-hidden /> 이번 달에 이어지는 장면이 {game.queue.length}개 더 있습니다.
                </p>
              )}
              {scene.scene.choices.length === 0 && <p className="mt-3 text-sm text-ink-3">이 장면에는 선택지가 없습니다.</p>}
            </>
          ) : game.step === 'outcome' ? (
            <OutcomePanel state={game} onContinue={advance} onAdjust={() => go('sim-jun-adjust')} />
          ) : game.step === 'report' ? (
            <ReportPanel state={game} onNext={advance} />
          ) : null}

          {game.step === 'adjust' && !preview && (
            <>
              <AdjustPanel state={game} onConfirm={advance} />
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <StatusPanel state={game} onSell={sellSneakers} />
                <ScheduledPanel state={game} />
              </div>
            </>
          )}
        </div>

        {game.step !== 'adjust' && (
          <aside className="flex min-w-0 flex-col gap-3 lg:sticky lg:top-3">
            <AccountPanel state={game} />
            <StatusPanel state={game} onSell={sellSneakers} />
            <ScheduledPanel state={game} />
            <p className="px-1 text-[10px] leading-relaxed text-ink-3">
              금리·수익률·시세는 수업을 위한 학습용 가정값입니다. 같은 선택에는 항상 같은 결과가 나옵니다.
            </p>
          </aside>
        )}
      </main>

      <footer className="mx-auto w-full max-w-[1320px] px-3 pb-4 text-[10px] text-ink-3 sm:px-5">
        <span className="inline-flex items-center gap-1">
          <Sparkles size={11} aria-hidden /> 12개월 중 {game.month}개월째 · 남은 부채와 상태 효과는 선택이 바꿉니다.
        </span>
      </footer>

      {panel?.kind === 'pay' && <PaymentPanel state={game} choice={panel.choice} onClose={() => setPanel(null)} onConfirm={confirmPayment} />}
      {panel?.kind === 'deposit' && <DepositPanel state={game} choice={panel.choice} onClose={() => setPanel(null)} onConfirm={confirmDeposit} />}
      {panel?.kind === 'fixed' && <FixedPayPanel choice={panel.choice} onClose={() => setPanel(null)} onConfirm={() => { setPanel(null); go(AFTER[fixture.id] ?? 'sim-feb-outcome'); }} />}

      {toast && (
        <div role="status" className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-xl bg-hud px-3.5 py-2.5 text-[13px] font-semibold text-white shadow-lg">
          <CheckCircle2 size={16} className="text-emerald-300" aria-hidden />
          {toast}
          <button type="button" onClick={() => setToast(null)} className="ml-2 rounded px-1 text-[11px] text-hud-ink-2 hover:text-white">
            닫기
          </button>
        </div>
      )}
    </div>
  );
}

/** 무지출·도박·입금형 선택의 결과를 화면에서 미리 보여 주기 위한 임시 Outcome */
function buildPreview(state: GameState, event: (typeof EVENTS)[keyof typeof EVENTS], scene: ReturnType<typeof getScene>['scene'], choice: Choice): Outcome {
  const deltas: Outcome['deltas'] = [];
  for (const e of choice.effects ?? []) {
    switch (e.kind) {
      case 'satisfaction':
        deltas.push({ kind: 'satisfaction', amount: e.delta });
        break;
      case 'credit':
        deltas.push({ kind: 'credit', amount: e.delta });
        break;
      case 'money':
        deltas.push({ kind: 'account', account: e.account, amount: e.delta });
        break;
      case 'budget':
        deltas.push({ kind: 'budget', key: e.expense, amount: e.delta });
        break;
      case 'budgetPct':
        deltas.push({ kind: 'budget', key: e.expense, amount: Math.round(state.budget.expenses[e.expense] * e.pct) });
        break;
      case 'addStatus':
        deltas.push({ kind: 'status', status: e.status, change: 'add' });
        break;
      case 'removeStatus':
        deltas.push({ kind: 'status', status: e.status, change: 'remove' });
        break;
      case 'sellAllInvest':
        deltas.push({ kind: 'account', account: 'invest', amount: -state.accounts.invest.balance });
        break;
      case 'breakSavings':
        deltas.push({ kind: 'account', account: 'savings', amount: -state.accounts.savings.balance });
        break;
      case 'startRevolving':
        deltas.push({ kind: 'debt', amount: typeof e.amount === 'number' ? e.amount : 0, label: '리볼빙' });
        break;
      case 'openBudget':
        break;
      case 'flag':
        break;
    }
  }
  let next: SceneRef | null = null;
  let scheduled: Outcome['scheduled'] = null;
  if (choice.next && event.scenes[choice.next.scene]) {
    const ref = { eventId: event.id, sceneId: choice.next.scene };
    if (choice.next.delayMonths) {
      scheduled = { ...ref, month: state.month + choice.next.delayMonths, when: choice.next.when, reason: event.title };
    } else {
      next = ref;
    }
  }
  return {
    ref: { eventId: event.id, sceneId: scene.id },
    choiceId: choice.id,
    feedback: choice.feedback,
    deltas,
    next,
    scheduled,
    lesson: event.lesson,
    budgetReason: null,
  };
}
