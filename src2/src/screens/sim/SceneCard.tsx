import { EVENT_TYPE_LABEL, type GameEvent, type Scene } from '@gagyebu/core';
import {
  ArrowLeft,
  BellRing,
  ChartLine,
  ChevronLeft,
  Gift,
  Laptop,
  MessageCircle,
  MoreVertical,
  Newspaper,
  Phone,
  Radio,
  ReceiptText,
  ShieldAlert,
  ShoppingBag,
  Signal,
  Sparkles,
  Ticket,
  Wifi,
} from 'lucide-react';
import { Chip } from '../../components/ui.tsx';

const TYPE_STYLE: Record<string, string> = {
  tutorial: 'bg-primary-soft text-primary',
  daily: 'bg-sky-100 text-sky-900',
  lifestyle: 'bg-amber-100 text-amber-900',
  temptation: 'bg-fuchsia-100 text-fuchsia-900',
  social: 'bg-teal-100 text-teal-900',
  fraud: 'bg-rose-100 text-rose-900',
  opportunity: 'bg-indigo-100 text-indigo-900',
  quirky: 'bg-lime-100 text-lime-900',
};

/** 장면 헤더 (이벤트 유형·코드·제목) + 채널별 카드 */
export function SceneCard({ event, scene }: { event: GameEvent; scene: Scene }) {
  return (
    <article aria-label={`${event.title} 장면`} className="animate-flip">
      <header className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1">
        <Chip className={TYPE_STYLE[event.type] ?? 'bg-surface-2 text-ink-2'}>{EVENT_TYPE_LABEL[event.type]}</Chip>
        <span className="num rounded-md border border-line bg-surface px-1.5 py-0.5 text-[11px] font-bold text-ink-3">이벤트 {event.code}</span>
        <h2 className="text-[15px] font-bold text-ink">{event.title}</h2>
        <span className="ml-auto inline-flex items-center gap-1 text-[11px] font-medium text-ink-3">
          <ChannelMark channel={scene.channel} /> {CHANNEL_LABEL[scene.channel]}
        </span>
      </header>
      {scene.channel === 'narration' && <Narration scene={scene} type={event.type} />}
      {scene.channel === 'messenger' && <Messenger scene={scene} />}
      {scene.channel === 'sms' && <Sms scene={scene} />}
      {scene.channel === 'news' && <News scene={scene} />}
      {scene.channel === 'app' && <AppNotice scene={scene} />}
    </article>
  );
}

const CHANNEL_LABEL = {
  narration: '직접 겪은 일',
  messenger: '메신저',
  sms: '문자 메시지',
  news: '뉴스 속보',
  app: '앱 알림',
} as const;

function ChannelMark({ channel }: { channel: Scene['channel'] }) {
  const C = channel === 'news' ? Newspaper : channel === 'sms' ? Phone : channel === 'app' ? BellRing : MessageCircle;
  return <C size={13} aria-hidden />;
}

