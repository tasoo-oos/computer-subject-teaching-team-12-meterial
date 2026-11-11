// 비트별 익명 집계 (docs/live-api.md §9.4). 타입 정의 + 계산 함수.
// 집계 규칙: 선택 분포 막대는 데이터 순서 그대로, 자동 처리 응답은 분포에서 빼고 autoCount로 따로 센다.
import {
  ACHIEVEMENTS,
  ACHIEVEMENT_ORDER,
  BASE_SALARY,
  ENDINGS,
  ENDING_ORDER,
  EVENTS,
  budgetSummary,
  eventForMonth,
  monthChoices,
  netWorth,
} from '@gagyebu/core';
import type {
  AccountId,
  Budget,
  DecisionRecord,
  EndingId,
  EventId,
  GameEvent,
  GameState,
  Scene,
  SceneChannel,
  SceneId,
  Won,
} from '@gagyebu/core';
import { beats } from './beats.ts';
import type { GagyebuConfig } from './config.ts';

export interface SceneTally {
  sceneId: SceneId;
  title: string;
  /** 그 장면까지 도달한 학생 수 (도달한 학생만 분모) */
  reached: number;
  /** 데이터 순서 그대로 */
  choices: { choiceId: string; label: string; count: number }[];
}

export interface MonthEntryTally {
  eventId: EventId;
  sceneId: SceneId;
  title: string;
  channel: SceneChannel;
  choices: { choiceId: string; label: string; count: number }[];
}

export type GagyebuStats =
  | { kind: 'none' } // survey, survey-result, guide-*, present, 슬라이드 — 집계 없음
  | { kind: 'join'; joined: number; connected: number; nicknames: string[] }
  | { kind: 'salary'; salary: Won } // 모든 학생이 같은 월급
  | {
      kind: 'budget';
      savingsRates: number[]; // 학생별 저축률 (평균은 Stage에서)
      shares: Record<AccountId, number>[]; // 학생별 계좌 배분 (계좌 6종)
      autoCount: number;
    }
  | {
      kind: 'month';
      month: number; // 1~11
      entry: MonthEntryTally | null; // 그 달 배치 이벤트의 첫 장면. 조용한 달(4·10)은 null
      /** 같은 달에 바로 이어진 장면 (예: 2월 seller, 5월 message) */
      chained: SceneTally[];
      /** 예약 후속 장면 — 그 달에 예약돼 나타난 장면 (예: 4월 check4, 6월 check6, 10월 revolving) */
      scheduled: SceneTally[];
      /** 지금 이어진 장면(연쇄·예약 포함)에 서 있는 학생 수 */
      inChained: number;
      netWorths: number[]; // 조용한 달 순자산 분포 변화용
      autoCount: number;
    }
  | {
      kind: 'settlement'; // m12
      endings: { endingId: EndingId; label: string; count: number }[]; // ENDING_ORDER 순서
      achievements: { achievementId: string; label: string; rate: number }[]; // ACHIEVEMENT_ORDER 순서
      netWorths: number[];
      autoCount: number;
    };

// ---------------------------------------------------------------------------
// 장면 분류 (연쇄 vs 예약) — 데이터가 정적으로 정한다(§14).
// 어떤 선택지의 next가 delayMonths로 그 장면을 가리키면 '예약', delayMonths 없이 가리키면 '연쇄'.

type SceneKind = 'entry' | 'chained' | 'scheduled';

const SCENE_KIND: Record<string, SceneKind> = {};

function classifyScenes(): void {
  for (const event of Object.values(EVENTS)) {
    const entryIds = new Set<string>([event.entry, ...(event.entryVariants ?? []).map((v) => v.scene)]);
    const delayed = new Set<string>();
    const chained = new Set<string>();
    for (const scene of Object.values(event.scenes)) {
      for (const c of scene.choices) {
        if (!c.next) continue;
        if (c.next.delayMonths) delayed.add(c.next.scene);
        else chained.add(c.next.scene);
      }
    }
    for (const sceneId of Object.keys(event.scenes)) {
      const key = `${event.id}/${sceneId}`;
      if (entryIds.has(sceneId)) SCENE_KIND[key] = 'entry';
      else if (delayed.has(sceneId)) SCENE_KIND[key] = 'scheduled';
      else SCENE_KIND[key] = 'chained';
    }
  }
}
classifyScenes();

function sceneKind(eventId: EventId, sceneId: SceneId): SceneKind {
  return SCENE_KIND[`${eventId}/${sceneId}`] ?? 'chained';
}

// ---------------------------------------------------------------------------
// 집계 내부

