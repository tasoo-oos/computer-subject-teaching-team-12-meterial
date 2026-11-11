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
  // 발표 순서(팀 대본): 표지 · 팀 · 오프닝 · 학습 목표 · 오늘의 길 → 입장 · 월급 · 설문 · 결과(게임) → 개념 8~15장 → 게임 계속 → 마무리(복습 · 퀴즈 3 · 차시 예고).
  // 게임은 한 세그먼트라 사이에 슬라이드를 끼울 수 없어서, 개념 덱을 맨 앞에 두고 리뷰(§4.1)로 돌아가 보여 준다.
  //  1) 수업을 열고 청중이 오기 전에 통제에서 '다음'으로 개념 덱을 지나 도입 덱 표지에 세운다.
  //  2) 설문 결과(survey-result)까지 진행한 뒤 타임라인에서 개념 덱 첫 장을 눌러 되돌아가 '다음'으로 8~15장.
  //  3) 15장이 끝나면 '현재 단계로 돌아가기'로 설문 결과에 복귀 → 안내 카드 · 가계부로 이어 간다.
  segments: [
    { kind: 'slides', id: 'concepts', deck: conceptsDeck },
    { kind: 'slides', id: 'intro', deck: introDeck },
    {
      kind: 'activity',
      id: 'game',
      activity: 'gagyebu',
      config: gagyebuConfig,
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
