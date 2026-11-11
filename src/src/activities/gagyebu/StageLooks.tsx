// 김새롬: TV 게임 화면. 태수님 화면 컨셉(통장 종이 · 남색 잉크 · 괘선) 그대로, 색으로 구분만 더한다(원장 11-12).
// 사건 화면은 StageEvent.tsx(A4: 장면 실물 · 선택지 종류 색 · 이어진 장면 전부). 나머지는 A2(주장 한 문장 + 증거) 위에 뜻 있는 색:
//   가계부 공개 = 통장 색 막대 · 조용한 달 = 순자산 점(빚이면 빨강) · 결산 = 엔딩 색(모았다 파랑 · 썼다 주황 · 빚 빨강 · 그 사이 회청)
// 입장(QR) · 월급 · 발표(순위표 · 발표자)는 태수님 화면을 그대로 쓴다(이미 숫자 하나 · 기능 화면).
import { ACCOUNT_ORDER, ACCOUNTS, ENDINGS, EVENTS, GUIDE_CARDS, eventForMonth, formatMan, formatPct, monthLabel, type EndingId } from '@gagyebu/core';
import type { GagyebuStats } from '@gagyebu/activity-gagyebu';
import { PassbookCover } from '../../components/PassbookCover.tsx';
import { ACCOUNT_COLOR } from '../../lib/accounts.ts';
import { A4_EventPost, A4_EventPre, FlowLegend } from './StageEvent.tsx';

/** TV 게임 화면: 기본 새 화면. ?look=old 면 원래(태수님) 화면 — 비교 · 비상용 */
export const LOOK: string =
  (typeof location !== 'undefined' ? new URLSearchParams(location.search).get('look') : null) ?? 'a2';

const firstSentence = (s: string) => s.split(/(?<=[.!?])\s+/)[0] ?? s;

// ── 틀: 왼쪽 축 112 · 제목과 증거를 한 덩어리로 광학 중심(위 45 : 아래 55)에 ──
function Frame({ kicker, title, children }: { kicker: string; title: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="paper-texture flex size-full flex-col px-[112px] py-[64px]">
      <div className="flex-[45]" />
      <div>
        <p className="text-[28px] font-semibold leading-none text-ink-2">{kicker}</p>
        <h1 className="display mt-6 text-[72px] leading-[1.14] text-ink">{title}</h1>
        {children ? <div className="mt-14">{children}</div> : null}
      </div>
      <div className="flex-[55]" />
    </div>
  );
}
const lines = (ls: string[]) => ls.map((l) => (
  <span key={l} className="block">
    {l}
  </span>
));

/** 통장 괘선 한 줄: 적요(왼쪽) · 값(오른쪽 칸). 상자 없이 아래 괘선 하나 */
function LedgerRow({ label, value, sub }: { label: string; value?: string; sub?: boolean }) {
  return (
    <li className="flex min-h-[72px] items-center justify-between gap-12 border-b border-rule-soft py-3">
      <span className={`text-[32px] leading-snug ${sub ? 'text-ink-2' : 'font-semibold text-ink'}`}>{label}</span>
      {value ? <span className="num shrink-0 text-[32px] font-semibold text-ink-2">{value}</span> : null}
    </li>
  );
}

