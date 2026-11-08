// /dev 개발 페이지 (docs/live-api.md §10.9): 통제 로그인 게이트 + 스냅숏 셸(DraftShell).
// route·beatOf는 src/src/dev/route.ts가 제공한다. `?shot`은 네비게이터를 숨긴다(draft-kit).
// 해시 #/slides 는 슬라이드 표시기(SlideCanvas) 스모크 화면 — scripts/smoke-slides.mjs가 4크기로 찍는다(§14 #84).
// mockup: 단일 HTML 빌드(pnpm single)를 file://·*.html로 열었을 때 — 게이트 없이 목업 셸로 돌아간다(§14 #83).
import { useEffect, useState } from 'react';
import { DraftShell, type ScreenMap } from '@gagyebu/draft-kit';
import { GateChecking, LoginScreen, useLoginGate } from '../live/LoginScreen.tsx';
import { BudgetScreen } from '../screens/BudgetScreen.tsx';
import { GuideScreen } from '../screens/GuideScreen.tsx';
import { ResultScreen } from '../screens/ResultScreen.tsx';
import { SimScreen } from '../screens/SimScreen.tsx';
import { StartScreen } from '../screens/StartScreen.tsx';
import { SurveyScreen } from '../screens/SurveyScreen.tsx';
import { SlideSmoke } from './SlideSmoke.tsx';
import { beatOf, route } from './route.ts';

const screens: ScreenMap = {
  start: StartScreen,
  survey: SurveyScreen,
  guide: GuideScreen,
  budget: BudgetScreen,
  sim: SimScreen,
  result: ResultScreen,
};

type Mode = 'slides' | 'shell';

function readMode(): Mode {
  return window.location.hash.replace(/^#\/?/, '') === 'slides' ? 'slides' : 'shell';
}

export function DevPage({ mockup = false }: { mockup?: boolean }) {
  const gate = useLoginGate('control');
  const [mode, setMode] = useState<Mode>(readMode);

  useEffect(() => {
    const onHash = () => setMode(readMode());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  if (!mockup) {
    // /dev 보호는 앱 수준(§14 #24): GET /api/me로 통제 쿠키 확인
    if (gate.checking) return <GateChecking />;
    if (gate.role !== 'control') return <LoginScreen role="control" offline={gate.offline} onSuccess={gate.retry} />;
  }

  if (mode === 'slides') return <SlideSmoke />;
  return <DraftShell screens={screens} title="통장 정리" route={route} beatOf={beatOf} />;
}
