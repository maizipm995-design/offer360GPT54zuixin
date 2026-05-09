#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PROJECT_ROOT="$(cd "$ROOT_DIR/../.." && pwd)"
ENV_FILE="${ENV_FILE:-$PROJECT_ROOT/.env}"
TARGET_BRANCH="${TARGET_BRANCH:-main}"
APP_IMAGE_TAG="${APP_IMAGE_TAG:-manual-$(date '+%Y%m%d-%H%M%S')}"

cd "$PROJECT_ROOT"

if [ ! -d ".git" ]; then
  echo "当前目录不是 Git 仓库：$PROJECT_ROOT"
  exit 1
fi

git fetch origin "$TARGET_BRANCH"
git checkout "$TARGET_BRANCH"
git reset --hard "origin/$TARGET_BRANCH"

echo "开始构建本地发布镜像标签：$APP_IMAGE_TAG"
docker build -f deploy/prod/dockerfiles/api.Dockerfile -t "local/offer360/offer360-api:$APP_IMAGE_TAG" .
docker build -f deploy/prod/dockerfiles/web.Dockerfile -t "local/offer360/offer360-web:$APP_IMAGE_TAG" .
docker build -f deploy/prod/dockerfiles/wechat-pay-gateway.Dockerfile -t "local/offer360/offer360-wechat-pay-gateway:$APP_IMAGE_TAG" .

export IMAGE_REGISTRY=local
export IMAGE_NAMESPACE=offer360
export SKIP_PULL=1
ENV_FILE="$ENV_FILE" APP_IMAGE_TAG="$APP_IMAGE_TAG" bash "$SCRIPT_DIR/deploy-release.sh"
