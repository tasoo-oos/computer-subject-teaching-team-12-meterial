import { useState } from 'react';
import { ArrowRight, CircleHelp } from 'lucide-react';
import {
  ACCOUNTS,
  PROMPTS,
  creditGrade,
  emergencyMonths,
  eventForMonth,
  fillTemplate,
  formatWon,
  getScene,
  monthKind,
  monthLabel,
  netWorth,
  satisfactionBand,
  sneakerValue,
  type AccountId,
  type Choice,
  type GameState,
} from '@gagyebu/core';
import type { ScreenProps } from '@gagyebu/draft-kit';
import { AppFrame } from '../components/AppFrame.tsx';
import { BudgetEditor } from '../components/BudgetEditor.tsx';
import { Button, Money } from '../components/ui.tsx';
import { MonthStrip } from './sim/MonthStrip.tsx';
import { SidePanel } from './sim/SidePanel.tsx';
import { ChoiceList, PromptButton, SceneCard } from './sim/SceneCard.tsx';
import { DepositPanel } from './sim/DepositPanel.tsx';
import { FixedPayPanel, PayPanel } from './sim/PayPanel.tsx';
import { PaydayView } from './sim/PaydayView.tsx';
import { OutcomeView } from './sim/OutcomeView.tsx';
import { ReportView } from './sim/ReportView.tsx';

type Panel = 'pay' | 'deposit' | 'fixed' | null;

/** 스냅숏 사이의 그럴듯한 다음 장면 */
function nextOf(fixtureId: string, choiceId?: string): { id: string; label: string } {
  if (fixtureId === 'sim-jan-payday') return { id: 'sim-feb-scene', label: '2월로' };
  if (fixtureId === 'sim-feb-scene') {
    if (choiceId === 'used') return { id: 'sim-feb-seller', label: '판매자와 대화하기' };
    if (choiceId === 'wait') return { id: 'sim-feb-outcome', label: '결과 보기' };
    return { id: 'sim-feb-outcome', label: '결과 보기' };
  }
  if (fixtureId === 'sim-feb-pay' || fixtureId === 'sim-feb-seller') return { id: 'sim-feb-outcome', label: '결과 보기' };
  if (fixtureId === 'sim-feb-outcome') return { id: 'sim-mar-resell', label: '3월로' };
  if (fixtureId === 'sim-mar-resell') return { id: 'sim-apr-check', label: '4월, 시세를 확인한다' };
  if (fixtureId === 'sim-apr-check') return { id: 'sim-may-message', label: '5월로' };
  if (fixtureId === 'sim-may-message') return { id: 'sim-jun-adjust', label: '6월로' };
  if (fixtureId === 'sim-jun-adjust') return { id: 'sim-jul-reveal', label: '7월로' };
  if (fixtureId === 'sim-jul-reveal') return { id: 'sim-aug-crash', label: '8월로' };
  if (fixtureId === 'sim-aug-crash') return { id: 'sim-oct-report', label: '다음 달로' };
  if (fixtureId === 'sim-aug-deposit') return { id: 'sim-oct-report', label: '다음 달로' };
  if (fixtureId === 'sim-oct-report') return { id: 'sim-nov-invite', label: '11월로' };
  if (fixtureId === 'sim-nov-invite' || fixtureId === 'sim-nov-locked') return { id: 'result-balanced', label: '12월 결산' };
  return { id: 'result-balanced', label: '12월 결산' };
}

function stepTitle(state: GameState): string {
  if (state.step === 'payday') return `${state.month}월 월급날`;
  if (state.step === 'adjust') return `${state.month}월 가계부 조정`;
  if (state.step === 'report') return `${state.month}월 월말 리포트`;
  if (state.step === 'outcome') return `${state.month}월 선택의 결과`;
  const ev = eventForMonth(state.month);
  return `${state.month}월 · ${ev?.title ?? '조용한 달'}`;
}

