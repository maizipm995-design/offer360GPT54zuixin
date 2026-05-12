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

OUTPUT_PATH="$ROOT_DIR/infra/sql/schema.sql"
TMP_SCHEMA_SQL="$(mktemp "${TMPDIR:-/tmp}/offer360-schema.XXXXXX.sql")"

cleanup() {
  rm -f "$TMP_SCHEMA_SQL"
}

trap cleanup EXIT

echo "根据 apps/api/prisma/schema.prisma 重新生成开发库初始化 SQL..."
docker compose --env-file "$ENV_FILE" -f docker-compose.dev.yml run --rm --no-deps --build -T api \
  sh -lc 'npx prisma migrate diff --from-empty --to-schema-datamodel apps/api/prisma/schema.prisma --script' \
  >"$TMP_SCHEMA_SQL"

{
  echo "CREATE DATABASE IF NOT EXISTS \`${MYSQL_DATABASE:-offer360}\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
  echo "USE \`${MYSQL_DATABASE:-offer360}\`;"
  echo
  cat "$TMP_SCHEMA_SQL"
} >"$OUTPUT_PATH"

echo "开发库初始化 SQL 已刷新：$OUTPUT_PATH"
