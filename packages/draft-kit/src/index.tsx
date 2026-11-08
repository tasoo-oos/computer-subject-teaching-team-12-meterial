// 스냅숏 네비게이터 개발 도구. 같은 셸로 화면과 목업 상태를 오간다.
// 이 파일의 생김새는 디자인 대상이 아니다.
// ScreenProps는 docs/live-api.md §10.8, DraftShell는 §10.9 계약을 따른다.
import { useEffect, useMemo, useState, type ComponentType, type CSSProperties, type ReactElement } from 'react';
import { FIXTURES, SCREEN_LABEL, SCREEN_ORDER, type Action, type FixtureUi, type GameState, type ScreenId } from '@gagyebu/core';
import type { Beat } from '@gagyebu/live';

/** 비트 — @gagyebu/live의 Beat를 그대로 쓴다(§14 #133). 과거 로컬 구조 타입은 대체됐다. */
export type { Beat };

/** 기존 화면의 새 계약 (docs/live-api.md §10.8). 라이브·solo·dev 같은 화면 자산으로 그린다 */
export interface ScreenProps {
  state: GameState;
  /** 현재 비트. id로 세부 표시 결정: 'survey', 'guide-3', 'm2', 'present' … */
  beat: Beat;
  revealed: boolean;
  /** 이 비트 제출 완료 (라이브: 서버 판정 / dev·solo: false) */
  submitted: boolean;
  mode: 'live' | 'solo' | 'dev';
  dispatch: (action: Action) => void;
  draft: (data: unknown) => void;
  /** dev 모드에서만 (스냅숏 힌트). 라이브·solo에서는 undefined */
  ui?: FixtureUi;
}

export type ScreenMap = Record<ScreenId, ComponentType<ScreenProps>>;

function readHash(): string {
  const id = window.location.hash.replace(/^#\/?/, '');
  return FIXTURES.some((f) => f.id === id) ? id : FIXTURES[0]!.id;
}

/** 스크린숏 모드: ?shot 이 붙으면 네비게이터를 숨긴다 */
const SHOT = new URLSearchParams(window.location.search).has('shot');

/** 스냅숏 셸 (docs/live-api.md §10.9). route·beatOf는 src/src/dev/가 제공한다 */
export function DraftShell({
  screens,
  title,
  route,
  beatOf,
}: {
  screens: ScreenMap;
  title: string;
  /** 스냅숏 id + 행동 → 이동할 스냅숏 id. null이면 무시 */
  route: (fixtureId: string, action: Action) => string | null;
  /** 스냅숏 id → 비트 (라이브 비트 id와 같은 id를 쓴다) */
  beatOf: (fixtureId: string) => Beat;
}): ReactElement {
  const [id, setId] = useState(readHash);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onHash = () => setId(readHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const index = FIXTURES.findIndex((f) => f.id === id);
  const fixture = FIXTURES[index]!;

  const go = (next: string) => {
    window.location.hash = `/${next}`;
  };

  useEffect(() => {
    if (SHOT) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.key === '`') setOpen((o) => !o);
      if (e.key === ']') go(FIXTURES[Math.min(FIXTURES.length - 1, index + 1)]!.id);
      if (e.key === '[') go(FIXTURES[Math.max(0, index - 1)]!.id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index]);

  useEffect(() => {
    document.title = `${title} · ${fixture.label}`;
  }, [title, fixture.label]);

  const Screen = screens[fixture.screen];
  // 같은 화면 안에서 스냅숏이 바뀌면 화면 내부 상태를 초기화한다
  const state = useMemo(() => structuredClone(fixture.state), [fixture]);
  // §10.9: dev 모드 props. dispatch는 route가 정한 다음 스냅숏으로, draft는 아무것도 안 한다
  const dispatch = (action: Action) => {
    const next = route(fixture.id, action);
    if (next) go(next);
  };

  return (
    <>
      <Screen
        key={fixture.id}
        state={state}
        beat={beatOf(fixture.id)}
        revealed={true}
        submitted={false}
        mode="dev"
        dispatch={dispatch}
        draft={() => {}}
        ui={fixture.ui}
      />
      {!SHOT && <Navigator open={open} setOpen={setOpen} current={fixture} title={title} go={go} />}
    </>
  );
}

function Navigator({
  open,
  setOpen,
  current,
  title,
  go,
}: {
  open: boolean;
  setOpen: (o: boolean) => void;
  current: { id: string; label: string; note: string };
  title: string;
  go: (id: string) => void;
}) {
  const box: CSSProperties = {
    position: 'fixed',
    right: 8,
    bottom: 8,
    zIndex: 2147483647,
    font: '12px/1.4 system-ui, sans-serif',
    color: '#111',
    background: 'rgba(255,255,255,0.96)',
    border: '1px solid #999',
    borderRadius: 6,
    boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
  };
  if (!open) {
    return (
      <button style={{ ...box, padding: '4px 8px', cursor: 'pointer' }} onClick={() => setOpen(true)} title="` 키로 열기, [ ] 키로 이전/다음">
        {title} · {current.label} ▴
      </button>
    );
  }
  return (
    <div style={{ ...box, width: 300, maxHeight: '70vh', overflow: 'auto', padding: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <strong>{title}</strong>
        <button onClick={() => setOpen(false)} style={{ cursor: 'pointer' }}>
          닫기
        </button>
      </div>
      <div style={{ color: '#555', marginBottom: 6 }}>{current.note}</div>
      {SCREEN_ORDER.map((screen) => (
        <div key={screen} style={{ marginBottom: 6 }}>
          <div style={{ fontWeight: 600 }}>{SCREEN_LABEL[screen]}</div>
          {FIXTURES.filter((f) => f.screen === screen).map((f) => (
            <button
              key={f.id}
              onClick={() => go(f.id)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '2px 6px',
                border: 0,
                background: f.id === current.id ? '#dde7ff' : 'transparent',
                cursor: 'pointer',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      ))}
      <div style={{ color: '#777' }}>` 열기/닫기 · [ ] 이전/다음</div>
    </div>
  );
}
