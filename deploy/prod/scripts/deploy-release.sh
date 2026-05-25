#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/../../.env}"
REQUESTED_APP_IMAGE_TAG="${APP_IMAGE_TAG:-${1:-}}"
APP_IMAGE_TAG="$REQUESTED_APP_IMAGE_TAG"
IMAGE_ARCHIVE="${IMAGE_ARCHIVE:-${2:-}}"

if [ -z "$APP_IMAGE_TAG" ]; then
  echo "请通过 APP_IMAGE_TAG 环境变量或脚本第一个参数传入本次发布的镜像标签。"
  exit 1
fi

# shellcheck disable=SC1091
source "$SCRIPT_DIR/common.sh"

verify_web_assets() {
  local local_base_url="http://127.0.0.1:${WEB_PORT_HOST:-3000}"
  local public_base_url="${WEB_APP_BASE_URL:-}"
  local critical_routes=("/" "/resume-optimizer" "/interview-transcript")

  verify_route_assets() {
    local base_url="$1"
    local route_path="$2"
    local route_label="$3"
    local use_browser_ua="${4:-0}"
    local page_url="${base_url%/}${route_path}"
    local page_html asset_list css_count=0

    echo "校验 ${route_label} ..."
    if [ "$use_browser_ua" = "1" ]; then
      page_html="$(curl_with_browser_ua -fsS "$page_url")"
    else
      page_html="$(curl -fsS "$page_url")"
    fi
    asset_list="$(printf '%s' "$page_html" | grep -oE '/_next/static/[^"]+\.(css|js)' | sort -u || true)"

    if [ -z "$asset_list" ]; then
      echo "${route_label} 未解析到任何 /_next/static 资源，发布结果异常。"
      return 1
    fi

    while IFS= read -r asset_path; do
      [ -z "$asset_path" ] && continue
      case "$asset_path" in
        *.css) css_count=$((css_count + 1)) ;;
      esac
      if [ "$use_browser_ua" = "1" ]; then
        curl_with_browser_ua -fsSI "${base_url%/}$asset_path" >/dev/null
      else
        curl -fsSI "${base_url%/}$asset_path" >/dev/null
      fi
    done <<EOF
$asset_list
EOF

    if [ "$css_count" -eq 0 ]; then
      echo "${route_label} 未发现任何 CSS 静态资源链接，发布结果异常。"
      return 1
    fi

    echo "${route_label} 静态资源校验通过。"
  }

  echo "校验 Web 关键路由与静态资源可用性..."
  for route_path in "${critical_routes[@]}"; do
    verify_route_assets "$local_base_url" "$route_path" "本地入口 ${route_path}"
  done

  if [ -n "$public_base_url" ]; then
    for route_path in "${critical_routes[@]}"; do
      verify_route_assets "$public_base_url" "$route_path" "公网入口 ${route_path}" "1"
    done
  fi
}

verify_public_seo_signals() {
  local public_base_url="${WEB_APP_BASE_URL:-}"
  local normalized_public_base_url="${public_base_url%/}"
  local robots_url sitemap_url robots_txt sitemap_xml

  if [ -z "$normalized_public_base_url" ]; then
    echo "未配置 WEB_APP_BASE_URL，跳过 robots/sitemap SEO 验收。"
    return 0
  fi

  robots_url="${normalized_public_base_url}/robots.txt"
  sitemap_url="${normalized_public_base_url}/sitemap.xml"

  echo "校验公网 SEO 入口：robots.txt / sitemap.xml ..."
  robots_txt="$(curl_with_browser_ua -fsS "$robots_url")"
  sitemap_xml="$(curl_with_browser_ua -fsS "$sitemap_url")"

  if printf '%s' "$robots_txt" | grep -Eq 'localhost|127\.0\.0\.1|0\.0\.0\.0'; then
    echo "robots.txt 仍包含本地地址，发布结果异常。"
    return 1
  fi

  if ! printf '%s' "$robots_txt" | grep -Fq "Host: ${normalized_public_base_url}"; then
    echo "robots.txt 未输出正确 Host：${normalized_public_base_url}"
    return 1
  fi

  if ! printf '%s' "$robots_txt" | grep -Fq "Sitemap: ${sitemap_url}"; then
    echo "robots.txt 未输出正确 Sitemap：${sitemap_url}"
    return 1
  fi

  if printf '%s' "$sitemap_xml" | grep -Eq 'localhost|127\.0\.0\.1|0\.0\.0\.0'; then
    echo "sitemap.xml 仍包含本地地址，发布结果异常。"
    return 1
  fi

  if ! printf '%s' "$sitemap_xml" | grep -Fq "<loc>${normalized_public_base_url}</loc>"; then
    echo "sitemap.xml 未包含正式首页 URL：${normalized_public_base_url}"
    return 1
  fi

  if ! printf '%s' "$sitemap_xml" | grep -Fq "<loc>${normalized_public_base_url}/services</loc>"; then
    echo "sitemap.xml 未包含服务列表页 URL。"
    return 1
  fi

  if ! printf '%s' "$sitemap_xml" | grep -Fq "${normalized_public_base_url}/services/"; then
    echo "sitemap.xml 未包含任何服务详情页 URL，发布结果异常。"
    return 1
  fi

  echo "公网 robots/sitemap SEO 验收通过。"
}

