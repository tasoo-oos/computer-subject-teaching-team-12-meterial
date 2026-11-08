// `/` 코드 입력 화면 (docs/live-api.md §10.7). 4자리 숫자 → /<code>로 이동.
// 진행 중인 수업이 없으면 학생 화면이 "지금 진행 중인 수업이 없어요"(NotFoundScreen)를 보여 준다.
import { useState } from 'react';
import { ArrowRight } from 'lucide-react';

export function CodeEntryPage() {
  const [code, setCode] = useState('');
  const valid = /^\d{4}$/.test(code);
  return (
    <div className="paper-texture grid min-h-dvh place-items-center px-5">
      <div className="w-full max-w-[30rem] rounded-panel bg-sheet p-6 shadow-[0_0_0_1px_var(--color-rule),0_20px_40px_-30px_rgba(24,38,74,.5)] sm:p-8">
        <p className="text-[15px] font-semibold text-ink-2">가계부 시뮬레이션 수업</p>
        <h1 className="display mt-2 text-[42px] leading-tight">수업 코드를 입력하세요</h1>
        <p className="mt-3 text-[15px] text-ink-2">선생님이 화면에 보여 준 4자리 숫자를 그대로 입력해 주세요.</p>
        <form
          className="mt-6 flex flex-col gap-3 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            if (valid) window.location.href = `/${code}`;
          }}
        >
          <label className="flex-1">
            <span className="sr-only">수업 코드 4자리 숫자</span>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
              inputMode="numeric"
              autoComplete="off"
              placeholder="1234"
              aria-label="수업 코드 4자리 숫자"
              className="num h-14 w-full rounded-[8px] bg-white px-4 text-center text-[28px] font-bold tracking-[0.35em] shadow-[inset_0_0_0_1.5px_var(--color-rule)] placeholder:text-ink-3/60 focus:shadow-[inset_0_0_0_2px_var(--color-ink)]"
            />
          </label>
          <button type="submit" disabled={!valid} className="btn btn-primary h-14 px-6 text-[17px]">
            들어가기
            <ArrowRight size={18} aria-hidden />
          </button>
        </form>
        <p className="mt-4 text-[13px] text-ink-3">코드는 선생님이 수업을 열 때마다 바뀌어요.</p>
      </div>
    </div>
  );
}
