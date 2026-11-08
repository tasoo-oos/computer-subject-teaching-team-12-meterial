// 대기 화면 프레임 (docs/live-api.md §10.3). submitted && beat.mode === 'work'일 때 Audience가 쓴다:
// "선생님이 다음으로 넘기면 계속됩니다" + 제출 전 화면과 같은 부품을 읽기 전용으로 재사용한 요약(children).
// S5가 가계부 Audience의 자기 계좌·이번 달 결과 읽기 전용 + AI 프롬프트 복사를 children으로 넣는다.
import type { ReactNode } from 'react';
import { CheckCircle2 } from 'lucide-react';

export function WaitingScreen({ children }: { children?: ReactNode }) {
  return (
    <div className="paper-texture min-h-dvh">
      <div className="mx-auto grid max-w-[880px] gap-5 px-5 py-10 sm:px-8">
        <div className="rounded-panel bg-sheet p-6 shadow-[0_0_0_1px_var(--color-rule),0_20px_40px_-30px_rgba(24,38,74,.5)] sm:p-8">
          <p className="flex items-center gap-2 text-[17px] font-bold text-in">
            <CheckCircle2 size={22} aria-hidden />
            제출했어요!
          </p>
          <h1 className="display mt-2 text-[33px] sm:text-[42px]">선생님이 다음으로 넘기면 계속됩니다</h1>
          <p className="mt-3 text-[15px] text-ink-2">기다리는 동안 아래 내용을 확인해 보세요.</p>
        </div>
        {children}
      </div>
    </div>
  );
}
