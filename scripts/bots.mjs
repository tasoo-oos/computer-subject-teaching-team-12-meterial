#!/usr/bin/env node
// 학생 봇 (docs/live-api.md §11.1):
//   node scripts/bots.mjs --url http://localhost:8091 --code 4821 --n 60 --lazy 0.1 --seed 42
//   node scripts/bots.mjs --code 4821 --auto-next --control-password <통제 비밀번호>
//
// - 봇마다 소켓 하나. hello+join(닉네임 bot-01…) 후 snapshot/class/state로 상태를 유지한다.
// - work 비트에서 lazy가 아니면 행동한다. 가계부 활동 동작(설문·가계부·장면 선택)은
//   core/활동 로직을 상대 경로로 직접 import해 계산한다(Node 24 타입 스트리핑).
//   아직 구현 전(core step() stub)이라면 그 봇의 행동만 실패로 기록되고,
//   슬라이드 전용 수업은 그대로 진행된다 — 가계부 부분이 격리돼 있다.
// - --auto-next: 교사 역할도 스크립트가 대신한다(통제 로그인 → 쿠키 → 통제 소켓).
//   work 비트마다 잠시 기다렸다가 next(force) 전송.
// - 매 비트마다 한 줄 진행 로그, 마지막에 요약. 모든 비lazy 봇이 마지막 비트에
//   도달하면 종료 코드 0.
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const require = createRequire(import.meta.url);
// 앱 패키지(src)의 socket.io-client — 서버 의존성에는 없다(§1.4).
const { io } = require(resolve('src/node_modules/socket.io-client'));

// ── 인자 ────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const out = { url: 'http://localhost:8091', n: 60, lazy: 0.1, seed: 42, autoNext: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === '--url') out.url = next();
    else if (a === '--code') out.code = next();
    else if (a === '--n') out.n = Number(next());
    else if (a === '--lazy') out.lazy = Number(next());
    else if (a === '--seed') out.seed = Number(next());
    else if (a === '--auto-next') out.autoNext = true;
    else if (a === '--control-password') out.controlPassword = next();
    else {
      console.error(`모르는 인자: ${a}`);
      process.exit(2);
    }
  }
  if (!out.code || !/^[0-9]{4}$/.test(out.code)) {
    console.error('사용법: node scripts/bots.mjs --url http://localhost:8091 --code 4821 [--n 60] [--lazy 0.1] [--seed 42] [--auto-next --control-password <pw>]');
    process.exit(2);
  }
  if (out.autoNext && !out.controlPassword) {
    console.error('--auto-next에는 --control-password가 필요합니다(§11.1).');
    process.exit(2);
  }
  return out;
}

// ── 시드 난수 (mulberry32) ──────────────────────────────────────────────────

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── 레슨 비트 (서버·클라이언트와 같은 함수, §4.1) ────────────────────────────

let lessonBeatsFn = null;
let gagyebuBeats = null;

async function loadLessonHelpers() {
  if (lessonBeatsFn) return;
  const slides = await import('../packages/live/src/slides.ts');
  ({ lessonBeats: lessonBeatsFn } = slides);
  try {
    ({ beats: gagyebuBeats } = await import('../packages/activity-gagyebu/src/beats.ts'));
  } catch {
    gagyebuBeats = null; // 활동을 못 계산해도 슬라이드 진행은 가능
  }
}

function beatsOf(activityId, config) {
  if (activityId === 'gagyebu' && gagyebuBeats) return gagyebuBeats(config);
  throw new Error(`봇이 모르는 활동입니다: ${activityId}`);
}

/** lesson → 평탄화된 비트 목록 [{segment, index, beat:{id,mode,reveal}}] */
function flatten(lesson) {
  const perSegment = lessonBeatsFn(lesson, beatsOf);
  const flat = [];
  for (const { segment, beats } of perSegment) {
    beats.forEach((beat, index) => flat.push({ segment, index, beat }));
  }
  return flat;
}

// ── 가계부 활동 동작 (격리 — core가 구현되면 자동으로 동작) ─────────────────

let core = null;
async function loadCore() {
  if (core) return core;
  core = await import('../packages/core/src/index.ts');
  return core;
}

