// TV 매트: 화면(1920×1080)을 슬라이드로 가득 채우지 않고 85%로 줄여 종이 매트 위에 올린다(원장 결정 B, 2026-11-12).
// 자리는 슬라이드 밖(매트)이지만 말투는 슬라이드와 같은 잼민이: 원색 카드 · 검은 외곽선 · 기울기 · 그림자 · ONE Mobile Title.
//  - 무대 이름표: 서는 순서(김 · 이 · 박 · 최). 지금 발표자는 팀 소개(2장)의 그 사람 카드 색으로 기울어진 카드가 서고
//    모서리에 「발표 중!」 딱지가 삐져나온다. 평가표용이라 이름은 크게(원장 11-12).
//  - 노선도: 「오늘의 길」 정거장 다섯, 굵은 검은 선 · 외곽선 점, 지금 역은 기운 초록 딱지.
// 바뀌는 것은 제자리에서 차오르고 빠진다(0.45초, 출발 속도 0 곡선). 동작 줄이기면 바로 바뀐다.
import type { ReactNode } from 'react';
import { STOPS, TEAM, type Member, type NavInfo } from './navigator.ts';

export type MatLook = 'a' | 'b' | 'c';

const W = 1920;
const H = 1080;
const S = 0.85;
const IW = W * S; // 1632
const IH = H * S; // 918
const X = (W - IW) / 2; // 144
const Y = 40;
const NAV_TOP = Y + IH; // 958 — 아래 매트 122px

// 잼민이 팔레트(슬라이드와 같은 값)
const INK = '#1E1E1E';
const GREEN = '#C9E265';
const PINK = '#FEC9E4';
const BLUE = '#7ED3F5';
const LAV = '#DCCEFF';
/** 팀 소개(2장)의 카드 색과 같은 짝 */
const COLOR: Record<Member, string> = { 김홍준: GREEN, 박태수: PINK, 이상민: BLUE, 최유빈: LAV };
/** 정해진 기울기(슬라이드와 같은 리듬) */
const TILT: Record<Member, number> = { 김홍준: -2.6, 이상민: 1.8, 박태수: -1.6, 최유빈: 2.4 };
const SHADOW = '0 2.4px 4.2px rgba(0,0,0,.35)';
const TITLE = "'ONE Mobile Title', sans-serif";
const MOVE = 'transition-[opacity,transform] duration-[450ms] ease-[cubic-bezier(.4,0,.1,1)] motion-reduce:transition-none';

const MAT: Record<MatLook, { bg?: string; texture: boolean; shadow: string }> = {
  a: { bg: '#000000', texture: false, shadow: 'none' },
  b: { texture: true, shadow: '0 0 0 1px #BCCAC2, 0 30px 80px -40px rgba(24,38,74,.5)' },
  c: { bg: '#000000', texture: false, shadow: 'none' },
};

export function StageMat({ look, nav, children }: { look: MatLook; nav: NavInfo | null; children: ReactNode }) {
  const t = MAT[look];
  return (
    <div className={`relative size-full overflow-hidden ${t.texture ? 'paper-texture' : ''}`} style={{ background: t.bg }}>
      <div className="absolute overflow-hidden" style={{ left: X, top: Y, width: IW, height: IH, boxShadow: t.shadow, borderRadius: 4 }}>
        <div style={{ width: W, height: H, transform: `scale(${S})`, transformOrigin: '0 0' }}>{children}</div>
      </div>
      <div className="absolute flex items-center justify-between" style={{ left: X, width: IW, top: NAV_TOP + 22, height: 72, fontFamily: TITLE, color: INK }}>
        <Line stop={nav?.stop ?? null} />
        <Names who={nav?.who ?? null} />
      </div>
    </div>
  );
}

/** 노선도: 굵은 검은 선 위 외곽선 점, 지난 역은 검게 채움, 지금 역은 기운 초록 딱지 */
function Line({ stop }: { stop: number | null }) {
  return (
    <div className="flex items-center">
      {STOPS.map((name, i) => {
        const now = i === stop;
        const passed = stop !== null && i < stop;
        return (
          <div key={name} className="flex items-center">
            {i > 0 ? <span className="mx-2 h-[3px] w-[20px] rounded-full" style={{ background: INK }} /> : null}
            <span className="relative flex items-center">
              {/* 평소 모습: 점 + 이름 */}
              <span className={`flex items-center gap-2.5 ${MOVE}`} style={{ opacity: now ? 0 : 1 }}>
                <span className="size-[16px] rounded-full" style={{ background: passed ? INK : '#FFFFFF', boxShadow: `0 0 0 3px ${INK}` }} />
                <span className="text-[18px] leading-none" style={{ opacity: passed ? 0.75 : 0.45 }}>
                  {name}
                </span>
              </span>
              {/* 지금 역: 같은 자리에 기운 초록 딱지가 차오른다 */}
              <span
                aria-hidden={!now}
                className={`absolute left-[-14px] top-1/2 whitespace-nowrap rounded-[12px] px-3 py-2 text-[22px] leading-none ${MOVE}`}
                style={{
                  background: GREEN,
                  border: `3px solid ${INK}`,
                  boxShadow: SHADOW,
                  opacity: now ? 1 : 0,
                  transform: `translateY(-50%) rotate(${now ? -3 : 0}deg) scale(${now ? 1 : 0.85})`,
                }}
              >
                {name}
              </span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** 무대 이름표: 서는 순서. 지금 발표자는 그 사람 색 카드 + 「발표 중!」 딱지 */
function Names({ who }: { who: string | null }) {
  return (
    <div className="flex items-center gap-4">
      {TEAM.map((name) => {
        const now = name === who;
        return (
          <span key={name} className="relative grid h-[72px] w-[168px] place-items-center">
            <span
              aria-hidden
              className={`absolute inset-0 rounded-[16px] ${MOVE}`}
              style={{
                background: COLOR[name],
                border: `3px solid ${INK}`,
                boxShadow: SHADOW,
                opacity: now ? 1 : 0,
                transform: `rotate(${now ? TILT[name] : 0}deg) scale(${now ? 1 : 0.85})`,
              }}
            />
            <span
              className={`relative text-[44px] leading-none ${MOVE}`}
              style={{ opacity: now ? 1 : 0.42, transform: `rotate(${now ? TILT[name] : 0}deg)` }}
            >
              {name}
            </span>
            <span
              aria-hidden={!now}
              className={`absolute -top-[22px] -left-[18px] whitespace-nowrap rounded-full bg-white px-3 py-1.5 text-[19px] leading-none ${MOVE}`}
              style={{
                border: `2.5px solid ${INK}`,
                boxShadow: SHADOW,
                opacity: now ? 1 : 0,
                transform: `rotate(${now ? -9 : 0}deg) scale(${now ? 1 : 0.6})`,
              }}
            >
              발표 중!
            </span>
          </span>
        );
      })}
    </div>
  );
}
