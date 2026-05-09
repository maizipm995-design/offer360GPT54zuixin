#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/../../.env}"
ROLLBACK_SLOT="${ROLLBACK_SLOT:-${1:-}}"

# shellcheck disable=SC1091
source "$SCRIPT_DIR/common.sh"

ensure_commands docker curl
load_env
load_state

ACTIVE_SLOT="${ACTIVE_SLOT:-blue}"
BLUE_IMAGE_TAG="${BLUE_IMAGE_TAG:-bootstrap}"
GREEN_IMAGE_TAG="${GREEN_IMAGE_TAG:-bootstrap}"

if [ -z "$ROLLBACK_SLOT" ]; then
  ROLLBACK_SLOT="$(other_slot "$ACTIVE_SLOT")"
fi

rollback_tag="$(image_tag_for_slot "$ROLLBACK_SLOT")"
if [ -z "$rollback_tag" ] || [ "$rollback_tag" = "bootstrap" ]; then
  echo "槽位 ${ROLLBACK_SLOT} 没有可回滚的稳定镜像，当前无法回退。"
  exit 1
fi

export BLUE_IMAGE_TAG GREEN_IMAGE_TAG

echo "开始回滚到槽位：$ROLLBACK_SLOT"
echo "目标镜像标签：$rollback_tag"

compose_cmd up -d mysql redis elasticsearch gateway
compose_cmd up -d "wechat-pay-gateway-$ROLLBACK_SLOT" "api-$ROLLBACK_SLOT" "web-$ROLLBACK_SLOT"

wait_for_http "http://127.0.0.1:$(api_port_for_slot "$ROLLBACK_SLOT")/healthz" "API(${ROLLBACK_SLOT})" 40 5
wait_for_http "http://127.0.0.1:$(web_port_for_slot "$ROLLBACK_SLOT")/healthz" "Web(${ROLLBACK_SLOT})" 40 5

render_active_upstream "$ROLLBACK_SLOT"
compose_cmd exec -T gateway nginx -s reload
wait_for_http "http://127.0.0.1:${GATEWAY_HTTP_PORT:-80}/__gateway_health" "Gateway" 20 3

ACTIVE_SLOT="$ROLLBACK_SLOT"
LAST_ROLLED_BACK_AT="$(date '+%Y-%m-%d %H:%M:%S %z')"
write_state

cat <<EOF
回滚成功：
- 当前激活槽位：$ACTIVE_SLOT
- 当前激活镜像：$rollback_tag
- 外部入口：${WEB_APP_BASE_URL}
EOF
