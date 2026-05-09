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

if [ -z "${WEBHOOK_SECRET:-}" ]; then
  echo "请先导出 WEBHOOK_SECRET 再执行。"
  echo "示例：export WEBHOOK_SECRET='your-github-webhook-secret'"
  exit 1
fi

sudo tee "$SYSTEMD_FILE" >/dev/null <<EOF
[Unit]
Description=Offer360 GitHub Webhook Listener
After=network.target docker.service

[Service]
Type=simple
WorkingDirectory=${PROJECT_ROOT}
Environment=WEBHOOK_SECRET=${WEBHOOK_SECRET}
Environment=TARGET_BRANCH=main
Environment=PROJECT_ROOT=${PROJECT_ROOT}
Environment=ENV_FILE=${ENV_FILE}
Environment=DEPLOY_SCRIPT=${PROJECT_ROOT}/deploy/prod/scripts/webhook-deploy.sh
ExecStart=/usr/bin/python3 ${PROJECT_ROOT}/deploy/prod/scripts/webhook-listener.py
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now "$SERVICE_NAME"
sudo systemctl status "$SERVICE_NAME" --no-pager
