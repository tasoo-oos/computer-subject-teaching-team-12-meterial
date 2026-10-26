import type { MonthNo, Won } from '../types.ts';

/** 기준 평균소득 (세후). 근거 통계 확정 전 임시값 */
export const BASE_SALARY: Won = 2_600_000;
/** 월급 랜덤 범위 ±10% */
export const SALARY_SPREAD = 0.1;
/** 1만 원 단위 반올림 */
export const SALARY_ROUND: Won = 10_000;

export const START_SATISFACTION = 60;
export const START_CREDIT = 850;

/** 학습용 가정 연이율 */
export const RATES = {
  emergency: 0.02,
  goal: 0.02,
  housing: 0.02,
  savings: 0.035,
  savingsBroken: 0.005,
  installmentApr: 0.15,
  revolvingApr: 0.18,
  interestTax: 0.154,
} as const;

/** 투자 계좌 월별 수익률 (고정값). 8월 급락 후 12월에 급락 전보다 약 1% 높아짐 */
export const MARKET_RETURNS: Record<MonthNo, number> = {
  1: 0,
  2: 0.01,
  3: 0.015,
  4: -0.01,
  5: 0.02,
  6: 0.01,
  7: 0.015,
  8: -0.15,
  9: 0.04,
  10: 0.06,
  11: 0.05,
  12: 0.03,
};

/** 한정판 운동화 1켤레 리셀 시세 */
export const SNEAKER_PRICES: Record<MonthNo, Won> = {
  3: 300_000,
  4: 420_000,
  5: 330_000,
  6: 240_000,
  7: 200_000,
  8: 180_000,
  9: 180_000,
  10: 180_000,
  11: 180_000,
  12: 180_000,
};
export const RESELL_FEE = 0.1;

/** 결산 달. 이 달에는 이벤트와 선택이 없다 */
export const SETTLEMENT_MONTH: MonthNo = 12;
/** 이벤트 없는 달 (예약 후속 장면만 나타남) */
export const QUIET_MONTHS: MonthNo[] = [4, 10];
