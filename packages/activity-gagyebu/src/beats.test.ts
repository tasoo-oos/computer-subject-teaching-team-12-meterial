import { describe, expect, it } from 'vitest';
import { beats } from './beats.ts';
import type { GagyebuConfig } from './config.ts';

const full: GagyebuConfig = { guide: true, monthReveal: true, spotlight: true, confirmForce: true };
const noGuide: GagyebuConfig = { ...full, guide: false };
const noSpotlight: GagyebuConfig = { ...full, spotlight: false };
const noReveal: GagyebuConfig = { ...full, monthReveal: false };

/** reveal이 붙는 월 (§9.2) */
const REVEAL_MONTHS = [2, 3, 5, 6, 7, 8, 9, 11];

describe('beats(cfg)', () => {
  it('기본 설정이면 §9.2 표의 24비트가 순서대로 나온다', () => {
    const list = beats(full);
    expect(list).toHaveLength(24);
    expect(list.map((b) => b.id)).toEqual([
      'join',
      'salary',
      'survey',
      'survey-result',
      'guide-1',
      'guide-2',
      'guide-3',
      'guide-4',
      'guide-5',
      'guide-6',
      'budget',
      'm1',
      'm2',
      'm3',
      'm4',
      'm5',
      'm6',
      'm7',
      'm8',
      'm9',
      'm10',
      'm11',
      'm12',
      'present',
    ]);
  });

  it('라벨이 표와 같다', () => {
    const list = beats(full);
    const byId = Object.fromEntries(list.map((b) => [b.id, b.label] as const));
    expect(byId['join']).toBe('입장');
    expect(byId['salary']).toBe('월급 공개');
    expect(byId['survey']).toBe('소비습관 설문');
    expect(byId['survey-result']).toBe('설문 결과');
    expect(byId['guide-1']).toBe('안내 1');
    expect(byId['guide-6']).toBe('안내 6');
    expect(byId['budget']).toBe('가계부 작성');
    expect(byId['m1']).toBe('1월');
    expect(byId['m11']).toBe('11월');
    expect(byId['m12']).toBe('12월 결산');
    expect(byId['present']).toBe('발표');
  });

  it('mode가 표와 같다 (join·survey·budget·m1..m12는 work, 나머지 show)', () => {
    const list = beats(full);
    const work = list.filter((b) => b.mode === 'work').map((b) => b.id);
    expect(work).toEqual(['join', 'survey', 'budget', 'm1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8', 'm9', 'm10', 'm11', 'm12']);
  });

  it('reveal은 cfg.monthReveal일 때 budget·공개 월(2·3·5·6·7·8·9·11)·m12에만 붙는다', () => {
    const list = beats(full);
    const revealed = list.filter((b) => b.reveal === true).map((b) => b.id);
    expect(revealed).toEqual(['budget', ...REVEAL_MONTHS.map((m) => `m${m}`), 'm12']);
    // m1(튜토리얼)·m4·m10(조용한 달)은 reveal이 없다
    expect(list.find((b) => b.id === 'm1')?.reveal).toBeUndefined();
    expect(list.find((b) => b.id === 'm4')?.reveal).toBeUndefined();
    expect(list.find((b) => b.id === 'm10')?.reveal).toBeUndefined();
  });

  it('cfg.monthReveal이 false면 reveal 비트가 하나도 없다', () => {
    expect(beats(noReveal).every((b) => b.reveal === undefined)).toBe(true);
  });

  it('cfg.guide가 false면 안내 카드 6비트가 빠진다 (24 → 18)', () => {
    const list = beats(noGuide);
    expect(list).toHaveLength(18);
    expect(list.some((b) => b.id.startsWith('guide-'))).toBe(false);
  });

  it('cfg.spotlight이 false면 발표 비트가 빠진다 (24 → 23)', () => {
    const list = beats(noSpotlight);
    expect(list).toHaveLength(23);
    expect(list.some((b) => b.id === 'present')).toBe(false);
  });

  it('노트: 고정 비트는 표의 예시 문구, 월 비트는 그 달 이벤트의 교훈', () => {
    const list = beats(full);
    const byId = Object.fromEntries(list.map((b) => [b.id, b.notes] as const));
    expect(byId['join']).toBe('QR·링크 안내');
    expect(byId['salary']).toBe('모두 같은 월급 265만 원');
    expect(byId['survey']).toBe('7문항 한 화면');
    expect(byId['survey-result']).toBe('분포 없음');
    expect(byId['budget']).toBe('추천값·프롬프트 안내');
    expect(byId['present']).toBe('발표 진행 순서');
    expect(byId['m12']).toBeUndefined();
    // 조용한 달(4·10)은 이벤트가 없으므로 안내 문구
    expect(byId['m4']).toBe('조용한 달 — 이벤트 없음');
    expect(byId['m10']).toBe('조용한 달 — 이벤트 없음');
    // 이벤트 달은 그 이벤트의 교훈이 들어 있다
    expect(typeof byId['m2']).toBe('string');
    expect((byId['m2'] ?? '').length).toBeGreaterThan(0);
    // 안내 비트는 카드별 발표자 노트
    expect(byId['guide-1']).toContain('선저축');
  });
});
