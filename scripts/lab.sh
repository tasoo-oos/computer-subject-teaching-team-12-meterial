#!/usr/bin/env bash
# 수업 모드 실습 환경을 tmux로 열고, 봇 리허설을 돌리는 스크립트.
#
#   scripts/lab.sh up                 # tmux 세션 gagyebu-lab: 게임 서버(8092) + LAN 공개 Vite(8091)
#   scripts/lab.sh status             # 세션·포트·준비 상태
#   scripts/lab.sh logs [server|vite|bots]
#   scripts/lab.sh open               # 수업을 열고 코드를 출력
#   scripts/lab.sh bots --n 60 ...    # 돌고 있는 환경에 봇을 tmux 창에서 실행
#   scripts/lab.sh test --n 60        # up + open + 봇(auto-next)까지 한 번에, 끝나면 요약
#   scripts/lab.sh down               # 이 스크립트가 띄운 세션만 종료
#   scripts/lab.sh attach             # 세션에 들어가기 (나올 때 Ctrl-b d)
#
# 포트: PORT(기본 8091, Vite) / GAME_PORT(기본 8092, 게임 서버). 환경변수나
#       --port/--game-port로 바꾼다. 통제 비밀번호는 --control-password <pw>로 준다
#       (없으면 CONTROL_PASSWORD 환경변수, 그다음 .env).
# 이미 떠 있는 Vite·게임 서버는 재사용하고 건드리지 않는다(다른 tmux 세션 포함).
# 이 스크립트가 만든 세션 이름은 gagyebu-lab 하나뿐이다.
set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
SESSION=${LAB_SESSION:-gagyebu-lab}
RUNDIR=${TMPDIR:-/tmp}/gagyebu-lab
PORT=${PORT:-8091}
GAME_PORT=${GAME_PORT:-8092}

# ── 출력 ────────────────────────────────────────────────────────────────────

c_reset=$'\033[0m'; c_dim=$'\033[2m'; c_bold=$'\033[1m'; c_red=$'\033[31m'; c_green=$'\033[32m'; c_cyan=$'\033[36m'
log()  { printf '%s[lab]%s %s\n' "$c_cyan" "$c_reset" "$*"; }
warn() { printf '%s[lab]%s %s\n' "$c_red" "$c_reset" "$*" >&2; }
die()  { warn "$*"; exit 1; }

# ── 인자 ────────────────────────────────────────────────────────────────────

CMD=${1:-}
[[ $# -gt 0 ]] && shift || true

# --port/--game-port/--control-password는 이 스크립트가 먹고, 나머지는 그대로 아래 명령에 넘긴다.
ARGS=()
while [[ $# -gt 0 ]]; do
  case $1 in
    --port) PORT=$2; shift 2 ;;
    --game-port) GAME_PORT=$2; shift 2 ;;
    --control-password|--password) CONTROL_PASSWORD=$2; shift 2 ;;
    *) ARGS+=("$1"); shift ;;
  esac
done