/** 이름 · 막대 · 숫자 한 줄. 막대 색은 그 줄의 뜻(통장 · 엔딩), 0이면 막대 없이 흐린 숫자만. 숫자는 막대 끝에 붙는다 */
function BarRows({ rows, unit, max }: { rows: { label: string; value: number; text: string; color?: string }[]; unit?: string; max: number }) {
  return (
    <ul className="w-[1400px] border-t border-rule-soft">
      {rows.map((r) => (
        <li key={r.label} className="flex min-h-[72px] items-center border-b border-rule-soft py-3">
          <span className="line-clamp-2 w-[560px] shrink-0 pr-8 text-[32px] leading-snug font-semibold text-ink">{r.label}</span>
          <span className="flex flex-1 items-center gap-4">
            {r.value > 0 ? <span className="h-[28px] rounded-[4px]" style={{ width: `${max > 0 ? (r.value / max) * 680 : 0}px`, background: r.color ?? 'var(--color-ink)' }} /> : null}
            <span className={`num text-[32px] font-bold ${r.value > 0 ? 'text-ink' : 'text-ink-3'}`}>
              {r.text}
              {unit ? <span className="text-[22px] font-semibold text-ink-3">{unit}</span> : null}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** 값들을 익명 점으로 펼친 띠(조용한 달의 순자산). 0원 이상 파랑 · 빚이 더 많으면 빨강, 정렬 없음 */
function Dots({ values }: { values: number[] }) {
  const lo = Math.min(0, ...values);
  const hi = Math.max(1, ...values);
  const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  const x = (v: number) => ((v - lo) / Math.max(1, hi - lo)) * 1400;
  return (
    <div className="w-[1400px]">
      <div className="relative h-[120px] border-y border-rule-soft">
        <span className="absolute inset-y-4 w-[2px] bg-ink-3" style={{ left: x(avg) }} />
        {values.map((v, i) => (
          <span key={i} className="absolute size-[20px] -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ left: x(v), top: `calc(50% + ${(((i * 37) % 7) - 3) * 10}px)`, background: v < 0 ? 'var(--color-seal)' : 'var(--color-in)' }} />
        ))}
      </div>
      <div className="num relative mt-3 h-[40px] text-[28px] text-ink-3">
        <span className="absolute left-0">{formatMan(lo)}</span>
        <span className="absolute -translate-x-1/2 font-semibold text-ink" style={{ left: Math.min(1250, Math.max(150, x(avg))) }}>
          평균 {formatMan(avg)}
        </span>
        <span className="absolute right-0">{formatMan(hi)}</span>
      </div>
      {values.some((v) => v < 0) ? (
        <div className="mt-6">
          <FlowLegend items={[['var(--color-in)', '순자산 0원 이상'], ['var(--color-seal)', '빚이 더 많음']]} />
        </div>
      ) : null}
    </div>
  );
}

// ── 안내 카드: 제목 자리에 리드 한 문장, 요점은 괘선 줄(통장 쪼개기는 통장 표지), 기억할 것은 형광펜 한 줄 ──
export function A2_Guide({ index }: { index: number }) {
  const card = GUIDE_CARDS[index]!;
  const split = card.id === 'split-accounts';
  return (
    <Frame kicker={`안내 카드 ${index + 1} / ${GUIDE_CARDS.length} · ${card.title}`} title={card.lead}>
      {split ? (
        <ul className="grid w-[1400px] grid-cols-6 gap-6">
          {ACCOUNT_ORDER.map((id) => (
            <li key={id}>
              <PassbookCover id={id}>
                <p className="num text-[19px] font-bold leading-tight">{ACCOUNTS[id].guide}</p>
              </PassbookCover>
              <p className="mt-3 text-[24px] font-semibold leading-snug text-ink">{ACCOUNTS[id].purpose}</p>
              <p className="num mt-1 text-[22px] text-ink-3">
                {ACCOUNTS[id].annualRate === null ? (id === 'invest' ? '수익률이 매달 바뀜' : '이자 없음') : `연 ${formatPct(ACCOUNTS[id].annualRate!)} (가정)`}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="w-[1400px] border-t border-rule-soft">
          {card.points.map((p) => (
            <LedgerRow key={p} label={p} sub />
          ))}
        </ul>
      )}
      {card.tip ? (
        <p className="mt-8 text-[34px] font-semibold text-ink">
          <span className="bg-mark px-2">{card.tip}</span>
        </p>
      ) : null}
    </Frame>
  );
}

export function A2_Survey() {
  return (
    <Frame kicker="소비습관 설문" title={lines(['질문 7개에', '솔직하게 답해 주세요'])}>
      <p className="text-[32px] font-semibold text-ink-2">설문 답과 소비 성향은 다른 사람에게 공개되지 않습니다.</p>
    </Frame>
  );
}
export function A2_SurveyResult() {
  return (
    <Frame kicker="설문 결과" title={lines(['내 소비 성향은', '내 화면에서 확인해 주세요'])}>
      <p className="display text-[48px] text-ink-2">계획형 · 균형형 · 즉흥형</p>
      <p className="mt-6 text-[32px] font-semibold text-ink-2">유형 분포는 공개되지 않습니다. 서로 비교하지 않고 자기 결과만 보세요.</p>
    </Frame>
  );
}

// ── 가계부: 쓰는 동안은 할 일 한 문장, 공개는 평균 저축률(형광펜) + 통장별 평균 배분 ──
export function A2_Budget({ stats, revealed }: { stats: GagyebuStats | null; revealed: boolean }) {
  const b = stats?.kind === 'budget' ? stats : null;
  if (!revealed)
    return (
      <Frame kicker="가계부 작성" title={lines(['월급을 여섯 통장에', '나눠 주세요'])}>
        {b && b.autoCount > 0 ? <p className="text-[32px] font-semibold text-ink-2">아직 확정하지 않은 {b.autoCount}명은 넘기면 자동으로 처리돼요</p> : null}
      </Frame>
    );
  if (!b) return <Frame kicker="가계부 공개" title="집계하는 중입니다" />;
  const n = b.savingsRates.length;
  const rate = n ? b.savingsRates.reduce((a, x) => a + x, 0) / n : null;
  const rows = ACCOUNT_ORDER.map((id) => {
    const share = b.shares.length ? b.shares.reduce((a, s) => a + (s[id] ?? 0), 0) / b.shares.length : 0;
    return { label: ACCOUNTS[id].label, value: share, text: formatPct(share), color: ACCOUNT_COLOR[id] };
  });
  return (
    <Frame
      kicker={`가계부 공개 · 확정한 학생 ${n}명`}
      title={
        <>
          우리 반 평균 저축률은 <span className="num bg-mark px-2">{rate === null ? '-' : formatPct(rate)}</span>
        </>
      }
    >
      <BarRows rows={rows} max={Math.max(...rows.map((r) => r.value))} />
    </Frame>
  );
}

// ── 조용한 달(1 · 4 · 10월): 주장 한 문장 + 반 순자산 점 ──
export function A2_Quiet({ month, stats }: { month: number; stats: GagyebuStats | null }) {
  const ms = stats?.kind === 'month' ? stats : null;
  const title = month === 1 ? firstSentence(EVENTS['tutorial']?.lesson ?? '') : '사건이 없는 달에도 돈은 쌓입니다';
  return (
    <Frame kicker={`${monthLabel(month)} · ${month === 1 ? '연습 달' : '조용한 달'} · 우리 반 순자산`} title={title}>
      {ms ? <Dots values={ms.netWorths} /> : null}
    </Frame>
  );
}

/** 엔딩 색: 모았다 · 썼다 · 빚이 남았다 · 그 사이 */
const ENDING_COLOR: Record<EndingId, [string, string]> = {
  frugal: ['var(--color-in)', '모았다'],
  balanced: ['var(--color-in)', '모았다'],
  yolo: ['var(--color-acc-living)', '썼다'],
  debt: ['var(--color-seal)', '빚이 남았다'],
  ordinary: ['var(--color-ink-3)', '그 사이'],
};
const ENDING_LEGEND: [string, string][] = [
  ['var(--color-in)', '모았다'],
  ['var(--color-acc-living)', '썼다'],
  ['var(--color-seal)', '빚이 남았다'],
  ['var(--color-ink-3)', '그 사이'],
];

// ── 12월 결산: 공개 전 할 일, 공개 후 엔딩 분포 ──
export function A2_Settlement({ stats, revealed }: { stats: GagyebuStats | null; revealed: boolean }) {
  if (!revealed) return <Frame kicker="12월 결산" title={lines(['폰에서 1년 결산을', '확인해 주세요'])} />;
  const st = stats?.kind === 'settlement' ? stats : null;
  if (!st) return <Frame kicker="1년 결산" title="집계하는 중입니다" />;
  const rows = st.endings.map((e) => ({ label: ENDINGS[e.endingId].title, value: e.count, text: String(e.count), color: ENDING_COLOR[e.endingId][0] }));
  const kinds = rows.filter((r) => r.value > 0).length;
  const total = rows.reduce((a, r) => a + r.value, 0);
  return (
    <Frame kicker={`1년 결산 · ${total}명${st.autoCount > 0 ? ` · 자동 처리 ${st.autoCount}명` : ''}`} title={`같은 1년, 엔딩은 ${kinds}가지로 갈렸습니다`}>
      <BarRows rows={rows} unit="명" max={Math.max(1, ...rows.map((r) => r.value))} />
      <div className="mt-6">
        <FlowLegend items={ENDING_LEGEND} />
      </div>
      <p className="mt-10 text-[28px] font-bold text-ink">도전과제 달성률</p>
      <ul className="mt-3 grid w-[1400px] grid-cols-3 gap-x-12 border-t border-rule-soft">
        {st.achievements.map((a) => (
          <li key={a.achievementId} className="flex h-[44px] items-center justify-between border-b border-rule-soft text-[24px]">
            <span className="truncate text-ink">{a.label}</span>
            <span className="num shrink-0 font-bold text-ink">{formatPct(a.rate)}</span>
          </li>
        ))}
      </ul>
    </Frame>
  );
}

/** ?look=a2 일 때 비트 id로 A2 화면을 고른다. 입장 · 월급 · 발표는 null(태수님 화면 그대로) */
export function a2Screen(id: string, revealed: boolean, stats: GagyebuStats | null): React.ReactNode | null {
  if (id === 'survey') return <A2_Survey />;
  if (id === 'survey-result') return <A2_SurveyResult />;
  const g = /^guide-(\d+)$/.exec(id);
  if (g) return <A2_Guide index={Number(g[1]) - 1} />;
  if (id === 'budget') return <A2_Budget stats={stats} revealed={revealed} />;
  const m = /^m(\d+)$/.exec(id);
  if (m) {
    const month = Number(m[1]);
    if (month === 12) return <A2_Settlement stats={stats} revealed={revealed} />;
    if (month === 1 || month === 4 || month === 10) return <A2_Quiet month={month} stats={stats} />;
    const ev = eventForMonth(month);
    if (ev) return revealed ? <A4_EventPost month={month} event={ev} stats={stats} /> : <A4_EventPre month={month} event={ev} />;
  }
  return null;
}
