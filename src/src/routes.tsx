// 주소 → 페이지 (docs/live-api.md §10.1). 라우터 라이브러리 없이 window.location.pathname으로 직접(§14 #33).
// 학생·전면·통제·개발·혼자 화면은 서로 다른 청크로 나뉜다(학생이 받는 JS에 통제 코드가 없게).
import { lazy, Suspense, useEffect, useState } from 'react';
import { CodeEntryPage } from './live/CodeEntryPage.tsx';
import { NotFoundScreen } from './live/StatusScreens.tsx';

const StudentPage = lazy(() => import('./live/StudentPage.tsx').then((m) => ({ default: m.StudentPage })));
const StagePage = lazy(() => import('./stage/StagePage.tsx').then((m) => ({ default: m.StagePage })));
const ControlPage = lazy(() => import('./control/ControlPage.tsx').then((m) => ({ default: m.ControlPage })));
const DevPage = lazy(() => import('./dev/DevPage.tsx').then((m) => ({ default: m.DevPage })));
const SoloPage = lazy(() => import('./solo/SoloPage.tsx').then((m) => ({ default: m.SoloPage })));

type Route =
  | { kind: 'home' }
  | { kind: 'student'; code: string }
  | { kind: 'stage' }
  | { kind: 'control' }
  | { kind: 'dev' }
  | { kind: 'solo' }
  /** 단일 HTML 빌드(pnpm single)를 file:// 또는 *.html 경로에서 열었을 때 — 목업 셸로 돌아간다 */
  | { kind: 'mockup' }
  | { kind: 'not-found' };

function resolve(pathname: string): Route {
  // 앞붙이·뒷붙이 슬래시는 정규화한다 (//stage 같은 주소도 앱 경로로 본다)
  const p = ('/' + pathname.replace(/^\/+|\/+$/g, '')) || '/';
  if (p === '/') return { kind: 'home' };
  if (/^\/\d{4}$/.test(p)) return { kind: 'student', code: p.slice(1) };
  if (p === '/stage') return { kind: 'stage' };
  if (p === '/control') return { kind: 'control' };
  if (p === '/dev') return { kind: 'dev' };
  if (p === '/solo') return { kind: 'solo' };
  // 단일 HTML 빌드 호환: 스냅숏 목업(#/<fixture>)은 통제 로그인 없이 그대로 쓸 수 있게 한다(§14 #83)
  if (window.location.protocol === 'file:' || p.endsWith('.html')) return { kind: 'mockup' };
  // 그 외 경로: Vite 개발 폴백이 index.html을 주므로 앱이 "없는 수업" 화면을 보여 준다(§6.6)
  return { kind: 'not-found' };
}

function Loading() {
  return (
    <div className="paper-texture grid min-h-dvh place-items-center">
      <p className="text-[15px] text-ink-2">화면을 불러오는 중…</p>
    </div>
  );
}

export function App() {
  const [route, setRoute] = useState<Route>(() => resolve(window.location.pathname));
  useEffect(() => {
    const onPop = () => setRoute(resolve(window.location.pathname));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  return (
    <Suspense fallback={<Loading />}>
      {route.kind === 'home' ? (
        <CodeEntryPage />
      ) : route.kind === 'student' ? (
        <StudentPage code={route.code} />
      ) : route.kind === 'stage' ? (
        <StagePage />
      ) : route.kind === 'control' ? (
        <ControlPage />
      ) : route.kind === 'dev' ? (
        <DevPage />
      ) : route.kind === 'solo' ? (
        <SoloPage />
      ) : route.kind === 'mockup' ? (
        <DevPage mockup />
      ) : (
        <NotFoundScreen />
      )}
    </Suspense>
  );
}