LAN_IP=$(node -e '
  const os = require("os");
  const a = Object.values(os.networkInterfaces()).flat().find((x) => x && x.family === "IPv4" && !x.internal);
  process.stdout.write(a ? a.address : "localhost");
')
LAN_URL="http://${LAN_IP}:${PORT}"
LOCAL_URL="http://127.0.0.1:${PORT}"

# ── 준비 상태 ───────────────────────────────────────────────────────────────

is_vite()  { curl -sf -o /dev/null --max-time 2 "http://127.0.0.1:${PORT}/@vite/client"; }
is_game()  { curl -sf -o /dev/null --max-time 2 "http://127.0.0.1:${GAME_PORT}/socket.io/?EIO=4&transport=polling"; }
port_used() { curl -sf -o /dev/null --max-time 2 "http://127.0.0.1:${PORT}/"; }

has_session() { tmux has-session -t "$SESSION" 2>/dev/null; }
has_window()  { tmux list-windows -t "$SESSION" -F '#{window_name}' 2>/dev/null | grep -qx "$1"; }
pane_dead()   { [[ $(tmux list-panes -t "$SESSION:$1" -F '#{pane_dead}' 2>/dev/null | head -1) == 1 ]]; }

wait_ready() { # wait_ready <check-fn> <window> <timeout-s> <label>
  local check=$1 window=$2 timeout=$3 label=$4 i=0
  while (( i < timeout * 2 )); do
    if "$check"; then return 0; fi
    if has_window "$window" && pane_dead "$window"; then
      warn "${label} 프로세스가 죽었습니다. 마지막 출력:"
      tmux capture-pane -t "$SESSION:$window" -p 2>/dev/null | grep -v '^$' | tail -12 >&2 || true
      return 1
    fi
    sleep 0.5; (( i++ )) || true
  done
  warn "${label}가 ${timeout}s 안에 준비되지 않았습니다."
  return 1
}

# 우선순위: --control-password 플래그 > CONTROL_PASSWORD 환경변수 > .env
control_password() {
  if [[ -n ${CONTROL_PASSWORD:-} ]]; then printf '%s' "$CONTROL_PASSWORD"; return 0; fi
  grep -m1 '^CONTROL_PASSWORD=' "$ROOT/.env" 2>/dev/null | cut -d= -f2- || true
}

# ── up / down ───────────────────────────────────────────────────────────────

cmd_up() {
  mkdir -p "$RUNDIR"

  if has_session; then
    log "이미 떠 있습니다: tmux 세션 ${c_bold}${SESSION}${c_reset}"
    cmd_status
    return 0
  fi

  # 게임 서버
  if is_game; then
    log "게임 서버 재사용: 127.0.0.1:${GAME_PORT} (이 스크립트가 띄우지 않음)"
  else
    log "게임 서버 시작: 127.0.0.1:${GAME_PORT}"
    tmux new-session -d -s "$SESSION" -n server -c "$ROOT" \
      "PORT=${GAME_PORT} node --env-file=.env --env-file-if-exists=.env.dev server/src/main.ts"
    server_reused=0
    wait_ready is_game server 20 "게임 서버" || { tmux kill-session -t "$SESSION" 2>/dev/null || true; exit 1; }
  fi

  # LAN 공개 Vite
  if is_vite; then
    log "Vite 재사용: 127.0.0.1:${PORT} (이 스크립트가 띄우지 않음)"
  elif port_used; then
    die "${PORT}에 Vite가 아닌 서버가 떠 있습니다(운영 게임 서버일 수 있음). 먼저 끄거나 --port <다른 포트>를 쓰세요."
  else
    log "Vite 시작: 0.0.0.0:${PORT} → 게임 서버 ${GAME_PORT}"
    if has_session; then
      tmux new-window -t "$SESSION" -n vite -c "$ROOT/src" \
        "PORT=${PORT} GAME_PORT=${GAME_PORT} pnpm exec vite --config ../scripts/dev-public.config.ts"
    else
      tmux new-session -d -s "$SESSION" -n vite -c "$ROOT/src" \
        "PORT=${PORT} GAME_PORT=${GAME_PORT} pnpm exec vite --config ../scripts/dev-public.config.ts"
    fi
    wait_ready is_vite vite 25 "Vite" || { tmux kill-session -t "$SESSION" 2>/dev/null || true; exit 1; }
  fi

  tmux set-option -t "$SESSION" remain-on-exit on >/dev/null 2>&1 || true
  printf '\n'
  log "${c_green}환경 열림${c_reset} — ${c_bold}${LAN_URL}${c_reset}"
  log "  학생·TV: ${LAN_URL}/   통제: ${LAN_URL}/control   전면: ${LAN_URL}/stage"
  log "  세션: tmux attach -t ${SESSION}   로그: $0 logs   종료: $0 down"
}

cmd_down() {
  if ! has_session; then
    log "세션 ${SESSION}이(가) 없습니다."
    return 0
  fi
  tmux kill-session -t "$SESSION"
  rm -rf "$RUNDIR"
  log "세션 ${SESSION} 종료 (이 스크립트가 띄운 프로세스만)"
}

cmd_status() {
  if has_session; then
    log "tmux 세션 ${c_bold}${SESSION}${c_reset} — 창: $(tmux list-windows -t "$SESSION" -F '#{window_name}' | paste -sd, -)"
  else
    log "tmux 세션 ${SESSION} 없음"
  fi
  is_game && log "게임 서버: ${c_green}준비${c_reset} 127.0.0.1:${GAME_PORT}" || warn "게임 서버: 없음 (127.0.0.1:${GAME_PORT})"
  if is_vite; then
    log "Vite: ${c_green}준비${c_reset} ${LAN_URL}"
  elif port_used; then
    warn "Vite: ${PORT}에 Vite가 아닌 서버가 있음"
  else
    warn "Vite: 없음 (${PORT})"
  fi
  is_game && is_vite && log "주소: ${c_bold}${LAN_URL}${c_reset}  (통제 ${LAN_URL}/control)"
  return 0
}

cmd_logs() {
  local which=${1:-}
  has_session || die "세션 ${SESSION}이(가) 없습니다. 먼저: $0 up"
  if [[ -z $which ]]; then
    tmux list-windows -t "$SESSION" -F '#{window_name}' | while read -r w; do
      printf '\n%s── %s %s\n' "$c_dim" "$w" "$c_reset"
      tmux capture-pane -t "$SESSION:$w" -p | grep -v '^$' | tail -8
    done
    return 0
  fi
  if ! has_window "$which"; then
    # 봇 창은 끝나면 닫힌다 — 파일로 남긴 로그를 보여 준다.
    if [[ $which == bots && -f $RUNDIR/bots.log ]]; then
      tail -40 "$RUNDIR/bots.log"
      return 0
    fi
    die "${SESSION}에 '${which}' 창이 없습니다."
  fi
  tmux capture-pane -t "$SESSION:$which" -p | grep -v '^$' | tail -40
}

# ── open / bots / test ──────────────────────────────────────────────────────

cmd_open() {
  is_game || die "게임 서버가 없습니다. 먼저: $0 up"
  local pw code
  pw=$(control_password)
  [[ -n $pw ]] || die "통제 비밀번호가 없습니다. --control-password <pw>, CONTROL_PASSWORD=<pw>, 또는 .env의 CONTROL_PASSWORD를 확인하세요."
  code=$(CONTROL_PASSWORD="$pw" node "$ROOT/scripts/open-class.mjs" --url "http://127.0.0.1:${PORT}" --password "$pw") \
    || die "수업을 열지 못했습니다."
  log "수업 열림: 코드 ${c_bold}${code}${c_reset} — ${LAN_URL}/"
  printf '%s\n' "$code"
}

# 봇을 tmux 창에서 돌리고, 끝나면 종료 코드를 파일로 남긴다.
# 인용 문제를 피하려고 실행할 명령을 스크립트 파일로 만들어 bash로 돌린다.
run_bots_window() {
  local -a argv=("$@")
  mkdir -p "$RUNDIR"
  rm -f "$RUNDIR/bots.exit"
  {
    printf '#!/usr/bin/env bash\n'
    printf 'cd %q\n' "$ROOT"
    # 창이 닫혀도 남도록 로그를 파일로도 남긴다(종료 코드는 파이프 앞의 것).
    printf 'node scripts/bots.mjs'
    printf ' %q' "${argv[@]}"
    printf ' 2>&1 | tee %q\n' "$RUNDIR/bots.log"
    printf 'echo ${PIPESTATUS[0]} > %q\n' "$RUNDIR/bots.exit"
  } > "$RUNDIR/bots.sh"
  chmod +x "$RUNDIR/bots.sh"
  if has_window bots; then tmux kill-window -t "$SESSION:bots"; fi
  tmux new-window -t "$SESSION" -n bots -c "$ROOT" "bash '$RUNDIR/bots.sh'"
}

wait_bots() {
  local timeout=${1:-900} i=0
  while [[ ! -f "$RUNDIR/bots.exit" ]]; do
    if ! has_session; then return 1; fi
    sleep 1; (( i++ )) || true
    if (( i > timeout )); then
      warn "봇이 ${timeout}s 안에 끝나지 않았습니다. 로그: $0 logs bots"
      return 1
    fi
  done
  cat "$RUNDIR/bots.exit"
}

cmd_bots() {
  has_session || die "세션이 없습니다. 먼저: $0 up"
  is_game && is_vite || die "환경이 준비되지 않았습니다. $0 status 로 확인하세요."
  [[ ${ARGS[*]:-} == *--code* ]] || die "--code <수업 코드>가 필요합니다(수업을 열려면: $0 open)."
  local -a argv=(--url "$LAN_URL")
  [[ ${ARGS[*]:-} == *--control-password* ]] || argv+=(--control-password "$(control_password)")
  run_bots_window "${argv[@]}" "${ARGS[@]}"
  log "봇 실행 중 — 창: ${SESSION}:bots   로그: $0 logs bots"
  local code
  code=$(wait_bots 900) || exit 1
  tail -12 "$RUNDIR/bots.log" 2>/dev/null || true
  log "봇 종료 코드: ${code}"
  [[ $code == 0 ]] || exit 1
}

cmd_test() {
  cmd_up
  local code
  code=$(cmd_open | tail -1)
  [[ $code =~ ^[0-9]{4}$ ]] || die "수업 코드를 받지 못했습니다."
  log "리허설 시작: 코드 ${code}, 봇 ${ARGS[*]:-기본값}"
  # 기본값을 먼저 깔고 사용자 인자를 뒤에 붙인다(뒤가 이긴다).
  local pw
  pw=$(control_password)
  [[ -n $pw ]] || die "통제 비밀번호가 없습니다. --control-password <pw>, CONTROL_PASSWORD=<pw>, 또는 .env의 CONTROL_PASSWORD를 확인하세요."
  run_bots_window --url "$LAN_URL" --code "$code" --n 60 --lazy 0.1 --auto-next \
    --control-password "$pw" "${ARGS[@]}"
  local rc
  rc=$(wait_bots 1800) || exit 1
  printf '\n'
  tail -20 "$RUNDIR/bots.log" 2>/dev/null || true
  printf '\n'
  log "리허설 종료 코드: ${rc}  (환경은 계속 떠 있습니다 — ${LAN_URL}, 종료: $0 down)"
  [[ $rc == 0 ]] || exit 1
}

cmd_attach() {
  has_session || die "세션 ${SESSION}이(가) 없습니다. 먼저: $0 up"
  exec tmux attach -t "$SESSION"
}

# ── 디스패치 ────────────────────────────────────────────────────────────────

case $CMD in
  up) cmd_up ;;
  down) cmd_down ;;
  restart) cmd_down; cmd_up ;;
  status) cmd_status ;;
  logs) cmd_logs "${ARGS[@]:-}" ;;
  open) cmd_open ;;
  bots) cmd_bots ;;
  test) cmd_test ;;
  attach) cmd_attach ;;
  ''|-h|--help|help)
    awk 'NR > 1 && /^#/ { sub(/^# ?/, ""); print; next } NR > 1 { exit }' "${BASH_SOURCE[0]}"
    ;;
  *) die "모르는 명령: $CMD (up|down|restart|status|logs|open|bots|test|attach)" ;;
esac
