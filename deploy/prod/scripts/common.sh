#!/usr/bin/env bash

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT_ROOT="$(cd "$ROOT_DIR/../.." && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-$ROOT_DIR/docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-$PROJECT_ROOT/.env}"
STATE_FILE="${STATE_FILE:-$ROOT_DIR/runtime/release-state.env}"
ACTIVE_UPSTREAM_FILE="${ACTIVE_UPSTREAM_FILE:-$ROOT_DIR/runtime/nginx/active-upstream.conf}"

ensure_commands() {
  local missing=0
  for cmd in "$@"; do
    if ! command -v "$cmd" >/dev/null 2>&1; then
      echo "未检测到命令：$cmd"
      missing=1
    fi
  done
  if [ "$missing" -ne 0 ]; then
    exit 1
  fi
}

compose_cmd() {
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

load_env() {
  if [ ! -f "$ENV_FILE" ]; then
    cp "$PROJECT_ROOT/.env.example" "$ENV_FILE"
    echo "已根据 .env.example 创建 $ENV_FILE，请先补齐生产配置后重试。"
    exit 1
  fi

  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
}

ensure_runtime_layout() {
  mkdir -p "$(dirname "$STATE_FILE")" "$(dirname "$ACTIVE_UPSTREAM_FILE")"

  if [ ! -f "$STATE_FILE" ]; then
    cat >"$STATE_FILE" <<'EOF'
ACTIVE_SLOT=blue
BLUE_IMAGE_TAG=bootstrap
GREEN_IMAGE_TAG=bootstrap
LAST_DEPLOYED_TAG=
LAST_DEPLOYED_AT=
LAST_ROLLED_BACK_AT=
EOF
  fi

  if [ ! -f "$ACTIVE_UPSTREAM_FILE" ]; then
    cat >"$ACTIVE_UPSTREAM_FILE" <<'EOF'
server 127.0.0.1:3001 max_fails=3 fail_timeout=10s;
EOF
  fi
}

load_state() {
  ensure_runtime_layout

  set -a
  # shellcheck disable=SC1090
  source "$STATE_FILE"
  set +a
}

other_slot() {
  if [ "${1:-blue}" = "blue" ]; then
    echo "green"
  else
    echo "blue"
  fi
}

image_tag_for_slot() {
  if [ "${1:-blue}" = "blue" ]; then
    echo "${BLUE_IMAGE_TAG:-bootstrap}"
  else
    echo "${GREEN_IMAGE_TAG:-bootstrap}"
  fi
}

web_port_for_slot() {
  if [ "${1:-blue}" = "blue" ]; then
    echo "${BLUE_WEB_HOST_PORT:-3001}"
  else
    echo "${GREEN_WEB_HOST_PORT:-3002}"
  fi
}

api_port_for_slot() {
  if [ "${1:-blue}" = "blue" ]; then
    echo "${BLUE_API_HOST_PORT:-4001}"
  else
    echo "${GREEN_API_HOST_PORT:-4002}"
  fi
}

render_active_upstream() {
  local slot="${1:-blue}"
  local web_port
  web_port="$(web_port_for_slot "$slot")"

  cat >"$ACTIVE_UPSTREAM_FILE" <<EOF
server 127.0.0.1:${web_port} max_fails=3 fail_timeout=10s;
EOF
}

write_state() {
  cat >"$STATE_FILE" <<EOF
ACTIVE_SLOT=${ACTIVE_SLOT}
BLUE_IMAGE_TAG=${BLUE_IMAGE_TAG}
GREEN_IMAGE_TAG=${GREEN_IMAGE_TAG}
LAST_DEPLOYED_TAG=${LAST_DEPLOYED_TAG:-}
LAST_DEPLOYED_AT=${LAST_DEPLOYED_AT:-}
LAST_ROLLED_BACK_AT=${LAST_ROLLED_BACK_AT:-}
EOF
}

wait_for_http() {
  local url="$1"
  local name="$2"
  local max_attempts="${3:-30}"
  local sleep_seconds="${4:-5}"
  local attempt=1

  while [ "$attempt" -le "$max_attempts" ]; do
    if curl --fail --silent --show-error "$url" >/dev/null 2>&1; then
      echo "${name} 健康检查通过：${url}"
      return 0
    fi
    echo "${name} 健康检查等待中（${attempt}/${max_attempts}）：${url}"
    sleep "$sleep_seconds"
    attempt=$((attempt + 1))
  done

  echo "${name} 健康检查失败：${url}"
  return 1
}
