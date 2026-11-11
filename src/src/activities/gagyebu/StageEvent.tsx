// TV 사건 화면(김새롬, 원장 11-12): 태수님 화면 컨셉(통장 종이 · 남색 잉크 · Black Han Sans 제목 · 괘선) 그대로, 색으로 구분만 더한다.
// 정보는 원래 화면에서 빼지 않는다(유형 · 사건 코드 · 장면 · 확인된 숫자 · 선택지 방식 · 이어진 장면 전부).
//  - 장면은 채널별 실물(뉴스 = 신문 조각 · 메신저/문자 = 폰 · 앱 = 알림 · 상황 = 줄 노트), 색과 선은 태수님 팔레트
//  - 선택지는 통장 거래 줄(카드를 쌓지 않음): 글자 도장 · 선택(+ 금액 · 조건) · 방식. 색은 맨 앞 도장 하나에만
//  - 색 = 선택지 종류(KIND_META). 생활비 주황 = 돈이 나감 · 입금 파랑 = 돈이 안 나감 · 투자 보라 = 결과는 나중에 · 회청 = 가계부를 고침.
//    좋고 나쁨 힌트가 없게 빨강은 선택지에 쓰지 않는다
//  - 공개 후: 덩어리 전체를 광학 중심(45:55)에 두고, 줄 · 묶음 간격으로 화면을 고르게 쓴다(위에서 채우고 아래를 비우지 않음)
import { EVENTS, EVENT_TYPE_LABEL, monthLabel, type Choice, type ChoiceKind, type GameEvent, type Scene } from '@gagyebu/core';
import type { GagyebuStats, SceneTally } from '@gagyebu/activity-gagyebu';
import type { CSSProperties, ReactNode } from 'react';
import { KIND_META } from '../../components/sim/kinds.ts';

export type Flow = 'spend' | 'keep' | 'later' | 'plan';
export const FLOW: Record<Flow, { color: string; label: string; ink: string }> = {
  spend: { color: 'var(--color-acc-living)', label: '돈이 나감', ink: 'var(--color-ink)' },
  keep: { color: 'var(--color-in)', label: '돈이 안 나감', ink: '#fff' },
  later: { color: 'var(--color-acc-invest)', label: '결과는 나중에', ink: '#fff' },
  plan: { color: 'var(--color-ink-3)', label: '가계부를 고침', ink: '#fff' },
};
const FLOW_OF: Record<ChoiceKind, Flow> = { pay: 'spend', fixedPay: 'spend', free: 'keep', deposit: 'keep', gamble: 'later', budget: 'plan' };
export const flowOf = (kind: ChoiceKind | undefined): Flow => (kind ? FLOW_OF[kind] : 'spend');
const ORDER: Flow[] = ['spend', 'keep', 'later', 'plan'];

const SOFT_SHADOW = '0 12px 28px rgba(24,38,74,.14), 0 2px 4px rgba(24,38,74,.10)';
const RING = '0 0 0 1.5px var(--color-rule)';
const LETTER = 'ABCDEFG';

// ── 공용 조각 ─────────────────────────────────────────────
/** 문장 속 금액 · 비율에 형광펜 */
function Num({ text }: { text: string }) {
  const parts = text.split(/(\d[\d,.]*\s?(?:만\s?원|원|%|개월|켤레|장))/g);
  return <>{parts.map((p, i) => (i % 2 ? <span key={i} className="num rounded-[4px] bg-mark px-1">{p}</span> : <span key={i}>{p}</span>))}</>;
}

export function FlowLegend({ items }: { items: [string, string][] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-8 gap-y-2 text-[24px] text-ink-2">
      {items.map(([color, label]) => (
        <span key={label} className="flex items-center gap-3">
          <span className="size-[20px] rounded-[4px]" style={{ background: color }} />
          {label}
        </span>
      ))}
    </div>
  );
}
const legendOf = (flows: Flow[]): [string, string][] => ORDER.filter((f) => flows.includes(f)).map((f) => [FLOW[f].color, FLOW[f].label]);

