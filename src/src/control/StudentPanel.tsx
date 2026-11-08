// 학생 관리 + 발표자 지정 (docs/live-api.md §10.6 "발표"·"학생 관리", §5.8).
//  - 발표자(spotlight) 지정·해제: 별 표시 (커서 비트가 활동일 때 의미가 있다)
//  - 이름 변경(rename): 행 안에서 바로 고친다 (1~10자)
//  - 내보내기(kick): 확인 대화상자는 본판(ControlShell)이 띄운다
//  - 기록 이어받기: pendingMerge 항목 승인(merge, 같은 닉네임의 기존 기록으로) / 거부(kick → merge-rejected)
import { useEffect, useRef, useState } from 'react';
import type { RosterEntry } from '@gagyebu/live';
import { Laptop, Pencil, Smartphone, Star, Tablet, X } from 'lucide-react';
import { ConnectedDot } from './ProgressPanel.tsx';

export interface StudentPanelProps {
  roster: RosterEntry[];
  spotlightId: string | null;
  onSpotlight: (studentId: string | null) => void;
  onRename: (id: string, nickname: string) => void;
  onKick: (entry: RosterEntry) => void;
  onMerge: (pendingId: string, intoId: string) => void;
}

const DEVICE_ICON = {
  laptop: Laptop,
  tablet: Tablet,
  phone: Smartphone,
} as const;

