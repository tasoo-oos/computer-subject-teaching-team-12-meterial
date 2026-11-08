// 슬라이드 표시기 (docs/live-api.md §10.4, M8). 1920×1080 논리 캔버스를 기기 화면에 맞춰
// 비율을 유지해 축소·확대(남는 곳은 여백 — 레터박스). TV와 노트북·태블릿·휴대폰이 같은 구도.
// 조작 요소·진행 표시·커서 반응 없음. 디자인 토큰(색·서체)은 src/DESIGN.md를 그대로 쓴다.
import { useEffect, useRef, useState, type ComponentType } from 'react';
import { SLIDE_RENDERERS } from './registry.tsx';

export const SLIDE_W = 1920;
export const SLIDE_H = 1080;

/** 슬라이드 비트 id → 슬라이드 id와 단계. steps가 있는 슬라이드는 비트 id가 `${slideId}--${k}`(§4.1) */
export function slideOfBeat(beatId: string): { slideId: string; step: number } {
  const m = /^(.*)--(\d+)$/.exec(beatId);
  return m ? { slideId: m[1]!, step: Number(m[2]) } : { slideId: beatId, step: 0 };
}

/** 레지스트리에 없는 키가 오면 자리표시 오류 슬라이드(§2.2) */
function UnknownSlide({ deckId, slideId }: { deckId: string; slideId: string }) {
  return (
    <div className="paper-texture grid size-full place-items-center px-[120px]">
      <div className="rounded-panel bg-seal-soft px-10 py-8 text-center shadow-[0_0_0_2px_var(--color-seal)]">
        <p className="text-[30px] font-bold text-seal">슬라이드를 찾을 수 없어요</p>
        <p className="num mt-3 text-[24px] text-seal/90">
          {deckId}/{slideId}
        </p>
        <p className="mt-4 text-[20px] text-seal/80">렌더 레지스트리(src/src/activities/slides/registry.tsx)에 이 키가 없어요.</p>
      </div>
    </div>
  );
}

/** 1920×1080 논리 캔버스 본체. 축소는 통째로 하므로 안의 콘텐츠는 논리 px로 그린다 */
export function SlideSurface({ deckId, slideId, step }: { deckId: string; slideId: string; step: number }) {
  const Renderer: ComponentType<{ step: number }> | undefined = SLIDE_RENDERERS[`${deckId}/${slideId}`];
  return Renderer ? <Renderer step={step} /> : <UnknownSlide deckId={deckId} slideId={slideId} />;
}

/** 화면을 채우는 표시기: 비율 유지 축소 + 레터박스 */
export function SlideCanvas({ deckId, slideId, step }: { deckId: string; slideId: string; step: number }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);

  useEffect(() => {
    const update = () => {
      const el = boxRef.current;
      if (!el) return;
      setScale(Math.min(el.clientWidth / SLIDE_W, el.clientHeight / SLIDE_H));
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
          width: SLIDE_W,
          height: SLIDE_H,
          transform: `scale(${scale})`,
          marginLeft: -SLIDE_W / 2,
          marginTop: -SLIDE_H / 2,
        }}
      >
        <SlideSurface deckId={deckId} slideId={slideId} step={step} />
      </div>
    </div>
  );
}
