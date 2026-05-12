#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"
APP_IMAGE_TAG="${APP_IMAGE_TAG:-${1:-}}"
TARGET_PLATFORM="${TARGET_PLATFORM:-linux/amd64}"
NODE_BASE_IMAGE="${NODE_BASE_IMAGE:-docker.m.daocloud.io/library/node:20-alpine}"
GO_BASE_IMAGE="${GO_BASE_IMAGE:-docker.m.daocloud.io/library/golang:1.22-alpine}"
ALPINE_BASE_IMAGE="${ALPINE_BASE_IMAGE:-docker.m.daocloud.io/library/alpine:3.20}"
MYSQL_IMAGE_SOURCE="${MYSQL_IMAGE_SOURCE:-docker.m.daocloud.io/library/mysql:8.0}"
REDIS_IMAGE_SOURCE="${REDIS_IMAGE_SOURCE:-docker.m.daocloud.io/library/redis:7-alpine}"
ELASTICSEARCH_IMAGE_SOURCE="${ELASTICSEARCH_IMAGE_SOURCE:-docker.elastic.co/elasticsearch/elasticsearch:8.13.4}"
PRISMA_ENGINES_MIRROR="${PRISMA_ENGINES_MIRROR:-https://binaries.prisma.sh}"

if [ -z "$APP_IMAGE_TAG" ]; then
  APP_IMAGE_TAG="$(date '+%Y%m%d-%H%M%S')"
fi

ARCHIVE_DIR="${ARCHIVE_DIR:-$ROOT_DIR/dist}"
ARCHIVE_PATH="${ARCHIVE_PATH:-$ARCHIVE_DIR/offer360-offline-${APP_IMAGE_TAG}.tar}"
PRISMA_BUILD_DIR="${PRISMA_BUILD_DIR:-$ROOT_DIR/.prisma-build/prisma-engines}"
PRISMA_ENGINE_COMMIT="$(node -p "require('./node_modules/@prisma/engines-version/package.json').prisma.enginesVersion")"
PRISMA_ENGINE_PLATFORM="linux-musl-openssl-3.0.x"

if ! command -v docker >/dev/null 2>&1; then
  echo "未检测到 docker，请先安装 Docker。"
  exit 1
fi

mkdir -p "$ARCHIVE_DIR"
cd "$ROOT_DIR"

prepare_prisma_engines() {
  if [ "$TARGET_PLATFORM" != "linux/amd64" ]; then
    echo "当前离线打包脚本仅支持为 linux/amd64 预拉取 Prisma 引擎，当前 TARGET_PLATFORM=$TARGET_PLATFORM"
    exit 1
  fi

  mkdir -p "$PRISMA_BUILD_DIR"

  echo "预下载 Prisma 引擎到本地构建目录..."
  curl -fsSL \
    "${PRISMA_ENGINES_MIRROR}/all_commits/${PRISMA_ENGINE_COMMIT}/${PRISMA_ENGINE_PLATFORM}/schema-engine.gz" \
    | gzip -dc >"${PRISMA_BUILD_DIR}/schema-engine"
  chmod +x "${PRISMA_BUILD_DIR}/schema-engine"

  curl -fsSL \
    "${PRISMA_ENGINES_MIRROR}/all_commits/${PRISMA_ENGINE_COMMIT}/${PRISMA_ENGINE_PLATFORM}/libquery_engine.so.node.gz" \
    | gzip -dc >"${PRISMA_BUILD_DIR}/libquery_engine.so.node"
}

build_runtime_image() {
  local source_image="$1"
  local target_image="$2"
  local tmp_dir
  tmp_dir="$(mktemp -d)"
  cat >"$tmp_dir/Dockerfile" <<EOF
FROM ${source_image}
EOF
  docker buildx build --platform "$TARGET_PLATFORM" --load -t "$target_image" "$tmp_dir"
  rm -rf "$tmp_dir"
}

echo "开始构建业务镜像，标签：$APP_IMAGE_TAG"
prepare_prisma_engines
docker buildx build --platform "$TARGET_PLATFORM" --build-arg NODE_BASE_IMAGE="$NODE_BASE_IMAGE" --build-arg PRISMA_ENGINES_MIRROR="$PRISMA_ENGINES_MIRROR" --load -t "offer360-api:${APP_IMAGE_TAG}" -f apps/api/Dockerfile .
docker buildx build --platform "$TARGET_PLATFORM" --build-arg NODE_BASE_IMAGE="$NODE_BASE_IMAGE" --load -t "offer360-web:${APP_IMAGE_TAG}" -f apps/web/Dockerfile .
docker buildx build --platform "$TARGET_PLATFORM" --build-arg GO_BASE_IMAGE="$GO_BASE_IMAGE" --build-arg ALPINE_BASE_IMAGE="$ALPINE_BASE_IMAGE" --load -t "offer360-wechat-pay-gateway:${APP_IMAGE_TAG}" -f apps/wechat-pay-gateway/Dockerfile apps/wechat-pay-gateway

echo "构建基础镜像归一化副本"
build_runtime_image "$MYSQL_IMAGE_SOURCE" "mysql:8.0"
build_runtime_image "$REDIS_IMAGE_SOURCE" "redis:7-alpine"
build_runtime_image "$ELASTICSEARCH_IMAGE_SOURCE" "docker.elastic.co/elasticsearch/elasticsearch:8.13.4"

echo "导出离线镜像包：$ARCHIVE_PATH"
docker save -o "$ARCHIVE_PATH" \
  "offer360-api:${APP_IMAGE_TAG}" \
  "offer360-web:${APP_IMAGE_TAG}" \
  "offer360-wechat-pay-gateway:${APP_IMAGE_TAG}" \
  "mysql:8.0" \
  "redis:7-alpine" \
  "docker.elastic.co/elasticsearch/elasticsearch:8.13.4"

cat <<EOF
离线镜像包已生成：
- 镜像标签：$APP_IMAGE_TAG
- 目标平台：$TARGET_PLATFORM
- 输出文件：$ARCHIVE_PATH

上传示例：
scp "$ARCHIVE_PATH" root@your-server:/opt/offer360/
EOF