function surveyAnswers(rng) {
  const answers = {};
  for (const q of core.SURVEY) {
    const option = q.options[Math.floor(rng() * q.options.length)];
    answers[q.id] = option.id;
  }
  return answers;
}

/**
 * 이 상태에서 봇이 보낼 가계부 행동. 없으면 null.
 * core 함수가 아직 stub이면 예외가 올라온다 — 호출부에서 실패로 기록한다.
 */
function gagyebuAction(state, beatId, bot, rng) {
  if (beatId === 'survey' && state.phase === 'survey') {
    return { type: 'submitSurvey', answers: surveyAnswers(rng) };
  }
  if (beatId === 'budget' && state.phase === 'budget') {
    if (!bot.budgetSet) {
      bot.budgetSet = true;
      // recommendBudget는 SurveyResult를 돌려준다 — 가계부는 .recommended다
      const { recommended } = core.recommendBudget(state.survey.answers, state.profile.salary);
      return { type: 'setBudget', budget: recommended };
    }
    return { type: 'confirmBudget' };
  }
  if (/^m\d+$/.test(beatId) && state.phase === 'sim') {
    switch (state.step) {
      case 'payday':
        return { type: 'beginMonth' };
      case 'scene': {
        const { scene } = core.getScene(state.current);
        const enabled = scene.choices.filter((c) => core.choiceAvailability(state, c).enabled);
        const choice = enabled[Math.floor(rng() * enabled.length)];
        if (!choice) return null;
        const action = { type: 'choose', choiceId: choice.id };
        if (choice.pay) {
          const { plan } = core.autoPaymentPlan(state, choice.pay);
          action.payment = plan;
          if (choice.pay.adjustable) action.amount = choice.pay.adjustable.min;
        }
        if (choice.deposit) action.depositTo = core.autoDepositTarget(choice.deposit);
        return action;
      }
      case 'outcome':
        return { type: 'continue' };
      case 'adjust':
        return { type: 'setBudget', budget: core.balanceBudget(state.budget, state.profile.salary).budget };
      default:
        return null; // report — 교사의 next가 endMonth 전이로 넘긴다
    }
  }
  return null; // join·salary·survey-result·guide·present 등
}

// ── 봇 ─────────────────────────────────────────────────────────────────────

const args = parseArgs(process.argv.slice(2));
const rng = mulberry32(args.seed);
const bots = [];
let flatBeats = null;
let lastBeatRef = null;
let finished = false;
const failures = new Map(); // nickname → 이유
const summary = { finished: 0, autoApplied: 0, failed: 0 };

function log(...parts) {
  console.log(`[bots] ${parts.join(' ')}`);
}

function beatAt(ref) {
  if (!flatBeats) return null;
  const hit = flatBeats.find((f) => f.segment === ref.segment && f.index === ref.beat);
  return hit ? hit.beat : null;
}

function isLastBeat(ref) {
  return (
    lastBeatRef && ref.segment === lastBeatRef.segment && ref.beat === lastBeatRef.beat
  );
}

/** live 비트가 바뀌면 settled·done을 초기화한다 — 둘 다 지난 비트 값이 남아 있다 */
function markBeat(bot) {
  if (!bot.classState) return;
  const hm = bot.classState.highMark;
  const key = `${hm.segment}/${hm.beat}`;
  if (bot.lastBeat !== key) {
    bot.lastBeat = key;
    bot.settled = false;
    bot.done = false; // 이 비트의 done은 ack·state·snapshot이 다시 채운다
  }
}

