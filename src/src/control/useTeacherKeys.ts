// 교사 키보드 조작 (docs/live-api.md §10.6 "다음", 계획 §10 — 발표용 클리커 호환).
// → / Space / PageDown = next, ← / PageUp = prev.
//  - 입력 요소(input·textarea·select·contentEditable)에 포커스가 있으면 무시한다
//  - e.repeat는 무시한다 — 키를 누르고 있아도 한 번만 next/prev가 나간다
//  - enabled가 false(대화상자 열림·수업 없음)면 무시한다. 대화상자의 Enter/Esc는 Dialog이 처리한다
import { useEffect, useRef } from "react";

export interface TeacherKeys {
  next(): void;
  prev(): void;
  enabled: boolean;
}

export function useTeacherKeys(handler: TeacherKeys): void {
  const ref = useRef(handler);
  ref.current = handler;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const h = ref.current;
      if (!h.enabled || e.repeat) return;
      const el = e.target as HTMLElement | null;
      if (
        el &&
        (el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          el.tagName === "SELECT" ||
          el.isContentEditable)
      )
        return;
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") {
        e.preventDefault();
        h.next();
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        h.prev();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
