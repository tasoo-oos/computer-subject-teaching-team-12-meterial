// 통제 상단 수업 패널 (docs/live-api.md §10.6 "수업", 계획 §10).
// 수업 열기(레슨 선택) · 코드 크게 · 학생 링크 복사 · TV 화면 열기 · CSV 내보내기 ·
// 입장 마감 · 수업 끝내기(확인) · 로그아웃 · 열린 수업이 여럿일 때 고르기(select).
import { useState } from "react";
import type { ClassState, OpenClassInfo } from "@gagyebu/live";
import { lesson as defaultLesson, rehearsalLesson } from "@gagyebu/lesson";
import {
  Copy,
  Download,
  Lock,
  LockOpen,
  LogOut,
  Radio,
  Tv,
} from "lucide-react";

/** 수업 열기 레슨 목록. 서버에 /api/lessons가 없어 클라이언트가 @gagyebu/lesson에서 만든다(§14 S6 결정).
 *  openClass(lessonId)의 서버 쪽 유효성 검사와 같은 id 집합이다. */
const LESSONS: { id: string; title: string }[] = [
  { id: defaultLesson.id, title: defaultLesson.title },
  { id: rehearsalLesson.id, title: rehearsalLesson.title },
];

export interface ClassPanelProps {
  classes: OpenClassInfo[];
  classState: ClassState | null;
  opening: boolean;
  onOpenClass: (lessonId?: string) => void;
  onSelect: (code: string) => void;
  onEndClass: () => void;
  onLockJoin: (on: boolean) => void;
  onLogout: () => void;
}

export function ClassPanel({
  classes,
  classState,
  opening,
  onOpenClass,
  onSelect,
  onEndClass,
  onLockJoin,
  onLogout,
}: ClassPanelProps) {
  const [lessonId, setLessonId] = useState<string>(LESSONS[0]!.id);
  const [copied, setCopied] = useState(false);
  const active = classState && classState.status === "open" ? classState : null;

  const copyLink = async () => {
    if (!active) return;
    try {
      await navigator.clipboard.writeText(`${location.origin}/${active.code}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // 클립보드 권한 거부 — 창을 띄워 수동 복사하게 한다
      window.prompt(
        "학생 링크를 복사해 주세요",
        `${location.origin}/${active.code}`,
      );
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-panel bg-sheet px-4 py-3 shadow-[0_0_0_1px_var(--color-rule)]">
      {active ? (
        <>
          <div className="flex items-baseline gap-3">
            <p className="text-[12px] font-bold text-ink-3">수업 코드</p>
            <p className="display num text-[38px] leading-none">
              {active.code}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="btn btn-quiet h-9 px-3 text-[13px]"
              onClick={() => void copyLink()}
            >
              <Copy size={15} aria-hidden />
              {copied ? "복사됨!" : "학생 링크 복사"}
            </button>
            <button
              type="button"
              className="btn btn-quiet h-9 px-3 text-[13px]"
              onClick={() => window.open("/stage", "_blank", "noopener")}
            >
              <Tv size={15} aria-hidden />
              TV 화면 열기
            </button>
            <a
              className="btn btn-quiet h-9 px-3 text-[13px]"
              href={`/api/export/${active.code}.csv`}
            >
              <Download size={15} aria-hidden />
              CSV 내보내기
            </a>
            <button
              type="button"
              className="btn btn-quiet h-9 px-3 text-[13px]"
              onClick={() => onLockJoin(!active.joinLocked)}
              title={
                active.joinLocked
                  ? "입장이 마감된 상태 — 눌러 허용"
                  : "새 입장을 막으려면 누르세요"
              }
            >
              {active.joinLocked ? (
                <Lock size={15} aria-hidden />
              ) : (
                <LockOpen size={15} aria-hidden />
              )}
              {active.joinLocked ? "입장 마감됨" : "입장 허용 중"}
            </button>
            <button
              type="button"
              className="btn h-9 bg-seal px-3 text-[13px] text-white hover:bg-[#a12229]"
              onClick={onEndClass}
            >
              수업 끝내기
            </button>
          </div>
        </>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {classState ? (
            <p className="text-[13px] font-semibold text-ink-2">
              수업이 끝났어요 ·{" "}
            </p>
          ) : null}
          <select
            value={lessonId}
            onChange={(e) => setLessonId(e.target.value)}
            className="h-9 rounded-[8px] bg-white px-2 text-[13px] font-semibold shadow-[inset_0_0_0_1.5px_var(--color-rule)]"
            aria-label="레슨"
          >
            {LESSONS.map((l) => (
              <option key={l.id} value={l.id}>
                {l.title}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn btn-primary h-9 px-4 text-[13px]"
            disabled={opening}
            onClick={() => onOpenClass(lessonId)}
          >
            {opening ? "여는 중…" : "수업 열기"}
          </button>
        </div>
      )}

      <div className="ml-auto flex flex-wrap items-center gap-2">
        {classes.length > 1 ? (
          <div className="flex items-center gap-1 rounded-[8px] p-1 shadow-[inset_0_0_0_1.5px_var(--color-rule)]">
            {classes.map((c) => (
              <button
                key={c.code}
                type="button"
                onClick={() => onSelect(c.code)}
                className={`num h-7 rounded-[6px] px-2 text-[13px] font-bold ${
                  active?.code === c.code
                    ? "bg-ink text-white"
                    : "text-ink-2 hover:bg-white"
                }`}
                title={`수업 ${c.code} (${c.lessonId}) 보기`}
              >
                {c.code}
              </button>
            ))}
          </div>
        ) : null}
        <button
          type="button"
          className="btn btn-quiet h-9 px-3 text-[13px] text-ink-3"
          onClick={onLogout}
        >
          <LogOut size={15} aria-hidden />
          로그아웃
        </button>
      </div>
    </div>
  );
}

/** 연결 상표 chip (머리글 오른쪽) */
export function StatusChip({ status }: { status: string }) {
  const text: Record<string, string> = {
    connecting: "서버에 연결하는 중…",
    open: "연결됨",
    reconnecting: "다시 연결 중…",
    unauthorized: "로그인 필요",
    error: "연결 오류",
  };
  const bad =
    status === "reconnecting" ||
    status === "error" ||
    status === "unauthorized";
  return (
    <p
      data-testid="role-socket-status"
      className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold ${
        bad ? "bg-seal-soft text-seal" : "bg-white text-ink-2"
      }`}
    >
      <Radio
        size={12}
        aria-hidden
        className={status === "reconnecting" ? "animate-pulse" : ""}
      />
      {text[status] ?? status}
    </p>
  );
}