/** 봇 하나의 work 비트 행동 루프: done이거나 행동이 없을 때까지 순서대로 */
async function pump(bot) {
  if (bot.busy || bot.lazy || !bot.authed) return; // 재접속 hello 전의 pump는 not-allowed로 죽는다
  bot.busy = true;
  try {
    bot.settled = false;
    for (let guard = 0; guard < 20; guard++) {
      if (bot.done || !bot.classState || bot.classState.status !== 'open') break;
      const { cursor, highMark } = bot.classState;
      if (cursor.segment !== highMark.segment || cursor.beat !== highMark.beat) break; // 리뷰 중
      const beat = beatAt(highMark);
      if (!beat || beat.mode !== 'work') break;
      if (bot.state === null || bot.state === undefined) break; // 슬라이드 세그먼트 등
      let action = null;
      try {
        action = gagyebuAction(bot.state, beat.id, bot, rng);
      } catch (err) {
        fail(bot, `${beat.id}: ${err.message}`);
        break;
      }
      if (!action) break;
      // 속도 제한(소켓당 초당 4회, §5.4) — 봇은 사람보다 빠르다: 250ms 간격 + too-fast 재시도
      await new Promise((r) => setTimeout(r, 250));
      let ack = null;
      for (let attempt = 0; ; attempt++) {
        ack = await new Promise((resolveAck) => {
          bot.socket.emit('act', { seq: ++bot.seq, beat: highMark, action }, resolveAck);
        });
        if (ack && ack.ok !== true && ack.reason === 'too-fast' && attempt < 4) {
          await new Promise((r) => setTimeout(r, 400));
          continue;
        }
        break;
      }
      if (!ack || ack.ok !== true) {
        if (ack && ack.reason === 'stale-beat') {
          // 커서가 이미 지나갔다 — 다음 class 이벤트에 갱신된 커서로 다시 행동한다
          break;
        }
        fail(bot, `${beat.id} act 거부: ${ack && ack.reason}`);
        break;
      }
      bot.state = ack.state;
      bot.done = ack.done;
      if (bot.done) break;
    }
  } finally {
    bot.settled = true;
    bot.busy = false;
  }
}

function fail(bot, why) {
  if (!failures.has(bot.nickname)) {
    failures.set(bot.nickname, why);
    summary.failed++;
    log(`✗ ${bot.nickname} 실패: ${why}`);
  }
}

async function spawnBot(i) {
  const nickname = `bot-${String(i + 1).padStart(2, '0')}`;
  const bot = {
    nickname,
    lazy: rng() < args.lazy,
    socket: io(args.url, { transports: ['websocket'], reconnection: true }),
    classState: null,
    lesson: null,
    state: null,
    done: false,
    busy: false,
    seq: 0,
    budgetSet: false,
    token: null,
    authed: false, // 서버가 이 소켓을 학생으로 인식했는지(재접속 hello 완료)
    settled: false, // 이 live 비트에서 봇이 할 일을 마쳤다(done이거나 더 보낼 행동 없음)
    lastBeat: null,
    autoApplied: 0,
    reachedLast: false,
  };
  bots.push(bot);
  bot.socket.on('snapshot', (p) => {
    bot.classState = p.class;
    bot.lesson = p.lesson;
    if (p.state !== undefined) bot.state = p.state;
    if (p.you) bot.done = p.you.done;
    if (p.autoApplied) bot.autoApplied += p.autoApplied.length;
    markBeat(bot);
    maybeFinished(bot);
  });
  bot.socket.on('class', (p) => {
    bot.classState = p.class;
    markBeat(bot);
    maybeFinished(bot);
    void pump(bot);
  });
  bot.socket.on('state', (p) => {
    bot.state = p.state;
    bot.done = p.done;
    if (p.autoApplied) bot.autoApplied += p.autoApplied.length;
    // 전이(endMonth)로 바뀐 상태는 class보다 늦게 온다 — 상태가 갱신되면 다시 행동한다
    void pump(bot);
  });
  // 서버가 죽는 동안 소켓.io가 버퍼에 쌓은 act는 재접속 직후(hello보다 먼저) 세상에
  // 나가 'not-allowed'로 죽는다 — 끊기는 순간 버퍼를 비운다(못 나간 ack는 재접속
  // 처리가 pump를 다시 깨운다).
  bot.socket.on('disconnect', () => {
    bot.authed = false; // 재접속 hello 전에 class 이벤트가 pump를 깨우면 not-allowed로 죽는다
    bot.socket.sendBuffer.length = 0;
  });
  // 서버 재시작 뒤 재접속: 토큰으로 기존 학생 재개(§8.3). 재접속 hello는 소켓당
  // 5초 제한이 무시되지 않으므로 최초 연결(token 없음)은 건너뛴다.
  bot.socket.on('connect', async () => {
    if (!bot.token) return;
    const hello2 = await new Promise((res) =>
      bot.socket.emit('hello', { code: args.code, token: bot.token, device: 'laptop' }, res),
    );
    if (!hello2.ok) {
      fail(bot, `재접속 hello: ${hello2.reason}`);
      return;
    }
    // snapshot이 classState를 갱신한 뒤에 행동해야 stale-beat에 걸리지 않는다
    await new Promise((res) => {
      const t = setTimeout(res, 2000);
      bot.socket.once('snapshot', () => {
        clearTimeout(t);
        res();
      });
    });
    // 끊기며 못 돌아온 act ack로 pump가 멈춰 있을 수 있다 — 다시 깨운다
    bot.authed = true;
    bot.busy = false;
    void pump(bot);
  });
  const hello = await new Promise((res) => bot.socket.emit('hello', { code: args.code, device: 'laptop' }, res));
  if (!hello.ok) {
    fail(bot, `hello: ${hello.reason}`);
    return;
  }
  const join = await new Promise((res) => bot.socket.emit('join', { nickname }, res));
  if (!join.ok && join.reason === 'nickname-taken') {
    // 지난 실행의 기록이 남아 있다 — 다른 닉네임으로 다시
    const alt = `${nickname}x`;
    const retry = await new Promise((res) => bot.socket.emit('join', { nickname: alt }, res));
    if (!retry.ok) {
      fail(bot, `join: ${retry.reason}`);
      return;
    }
    bot.nickname = alt;
    bot.token = retry.token;
  } else if (!join.ok) {
    fail(bot, `join: ${join.reason}`);
    return;
  } else {
    bot.token = join.token;
  }
  bot.authed = true;
}

