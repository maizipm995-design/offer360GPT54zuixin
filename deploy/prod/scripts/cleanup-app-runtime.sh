#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# shellcheck disable=SC1091
source "$SCRIPT_DIR/common.sh"

ensure_commands docker
load_env

echo "停止并移除旧的业务容器（保留 mysql/redis/elasticsearch 数据卷）..."
compose_cmd stop web api wechat-pay-gateway >/dev/null 2>&1 || true
compose_cmd rm -sf web api wechat-pay-gateway >/dev/null 2>&1 || true

echo "清理悬空镜像与构建缓存..."
docker_cmd image prune -f >/dev/null 2>&1 || true
docker_cmd builder prune -af >/dev/null 2>&1 || true

echo "业务运行时清理完成。"
