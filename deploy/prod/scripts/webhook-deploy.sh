#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PROJECT_ROOT="$(cd "$ROOT_DIR/../.." && pwd)"
ENV_FILE="${ENV_FILE:-$PROJECT_ROOT/.env}"
TARGET_BRANCH="${TARGET_BRANCH:-main}"
APP_IMAGE_TAG="${APP_IMAGE_TAG:-manual-$(date '+%Y%m%d-%H%M%S')}"
GITHUB_REPO_SLUG="${GITHUB_REPO_SLUG:-}"

cd "$PROJECT_ROOT"

resolve_repo_slug() {
  if [ -n "$GITHUB_REPO_SLUG" ]; then
    echo "$GITHUB_REPO_SLUG"
    return 0
  fi

  if [ -d ".git" ]; then
    local remote_url
    remote_url="$(git remote get-url origin 2>/dev/null || true)"
    if [[ "$remote_url" =~ github\.com[:/]([^/]+/[^/.]+)(\.git)?$ ]]; then
      echo "${BASH_REMATCH[1]}"
      return 0
    fi
  fi

  echo ""
}

sync_source_from_archive() {
  local repo_slug archive_url temp_dir extracted_dir
  repo_slug="$(resolve_repo_slug)"
  if [ -z "$repo_slug" ]; then
    echo "缺少 GITHUB_REPO_SLUG，且当前目录无法从 Git remote 推导仓库信息。"
    exit 1
  fi

  archive_url="https://codeload.github.com/${repo_slug}/tar.gz/refs/heads/${TARGET_BRANCH}"
  temp_dir="$(mktemp -d)"
  trap 'rm -rf "$temp_dir"' RETURN

  echo "检测到当前目录缺少可用 Git 同步能力，改用源码包更新：$archive_url"
  curl --fail --location --silent --show-error "$archive_url" | tar -xzf - -C "$temp_dir"
  extracted_dir="$(find "$temp_dir" -mindepth 1 -maxdepth 1 -type d | head -n 1)"
  if [ -z "$extracted_dir" ] || [ ! -d "$extracted_dir" ]; then
    echo "源码包解压失败，未找到项目目录。"
    exit 1
  fi

  rsync -a --delete \
    --exclude '.env' \
    --exclude '.git' \
    --exclude 'deploy/prod/runtime/' \
    --exclude 'certs/' \
    "$extracted_dir"/ "$PROJECT_ROOT"/
}

sync_source_from_git() {
  git fetch origin "$TARGET_BRANCH"
  git checkout "$TARGET_BRANCH"
  git reset --hard "origin/$TARGET_BRANCH"
}

if [ -d ".git" ]; then
  if ! sync_source_from_git; then
    echo "Git 同步失败，回退为源码包更新。"
    sync_source_from_archive
  fi
else
  sync_source_from_archive
fi

echo "开始构建本地发布镜像标签：$APP_IMAGE_TAG"
docker build -f deploy/prod/dockerfiles/api.Dockerfile -t "local/offer360/offer360-api:$APP_IMAGE_TAG" .
docker build -f deploy/prod/dockerfiles/web.Dockerfile -t "local/offer360/offer360-web:$APP_IMAGE_TAG" .
docker build -f deploy/prod/dockerfiles/wechat-pay-gateway.Dockerfile -t "local/offer360/offer360-wechat-pay-gateway:$APP_IMAGE_TAG" .

export IMAGE_REGISTRY=local
export IMAGE_NAMESPACE=offer360
export SKIP_PULL=1
ENV_FILE="$ENV_FILE" APP_IMAGE_TAG="$APP_IMAGE_TAG" bash "$SCRIPT_DIR/deploy-release.sh"
