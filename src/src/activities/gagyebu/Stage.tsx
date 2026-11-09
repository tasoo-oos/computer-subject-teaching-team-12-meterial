// 가계부 활동 전면(TV) 화면 (docs/live-api.md §10.5, 계획 §3 "TV 집계의 원칙").
// 1920×1080 논리 캔버스(StageContent 안)에 그린다. 버튼·조작 요소 없음.
// 원칙: 분포 막대는 모두 같은 색·데이터 순서(정렬·순위 없음), 자동 처리는 별도 줄,
// 설문 답·소비 성향은 어디에도 분포로 나오지 않는다, 닉네임은 입장 벽과 발표뿐.
// stats는 null일 수 있다(비트 불일치·미계산, §5.7) — 중립 안내로 대체하고 절대 깨지지 않는다.
import {
  ACCOUNT_ORDER,
  ACCOUNTS,
  ENDINGS,
  EVENT_TYPE_LABEL,
  GUIDE_CARDS,
  SALARY_SPREAD,
  eventForMonth,
  formatMan,
  formatPct,
  monthLabel,
  type AccountId,
  type Choice,
  type GameEvent,
  type GameState,
  type Scene,
} from '@gagyebu/core';
import type { ProgressInfo } from '@gagyebu/live';
import type { GagyebuStats, SceneTally } from '@gagyebu/activity-gagyebu';
import { PassbookCover } from '../../components/PassbookCover.tsx';
import { KIND_META } from '../../components/sim/kinds.ts';
import { PresentationView } from '../../screens/ResultPresentation.tsx';
import { DistributionBars } from '../../stage/DistributionBars.tsx';
import { JoinWall } from '../../stage/JoinWall.tsx';
import { StageMessage } from '../../stage/StageContent.tsx';
import { StatTile } from '../../stage/StatTile.tsx';
import type { StageProps } from '../registry.ts';

export function Stage(props: StageProps<GameState | null, GagyebuStats>) {
  const { beat, revealed, stats, spotlight, spotlightName, progress, code } = props;
  const id = beat.id;

  if (id === 'join') {
    if (!code) return <StageMessage title="입장" sub="수업 코드를 확인하는 중이에요" />;
    return (
      <JoinWall
        code={code}
        joined={stats?.kind === 'join' ? stats.joined : null}
        connected={progress?.connected ?? (stats?.kind === 'join' ? stats.connected : null)}
        nicknames={stats?.kind === 'join' ? stats.nicknames : []}
      />
    );
  }
  if (id === 'salary') return <SalaryStage stats={stats} />;
  if (id === 'survey') return <SurveyStage progress={progress} />;
  if (id === 'survey-result') return <SurveyResultStage />;
  const guide = /^guide-(\d+)$/.exec(id);
  if (guide) return <GuideStage index={Number(guide[1]) - 1} />;
  if (id === 'budget') return <BudgetStage revealed={revealed} stats={stats} progress={progress} />;
  const m = /^m(\d+)$/.exec(id);
  if (m) {
    const month = Number(m[1]);
    if (month === 12) return <SettlementStage revealed={revealed} stats={stats} />;
    if (month === 1 || month === 4 || month === 10) return <QuietMonthStage month={month} revealed={revealed} stats={stats} />;
    return <EventMonthStage month={month} revealed={revealed} stats={stats} />;
  }
  if (id === 'present') return <PresentStage spotlight={spotlight} spotlightName={spotlightName} />;
  return <StageMessage title={beat.label} sub="이 단계의 전면 화면은 준비 중이에요" />;
}

// ── 공용 틀 ──────────────────────────────────────────────────────────────────

/** TV 화면 공용 틀: 머리말(kicker) + 큰 제목 + 본문. 1920×1080 안쪽 여백은 JoinWall과 같다 */
function StageShell({
  kicker,
  title,
  children,
  wide,
}: {
  kicker?: string;
  title?: string;
  children: React.ReactNode;
  /** 제목 없이 본문에 자리를 다 주는 레이아웃 */
  wide?: boolean;
}) {
  return (
    <div className="paper-texture flex size-full flex-col px-[110px] py-[42px]">
      {kicker ? <p className="text-[28px] font-semibold text-ink-2">{kicker}</p> : null}
      {title ? <h1 className={`display leading-[1.06] text-ink ${wide ? '' : 'mt-1.5 text-[72px]'}`}>{title}</h1> : null}
      <div className={`min-h-0 flex-1 ${title ? 'mt-[20px]' : ''}`}>{children}</div>
    </div>
  );
}