interface SceneAcc {
  reached: number;
  counts: Map<string, number>;
}

/** 장면 선택 기록만 골라낸다 — statusAction 기록(선택지가 아닌 행동)은 제외 */
function isSceneChoice(rec: DecisionRecord): boolean {
  if (rec.eventId === '') return false;
  const scene = EVENTS[rec.eventId]?.scenes[rec.sceneId];
  return scene ? scene.choices.some((c) => c.id === rec.choiceId) : false;
}

function emptyAcc(): SceneAcc {
  return { reached: 0, counts: new Map() };
}

/** 한 장면의 선택 기록을 합산기에 반영한다 */
function accumulate(acc: SceneAcc, rec: DecisionRecord): void {
  acc.reached += 1;
  if (rec.auto !== true) acc.counts.set(rec.choiceId, (acc.counts.get(rec.choiceId) ?? 0) + 1);
}

/** 데이터 순서 그대로 선택지 막대를 만든다 (자동 처리 응답은 빠진다) */
function tallyChoices(scene: Scene, acc: SceneAcc): { choiceId: string; label: string; count: number }[] {
  return scene.choices.map((c) => ({ choiceId: c.id, label: c.label, count: acc.counts.get(c.id) ?? 0 }));
}

function sceneTitleOf(event: GameEvent, sceneId: SceneId): string {
  return event.scenes[sceneId]?.title ?? event.title;
}

/** 장면의 짧은 이름 — 이어진·예약 장면처럼 장면 밖 맥락이 없을 때 쓴다(§14 #125).
 *  장면 제목 → 발신자 → 채널 → 본문 앞부분 순. 이벤트 제목으로 떨어지면
 *  "가정의 달"처럼 이어진 장면의 정체를 알 수 없어진다. */
export function sceneLabel(scene: Scene): string {
  if (scene.title) return scene.title;
  if (scene.speaker) return scene.speaker;
  switch (scene.channel) {
    case 'messenger':
      return '메신저';
    case 'sms':
      return '문자';
    case 'news':
      return '뉴스 속보';
    case 'app':
      return '앱 알림';
    default:
      break;
  }
  const flat = scene.text.replace(/\s+/g, ' ').trim();
  return flat.length > 20 ? `${flat.slice(0, 20)}…` : flat;
}

/** 월 비트 집계 (m1..m11) */
function monthStats(states: GameState[], month: number): GagyebuStats {
  const batch = eventForMonth(month);
  const entryAcc = new Map<string, SceneAcc>(); // key: sceneId
  const otherAcc = new Map<string, SceneAcc>(); // key: `${eventId}/${sceneId}`
  let autoCount = 0;

  for (const s of states) {
    for (const rec of monthChoices(s, month)) {
      if (!isSceneChoice(rec)) continue;
      if (rec.auto === true) autoCount += 1;
      const isEntry = batch !== null && rec.eventId === batch.id && sceneKind(rec.eventId, rec.sceneId) === 'entry';
      if (isEntry) {
        const acc = entryAcc.get(rec.sceneId) ?? emptyAcc();
        accumulate(acc, rec);
        entryAcc.set(rec.sceneId, acc);
      } else {
        const key = `${rec.eventId}/${rec.sceneId}`;
        const acc = otherAcc.get(key) ?? emptyAcc();
        accumulate(acc, rec);
        otherAcc.set(key, acc);
      }
    }
  }

  // entry: 배치 이벤트의 첫 장면. 시작 장면이 entryVariants로 여럿이면(8월 drop/dropNoInvest)
  // 선택지를 데이터 순서대로 이어 붙여 한 덩어리로 합친다(§14).
  let entry: MonthEntryTally | null = null;
  if (batch) {
    const entrySceneIds = [batch.entry, ...(batch.entryVariants ?? []).map((v) => v.scene)];
    const choices: { choiceId: string; label: string; count: number }[] = [];
    for (const sid of entrySceneIds) {
      const scene = batch.scenes[sid];
      if (!scene) continue;
      for (const c of scene.choices) {
        if (choices.some((x) => x.choiceId === c.id)) continue;
        const count = entrySceneIds.reduce((sum, sid2) => sum + (entryAcc.get(sid2)?.counts.get(c.id) ?? 0), 0);
        choices.push({ choiceId: c.id, label: c.label, count });
      }
    }
    const canonical = batch.scenes[batch.entry];
    entry = {
      eventId: batch.id,
      sceneId: batch.entry,
      title: sceneTitleOf(batch, batch.entry),
      channel: canonical ? canonical.channel : 'narration',
      choices,
    };
  }

  // chained·scheduled: 이벤트·장면 데이터 순서대로(결정적)
  const chained: SceneTally[] = [];
  const scheduled: SceneTally[] = [];
  for (const event of Object.values(EVENTS)) {
    for (const [sceneId, scene] of Object.entries(event.scenes)) {
      const key = `${event.id}/${sceneId}`;
      const acc = otherAcc.get(key);
      if (!acc) continue;
      const kind = sceneKind(event.id, sceneId);
      if (kind === 'entry') continue; // 배치 이벤트 시작 장면은 entry 덩어리로
      const tally: SceneTally = {
        sceneId,
        // 이어진·예약 장면은 장면 스스로의 이름(발신자·채널 폴백) — 이벤트 제목이면 정체를 알 수 없다(§14 #125)
        title: sceneLabel(scene),
        reached: acc.reached,
        choices: tallyChoices(scene, acc),
      };
      if (kind === 'scheduled') scheduled.push(tally);
      else chained.push(tally);
    }
  }

  // 지금 연쇄·예약 장면에 서 있는 학생 수
  const inChained = states.filter((s) => {
    if (s.step !== 'scene' || !s.current) return false;
    const kind = sceneKind(s.current.eventId, s.current.sceneId);
    return kind === 'chained' || kind === 'scheduled';
  }).length;

  return {
    kind: 'month',
    month,
    entry,
    chained,
    scheduled,
    inChained,
    netWorths: states.map((s) => netWorth(s)),
    autoCount,
  };
}

