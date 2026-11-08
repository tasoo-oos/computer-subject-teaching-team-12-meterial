import { formatMan, type GameState } from '@gagyebu/core';

interface Props {
  state: GameState;
  /** 발표용이면 글자를 크게 */
  large?: boolean;
  height?: number;
  /** 전면(TV)용: 마지막 값 라벨을 점 위가 아니라 점 왼쪽에 둬서 겹치지 않게 한다(§14 #125).
   *  dev 스냅숏은 이 값을 쓰지 않아 기존 모양 그대로다. */
  endLabelBeside?: boolean;
}

/** 12개월 순자산 선 그래프. 라이브러리 없이 SVG로 직접 그린다 */
export function NetWorthChart({ state, large = false, height, endLabelBeside = false }: Props) {
  const pts = state.history.length
    ? state.history.map((h) => ({ month: h.month, value: h.netWorth }))
    : [{ month: state.month, value: 0 }];
  const W = 720;
  const H = height ?? (large ? 340 : 232);
  const pad = { l: large ? 8 : 58, r: large ? 8 : 12, t: large ? 34 : 22, b: 26 };
  const max = Math.max(...pts.map((p) => p.value), 1);
  const min = 0;
  const x = (i: number) => pad.l + (i * (W - pad.l - pad.r)) / Math.max(1, pts.length - 1);
  const y = (v: number) => pad.t + (1 - (v - min) / (max - min)) * (H - pad.t - pad.b);
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const area = `${line} L${x(pts.length - 1).toFixed(1)},${H - pad.b} L${x(0).toFixed(1)},${H - pad.b} Z`;
  const last = pts.at(-1)!;
  const ticks = [0, 0.5, 1].map((r) => Math.round(max * r));

  return (
    <figure className="m-0">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label={`12개월 순자산 변화. 1월 ${formatMan(pts[0]!.value)}에서 12월 ${formatMan(last.value)}까지.`}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--color-rule-soft)" strokeWidth="1" />
            {!large ? (
              <text x={pad.l - 6} y={y(t) + 4} textAnchor="end" fontSize="15" fill="var(--color-ink-3)" className="num hidden sm:inline">
                {t === 0 ? '0' : `${new Intl.NumberFormat('ko-KR').format(Math.round(t / 10_000))}만`}
              </text>
            ) : null}
          </g>
        ))}
        <path d={area} fill="var(--color-ink)" opacity="0.08" />
        <path d={line} fill="none" stroke="var(--color-ink)" strokeWidth={large ? 4 : 2.5} strokeLinejoin="round" strokeLinecap="round" />
        {pts.map((p, i) =>
          i === pts.length - 1 ? (
            <circle key={i} cx={x(i)} cy={y(p.value)} r={large ? 8 : 5} fill="var(--color-in)" stroke="#fff" strokeWidth="2.5" />
          ) : null,
        )}
        {pts.map((p, i) => (
          <g key={`m${i}`}>
            {i % (large ? 1 : 1) === 0 ? (
              <text
                x={x(i)}
                y={H - 8}
                textAnchor="middle"
                fontSize={large ? 18 : 19}
                fill="var(--color-ink-3)"
                className={`num ${p.month === 1 || p.month === 12 || p.month % 3 === 1 ? '' : 'hidden sm:inline'}`}
              >
                {p.month}
              </text>
            ) : null}
          </g>
        ))}
        <text
          x={x(pts.length - 1) - (large ? 18 : 10)}
          y={endLabelBeside ? y(last.value) + 9 : Math.max(pad.t + (large ? 26 : 14), y(last.value) - (large ? 24 : 14))}
          textAnchor="end"
          fontSize={large ? 26 : 19}
          fontWeight="700"
          fill="var(--color-ink)"
          stroke="var(--color-sheet)"
          strokeWidth={large ? 6 : 4}
          paintOrder="stroke"
          className="num"
        >
          {formatMan(last.value)}
        </text>
      </svg>
      {!large ? <figcaption className="mt-1 text-right text-[12px] text-ink-3">월말 순자산, 1~12월</figcaption> : null}
    </figure>
  );
}
