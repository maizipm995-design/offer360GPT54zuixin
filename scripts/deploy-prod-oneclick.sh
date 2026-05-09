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
if grep -q '^WEBHOOK_SECRET=' "$ENV_FILE" && ! grep -q '^WEBHOOK_SECRET=CHANGE_ME_' "$ENV_FILE"; then
  ENV_FILE="$ENV_FILE" bash "$ROOT_DIR/deploy/prod/scripts/install-webhook-service.sh"
  echo
  echo "已完成生产环境基础设施和 Webhook 监听服务初始化。"
  echo "请在 GitHub 仓库中配置 Webhook："
  echo "- Payload URL: https://<你的域名>/webhook/github"
  echo "- Content type: application/json"
  echo "- Secret: 使用 $ENV_FILE 中的 WEBHOOK_SECRET"
  echo "- Event: Just the push event"
else
  echo "已完成生产环境基础设施初始化，但未安装 Webhook 服务。"
  echo "原因：$ENV_FILE 中还没有有效的 WEBHOOK_SECRET。"
  echo "补齐后执行：ENV_FILE=$ENV_FILE bash deploy/prod/scripts/install-webhook-service.sh"
fi
