#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
PROJECT_ROOT="$(cd "$ROOT_DIR/.." && pwd)"
ENV_FILE="${ENV_FILE:-$PROJECT_ROOT/.env}"
SERVICE_NAME="${SERVICE_NAME:-offer360-webhook}"
SYSTEMD_FILE="/etc/systemd/system/${SERVICE_NAME}.service"

if [ ! -f "$ENV_FILE" ]; then
  echo "未找到环境文件：$ENV_FILE"
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "未检测到 python3，请先安装。"
  exit 1
fi

# shellcheck disable=SC1090
set -a
source "$ENV_FILE"
set +a

if [ -z "${WEBHOOK_SECRET:-}" ]; then
  echo "请先在 $ENV_FILE 中配置 WEBHOOK_SECRET 再执行。"
  exit 1
fi

WEBHOOK_PORT="${WEBHOOK_PORT:-19090}"
TARGET_BRANCH="${TARGET_BRANCH:-main}"
WEBHOOK_DEPLOY_LOG="${WEBHOOK_DEPLOY_LOG:-$PROJECT_ROOT/deploy/prod/runtime/logs/webhook-deploy.log}"

mkdir -p "$(dirname "$WEBHOOK_DEPLOY_LOG")"

sudo tee "$SYSTEMD_FILE" >/dev/null <<EOF
[Unit]
Description=Offer360 GitHub Webhook Listener
After=network.target docker.service

[Service]
Type=simple
WorkingDirectory=${PROJECT_ROOT}
EnvironmentFile=${ENV_FILE}
Environment=WEBHOOK_SECRET=${WEBHOOK_SECRET}
Environment=WEBHOOK_PORT=${WEBHOOK_PORT}
Environment=TARGET_BRANCH=${TARGET_BRANCH}
Environment=PROJECT_ROOT=${PROJECT_ROOT}
Environment=ENV_FILE=${ENV_FILE}
Environment=DEPLOY_SCRIPT=${PROJECT_ROOT}/deploy/prod/scripts/webhook-deploy.sh
Environment=WEBHOOK_DEPLOY_LOG=${WEBHOOK_DEPLOY_LOG}
ExecStart=/usr/bin/python3 ${PROJECT_ROOT}/deploy/prod/scripts/webhook-listener.py
Restart=always
RestartSec=3
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now "$SERVICE_NAME"
sudo systemctl status "$SERVICE_NAME" --no-pager
