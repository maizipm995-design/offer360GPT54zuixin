#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PROJECT_ROOT="$(cd "$ROOT_DIR/../.." && pwd)"
ENV_FILE="${ENV_FILE:-$PROJECT_ROOT/.env}"
TARGET_BRANCH="${TARGET_BRANCH:-main}"
APP_IMAGE_TAG="${APP_IMAGE_TAG:-manual-$(date '+%Y%m%d-%H%M%S')}"
GITHUB_REPO_SLUG="${GITHUB_REPO_SLUG:-}"
GITHUB_TOKEN="${GITHUB_TOKEN:-}"
GITHUB_USERNAME="${GITHUB_USERNAME:-x-access-token}"
LOCK_FILE="${LOCK_FILE:-$ROOT_DIR/runtime/webhook-deploy.lock}"

cd "$PROJECT_ROOT"

if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

mkdir -p "$(dirname "$LOCK_FILE")"
exec 9>"$LOCK_FILE"
if ! command -v flock >/dev/null 2>&1; then
  echo "未检测到 flock，无法安全串行化 Webhook 部署。"
  exit 1
fi

if ! flock -n 9; then
  echo "已有部署任务正在执行，本次 Webhook 请求跳过。"
  exit 0
fi

authenticated_git_url() {
  local repo_slug username
  repo_slug="$(resolve_repo_slug)"
  username="${GITHUB_USERNAME:-x-access-token}"
  if [ -z "$repo_slug" ] || [ -z "$GITHUB_TOKEN" ]; then
    echo ""
    return 0
  fi

  echo "https://${username}:${GITHUB_TOKEN}@github.com/${repo_slug}.git"
}

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

  temp_dir="$(mktemp -d)"
  trap 'rm -rf "$temp_dir"' RETURN

  if [ -n "$GITHUB_TOKEN" ]; then
    archive_url="https://api.github.com/repos/${repo_slug}/tarball/${TARGET_BRANCH}"
    echo "检测到 GitHub Token，改用 GitHub API 源码包更新：$archive_url"
    curl --fail --location --silent --show-error \
      -H "Authorization: Bearer ${GITHUB_TOKEN}" \
      -H "Accept: application/vnd.github+json" \
      "$archive_url" | tar -xzf - -C "$temp_dir"
  else
    archive_url="https://codeload.github.com/${repo_slug}/tar.gz/refs/heads/${TARGET_BRANCH}"
    echo "检测到当前目录缺少可用 Git 同步能力，改用公开源码包更新：$archive_url"
    curl --fail --location --silent --show-error "$archive_url" | tar -xzf - -C "$temp_dir"
  fi

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
  local auth_url
  if git fetch origin "$TARGET_BRANCH"; then
    git checkout "$TARGET_BRANCH"
    git reset --hard "origin/$TARGET_BRANCH"
    return 0
  fi

  auth_url="$(authenticated_git_url)"
  if [ -n "$auth_url" ]; then
    echo "origin 拉取失败，改用带鉴权的 GitHub HTTPS 地址重试。"
    git fetch "$auth_url" "$TARGET_BRANCH"
    git checkout "$TARGET_BRANCH"
    git reset --hard FETCH_HEAD
    return 0
  fi

  return 1
}

validate_github_access() {
  if [ -n "$GITHUB_TOKEN" ] && [ -z "$GITHUB_REPO_SLUG" ] && [ ! -d ".git" ]; then
    echo "已配置 GITHUB_TOKEN，但缺少 GITHUB_REPO_SLUG，无法访问 GitHub 私有仓库。"
    exit 1
  fi
}

validate_github_access

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
