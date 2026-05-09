#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PROJECT_ROOT="$(cd "$ROOT_DIR/../.." && pwd)"
ENV_FILE="${ENV_FILE:-$PROJECT_ROOT/.env}"

# shellcheck disable=SC1091
source "$SCRIPT_DIR/common.sh"

ensure_commands docker
load_env

echo "警告：即将彻底清空服务器 Docker 资源（容器/镜像/网络/卷）。"
echo "该操作不可逆，且会删除旧部署残留数据。"
echo "继续执行请设置 RESET_CONFIRM=YES"

if [ "${RESET_CONFIRM:-NO}" != "YES" ]; then
  echo "未检测到 RESET_CONFIRM=YES，已中止。"
  exit 1
fi

docker ps -aq | xargs -r docker rm -f
docker images -aq | xargs -r docker rmi -f
docker network ls -q | xargs -r docker network rm || true
docker volume ls -q | xargs -r docker volume rm -f || true
docker system prune -af --volumes || true

echo "Docker 环境清空完成，开始重建基础设施..."
ENV_FILE="$ENV_FILE" bash "$SCRIPT_DIR/install-server.sh"
echo "重建完成。"
