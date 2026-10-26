/** 시안용 이동표: 엔진 대신 그럴듯한 다음 스냅숏으로 */
export const NEXT_FIXTURE: Record<string, string> = {
  'sim-jan-payday': 'sim-feb-scene',
  'sim-feb-scene': 'sim-feb-outcome',
  'sim-feb-pay': 'sim-feb-outcome',
  'sim-feb-seller': 'sim-feb-outcome',
  'sim-feb-outcome': 'sim-mar-resell',
  'sim-mar-resell': 'sim-apr-check',
  'sim-apr-check': 'sim-may-message',
  'sim-may-message': 'sim-jun-adjust',
  'sim-jun-adjust': 'sim-jul-reveal',
  'sim-jul-reveal': 'sim-aug-crash',
  'sim-aug-crash': 'sim-oct-report',
  'sim-aug-deposit': 'sim-oct-report',
  'sim-oct-report': 'sim-nov-locked',
  'sim-nov-invite': 'result-balanced',
  'sim-nov-locked': 'result-debt',
};

/** 같은 달에 이어지는 장면을 보여 주는 스냅숏 */
export const SCENE_FIXTURE: Record<string, string> = {
  'laptop-spill/seller': 'sim-feb-seller',
  'family-month/message': 'sim-may-message',
};
