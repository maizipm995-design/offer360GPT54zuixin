#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

ENV_FILE=".env"

if [ ! -f "$ENV_FILE" ]; then
  echo "未找到 $ENV_FILE，无需关闭。"
  exit 0
fi

set -a
source "$ENV_FILE"
set +a

API_PID_FILE="${API_PID_FILE:-/tmp/offer360-api-dev.pid}"
if [ -f "$API_PID_FILE" ]; then
  bash "$ROOT_DIR/scripts/dev-api-host-stop.sh" || true
fi

docker compose --env-file "$ENV_FILE" -f docker-compose.dev.yml down

echo "隔离开发环境已停止。"
