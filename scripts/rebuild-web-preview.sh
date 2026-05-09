#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

ENV_FILE=".env"
PAGE_PATH="${PREVIEW_PATH:-/}"
OPEN_BROWSER="${PREVIEW_OPEN_BROWSER:-false}"
CUSTOM_WEB_PORT=""
CUSTOM_API_PORT=""
CUSTOM_STACK_NAME=""

usage() {
  cat <<'EOF'
用法：bash scripts/rebuild-web-preview.sh [选项]

说明：
  基于 Docker 容器重建并启动 Offer360 预览站点。
  脚本会优先尝试 `docker compose` 重建 `web` 及其依赖服务；
  如果因镜像源异常导致构建失败，则自动回退到“复用本地已有项目镜像，在容器内用最新源码重新构建并启动”的方案。

选项：
  --path <页面路径>       要预览的页面路径，默认 /
  --port <端口>           Web 预览端口，默认读取 .env 中的 DEV_WEB_PORT 或 13000
  --api-port <端口>       API 暴露端口，默认读取 .env 中的 DEV_API_PORT 或 14000
  环境文件固定为根目录 .env（不支持多环境文件切换）
  --stack-name <名称>     指定 compose 栈名，默认读取环境文件中的 STACK_NAME
  --open                 启动完成后自动打开浏览器（macOS 支持 open）
  --no-open              启动完成后不自动打开浏览器
  -h, --help             查看帮助

示例：
  bash scripts/rebuild-web-preview.sh --path /resume-optimizer
  bash scripts/rebuild-web-preview.sh --path /jobs --port 13000 --open
  npm run preview:web -- --path /resume-optimizer --port 13000
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --path)
      PAGE_PATH="${2:-}"
      shift 2
      ;;
    --port)
      CUSTOM_WEB_PORT="${2:-}"
      shift 2
      ;;
    --api-port)
      CUSTOM_API_PORT="${2:-}"
      shift 2
      ;;
    --stack-name)
      CUSTOM_STACK_NAME="${2:-}"
      shift 2
      ;;
    --open)
      OPEN_BROWSER="true"
      shift
      ;;
    --no-open)
      OPEN_BROWSER="false"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "未知参数：$1"
      usage
      exit 1
      ;;
  esac
done

if [[ ! -f "$ENV_FILE" ]]; then
  if [[ -f ".env.example" ]]; then
    cp .env.example "$ENV_FILE"
    echo "已根据 .env.example 创建 $ENV_FILE，请按需调整后重新执行。"
    exit 0
  fi
  echo "未找到环境文件：$ENV_FILE"
  exit 1
fi

set -a
source "$ENV_FILE"
set +a

DEV_WEB_PORT="${CUSTOM_WEB_PORT:-${DEV_WEB_PORT:-13000}}"
DEV_API_PORT="${CUSTOM_API_PORT:-${DEV_API_PORT:-14000}}"
STACK_NAME="${CUSTOM_STACK_NAME:-${STACK_NAME:-gpt54-o360-dev}}"

if [[ -z "$PAGE_PATH" ]]; then
  PAGE_PATH="/"
fi

