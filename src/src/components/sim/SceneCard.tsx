import { AppWindow, BellRing, MessageCircle, Megaphone, Newspaper, Smartphone } from 'lucide-react';
import { EVENT_TYPE_LABEL, type GameEvent, type Scene } from '@gagyebu/core';

const CHANNEL: Record<Scene['channel'], { icon: typeof BellRing; label: string }> = {
  narration: { icon: MessageCircle, label: '상황 설명' },
  messenger: { icon: MessageCircle, label: '메신저' },
  sms: { icon: Smartphone, label: '문자' },
  news: { icon: Newspaper, label: '뉴스 속보' },
  app: { icon: AppWindow, label: '앱 알림' },
};

export function SceneCard({ event, scene, compact = false }: { event: GameEvent; scene: Scene; compact?: boolean }) {
  const showTitle = !(scene.channel === 'news' && scene.title);
  if (compact) {
    return (
      <article className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-panel bg-sheet px-4 py-2.5 shadow-[0_0_0_1px_var(--color-rule)]">
        <span className="rounded-[4px] bg-ink px-1.5 py-0.5 text-[11px] font-semibold text-white">{EVENT_TYPE_LABEL[event.type]}</span>
        <span className="rounded-[4px] border border-rule px-1.5 py-0.5 text-[11px] font-semibold text-ink-2">사건 {event.code}</span>
        <h2 className="min-w-0 flex-1 truncate text-[15px] font-bold">{scene.title ?? event.title}</h2>
        <span className="flex items-center gap-1.5 text-[11px] text-ink-3">
          <ChannelIcon channel={scene.channel} />
          {CHANNEL[scene.channel].label}
        </span>
      </article>
    );
  }
  return (
    <article aria-labelledby="scene-title" className="overflow-hidden rounded-panel bg-sheet shadow-[0_0_0_1px_var(--color-rule)]">
      <header className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-rule-soft px-4 py-2.5 sm:px-5">
        <span className="rounded-[4px] bg-ink px-1.5 py-0.5 text-[12px] font-semibold text-white">{EVENT_TYPE_LABEL[event.type]}</span>
        <span className="rounded-[4px] border border-rule px-1.5 py-0.5 text-[12px] font-semibold text-ink-2">사건 {event.code}</span>
        <span className="ml-auto flex items-center gap-1.5 text-[12px] text-ink-3">
          <ChannelIcon channel={scene.channel} />
          {CHANNEL[scene.channel].label}
        </span>
        {showTitle ? (
          <h2 id="scene-title" className="mt-1 basis-full text-[19px] font-bold leading-snug sm:text-[21px]">
            {scene.title ?? event.title}
          </h2>
        ) : null}
      </header>
      <ChannelBody scene={scene} event={event} compact={compact} />
      {scene.reveal?.length && !compact ? <Reveal items={scene.reveal} /> : null}
    </article>
  );
}

function ChannelIcon({ channel }: { channel: Scene['channel'] }) {
  const Icon = CHANNEL[channel].icon;
  return <Icon size={14} aria-hidden />;
}

function ChannelBody({ scene, event, compact }: { scene: Scene; event: GameEvent; compact: boolean }) {
  if (compact) return <CompactBody scene={scene} event={event} />;
  switch (scene.channel) {
    case 'messenger':
      return (
        <div className="bg-[#e7eee9] px-4 py-4 sm:px-5">
          <div className="flex items-center gap-2 pb-3">
            <span className="grid size-8 place-items-center rounded-full bg-ink text-[13px] font-bold text-white" aria-hidden>
              {(scene.speaker ?? '?').slice(0, 1)}
            </span>
            <p className="text-[14px] font-semibold">{scene.speaker ?? '메신저'}</p>
            <p className="text-[12px] text-ink-3">읽지 않음</p>
          </div>
          <div className="flex items-end gap-1.5">
            <p className="max-w-[34rem] rounded-[4px_18px_18px_18px] bg-white px-3.5 py-2.5 text-[15px] leading-relaxed shadow-[0_1px_2px_rgba(24,38,74,.12)]">
              {scene.text}
            </p>
            <span className="num shrink-0 text-[11px] text-ink-3">오후 7:12</span>
          </div>
        </div>
      );
    case 'sms':
      return (
        <div className="bg-[#eef1f6] px-4 py-4 sm:px-5">
          <div className="rounded-[12px] bg-white px-4 py-3 shadow-[0_1px_2px_rgba(24,38,74,.12)]">
            <div className="flex items-baseline justify-between gap-2 border-b border-dashed border-rule pb-2">
              <p className="text-[14px] font-bold">{scene.speaker ?? '문자'}</p>
              <p className="num text-[12px] text-ink-3">01-2345-6789</p>
            </div>
            <p className="mt-2 text-[15px] leading-relaxed">{scene.text}</p>
          </div>
        </div>
      );
    case 'news':
      return (
        <div className="bg-ink px-4 py-4 text-white sm:px-5">
          <p className="flex items-center gap-1.5 text-[12px] font-semibold text-[#ffd0ce]">
            <Megaphone size={14} aria-hidden />
            {scene.speaker ?? '속보'}
          </p>
          <p className="display mt-1.5 text-[22px] leading-tight sm:text-[26px]">{scene.title}</p>
          <p className="mt-2 max-w-[38rem] text-[15px] leading-relaxed text-white/85">{scene.text}</p>
        </div>
      );
    case 'app':
      return (
        <div className="bg-paper px-4 py-4 sm:px-5">
          <div className="flex gap-3 rounded-[14px] bg-sheet p-3.5 shadow-[0_6px_16px_-10px_rgba(24,38,74,.5)]">
            <span className="grid size-10 flex-none place-items-center rounded-[10px] bg-acc-goal/15 text-acc-goal" aria-hidden>
              <BellRing size={20} />
            </span>
            <div>
              <p className="text-[13px] font-semibold text-ink-2">{scene.speaker ?? '알림'}</p>
              <p className="text-[15px] leading-relaxed">{scene.text}</p>
            </div>
          </div>
        </div>
      );
    default:
      return (
        <div className="px-4 py-4 sm:px-5">
          <p className="max-w-[42rem] text-[16px] leading-relaxed">{scene.text}</p>
        </div>
      );
  }
}

/** 이 장면에서 공개된 숫자. 사실 정보라 크게 보여 준다 */
/** 지불 패널을 열었을 때 장면은 요약 한 줄로 접어 둔다. 맥락은 남기고 높이를 줄인다 */
function CompactBody({ scene, event }: { scene: Scene; event: GameEvent }) {
  return (
    <div className="flex items-center gap-2.5 px-4 py-2.5 sm:px-5">
      <ChannelIcon channel={scene.channel} />
      <p className="min-w-0 flex-1 truncate text-[13px] text-ink-2">
        {scene.speaker ? <span className="font-semibold text-ink">{scene.speaker}: </span> : null}
        {event.summary}
      </p>
    </div>
  );
}

function Reveal({ items }: { items: { label: string; value: string }[] }) {
  return (
    <section aria-label="이 장면에서 확인된 숫자" className="border-t border-rule bg-mark/40 px-4 py-3 sm:px-5">
      <div className="flex flex-wrap gap-x-8 gap-y-2">
        {items.map((it) => (
          <div key={it.label}>
            <p className="text-[12px] font-medium text-ink-2">{it.label}</p>
            <p className="num text-[22px] font-bold leading-tight text-ink">{it.value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
