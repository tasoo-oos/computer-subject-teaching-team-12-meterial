// 활동 모듈 계약 (docs/live-api.md §4.2). @gagyebu/core를 import하지 않는다(§1.2).
import type { Beat } from './types.ts';

export interface ActivityInitCtx {
  nickname: string;
  /** 서버가 주입하는 난수 함수. init 안에서만 쓴다(월급). 결과 행동에 값이 박히므로 로그로 재현 가능 */
  random: () => number;
}

/** 기본값 적용 한 걸음의 결과 */
export interface FallbackResult<A> {
  action: A;
  /** 학생에게 보여 줄 안내 문구. 예: "시간 안에 고르지 못해 '○○'이(가) 자동으로 선택됐어요" */
  notice: string;
}

export interface AutoAppliedNotice {
  beatId: string;
  message: string;
}

/**
 * 활동 모듈 계약. 모든 메서드는 순수 함수여야 한다:
 * - Math.random / Date.now / DOM / I/O 금지. 난수는 ActivityInitCtx.random으로만 주입받는다.
 * - apply는 원본을 고치지 않고 새 상태를 반환한다.
 * - 같은 (state, action)에 대해 항상 같은 결과. 서버 로그 재생이 곧 상태 복원이다.
 */
export interface ActivityLogic<Cfg, S, A, Stats> {
  id: string;
  /** 세그먼트의 비트 목록. openClass 때 한 번, 이후 cfg 불변이라 캐시한다 */
  beats(cfg: Cfg): Beat[];
  /** 학생 입장(join 승인) 때 서버가 호출. 반환한 actions를 서버가 곧바로 적용하고 로그에 남긴다(월급 등 주입값 포함).
   *  state는 "기저 상태": 난수를 소비하지 않아야 하고(모든 무작위값은 actions에 박혀야 함)
   *  같은 (nickname, cfg)에 대해 항상 같아야 한다. 재생은 기저 + 로그의 actions로 복원한다. */
  init(ctx: ActivityInitCtx, cfg: Cfg): { state: S; actions: A[] };
  /** 이 비트에서 이 행동을 받을 수 있는지. 서버는 act의 allowed 검사로 쓴다 */
  allowed(s: S, beat: number, a: A, cfg: Cfg): true | string;
  /** 행동 적용. gagyebu는 core.step을 감싼다 */
  apply(s: S, a: A, cfg: Cfg): S;
  /** 이 비트에서 학생이 할 일을 다 했는지. 완료 인원·next 마감 판정에 쓴다 */
  done(s: S, beat: number, cfg: Cfg): boolean;
  /** 끝내지 못한 학생에게 적용할 다음 기본 행동. done이 될 때까지 서버가 반복 호출한다.
   *  한 번 호출될 때마다 상태를 반드시 진전시켜야 한다(같은 행동 반복 금지, §14 #6). */
  fallback(s: S, beat: number, cfg: Cfg, draft: unknown | undefined): FallbackResult<A>;
  /** 비트를 떠날 때 서버가 "모든" 학생에게 대신 실행하는 전이. 해당 없으면 [].
   *  from·to는 이 활동 세그먼트 안의 비트 인덱스. 커서가 세그먼트 경계를 넘을 때는
   *  서버가 transition을 호출하지 않는다(활동의 마지막 비트까지 done이면 충분해야 한다). */
  transition(s: S, from: number, to: number, cfg: Cfg): A[];
  /** 익명 집계 (TV·통제용). 서버가 초당 최대 4회로 묶어 보낸다 */
  stats(states: S[], beat: number, cfg: Cfg): Stats;
  /** 미완료 명단용 "지금 있는 장면" 문구 */
  locate?(s: S): string | null;
  /** 통제 페이지 "기본값 미리보기"용, 지금 넘기면 적용될 선택지 이름 */
  previewFallback?(s: S, beat: number, cfg: Cfg): string | null;
  /** CSV 내보내기(§8.5). 열 순서와 행 변환을 활동이 정의하고 서버는 조립만 한다 */
  exportColumns?: string[];
  exportRows?(s: S, student: { studentId: string; nickname: string }): Record<string, string | number | boolean>[];
}
