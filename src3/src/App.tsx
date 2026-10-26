import { DraftShell, type ScreenMap } from '@gagyebu/draft-kit';
import { StartScreen } from './screens/StartScreen.tsx';
import { SurveyScreen } from './screens/SurveyScreen.tsx';
import { GuideScreen } from './screens/GuideScreen.tsx';
import { BudgetScreen } from './screens/BudgetScreen.tsx';
import { SimScreen } from './screens/SimScreen.tsx';
import { ResultScreen } from './screens/ResultScreen.tsx';

const screens: ScreenMap = {
  start: StartScreen,
  survey: SurveyScreen,
  guide: GuideScreen,
  budget: BudgetScreen,
  sim: SimScreen,
  result: ResultScreen,
};

export function App() {
  return <DraftShell screens={screens} title="src3" />;
}
