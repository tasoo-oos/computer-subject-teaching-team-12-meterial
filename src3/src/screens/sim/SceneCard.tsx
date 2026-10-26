import { useState } from 'react';
import { Check, Copy, Lock, Sparkles } from 'lucide-react';
import {
  EVENT_TYPE_LABEL,
  choiceAvailability,
  formatMan,
  resolveAmount,
  type Choice,
  type GameEvent,
  type GameState,
  type Scene,
} from '@gagyebu/core';
import { CHANNEL_LOOK, KIND_LOOK } from '../../lib/meta.ts';
import { Money, Tag } from '../../components/ui.tsx';

/** 장면 카드: 채널에 따라 매체가 다르게 보인다 */
export function SceneCard({ event, scene, state }: { event: GameEvent; scene: Scene; state: GameState }) {
  const channel = CHANNEL_LOOK[scene.channel];
  const ChannelIcon = channel.icon;

  return (
    <section className="cut overflow-hidden" aria-labelledby="scene-title">
      <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-line px-4 py-2.5">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <Tag tone="line">{EVENT_TYPE_LABEL[event.type]}</Tag>
          <span className="num text-xs font-bold text-mute">{event.code}</span>
          <span className="truncate text-xs text-mute">{event.title}</span>
          {state.decisions.some((d) => d.month === state.month) && <Tag tone="flash">이 달 {state.decisions.filter((d) => d.month === state.month).length + 1}번째 장면</Tag>}
        </div>
        <span className="flex items-center gap-1.5 text-xs font-semibold text-mute">
          <ChannelIcon size={14} aria-hidden /> {channel.label}
        </span>
      </header>

      <div className="px-4 py-4">
        <ChannelBody event={event} scene={scene} state={state} />
        {scene.reveal && scene.reveal.length > 0 && <Reveal rows={scene.reveal} />}
      </div>
    </section>
  );
}

function ChannelBody({ event, scene, state }: { event: GameEvent; scene: Scene; state: GameState }) {
  if (scene.channel === 'messenger') {
    return (
      <div>
        <div className="flex items-center gap-2 text-xs text-mute">
          <span className="flex size-6 items-center justify-center rounded-full bg-paper-3 text-[11px] font-bold text-text" aria-hidden>
            {(scene.speaker ?? '?').slice(0, 1)}
          </span>
          <span className="font-semibold text-text">{scene.speaker ?? '메시지'}</span>
          <span>· 지금</span>
        </div>
        <div className="mt-2.5 max-w-[36em]">
          <p className="rounded-[10px] rounded-tl-[3px] bg-paper-2 px-3.5 py-3 text-[16px] leading-relaxed">{scene.text}</p>
        </div>
      </div>
    );
  }

  if (scene.channel === 'sms') {
    return (
      <div>
        <p className="text-[11px] font-bold tracking-wide text-mute">문자 메시지 · {scene.speaker ?? '발신자'}</p>
        <div className="mt-2 max-w-[36em] rounded-[8px] bg-paper-2 px-4 py-3">
          <p className="text-[15px] leading-relaxed">{scene.text}</p>
        </div>
      </div>
    );
  }

  if (scene.channel === 'news') {
    return (
      <div>
        <div className="rounded-[4px] bg-ink px-3.5 py-2.5 text-frame">
          <div className="flex items-center gap-2">
            <span className="bg-flash px-1.5 py-0.5 text-[11px] font-extrabold text-ink">속보</span>
            <span className="text-[11px] font-semibold text-frame-mute">{scene.speaker ?? '뉴스'}</span>
          </div>
          <h1 id="scene-title" className="mt-1.5 text-[19px] leading-snug font-bold tracking-[-0.01em] text-balance">
            {scene.title ?? event.title}
          </h1>
        </div>
        <p className="mt-3 text-[16px] leading-relaxed text-pretty">{scene.text}</p>
      </div>
    );
  }

  if (scene.channel === 'app') {
    return (
      <div>
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-[6px] bg-ink text-frame" aria-hidden>
            <Sparkles size={15} />
          </span>
          <div className="leading-tight">
            <p className="text-[12px] font-bold">{scene.speaker ?? '앱 알림'}</p>
            <p className="text-[10px] text-mute">지금</p>
          </div>
        </div>
        <h1 id="scene-title" className="mt-2 text-[18px] font-bold tracking-[-0.01em]">
          {scene.title ?? event.title}
        </h1>
        <p className="mt-1 text-[15px] leading-relaxed text-mute">{scene.text}</p>
      </div>
    );
  }

  return (
    <div>
      <h1 id="scene-title" className="text-[20px] leading-snug font-bold tracking-[-0.015em] text-balance">
        {scene.title ?? event.title}
      </h1>
      <p className="mt-2 max-w-[38em] text-[16px] leading-[1.65] text-pretty">{scene.text}</p>
    </div>
  );
}

