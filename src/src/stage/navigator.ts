// TV 매트 내비게이터의 지도: 지금 비트가 「오늘의 길」 몇 번째 정거장인지, 누가 발표하는지.
// 정거장은 도입 5장(오늘의 길)과 같은 다섯, 이름은 무대에 서는 순서(김 · 이 · 박 · 최).
// 레슨(lesson/lesson.ts)의 세그먼트 id와 비트 id로만 판단한다 — 슬라이드 내용과 독립(다른 차원).
import { slideOfBeat } from '../activities/slides/SlideCanvas.tsx';

export const STOPS = ['습관 진단', '통장 나누기', 'AI와 가계부', '1년 살며 판단하기', '돌아보기'] as const;
export const TEAM = ['김홍준', '이상민', '박태수', '최유빈'] as const;
export type Member = (typeof TEAM)[number];
export const ROLE: Record<Member, string> = {
  최유빈: '도입 · 개념 1',
  이상민: '개념 2',
  박태수: '게임',
  김홍준: '결과 발표 · 정리',
};

export interface NavInfo {
  /** 정거장 번호(0~4). 출발 전(표지 · 팀 · 오프닝 · 학습 목표 · 오늘의 길)은 null */
  stop: number | null;
  who: Member;
}

/** 개념 · 도입 덱의 장 번호(PPT 장 번호와 같다) */
function slideNo(beatId: string): number {
  return Number(/^s(\d+)$/.exec(slideOfBeat(beatId).slideId)?.[1] ?? 0);
}

/** 개념 장 번호 → 정거장 · 발표자. PPT 6판 번호(오프닝 3장 · 학습 목표 4장): 8 소비습관 · 9~10 최유빈 개념 · 11~14 이상민 · 15 가계부 순서 */
function conceptNav(n: number): NavInfo {
  if (n === 8) return { stop: 0, who: '최유빈' };
  if (n <= 10) return { stop: 1, who: '최유빈' };
  if (n <= 14) return { stop: 1, who: '이상민' };
  return { stop: 2, who: '이상민' };
}

export function navOf(segmentId: string, beatId: string): NavInfo | null {
  if (segmentId === 'intro') return { stop: null, who: '최유빈' };
  if (segmentId === 'concepts') return conceptNav(slideNo(beatId));
  if (segmentId === 'game') {
    // 게임 안에 넣은 발표 자료 장(비트 id `deck:<덱>:<장>`): 입장 뒤 도입 1~5장 · 안내 자리 개념 8~15장
    const deck = /^deck:[^:]+:(.+)$/.exec(beatId);
    if (deck) {
      const n = slideNo(deck[1]!);
      return n <= 7 ? { stop: null, who: '최유빈' } : conceptNav(n);
    }
    if (beatId === 'join') return { stop: null, who: '최유빈' }; // 입장 QR(맨 앞) — 출발 전
    // 원장 11-12: 도입 · 설문 · 설문 결과 · 개념 1은 최유빈, 가계부 · 안내 · 12월 결산은 박태수, 발표(순위표)부터 김홍준
    if (['survey', 'survey-result'].includes(beatId)) return { stop: 0, who: '최유빈' };
    // 월급 공개는 이 흐름에서 뺐지만, 기본 설정 레슨에서는 게임 시작이라 박태수
    if (beatId === 'salary') return { stop: 0, who: '박태수' };
    // 안내 카드: 개념 장을 넣은 흐름에서는 15장(AI와 가계부) 뒤 꿀팁 카드 한 장만 남으므로 노선도가 뒤로 가지 않게 그 정거장에 둔다
    if (beatId === 'guide-6') return { stop: 2, who: '박태수' };
    if (beatId.startsWith('guide-')) return { stop: 1, who: '박태수' };
    if (beatId === 'budget') return { stop: 2, who: '박태수' };
    if (/^m\d+$/.test(beatId)) return { stop: 3, who: '박태수' };
    if (beatId === 'present') return { stop: 4, who: '김홍준' };
    return null;
  }
  if (segmentId === 'wrap-up') return { stop: 4, who: '김홍준' };
  return null;
}
