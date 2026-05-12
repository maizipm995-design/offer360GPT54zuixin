#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

ENV_FILE=".env"

if [ ! -f "$ENV_FILE" ]; then
  echo "未找到 $ENV_FILE，请先准备开发环境配置。"
  exit 1
fi

set -a
source "$ENV_FILE"
set +a

DEV_WEB_PORT="${DEV_WEB_PORT:-13000}"
DEV_API_PORT="${DEV_API_PORT:-14000}"

docker compose --env-file "$ENV_FILE" -f docker-compose.dev.yml up -d --build shared-builder api web
bash "$ROOT_DIR/scripts/sync-dev-db-schema.sh"

echo "已重建并重启开发环境中的 shared-builder / Web / API 容器。"
echo "- Web: http://localhost:${DEV_WEB_PORT}"
echo "- API: http://localhost:${DEV_API_PORT}/api"
echo "- Swagger: http://localhost:${DEV_API_PORT}/api/docs"
