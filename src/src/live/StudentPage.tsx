// 학생 페이지 (docs/live-api.md §10.4). /<4자리 코드>에서 렌더링된다.
//   상태 화면(연결 중·끝남·없음·입장 마감) → 입장 전엔 모든 비트에서 닉네임 입력(§8.3)
//   → 커서 비트가 슬라이드 세그먼트면 SlideCanvas, 활동 세그먼트면 ACTIVITY_VIEWS[activityId].Audience.
// 레지스트리에 활동이 아직 없으면 자리표시를 보여 준다(S5가 가계부 화면을 등록한다).
import { useEffect, useState } from 'react';
import type { Action, GameState } from '@gagyebu/core';
import type { GagyebuDraft } from '@gagyebu/activity-gagyebu';
import { ACTIVITY_VIEWS } from '../activities/registry.ts';
import { SlideCanvas, slideOfBeat } from '../activities/slides/SlideCanvas.tsx';
import { ReconnectBanner } from './banner.tsx';
import {
  ConnectingScreen,
  EndedScreen,
  KickedScreen,
  MergePendingScreen,
  NicknameForm,
  NotFoundScreen,
} from './StatusScreens.tsx';
import { useLive } from './useLive.ts';
import { useWakeLock } from './useWakeLock.ts';

export function StudentPage({ code }: { code: string }) {
  const live = useLive<GameState, Action, GagyebuDraft>(code);
  useWakeLock();

  const [joinError, setJoinError] = useState<string | null>(null);
  const [pending, setPending] = useState<{ nickname: string; pendingId: string } | null>(null);
  const [kickedDismissed, setKickedDismissed] = useState(false);

  // 다시 입장해 정상 흐름에 들어오면 "다시 입장하기" 확인 상태를 되돌린다
  useEffect(() => {
    if (live.you) setKickedDismissed(false);
  }, [live.you]);

  const tryJoin = async (nickname: string) => {
    setJoinError(null);
    const ack = await live.join(nickname);
    if (ack.ok) {
      setPending(null);
      return;
    }
    if (ack.reason === 'nickname-taken') {
      // 기록 이어받기 대기(§5.8). "선생님 승인을 기다리는 중" 화면 or 다른 닉네임으로 다시 join
      setPending({ nickname, pendingId: ack.pendingId });
    } else if (ack.reason === 'class-full') {
      setJoinError('수업이 꽉 찼어요. 선생님에게 말씀드려 주세요.');
    }
    // 'join-locked': 입장 마감과 잘못된 닉네임(§14 S2-#77)을 구분할 수 없어
    // 훅이 status를 'join-locked'로 바꾸면 닉네임 양식 안에 일반 안내문을 보여 준다
  };

  if (live.status === 'connecting') return <ConnectingScreen />;
  if (live.status === 'ended') return <EndedScreen />;
  if (live.status === 'not-found') return <NotFoundScreen />;

  // 입장하지 않았으면 모든 비트에서 닉네임 입력 화면(§8.3)
  if (!live.you) {
    if (live.kicked && !kickedDismissed) {
      return <KickedScreen reason={live.kicked} onRetry={() => setKickedDismissed(true)} />;
    }
    if (pending) {
      return <MergePendingScreen nickname={pending.nickname} onRetry={tryJoin} />;
    }
    return (
      <NicknameForm
        onSubmit={tryJoin}
        error={joinError ?? (live.status === 'join-locked' ? '지금은 입장할 수 없어요. 입장이 마감되었을 수 있어요. 닉네임(1~10자)을 확인하고 다시 시도해 주세요.' : null)}
      />
    );
  }

  const cls = live.classState;
  const seg = cls && live.lesson ? live.lesson.segments[cls.cursor.segment] : undefined;
  const beat = live.beat;

  return (
    <>
      <ReconnectBanner show={live.status === 'reconnecting'} />
      {live.autoApplied.length > 0 ? (
        <div className="fixed inset-x-0 top-0 z-40 grid justify-center gap-2 px-4 pt-14 sm:justify-end sm:pr-4" role="status">
          {live.autoApplied.map((n, i) => (
            <p
              key={`${n.beatId}-${i}`}
              className="sheet-in max-w-[24rem] rounded-[10px] bg-mark px-4 py-3 text-[14px] leading-relaxed font-medium shadow-[0_8px_24px_-12px_rgba(24,38,74,.5)]"
            >
              {n.message}
            </p>
          ))}
        </div>
      ) : null}
      {seg?.kind === 'slides' && beat ? (
        <SlideCanvas deckId={seg.deck.id} {...slideOfBeat(beat.id)} />
      ) : seg?.kind === 'activity' && beat && cls ? (
        (() => {
          const views = ACTIVITY_VIEWS[seg.activity];
          const Audience = views?.Audience;
          if (Audience) {
            return (
              <Audience
                state={live.state}
                beat={beat}
                revealed={cls.cursor.revealed}
                submitted={live.submitted}
                mode="live"
                dispatch={live.dispatch as (a: unknown) => void}
                draft={live.draft as (d: unknown) => void}
              />
            );
          }
          return <ActivityPlaceholder activityId={seg.activity} beatId={beat.id} />;
        })()
      ) : (
        <ConnectingScreen />
      )}
    </>
  );
}

/** 레지스트리에 활동이 아직 없을 때 자리표시 (S5가 ACTIVITY_VIEWS에 가계부 화면을 등록한다) */
function ActivityPlaceholder({ activityId, beatId }: { activityId: string; beatId: string }) {
  return (
    <div className="paper-texture grid min-h-dvh place-items-center px-5">
      <div className="w-full max-w-[30rem] rounded-panel bg-sheet p-6 text-center shadow-[0_0_0_1px_var(--color-rule)] sm:p-8">
        <p className="text-[15px] font-semibold text-ink-2">활동 화면 준비 중</p>
        <h1 className="display mt-2 text-[33px]">이 단계의 화면이 아직 준비되지 않았어요</h1>
        <p className="num mt-3 text-[14px] text-ink-3">
          activity: {activityId} · beat: {beatId}
        </p>
        <p className="mt-3 text-[14px] text-ink-2">선생님이 안내해 주면 다음 단계로 넘어갑니다.</p>
      </div>
    </div>
  );
}
