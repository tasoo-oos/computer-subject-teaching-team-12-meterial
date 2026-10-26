import { useEffect, useRef, useState } from 'react';

/** 스크린숏 모드(?shot)에서는 연출을 건너뛰고 마지막 상태를 바로 그린다 */
export const SHOT_MODE = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('shot');

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** 연출을 생략해야 하면 true (움직임 줄이기 설정 또는 스크린숏) */
export function skipMotion(): boolean {
  return SHOT_MODE || prefersReducedMotion();
}

/** 숫자 카운트업. 움직임 줄이기에서는 바로 목표값 */
export function useCountUp(target: number, { from = 0, duration = 700, delay = 0 } = {}): number {
  const [value, setValue] = useState(() => (skipMotion() ? target : from));
  const raf = useRef(0);
  useEffect(() => {
    if (skipMotion()) {
      setValue(target);
      return;
    }
    let start = 0;
    const startValue = from;
    const tick = (t: number) => {
      if (!start) start = t + delay;
      const p = Math.min(1, Math.max(0, (t - start) / duration));
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(startValue + (target - startValue) * eased));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, from, duration, delay]);
  return value;
}

/** 0부터 last까지 단계를 차례로 진행하는 연출용 카운터 */
export function useSequence(last: number, interval = 900): [number, (n: number) => void] {
  const [stage, setStage] = useState(() => (skipMotion() ? last : 0));
  useEffect(() => {
    if (stage >= last) return;
    const id = window.setTimeout(() => setStage((s) => Math.min(last, s + 1)), interval);
    return () => window.clearTimeout(id);
  }, [stage, last, interval]);
  return [stage, setStage];
}
