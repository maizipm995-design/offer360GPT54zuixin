#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
APP_IMAGE_TAG="${APP_IMAGE_TAG:-${1:-}}"

cd "$ROOT_DIR"

if ! command -v docker >/dev/null 2>&1; then
  echo "未检测到 docker，请先安装 Docker 后重试。"
  exit 1
fi

APP_IMAGE_TAG="$APP_IMAGE_TAG" bash "$ROOT_DIR/deploy/prod/scripts/package-release.sh"
