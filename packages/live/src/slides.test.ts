import { describe, expect, it } from 'vitest';
import { beforeBeat, deckBeats, lessonBeats, sameBeat } from './slides.ts';
import type { Beat, DeckManifest, Lesson } from './types.ts';

const deck: DeckManifest = {
  id: 'test',
  title: '테스트 덱',
  slides: [
    { id: 'hello', label: '인사', notes: '환영 인사' },
    { id: 'why', label: '왜 가계부인가', steps: 3, notes: '항목을 하나씩 공개' },
    { id: 'rules' }, // 라벨·노트 없음
  ],
};

const activityBeats: Beat[] = [
  { id: 'join', label: '입장', mode: 'work' },
  { id: 'salary', label: '월급 공개', mode: 'show' },
];

describe('deckBeats', () => {
  it('steps 없는 슬라이드는 비트 1개, id는 슬라이드 id', () => {
    const beats = deckBeats({ id: 'd', title: '', slides: [{ id: 'a', label: 'A' }, { id: 'b' }] });
    expect(beats).toEqual([
      { id: 'a', label: 'A', mode: 'show' },
      { id: 'b', label: 'b', mode: 'show' },
    ]);
  });

  it('steps: n인 슬라이드는 비트 n개, id는 `${slideId}--${k}`, 라벨에 (k/n)이 붙는다', () => {
    const beats = deckBeats({ id: 'd', title: '', slides: [{ id: 'why', steps: 3 }] });
    expect(beats.map((b) => b.id)).toEqual(['why--0', 'why--1', 'why--2']);
    expect(beats.map((b) => b.label)).toEqual(['why (1/3)', 'why (2/3)', 'why (3/3)']);
    expect(beats.every((b) => b.mode === 'show')).toBe(true);
  });

  it('라벨이 없으면 슬라이드 id, 노트는 모든 비트에 붙는다', () => {
    const beats = deckBeats(deck);
    expect(beats.map((b) => b.label)).toEqual(['인사', '왜 가계부인가 (1/3)', '왜 가계부인가 (2/3)', '왜 가계부인가 (3/3)', 'rules']);
    expect(beats[0]?.notes).toBe('환영 인사');
    expect(beats[3]?.notes).toBe('항목을 하나씩 공개');
    expect(beats[4]?.notes).toBeUndefined();
  });
});

describe('lessonBeats', () => {
  const lesson: Lesson = {
    id: 'test-lesson',
    title: '테스트',
    settings: { showProgressOnStage: false },
    segments: [
      { kind: 'slides', id: 'intro', deck },
      { kind: 'activity', id: 'game', activity: 'gagyebu', config: { any: true } },
    ],
  };

  it('세그먼트 순서대로 평탄화하고 활동 세그먼트는 beatsOf로 계산한다', () => {
    const flat = lessonBeats(lesson, (activityId, config) => {
      expect(activityId).toBe('gagyebu');
      expect(config).toEqual({ any: true });
      return activityBeats;
    });
    expect(flat.map((s) => s.segment)).toEqual([0, 1]);
    expect(flat[0]?.beats.map((b) => b.id)).toEqual(['hello', 'why--0', 'why--1', 'why--2', 'rules']);
    expect(flat[1]?.beats).toEqual(activityBeats);
  });
});

describe('BeatRef 비교 헬퍼', () => {
  it('sameBeat', () => {
    expect(sameBeat({ segment: 0, beat: 3 }, { segment: 0, beat: 3 })).toBe(true);
    expect(sameBeat({ segment: 0, beat: 3 }, { segment: 1, beat: 3 })).toBe(false);
    expect(sameBeat({ segment: 1, beat: 0 }, { segment: 0, beat: 5 })).toBe(false);
  });

  it('beforeBeat — 전역 순서 비교, 같으면 false (리뷰 상태 판정: cursor < highMark)', () => {
    expect(beforeBeat({ segment: 0, beat: 1 }, { segment: 0, beat: 2 })).toBe(true);
    expect(beforeBeat({ segment: 0, beat: 5 }, { segment: 1, beat: 0 })).toBe(true);
    expect(beforeBeat({ segment: 1, beat: 0 }, { segment: 0, beat: 9 })).toBe(false);
    expect(beforeBeat({ segment: 1, beat: 2 }, { segment: 1, beat: 2 })).toBe(false);
  });
});
