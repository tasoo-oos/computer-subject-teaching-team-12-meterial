// CSV 내보내기 계약 단위 테스트 (docs/live-api.md §9.7).
import { describe, expect, it } from 'vitest';
import { exportColumns, exportRows, formatPaymentPlan } from './export.ts';
import { atFebPayday, beatIndex, cfg, runFallback, simStudent } from './testutil.ts';
import { fallback } from './progress.ts';
import { step } from '@gagyebu/core';
import type { PaymentPlan } from '@gagyebu/core';

describe('formatPaymentPlan', () => {
  it('계좌 파트는 "source:amount", 카드는 "card:amount/months", 세미콜론 결합', () => {
    const plan: PaymentPlan = {
      parts: [
        { source: 'emergency', amount: 520_000 },
        { source: 'goal', amount: 80_000 },
      ],
      card: { amount: 80_000, months: 3 },
    };
    expect(formatPaymentPlan(plan)).toBe('emergency:520000;goal:80000;card:80000/3');
  });

  it('계좌만 내면 카드 없이, 지불이 없으면 빈 문자열', () => {
    expect(formatPaymentPlan({ parts: [{ source: 'living', amount: 330_000 }] })).toBe('living:330000');
    expect(formatPaymentPlan({ parts: [] })).toBe('');
    expect(formatPaymentPlan({ parts: [], card: { amount: 2_800_000, months: 12 } })).toBe('card:2800000/12');
  });
});

describe('exportRows (§9.7)', () => {
  it('열 순서는 문서 그대로', () => {
    expect(exportColumns).toEqual([
      'studentId',
      'nickname',
      'month',
      'eventCode',
      'sceneId',
      'choiceId',
      'choiceLabel',
      'kind',
      'auto',
      'tags',
      'payment',
    ]);
  });

  it('decisions를 기록 순서대로 행으로 펼친다 — 자동 선택은 auto true, 태그는 ";" 결합', () => {
    // 2월: 수동(used), 나머지 자동 — 기록 순서·auto·payment 확인
    const s = runFallback(atFebPayday(), beatIndex('m2')); // 2월 리포트까지 자동
    expect(s.decisions.length).toBeGreaterThan(0);
    const rows = exportRows(s, { studentId: 's1', nickname: '봇1' });
    expect(rows).toHaveLength(s.decisions.length);
    expect(rows[0]!.month).toBe(1); // 1월 튜토리얼(ok)
    expect(rows[0]!.choiceId).toBe('ok');
    expect(rows[0]!.auto).toBe(false);
    const second = rows[1]!;
    expect(Object.keys(second)).toEqual(exportColumns);
    expect(second.studentId).toBe('s1');
    expect(second.nickname).toBe('봇1');
    expect(second.month).toBe(2);
    expect(second.sceneId).toBe('start');
    expect(second.choiceId).toBe('splurge');
    expect(second.kind).toBe('fixedPay');
    expect(second.auto).toBe(true); // 기본값 루프가 고른 선택
    expect(second.tags).toBe('');
    expect(second.payment).toBe('card:2800000/12'); // fixedPay 카드 12개월
  });

  it('결산까지 간 상태는 1년 치 기록이 순서대로 나온다', () => {
    const dec = runFallback(simStudent(), beatIndex('m12'));
    expect(dec.phase).toBe('result');
    const rows = exportRows(dec, { studentId: 's2', nickname: '봇2' });
    expect(rows.length).toBe(dec.decisions.length);
    // 월이 오름차순(기록 순서)이고 마지막은 11월 코인 리딩방
    const months = rows.map((r) => r.month as number);
    expect([...months].sort((a, b) => a - b)).toEqual(months);
    expect(months[months.length - 1]).toBe(11);
    // 상태 행동(운동화 판매 등)의 tags도 결합되어 나온다
    for (const r of rows) expect(typeof r.tags).toBe('string');
  });

  it('수동 선택은 auto false, pay 선택은 계획 문자열이 실린다', () => {
    // 2월에서 used(수동) 선택 → seller 장면에서 transfer(수동 pay) 선택
    const sc = atFebPayday();
    const s1 = step(sc, { type: 'beginMonth' });
    const s2 = step(s1, { type: 'choose', choiceId: 'used' });
    const s3 = step(s2, { type: 'continue' }); // seller
    const r = fallback(s3, beatIndex('m2'), cfg, undefined); // transfer 자동
    const s4 = step(s3, r.action);
    const rows = exportRows(s4, { studentId: 's3', nickname: '봇3' });
    expect(rows).toHaveLength(3); // 1월 ok + 2월 used + 2월 transfer
    expect(rows[1]!.choiceId).toBe('used');
    expect(rows[1]!.auto).toBe(false);
    expect(rows[2]!.choiceId).toBe('transfer');
    expect(rows[2]!.auto).toBe(true);
    expect(rows[2]!.tags).toBe('fraudHit');
    expect(String(rows[2]!.payment)).toMatch(/^(living|emergency|goal):\d+(;(living|emergency|goal):\d+)?$/);
  });
});
