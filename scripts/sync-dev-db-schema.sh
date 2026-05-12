#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

ENV_FILE=".env"

if [ ! -f "$ENV_FILE" ]; then
  cp .env.example "$ENV_FILE"
  echo "已根据 .env.example 创建 $ENV_FILE，请按需调整后继续。"
fi

set -a
source "$ENV_FILE"
set +a

bash "$ROOT_DIR/scripts/check-prisma-migration-consistency.sh"

if [ "${SKIP_SCHEMA_SQL_REFRESH:-0}" != "1" ]; then
  bash "$ROOT_DIR/scripts/refresh-prisma-init-schema.sh"
fi

if ! docker compose --env-file "$ENV_FILE" -f docker-compose.dev.yml ps --status running --services | grep -qx "mysql"; then
  echo "开发环境 MySQL 未运行，无法同步本地数据库结构。请先执行 npm run dev:up。"
  exit 1
fi

RUNTIME_DIR="$ROOT_DIR/runtime/dev-schema-sync"
DIFF_SQL_PATH="$RUNTIME_DIR/dev-schema-diff.sql"
mkdir -p "$RUNTIME_DIR"

echo "检测开发库与 schema.prisma 的结构差异..."
docker compose --env-file "$ENV_FILE" -f docker-compose.dev.yml run --rm --no-deps -T api \
  sh -lc 'npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel apps/api/prisma/schema.prisma --script' \
  >"$DIFF_SQL_PATH"

if ! grep -Eiq '^[[:space:]]*(CREATE|ALTER|DROP|RENAME)' "$DIFF_SQL_PATH"; then
  echo "开发库结构已与 schema.prisma 保持一致。"
  exit 0
fi

echo "检测到开发库结构差异，开始按 schema.prisma 自动同步..."
docker compose --env-file "$ENV_FILE" -f docker-compose.dev.yml run --rm --no-deps -T api \
  sh -lc 'npx prisma db execute --stdin --url "$DATABASE_URL"' \
  <"$DIFF_SQL_PATH"

cat <<EOF
开发库表结构已同步完成：
- 差异 SQL：$DIFF_SQL_PATH
- 同步真源：apps/api/prisma/schema.prisma
EOF
