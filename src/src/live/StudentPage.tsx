// 학생 페이지 (docs/live-api.md §10.4). /<4자리 코드>에서 렌더링된다.
//   상태 화면(연결 중·끝남·없음·입장 마감) → 입장 전엔 모든 비트에서 닉네임 입력(§8.3)
//   → 커서 비트가 슬라이드 세그먼트면 SlideCanvas, 활동 세그먼트면 ACTIVITY_VIEWS[activityId].Audience.
// 레지스트리에 활동이 아직 없으면 자리표시를 보여 준다(S5가 가계부 화면을 등록한다).
import { useEffect, useState } from 'react';
import type { Action, GameState } from '@gagyebu/core';
import type { GagyebuDraft } from '@gagyebu/activity-gagyebu';
import type { AutoAppliedNotice } from '@gagyebu/live';
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
  const [noticeDismissed, setNoticeDismissed] = useState(false);

  // 다시 입장해 정상 흐름에 들어오면 "다시 입장하기" 확인 상태를 되돌린다
  useEffect(() => {
    if (live.you) setKickedDismissed(false);
  }, [live.you]);

  // 자동 처리 안내 개수가 바뀌면(새 알림 도착) 닫기 상태를 되돌린다.
  // 커서 비트가 바뀌면 서버 큐가 비워지므로 카드도 사라진다(§10.2, §14 #134).
  const noticeCount = live.autoApplied.filter((n) => n.message).length;
  useEffect(() => {
    setNoticeDismissed(false);
  }, [noticeCount]);

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
    } else if (ack.reason === 'invalid-nickname') {
      // 잘못된 닉네임(빈 값·공백만·10자 초과) — 전용 이유로 구분된다(§14 #130)
      setJoinError('닉네임은 1~10자로 입력해 주세요');
    } else if (ack.reason === 'class-full') {
      setJoinError('수업이 꽉 찼어요. 선생님에게 말씀드려 주세요.');
    }
    // 'join-locked': 실제로 입장이 잠긴 수업. 훅이 status를 'join-locked'로 바꾸면
    // 닉네임 양식 안에 입장 마감 안내문을 보여 준다(§14 #86).
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
        error={joinError ?? (live.status === 'join-locked' ? '지금은 입장할 수 없어요. 입장이 마감되었을 수 있어요. 선생님에게 확인해 주세요.' : null)}
      />
    );
  }

  const cls = live.classState;
  const seg = cls && live.lesson ? live.lesson.segments[cls.cursor.segment] : undefined;
  const beat = live.beat;
  // 빈 안내 문구('' — 순차 처리 걸음)는 화면에 세지 않는다(§14 #134)
  const notices = live.autoApplied.filter((n) => n.message);

  return (
    <>
      <ReconnectBanner show={live.status === 'reconnecting'} />
      {!noticeDismissed && notices.length > 0 ? (
        <AutoAppliedCard notices={notices} onClose={() => setNoticeDismissed(true)} />
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

/** 자동 처리 안내 카드 (§14 #134): 알림을 하나로 묶어 정상 흐름 맨 위에 보여 준다(오버레이 아님).
 *  중립 표시(경고색 없음). 닫기 버튼으로 지울 수 있고, 커서 비트가 바뀌면 서버 큐가 비워져 사라진다. */
function AutoAppliedCard({ notices, onClose }: { notices: AutoAppliedNotice[]; onClose: () => void }) {
  return (
    <section aria-label="자동으로 처리된 내용" className="mx-auto w-full max-w-[36rem] px-4 pt-3">
      <div className="rounded-[10px] bg-sheet px-4 py-3 shadow-[0_0_0_1px_var(--color-rule)]">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-[13px] font-bold text-ink-2">자동으로 처리된 내용</p>
          <button
            type="button"
            className="text-[12px] font-semibold text-in underline underline-offset-2"
            onClick={onClose}
          >
            닫기
          </button>
        </div>
        <ul className="mt-1.5 list-disc pl-4 text-[13px] leading-relaxed text-ink-2">
          {notices.map((n, i) => (
            <li key={`${n.beatId}-${i}`}>{n.message}</li>
          ))}
        </ul>
      </div>
    </section>
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
