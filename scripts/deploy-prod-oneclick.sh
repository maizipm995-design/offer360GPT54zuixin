#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/.env}"

cd "$ROOT_DIR"

if ! command -v docker >/dev/null 2>&1; then
  echo "未检测到 docker，请先在服务器安装 Docker。"
  exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
  cp "$ROOT_DIR/.env.example" "$ENV_FILE"
  echo "已生成 $ENV_FILE，请先补齐生产环境变量后重新执行。"
  exit 1
fi

ENV_FILE="$ENV_FILE" bash "$ROOT_DIR/deploy/prod/scripts/install-server.sh"

echo
echo "已完成生产环境基础设施初始化。"
echo "后续正式版本发布请由 CI/CD 传入 APP_IMAGE_TAG 调用："
echo "ENV_FILE=$ENV_FILE APP_IMAGE_TAG=<镜像标签> bash deploy/prod/scripts/deploy-release.sh"
