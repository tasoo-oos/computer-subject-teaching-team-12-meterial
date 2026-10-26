# src2 · 시안 방향: "통장 덱 (Account Deck)"

> 작업 중 초안. 화면을 채운 뒤 마지막에 다듬는다.

## 콘셉트

여섯 통장을 한 벌의 "덱"처럼 다룬다. 계좌마다 고유한 색과 아이콘을 가진 카드가 되고, 1년은 로그라이크의 "런 맵"(12칸 노드)으로 펼쳐진다.
매달 장면 카드가 뒤집히고, 학생은 행동 카드(선택지) 한 장을 내고, 어느 통장 카드에서 돈을 꺼낼지 고른다.
겉은 게임 HUD(어두운 상단 바, 노드형 월 진행, 상태 효과 칩)지만 숫자는 금융 앱처럼 IBM Plex 숫자, 표 정렬, 부호와 단위가 분명한 표기로 보여 준다.

## 스킬 결과에서 정한 것 (요약)

- `--design-system` 두 번 실행. 1차("gamified personal finance education...")는 Glassmorphism + Caveat/Quicksand(한글 미지원)라 버리고,
  2차("fintech banking app gamified", variance 6 / motion 5 / density 7)는 Minimalism & Swiss + IBM Plex Sans, "Playful design" 회피를 권했다.
- `--domain product`: Educational App → Claymorphism + Micro-interactions, Personal Finance Tracker → 차분한 파랑 + 성공 초록 + 경고 빨강.
- 결론: 금융 쪽 Swiss 정밀함을 뼈대로 하고, 교육 앱 쪽 "부드러운 두께감(라운드 16~20px, 이중 그림자, 짧은 눌림 반응)"을 카드에만 절제해서 쓴다.
- 서체: `--domain typography "korean sans serif"` → Noto Sans KR. 숫자는 IBM Plex Sans(tabular figures). 모두 @fontsource로 번들.
