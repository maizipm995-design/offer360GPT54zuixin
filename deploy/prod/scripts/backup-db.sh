#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/../../.env}"

# shellcheck disable=SC1091
source "$SCRIPT_DIR/common.sh"

ensure_commands docker date gzip
load_env

BACKUP_DIR="${DB_BACKUP_DIR:-$ROOT_DIR/runtime/db-backups}"
mkdir -p "$BACKUP_DIR"

timestamp="$(date '+%Y%m%d-%H%M%S')"
backup_file="$BACKUP_DIR/${MYSQL_DATABASE}-predeploy-${timestamp}.sql.gz"

echo "开始备份数据库：${MYSQL_DATABASE}"
compose_cmd exec -T mysql sh -lc \
  "mysqldump -uroot -p\"\$MYSQL_ROOT_PASSWORD\" --single-transaction --quick --routines --events --databases \"$MYSQL_DATABASE\"" \
  | gzip -9 > "$backup_file"

echo "数据库备份完成：$backup_file"