/** 12월 결산 집계 */
function settlementStats(states: GameState[]): GagyebuStats {
  const total = states.length;
  return {
    kind: 'settlement',
    endings: ENDING_ORDER.map((id) => ({
      endingId: id,
      label: ENDINGS[id].title,
      count: states.filter((s) => s.settlement?.ending === id).length,
    })),
    achievements: ACHIEVEMENT_ORDER.map((id) => ({
      achievementId: id,
      label: ACHIEVEMENTS[id].title,
      rate: total > 0 ? states.filter((s) => s.unlocked.includes(id)).length / total : 0,
    })),
    netWorths: states.map((s) => netWorth(s)),
    // 12월에는 선택 장면이 없으므로, "자동 처리가 있었던 학생 수"로 보여 준다(§14)
    autoCount: states.filter((s) => s.decisions.some((d) => d.auto === true)).length,
  };
}

// ---------------------------------------------------------------------------
// stats (§9.4)

/** 비트 인덱스 → 비트 id */
function beatIdOf(cfg: GagyebuConfig, beat: number): string | null {
  return beats(cfg)[beat]?.id ?? null;
}

/** 익명 집계 (TV·통제용). 서버가 초당 최대 4회로 묶어 보낸다 */
export function stats(states: GameState[], beat: number, cfg: GagyebuConfig): GagyebuStats {
  const id = beatIdOf(cfg, beat);
  if (id === null) return { kind: 'none' };
  if (id === 'join') {
    // ActivityLogic은 states 배열만 받으므로(§4.2) 접속 여부를 알 수 없다 — connected는
    // joined와 같은 값으로 채우고 실제 접속 인원은 StatsPayload.progress.connected가 담당한다(§14).
    return {
      kind: 'join',
      joined: states.length,
      connected: states.length,
      nicknames: states.map((s) => s.profile.nickname),
    };
  }
  if (id === 'salary') {
    return {
      kind: 'salary',
      salary: BASE_SALARY,
    };
  }
  if (id === 'budget') {
    // 확정한 학생의 initialBudget으로 분포. 아직 제출하지 않은 학생은 분포에서 빼고
    // autoCount(지금 넘기면 자동 처리될 인원)로 센다(§14).
    const confirmed = states.flatMap((s): { budget: Budget; salary: Won }[] => {
      return s.initialBudget !== null ? [{ budget: s.initialBudget, salary: s.profile.salary }] : [];
    });
    return {
      kind: 'budget',
      savingsRates: confirmed.map((c) => budgetSummary(c.budget, c.salary).savingsRate),
      shares: confirmed.map((c) => budgetSummary(c.budget, c.salary).shares),
      autoCount: states.length - confirmed.length,
    };
  }
  const month = /^m(\d+)$/.exec(id);
  if (month && Number(month[1]) <= 11) return monthStats(states, Number(month[1]));
  if (month && Number(month[1]) === 12) return settlementStats(states);
  return { kind: 'none' }; // survey(개인 성향 정보는 분포로 나오지 않는다, §9.4)·survey-result·guide-*·present
}
