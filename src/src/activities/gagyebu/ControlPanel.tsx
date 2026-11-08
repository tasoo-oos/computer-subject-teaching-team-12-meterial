// 가계부 활동 통제 패널 (docs/live-api.md §10.6 "비트별 패널"). 교사용 추가 정보 — 컴팩트.
// 완료 인원·미완료 명단은 S6의 일반 현황이 이미 보여 주므로 여기는 비트별 심화 정보만:
//   - 가계부: 확정/미확정 인원
//   - 월 비트: 학생들이 지금 어느 단계에 서 있는지(월급날·장면·결과 확인·조정·리포트) + 이어진 장면 수
//   - 12월: 지금까지 나온 엔딩
// stats는 null일 수 있다(비트 불일치·미계산) — 그래도 roster 기반 정보는 보여 준다.
import { ENDINGS, monthLabel, type GameState } from '@gagyebu/core';
import type { GagyebuStats } from '@gagyebu/activity-gagyebu';
import type { ControlPanelProps } from '../registry.ts';

export function ControlPanel({ beat, revealed, stats, roster }: ControlPanelProps<GameState | null, GagyebuStats>) {
  const id = beat.id;

  if (id === 'budget') {
    const budget = stats?.kind === 'budget' ? stats : null;
    const confirmed = budget?.savingsRates.length ?? 0;
    const pending = budget?.autoCount ?? 0;
    return (
      <PanelRows
        rows={[
          ['확정', `${confirmed}명`],
          ['미확정 (자동 처리 예정)', `${pending}명`],
          ...(budget && budget.savingsRates.length > 0
            ? ([['평균 저축률', `${((budget.savingsRates.reduce((a, b) => a + b, 0) / budget.savingsRates.length) * 100).toFixed(1)}%`]] as [string, string][])
            : []),
        ]}
      />
    );
  }

  const m = /^m(\d+)$/.exec(id);
  if (m) {
    const month = Number(m[1]);
    if (month === 12) {
      const st = stats?.kind === 'settlement' ? stats : null;
      const done = st?.endings.filter((e) => e.count > 0) ?? [];
      return (
        <PanelRows
          rows={[
            ['결산 완료', `${(st?.endings.reduce((a, e) => a + e.count, 0) ?? 0)}명`],
            ...done.map((e) => [ENDINGS[e.endingId].title, `${e.count}명`] as [string, string]),
          ]}
        />
      );
    }
    // 월 비트: roster의 locate 문구로 지금 있는 단계를 센다
    const prefix = `${month}월 · `;
    let payday = 0;
    let scene = 0;
    let outcome = 0;
    let adjust = 0;
    let report = 0;
    for (const r of roster) {
      const s = r.scene ?? '';
      if (!s.startsWith(prefix)) continue;
      const suffix = s.slice(prefix.length);
      if (suffix === '월급날') payday++;
      else if (suffix === '결과 확인') outcome++;
      else if (suffix === '가계부 조정') adjust++;
      else if (suffix === '월말 리포트') report++;
      else scene++;
    }
    const ms = stats?.kind === 'month' ? stats : null;
    const inChained = ms?.inChained ?? null;
    const rows: [string, string][] = [
      ['월급날 (시작 전)', `${payday}명`],
      ['장면 선택 중', `${scene}명${inChained !== null ? ` · 이어진 장면 ${inChained}명` : ''}`],
      ['결과 확인 중', `${outcome}명`],
      ['가계부 조정 중', `${adjust}명`],
      ['월말 리포트(완료)', `${report}명`],
    ];
    return (
      <div className="grid gap-1.5">
        <PanelRows rows={rows} />
        {ms && (ms.chained.length > 0 || ms.scheduled.length > 0) ? (
          <p className="text-[12px] leading-snug text-ink-3">
            {monthLabel(month)} 이어진·예약 장면: {[...ms.chained, ...ms.scheduled].map((t) => `${t.title} ${t.reached}명`).join(' · ')}
          </p>
        ) : null}
      </div>
    );
  }

  return null; // join·설문·안내·발표 — 일반 현황(S6)이면 충분하다
}

/** 통제 패널용 정보 행 (컴팩트) */
function PanelRows({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 rounded-[8px] bg-rule-soft/50 px-3.5 py-2.5 text-[12.5px]">
      {rows.map(([k, v]) => (
        <div key={k} className="col-span-2 flex items-baseline justify-between gap-3">
          <dt className="text-ink-2">{k}</dt>
          <dd className="num font-semibold">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
