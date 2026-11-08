// TV 입장 화면 부품 (docs/live-api.md §10.5 "입장 비트", docs/live-classroom-plan.md §3 입장 행).
// QR 코드(qrcode 패키지) + 큰 주소 `${location.host}/<code>` + 입장 인원 + 닉네임 벽(60명까지).
// 닉네임이 TV에 보이는 곳은 입장 화면과 발표 지정뿐이다(계획 §0 "닉네임" 결정).
// S5가 입장 비트의 Stage 화면에서 stats({kind:'join', joined, connected, nicknames})와 함께 쓴다.
// 1920×1080 논리 캔버스(StageContent 안) 기준 크기다.
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { StatTile } from './StatTile.tsx';

export interface JoinWallProps {
  /** 수업 코드(숫자 4자리). 학생 주소 /<code> */
  code: string;
  /** 입장(승인) 인원. null이면 숨긴다 */
  joined?: number | null;
  /** 접속 중 인원. null이면 숨긴다 */
  connected?: number | null;
  /** 닉네임 벽. 데이터 순서 그대로, 최대 60명 */
  nicknames?: string[];
  className?: string;
}

export function JoinWall({ code, joined, connected, nicknames = [], className = '' }: JoinWallProps) {
  // QR에는 완전한 주소(location.origin)를 담는다. 화면 표시는 host만 크게(계획 §0 표 "학생 주소").
  const [qrSrc, setQrSrc] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(`${location.origin}/${code}`, {
      margin: 2,
      width: 640,
      color: { dark: '#18264aff', light: '#ffffffff' },
    })
      .then((src) => {
        if (!cancelled) setQrSrc(src);
      })
      .catch(() => {
        if (!cancelled) setQrSrc(null);
      });
    return () => {
      cancelled = true;
    };
  }, [code]);

  return (
    <div
      className={`paper-texture grid size-full grid-cols-[560px_1fr] items-center gap-x-[80px] px-[110px] ${className}`}
    >
      <div className="grid place-items-center">
        <div className="rounded-panel bg-white p-8 shadow-[0_0_0_2px_var(--color-rule)]">
          {qrSrc ? (
            <img src={qrSrc} alt={`QR 코드 — ${location.host}/${code}`} className="block size-[420px]" />
          ) : (
            <div className="grid size-[420px] place-items-center text-[24px] text-ink-3">QR 코드를 만들 수 없어요</div>
          )}
        </div>
      </div>
      <div className="flex h-full min-w-0 flex-col justify-center py-[70px]">
        <p className="text-[28px] font-semibold text-ink-2">스마트폰으로 QR을 찍거나, 아래 주소로 들어와 주세요</p>
        <p className="display num mt-3 text-[72px] leading-none text-ink break-all">
          {location.host}
          <span className="text-seal">/{code}</span>
        </p>
        {joined != null || connected != null ? (
          <div className="mt-7 flex gap-4">
            {joined != null ? <StatTile value={joined} label="입장" unit="명" className="flex-1" /> : null}
            {connected != null ? <StatTile value={connected} label="접속 중" unit="명" className="flex-1" /> : null}
          </div>
        ) : null}
        {/* 닉네임 벽 — 60명까지 들어가게(넘치는 칸은 숨긴다). flex-1을 빼야
            QR 카드와 세로 중앙이 맞는다(늘어나면 열 전체가 위로 붙는다, §14 #125) */}
        <div className="mt-7 flex max-h-[560px] flex-wrap content-start gap-2.5 overflow-hidden">
          {nicknames.length === 0 ? (
            <p className="text-[24px] text-ink-3">먼저 들어온 순서대로 이름이 나와요</p>
          ) : (
            nicknames.map((name, i) => (
              <span
                key={`${name}-${i}`}
                className="rounded-[8px] bg-sheet px-4 py-1.5 text-[22px] font-semibold text-ink shadow-[0_0_0_1.5px_var(--color-rule)]"
              >
                {name}
              </span>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
