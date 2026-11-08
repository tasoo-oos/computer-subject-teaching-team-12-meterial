// 기본 선택지 정합성: EVENTS의 모든 장면에 fallback: true 선택지가 정확히 하나, requires 없음.
// 부록 A 표와 자동 대조한다 (§4.4).
import { describe, expect, it } from 'vitest';
import { fallbackChoice } from './engine.ts';
import { EVENTS } from './data/events.ts';
import type { Choice, Scene } from './types.ts';

/** docs/core-api.md 부록 A에서 확정한 장면별 기본 선택지 */
const EXPECTED: Record<string, string> = {
  'tutorial/welcome': 'ok',
  'laptop-spill/start': 'splurge',
  'laptop-spill/seller': 'transfer',
  'laptop-spill/scammed': 'splurge',
  'laptop-spill/again': 'splurge',
  'sneaker-resell/start': 'flip3',
  'sneaker-resell/check4': 'hold',
  'sneaker-resell/check6': 'hold',
  'family-month/gift': 'luxury',
  'family-month/message': 'send',
  'family-month/aftermath': 'ok',
  'rent-hike/notice': 'ignore',
  'rent-hike/counter': 'hangUp',
  'scratch-lottery/win': 'more',
  'scratch-lottery/reveal': 'again',
  'market-crash/drop': 'sellAll',
  'market-crash/dropNoInvest': 'tipStock',
  'price-rise/notice': 'ignore',
  'price-rise/revolving': 'revolve',
  'coin-room/invite': 'tryTen',
  'coin-room/withdraw': 'payFee',
  'coin-room/vanished': 'ok',
};

function allScenes(): { key: string; scene: Scene }[] {
  const out: { key: string; scene: Scene }[] = [];
  for (const event of Object.values(EVENTS)) {
    for (const scene of Object.values(event.scenes)) out.push({ key: `${event.id}/${scene.id}`, scene });
  }
  return out;
}

describe('기본 선택지 정합성 (부록 A)', () => {
  it('모든 장면이 부록 A 표와 하나씩 대응된다 (빠지거나 늘어난 장면 없음)', () => {
    const scenes = allScenes().map((x) => x.key).sort();
    expect(scenes).toEqual(Object.keys(EXPECTED).sort());
  });

  it('모든 장면에 기본 선택지가 정확히 하나 있고 잠김 조건(requires)이 없다', () => {
    for (const { key, scene } of allScenes()) {
      const flagged = scene.choices.filter((c) => c.fallback === true);
      expect(flagged, key).toHaveLength(1);
      const fb = flagged[0] as Choice;
      expect(fb.requires, key).toBeUndefined();
      expect(fallbackChoice(scene).id).toBe(EXPECTED[key]);
    }
  });

  it('새로 넣은 8개 선택지의 형태가 부록 A와 같다', () => {
    const pick = (key: string, id: string): Choice => {
      const [eventId, sceneId] = key.split('/');
      const scene = EVENTS[eventId as keyof typeof EVENTS]?.scenes[sceneId as string];
      const choice = scene?.choices.find((c) => c.id === id);
      expect(choice, `${key}/${id}`).toBeDefined();
      return choice as Choice;
    };
    // 노트북 최고 사양 할부 (같은 문구 3곳)
    for (const key of ['laptop-spill/start', 'laptop-spill/scammed', 'laptop-spill/again']) {
      const c = pick(key, 'splurge');
      expect(c.kind).toBe('fixedPay');
      expect(c.fixedPay?.amount).toBe(2_800_000);
      expect(c.fixedPay?.cardMonths).toBe(12);
      expect(c.fixedPay?.interestFree).toBe(false);
      expect(c.requires).toBeUndefined();
    }
    expect(pick('laptop-spill/again', 'splurge').effects).toContainEqual({ kind: 'removeStatus', status: 'noLaptop' });
    // 운동화 3켤레
    const flip3 = pick('sneaker-resell/start', 'flip3');
    expect(flip3.kind).toBe('gamble');
    expect(flip3.pay?.amount).toBe(900_000);
    expect(flip3.pay?.sources).toContain('card');
    expect(flip3.effects).toContainEqual({ kind: 'addStatus', status: 'sneakers', count: 3 });
    expect(flip3.next).toEqual({ scene: 'check4', delayMonths: 1 });
    // 명품 선물
    const luxury = pick('family-month/gift', 'luxury');
    expect(luxury.kind).toBe('fixedPay');
    expect(luxury.fixedPay?.amount).toBe(1_000_000);
    expect(luxury.fixedPay?.cardMonths).toBe(6);
    expect(luxury.next).toEqual({ scene: 'message' });
    // 월세 문자 무시 / 연락 끊기
    for (const [key, id, rentDelta] of [
      ['rent-hike/notice', 'ignore', 70_000],
      ['rent-hike/counter', 'hangUp', 50_000],
    ] as const) {
      const c = pick(key, id);
      expect(c.kind).toBe('budget');
      expect(c.effects).toContainEqual({ kind: 'budget', expense: 'rent', delta: rentDelta });
      expect(c.effects).toContainEqual({ kind: 'openBudget', reason: expect.stringContaining('') });
    }
    // 단톡방 추천 종목
    const tip = pick('market-crash/dropNoInvest', 'tipStock');
    expect(tip.kind).toBe('fixedPay');
    expect(tip.fixedPay?.amount).toBe(500_000);
    expect(tip.fixedPay?.source).toBe('card');
    expect(tip.fixedPay?.cardMonths).toBe(3);
    expect(tip.effects).toContainEqual({ kind: 'money', account: 'invest', delta: 500_000 });
    expect(tip.effects).toContainEqual({ kind: 'money', account: 'invest', delta: -250_000 });
  });

  it('새 선택지가 데이터 순서에 섞여 있다 (맨 아래 고정 자리가 아님)', () => {
    const scenes = allScenes();
    const lastCount = scenes.filter(({ scene }) => {
      const fb = fallbackChoice(scene);
      return scene.choices[scene.choices.length - 1]?.id === fb.id && scene.choices.length > 1;
    }).length;
    // 22개 장면 중 확인 장면(선택지 1개) 3개를 빼도, 기본 선택지 전부가 맨 아래면 이상하다
    expect(lastCount).toBeLessThan(scenes.length - 3);
  });

  it('fallbackChoice는 0개거나 2개 이상이면 예외를 던진다', () => {
    const scene = (ids: string[]): Scene =>
      ({ id: 't', channel: 'narration', text: '', choices: ids.map((id) => ({ id, kind: 'free', label: id, feedback: '' })) }) as unknown as Scene;
    expect(() => fallbackChoice(scene(['a', 'b']))).toThrow();
    const one = scene(['a', 'b']);
    (one.choices[0] as Choice).fallback = true;
    expect(fallbackChoice(one).id).toBe('a');
    const two = scene(['a', 'b']);
    (two.choices[0] as Choice).fallback = true;
    (two.choices[1] as Choice).fallback = true;
    expect(() => fallbackChoice(two)).toThrow();
  });
});