export function SimScreen({ state, ui, fixture, go }: ScreenProps) {
  const [panel, setPanel] = useState<Panel>(() => {
    const c = ui.openChoiceId;
    if (!c) return null;
    const found = findChoice(state, c);
    if (!found) return null;
    return found.kind === 'deposit' ? 'deposit' : found.kind === 'fixedPay' ? 'fixed' : 'pay';
  });
  const [selected, setSelected] = useState<Choice | null>(() => (ui.openChoiceId ? findChoice(state, ui.openChoiceId) : null));
  const [soldNote, setSoldNote] = useState<string | null>(null);
  const [budget, setBudget] = useState(() => structuredClone(state.budget));

  const next = nextOf(fixture.id, selected?.id);
  const sceneRef = state.current ? getScene(state.current) : null;
  const grade = creditGrade(state.credit);
  const band = satisfactionBand(state.satisfaction);
  const months = emergencyMonths(state);

  const promptText =
    sceneRef?.event.promptId && sceneRef.scene
      ? fillTemplate(PROMPTS[sceneRef.event.promptId].template, {
          salary: formatWon(state.profile.salary).replace('원', ''),
          amount: sceneRef.scene.reveal?.[0]?.value ?? '',
          accounts: (['living', 'emergency', 'savings', 'invest', 'goal', 'housing'] as AccountId[])
            .map((id) => `${ACCOUNTS[id].label} ${formatWon(state.accounts[id].balance)}`)
            .join(', '),
          item: sceneRef.event.title,
          months: '12',
          message: sceneRef.scene.text,
        })
      : null;

  const closePanel = () => {
    setPanel(null);
    setSelected(null);
  };

  const confirmChoice = () => {
    go(next.id);
  };

  const sellSneakers = () => {
    const value = sneakerValue(state);
    setSelected({
      id: 'sell-sneakers',
      kind: 'deposit',
      label: '운동화를 지금 시세로 판다',
      deposit: { amount: value, targets: ['living', 'emergency', 'goal', 'invest'] },
      feedback: '수수료를 뺀 금액이 입금됩니다.',
    });
    setPanel('deposit');
    setSoldNote(`${formatWon(value)}을 받고 운동화를 팔았습니다.`);
  };

  const wide = state.step === 'adjust' || state.step === 'report';
  const beforeBudget = (() => {
    if (state.step !== 'adjust' || !state.lastOutcome) return undefined;
    const before = structuredClone(state.budget);
    for (const d of state.lastOutcome.deltas) {
      if (d.kind !== 'budget') continue;
      const key = d.key as string;
      if (key === 'livingBuffer') before.livingBuffer -= d.amount;
      else if (key in before.expenses) before.expenses[key as keyof typeof before.expenses] -= d.amount;
      else before.transfers[key as keyof typeof before.transfers] -= d.amount;
    }
    return before;
  })();

  return (
    <AppFrame screen="sim" nickname={state.profile.nickname} wide>
      <div className="flex flex-1 flex-col gap-1.5 pb-2 text-frame">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-1.5">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-frame-mute">
              {monthLabel(state.month)} · {monthKind(state.month) === 'quiet' ? '이벤트 없는 달' : monthKind(state.month) === 'settlement' ? '결산' : monthKind(state.month) === 'tutorial' ? '튜토리얼' : '이벤트'}
            </p>
            <h1 className="truncate text-[19px] leading-tight font-extrabold tracking-[-0.02em]">{stepTitle(state)}</h1>
          </div>
          <dl className="grid grid-cols-2 gap-x-5 gap-y-1 sm:flex sm:flex-wrap sm:items-baseline">
            <Metric label="순자산">
              <Money value={netWorth(state)} className="text-[20px] font-extrabold" />
            </Metric>
            <Metric label="만족도" sub={band.label}>
              <span className="num">{state.satisfaction}</span>
            </Metric>
            <Metric label="신용점수" sub={grade.label}>
              <span className="num">{state.credit}</span>
            </Metric>
            <Metric label="비상금" sub="생활비 기준">
              <span className="num">{months.toFixed(1)}개월</span>
            </Metric>
          </dl>
        </div>

        <MonthStrip state={state} />

        {soldNote && (
          <p className="rounded-[4px] bg-ink-3 px-3 py-1.5 text-[11px] text-frame">{soldNote}</p>
        )}

        <div className={`grid flex-1 gap-2.5 ${wide ? '' : 'lg:grid-cols-[minmax(0,1fr)_340px]'}`}>
          <div className="flex min-w-0 flex-col gap-2.5">
            <StepContent
              state={state}
              fixtureId={fixture.id}
              panel={panel}
              selected={selected}
              budget={budget}
              onBudget={setBudget}
              promptText={promptText}
              onSelect={(c) => {
                setSelected(c);
                if (c.kind === 'pay' || (c.kind === 'gamble' && c.pay)) setPanel('pay');
                else if (c.kind === 'deposit') setPanel('deposit');
                else if (c.kind === 'fixedPay') setPanel('fixed');
                else setPanel(null);
              }}
              onClosePanel={closePanel}
              onConfirmPay={() => go(fixture.id === 'sim-aug-crash' ? 'sim-aug-deposit' : 'sim-feb-outcome')}
              onConfirmDeposit={() => go(fixture.id === 'sim-aug-crash' ? 'sim-aug-deposit' : next.id)}
              next={next}
              onContinue={confirmChoice}
            />
          </div>

          {!wide && (
            <div className="min-w-0 lg:max-h-[calc(100dvh-210px)] lg:overflow-y-auto lg:pr-0.5">
              <SidePanel state={state} onSellSneakers={sellSneakers} />
            </div>
          )}

          {state.step === 'adjust' && (
            <div className="mt-1 flex flex-col gap-2">
              <p className="rounded-[4px] bg-warn-soft px-3 py-2 text-[12px] font-semibold text-warn">
                {state.lastOutcome?.budgetReason ?? '바뀐 금액만큼 다른 항목을 줄여 합계를 맞추세요.'}
              </p>
              <BudgetEditor
                budget={budget}
                salary={state.profile.salary}
                onChange={setBudget}
                before={beforeBudget}
                confirmLabel="합계 맞추고 다음 달로"
                onConfirm={() => go('sim-jul-reveal')}
              />
            </div>
          )}
        </div>

        <p className="flex items-center gap-1.5 text-[10px] text-frame-mute">
          <CircleHelp size={11} aria-hidden /> 선택지에는 정답 표시가 없습니다. 잠긴 이유와 지불 수단의 경고만 사실대로 보여 줍니다.
          <span className="ml-auto hidden sm:inline">금리·수익률은 수업용 가정값입니다.</span>
        </p>
      </div>
    </AppFrame>
  );
}

