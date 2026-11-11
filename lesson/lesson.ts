// 수업 콘텐츠 (docs/live-api.md §2.3). 세그먼트 순서·설정만 담는 데이터 파일이다 (React 금지, §1.2).
// lesson/decks/*.ts는 DeckManifest만 내보낸다.
import type { GagyebuConfig } from '@gagyebu/activity-gagyebu';
import type { Lesson } from '@gagyebu/live';
import { conceptsDeck, introDeck, wrapupDeck } from './decks/intro.ts';
import { sampleDeck } from './decks/sample.ts';

const gagyebuConfig: GagyebuConfig = { guide: true, monthReveal: true, spotlight: true, confirmForce: true };

export const lesson: Lesson = {
  id: 'first-salary',
  title: '내 첫 월급, 1년 살아 보기',
  settings: { showProgressOnStage: false },
  // 발표 순서(팀 대본): 입장 QR(맨 앞) → 표지 · 팀 · 오프닝 · 학습 목표 · 오늘의 길 → 월급 · 8장 소비습관 · 설문 · 결과 → 개념 9~15장 → 꿀팁 카드 · 가계부 · 1년 → 마무리.
  // 도입 덱은 게임의 입장 바로 뒤(openingDeck), 개념 장은 게임의 「안내」 자리(deck, 태수님 안)에 들어간다. '다음'만 눌러도 이 순서로 흐른다.
  //  - 8장(질문 7개에 답하면 나의 유형은?)은 설문 바로 앞, 9~15장은 설문 결과 뒤.
  //  - 안내 카드 1~5는 개념 9~13장과 같은 내용이라 빼고, 대응 장이 없는 6(사회초년생 꿀팁)만 남긴다.
  segments: [
    {
      kind: 'activity',
      id: 'game',
      activity: 'gagyebu',
      config: { ...gagyebuConfig, openingDeck: introDeck, deck: { manifest: conceptsDeck, beforeSurvey: ['s08'], keepGuides: [6] } },
    },
    { kind: 'slides', id: 'wrap-up', deck: wrapupDeck },
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
    { kind: 'slides', id: 'wrap-up', deck: wrapupDeck },
  ],
};
