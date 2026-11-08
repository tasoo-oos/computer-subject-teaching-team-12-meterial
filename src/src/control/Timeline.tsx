// 통제 타임라인 (docs/live-api.md §10.6 "타임라인", 계획 §10).
// 레슨 전체(모든 세그먼트·비트 — m1~m12·발표·정리 슬라이드까지)를 보여 줘 교사가 앞으로 올 일을 미리 본다.
//  - highMark(live 비트)까지는 진행한 비트, 그 뒤는 흐리게(클릭 불가 — §5.7 앞으로 건너뛰기 금지)
//  - 커서(지금 보는 비트) 강조, highMark를 "진행"으로 표시 — 리뷰 중에는 둘이 갈라진다
//  - 표시형(show) 비트와 highMark 자신은 클릭해 goto 리뷰(§5.7). work 비트·아직 오지 않은 비트는 클릭할 수 없다
//  - work 비트는 ●, show 비트는 ○, 공개(reveal) 비트에는 "공개" 표시를 붙인다
//  - 커서가 옮겨가면 스크롤을 따라가 커서가 항상 보인다
import { useEffect, useRef } from 'react';
import type { Beat, BeatRef, Cursor, Lesson } from '@gagyebu/live';
import { Eye } from 'lucide-react';
import { cmpRef, refOf } from './beatUtils.ts';

export interface TimelineProps {
  lesson: Lesson | null;
  beats: { segment: number; beats: Beat[] }[] | null;
  cursor: Cursor;
  highMark: BeatRef;
  onGoto: (ref: BeatRef) => void;
  className?: string;
}

export function Timeline({ lesson, beats, cursor, highMark, onGoto, className = '' }: TimelineProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);

  // 커서가 옮겨가면 스크롤을 따라간다(커서가 항상 보이게)
  useEffect(() => {
    cursorRef.current?.scrollIntoView({ block: 'nearest' });
  }, [cursor.segment, cursor.beat]);

  if (!lesson || !beats) {
    return (
      <div className="rounded-panel bg-sheet p-4 text-[13px] text-ink-3 shadow-[0_0_0_1px_var(--color-rule)]">
        수업을 열면 타임라인이 이곳에 나타납니다.
      </div>
    );
  }

  return (
    <div className={`flex min-h-0 flex-col rounded-panel bg-sheet shadow-[0_0_0_1px_var(--color-rule)] ${className}`}>
      <p className="border-b border-rule-soft px-3 py-2 text-[12px] font-bold text-ink-2">타임라인</p>
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {beats.map((seg, segIndex) => {
          const segment = lesson.segments[seg.segment];
          const header = segment?.kind === 'slides' ? segment.deck.title : '확동';
          return (
            <div key={seg.segment} className="mb-1.5">
              <p className="sticky top-0 z-10 bg-sheet/95 px-1.5 py-1 text-[11px] font-bold text-ink-3">
                {segIndex + 1}. {header}
              </p>
              <ul>
                {seg.beats.map((beat, i) => {
                  const ref = { segment: seg.segment, beat: i };
                  const isCursor = cmpRef(ref, refOf(cursor)) === 0;
                  const isLive = cmpRef(ref, highMark) === 0;
                  const review = isCursor && !isLive;
                  const passed = cmpRef(ref, highMark) <= 0; // 진행한 비트(highMark 포함)
                  const clickable = passed && (beat.mode === 'show' || isLive); // §5.7: 앞으로 건너뛰기 금지
                  return (
                    <li key={beat.id}>
                      <div
                        ref={isCursor ? cursorRef : undefined}
                        className={`flex items-center gap-1.5 rounded-[6px] px-1.5 py-[5px] text-[13px] ${
                          isCursor
                            ? 'bg-mark/80 font-bold'
                            : isLive
                              ? 'font-bold'
                              : passed
                                ? 'text-ink-2'
                                : 'text-ink-3 opacity-55' // 아직 오지 않은 비트 — 흐리게, 클릭 없음
                        }`}
                      >
                        {clickable ? (
                          <button
                            type="button"
                            disabled={isCursor}
                            onClick={() => onGoto(ref)}
                            className="flex min-w-0 flex-1 items-center gap-1.5 text-left disabled:cursor-default"
                            title={beat.mode === 'show' ? '이 비트를 다시 보여 주기' : '현재 단계로 돌아가기'}
                          >
                            <BeatMark beat={beat} />
                            <span className="truncate">{beat.label}</span>
                            {beat.reveal ? <RevealChip /> : null}
                          </button>
                        ) : (
                          <span className="flex min-w-0 flex-1 items-center gap-1.5" title={passed ? undefined : '아직 진행하지 않은 단계'}>
                            <BeatMark beat={beat} />
                            <span className="truncate">{beat.label}</span>
                            {beat.reveal ? <RevealChip /> : null}
                          </span>
                        )}
                        {isLive ? (
                          <span className="num shrink-0 rounded-[4px] bg-ink px-1 py-px text-[10px] font-bold text-white">
                            진행
                          </span>
                        ) : review ? (
                          <span className="num shrink-0 rounded-[4px] bg-seal px-1 py-px text-[10px] font-bold text-white">
                            보는 중
                          </span>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BeatMark({ beat }: { beat: { mode: 'show' | 'work' } }) {
  return (
    <span
      aria-hidden
      className={`size-[7px] shrink-0 rounded-full ${beat.mode === 'work' ? 'bg-ink' : 'shadow-[inset_0_0_0_1.5px_var(--color-ink-3)]'}`}
    />
  );
}

function RevealChip() {
  return (
    <span className="flex shrink-0 items-center gap-0.5 rounded-[4px] bg-in-soft px-1 py-px text-[10px] font-bold text-in">
      <Eye size={10} aria-hidden />
      공개
    </span>
  );
}