function findChoice(state: GameState, choiceId: string): Choice | null {
  if (!state.current) return null;
  const { scene } = getScene(state.current);
  return scene.choices.find((c) => c.id === choiceId) ?? null;
}

function Metric({ label, children, sub }: { label: string; children: React.ReactNode; sub?: string }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold text-frame-mute">{label}</dt>
      <dd className="flex items-baseline gap-1.5 leading-tight text-frame">
        {children}
        {sub && <span className="text-[11px] font-medium text-frame-mute">{sub}</span>}
      </dd>
    </div>
  );
}

function StepContent({
  state,
  fixtureId,
  panel,
  selected,
  budget,
  onBudget,
  promptText,
  onSelect,
  onClosePanel,
  onConfirmPay,
  onConfirmDeposit,
  next,
  onContinue,
}: {
  state: GameState;
  fixtureId: string;
  panel: Panel;
  selected: Choice | null;
  budget: GameState['budget'];
  onBudget: (b: GameState['budget']) => void;
  promptText: string | null;
  onSelect: (c: Choice) => void;
  onClosePanel: () => void;
  onConfirmPay: () => void;
  onConfirmDeposit: () => void;
  next: { id: string; label: string };
  onContinue: () => void;
}) {
  if (state.step === 'payday') return <PaydayView state={state} onDone={onContinue} />;
  if (state.step === 'report') {
    return <ReportView state={state} onNext={onContinue} nextLabel={next.label} />;
  }
  if (state.step === 'adjust') return null;

  if (state.step === 'outcome' && state.lastOutcome) {
    return <OutcomeView state={state} outcome={state.lastOutcome} nextLabel={next.label} onContinue={onContinue} />;
  }

  const ref = state.current;
  if (!ref) return null;
  const { event, scene } = getScene(ref);

  if (panel === 'pay' && selected?.pay) {
    return <PayPanel state={state} choice={selected} onBack={onClosePanel} onConfirm={onConfirmPay} />;
  }
  if (panel === 'fixed' && selected?.fixedPay) {
    return <FixedPayPanel state={state} choice={selected} onBack={onClosePanel} onConfirm={() => onContinue()} />;
  }
  if (panel === 'deposit' && selected?.deposit) {
    return <DepositPanel state={state} choice={selected} onBack={onClosePanel} onConfirm={onConfirmDeposit} />;
  }

  return (
    <div className="flex flex-1 flex-col gap-2.5">
      <SceneCard event={event} scene={scene} state={state} />
      <ChoiceList scene={scene} event={event} state={state} selectedId={selected?.id ?? null} onSelect={onSelect} />
      <div className="cut flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          {promptText && <PromptButton text={promptText} />}
          <p className="truncate text-[11px] text-mute">
            {selected ? `고른 선택 · ${selected.label}` : '선택지를 고르면 다음 단계가 열립니다.'}
          </p>
        </div>
        <Button variant="plate" disabled={!selected} onClick={onContinue}>
          {!selected ? '선택지를 고르세요' : '이 선택으로 확정'} <ArrowRight size={16} />
        </Button>
      </div>
    </div>
  );
}
