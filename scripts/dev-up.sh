#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

ENV_FILE=".env"

if [ ! -f "$ENV_FILE" ]; then
  cp .env.example "$ENV_FILE"
  echo "已根据 .env.example 创建 $ENV_FILE，请按需调整后重新执行。"
fi

set -a
source "$ENV_FILE"
set +a

STACK_NAME="${STACK_NAME:-gpt54-o360-dev}"
DEV_WEB_PORT="${DEV_WEB_PORT:-13000}"
DEV_API_PORT="${DEV_API_PORT:-14000}"
DEV_MYSQL_PORT="${DEV_MYSQL_PORT:-13306}"
DEV_REDIS_PORT="${DEV_REDIS_PORT:-16379}"
DEV_ELASTICSEARCH_PORT="${DEV_ELASTICSEARCH_PORT:-19200}"

bash "$ROOT_DIR/scripts/refresh-prisma-init-schema.sh"
docker compose --env-file "$ENV_FILE" -f docker-compose.dev.yml up -d --build
SKIP_SCHEMA_SQL_REFRESH=1 bash "$ROOT_DIR/scripts/sync-dev-db-schema.sh"

echo "隔离开发环境已启动。"
echo "- 栈名前缀: ${STACK_NAME}"
echo "- Web: http://localhost:${DEV_WEB_PORT}"
echo "- API: http://localhost:${DEV_API_PORT}/api"
echo "- Swagger: http://localhost:${DEV_API_PORT}/api/docs"
echo "- MySQL: 127.0.0.1:${DEV_MYSQL_PORT}"
echo "- Redis: 127.0.0.1:${DEV_REDIS_PORT}"
echo "- Elasticsearch: http://127.0.0.1:${DEV_ELASTICSEARCH_PORT}"
