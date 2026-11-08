// /control 통제(교사) 페이지 (docs/live-api.md §10.6, 계획 §10). 노트북·데스크톱 우선(1280×720 이상).
// 로그인 게이트 → 본판(ControlShell) 구조(§14 S3-#88): useRoleLive는 게이트를 통과한 뒤에만 마운트한다.
// 영역: 수업 패널(열기·코드·링크 복사·TV 열기·CSV·입장 마감·끝내기·로그아웃) · 타임라인 ·
// 큰 다음 버튼(+키보드 →/Space/PageDown, ←/PageUp) · 확인 대화상자(confirm-required) ·
// 완료 현황·기본값 미리보기 · TV 미리보기 · 슬라이드 미리보기·비트 노트 · 학생 관리·발표자 지정.
import { useCallback, useEffect, useState } from 'react';
import type { RosterEntry } from '@gagyebu/live';
import { GateChecking, LoginScreen, useLoginGate } from '../live/LoginScreen.tsx';
import { ReconnectBanner } from '../live/banner.tsx';
import { useRoleLive } from '../live/useRoleLive.ts';
import { BeatPanel, CursorLine, ReviewBanner } from './BeatPanel.tsx';
import { ClassPanel, StatusChip } from './ClassPanel.tsx';
import { Dialog } from './Dialog.tsx';
import { NextBar } from './NextBar.tsx';
import { ProgressPanel } from './ProgressPanel.tsx';
import { StudentPanel } from './StudentPanel.tsx';
import { Timeline } from './Timeline.tsx';
import { TVPreview } from './TVPreview.tsx';
import { cmpRef, flattenBeats, refOf } from './beatUtils.ts';
import { useTeacherKeys } from './useTeacherKeys.ts';

export function ControlPage() {
  const gate = useLoginGate('control');
  // 소켓이 unauthorized를 알리면(쿠키 만료 등) 다시 비밀번호 화면으로
  const [forceLogin, setForceLogin] = useState(false);
  if (gate.checking) return <GateChecking />;
  if (gate.role !== 'control' || forceLogin) {
    return (
      <LoginScreen
        role="control"
        offline={gate.offline}
        onSuccess={() => {
          setForceLogin(false);
          gate.retry();
        }}
      />
    );
  }
  return <ControlShell onUnauthorized={() => setForceLogin(true)} onLoggedOut={() => setForceLogin(true)} />;
}