/** 태수님 틀: 왼쪽 축 112 · 머리말 28 · 제목(사건 이름) 72 */
function EventFrame({ kicker, title, children }: { kicker: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="paper-texture flex size-full flex-col px-[112px] pt-[56px] pb-[48px] text-ink">
      <p className="flex items-center gap-4 text-[28px] font-semibold leading-none text-ink-2">{kicker}</p>
      <h1 className="display mt-4 text-[72px] leading-[1.1]">{title}</h1>
      <div className="mt-10 flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
/** 광학 중심(위 45 : 아래 55)에 덩어리 하나를 둔다. 넘치면 위아래 여백부터 줄어든다 */
function Optical({ children }: { children: ReactNode }) {
  return (
    <>
      <div className="min-h-0" style={{ flex: 45 }} />
      <div className="shrink-0">{children}</div>
      <div className="min-h-0" style={{ flex: 55 }} />
    </>
  );
}
function Kicker({ month, event }: { month: number; event: GameEvent }) {
  return (
    <>
      <span>{monthLabel(month)}</span>
      <span className="rounded-[6px] bg-ink px-3 py-1 text-[24px] text-white">{EVENT_TYPE_LABEL[event.type]}</span>
      <span className="rounded-[6px] px-3 py-1 text-[24px]" style={{ boxShadow: RING }}>사건 {event.code}</span>
    </>
  );
}

function Tape({ style }: { style: CSSProperties }) {
  return <span aria-hidden className="absolute h-[36px] w-[132px]" style={{ background: 'rgba(251,233,169,.85)', boxShadow: '0 1px 2px rgba(24,38,74,.12)', ...style }} />;
}

// ── 장면: 채널별 실물 ─────────────────────────────────────
function NewsClip({ scene }: { scene: Scene }) {
  return (
    <div className="relative w-[780px]" style={{ transform: 'rotate(-1.2deg)' }}>
      <Tape style={{ left: -28, top: -12, transform: 'rotate(-30deg)' }} />
      <Tape style={{ right: -28, top: -12, transform: 'rotate(28deg)' }} />
      <article
        className="px-10 pt-7 pb-8"
        style={{
          background: '#f8f6ef',
          backgroundImage: 'radial-gradient(rgba(24,38,74,.05) 1px, transparent 1px)',
          backgroundSize: '5px 5px',
          boxShadow: SOFT_SHADOW,
        }}
      >
        <div className="flex items-baseline justify-between border-b-[5px] border-double border-ink pb-2">
          <span className="display text-[30px]">가계부일보</span>
          <span className="text-[22px] font-semibold text-ink-2">{scene.speaker ?? '뉴스 속보'}</span>
        </div>
        <p className="display mt-5 text-[52px] leading-[1.15]">{scene.title}</p>
        <p className="mt-4 text-[28px] leading-[1.65]" style={scene.text.length > 90 ? { columnCount: 2, columnGap: 40, columnRule: '1px solid var(--color-rule-soft)' } : { maxWidth: 760 }}>
          <Num text={scene.text} />
        </p>
      </article>
    </div>
  );
}

function Phone({ scene, sms }: { scene: Scene; sms?: boolean }) {
  const who = scene.speaker ?? (sms ? '문자' : '메신저');
  return (
    <div className="w-[740px] rounded-[44px] bg-white px-9 pt-6 pb-10" style={{ boxShadow: `inset 0 0 0 4px var(--color-ink), ${SOFT_SHADOW}`, transform: 'rotate(1deg)' }}>
      <div className="mx-auto mb-5 h-[12px] w-[120px] rounded-full bg-ink" />
      <div className="flex items-center gap-4 border-b border-rule pb-4">
        <span className="grid size-[60px] place-items-center rounded-full bg-in-soft text-[28px] font-bold text-in">{who.replace(/[^가-힣A-Za-z○]/g, '').slice(-1) || '?'}</span>
        <span className="text-[30px] font-bold">{who}</span>
        <span className="ml-auto text-[24px] text-ink-3">{sms ? '문자' : '메신저'}</span>
      </div>
      <div className="relative mt-7 mr-12 rounded-bubble px-7 py-5 text-[32px] leading-[1.5]" style={{ background: sms ? 'var(--color-in-soft)' : 'var(--color-paper)' }}>
        <Num text={scene.text} />
      </div>
    </div>
  );
}

/** 상황 설명 = 통장 괘선 줄 노트 */
function LinedNote({ scene, event }: { scene: Scene; event: GameEvent }) {
  return (
    <div className="relative w-[760px]" style={{ transform: 'rotate(-0.8deg)' }}>
      <Tape style={{ left: '50%', top: -16, marginLeft: -66, transform: 'rotate(-3deg)' }} />
      <article
        className="bg-sheet px-12 pt-9 pb-10"
        style={{ boxShadow: SOFT_SHADOW, backgroundImage: 'repeating-linear-gradient(180deg, transparent 0 51px, var(--color-rule-soft) 51px 52px)', backgroundPosition: '0 26px' }}
      >
        {scene.title ? <p className="display text-[44px] leading-[1.2]">{scene.title}</p> : null}
        <p className="mt-3 text-[32px] leading-[52px]">
          <Num text={scene.text} />
        </p>
      </article>
    </div>
  );
}

function AppAlert({ scene }: { scene: Scene }) {
  return (
    <div className="w-[760px] rounded-[28px] bg-white px-9 py-7" style={{ boxShadow: `${RING}, ${SOFT_SHADOW}`, transform: 'rotate(0.8deg)' }}>
      <div className="flex items-center gap-4">
        <span className="size-[56px] rounded-[14px] bg-in-soft" style={{ boxShadow: RING }} />
        <span className="text-[28px] font-bold">{scene.speaker ?? '앱 알림'}</span>
        <span className="ml-auto text-[24px] text-ink-3">지금</span>
      </div>
      {scene.title ? <p className="display mt-5 text-[44px]">{scene.title}</p> : null}
      <p className="mt-2 text-[30px] leading-[1.55]">
        <Num text={scene.text} />
      </p>
    </div>
  );
}

function SceneView({ scene, event }: { scene: Scene; event: GameEvent }) {
  if (scene.channel === 'news') return <NewsClip scene={scene} />;
  if (scene.channel === 'messenger') return <Phone scene={scene} />;
  if (scene.channel === 'sms') return <Phone scene={scene} sms />;
  if (scene.channel === 'app') return <AppAlert scene={scene} />;
  return <LinedNote scene={scene} event={event} />;
}

/** 이 장면에서 확인된 숫자(태수님 SceneBig의 노랑 띠) */
function RevealRow({ scene }: { scene: Scene }) {
  if (!scene.reveal?.length) return null;
  return (
    <div className="mt-14 flex flex-wrap gap-x-14 gap-y-4 rounded-panel bg-mark/50 px-8 py-4" style={{ boxShadow: RING }}>
      {scene.reveal.map((it) => (
        <div key={it.label}>
          <p className="text-[24px] font-medium text-ink-2">{it.label}</p>
          <p className="num text-[44px] font-bold leading-tight">{it.value}</p>
        </div>
      ))}
    </div>
  );
}

/** 줄 맨 앞 글자 도장: 색 = 선택지 종류 */
function Stamp({ i, flow, size = 48 }: { i: number; flow: Flow; size?: number }) {
  return (
    <span className="display grid shrink-0 place-items-center rounded-[6px]" style={{ width: size, height: size, fontSize: Math.round(size * 0.55), background: FLOW[flow].color, color: FLOW[flow].ink }}>
      {LETTER[i]}
    </span>
  );
}

/** 선택지 = 통장 거래 줄: 도장 · 선택(아래에 금액 · 조건) · 방식 */
function ChoiceLedger({ choices }: { choices: Choice[] }) {
  const tight = choices.length >= 5;
  return (
    <div>
      <div className="flex items-end justify-between border-b-2 border-ink pb-3 text-[22px] font-semibold text-ink-3">
        <span>학생들이 폰에서 고르고 있어요</span>
        <span className="w-[200px] text-right">방식</span>
      </div>
      <ul>
        {choices.map((c, i) => {
          const f = flowOf(c.kind);
          return (
            <li key={c.id} className={`ledger-row flex items-center gap-6 ${tight ? 'py-4' : 'py-5'}`}>
              <Stamp i={i} flow={f} size={tight ? 44 : 48} />
              <div className="min-w-0 flex-1">
                <p className={`${tight ? 'text-[28px]' : 'text-[30px]'} font-semibold leading-snug`}>{c.label}</p>
                {c.detail ? <p className="num mt-1 text-[24px] leading-snug text-ink-2">{c.detail}</p> : null}
              </div>
              <span className="w-[200px] shrink-0 text-right text-[24px] leading-snug text-ink-2">{KIND_META[c.kind].label}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ── 공개 전 ───────────────────────────────────────────────
export function A4_EventPre({ month, event }: { month: number; event: GameEvent }) {
  const scene = event.scenes[event.entry]!;
  return (
    <EventFrame kicker={<Kicker month={month} event={event} />} title={event.title}>
      <Optical>
        <div className="flex items-center justify-between gap-16">
          <div className="flex min-w-0 flex-col items-start">
            <SceneView scene={scene} event={event} />
            <RevealRow scene={scene} />
          </div>
          <div className="w-[840px] shrink-0">
            <ChoiceLedger choices={scene.choices} />
          </div>
        </div>
      </Optical>
    </EventFrame>
  );
}

// ── 공개 후 ───────────────────────────────────────────────
interface Row { key: string; label: string; count: number; flow: Flow; letter?: number }

/** 이름 · 막대 · 숫자 한 줄(태수님 막대처럼 바탕 홈, 채움은 선택지 종류 색) */
function Bars({ rows, width = 300, labelW = 320, big }: { rows: Row[]; width?: number; labelW?: number; big?: boolean }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <ul className="flex flex-col" style={{ gap: big ? 20 : 12 }}>
      {rows.map((r) => (
        <li key={r.key} className="flex items-center gap-5">
          {r.letter !== undefined ? <Stamp i={r.letter} flow={r.flow} size={40} /> : null}
          <span className={`${big ? 'text-[28px]' : 'text-[24px]'} shrink-0 font-semibold leading-snug`} style={{ width: labelW }}>
            {r.label}
          </span>
          <span className="relative shrink-0 rounded-[4px] bg-sheet" style={{ width, height: big ? 28 : 20, boxShadow: '0 0 0 1px var(--color-rule-soft)' }}>
            {r.count > 0 ? <span className="absolute inset-y-0 left-0 rounded-[4px]" style={{ width: `${(r.count / max) * 100}%`, background: FLOW[r.flow].color }} /> : null}
          </span>
          <span className={`num ${big ? 'text-[34px]' : 'text-[28px]'} w-[72px] shrink-0 font-bold ${r.count ? 'text-ink' : 'text-ink-3'}`}>
            {r.count}
            <span className="text-[20px] font-semibold text-ink-3">명</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

const nextOf = (c: Choice) => (c.next as { scene?: string } | undefined)?.scene;
/** 받침에 맞는 목적격 조사 */
function objParticle(word: string): string {
  const ch = [...word.replace(/[」』"'\s]+$/, '')].pop() ?? '';
  const code = ch.charCodeAt(0) - 0xac00;
  if (code < 0 || code > 11171) return '를';
  return code % 28 ? '을' : '를';
}

/** 이어진 장면 하나: 어느 선택에서 왔나(모두) · 말이 있으면 그 말 · 그 장면에서 고른 것 */
function TallyBlock({ event: here, t }: { event: GameEvent; t: SceneTally }) {
  const event = here.scenes[t.sceneId] ? here : (Object.values(EVENTS).find((e) => e.scenes[t.sceneId]?.title === t.title) ?? Object.values(EVENTS).find((e) => e.scenes[t.sceneId]) ?? here);
  const other = event !== here;
  const all = Object.values(event.scenes).flatMap((s) => s.choices);
  const scene = event.scenes[t.sceneId];
  const from: string[] = [];
  for (const s of Object.values(event.scenes))
    s.choices.forEach((c, i) => {
      if (nextOf(c) === t.sceneId) from.push(s.id === event.entry ? LETTER[i]! : `「${c.label}」`);
    });
  const fromText = other
    ? `${monthLabel(event.month)} 「${event.title}」에서 이어짐 · ${t.reached}명`
    : from.length
      ? `${from.join(' · ')}${objParticle(from[from.length - 1]!)} 고른 ${t.reached}명`
      : `${t.reached}명`;
  const talk = scene && scene.channel !== 'narration' ? scene.text.split(/(?<=[.!?~])\s+/).slice(0, 2).join(' ') : null;
  return (
    <section>
      <p className="text-[28px] font-bold leading-snug">{scene?.speaker ?? t.title}</p>
      <p className="mt-1 text-[24px] font-semibold text-ink-3">{fromText}</p>
      {talk ? (
        <p className="mt-3 mr-12 rounded-bubble bg-sheet px-6 py-3 text-[24px] leading-[1.45]" style={{ boxShadow: RING }}>
          <Num text={talk} />
        </p>
      ) : null}
      {t.choices.length > 1 ? (
        <div className="mt-4">
          <Bars labelW={400} width={200} rows={t.choices.map((c) => ({ key: c.choiceId, label: c.label, count: c.count, flow: flowOf(all.find((x) => x.id === c.choiceId)?.kind) }))} />
        </div>
      ) : null}
    </section>
  );
}

export function A4_EventPost({ month, event, stats }: { month: number; event: GameEvent; stats: GagyebuStats | null }) {
  const ms = stats?.kind === 'month' ? stats : null;
  const entryScene = event.scenes[event.entry]!;
  const all = Object.values(event.scenes).flatMap((s) => s.choices);
  const rows: Row[] = (ms?.entry?.choices ?? [])
    .filter((c) => c.count > 0 || entryScene.choices.some((x) => x.id === c.choiceId))
    .map((c) => {
      const idx = entryScene.choices.findIndex((x) => x.id === c.choiceId);
      return { key: c.choiceId, label: c.label, count: c.count, flow: flowOf(all.find((x) => x.id === c.choiceId)?.kind), letter: idx >= 0 ? idx : undefined };
    });
  const total = rows.reduce((a, r) => a + r.count, 0);
  const tallies = [...(ms?.chained ?? []), ...(ms?.scheduled ?? [])].filter((t) => t.reached > 0);
  const allEvents = Object.values(EVENTS).flatMap((e) => Object.values(e.scenes).flatMap((sc) => sc.choices));
  const flows = [...rows.map((r) => r.flow), ...tallies.flatMap((t) => t.choices.map((c) => flowOf((all.find((x) => x.id === c.choiceId) ?? allEvents.find((x) => x.id === c.choiceId))?.kind)))];
  const longRight = tallies.reduce((a, t) => a + (t.choices.length > 1 ? t.choices.length : 0), 0) > 4;
  const lessonBox = event.lesson ? (
    <div className={`${longRight ? '' : 'mt-14 '}rounded-panel bg-mark px-8 py-6 text-[30px] leading-[1.5]`} style={{ boxShadow: RING }}>
      <b className="mr-4">교훈</b>
      {event.lesson}
    </div>
  ) : null;
  const kicker = (
    <>
      <Kicker month={month} event={event} />
      <span>
        · {total}명 참여{ms && ms.autoCount > 0 ? ` · 자동 처리 ${ms.autoCount}명` : ''}
      </span>
    </>
  );
  return (
    <EventFrame kicker={kicker} title={event.title}>
      <Optical>
        <div className="flex justify-between gap-16">
          <div className="flex w-[820px] shrink-0 flex-col gap-10">
            <div>
              <p className="text-[24px] font-semibold text-ink-3">처음 고른 것</p>
              <div className="mt-5">
                <Bars big rows={rows} width={tallies.length ? 260 : 360} labelW={360} />
              </div>
            </div>
            <FlowLegend items={legendOf(flows)} />
            {longRight ? lessonBox : null}
          </div>
          {tallies.length ? (
            <div className={`flex min-w-0 flex-1 flex-col ${longRight ? 'gap-8' : 'gap-10'} border-l border-rule pl-12`}>
              <p className="-mb-4 text-[24px] font-semibold text-ink-3">그다음 이야기</p>
              {tallies.map((t) => (
                <TallyBlock key={t.sceneId} event={event} t={t} />
              ))}
            </div>
          ) : null}
        </div>
        {longRight ? null : lessonBox}
      </Optical>
    </EventFrame>
  );
}
