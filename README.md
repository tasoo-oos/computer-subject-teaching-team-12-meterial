# 내 첫 월급, 1년 살아 보기 — 수업용 가계부 시뮬레이션

고등학생이 첫 월급을 받은 사회초년생이 되어 목적별 계좌로 가계부를 짜고, 12개월을 시뮬레이션하는 수업용 웹앱입니다. 지금 단계는 **디자인 시안 3종 비교**입니다.

- 기획서: [`가계부-시나리오-수업-기획서.md`](./가계부-시나리오-수업-기획서.md)
- 모듈 API: [`docs/core-api.md`](./docs/core-api.md)
- 시안 요구사항: [`docs/design-brief.md`](./docs/design-brief.md)
- 시안 비교: [`docs/design-review.md`](./docs/design-review.md)

## 구조

```
packages/core       화면과 무관한 타입·데이터·계산 (엔진 step은 미구현)
packages/draft-kit  시안 비교용 셸과 스냅숏 네비게이터
src1 src2 src3      디자인 시안 3종 (Vite + React + TypeScript + Tailwind CSS)
scripts             스크린숏, 정적 서버, 외부 공개용 개발 설정
docs                설계 문서
```

## 명령

```bash
pnpm install
pnpm dev:1            # 시안 1 (5171), dev:2 (5172), dev:3 (5173)

pnpm typecheck        # 전체 타입 검사
pnpm build            # 전체 빌드 (dist/)

pnpm single           # 단일 HTML 파일 3개 → single/src1.html, src2.html, src3.html
pnpm shots src1       # 27개 스냅숏 × 3크기 스크린숏 → shots/src1/
pnpm shots src2 --viewports=laptop,tablet
pnpm shots src1 --only=sim-feb-scene,result-present
```

## 스냅숏 보기

각 시안은 목업 스냅숏 27개를 화면으로 그립니다. 주소 해시로 바로 열 수 있습니다.

```
http://localhost:5171/#/sim-feb-scene
http://localhost:5171/#/result-present
```

- 오른쪽 아래 버튼(또는 `` ` `` 키)으로 스냅숏 목록을 열고, `[` `]` 키로 넘깁니다.
- 목업 데이터는 `packages/core/src/fixtures.ts`에 있습니다. 등장인물은 하늘(균형형)과 바다(즉흥형)입니다.
- `?shot`을 붙이면 네비게이터가 숨겨집니다(스크린숏용).

## 단일 HTML 파일

```bash
pnpm single                              # 세 시안 모두
node scripts/build-single.mjs src1       # 하나만
```

`single/srcN.html` 하나만 있으면 서버 없이 브라우저로 열립니다. 자바스크립트, CSS, 폰트(woff2)가 모두 안에 들어 있습니다. 파일이 커지는 이유는 대부분 한글 웹폰트입니다(src1 7.3MB, src2 5.1MB, src3 4.2MB). 폰트를 시스템 폰트로 바꾸면 1MB 안팎까지 줄어듭니다.

## 외부 공개

집 안 네트워크의 다른 기기나 교실에서 볼 때는 `scripts/dev-public.config.ts`로 개발 서버를 띄우고 리버스 프록시를 붙입니다.

```bash
(cd src1 && PORT=8091 pnpm exec vite --config ../scripts/dev-public.config.ts)
node scripts/serve.mjs src1 8091     # 빌드 결과(dist)를 정적으로 서비스
```

## 상태

- 시안 3종 모두 6개 화면, 스냅숏 27개를 그립니다.
- 시뮬레이션 엔진(`step`)은 시그니처만 있고 구현 전입니다. 화면의 입력과 패널은 로컬 상태로 흉내 냅니다.
- 다음 단계: 시안 하나를 고른 뒤 `step(state, action)` 구현, 이벤트 데이터 연결, localStorage 저장, 테스트(Vitest), 배포.