function Reveal({ items, tone = 'light' }: { items: { label: string; value: string }[]; tone?: 'light' | 'dark' }) {
  return (
    <div className="mt-3">
      <div className={`mb-1.5 text-[11px] font-bold tracking-wide ${tone === 'dark' ? 'text-accent' : 'text-accent-ink'}`}>이 장면에서 확인되는 숫자</div>
      <dl className="flex flex-wrap gap-1.5">
        {items.map((r) => (
          <div
            key={r.label}
            className={`min-w-[140px] flex-1 rounded-xl border px-3 py-2 ${tone === 'dark' ? 'border-accent/50 bg-accent/10' : 'border-accent/50 bg-accent-soft'}`}
          >
            <dt className={`text-[11px] font-semibold ${tone === 'dark' ? 'text-hud-ink-2' : 'text-accent-ink'}`}>{r.label}</dt>
            <dd className={`num mt-0.5 text-[17px] font-bold leading-tight ${tone === 'dark' ? 'text-white' : 'text-ink'}`}>{r.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

const TYPE_ICON = {
  tutorial: Sparkles,
  daily: Laptop,
  lifestyle: ReceiptText,
  temptation: ShoppingBag,
  social: Gift,
  fraud: ShieldAlert,
  opportunity: ChartLine,
  quirky: Ticket,
} as const;

function Narration({ scene, type }: { scene: Scene; type: string }) {
  const Icon = TYPE_ICON[type as keyof typeof TYPE_ICON] ?? Sparkles;
  return (
    <div className="relative overflow-hidden rounded-[22px] border border-line bg-surface p-4 shadow-[var(--shadow-card)] sm:p-5">
      <Icon size={110} strokeWidth={1.2} className="pointer-events-none absolute -top-3 right-2 text-primary opacity-[0.06]" aria-hidden />
      <span className="absolute inset-y-0 left-0 w-1.5 bg-primary" aria-hidden />
      <span
        className="pointer-events-none absolute -top-10 -right-6 size-32 rounded-full bg-primary-soft/60 blur-2xl"
        aria-hidden
      />
      {scene.title && <p className="text-xs font-bold tracking-wide text-ink-3">{scene.title}</p>}
      {scene.speaker && <p className="mt-0.5 text-sm font-semibold text-primary">{scene.speaker}</p>}
      <p className="relative mt-1.5 text-[17px] leading-[1.7] text-ink">{scene.text}</p>
      {scene.reveal && <Reveal items={scene.reveal} />}
    </div>
  );
}

function Messenger({ scene }: { scene: Scene }) {
  return (
    <div className="overflow-hidden rounded-[22px] border border-line bg-[#eef1ea] shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-2 border-b border-black/5 bg-[#f7f8f4]/90 px-3 py-2">
        <ChevronLeft size={18} className="text-ink-2" aria-hidden />
        <span className="flex size-8 items-center justify-center rounded-full bg-teal-200 text-sm font-bold text-teal-900" aria-hidden>
          {(scene.speaker ?? '?').slice(0, 1)}
        </span>
        <div className="min-w-0">
          <div className="truncate text-[13px] font-bold text-ink">{scene.speaker ?? '메신저'}</div>
          <div className="text-[10px] text-ink-3">보통 몇 분 내 응답</div>
        </div>
        <MoreVertical size={16} className="ml-auto text-ink-3" aria-hidden />
      </div>
      <div className="px-3 py-3 sm:px-4">
        <div className="mb-2 flex justify-center">
          <span className="rounded-full bg-black/5 px-2 py-0.5 text-[10px] text-ink-3">오늘 오후 7:12</span>
        </div>
        <div className="flex items-end gap-1.5">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-teal-200 text-[11px] font-bold text-teal-900" aria-hidden>
            {(scene.speaker ?? '?').slice(0, 1)}
          </span>
          <div className="max-w-[86%]">
            <div className="rounded-2xl rounded-bl-md border border-black/5 bg-white px-3 py-2 shadow-sm">
              <p className="text-[15px] leading-[1.65] text-ink">{scene.text}</p>
            </div>
            {scene.reveal && <div className="mt-2 rounded-xl bg-white/80 p-1.5"><Reveal items={scene.reveal} /></div>}
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2 rounded-full border border-black/5 bg-white/70 px-3 py-2 text-[12px] text-ink-3">
          <span className="flex-1">메시지 입력</span>
          <span className="rounded-full bg-[#fee500] px-2 py-0.5 text-[10px] font-bold text-[#3c1e1e]">전송</span>
        </div>
      </div>
    </div>
  );
}

function Sms({ scene }: { scene: Scene }) {
  return (
    <div className="overflow-hidden rounded-[22px] border border-line bg-[#f4f5f7] shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between bg-[#e9ebef] px-3 py-1 text-[10px] text-ink-3" aria-hidden>
        <span className="num font-semibold">오후 6:40</span>
        <span className="flex items-center gap-1">
          <Signal size={11} />
          <Wifi size={11} />
          <span className="num">78%</span>
        </span>
      </div>
      <div className="flex items-center gap-2 border-b border-black/5 bg-white/80 px-3 py-2">
        <ArrowLeft size={17} className="text-ink-2" aria-hidden />
        <div className="min-w-0">
          <div className="truncate text-[13px] font-bold text-ink">{scene.speaker ?? '문자'}</div>
          <div className="num text-[10px] text-ink-3">010-0000-0000</div>
        </div>
        <Phone size={16} className="ml-auto text-ink-3" aria-hidden />
      </div>
      <div className="px-4 py-4">
        <div className="flex items-center gap-2 text-[10px] text-ink-3">
          <span className="h-px flex-1 bg-line-strong/60" aria-hidden />
          오늘
          <span className="h-px flex-1 bg-line-strong/60" aria-hidden />
        </div>
        <div className="mt-2 max-w-[92%]">
          <div className="rounded-2xl rounded-tl-md border border-line bg-white px-3.5 py-2.5 shadow-sm">
            {scene.title && <p className="mb-1 text-[11px] font-bold text-ink-3">{scene.title}</p>}
            <p className="text-[15px] leading-[1.7] text-ink">{scene.text}</p>
          </div>
          <div className="num mt-1 text-[10px] text-ink-3">오후 6:41 · 읽지 않음</div>
        </div>
        {scene.reveal && <Reveal items={scene.reveal} />}
      </div>
    </div>
  );
}

function News({ scene }: { scene: Scene }) {
  return (
    <div className="on-dark relative overflow-hidden rounded-[22px] border border-white/10 bg-hud p-4 text-hud-ink shadow-[var(--shadow-lift)] sm:p-5">
      <div className="pointer-events-none absolute inset-0 opacity-[0.07]" aria-hidden style={{ backgroundImage: 'repeating-linear-gradient(0deg, #fff 0 1px, transparent 1px 4px)' }} />
      <div className="relative flex items-center gap-2">
        <span className="flex items-center gap-1 rounded bg-news px-2 py-0.5 text-[11px] font-bold text-white">
          <Radio size={12} aria-hidden /> 속보
        </span>
        <span className="text-[11px] font-semibold tracking-wide text-hud-ink-2">{scene.speaker ?? '경제 속보'}</span>
        <span className="num ml-auto text-[10px] text-hud-ink-2/70">오늘 09:02</span>
      </div>
      {scene.title && <h3 className="relative mt-2.5 text-[clamp(1.2rem,2.6vw,1.6rem)] font-bold leading-snug tracking-tight text-white">{scene.title}</h3>}
      <p className="relative mt-2 text-[15px] leading-[1.7] text-hud-ink-2">{scene.text}</p>
      {scene.reveal && <Reveal items={scene.reveal} tone="dark" />}
      <div className="relative mt-3 flex items-center gap-2 border-t border-white/10 pt-2 text-[10px] text-hud-ink-2/70">
        <span className="rounded bg-white/10 px-1.5 py-0.5">시장</span>
        <span className="rounded bg-white/10 px-1.5 py-0.5">내 계좌</span>
        <span className="ml-auto">학습용 시나리오</span>
      </div>
    </div>
  );
}

function AppNotice({ scene }: { scene: Scene }) {
  return (
    <div className="rounded-[22px] border border-line bg-gradient-to-b from-surface-2 to-surface p-4 shadow-[var(--shadow-card)] sm:p-5">
      <div className="flex items-center gap-2 text-[11px] font-semibold text-ink-3">
        <BellRing size={13} aria-hidden /> 앱 알림
        <span className="num ml-auto">방금</span>
      </div>
      <div className="mt-2 rounded-2xl border border-line bg-surface p-3.5 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-lg bg-hud text-white" aria-hidden>
            <BellRing size={15} />
          </span>
          <span className="text-[12px] font-bold text-ink-2">{scene.speaker ?? '앱 알림'}</span>
        </div>
        {scene.title && <p className="mt-2 text-[15px] font-bold text-ink">{scene.title}</p>}
        <p className="mt-1 text-[15px] leading-[1.65] text-ink-2">{scene.text}</p>
      </div>
      {scene.reveal && <Reveal items={scene.reveal} />}
    </div>
  );
}
