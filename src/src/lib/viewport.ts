// 뷰포트 폭 판정 훅 (S7 기기 대응, docs/live-api.md §10.11).
// 노트북(1366)·태블릿 가로(1024)는 기준 화면이라 CSS `lg:`(min-width: 1024px)과
// 같은 기준으로 JS 레이아웃(지불 패널 2단계)을 갈아 끼운다 — 첫 렌더부터 정확한
// 값을 써 스냅숏·기기 전환 모두에서 깜빡임이 없다.
import { useEffect, useState } from 'react';

/** 화면 폭이 px 이상이면 true (Tailwind `lg:` 미디어 쿼리와 같은 값) */
export function useMinWidth(px: number): boolean {
  const [wide, setWide] = useState(() =>
    typeof window === 'undefined' ? true : window.matchMedia(`(min-width: ${px}px)`).matches,
  );
  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${px}px)`);
    const update = () => setWide(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, [px]);
  return wide;
}

/** 태블릿 가로(1024px) 미만 — 좁은 화면 전용 레이아웃(기둥 접기·지불 2단계)을 쓸 때 */
export function useNarrow(): boolean {
  return !useMinWidth(1024);
}