function ControlShell({ onUnauthorized, onLoggedOut }: { onUnauthorized: () => void; onLoggedOut: () => void }) {
  const role = useRoleLive('control');

  useEffect(() => {
    if (role.status === 'unauthorized') onUnauthorized();
  }, [role.status, onUnauthorized]);

  // 대화상자들 — 열려 있는 동안 교사 키(→/Space)는 무시된다
  const [opening, setOpening] = useState(false);
  const [confirmPending, setConfirmPending] = useState<number | null>(null); // confirm-required(§5.5-2)
  const [endOpen, setEndOpen] = useState(false);
  const [kickTarget, setKickTarget] = useState<RosterEntry | null>(null);

  const cls = role.classState;
  const active = cls && cls.status === 'open' ? cls : null;
  const flat = flattenBeats(role.beats);
  const cursorRef = cls ? refOf(cls.cursor) : null;
  const atLive = !!(cls && cursorRef && cmpRef(cursorRef, cls.highMark) === 0);
  const review = !!(cls && cursorRef && cmpRef(cursorRef, cls.highMark) < 0);
  const cursorBeat = cls && role.beats ? (role.beats[cls.cursor.segment]?.beats[cls.cursor.beat] ?? null) : null;
  const lastRef = flat.length > 0 ? flat[flat.length - 1]!.ref : null;

  const doNext = useCallback(
    async (force?: boolean) => {
      const ack = await role.next(force);
      if (!ack.ok && ack.reason === 'confirm-required') setConfirmPending(ack.pending ?? 0);
    },
    [role],
  );

  useTeacherKeys({
    next: () => void doNext(),
    prev: () => void role.prev(),
    enabled: confirmPending === null && !endOpen && !kickTarget && !!active && role.status === 'open',
  });

  const openClass = async (lessonId?: string) => {
    setOpening(true);
    await role.openClass(lessonId);
    setOpening(false);
  };

  const logout = async () => {
    try {
      await fetch('/api/logout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ role: 'control' }),
      });
    } finally {
      onLoggedOut();
    }
  };

  // 다음 버튼: live 비트가 공개(reveal) 전이면 공개가 먼저(§5.5-1) — 라벨만 바꾼다
  const revealPending = !!(active && atLive && cursorBeat?.reveal && !cls!.cursor.revealed);
  const nextLabel = revealPending ? '결과 공개' : '다음';
  const isLastLive = !!(active && lastRef && cmpRef(cls!.highMark, lastRef) === 0);
  // 커서가 실재하지 않는 비트(빈 도입 덱 레슨의 열림 직후 {0,0})를 가리켜도 next는 유효하다 —
  // 서버 nextRefOf가 다음 실재 비트로 옮긴다. 마지막 비트에서만 끈다.
  const nextDisabled = !active || flat.length === 0 || (atLive && isLastLive && !revealPending) || role.status !== 'open';
  const prevDisabled =
    !active ||
    !cursorRef ||
    role.status !== 'open' ||
    !flat.some((b) => b.beat.mode === 'show' && cmpRef(b.ref, cursorRef) < 0);

  const stats = role.stats;
  // TV 미리보기의 발표자 닉네임: 통제 소켓은 spotlightState를 받지 못하므로(§5.2)
  // roster + classState.spotlight에서 클라이언트가 만든다(§14 #132 — 서버 변경 없이 더 단순한 쪽).
  const spotlightName = cls?.spotlight
    ? (role.roster.find((r) => r.studentId === cls.spotlight)?.nickname ?? null)
    : null;

  return (
    <div className="paper-texture flex h-dvh flex-col overflow-hidden">
      <ReconnectBanner show={role.status === 'reconnecting'} />
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 pt-3">
        <p className="display text-[19px]">통제 화면</p>
        {role.lesson ? <p className="truncate text-[12px] text-ink-3">{role.lesson.title}</p> : null}
        <div className="flex-1" />
        <StatusChip status={role.status} />
      </header>

      <div className="px-3 pt-2">
        <ClassPanel
          classes={role.classes}
          classState={cls}
          opening={opening}
          onOpenClass={(lessonId) => void openClass(lessonId)}
          onSelect={(code) => void role.select(code)}
          onEndClass={() => setEndOpen(true)}
          onLockJoin={(on) => void role.lockJoin(on)}
          onLogout={() => void logout()}
        />
      </div>

      <main
        className="grid min-h-0 flex-1 gap-3 p-3"
        style={{
          gridTemplateColumns: 'minmax(196px,232px) minmax(0,1fr) minmax(292px,336px)',
        }}
      >
        <div className="flex min-h-0 flex-col gap-3">
          <Timeline
            className="min-h-0 flex-1"
            lesson={role.lesson}
            beats={role.beats}
            cursor={cls?.cursor ?? { segment: 0, beat: 0, revealed: false }}
            highMark={cls?.highMark ?? { segment: 0, beat: 0 }}
            onGoto={(ref) => void role.goto(ref)}
          />
          <p className="rounded-panel bg-sheet px-3 py-2 text-[11.5px] leading-relaxed text-ink-3 shadow-[0_0_0_1px_var(--color-rule)]">
            키보드: <b>→ / Space / PageDown</b> 다음 · <b>← / PageUp</b> 이전 · 확인 창 <b>Enter</b>/<b>Esc</b>
          </p>
        </div>

        <section className="flex min-h-0 flex-col gap-3">
          {active && cls ? (
            <>
              {review ? <ReviewBanner onBackToLive={() => void role.goto(cls.highMark)} /> : null}
              <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
                <CursorLine beat={cursorBeat} ref={cls.cursor} review={review} />
                <p className="text-[12px] text-ink-3">
                  {stats ? (
                    <span className="num">
                      {stats.beat.segment}:{stats.beat.beat} 집계
                    </span>
                  ) : null}
                </p>
              </div>
              <div className="mx-auto w-full max-w-[640px] shrink-0">
                <TVPreview
                  classState={cls}
                  lesson={role.lesson!}
                  beats={role.beats}
                  stats={stats}
                  spotlightName={spotlightName}
                />
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto rounded-panel bg-sheet p-3 shadow-[0_0_0_1px_var(--color-rule)]">
                <BeatPanel
                  classState={cls}
                  lesson={role.lesson!}
                  beats={role.beats}
                  stats={stats}
                  roster={role.roster}
                />
              </div>
              <NextBar
                label={nextLabel}
                disabled={nextDisabled}
                prevDisabled={prevDisabled}
                revealToggle={
                  cursorBeat?.reveal && atLive
                    ? {
                        revealed: cls.cursor.revealed,
                        onToggle: (on) => void role.reveal(on),
                      }
                    : null
                }
                onNext={() => void doNext()}
                onPrev={() => void role.prev()}
              />
            </>
          ) : (
            <div className="grid min-h-0 flex-1 place-items-center rounded-panel bg-sheet p-6 text-center shadow-[0_0_0_1px_var(--color-rule)]">
              <div>
                <p className="display text-[26px]">{cls ? '수업이 끝났어요' : '열린 수업이 없어요'}</p>
                <p className="mt-2 text-[14px] text-ink-2">
                  위에서 <b>수업 열기</b>를 누르면 타임라인과 완료 현황이 이곳에 나타납니다.
                </p>
                <p className="mt-3 text-[13px] text-ink-3">수업을 열면 키보드만으로 전체 수업을 진행할 수 있어요.</p>
              </div>
            </div>
          )}
        </section>

        <aside className="flex min-h-0 flex-col gap-3">
          <ProgressPanel
            progress={stats?.progress ?? null}
            fallbackPreview={stats?.fallbackPreview ?? null}
            roster={role.roster}
          />
          <div className="flex min-h-0 flex-1 flex-col">
            <StudentPanel
              roster={role.roster}
              spotlightId={cls?.spotlight ?? null}
              onSpotlight={(id) => void role.spotlight(id)}
              onRename={(id, nickname) => void role.student({ op: 'rename', id, nickname })}
              onKick={(entry) => setKickTarget(entry)}
              onMerge={(pendingId, intoId) => void role.student({ op: 'merge', pendingId, intoId })}
            />
          </div>
        </aside>
      </main>

      {/* confirm-required(§5.5-2): 미완료가 있을 때 "다음" → 확인 시 next(true) */}
      {confirmPending !== null ? (
        <Dialog
          title={`${confirmPending}명이 아직 고르는 중입니다`}
          confirmLabel="기본 선택지로 넘기기"
          onConfirm={() => {
            setConfirmPending(null);
            void doNext(true);
          }}
          onCancel={() => setConfirmPending(null)}
        >
          기본 선택지로 넘길까요?
          {stats?.fallbackPreview ? (
            <p className="mt-1.5">
              넘기면 <b>“{stats.fallbackPreview}”</b> 등 각 학생이 있는 장면의 기본 선택지가 자동으로 적용돼요.
            </p>
          ) : null}
          <p className="mt-1.5">
            <b className="num">{confirmPending}명</b>이 자동으로 처리되고 수업은 계속 진행돼요. 학생들에게는 “자동으로
            선택됐다”는 안내가 표시됩니다.
          </p>
        </Dialog>
      ) : null}

      {endOpen ? (
        <Dialog
          title="수업을 끝낼까요?"
          confirmLabel="수업 끝내기"
          danger
          onConfirm={() => {
            setEndOpen(false);
            void role.endClass();
          }}
          onCancel={() => setEndOpen(false)}
        >
          학생 링크가 막히고 더 이상 들어올 수 없어요. 기록은 남아 CSV로 내보낼 수 있어요.
        </Dialog>
      ) : null}

      {kickTarget ? (
        <Dialog
          title={
            kickTarget.pendingMerge
              ? `${kickTarget.nickname}님의 기록 이어받기를 거부할까요?`
              : `${kickTarget.nickname}님을 내보낼까요?`
          }
          confirmLabel={kickTarget.pendingMerge ? '거부' : '내보내기'}
          danger
          onConfirm={() => {
            void role.student({ op: 'kick', id: kickTarget.studentId });
            setKickTarget(null);
          }}
          onCancel={() => setKickTarget(null)}
        >
          {kickTarget.pendingMerge
            ? '거부하면 이 학생은 승인되지 않았다는 안내를 보고 다른 닉네임으로 다시 입장할 수 있어요.'
            : '이 학생은 더 이상 수업에 참여할 수 없어요. 기록은 그대로 남습니다.'}
        </Dialog>
      ) : null}
    </div>
  );
}
