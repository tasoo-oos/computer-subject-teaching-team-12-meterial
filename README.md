# 내 첫 월급, 1년 살아 보기 — 수업용 가계부 시뮬레이션

고등학생이 첫 월급을 받은 사회초년생이 되어 목적별 계좌로 가계부를 짜고, 12개월을 시뮬레이션하는 수업용 웹앱입니다. 디자인 시안 3종을 비교해 **통장 정리(src1)**를 채택했고, 그 시안을 `src/` 앱으로 통합했습니다.

- 기획서: [`가계부-시나리오-수업-기획서.md`](./가계부-시나리오-수업-기획서.md)
- 수업 모드 계획: [`docs/live-classroom-plan.md`](./docs/live-classroom-plan.md)
- 수업 모드 구현 계약: [`docs/live-api.md`](./docs/live-api.md)
- 모듈 API: [`docs/core-api.md`](./docs/core-api.md)
- 앱 디자인: [`src/DESIGN.md`](./src/DESIGN.md)
- 시안 비교 기록: [`docs/design-review.md`](./docs/design-review.md) · 시안 요구사항(비교 단계 기록): [`docs/design-brief.md`](./docs/design-brief.md)

## 수업 모드 (실시간 수업)

교사가 통제 페이지에서 넘기면 반 전체가 항상 같은 단계에 있는 중앙 통제식 수업 모드입니다. 학생은 자기 속도로 넘기지 않고, 제출 뒤에는 대기 화면을 봅니다.

| 페이지 | 주소 | 기기 | 역할 |
| --- | --- | --- | --- |
| 학생 | `/<숫자 4자리 수업 코드>` (예: `/4821`) | 학생 노트북·태블릿·휴대폰 (최대 60명) | 슬라이드 보기, 게임 조작, 제출 뒤 대기 |
| 전면 | `/stage` (전면 비밀번호) | 교실 TV (교사 PC 확장 화면) | 슬라이드, 장면, 익명 선택 분포, 발표 |
| 통제 | `/control` (통제 비밀번호) | 교사 PC | 수업 열기·끝내기, 다음/이전, 결과 공개, 완료 인원, 발표자 지정, CSV |

수업은 이렇게 흘러갑니다.

1. 교사가 `/control`에서 **수업 열기** → 서버가 4자리 코드를 발급합니다.
2. 학생에게 링크(`https://gagyebu.taesoo.uk/<코드>`)를 메신저로 뿌리거나, TV 입장 화면의 **QR**로 들어오게 합니다. 닉네임을 입력하면 입장입니다.
3. 교사가 통제 페이지의 **다음**(→ / Space / PageDown — 발표용 클리커 호환)으로 진행합니다. 학생이 제출을 마치면 대기 화면, 완료 인원은 통제 페이지에 실시간으로 쌓입니다.
4. 장면 선택 뒤 교사가 **공개(reveal)**를 누르면 TV에 익명 선택 분포가 나옵니다(설문 답·성향은 TV에 안 나옵니다).
5. 결산 뒤 **발표자를 지정**하면 TV에 그 학생의 발표용 크게 보기가 뜹니다.
6. **수업 끝내기** 뒤 통제 페이지에서 **CSV**로 선택 기록을 내려받습니다.

### 빠른 시작 (운영)

```bash
cp .env.example .env
# .env에서 세 값을 채운다: STAGE_PASSWORD, CONTROL_PASSWORD (서로 다르게), COOKIE_SECRET (32자 이상)
pnpm install
pnpm build
pnpm server        # http://localhost:8091 — 게임 서버가 src/dist까지 혼자 맡는다
```

### 개발 환경 (프로세스 둘)

포트 체계: **운영 = 게임 서버 단독 8091. 개발 = 게임 서버 8092 + Vite**가 `/socket.io`·`/api`를 `GAME_PORT`(기본 8092)로 넘깁니다.

```bash
# ① 게임 서버 (8092) — .env 옆에 .env.dev를 만들어 PORT=8092, NODE_ENV=development 두 줄을 넣는다
pnpm server:dev

# ② Vite 개발 서버 — 둘 중 하나
pnpm dev           # http://localhost:5173 (내 컴퓨터에서만)
pnpm dev:public    # http://<LAN IP>:8091 (같은 네트워크 기기·프록시 공개용)
```

- Vite 두 설정(`src/vite.config.ts`, `scripts/dev-public.config.ts`) 모두 `GAME_PORT`(기본 8092)로 프록시합니다. 게임 서버를 다른 포트에 뒀으면 `GAME_PORT=<포트>`를 함께 지정합니다.
- 개발 중 Vite는 모든 경로를 앱으로 돌려줍니다. 알려진 경로만 200을 주는 404 정책(`/contorl` 같은 오타 방지)은 배포 서버의 규칙입니다.

### 테스트

