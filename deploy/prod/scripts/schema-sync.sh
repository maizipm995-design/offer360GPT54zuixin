#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/../../.env}"
REQUESTED_APP_IMAGE_TAG="${APP_IMAGE_TAG:-${1:-}}"
APP_IMAGE_TAG="$REQUESTED_APP_IMAGE_TAG"

if [ -z "$APP_IMAGE_TAG" ]; then
  echo "请通过 APP_IMAGE_TAG 环境变量或脚本第一个参数传入本次发布的镜像标签。"
  exit 1
fi

# shellcheck disable=SC1091
source "$SCRIPT_DIR/common.sh"

ensure_commands docker grep
load_env

APP_IMAGE_TAG="$REQUESTED_APP_IMAGE_TAG"
export APP_IMAGE_TAG

RUNTIME_DIR="${ROOT_DIR}/runtime/schema-sync"
DIFF_SQL_PATH="${RUNTIME_DIR}/schema-diff-${APP_IMAGE_TAG}.sql"
RISK_REPORT_PATH="${RUNTIME_DIR}/schema-risk-${APP_IMAGE_TAG}.txt"
EXPECTED_INIT_SQL_PATH="${RUNTIME_DIR}/schema-init-expected-${APP_IMAGE_TAG}.sql"
SCHEMA_RECORD_MISMATCH_PATH="${RUNTIME_DIR}/schema-record-mismatch-${APP_IMAGE_TAG}.txt"
MIGRATION_DIFF_REPORT_PATH="${RUNTIME_DIR}/migration-schema-diff-${APP_IMAGE_TAG}.txt"
SHADOW_DATABASE_NAME="${MYSQL_DATABASE}_shadow"
IGNORABLE_BACKUP_DROP_REGEX='^DROP TABLE `(ai_model_configs_backup_[^`]+|ai_model_configs_prompt_backup_[^`]+)`;$'

mkdir -p "$RUNTIME_DIR"

if ! compose_cmd ps --status running --services | grep -qx "mysql"; then
  echo "MySQL 服务未处于运行状态。为了避免脚本自动触碰数据库容器，已停止本次结构同步。"
  exit 1
fi

echo "准备 Prisma shadow database：$SHADOW_DATABASE_NAME"
compose_cmd exec -T mysql \
  mysql -uroot -p"${MYSQL_ROOT_PASSWORD}" \
  -e "CREATE DATABASE IF NOT EXISTS \`${SHADOW_DATABASE_NAME}\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

echo "校验 Prisma migrations 与 schema.prisma 是否一致..."
set +e
compose_cmd run --rm --no-deps -T api sh -lc \
  "SHADOW_DATABASE_URL=\"${DATABASE_URL%/*}/${SHADOW_DATABASE_NAME}\"; export SHADOW_DATABASE_URL; npx prisma migrate diff --from-migrations apps/api/prisma/migrations --to-schema-datamodel apps/api/prisma/schema.prisma --shadow-database-url \"\$SHADOW_DATABASE_URL\" --exit-code" \
  >"$MIGRATION_DIFF_REPORT_PATH" 2>&1
migration_status=$?
set -e

if [ "$migration_status" -eq 2 ]; then
  cat <<EOF
检测到 Prisma 迁移记录未同步，已阻断自动结构同步：
- migrations 目录：apps/api/prisma/migrations
- schema 真源：apps/api/prisma/schema.prisma
- 差异报告：$MIGRATION_DIFF_REPORT_PATH

请先补齐并提交缺失的 migration，再重新执行发布。
EOF
  cat "$MIGRATION_DIFF_REPORT_PATH"
  exit 1
fi

if [ "$migration_status" -ne 0 ]; then
  echo "Prisma migrations 一致性校验失败，请查看：$MIGRATION_DIFF_REPORT_PATH"
  cat "$MIGRATION_DIFF_REPORT_PATH"
  exit 1
fi

