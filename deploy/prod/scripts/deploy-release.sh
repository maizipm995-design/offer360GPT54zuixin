#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/../../.env}"
APP_IMAGE_TAG="${APP_IMAGE_TAG:-${1:-}}"

if [ -z "$APP_IMAGE_TAG" ]; then
  echo "请通过 APP_IMAGE_TAG 环境变量或脚本第一个参数传入本次发布的镜像标签。"
  exit 1
fi

# shellcheck disable=SC1091
source "$SCRIPT_DIR/common.sh"

ensure_commands docker curl
load_env
load_state

ACTIVE_SLOT="${ACTIVE_SLOT:-blue}"
BLUE_IMAGE_TAG="${BLUE_IMAGE_TAG:-bootstrap}"
GREEN_IMAGE_TAG="${GREEN_IMAGE_TAG:-bootstrap}"

current_active_tag="$(image_tag_for_slot "$ACTIVE_SLOT")"
if [ -z "$current_active_tag" ] || [ "$current_active_tag" = "bootstrap" ]; then
  target_slot="${INITIAL_SLOT:-blue}"
else
  target_slot="$(other_slot "$ACTIVE_SLOT")"
fi

if [ "$target_slot" = "blue" ]; then
  BLUE_IMAGE_TAG="$APP_IMAGE_TAG"
else
  GREEN_IMAGE_TAG="$APP_IMAGE_TAG"
fi

export BLUE_IMAGE_TAG GREEN_IMAGE_TAG
export MIGRATION_IMAGE_TAG="$APP_IMAGE_TAG"

echo "开始发布镜像标签：$APP_IMAGE_TAG"
echo "当前激活槽位：$ACTIVE_SLOT"
echo "目标槽位：$target_slot"

compose_cmd up -d mysql redis elasticsearch gateway
ENV_FILE="$ENV_FILE" bash "$SCRIPT_DIR/backup-db.sh"
if [ "${SKIP_PULL:-0}" != "1" ]; then
  compose_cmd pull migrator "wechat-pay-gateway-$target_slot" "api-$target_slot" "web-$target_slot"
fi
compose_cmd run --rm migrator
compose_cmd up -d "wechat-pay-gateway-$target_slot" "api-$target_slot" "web-$target_slot"

wait_for_http "http://127.0.0.1:$(api_port_for_slot "$target_slot")/healthz" "API(${target_slot})" 40 5
wait_for_http "http://127.0.0.1:$(web_port_for_slot "$target_slot")/healthz" "Web(${target_slot})" 40 5

render_active_upstream "$target_slot"
compose_cmd exec -T gateway nginx -s reload
wait_for_http "http://127.0.0.1:${GATEWAY_HTTP_PORT:-18080}/__gateway_health" "Gateway" 20 3

ACTIVE_SLOT="$target_slot"
LAST_DEPLOYED_TAG="$APP_IMAGE_TAG"
LAST_DEPLOYED_AT="$(date '+%Y-%m-%d %H:%M:%S %z')"
write_state

cat <<EOF
发布成功：
- 镜像标签：$APP_IMAGE_TAG
- 当前激活槽位：$ACTIVE_SLOT
- 蓝槽镜像：$BLUE_IMAGE_TAG
- 绿槽镜像：$GREEN_IMAGE_TAG
- 外部入口：${WEB_APP_BASE_URL}
EOF
