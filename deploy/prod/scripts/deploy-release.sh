#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/../../.env}"
REQUESTED_APP_IMAGE_TAG="${APP_IMAGE_TAG:-${1:-}}"
APP_IMAGE_TAG="$REQUESTED_APP_IMAGE_TAG"
IMAGE_ARCHIVE="${IMAGE_ARCHIVE:-${2:-}}"

if [ -z "$APP_IMAGE_TAG" ]; then
  echo "请通过 APP_IMAGE_TAG 环境变量或脚本第一个参数传入本次发布的镜像标签。"
  exit 1
fi

# shellcheck disable=SC1091
source "$SCRIPT_DIR/common.sh"

ensure_commands docker curl
load_env
load_state
APP_IMAGE_TAG="$REQUESTED_APP_IMAGE_TAG"

if [ -n "$IMAGE_ARCHIVE" ]; then
  if [ ! -f "$IMAGE_ARCHIVE" ]; then
    echo "离线镜像包不存在：$IMAGE_ARCHIVE"
    exit 1
  fi
  echo "正在导入离线镜像包：$IMAGE_ARCHIVE"
  docker_cmd load -i "$IMAGE_ARCHIVE"
fi

previous_tag="${CURRENT_APP_IMAGE_TAG:-}"

export APP_IMAGE_TAG

echo "开始发布离线镜像标签：$APP_IMAGE_TAG"
for required_service in mysql redis elasticsearch; do
  if ! compose_cmd ps --status running --services | grep -qx "$required_service"; then
    echo "依赖服务未运行：$required_service"
    echo "为了避免发布脚本自动启动或重建现有基础容器，已停止本次发布。请先手动确认该服务。"
    exit 1
  fi
done

if [ "${SKIP_DB_BACKUP:-0}" = "1" ] || [ -z "${previous_tag:-}" ]; then
  echo "跳过数据库备份：首次发布或显式禁用备份。"
else
  ENV_FILE="$ENV_FILE" bash "$SCRIPT_DIR/backup-db.sh"
fi

ENV_FILE="$ENV_FILE" APP_IMAGE_TAG="$APP_IMAGE_TAG" bash "$SCRIPT_DIR/schema-sync.sh"
compose_cmd up -d --no-deps --force-recreate --remove-orphans wechat-pay-gateway api web

wait_for_http "http://127.0.0.1:${API_PORT_HOST:-4000}/healthz" "API" 40 5
wait_for_http "http://127.0.0.1:${WEB_PORT_HOST:-3000}/healthz" "Web" 40 5

PREVIOUS_APP_IMAGE_TAG="${previous_tag:-}"
CURRENT_APP_IMAGE_TAG="$APP_IMAGE_TAG"
LAST_DEPLOYED_TAG="$APP_IMAGE_TAG"
LAST_DEPLOYED_AT="$(date '+%Y-%m-%d %H:%M:%S %z')"
LAST_ARCHIVE_PATH="${IMAGE_ARCHIVE:-}"
write_state

cat <<EOF
发布成功：
- 镜像标签：$APP_IMAGE_TAG
- 上一版本：${PREVIOUS_APP_IMAGE_TAG:-无}
- Web 健康检查：http://127.0.0.1:${WEB_PORT_HOST:-3000}/healthz
- API 健康检查：http://127.0.0.1:${API_PORT_HOST:-4000}/healthz
EOF