function maybeFinished(bot) {
  if (!bot.classState || bot.reachedLast) return;
  const { cursor } = bot.classState;
  if (isLastBeat(cursor)) {
    bot.reachedLast = true;
  }
}

function progressLine() {
  const cs = bots.find((b) => b.classState)?.classState;
  if (!cs) return;
  const beat = beatAt(cs.cursor) ?? {};
  const doneCount = bots.filter((b) => b.done).length;
  log(
    `비트 ${cs.cursor.segment}/${cs.cursor.beat} (${beat.id ?? '?'}) — ` +
      `done ${doneCount}/${bots.filter((b) => !b.lazy).length} (lazy ${bots.filter((b) => b.lazy).length})`,
  );
}

// ── 교사 대행 (--auto-next) ─────────────────────────────────────────────────

async function loginControl() {
  const res = await fetch(`${args.url}/api/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ role: 'control', password: args.controlPassword }),
  });
  if (res.status !== 200) throw new Error(`통제 로그인 실패: ${res.status}`);
  return res.headers.getSetCookie().find((c) => c.startsWith('gg_control='));
}

function startAutoNext(cookie) {
  const socket = io(args.url, { query: { role: 'control' }, extraHeaders: { Cookie: cookie } });
  let latest = null;
  let advancing = false;
  socket.on('snapshot', (p) => {
    latest = p.class;
    void maybeAdvance();
  });
  socket.on('class', (p) => {
    latest = p.class;
    progressLine();
    void maybeAdvance();
  });

  // work 비트마다 잠시 기다렸다가 next(§11.1). force로 확인 대화상자도 넘긴다.
  // 루프마다 최신 커서를 다시 읽으므로 진행 중에 온 class 이벤트를 잃지 않는다.
  async function maybeAdvance() {
    if (advancing) return; // 현재 루프가 최신 상태를 다시 본다
    advancing = true;
    try {
      while (latest && latest.status === 'open' && !isLastBeat(latest.cursor)) {
        const beat = beatAt(latest.cursor);
        if (beat && beat.mode === 'work') {
          // 봇들이 이 비트에서 할 일을 마칠 때까지 기다린다(비lazy·실패 봇 기준, 최대 6s).
          // lazy 봇은 끝내지 않으므로 기다림 대상에서 빼고 next(force)가 기본값으로 채운다.
          const deadline = Date.now() + 6000;
          const ready = () =>
            bots.filter((b) => !b.lazy).every((b) => b.settled || failures.has(b.nickname));
          while (Date.now() < deadline && !ready()) {
            await new Promise((r) => setTimeout(r, 100));
          }
        } else {
          await new Promise((r) => setTimeout(r, 150));
        }
        // 서버가 응답 중간에 죽으면 ack는 영영 돌아오지 않는다(socket.io가 연결이 끊길 때
        // 대기 중인 ack를 조용히 지운다) — 타임아웃을 걸어 루프가 멈추지 않게 하고,
        // 재접속 후 최신 커서로 다시 시도한다.
        const ack = await new Promise((res) => {
          const t = setTimeout(() => res(null), 5000);
          socket.emit('next', { force: true }, (a) => {
            clearTimeout(t);
            res(a);
          });
        });
        if (ack === null) {
          if (!socket.connected) {
            await new Promise((r) => setTimeout(r, 500));
            continue; // 재접속을 기다리며 최신 커서로 다시 시도
          }
          log('next 응답 없음 — 재시도');
          continue;
        }
        if (ack && ack.ok !== true && ack.reason && ack.reason !== 'confirm-required') {
          if (ack.reason === 'invalid-target') return; // 마지막 비트
          if (ack.reason === 'rate-limited') {
            await new Promise((r) => setTimeout(r, 300));
            continue;
          }
          log(`next 거부: ${ack.reason}`);
          return;
        }
      }
    } finally {
      advancing = false;
    }
  }
}

// ── main ────────────────────────────────────────────────────────────────────

async function main() {
  await loadLessonHelpers();
  log(`서버 ${args.url} · 수업 ${args.code} · 봇 ${args.n}명 (lazy ${(args.lazy * 100).toFixed(0)}%, seed ${args.seed})`);

  await Promise.all(Array.from({ length: args.n }, (_, i) => spawnBot(i)));

  // lesson 계산: 첫 snapshot의 lesson(봇 전원이 같은 레슨을 받는다)
  const withLesson = bots.find((b) => b.lesson);
  if (!withLesson) {
    log('레슨 정보를 받지 못했습니다(모든 봇 입장 실패).');
    for (const b of bots) b.socket.disconnect();
    process.exit(1);
  }
  flatBeats = flatten(withLesson.lesson);
  const last = flatBeats.at(-1);
  lastBeatRef = { segment: last.segment, beat: last.index };
  lastBeatId = last.beat.id;
  log(`레슨 "${withLesson.lesson.title}" — 비트 ${flatBeats.length}개 (마지막: ${lastBeatId})`);

  // 가계부 동작에 필요한 core 로드 — 격리(실패해도 슬라이드 전용 수업은 진행)
  try {
    await loadCore();
  } catch (err) {
    log(`core 로드 실패 — 가계부 행동 불가(슬라이드 전용이면 정상): ${err.message}`);
  }

  // 입장 시 이미 work 비트(예: join)일 수 있다 — 한 번 깨운다
  for (const b of bots) void pump(b);

  if (args.autoNext) {
    const cookie = await loginControl();
    startAutoNext(cookie);
  } else {
    log('--auto-next 없음: 교사는 통제 페이지에서 직접 넘기세요.');
  }

  // 종료 조건: 모든 비lazy 봇이 마지막 비트에 도달(§11.1) 또는 10분 시간 초과
  const timeoutMs = 10 * 60 * 1000;
  const start = Date.now();
  await new Promise((resolve) => {
    const timer = setInterval(() => {
      const active = bots.filter((b) => !b.lazy);
      if (active.every((b) => b.reachedLast) || Date.now() - start > timeoutMs) {
        clearInterval(timer);
        resolve();
      }
    }, 200);
  });

  summary.finished = bots.filter((b) => !b.lazy && b.reachedLast).length;
  summary.autoApplied = bots.reduce((acc, b) => acc + b.autoApplied, 0);
  const active = bots.filter((b) => !b.lazy).length;
  log(
    `요약: 완주 ${summary.finished}/${active} · 자동 처리 통지 ${summary.autoApplied}건 · 실패 ${summary.failed}명`,
  );
  for (const [nickname, why] of failures) log(`  실패: ${nickname} — ${why}`);
  for (const b of bots) b.socket.disconnect();
  const ok = summary.finished === active && summary.failed === 0;
  process.exit(ok ? 0 : 1);
}

let lastBeatId = null;

void main().catch((err) => {
  console.error('[bots] 오류:', err);
  process.exit(1);
});