if [[ "$PAGE_PATH" != /* ]]; then
  PAGE_PATH="/$PAGE_PATH"
fi

if ! [[ "$DEV_WEB_PORT" =~ ^[0-9]+$ ]]; then
  echo "Web 端口必须是数字：$DEV_WEB_PORT"
  exit 1
fi

if ! [[ "$DEV_API_PORT" =~ ^[0-9]+$ ]]; then
  echo "API 端口必须是数字：$DEV_API_PORT"
  exit 1
fi

COMPOSE_ARGS=(--env-file "$ENV_FILE" -f docker-compose.dev.yml)
BASE_URL="http://127.0.0.1:${DEV_WEB_PORT}"
PAGE_URL="${BASE_URL}${PAGE_PATH}"
BROWSER_API_BASE_URL="http://localhost:${DEV_API_PORT}/api"
SERVER_API_BASE_URL="http://host.docker.internal:${DEV_API_PORT}/api"
HOST_WEB_BASE_URL="http://host.docker.internal:${DEV_WEB_PORT}"
CORS_ORIGIN_VALUE="http://localhost:${DEV_WEB_PORT},http://127.0.0.1:${DEV_WEB_PORT},https://offer360.cn"
LOCAL_WEB_CONTAINER_NAME="offer360-web-preview-${DEV_WEB_PORT}"

wait_for_server() {
  local target_url="$1"
  local retries=90
  local count=1

  while [[ $count -le $retries ]]; do
    if curl -fsS "$target_url" >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
    count=$((count + 1))
  done

  return 1
}

open_page_if_needed() {
  local target_url="$1"
  if [[ "$OPEN_BROWSER" == "true" ]] && command -v open >/dev/null 2>&1; then
    open "$target_url"
  fi
}

show_compose_failure_logs() {
  echo "--- docker compose ps ---"
  docker compose "${COMPOSE_ARGS[@]}" ps || true
  echo "--- web 日志（最近 80 行）---"
  docker compose "${COMPOSE_ARGS[@]}" logs --tail=80 web || true
  echo "--- api 日志（最近 80 行）---"
  docker compose "${COMPOSE_ARGS[@]}" logs --tail=80 api || true
}

resolve_local_web_image() {
  local candidates=(
    "${STACK_NAME}-web:latest"
    "gpt54-o360-dev-web:latest"
    "offer360-web:latest"
  )

  for image in "${candidates[@]}"; do
    if docker image inspect "$image" >/dev/null 2>&1; then
      echo "$image"
      return 0
    fi
  done

  return 1
}

remove_old_local_preview_container() {
  if docker ps -a --format '{{.Names}}' | grep -Fx "$LOCAL_WEB_CONTAINER_NAME" >/dev/null 2>&1; then
    docker rm -f "$LOCAL_WEB_CONTAINER_NAME" >/dev/null 2>&1 || true
  fi
}

run_compose_preview() {
  export STACK_NAME
  export DEV_WEB_PORT
  export DEV_API_PORT
  export NEXT_PUBLIC_API_BASE_URL="$BROWSER_API_BASE_URL"
  export CORS_ORIGIN="$CORS_ORIGIN_VALUE"
  export WEB_APP_BASE_URL="$HOST_WEB_BASE_URL"
  export WECHAT_PAY_CALLBACK_BASE_URL="$HOST_WEB_BASE_URL"

  docker compose "${COMPOSE_ARGS[@]}" up -d --build mysql redis elasticsearch wechat-pay-gateway api web
}

run_local_image_preview() {
  local local_web_image
  local_web_image="$(resolve_local_web_image)"

  if [[ -z "$local_web_image" ]]; then
    echo "未找到可复用的本地 web 项目镜像，无法执行容器化回退预览。"
    exit 1
  fi

  remove_old_local_preview_container

  docker run -d \
    --name "$LOCAL_WEB_CONTAINER_NAME" \
    --restart unless-stopped \
    -p "${DEV_WEB_PORT}:3000" \
    -v "$ROOT_DIR:/workspace:ro" \
    -e NODE_ENV=production \
    -e NEXT_PUBLIC_API_BASE_URL="$BROWSER_API_BASE_URL" \
    -e INTERNAL_API_BASE_URL="$SERVER_API_BASE_URL" \
    "$local_web_image" \
    sh -lc "set -euo pipefail && rm -rf /tmp/offer360-web-preview && mkdir -p /tmp/offer360-web-preview && tar -C /workspace --exclude=node_modules --exclude=.git --exclude=apps/web/.next --exclude=apps/api/dist -cf - . | tar -C /tmp/offer360-web-preview -xf - && ln -s /app/node_modules /tmp/offer360-web-preview/node_modules && cd /tmp/offer360-web-preview && npm run build:web && exec npm run start --workspace @offer360/web -- --hostname 0.0.0.0 --port 3000" >/dev/null
}

echo "准备启动 Docker 预览环境..."
echo "- 栈名: ${STACK_NAME}"
echo "- Web 端口: ${DEV_WEB_PORT}"
echo "- API 端口: ${DEV_API_PORT}"
echo "- 页面路径: ${PAGE_PATH}"

remove_old_local_preview_container

echo "优先尝试 docker compose 重建..."
if run_compose_preview; then
  if wait_for_server "$BASE_URL"; then
    open_page_if_needed "$PAGE_URL"
    echo "Docker Compose 预览环境已就绪。"
    echo "- Web 首页：${BASE_URL}"
    echo "- 目标页面：${PAGE_URL}"
    echo "- API 地址：${BROWSER_API_BASE_URL}"
    echo "- 查看容器：docker compose --env-file ${ENV_FILE} -f docker-compose.dev.yml ps"
    exit 0
  fi

  echo "docker compose 已执行成功，但页面启动超时。"
  show_compose_failure_logs
  exit 1
fi

echo "docker compose 构建失败，自动回退到本地已有项目镜像方案..."
run_local_image_preview

if wait_for_server "$BASE_URL"; then
  open_page_if_needed "$PAGE_URL"
  echo "本地镜像回退预览环境已就绪。"
  echo "- Web 首页：${BASE_URL}"
  echo "- 目标页面：${PAGE_URL}"
  echo "- API 地址：${BROWSER_API_BASE_URL}"
  echo "- Web 容器：${LOCAL_WEB_CONTAINER_NAME}"
  echo "- 查看日志：docker logs -f ${LOCAL_WEB_CONTAINER_NAME}"
  exit 0
fi

echo "本地镜像回退预览启动超时。"
docker logs --tail=120 "$LOCAL_WEB_CONTAINER_NAME" || true
exit 1
