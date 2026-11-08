// 수업 모드 공용 타입 (docs/live-api.md §4.1, §2.2).
// 이 패키지는 @gagyebu/core를 import하지 않는다(§1.2). React·DOM·Node 전용 API도 금지.

/** 수업 코드. 숫자 4자리 ("4821"). 학생 주소는 /<code> */
export type ClassCode = string;

/** 덱 매니페스트의 슬라이드 한 장 (데이터만 — 렌더 컴포넌트는 클라이언트 레지스트리, §2.2) */
export interface SlideManifest {
  id: string;
  /** 통제 타임라인에 표시할 라벨. 없으면 슬라이드 id */
  label?: string;
  /** 한 장 안에서 항목을 하나씩 드러내는 단계 수. 없으면 1비트 */
  steps?: number;
  /** 발표자 노트 (통제 페이지에만 표시) */
  notes?: string;
}

/** 슬라이드 덱 매니페스트 (서버 안전 데이터) */
export interface DeckManifest {
  id: string;
  title: string;
  slides: SlideManifest[];
}

/** 교사가 "다음"을 눌러 넘기는 한 칸 */
export interface Beat {
  /** 세그먼트 안에서 유일. 예: 'survey', 'guide-3', 'm2', 'why--1' */
  id: string;
  /** 통제 타임라인 표시 */
  label: string;
  mode: 'show' | 'work';
  /** 공개 토글이 있는 비트 (work에만 붙는다) */
  reveal?: boolean;
  /** 발표자 노트 (통제 페이지에만) */
  notes?: string;
}

/** 비트 주소: 세그먼트 인덱스 + 세그먼트 안 비트 인덱스. 전역 인덱스는 서버가 평탄화해서만 계산한다 */
export interface BeatRef {
  segment: number;
  beat: number;
}

export interface Cursor {
  segment: number;
  beat: number;
  revealed: boolean;
}

export type ClassStatus = 'open' | 'ended';

export interface LessonSettings {
  /** 공개 전 응답 중 완료 인원을 TV에도 보일지. 기본 false (통제 페이지에만) */
  showProgressOnStage: boolean;
}

export type Segment =
  | { kind: 'slides'; id: string; deck: DeckManifest }
  | { kind: 'activity'; id: string; activity: string; config: unknown };

export interface Lesson {
  id: string;
  title: string;
  settings: LessonSettings;
  segments: Segment[];
}

export interface ClassState {
  code: ClassCode;
  status: ClassStatus;
  /** 변경마다 +1. 모든 서버→클라이언트 메시지에 실려 낡은 메시지를 버리는 기준 */
  version: number;
  lessonId: string;
  cursor: Cursor;
  /** 가장 멀리 간 적 있는 비트 = "live 비트". 진행·집계는 항상 이 비트 기준 */
  highMark: BeatRef;
  /** highMark 비트의 공개 상태. 리뷰에서 돌아올 때 복원한다 */
  highRevealed: boolean;
  spotlight: string | null; // 발표자 studentId
  joinLocked: boolean;
}

export interface ProgressInfo {
  done: number;
  connected: number;
  total: number;
}

export interface RosterEntry {
  studentId: string;
  nickname: string;
  connected: boolean;
  /** 현재 비트 완료 여부 */
  done: boolean;
  /** 지각 합류 (들어올 때 과거 작업 비트를 기본값으로 채움) */
  late: boolean;
  device: 'laptop' | 'tablet' | 'phone';
  /** 활동이 주는 "지금 있는 장면" 짧은 문구 (미완료 명단용). 없으면 null */
  scene: string | null;
  /** 기본값 루프 50회 초과로 멈춘 학생(§4.2). 이후 비트에서 done이 되면 다시 false */
  stalled: boolean;
  /** 기록 이어받기 승인 대기 중인 새 접속 */
  pendingMerge: boolean;
}
