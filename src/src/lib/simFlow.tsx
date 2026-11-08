// 월급날 진행 상태를 Audience와 SimScreen이 공유하는 컨텍스트 (S5 2단계, §14 #122).
// 라이브·solo에서 beginMonth를 보내기 전엔 state.payday가 null이라 월급날 내역을 그릴 수 없다 —
// 그래서 2단으로 나간다: 소개 카드("월급 받기") → beginMonth → 실제 월급날 내역 + "다음".
// "월급받기"를 누른 달(paydayGate)이 열려 있는 동안 Audience는 대기 화면으로 바꾸지 않고
// SimScreen이 월급날 내역을 보여 준다(조용한 달은 beginMonth 직후 done이 되기 때문).
import { createContext, useContext } from 'react';

export interface SimFlow {
  /** 학생이 방금 월급을 받고 내역을 확인 중인 달. null이면 게이트 닫힘 */
  paydayGate: number | null;
  setPaydayGate: (month: number | null) => void;
}

/** dev(DraftShell)는 제공하지 않는다 — null이면 월급날 2단 진행을 쓰지 않고 기존 동작 */
export const SimFlowContext = createContext<SimFlow | null>(null);

export function useSimFlow(): SimFlow | null {
  return useContext(SimFlowContext);
}
