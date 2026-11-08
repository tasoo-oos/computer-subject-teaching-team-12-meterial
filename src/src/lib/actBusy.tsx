// 학생 행동 진행 중(busy) 상태를 화면 부품에 알려 주는 컨텍스트 (S5).
// 라이브 Audience가 dispatch 큐를 처리하는 동안 true — 버튼 겹침(연타)을 시각적으로 막는다.
// dev·solo에서는 기본값 false(로컬 dispatch는 즉시 끝난다).
import { createContext, useContext } from 'react';

export const ActBusyContext = createContext<boolean>(false);

/** 진행 중인 서버 행동이 있으면 true. 주요 제출 버튼의 disabled에 쓴다 */
export function useActBusy(): boolean {
  return useContext(ActBusyContext);
}
