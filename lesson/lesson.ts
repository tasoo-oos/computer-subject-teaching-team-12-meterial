// 수업 콘텐츠 (docs/live-api.md §2.3). 세그먼트 순서·설정만 담는 데이터 파일이다 (React 금지, §1.2).
// lesson/decks/*.ts는 DeckManifest만 내보낸다.
import type { GagyebuConfig } from '@gagyebu/activity-gagyebu';
import type { Lesson } from '@gagyebu/live';
import { introDeck } from './decks/intro.ts';
import { sampleDeck } from './decks/sample.ts';
import { wrapUpDeck } from './decks/wrap-up.ts';

const gagyebuConfig: GagyebuConfig = { guide: true, monthReveal: true, spotlight: true, confirmForce: true };

export const lesson: Lesson = {
  id: 'first-salary',
  title: '내 첫 월급, 1년 살아 보기',
  settings: { showProgressOnStage: false },
  segments: [
    { kind: 'slides', id: 'intro', deck: introDeck }, // 슬라이드가 들어오기 전까지 slides: [] 로 비워 둠
    {
      kind: 'activity',
      id: 'game',
      activity: 'gagyebu',
      config: gagyebuConfig,
    },
    { kind: 'slides', id: 'wrap-up', deck: wrapUpDeck },
  ],
};

/** 리허설·테스트용 레슨. 시험용 덱(sample)을 게임 앞에 둔다 — M2·M8 검증용(§12.2). */
export const rehearsalLesson: Lesson = {
  id: 'rehearsal',
  title: '리허설: 내 첫 월급, 1년 살아 보기',
  settings: { showProgressOnStage: false },
  segments: [
    { kind: 'slides', id: 'sample', deck: sampleDeck },
    {
      kind: 'activity',
      id: 'game',
      activity: 'gagyebu',
      config: gagyebuConfig,
    },
    { kind: 'slides', id: 'wrap-up', deck: wrapUpDeck },
  ],
};