/** "집계를 준비하는 중" — stats가 null일 때(비트 불일치·미계산) 깨지지 않게 */
function StatsPending({ what }: { what: string }) {
  return (
    <p className="hatch inline-block rounded-[8px] bg-sheet px-6 py-4 text-[28px] font-semibold text-ink-3 shadow-[0_0_0_1px_var(--color-rule)]">
      {what} 집계를 준비하는 중이에요
    </p>
  );
}

/** 완료 현황 타일 — progress는 lesson.settings.showProgressOnStage일 때만 온다 */
function ProgressTiles({ progress, label = '완료' }: { progress: { done: number; connected: number; total: number } | null; label?: string }) {
  if (!progress) return null;
  return (
    <div className="flex gap-5">
      <StatTile value={progress.done} label={`${label} · 접속 ${progress.connected}명`} unit="명" className="flex-1" />
      <StatTile value={progress.total} label="전체" unit="명" className="flex-1" />
    </div>
  );
}

/** 값들을 익명 점으로 펼친 띠 (월급 분포·순자산 분포). 같은 색 점, 정렬 없음.
 *  기준/평균 표식(midValue)은 실제 값의 x 위치에 선다 — 띠의 중앙이 아니라(§14 #125). */
function DotBand({
  values,
  lo,
  hi,
  loLabel,
  midLabel,
  midValue,
  hiLabel,
}: {
  values: number[];
  lo: number;
  hi: number;
  loLabel: string;
  midLabel?: string;
  /** 표식의 실제 값 (월급 기준·순자산 평균). 없으면 표식을 그리지 않는다 */
  midValue?: number;
  hiLabel: string;
}) {
  const span = Math.max(1, hi - lo);
  const midPos = midValue !== undefined ? Math.min(1, Math.max(0, (midValue - lo) / span)) : null;
  const dot = (pos: number) => 4 + pos * 92; // 점/표식의 left %
  return (
    <div>
      <div className="relative h-[150px] rounded-panel bg-sheet shadow-[0_0_0_1px_var(--color-rule)]">
        {midPos !== null ? <span aria-hidden className="absolute inset-y-6 w-px -translate-x-1/2 bg-ink-3" style={{ left: `${dot(midPos)}%` }} /> : null}
        {values.map((v, i) => {
          const pos = Math.min(1, Math.max(0, (v - lo) / span));
          // 겹침을 줄이는 결정적 지터 (정렬·순위가 아니라 그리기 위치일 뿐)
          const jitter = ((i * 37) % 7) - 3;
          return (
            <span
              key={i}
              aria-hidden
              className="absolute size-[20px] -translate-x-1/2 rounded-full bg-ink"
              style={{ left: `${dot(pos)}%`, top: `calc(50% + ${jitter * 13}px)` }}
            />
          );
        })}
        {values.length === 0 ? <p className="absolute inset-0 grid place-items-center text-[28px] text-ink-3">아직 데이터가 없어요</p> : null}
      </div>
      <div className="num relative mt-3 text-[28px] text-ink-3">
        <div className="flex justify-between">
          <span>{loLabel}</span>
          <span>{hiLabel}</span>
        </div>
        {midLabel && midPos !== null ? (
          <span
            className="absolute top-0 -translate-x-1/2 whitespace-nowrap font-semibold text-ink-2"
            style={{ left: `${Math.min(85, Math.max(15, dot(midPos)))}%` }}
          >
            {midLabel}
          </span>
        ) : null}
      </div>
    </div>
  );
}

