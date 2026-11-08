// 학생 페이지의 상태 화면들 (docs/live-api.md §10.4, §10.7): 연결 중·끝난 수업·없는 수업·
// 승인 대기(merge-pending)·내보내기(kicked)·닉네임 입력. 라우터의 404 화면도 여기서 내보낸다.
import { useState } from 'react';
import { Hourglass, LogIn } from 'lucide-react';

function Center({ icon, title, children }: { icon?: React.ReactNode; title: string; children?: React.ReactNode }) {
  return (
    <div className="paper-texture grid min-h-dvh place-items-center px-5">
      <div className="w-full max-w-[30rem] rounded-panel bg-sheet p-6 text-center shadow-[0_0_0_1px_var(--color-rule),0_20px_40px_-30px_rgba(24,38,74,.5)] sm:p-8">
        {icon ? <div className="mx-auto mb-3 grid size-12 place-items-center rounded-full bg-in-soft text-in">{icon}</div> : null}
        <h1 className="display text-[33px]">{title}</h1>
        {children ? <div className="mt-3 text-[15px] leading-relaxed text-ink-2">{children}</div> : null}
      </div>
    </div>
  );
}

export function ConnectingScreen() {
  return (
    <Center title="수업에 연결하는 중…" icon={<Hourglass size={22} aria-hidden />}>
      잠시만 기다려 주세요.
    </Center>
  );
}

export function EndedScreen() {
  return (
    <Center title="끝난 수업입니다">
      이 수업은 마쳤어요. 선생님이 안내해 주면 다음 수업 코드로 다시 들어와 주세요.
      <a href="/" className="btn btn-primary mt-5">
        첫 화면으로
      </a>
    </Center>
  );
}

export function NotFoundScreen() {
  return (
    <Center title="수업 코드를 확인해 주세요">
      지금 이 코드로 진행 중인 수업이 없어요. 선생님이 알려 준 4자리 숫자를 다시 확인해 주세요.
      <a href="/" className="btn btn-primary mt-5">
        코드 다시 입력하기
      </a>
    </Center>
  );
}

/** 기록 이어받기 승인 대기 (§5.8): "선생님 승인을 기다리는 중" + 다른 닉네임으로 다시 join */
export function MergePendingScreen({ nickname, onRetry }: { nickname: string; onRetry: (nickname: string) => void }) {
  const [next, setNext] = useState('');
  const valid = next.trim().length > 0 && next.trim().length <= 10 && next.trim() !== nickname;
  return (
    <Center title="선생님 승인을 기다리는 중" icon={<Hourglass size={22} aria-hidden />}>
      <p>
        이미 같은 닉네임(<strong>{nickname}</strong>)이 수업에 있어요. 선생님이 승인하면 그 기록을 이어받아 계속합니다.
      </p>
      <form
        className="mx-auto mt-5 flex max-w-[20rem] flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) onRetry(next.trim());
        }}
      >
        <label className="text-left">
          <span className="mb-1.5 block text-[14px] font-semibold">다른 닉네임으로 새로 시작할 수도 있어요</span>
          <input
            value={next}
            onChange={(e) => setNext(e.target.value)}
            maxLength={10}
            placeholder="새 닉네임"
            className="h-12 w-full rounded-[8px] bg-white px-3.5 text-[17px] shadow-[inset_0_0_0_1.5px_var(--color-rule)]"
          />
        </label>
        <button type="submit" disabled={!valid} className="btn btn-quiet">
          이 닉네임으로 다시 입장
        </button>
      </form>
    </Center>
  );
}

/** 내보내기·merge 거부 (kicked, §5.8) */
export function KickedScreen({ reason, onRetry }: { reason: 'kicked' | 'merge-rejected'; onRetry: () => void }) {
  return (
    <Center title={reason === 'merge-rejected' ? '승인되지 않았어요' : '수업에서 나갔어요'}>
      {reason === 'merge-rejected'
        ? '기록 이어받기가 승인되지 않았어요. 다른 닉네임으로 다시 시도해 주세요.'
        : '선생님이 수업에서 내보냈어요. 다시 들어오려면 선생님에게 말씀드려 주세요.'}
      <button type="button" onClick={onRetry} className="btn btn-primary mt-5">
        다시 입장하기
      </button>
    </Center>
  );
}

/** 닉네임 입력 (§8.3: 입장하지 않은 접속자는 모든 비트에서 이 화면).
 *  유효성(1~10자)은 서버가 판정한다(§14 #130) — 잘못된 닉네임은 'invalid-nickname'
 *  ack로 돌아와 이 양식 안에 안내문으로 보여 주므로, 입력 단계에서 막지 않고 그대로 보낸다. */
export function NicknameForm({ nickname, onSubmit, error }: { nickname?: string; onSubmit: (nickname: string) => void; error?: string | null }) {
  const [name, setName] = useState(nickname ?? '');
  return (
    <div className="paper-texture grid min-h-dvh place-items-center px-5">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(name.trim());
        }}
        className="w-full max-w-[26rem] rounded-panel bg-sheet p-6 shadow-[0_0_0_1px_var(--color-rule),0_20px_40px_-30px_rgba(24,38,74,.5)] sm:p-8"
      >
        <p className="text-[15px] font-semibold text-ink-2">수업에 들어가기</p>
        <h1 className="display mt-2 text-[33px]">닉네임을 정해 주세요</h1>
        <p className="mt-2 text-[14px] text-ink-2">통장에 찍힐 이름이에요. 1~10자, 수업에서 한 번 정하면 바꾸기 어려워요.</p>
        <label className="mt-5 block">
          <span className="mb-1.5 block text-[15px] font-semibold">닉네임</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예: 하늘"
            autoComplete="off"
            className="h-12 w-full rounded-[8px] bg-white px-3.5 text-[17px] shadow-[inset_0_0_0_1.5px_var(--color-rule)] placeholder:text-ink-3 focus:shadow-[inset_0_0_0_2px_var(--color-ink)]"
          />
        </label>
        {error ? (
          <p role="alert" className="mt-3 rounded-[8px] bg-seal-soft px-3.5 py-2.5 text-[14px] text-seal">
            {error}
          </p>
        ) : null}
        <button type="submit" className="btn btn-primary mt-5 h-12 w-full text-[17px]">
          <LogIn size={18} aria-hidden />
          입장
        </button>
      </form>
    </div>
  );
}