/** 공개 정보는 플래시 컬러 플레이트로 강조한다 */
function Reveal({ rows }: { rows: { label: string; value: string }[] }) {
  return (
    <div className="mt-3 rounded-[4px] bg-flash px-3.5 py-2.5">
      <p className="text-[11px] font-bold tracking-wide text-ink/70">이 장면에서 공개된 정보</p>
      <dl className="mt-1 flex flex-wrap gap-x-6 gap-y-1">
        {rows.map((r) => (
          <div key={r.label}>
            <dt className="text-[11px] font-semibold text-ink/70">{r.label}</dt>
            <dd className="num text-[17px] font-extrabold tracking-[-0.01em]">{r.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** 선택지: 생김새는 kind로만 달라진다. 좋고 나쁨을 색이나 순서로 알리지 않는다 */
export function ChoiceList({
  scene,
  event,
  state,
  selectedId,
  onSelect,
}: {
  scene: Scene;
  event: GameEvent;
  state: GameState;
  selectedId: string | null;
  onSelect: (choice: Choice) => void;
}) {
  return (
    <section className="cut p-4" aria-labelledby="choice-title">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="choice-title" className="text-[15px] font-bold">
          어떻게 할까요?
        </h2>
        <p className="text-[11px] text-mute">표시는 선택지 유형만 뜻합니다. 좋고 나쁨은 정해져 있지 않습니다.</p>
      </div>
      <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
        {scene.choices.map((choice) => {
          const av = choiceAvailability(state, choice);
          const kind = KIND_LOOK[choice.kind];
          const KindIcon = kind.icon;
          const active = selectedId === choice.id;
          const amount = choice.pay ? resolveAmount(state, choice.pay.amount) : choice.fixedPay?.amount ?? null;
          return (
            <button
              key={choice.id}
              type="button"
              disabled={!av.enabled}
              aria-pressed={active}
              onClick={() => onSelect(choice)}
              className={`relative rounded-[5px] border p-3 text-left transition-colors duration-150 ${
                av.enabled
                  ? active
                    ? 'border-ink bg-paper-2 ring-2 ring-ink'
                    : 'border-line-strong bg-paper hover:border-ink-4 hover:bg-paper-2'
                  : 'border-line bg-paper-2/60'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-[11px] font-bold text-mute">
                  <KindIcon size={14} aria-hidden /> {kind.label}
                </span>
                {av.enabled ? (
                  active ? (
                    <span className="flex items-center gap-1 text-[11px] font-bold text-text">
                      <Check size={13} aria-hidden /> 고름
                    </span>
                  ) : null
                ) : (
                  <span className="flex items-center gap-1 text-[11px] font-bold text-mute">
                    <Lock size={12} aria-hidden /> 잠김
                  </span>
                )}
              </div>
              <p className={`mt-1.5 text-[15px] leading-snug font-semibold ${av.enabled ? '' : 'text-mute'}`}>{choice.label}</p>
              <p className="mt-0.5 flex flex-wrap items-baseline gap-x-2 text-[12px] text-mute">
                {amount !== null && !choice.detail && !choice.label.includes(formatMan(amount)) && (
                  <Money value={amount} mode="man" className="font-semibold text-text" />
                )}
                {choice.detail && <span className="num">{choice.detail}</span>}
              </p>
              {av.enabled ? (
                <p className="mt-1.5 text-[11px] leading-snug text-mute">{kind.hint}</p>
              ) : (
                <p className="mt-1.5 rounded-[3px] bg-paper-3 px-2 py-1 text-[11px] leading-snug text-mute">
                  {av.reason}
                </p>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}

export function PromptButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(text).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      }}
      className="inline-flex min-h-9 items-center gap-1.5 rounded-[4px] border border-line-strong px-2.5 text-[11px] font-semibold text-mute hover:bg-paper-2 hover:text-text"
    >
      {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? '복사했어요' : 'AI에게 물어보기'}
    </button>
  );
}
