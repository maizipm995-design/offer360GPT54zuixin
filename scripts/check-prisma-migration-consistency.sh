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

if ! docker compose --env-file "$ENV_FILE" -f docker-compose.dev.yml ps --status running --services | grep -qx "mysql"; then
  echo "开发环境 MySQL 未运行，无法校验 Prisma migrations 与 schema.prisma 是否一致。请先执行 npm run dev:up。"
  exit 1
fi

MYSQL_DATABASE="${MYSQL_DATABASE:-offer360}"
SHADOW_DATABASE_NAME="${MYSQL_DATABASE}_shadow"
RUNTIME_DIR="$ROOT_DIR/runtime/dev-schema-sync"
DIFF_REPORT_PATH="$RUNTIME_DIR/migration-schema-diff.txt"
mkdir -p "$RUNTIME_DIR"

echo "准备 Prisma shadow database：$SHADOW_DATABASE_NAME"
docker compose --env-file "$ENV_FILE" -f docker-compose.dev.yml exec -T mysql \
  mysql -uroot -p"${MYSQL_ROOT_PASSWORD}" \
  -e "CREATE DATABASE IF NOT EXISTS \`${SHADOW_DATABASE_NAME}\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

echo "校验 Prisma migrations 与 schema.prisma 是否一致..."
set +e
docker compose --env-file "$ENV_FILE" -f docker-compose.dev.yml run --rm --no-deps -T api sh -lc \
  "SHADOW_DATABASE_URL=\"\${DATABASE_URL%/*}/${SHADOW_DATABASE_NAME}\"; export SHADOW_DATABASE_URL; npx prisma migrate diff --from-migrations apps/api/prisma/migrations --to-schema-datamodel apps/api/prisma/schema.prisma --shadow-database-url \"\$SHADOW_DATABASE_URL\" --exit-code" \
  >"$DIFF_REPORT_PATH"
status=$?
set -e

if [ "$status" -eq 0 ]; then
  echo "Prisma migrations 与 schema.prisma 已保持一致。"
  exit 0
fi

if [ "$status" -eq 2 ]; then
  cat <<EOF
检测到 Prisma 结构记录不完整：
- migrations 目录：apps/api/prisma/migrations
- schema 真源：apps/api/prisma/schema.prisma
- 差异报告：$DIFF_REPORT_PATH

这表示有人修改了 schema.prisma，但没有同步补齐 migration。
请先生成并提交缺失的 Prisma migration，再继续执行数据库同步。
EOF
  cat "$DIFF_REPORT_PATH"
  exit 1
fi

echo "Prisma migrations 一致性校验失败，请查看：$DIFF_REPORT_PATH"
cat "$DIFF_REPORT_PATH"
exit 1
