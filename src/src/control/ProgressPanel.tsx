// 완료 현황 + 기본값 미리보기 + 미완료 명단 (docs/live-api.md §10.6, 계획 §2.2-4).
// 완료 인원은 항상 highMark(live 비트) 기준이다(§5.1 — 리뷰 중에도 progress는 highMark값).
// 미완료 명단: 닉네임, 연결 점, 활동의 "지금 있는 장면" 문구(roster[].scene), 지각 합류 표시.
// 기본값 미리보기: 지금 넘기면 자동 처리될 인원(전체 − 완료)과 적용될 기본 선택지(stats.fallbackPreview).
import type { ProgressInfo, RosterEntry } from '@gagyebu/live';
import { Clock } from 'lucide-react';

export interface ProgressPanelProps {
  progress: ProgressInfo | null;
  fallbackPreview: string | null;
  roster: RosterEntry[];
}

export function ProgressPanel({ progress, fallbackPreview, roster }: ProgressPanelProps) {
  const incomplete = roster.filter((r) => !r.done && !r.pendingMerge);
  const pending = progress ? progress.total - progress.done : incomplete.length;

  return (
    <section className="rounded-panel bg-sheet shadow-[0_0_0_1px_var(--color-rule)]">
      <p className="border-b border-rule-soft px-3 py-2 text-[12px] font-bold text-ink-2">완료 현황 (현재 단계 기준)</p>
      <div className="px-3 py-2.5">
        {progress ? (
          <p className="num flex items-baseline justify-center gap-1.5 text-[26px] font-bold leading-none" data-testid="progress-num">
            <span className="text-in">{progress.done}</span>
            <span className="text-[15px] font-semibold text-ink-3">
              / {progress.connected} 접속 · {progress.total}명
            </span>
          </p>
        ) : (
          <p className="text-center text-[13px] text-ink-3">집계를 기다리는 중…</p>
        )}
        {progress && pending > 0 ? (
          <p className="mt-2 rounded-[8px] bg-mark/70 px-2.5 py-1.5 text-[12.5px] leading-relaxed">
            지금 넘기면 <b className="num">{pending}명</b>이 자동 처리돼요
            {fallbackPreview ? (
              <>
                {' '}
                — 기본 선택지 <b>“{fallbackPreview}”</b>
              </>
            ) : null}
          </p>
        ) : null}
        {incomplete.length > 0 ? (
          <ul className="mt-2 grid max-h-[168px] gap-1 overflow-y-auto" data-testid="incomplete-list">
            {incomplete.map((r) => (
              <li key={r.studentId} className="flex items-center gap-2 rounded-[6px] bg-white/70 px-2 py-1 text-[13px]">
                <ConnectedDot connected={r.connected} />
                <span className="shrink-0 font-semibold">{r.nickname}</span>
                {r.late ? (
                  <span className="flex shrink-0 items-center gap-0.5 rounded-[4px] bg-in-soft px-1 text-[10px] font-bold text-in">
                    <Clock size={10} aria-hidden />
                    지각
                  </span>
                ) : null}
                {r.stalled ? (
                  // 기본값 루프 50회 초과로 멈춤(§4.2) — 중립 표시, 이후 비트에서 풀린다
                  <span
                    className="shrink-0 rounded-[4px] bg-rule-soft px-1 text-[10px] font-bold text-ink-2"
                    title="자동 처리가 멈춤(기본값 50회 초과). 다음 단계에서 다시 따라잡을 수 있어요"
                  >
                    멈춤
                  </span>
                ) : null}
                <span className="min-w-0 flex-1 truncate text-right text-[12px] text-ink-3">
                  {r.scene ?? '대기 중'}
                </span>
              </li>
            ))}
          </ul>
        ) : progress ? (
          <p className="mt-2 text-center text-[12.5px] font-semibold text-in">모두 완료했어요</p>
        ) : null}
      </div>
    </section>
  );
}

export function ConnectedDot({ connected }: { connected: boolean }) {
  return (
    <span
      aria-label={connected ? '접속 중' : '끊김'}
      title={connected ? '접속 중' : '연결 끊김'}
      className={`size-[8px] shrink-0 rounded-full ${connected ? 'bg-in' : 'shadow-[inset_0_0_0_1.5px_var(--color-rule)]'}`}
    />
  );
}
