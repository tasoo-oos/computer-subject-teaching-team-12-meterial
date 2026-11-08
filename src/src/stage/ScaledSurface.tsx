// 전면(TV) 콘텐츠의 1920×1080 논리 캔버스 스케일러 (docs/live-classroom-plan.md §9 "표시"와 같은 방식).
// SlideCanvas의 레터박스 축소를 슬라이드가 아닌 임의 콘텐츠에도 쓸 수 있게 분리했다.
// - StageFrame: 화면을 통째로 채우는 표시기(비율 유지 축소 + 남는 곳 여백) — /stage 본판
// - StageThumb: 고정 폭 축소 모형 — 통제 페이지의 TV 미리보기
// 안의 콘텐츠(StageContent·JoinWall 등)는 논리 px(1920×1080 기준)로 그린다.
import { useEffect, useRef, useState, type ReactNode } from "react";

export const STAGE_W = 1920;
export const STAGE_H = 1080;

/** 화면을 채우는 표시기: 비율 유지 축소 + 레터박스 (SlideCanvas와 같은 구조) */
export function StageFrame({ children }: { children: ReactNode }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);

  useEffect(() => {
    const update = () => {
      const el = boxRef.current;
      if (!el) return;
      setScale(Math.min(el.clientWidth / STAGE_W, el.clientHeight / STAGE_H));
    };
    update();
    const ro = new ResizeObserver(update);
    if (boxRef.current) ro.observe(boxRef.current);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={boxRef} className="paper-texture fixed inset-0 overflow-hidden">
      <div
        className="absolute left-1/2 top-1/2 overflow-hidden bg-sheet shadow-[0_0_0_1px_var(--color-rule),0_30px_80px_-40px_rgba(24,38,74,.5)]"
        style={{
          width: STAGE_W,
          height: STAGE_H,
          transform: `scale(${scale})`,
          marginLeft: -STAGE_W / 2,
          marginTop: -STAGE_H / 2,
        }}
      >
        {children}
      </div>
    </div>
  );
}

/** 고정 폭 축소 모형. width에 맞춰 16:9로 줄인다 (통제의 TV 미리보기) */
export function StageThumb({
  width,
  children,
}: {
  width: number;
  children: ReactNode;
}) {
  const scale = width / STAGE_W;
  return (
    <div
      className="relative overflow-hidden rounded-[6px] bg-sheet shadow-[0_0_0_1px_var(--color-rule)]"
      style={{ width, height: width * (STAGE_H / STAGE_W) }}
    >
      <div
        className="absolute left-0 top-0"
        style={{
          width: STAGE_W,
          height: STAGE_H,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        {children}
      </div>
    </div>
  );
}

/** 콘테이너 폭에 맞춰 StageThumb 크기를 잰다 */
export function AutoStageThumb({
  children,
  minWidth = 240,
}: {
  children: ReactNode;
  minWidth?: number;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(480);

  useEffect(() => {
    const update = () => {
      const el = boxRef.current;
      if (!el) return;
      setWidth(Math.max(minWidth, el.clientWidth));
    };
    update();
    const ro = new ResizeObserver(update);
    if (boxRef.current) ro.observe(boxRef.current);
    return () => ro.disconnect();
  }, [minWidth]);

  return (
    <div ref={boxRef} className="w-full">
      <StageThumb width={width}>{children}</StageThumb>
    </div>
  );
}