export function StudentPanel({ roster, spotlightId, onSpotlight, onRename, onKick, onMerge }: StudentPanelProps) {
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const editRef = useRef<HTMLInputElement>(null);

  // 편집을 "시작"할 때만 전체 선택한다. 입력할 때마다 다시 select하면 한 글자씩 덮어써진다
  const editingId = editing?.id;
  useEffect(() => {
    if (editingId) editRef.current?.select();
  }, [editingId]);

  const commitRename = () => {
    if (!editing) return;
    const name = editing.name.trim();
    const entry = roster.find((r) => r.studentId === editing.id);
    if (name && entry && name !== entry.nickname) onRename(editing.id, name);
    setEditing(null);
  };

  return (
    <section className="flex min-h-0 flex-col rounded-panel bg-sheet shadow-[0_0_0_1px_var(--color-rule)]">
      <p className="border-b border-rule-soft px-3 py-2 text-[12px] font-bold text-ink-2">
        학생 <span className="num text-ink-3">{roster.filter((r) => !r.pendingMerge).length}명</span> · 발표자는 별로
        지정
      </p>
      <ul className="min-h-0 flex-1 overflow-y-auto px-2 py-1.5">
        {roster.length === 0 ? (
          <li className="px-1 py-2 text-[13px] text-ink-3">아직 아무도 입장하지 않았어요</li>
        ) : null}
        {roster.map((r) => {
          const Device = DEVICE_ICON[r.device] ?? Laptop;
          const isSpotlight = spotlightId === r.studentId;
          const mergeTarget = r.pendingMerge
            ? roster.find((other) => !other.pendingMerge && other.nickname === r.nickname)
            : undefined;
          return (
            <li
              key={r.studentId}
              className="flex items-center gap-1.5 rounded-[6px] px-1 py-1 text-[13px] hover:bg-white/60"
            >
              {r.pendingMerge ? (
                <>
                  <span className="hatch size-[8px] shrink-0 rounded-full" title="승인 대기" aria-hidden />
                  <span className="shrink-0 font-semibold">{r.nickname}</span>
                  <span className="shrink-0 rounded-[4px] bg-mark px-1 py-px text-[10px] font-bold">
                    기록 이어받기 승인 대기
                  </span>
                  <span className="ml-auto flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      className="btn btn-primary h-7 px-2 text-[12px]"
                      disabled={!mergeTarget}
                      title={
                        mergeTarget
                          ? `기존 ${mergeTarget.nickname} 기록으로 이어받기`
                          : '같은 닉네임의 기존 기록을 찾을 수 없어요'
                      }
                      onClick={() => mergeTarget && onMerge(r.studentId, mergeTarget.studentId)}
                    >
                      승인
                    </button>
                    <button
                      type="button"
                      className="btn btn-quiet h-7 px-2 text-[12px]"
                      onClick={() => onKick(r)}
                      title="거부 (다른 닉네임으로 다시 입장하게 함)"
                    >
                      거부
                    </button>
                  </span>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => onSpotlight(isSpotlight ? null : r.studentId)}
                    className={`grid size-6 shrink-0 place-items-center rounded-[6px] ${isSpotlight ? 'bg-mark text-ink' : 'text-ink-3 hover:bg-white'}`}
                    title={isSpotlight ? '발표자 해제' : '발표자로 지정'}
                    aria-label={isSpotlight ? `${r.nickname} 발표자 해제` : `${r.nickname} 발표자 지정`}
                  >
                    <Star size={14} fill={isSpotlight ? 'currentColor' : 'none'} aria-hidden />
                  </button>
                  <ConnectedDot connected={r.connected} />
                  {editing?.id === r.studentId ? (
                    <input
                      ref={editRef}
                      value={editing.name}
                      maxLength={10}
                      onChange={(e) => setEditing({ id: r.studentId, name: e.target.value })}
                      onBlur={commitRename}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitRename();
                        if (e.key === 'Escape') setEditing(null);
                      }}
                      className="h-7 w-[86px] rounded-[6px] bg-white px-1.5 text-[13px] shadow-[inset_0_0_0_1.5px_var(--color-in)]"
                    />
                  ) : (
                    <button
                      type="button"
                      className="shrink-0 font-semibold hover:underline"
                      onClick={() => setEditing({ id: r.studentId, name: r.nickname })}
                      title="이름 바꾸기"
                    >
                      {r.nickname}
                    </button>
                  )}
                  <span
                    className={`shrink-0 rounded-[4px] px-1 py-px text-[10px] font-bold ${r.done ? 'bg-in-soft text-in' : 'bg-rule-soft text-ink-3'}`}
                  >
                    {r.done ? '완료' : '진행 중'}
                  </span>
                  {r.stalled ? (
                    // 기본값 루프 50회 초과로 멈춤(§4.2) — 중립 표시, 이후 비트에서 풀린다
                    <span
                      className="shrink-0 rounded-[4px] bg-rule-soft px-1 py-px text-[10px] font-bold text-ink-2"
                      title="자동 처리가 멈춤(기본값 50회 초과). 다음 단계에서 다시 따라잡을 수 있어요"
                    >
                      멈춤
                    </span>
                  ) : null}
                  {r.late ? (
                    <span className="shrink-0 rounded-[4px] bg-in-soft px-1 py-px text-[10px] font-bold text-in">
                      지각
                    </span>
                  ) : null}
                  <Device size={13} className="shrink-0 text-ink-3" aria-label={r.device} />
                  <span className="min-w-0 flex-1 truncate text-right text-[11.5px] text-ink-3">{r.scene ?? ''}</span>
                  <span className="flex shrink-0 items-center gap-0.5">
                    <button
                      type="button"
                      className="grid size-6 place-items-center rounded-[6px] text-ink-3 hover:bg-white"
                      onClick={() => setEditing({ id: r.studentId, name: r.nickname })}
                      title="이름 바꾸기"
                      aria-label={`${r.nickname} 이름 바꾸기`}
                    >
                      <Pencil size={13} aria-hidden />
                    </button>
                    <button
                      type="button"
                      className="grid size-6 place-items-center rounded-[6px] text-ink-3 hover:bg-seal-soft hover:text-seal"
                      onClick={() => onKick(r)}
                      title="내보내기"
                      aria-label={`${r.nickname} 내보내기`}
                    >
                      <X size={14} aria-hidden />
                    </button>
                  </span>
                </>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