```bash
pnpm test          # vitest: core, live, activity-gagyebu, server
pnpm shots         # 27개 스냅숏 × 화면 크기 스크린숏 → shots/ (자체 Vite를 띠고 /dev에서 찍는다)

# 봇 60명 리허설 (환경은 이미 떠 있다고 가정)
pnpm bots -- --code 4821 --n 60 --lazy 0.1 --auto-next --control-password <통제 비밀번호>

# LAN 공개 봇 리허설 — 게임 서버(8092)와 Vite(8091)가 없으면 직접 띄우고, 끝나면 정리한다
pnpm bots:public --code 4821 --n 60 --lazy 0.1 --auto-next --control-password <통제 비밀번호>

# 수업을 아직 안 열었으면 --open-class: 이 스크립트가 수업을 열고 발급 코드로 봇을 돌린다
pnpm bots:public --open-class --n 60 --lazy 0.1 --auto-next --control-password <통제 비밀번호>
```

- `--lazy 0.1`: 10% 봇은 아무 행동도 안 해서 기본값(자동) 처리를 검증합니다.
- `--auto-next`: 교사 "다음"도 스크립트가 대신 누릅니다(통제 비밀번호 필요).
- `pnpm bots`는 `localhost:8091`로 붙습니다. `pnpm bots:public`은 이 컴퓨터의 LAN IPv4(`10.10.2.23`)로 `http://<LAN IP>:8091`에 붙습니다 — 다른 기기에서 접속하는 것과 같은 주소로 리허설합니다.
- `bots:public`은 **환경을 직접 열 수 있습니다**: 게임 서버(`GAME_PORT`, 기본 8092)와 LAN 공개 Vite(`PORT`, 기본 8091)가 없으면 띄우고, 이미 떠 있으면 그대로 씁니다. 이 스크립트가 띄운 프로세스만 끝날 때(Ctrl-C 포함) 정리합니다. 전제는 `.env`(`STAGE_PASSWORD`·`CONTROL_PASSWORD`·`COOKIE_SECRET`)와 `.env.dev`(`PORT=8092`, `NODE_ENV=development`)입니다.
- 8091에 Vite가 아닌 다른 서버(운영 게임 서버 등)가 떠 있으면 봇을 붙이지 않고 멈춥니다. 포트가 다르면 `PORT=<포트> GAME_PORT=<포트> pnpm bots:public …`처럼 지정합니다.
- `--open-class`는 통제 비밀번호로 로그인해 수업을 열고, 발급된 코드와 학생·TV 주소(`http://<LAN IP>:8091/`)를 로그에 남깁니다. 이미 연 수업에 붙이려면 `--code`를 쓰세요.
- 서버에 붙지 못하면(주소 오류·서버 꺼짐) 원인을 한 번만 알려 주고 종료 코드 1로 끝납니다(봇마다 실패 줄을 쏟지 않습니다). `--code`가 열려 있지 않으면 `수업 …가 열려 있지 않습니다`로 알려 줍니다.

### 배포 (기존 리버스 프록시 그대로)

- 프록시: Nginx Proxy Guard, 호스트 `gagyebu.taesoo.uk` → 게임 서버 `10.10.2.23:8091`. **WebSocket on**, 타임아웃 24시간, 버퍼링 off, WAF off.
- `.env`: `PORT=8091`, `TRUSTED_PROXY=10.10.2.21`(프록시에서 온 요청만 `X-Forwarded-For` 신뢰).
- 실행: tmux 세션으로 띄운다.

```bash
# 주의: 개발 세션 gagyebu-dev(Vite)가 8091을 쓰고 있다. 먼저 끈다(같은 포트 충돌).
tmux kill-session -t gagyebu-dev
tmux new-session -d -s gagyebu-live -c <이 저장소 경로> 'node --env-file=.env server/src/main.ts'
```

### 주소 (서버 라우트)

| 주소 | 화면 | 접근 |
| --- | --- | --- |
| `/` | 수업 코드 입력 | 누구나 |
| `/<4자리>` | 학생 (닉네임 입력부터) | 누구나. 진행 중인 수업 코드만 |
| `/stage` | 전면 TV | 전면 비밀번호 |
| `/control` | 통제 | 통제 비밀번호 |
| `/dev` | 스냅숏 셸 (`pnpm shots`) | 통제 비밀번호 |
| `/solo` | 혼자 하기 (네트워크 장애 시 비상용) | `SOLO_ENABLED=true`일 때만 |
| `/api/login`·`/api/logout`·`/api/me` | 로그인·세션 확인 | — |
| `/api/export/<코드>.csv` | 선택 기록 CSV | 통제 비밀번호 |
| 그 외 | 404 (오타 경로가 학생 화면이 되지 않게) | — |

### 데이터·로그

- `DATA_DIR/sessions/<코드>/log.jsonl` — 수업 하나의 이벤트 로그(입장, 행동, 자동 처리, 커서, 종료). 서버가 재시작되면 이 로그를 재생해 수업을 복원합니다.
- `DATA_DIR/ended.json` — 끝난 수업 코드 목록(48시간 동안 코드 재사용 금지).
- `.env`, `data/`는 git 관리 밖(`.gitignore`)입니다.

### 운영 체크리스트

**수업 전**

