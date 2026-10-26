import { useEffect, useState } from 'react';

/** 스크린숏 모드(?shot)에서는 연출을 끝난 상태로 바로 보여 준다 */
const SHOT = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('shot');

export function prefersCalm(): boolean {
  if (SHOT) return true;
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** 0에서 target까지 숫자를 올린다. 움직임 줄이기 설정이면 바로 target */
export function useCountUp(target: number, duration = 900, delay = 0): number {
  const [value, setValue] = useState(() => (prefersCalm() ? target : 0));
  useEffect(() => {
    if (prefersCalm()) {
      setValue(target);
      return;
    }
    let raf = 0;
    let start = 0;
    const tick = (t: number) => {
      if (!start) start = t;
      const p = Math.min(1, Math.max(0, (t - start - delay) / duration));
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, delay]);
  return value;
}

/** n개의 항목을 interval 간격으로 하나씩 드러낸다. 반환값은 지금 보이는 개수 */
export function useSequence(n: number, interval = 420, startDelay = 300): [number, () => void] {
  const [shown, setShown] = useState(() => (prefersCalm() ? n : 0));
  const [run, setRun] = useState(0);
  useEffect(() => {
    if (prefersCalm()) {
      setShown(n);
      return;
    }
    setShown(0);
    const timers: number[] = [];
    for (let i = 1; i <= n; i++) {
      timers.push(window.setTimeout(() => setShown(i), startDelay + interval * (i - 1)));
    }
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [n, interval, startDelay, run]);
  return [shown, () => setRun((r) => r + 1)];
}