echo "校验表结构记录文件是否与 schema.prisma 一致..."
compose_cmd run --rm --no-deps -T api sh -lc \
  'npx prisma migrate diff --from-empty --to-schema-datamodel apps/api/prisma/schema.prisma --script' \
  | grep -v '^#' >"$EXPECTED_INIT_SQL_PATH" 2>/dev/null

{
  echo "CREATE DATABASE IF NOT EXISTS \`${MYSQL_DATABASE}\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
  echo "USE \`${MYSQL_DATABASE}\`;"
  echo
  cat "$EXPECTED_INIT_SQL_PATH"
} >"${EXPECTED_INIT_SQL_PATH}.full"
mv "${EXPECTED_INIT_SQL_PATH}.full" "$EXPECTED_INIT_SQL_PATH"

if ! diff -qB "$EXPECTED_INIT_SQL_PATH" "$ROOT_DIR/../../infra/sql/schema.sql" >/dev/null; then
  cat >"$SCHEMA_RECORD_MISMATCH_PATH" <<EOF
检测到结构记录文件未同步：
- schema 真源：apps/api/prisma/schema.prisma
- 过期文件：infra/sql/schema.sql

当前发布脚本依赖 schema.prisma 识别结构变更。
如果数据库改动没有同步回结构记录文件，脚本就会误判“无改动”。
请先在代码仓库执行：
1. npm run db:schema:sql:refresh
2. 确认 apps/api/prisma/schema.prisma / migrations / infra/sql/schema.sql 已同步提交
EOF
  cat "$SCHEMA_RECORD_MISMATCH_PATH"
  exit 1
fi

echo "开始生成线上库与当前代码结构的差异 SQL..."
compose_cmd run --rm --no-deps -T api sh -lc \
  'npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel apps/api/prisma/schema.prisma --script' \
  >"$DIFF_SQL_PATH"

# Allow explicitly retained backup tables to stay online without blocking deploys.
python3 - "$DIFF_SQL_PATH" "$IGNORABLE_BACKUP_DROP_REGEX" <<'PY'
import pathlib
import re
import sys

path = pathlib.Path(sys.argv[1])
pattern = re.compile(sys.argv[2])
lines = path.read_text().splitlines()
filtered = [line for line in lines if not pattern.match(line)]
path.write_text("\n".join(filtered) + ("\n" if filtered else ""))
PY

if ! grep -Eiq '^[[:space:]]*(CREATE|ALTER|DROP|RENAME)' "$DIFF_SQL_PATH"; then
  echo "未检测到需要同步的表结构变更。"
  exit 0
fi

if grep -Ein \
  'DROP[[:space:]]+TABLE|DROP[[:space:]]+COLUMN|DROP[[:space:]]+PRIMARY[[:space:]]+KEY|DROP[[:space:]]+INDEX|MODIFY[[:space:]]+COLUMN|CHANGE[[:space:]]+COLUMN|ALTER[[:space:]]+COLUMN|RENAME[[:space:]]+TABLE|RENAME[[:space:]]+COLUMN' \
  "$DIFF_SQL_PATH" >"$RISK_REPORT_PATH"; then
  cat <<EOF
检测到高风险结构变更，已阻断自动同步：
- 差异 SQL：$DIFF_SQL_PATH
- 风险清单：$RISK_REPORT_PATH

本次自动同步只允许安全增量变更：
- 新增表
- 新增字段
- 新增索引

以下变更需人工确认后再处理：
- 删表、删字段、删索引
- 修改字段类型、长度、定义
- 重命名表或字段
EOF
  exit 1
fi

echo "差异仅包含安全增量变更，开始自动执行结构同步..."
compose_cmd run --rm --no-deps -T api sh -lc \
  'npx prisma db execute --stdin --url "$DATABASE_URL"' \
  <"$DIFF_SQL_PATH"

cat <<EOF
数据库表结构已自动同步完成：
- 差异 SQL：$DIFF_SQL_PATH
- 同步策略：仅自动执行安全增量变更
EOF
