import type { MonthNo, Won } from './types.ts';

const nf = new Intl.NumberFormat('ko-KR');

/** 1234567 → "1,234,567원" */
export function formatWon(n: Won): string {
  return `${nf.format(Math.round(n))}원`;
}

/** 1234567 → "123.5만 원", 30000000 → "3,000만 원", 5000 → "5천 원" */
export function formatMan(n: Won): string {
  const sign = n < 0 ? '-' : '';
  const a = Math.abs(n);
  if (a < 10_000) {
    return a % 1_000 === 0 && a > 0 ? `${sign}${a / 1_000}천 원` : `${sign}${nf.format(a)}원`;
  }
  const man = a / 10_000;
  const text = Number.isInteger(man) ? nf.format(man) : nf.format(Math.round(man * 10) / 10);
  return `${sign}${text}만 원`;
}

/** 부호를 붙인 금액: +50,000원 / -230,000원 */
export function formatSignedWon(n: Won): string {
  if (n === 0) return '0원';
  return `${n > 0 ? '+' : '-'}${formatWon(Math.abs(n))}`;
}

/** 0.376 → "37.6%" */
export function formatPct(ratio: number, digits = 1): string {
  return `${(ratio * 100).toFixed(digits).replace(/\.0+$/, '')}%`;
}

export function monthLabel(m: MonthNo): string {
  return `${m}월`;
}

/** 템플릿의 {key} 자리를 채운다 */
export function fillTemplate(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (all, key: string) => (key in values ? String(values[key]) : all));
}