cleanup_old_app_images() {
  local keep_tag="$CURRENT_APP_IMAGE_TAG"
  local repo image_ref tag

  for repo in offer360-api offer360-web offer360-wechat-pay-gateway; do
    while IFS= read -r image_ref; do
      [ -z "$image_ref" ] && continue
      tag="${image_ref#${repo}:}"
      if [ "$tag" != "$keep_tag" ]; then
        docker_cmd image rm "$image_ref" >/dev/null 2>&1 || true
      fi
    done < <(docker_cmd image ls "$repo" --format '{{.Repository}}:{{.Tag}}')
  done

  docker_cmd image prune -f >/dev/null 2>&1 || true
}

cleanup_release_archives() {
  local keep_count="${KEEP_RELEASE_ARCHIVE_COUNT:-1}"
  local archive_dir current_archive_path extra_keep_count

  archive_dir="$(dirname "${IMAGE_ARCHIVE:-$ROOT_DIR/../../offer360-offline-${APP_IMAGE_TAG}.tar}")"
  current_archive_path="${IMAGE_ARCHIVE:-$archive_dir/offer360-offline-${APP_IMAGE_TAG}.tar}"
  extra_keep_count=$((keep_count - 1))

  if [ ! -d "$archive_dir" ]; then
    return 0
  fi

  find "$archive_dir" -maxdepth 1 -type f -name 'offer360-offline-*.tar' -print \
    | sort -r \
    | awk -v keep="$extra_keep_count" -v current="$current_archive_path" '
        $0 == current { next }
        seen < keep { seen++; next }
        { print }
      ' \
    | while IFS= read -r archive_path; do
        [ -z "$archive_path" ] && continue
        rm -f "$archive_path"
      done
}

cleanup_db_backups() {
  local keep_count="${KEEP_DB_BACKUP_COUNT:-1}"
  local backup_dir="$ROOT_DIR/runtime/db-backups"

  if [ ! -d "$backup_dir" ]; then
    return 0
  fi

  find "$backup_dir" -maxdepth 1 -type f -name 'offer360-predeploy-*.sql.gz' -print \
    | sort -r \
    | awk -v keep="$keep_count" 'NR > keep { print }' \
    | while IFS= read -r backup_path; do
        [ -z "$backup_path" ] && continue
        rm -f "$backup_path"
      done
}

ensure_commands docker curl
load_env
load_state
APP_IMAGE_TAG="$REQUESTED_APP_IMAGE_TAG"

if [ -n "$IMAGE_ARCHIVE" ]; then
  if [ ! -f "$IMAGE_ARCHIVE" ]; then
    echo "离线镜像包不存在：$IMAGE_ARCHIVE"
    exit 1
  fi
  echo "正在导入离线镜像包：$IMAGE_ARCHIVE"
  docker_cmd load -i "$IMAGE_ARCHIVE"
fi

previous_tag="${CURRENT_APP_IMAGE_TAG:-}"

export APP_IMAGE_TAG

echo "开始发布离线镜像标签：$APP_IMAGE_TAG"
for required_service in mysql redis elasticsearch; do
  if ! compose_cmd ps --status running --services | grep -qx "$required_service"; then
    echo "依赖服务未运行：$required_service"
    echo "为了避免发布脚本自动启动或重建现有基础容器，已停止本次发布。请先手动确认该服务。"
    exit 1
  fi
done

if [ "${SKIP_DB_BACKUP:-0}" = "1" ] || [ -z "${previous_tag:-}" ]; then
  echo "跳过数据库备份：首次发布或显式禁用备份。"
else
  ENV_FILE="$ENV_FILE" bash "$SCRIPT_DIR/backup-db.sh"
fi

ENV_FILE="$ENV_FILE" APP_IMAGE_TAG="$APP_IMAGE_TAG" bash "$SCRIPT_DIR/schema-sync.sh"
ENV_FILE="$ENV_FILE" COMPOSE_FILE="$COMPOSE_FILE" bash "$SCRIPT_DIR/cleanup-app-runtime.sh"
compose_cmd up -d --no-deps --force-recreate --remove-orphans wechat-pay-gateway api web

wait_for_http "http://127.0.0.1:${API_PORT_HOST:-4000}/healthz" "API" 40 5
wait_for_http "http://127.0.0.1:${WEB_PORT_HOST:-3000}/healthz" "Web" 40 5
verify_web_assets
verify_public_seo_signals

PREVIOUS_APP_IMAGE_TAG="${previous_tag:-}"
CURRENT_APP_IMAGE_TAG="$APP_IMAGE_TAG"
LAST_DEPLOYED_TAG="$APP_IMAGE_TAG"
LAST_DEPLOYED_AT="$(date '+%Y-%m-%d %H:%M:%S %z')"
LAST_ARCHIVE_PATH="${IMAGE_ARCHIVE:-}"
write_state

cat <<EOF
发布成功：
- 镜像标签：$APP_IMAGE_TAG
- 上一版本：${PREVIOUS_APP_IMAGE_TAG:-无}
- Web 健康检查：http://127.0.0.1:${WEB_PORT_HOST:-3000}/healthz
- API 健康检查：http://127.0.0.1:${API_PORT_HOST:-4000}/healthz
EOF

echo "清理无用的历史镜像以释放磁盘空间..."
cleanup_old_app_images
echo "清理旧离线包，仅保留最近 ${KEEP_RELEASE_ARCHIVE_COUNT:-1} 个..."
cleanup_release_archives
echo "清理旧数据库备份，仅保留最近 ${KEEP_DB_BACKUP_COUNT:-1} 个..."
cleanup_db_backups
