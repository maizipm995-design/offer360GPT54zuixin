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

mkdir -p "$RUNTIME_DIR"

if ! compose_cmd ps --status running --services | grep -qx "mysql"; then
  echo "MySQL 服务未处于运行状态。为了避免脚本自动触碰数据库容器，已停止本次结构同步。"
  exit 1
fi

echo "开始生成线上库与当前代码结构的差异 SQL..."
compose_cmd run --rm --no-deps -T api sh -lc \
  'npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel apps/api/prisma/schema.prisma --script' \
  >"$DIFF_SQL_PATH"

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