- [ ] `.env` 확인: 두 비밀번호가 서로 다른지, `COOKIE_SECRET`이 32자 이상인지. 비밀번호를 바꾸면 기존 로그인이 모두 풀린다(의도된 동작).
- [ ] `pnpm build`로 `src/dist`를 최신으로. `pnpm server` 기동 후 `/stage`·`/control` 로그인 확인.
- [ ] 수업 열기 → 코드 확인 → TV 입장 화면에 QR·주소가 크게 뜨는지.
- [ ] 내 노트북·휴대폰으로 학생 링크 접속 1회(입장→제출→재접속) 확인.

**수업 중**

- [ ] 완료 인원을 보고 "다음". 미완료가 있으면 확인 대화상자가 뜬다 — 기본 선택지로 넘길지 정한다.
- [ ] 장면 선택 뒤 "공개"로 TV에 분포. 발표자는 통제 페이지에서 지정.
- [ ] **서버가 재시작돼도 당황하지 않는다**: 학생 화면은 자동 재접속되고, 서버는 로그를 재생해 그대로 이어간다. 서버만 다시 켜면 된다.
- [ ] **와이파이가 죽으면**: `SOLO_ENABLED=true`로 서버를 다시 켜고 학생에게 `/solo`(혼자 하기)를 안내한다. 실시간 진행은 포기하되 수업 자체는 끝까지 할 수 있다.

**수업 후**

- [ ] 수업 끝내기 → 통제 페이지에서 CSV 내려받기.
- [ ] 필요하면 `DATA_DIR/sessions/<코드>/` 백업.
- [ ] 리허설 기록: 기본 선택지 수치 조정(지금은 기본값만 고른 학생이 늘 '빚과의 동거'로 끝난다), 기기·네트워크 문제 메모.

## 구조

```
packages/core               화면과 무관한 타입·데이터·계산·엔진 (step 구현됨)
packages/live               수업 모드 플랫폼 공용: 레슨·비트·커서 타입, 프로토콜 (React 없음)
packages/activity-gagyebu   가계부 활동의 순수 로직: 비트, 진행 판정, 기본값, 집계
packages/draft-kit          스냅숏 네비게이터 개발 셸 (/dev)
server                      Node 24 서버: Socket.IO, Room, 세션 로그, 비밀번호 로그인, 정적 파일
lesson                      수업 콘텐츠: 세그먼트 순서·설정, 슬라이드 매니페스트
src                         화면 앱 (Vite + React + TypeScript + Tailwind CSS) — '통장 정리' 디자인
scripts                     스크린숏, 봇, 단일 HTML 빌드, 외부 공개용 개발 설정
docs                        설계 문서
```

## 명령

```bash
pnpm install
pnpm dev               # Vite 개발 서버 (5173) — 게임 서버(8092) 프록시
pnpm server            # 게임 서버 (PORT, 기본 8091) — .env 필요
pnpm server:dev        # 게임 서버 개발용 — .env + .env.dev(예: PORT=8092)

pnpm typecheck         # 전체 타입 검사
pnpm build             # 전체 빌드 (src/dist/)
pnpm test              # 전체 테스트 (vitest)

pnpm single            # 단일 HTML 파일 → single/index.html
pnpm shots             # 27개 스냅숏 × 3크기 스크린숏 → shots/
pnpm shots --viewports=laptop,tablet
pnpm shots --only=sim-feb-scene,result-present
```

## 스냅숏 보기

목업 스냅숏 27개는 개발 도구 `/dev`(통제 비밀번호 뒤)에서 봅니다. 주소 해시로 바로 열 수 있습니다.

```
http://localhost:5173/dev#/sim-feb-scene
http://localhost:5173/dev#/result-present
```

- 오른쪽 아래 버튼(또는 `` ` `` 키)으로 스냅숏 목록을 열고, `[` `]` 키로 넘깁니다.
- 목업 데이터는 `packages/core/src/fixtures.ts`에 있습니다. 등장인물은 하늘(균형형)과 바다(즉흥형)입니다.
- `?shot`을 붙이면 네비게이터가 숨겨집니다(스크린숏용). `pnpm shots`는 로그인 없이 자체 Vite 서버로 찍습니다.

## 단일 HTML 파일

```bash
pnpm single
```

`single/index.html` 하나만 있으면 서버 없이 브라우저로 열립니다. 자바스크립트, CSS, 폰트(woff2)가 모두 안에 들어 있습니다. 파일이 커지는 이유는 대부분 한글 웹폰트입니다(약 7MB). 폰트를 시스템 폰트로 바꾸면 1MB 안팎까지 줄어듭니다. 목업 셸로만 동작합니다(실시간 수업 아님).

## 상태

- 수업 모드(M1~M8) 구현됨 — 브랜치 `feat/live-classroom`. 세 페이지(학생·전면·통제), 서버, 봇 리허설까지 동작한다.
- 시뮬레이션 엔진 `step()` 구현 완료. 화면은 `dispatch(action)` → 서버/엔진 상태 전이로 진행된다.
- 남은 것: M0 실제 기기 확인(노트북·휴대폰·학교 와이파이에서 재접속), M9 팀 리허설, 기본 선택지 수치 조정.
