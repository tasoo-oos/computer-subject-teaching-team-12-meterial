// 가계부 활동의 비트 목록 (docs/live-api.md §9.2). 라벨·노트·reveal 규칙까지 구현한다.
import { EVENTS, GUIDE_CARDS, SCHEDULE } from '@gagyebu/core';
import type { Beat } from '@gagyebu/live';
import type { GagyebuConfig } from './config.ts';

/** reveal이 붙는 월 비트 (m1 튜토리얼, m4·m10 조용한 달은 제외 — §9.2) */
const REVEAL_MONTHS = new Set([2, 3, 5, 6, 7, 8, 9, 11]);

/** N월 비트의 발표자 노트: 그 달 이벤트의 교훈("달마다 교훈"). 조용한 달은 안내 문구 */
function monthNotes(month: number): string {
  const eventId = SCHEDULE[month];
  const event = eventId ? EVENTS[eventId] : undefined;
  return event ? event.lesson : '조용한 달 — 이벤트 없음';
}

function beat(id: string, label: string, mode: 'show' | 'work', extra?: { reveal?: boolean; notes?: string }): Beat {
  const b: Beat = { id, label, mode };
  if (extra?.reveal) b.reveal = true;
  if (extra?.notes !== undefined) b.notes = extra.notes;
  return b;
}

/** 세그먼트의 비트 목록 (§9.2 표 그대로). reveal은 cfg.monthReveal이 true일 때만 붙는다. */
export function beats(cfg: GagyebuConfig): Beat[] {
  const beats: Beat[] = [
    beat('join', '입장', 'work', { notes: 'QR·링크 안내' }),
    beat('salary', '월급 공개', 'show', { notes: '모두 같은 월급 265만 원' }),
    beat('survey', '소비습관 설문', 'work', { notes: '7문항 한 화면' }),
    beat('survey-result', '설문 결과', 'show', { notes: '분포 없음' }),
  ];
  if (cfg.guide) {
    GUIDE_CARDS.forEach((card, i) => {
      beats.push(beat(`guide-${i + 1}`, `안내 ${i + 1}`, 'show', { notes: `${card.title} — ${card.lead}` }));
    });
  }
  beats.push(beat('budget', '가계부 작성', 'work', { reveal: cfg.monthReveal, notes: '추천값·프롬프트 안내' }));
  for (let month = 1; month <= 11; month++) {
    beats.push(
      beat(`m${month}`, `${month}월`, 'work', {
        reveal: cfg.monthReveal && REVEAL_MONTHS.has(month),
        notes: monthNotes(month),
      }),
    );
  }
  beats.push(beat('m12', '12월 결산', 'work', { reveal: cfg.monthReveal }));
  if (cfg.spotlight) {
    beats.push(beat('present', '발표', 'show', { notes: '발표 진행 순서' }));
  }
  return beats;
}
