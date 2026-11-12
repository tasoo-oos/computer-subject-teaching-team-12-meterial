// 12조: 안내 카드 자리에 발표 자료(GuideDeck)를 넣었을 때의 비트 순서와 단계 이동.
// 기본 설정(deck 없음)은 beats.test.ts가 그대로 지킨다.
import { describe, expect, it } from 'vitest';
import type { DeckManifest } from '@gagyebu/live';
import { beats, parseDeckBeat } from './beats.ts';
import type { GagyebuConfig } from './config.ts';
import { done, transition } from './progress.ts';
import { student } from './testutil.ts';
import { apply } from './testutil.ts';
import { defaultAnswers } from '@gagyebu/core';

const deck: DeckManifest = {
  id: 'concepts',
  title: '개념',
  slides: [{ id: 's08' }, { id: 's09' }, { id: 's10', steps: 2 }, { id: 's15', notes: '노트' }],
};
const cfg: GagyebuConfig = { guide: true, monthReveal: true, spotlight: true, confirmForce: true, deck: { manifest: deck, beforeSurvey: ['s08'], keepGuides: [6] } };
const ids = beats(cfg).map((b) => b.id);

describe('GuideDeck', () => {
  it('설문 앞 장 · 설문 결과 뒤 장 · 남긴 안내 카드 순서', () => {
    expect(ids.slice(0, 10)).toEqual([
      'join', 'salary', 'deck:concepts:s08', 'survey', 'survey-result',
      'deck:concepts:s09', 'deck:concepts:s10--0', 'deck:concepts:s10--1', 'deck:concepts:s15', 'guide-6',
    ]);
    expect(ids[10]).toBe('budget');
    expect(ids.filter((i) => /^guide-/.test(i))).toEqual(['guide-6']);
  });
  it('장 비트는 show, 노트를 이어받고, 풀어낼 수 있다', () => {
    const b = beats(cfg).find((x) => x.id === 'deck:concepts:s15')!;
    expect(b.mode).toBe('show');
    expect(b.notes).toBe('노트');
    expect(parseDeckBeat(b.id)).toEqual({ deckId: 'concepts', slideBeatId: 's15' });
    expect(parseDeckBeat('guide-6')).toBeNull();
  });
  it('장 비트는 늘 완료, 마지막 안내 → 가계부에서 안내 단계 학생을 가계부로 옮긴다', () => {
    const s = apply(student(), { type: 'submitSurvey', answers: defaultAnswers({}) });
    expect(s.phase).toBe('guide');
    const i = ids.indexOf('deck:concepts:s09');
    expect(done(s, i, cfg)).toBe(true);
    const b = ids.indexOf('budget');
    expect(transition(s, b - 1, b, cfg)).toEqual([{ type: 'goto', phase: 'budget' }]);
  });
});

describe('openingDeck', () => {
  it('입장 바로 뒤에 도입 덱 장이 온다(입장 QR이 맨 앞)', () => {
    const intro: DeckManifest = { id: 'intro', title: '도입', slides: [{ id: 's01' }, { id: 's03', steps: 2 }] };
    const ids2 = beats({ ...cfg, openingDeck: intro }).map((b) => b.id);
    expect(ids2.slice(0, 6)).toEqual(['join', 'deck:intro:s01', 'deck:intro:s03--0', 'deck:intro:s03--1', 'salary', 'deck:concepts:s08']);
  });
});

describe('월급 공개 · 안내 카드 빼기', () => {
  it('salary: false · keepGuides: []면 그 비트 없이 흐른다', () => {
    const ids3 = beats({ ...cfg, salary: false, deck: { manifest: deck, beforeSurvey: ['s08'], keepGuides: [] } }).map((b) => b.id);
    expect(ids3.slice(0, 9)).toEqual([
      'join', 'deck:concepts:s08', 'survey', 'survey-result',
      'deck:concepts:s09', 'deck:concepts:s10--0', 'deck:concepts:s10--1', 'deck:concepts:s15', 'budget',
    ]);
    expect(ids3).not.toContain('salary');
    expect(ids3.filter((i) => /^guide-/.test(i))).toEqual([]);
  });
});