/** 장면 카드 큰 모양(채널 라벨 + 제목 + 본문 + 공개 숫자) — 학생용 SceneCard의 TV 버전 */
function SceneBig({ event, scene }: { event: GameEvent; scene: Scene }) {
  const showTitle = !(scene.channel === 'news' && scene.title);
  return (
    <article className="overflow-hidden rounded-panel bg-sheet shadow-[0_0_0_1px_var(--color-rule)]">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-rule-soft px-10 py-3">
        <span className="rounded-[6px] bg-ink px-3 py-1 text-[24px] font-semibold text-white">{EVENT_TYPE_LABEL[event.type]}</span>
        <span className="rounded-[6px] border border-rule px-3 py-1 text-[24px] font-semibold text-ink-2">사건 {event.code}</span>
        <span className="ml-auto text-[24px] font-semibold text-ink-3">{channelLabel(scene)}</span>
        {showTitle ? (
          <h2 className="basis-full text-[42px] font-bold leading-tight">{scene.title ?? event.title}</h2>
        ) : null}
      </header>
      <div className="px-10 py-5">
        {scene.channel === 'news' ? (
          <p className="display text-[44px] leading-tight">{scene.title}</p>
        ) : null}
        <p className="mt-2 max-w-[1400px] text-[32px] leading-relaxed">{scene.text}</p>
      </div>
      {scene.reveal?.length ? (
        <section aria-label="이 장면에서 확인된 숫자" className="border-t border-rule bg-mark/40 px-10 py-4">
          <div className="flex flex-wrap gap-x-16 gap-y-3">
            {scene.reveal.map((it) => (
              <div key={it.label}>
                <p className="text-[24px] font-medium text-ink-2">{it.label}</p>
                <p className="num text-[40px] font-bold leading-tight text-ink">{it.value}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </article>
  );
}

function channelLabel(scene: Scene): string {
  switch (scene.channel) {
    case 'messenger':
      return `메신저 · ${scene.speaker ?? ''}`;
    case 'sms':
      return '문자';
    case 'news':
      return '뉴스 속보';
    case 'app':
      return '앱 알림';
    default:
      return '상황 설명';
  }
}

/** 읽기 전용 선택지 목록(공개 전) — 데이터 순서 그대로, 모두 같은 생김새. 좋고 나쁨 힌트 없음 */
function ChoiceListTV({ choices }: { choices: Choice[] }) {
  return (
    <ul className="grid grid-cols-2 gap-x-8 gap-y-3">
      {choices.map((c) => (
        <li
          key={c.id}
          className="rounded-[10px] bg-sheet px-7 py-3.5 shadow-[0_0_0_1.5px_var(--color-rule)]"
        >
          <p className="text-[30px] font-semibold leading-snug">{c.label}</p>
          {c.detail ? <p className="num mt-0.5 text-[26px] text-ink-2">{c.detail}</p> : null}
          <p className="mt-1 text-[26px] text-ink-3">{KIND_META[c.kind].label}</p>
        </li>
      ))}
    </ul>
  );
}

// ── 비트별 화면 ──────────────────────────────────────────────────────────────

function SalaryStage({ stats }: { stats: GagyebuStats | null }) {
  const base = stats?.kind === 'salary' ? stats.baseSalary : null;
  const salaries = stats?.kind === 'salary' ? stats.salaries : [];
  const lo = (base ?? 0) * (1 - SALARY_SPREAD);
  const hi = (base ?? 0) * (1 + SALARY_SPREAD);
  return (
    <StageShell kicker="월급 공개" title="반의 월급">
      <p className="max-w-[1300px] text-[30px] leading-relaxed text-ink-2">
        월급은 기준 월급 {base ? formatMan(base) : '—'}의 ±{Math.round(SALARY_SPREAD * 100)}% 안에서 정해졌어요.
        누구의 월급인지는 나오지 않습니다. 월급이 달라도 결과의 차이는 운이 아니라 선택에서 나옵니다.
      </p>
      <div className="mt-[48px]">
        {base ? (
          <DotBand
            values={salaries}
            lo={lo}
            hi={hi}
            loLabel={formatMan(lo)}
            midLabel={`기준 ${formatMan(base)}`}
            midValue={base}
            hiLabel={formatMan(hi)}
          />
        ) : (
          <StatsPending what="월급" />
        )}
      </div>
    </StageShell>
  );
}

function SurveyStage({ progress }: { progress: ProgressInfo | null }) {
  return (
    <StageShell kicker="소비습관 설문" title="설문 중…">
      <div className="grid gap-8">
        <p className="max-w-[1300px] text-[30px] leading-relaxed text-ink-2">
          학생들이 7개 문항에 답하는 중이에요. 설문 답과 소비 성향은 개인 성향 정보라서 이 화면에는 아무것도 공개되지 않습니다.
        </p>
        <ProgressTiles progress={progress} />
      </div>
    </StageShell>
  );
}

function SurveyResultStage() {
  return (
    <StageShell kicker="설문 결과" title="결과는 각자의 화면에서">
      <ol className="grid max-w-[1300px] gap-5 text-[32px] leading-relaxed">
        <li className="flex gap-4">
          <span className="num font-bold text-in">1</span>
          <span>자기 화면에서 소비 성향 유형과 한 줄 조언을 확인하세요.</span>
        </li>
        <li className="flex gap-4">
          <span className="num font-bold text-in">2</span>
          <span>답한 내용으로 만든 추천 가계부 미리보기가 함께 나옵니다. 다음 단계에서 직접 고칠 수 있어요.</span>
        </li>
        <li className="flex gap-4">
          <span className="num font-bold text-in">3</span>
          <span>유형 분포는 공개되지 않습니다 — 서로 비교하지 않고 자기 결과만 보세요.</span>
        </li>
      </ol>
    </StageShell>
  );
}

function GuideStage({ index }: { index: number }) {
  const card = GUIDE_CARDS[index];
  if (!card) return <StageMessage title="안내 카드" sub="이 단계의 전면 화면은 준비 중이에요" />;
  const isSplit = card.id === 'split-accounts';
  return (
    <StageShell kicker={`안내 카드 ${index + 1} / ${GUIDE_CARDS.length}`} title={card.title}>
      <div className={isSplit ? '' : 'grid grid-cols-[1.1fr_1fr] gap-x-[80px]'}>
        <div>
          <p className="max-w-[900px] text-[36px] font-medium leading-relaxed">{card.lead}</p>
          {isSplit ? null : (
            <ul className="mt-8 space-y-5">
              {card.points.map((p) => (
                <li key={p} className="flex gap-4 border-b border-rule-soft pb-4 text-[30px] leading-relaxed">
                  <span aria-hidden className="mt-4 size-2.5 flex-none rounded-full bg-ink" />
                  {p}
                </li>
              ))}
            </ul>
          )}
        </div>
        {isSplit ? <AccountShelfTV /> : null}
      </div>
      {isSplit ? (
        <ul className="mt-6 grid grid-cols-2 gap-x-12 gap-y-2 text-[28px] leading-relaxed text-ink-2">
          {card.points.map((p) => (
            <li key={p} className="flex gap-3">
              <span aria-hidden className="mt-4 size-2 flex-none rounded-full bg-ink-3" />
              {p}
            </li>
          ))}
        </ul>
      ) : null}
      {card.tip ? (
        <p className="mt-8 max-w-[1400px] rounded-[10px] bg-mark/70 px-8 py-5 text-[30px]">
          <span className="font-bold">기억할 것 </span>
          {card.tip}
        </p>
      ) : null}
    </StageShell>
  );
}

/** 계좌 6종 통장 표지(안내 3번 카드 TV 버전) — 1920px 폭에 6권 한 줄로 */
function AccountShelfTV() {
  return (
    <ul className="grid grid-cols-6 gap-x-6">
      {ACCOUNT_ORDER.map((id) => {
        const a = ACCOUNTS[id];
        return (
          <li key={id} className="flex flex-col">
            <PassbookCover id={id}>
              <p className="text-[15px] opacity-90">권장</p>
              <p className="num text-[19px] font-bold leading-tight">{a.guide}</p>
            </PassbookCover>
            <div className="mt-2 px-1 text-[24px] leading-snug">
              <p className="font-semibold text-ink">{a.purpose}</p>
              <p className="mt-0.5 text-[22px] text-ink-3">
                {a.annualRate === null ? (id === 'invest' ? '수익률이 매달 바뀜' : '이자 없음') : `연 ${formatPct(a.annualRate)} (가정)`}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function BudgetStage({ revealed, stats, progress }: { revealed: boolean; stats: GagyebuStats | null; progress: ProgressInfo | null }) {
  if (!revealed) {
    return (
      <StageShell kicker="가계부 작성" title="가계부 작성 중">
        <div className="grid gap-8">
          <p className="max-w-[1300px] text-[30px] leading-relaxed text-ink-2">
            월급을 남김없이 나누는 중이에요. 자동이체로 먼저 떼어 둘 돈과 생활비 통장에서 쓸 돈을 정합니다.
          </p>
          <ProgressTiles progress={progress} label="확정" />
          <p className="text-[28px] text-ink-3">공개하면 평균 저축률과 계좌별 배분 분포를 보여 줘요.</p>
        </div>
      </StageShell>
    );
  }
  const budget = stats?.kind === 'budget' ? stats : null;
  const avgRate = budget && budget.savingsRates.length > 0 ? budget.savingsRates.reduce((a, b) => a + b, 0) / budget.savingsRates.length : null;
  const avgShares = (() => {
    const out: { id: AccountId; share: number }[] = [];
    if (!budget || budget.shares.length === 0) return out;
    for (const id of ACCOUNT_ORDER) {
      out.push({ id, share: budget.shares.reduce((a, s) => a + (s[id] ?? 0), 0) / budget.shares.length });
    }
    return out;
  })();
  return (
    <StageShell kicker="가계부 작성" title="반의 가계부">
      {!budget ? (
        <StatsPending what="가계부" />
      ) : (
        <div className="grid grid-cols-[420px_1fr] gap-x-[70px]">
          <div className="grid gap-5">
            <StatTile value={avgRate === null ? '—' : formatPct(avgRate)} label="평균 저축률" />
            <StatTile value={budget.savingsRates.length} label="확정한 학생" unit="명" />
          </div>
          <div>
            <p className="mb-4 text-[30px] font-bold">계좌별 배분 (평균)</p>
            <div className="flex flex-col gap-4">
              {avgShares.map(({ id, share }) => (
                <div key={id} className="flex items-center gap-5">
                  <p className="w-[300px] shrink-0 text-[28px] font-semibold text-ink">{ACCOUNTS[id].label}</p>
                  <div className="h-[40px] flex-1 overflow-hidden rounded-[6px] bg-sheet shadow-[inset_0_0_0_1.5px_var(--color-rule-soft)]">
                    <div className="h-full rounded-[4px] bg-ink" style={{ width: `${share * 100}%` }} />
                  </div>
                  <p className="num w-[120px] shrink-0 text-right text-[28px] font-bold">{formatPct(share)}</p>
                </div>
              ))}
            </div>
            {/* 미제출 인원은 완료 인원과 같은 종류라 통제 페이지 전용이다 — progress가 제공될 때
                (lesson.settings.showProgressOnStage)만 함께 보여 준다(§14 #125) */}
            {progress !== null && budget.autoCount > 0 ? (
              <p className="mt-5 self-start rounded-[6px] bg-mark/70 px-4 py-1.5 text-[24px] font-semibold text-ink">
                아직 제출하지 않아 자동 처리될 수 있어요 {budget.autoCount}명
              </p>
            ) : null}
          </div>
        </div>
      )}
    </StageShell>
  );
}

/** 조용한 달(1·4·10월): "돈이 쌓이는 달" + 반 순자산 분포. 예약 장면(check4·revolving)이 있으면 공개 후 분포 */
function QuietMonthStage({ month, revealed, stats }: { month: number; revealed: boolean; stats: GagyebuStats | null }) {
  const ms = stats?.kind === 'month' ? stats : null;
  const values = ms?.netWorths ?? [];
  const lo = values.length ? Math.min(...values) : 0;
  const hi = values.length ? Math.max(...values) : 1;
  const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
  const scheduled = ms?.scheduled ?? [];
  return (
    <StageShell kicker={`${monthLabel(month)} · ${month === 1 ? '연습 달' : '조용한 달'}`} title="돈이 쌓이는 달">
      <div className={scheduled.length > 0 && revealed ? 'grid grid-cols-[1fr_1fr] gap-x-[80px]' : ''}>
        <div>
          <p className="max-w-[1000px] text-[30px] leading-relaxed text-ink-2">
            {month === 1
              ? '1월은 연습입니다. 월급이 들어오면 자동이체가 먼저 돈을 나눠 두고, 생활비 통장에 남은 돈으로 한 달을 삽니다.'
              : '이 달에는 특별한 사건이 없어요. 매달 반복되는 월급·자동이체·지출이 그대로 순자산을 만듭니다.'}
          </p>
          <div className="mt-8">
            {ms ? (
              <DotBand
                values={values}
                lo={Math.min(lo, 0)}
                hi={hi}
                loLabel={formatMan(Math.min(lo, 0))}
                midLabel={avg === null ? undefined : `평균 ${formatMan(avg)}`}
                midValue={avg ?? undefined}
                hiLabel={formatMan(hi)}
              />
            ) : (
              <StatsPending what="순자산" />
            )}
            <p className="mt-4 text-[28px] font-semibold text-ink-2">반의 순자산 분포 (익명)</p>
          </div>
        </div>
        {scheduled.length > 0 && revealed ? (
          <div className="min-h-0">
            <p className="mb-4 text-[30px] font-bold">이 달에 다시 찾아온 장면</p>
            <div className="flex flex-col gap-7">
              {scheduled.map((t) => (
                <SceneTallyBlock key={t.sceneId} tally={t} />
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </StageShell>
  );
}

/** 사건 있는 달: 공개 전 장면 크게 + 읽기 전용 선택지, 공개 후 분포 + 이어진 장면 + 교훈 */
function EventMonthStage({ month, revealed, stats }: { month: number; revealed: boolean; stats: GagyebuStats | null }) {
  const event = eventForMonth(month);
  if (!event) return <StageMessage title={monthLabel(month)} sub="이 달의 전면 화면은 준비 중이에요" />;
  const ms = stats?.kind === 'month' ? stats : null;
  const entryScene = event.scenes[event.entry];

  if (!revealed) {
    return (
      <StageShell kicker={`${monthLabel(month)} · 사건`} title={event.title}>
        <div className="grid grid-cols-[1.05fr_1fr] items-start gap-x-[60px]">
          {entryScene ? <SceneBig event={event} scene={entryScene} /> : null}
          {entryScene ? (
            <div>
              <p className="mb-3 text-[28px] font-bold text-ink-2">선택지 — 학생들이 고르는 중이에요</p>
              <ChoiceListTV choices={entryScene.choices} />
            </div>
          ) : null}
        </div>
      </StageShell>
    );
  }

  const entry = ms?.entry ?? null;
  const autoLine = ms && ms.autoCount > 0 ? `자동 처리 ${ms.autoCount}명` : null;
  return (
    <StageShell kicker={`${monthLabel(month)} · 사건`} title={event.title}>
      {!ms ? (
        <StatsPending what="선택" />
      ) : (
        <div className="grid min-h-0 grid-cols-[1.25fr_1fr] gap-x-[70px]">
          <div className="min-h-0">
            {entry ? (
              <>
                <p className="mb-4 text-[30px] font-bold">{entry.title} — 선택 분포</p>
                <DistributionBars items={entry.choices.map((c) => ({ label: c.label, count: c.count }))} autoLine={autoLine} />
              </>
            ) : null}
          </div>
          <div className="min-h-0">
            {[...ms.chained, ...ms.scheduled].length > 0 ? (
              <div className="flex flex-col gap-4">
                {[...ms.chained, ...ms.scheduled].map((t) => (
                  <SceneTallyBlock key={t.sceneId} tally={t} />
                ))}
              </div>
            ) : (
              <p className="text-[28px] text-ink-3">이어진 장면은 아직 없어요.</p>
            )}
            {event.lesson ? (
              <p className="mt-5 rounded-[10px] bg-mark/70 px-7 py-4 text-[28px] leading-relaxed">
                <span className="font-bold">교훈 </span>
                {event.lesson}
              </p>
            ) : null}
          </div>
        </div>
      )}
    </StageShell>
  );
}

/** 이어진·예약 장면 하나의 분포 블록 — 좁은 오른쪽 기둥에서는 막대가 알아서 쌓인다(§14 #125) */
function SceneTallyBlock({ tally }: { tally: SceneTally }) {
  return (
    <div>
      <p className="mb-1 text-[28px] font-bold text-ink">
        {tally.title}
        <span className="num ml-3 text-[24px] font-semibold text-ink-3">{tally.reached}명 도달</span>
      </p>
      <DistributionBars
        items={tally.choices.map((c) => ({ label: c.label, count: c.count }))}
        total={tally.reached}
      />
    </div>
  );
}

/** 12월 결산: 공개 전 "결산 중", 공개 후 엔딩 분포 + 도전과제 달성률 */
function SettlementStage({ revealed, stats }: { revealed: boolean; stats: GagyebuStats | null }) {
  if (!revealed) {
    return (
      <StageShell kicker="12월 결산" title="결산 중">
        <p className="max-w-[1300px] text-[30px] leading-relaxed text-ink-2">
          12월 월급과 함께 적금이 만기되고, 1년의 최종 잔고·순자산·엔딩·도전과제가 정리됩니다. 끝나면 엔딩 분포가 공개돼요.
        </p>
      </StageShell>
    );
  }
  const st = stats?.kind === 'settlement' ? stats : null;
  return (
    <StageShell kicker="12월 결산" title="1년 결산">
      {!st ? (
        <StatsPending what="결산" />
      ) : (
        <div className="grid min-h-0 grid-cols-[1.15fr_1fr] gap-x-[70px]">
          <div>
            <p className="mb-4 text-[30px] font-bold">엔딩 분포</p>
            <DistributionBars
              items={st.endings.map((e) => ({ label: ENDINGS[e.endingId].title, count: e.count }))}
              autoLine={`자동 처리를 거친 학생 ${st.autoCount}명`}
            />
          </div>
          <div className="min-h-0">
            <p className="mb-4 text-[30px] font-bold">도전과제 달성률</p>
            {/* 13개 전부 보이게 두 단으로 (한 단 13줄은 1080px를 넘는다, §14 #125) */}
            <div className="grid grid-cols-2 gap-x-8 gap-y-3">
              {st.achievements.map((a) => (
                <div key={a.achievementId}>
                  <p className="truncate text-[28px] leading-tight font-semibold text-ink">{a.label}</p>
                  <div className="mt-1 flex items-center gap-3">
                    <div className="h-[22px] flex-1 overflow-hidden rounded-[5px] bg-sheet shadow-[inset_0_0_0_1.5px_var(--color-rule-soft)]">
                      <div className="h-full rounded-[4px] bg-ink" style={{ width: `${a.rate * 100}%` }} />
                    </div>
                    <p className="num w-[100px] shrink-0 text-right text-[26px] font-bold">{formatPct(a.rate)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </StageShell>
  );
}

/** 발표 비트: 지정한 학생의 결과 크게 (닉네임은 발표뿐 — PresentationView 안에 있다) */
/** 발표 비트: 지정한 학생의 결과 크게. 닉네임은 발표 때만 TV에 나온다(계획 §0).
 *  닉네임은 서버가 주는 spotlightName(§14 #132 — rename 반영)을 우선하고, 없으면 상태의 profile.nickname. */
function PresentStage({ spotlight, spotlightName }: { spotlight: GameState | null; spotlightName: string | null }) {
  if (!spotlight) {
    return (
      <StageMessage
        title="발표"
        sub="통제 페이지에서 발표자를 지정하면 그 학생의 결과가 이 화면에 커집니다"
      />
    );
  }
  if (!spotlight.settlement) {
    return <StageMessage title="발표" sub="발표자의 결과를 준비하는 중이에요" />;
  }
  const name = spotlightName ?? spotlight.profile.nickname;
  const state =
    name === spotlight.profile.nickname
      ? spotlight
      : { ...spotlight, profile: { ...spotlight.profile, nickname: name } };
  // 발표자 이름을 크게 — 발표 때만 닉네임이 TV에 나온다(계획 §0). "발표 · {닉네임}" 머리표는
  // PresentationView의 머리말 자리에 흐름으로 들어간다(tv=true). 절대 배치 머리표는 작은
  // 머리말과 겹쳤다 — 오버레이를 없애고 머리말을 머리표로 바꿔 해결(S7).
  return <PresentationView state={state} tv />;
}
