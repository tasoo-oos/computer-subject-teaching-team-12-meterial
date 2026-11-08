// 시험용 덱(sample)의 슬라이드 렌더 컴포넌트 (docs/live-api.md §2.2, M8).
// 데이터 매니페스트는 lesson/decks/sample.ts(서버 안전), 여기는 클라이언트 전용 렌더다.
// SlideCanvas는 1920×1080 논리 좌표를 그리고 통째로 축소하므로 안의 크기는 논리 px로 쓴다.
import type { ComponentType } from 'react';

/** 슬라이드 공통 바탕: 통장 용지 질감 + 여백. 표시기에는 조작 요소가 없다(§10.4) */
function Slide({ children }: { children: React.ReactNode }) {
  return <div className="paper-texture relative flex size-full flex-col justify-center px-[140px] py-[110px]">{children}</div>;
}

function Kicker({ children }: { children: React.ReactNode }) {
  return <p className="text-[26px] font-semibold text-ink-2">{children}</p>;
}

function Title({ children }: { children: React.ReactNode }) {
  return <h1 className="display mt-4 text-[104px] leading-[1.08]">{children}</h1>;
}

/** 인사 슬라이드: 환영 인사와 수업 규칙 안내 */
export function HelloSlide() {
  return (
    <Slide>
      <Kicker>가계부 시뮬레이션 수업</Kicker>
      <Title>
        첫 월급으로
        <br />
        1년을 살아 보기
      </Title>
      <p className="mt-8 max-w-[26em] text-[34px] leading-relaxed font-medium text-ink-2">
        오늘 여러분은 사회 첫 월급을 받은 1년 차 직원이 됩니다. 월급을 나누고, 매달 생기는 일을 하나씩 직접 결정합니다.
      </p>
      <p className="mt-10 inline-flex items-center gap-3 self-start rounded-[10px] bg-mark/70 px-6 py-4 text-[28px] font-semibold">
        선생님이 알려 주는 4자리 코드로 수업에 들어와 주세요
      </p>
    </Slide>
  );
}

/** 왜 가계부인가: steps 3 → 비트마다 항목 하나씩 드러난다(step 0..2 = 항목 0..step) */
const WHY_ITEMS: [string, string][] = [
  ['같은 월급, 다른 1년', '월급은 누구나 비슷하게 받아요. 1년 뒤 통장이 달라지는 이유는 매달의 선택에 있어요.'],
  ['선택은 기록이 됩니다', '오늘 고른 하나하나가 통장에 한 줄씩 찍혀요. 12월에 다시 읽어 보면 내 결정 스타일이 보입니다.'],
  ['직접 겪는 12개월', '그래프가 아니라 내 통장으로 확인합니다. 예금·부채·만족도가 어떻게 쌓이는지 1년 안에 보게 돼요.'],
];

export function WhySlide({ step }: { step: number }) {
  const shown = WHY_ITEMS.slice(0, Math.min(step + 1, WHY_ITEMS.length));
  return (
    <Slide>
      <Kicker>오늘 수업의 첫 질문</Kicker>
      <Title>왜 가계부인가?</Title>
      <ul className="mt-10 grid gap-6">
        {shown.map(([title, body], i) => (
          <li key={title} className="sheet-in flex items-start gap-6 border-b border-rule-soft pb-6">
            <span className="num flex-none text-[40px] font-bold text-ink-3">{i + 1}</span>
            <div>
              <p className="text-[38px] leading-snug font-bold">{title}</p>
              <p className="mt-2 max-w-[34em] text-[28px] leading-relaxed text-ink-2">{body}</p>
            </div>
          </li>
        ))}
      </ul>
    </Slide>
  );
}

/** 게임 규칙 슬라이드 */
const RULES: [string, string][] = [
  ['12개월 시뮬레이션', '1월은 연습, 2월부터 12월까지 매달 월급이 들어옵니다.'],
  ['매달 장면과 선택', '돌발 상황이 생기면 장면 카드가 나와요. 어느 돈을 쓸지 직접 고릅니다.'],
  ['정답 힌트는 없어요', '선택지마다 결과가 다를 뿐 정답 표시는 없어요. 내 기준으로 고르고 결과를 봅니다.'],
  ['공개는 선생님이', '친구들의 선택 결과는 선생님이 공개할 때 함께 보여요. 그때까지는 내 선택만 봅니다.'],
];

export function RulesSlide() {
  return (
    <Slide>
      <Kicker>게임 규칙</Kicker>
      <Title>12개월, 매달 장면과 선택</Title>
      <ul className="mt-10 grid grid-cols-2 gap-x-14 gap-y-8">
        {RULES.map(([title, body]) => (
          <li key={title} className="rounded-panel bg-sheet px-8 py-7 shadow-[0_0_0_1px_var(--color-rule)]">
            <p className="text-[32px] font-bold">{title}</p>
            <p className="mt-2 text-[26px] leading-relaxed text-ink-2">{body}</p>
          </li>
        ))}
      </ul>
    </Slide>
  );
}

/** `${deckId}/${slideId}` → 렌더 컴포넌트 (registry.tsx가 흡수한다) */
export const sampleSlides: Record<string, ComponentType<{ step: number }>> = {
  'sample/hello': HelloSlide,
  'sample/why': WhySlide,
  'sample/rules': RulesSlide,
};
