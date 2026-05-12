#!/usr/bin/env bash

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT_ROOT="$(cd "$ROOT_DIR/../.." && pwd)"
DEFAULT_COMPOSE_FILE="$ROOT_DIR/docker-compose.yml"
COMPOSE_FILE="${COMPOSE_FILE:-$DEFAULT_COMPOSE_FILE}"
ENV_FILE="${ENV_FILE:-$PROJECT_ROOT/.env}"
STATE_FILE="${STATE_FILE:-$ROOT_DIR/runtime/release-state.env}"

DOCKER_BIN="${DOCKER_BIN:-docker}"

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

docker_cmd() {
  if "$DOCKER_BIN" version >/dev/null 2>&1; then
    "$DOCKER_BIN" "$@"
    return 0
  fi

  if command -v sudo >/dev/null 2>&1 && sudo -n "$DOCKER_BIN" version >/dev/null 2>&1; then
    sudo "$DOCKER_BIN" "$@"
    return 0
  fi

  echo "当前用户无法直接执行 docker，请先确认 Docker 已安装，或为当前用户授予 docker 权限。"
  exit 1
}

compose_cmd() {
  docker_cmd compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
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
  mkdir -p "$(dirname "$STATE_FILE")"

  if [ ! -f "$STATE_FILE" ]; then
    cat >"$STATE_FILE" <<'EOF'
CURRENT_APP_IMAGE_TAG=
PREVIOUS_APP_IMAGE_TAG=
LAST_DEPLOYED_TAG=
LAST_DEPLOYED_AT=
LAST_ARCHIVE_PATH=
LAST_ROLLED_BACK_AT=
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

write_state() {
  cat >"$STATE_FILE" <<EOF
CURRENT_APP_IMAGE_TAG="${CURRENT_APP_IMAGE_TAG:-}"
PREVIOUS_APP_IMAGE_TAG="${PREVIOUS_APP_IMAGE_TAG:-}"
LAST_DEPLOYED_TAG="${LAST_DEPLOYED_TAG:-}"
LAST_DEPLOYED_AT="${LAST_DEPLOYED_AT:-}"
LAST_ARCHIVE_PATH="${LAST_ARCHIVE_PATH:-}"
LAST_ROLLED_BACK_AT="${LAST_ROLLED_BACK_AT:-}"
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
