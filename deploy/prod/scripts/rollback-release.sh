#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/../../.env}"
ROLLBACK_TAG="${ROLLBACK_TAG:-${1:-}}"

# shellcheck disable=SC1091
source "$SCRIPT_DIR/common.sh"

ensure_commands docker curl
load_env
load_state

if [ -z "$ROLLBACK_TAG" ]; then
  ROLLBACK_TAG="${PREVIOUS_APP_IMAGE_TAG:-}"
fi

if [ -z "$ROLLBACK_TAG" ]; then
  echo "没有可回滚的上一版本镜像标签。"
  exit 1
fi

current_tag="${CURRENT_APP_IMAGE_TAG:-}"
export APP_IMAGE_TAG="$ROLLBACK_TAG"

echo "开始回滚到镜像标签：$ROLLBACK_TAG"

compose_cmd up -d mysql redis elasticsearch
compose_cmd up -d --force-recreate wechat-pay-gateway api web

wait_for_http "http://127.0.0.1:${API_PORT_HOST:-4000}/healthz" "API" 40 5
wait_for_http "http://127.0.0.1:${WEB_PORT_HOST:-3000}/healthz" "Web" 40 5

PREVIOUS_APP_IMAGE_TAG="${current_tag:-}"
CURRENT_APP_IMAGE_TAG="$ROLLBACK_TAG"
LAST_ROLLED_BACK_AT="$(date '+%Y-%m-%d %H:%M:%S %z')"
write_state

cat <<EOF
回滚成功：
- 当前镜像：$ROLLBACK_TAG
- 可再次回退到：${PREVIOUS_APP_IMAGE_TAG:-无}
EOF
