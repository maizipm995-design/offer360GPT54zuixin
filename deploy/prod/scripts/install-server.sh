#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/../../.env}"

# shellcheck disable=SC1091
source "$SCRIPT_DIR/common.sh"

ensure_commands docker curl
load_env
ensure_runtime_layout

sudo_mkdir() {
  local target="$1"
  if mkdir -p "$target" 2>/dev/null; then
    return 0
  fi
  if command -v sudo >/dev/null 2>&1; then
    sudo mkdir -p "$target"
    return 0
  fi
  echo "无法创建目录：$target"
  exit 1
}

sudo_mkdir "${WECHAT_PAY_CERTS_HOST_PATH:-/opt/offer360/certs}"
sudo_mkdir /etc/nginx/ssl/www.offer360.cn
sudo_mkdir /srv/sites

cat <<'NGINX_HINT'
请把仓库中的 Nginx 文件覆盖到宿主机：
  deploy/prod/nginx/docker-proxy-map.conf -> /etc/nginx/conf.d/docker-proxy-map.conf
  deploy/prod/nginx/docker-proxy-common.conf -> /etc/nginx/snippets/docker-proxy-common.conf
  deploy/prod/nginx/offer360.conf -> /etc/nginx/sites-available/offer360.conf

后续新增 Docker 站点时，可复制：
  deploy/prod/nginx/docker-site.template.conf -> /etc/nginx/sites-available/<站点名>.conf

后续新增普通文件夹站点时，可复制：
  deploy/prod/nginx/folder-site.template.conf -> /etc/nginx/sites-available/<站点名>.conf

然后按实际域名、证书目录，以及实际站点根目录或 proxy_pass 端口修改：
  /etc/nginx/sites-available/offer360.conf
  sudo rm -f /etc/nginx/sites-enabled/default
  sudo ln -sf /etc/nginx/sites-available/offer360.conf /etc/nginx/sites-enabled/offer360.conf
  sudo nginx -t
  sudo systemctl reload nginx
NGINX_HINT

cat <<EOF
生产环境基础设施初始化完成：
- 部署目录：$ROOT_DIR
- 环境文件：$ENV_FILE
- Nginx 配置文件：$ROOT_DIR/nginx/offer360.conf
- Nginx 证书目录：/etc/nginx/ssl/www.offer360.cn
- 微信支付证书目录：${WECHAT_PAY_CERTS_HOST_PATH:-/opt/offer360/certs}
- 通用站点根目录：/srv/sites

下一步：
1. 补齐 $ENV_FILE 中的全部生产环境变量。
2. 把 Nginx 证书放入 /etc/nginx/ssl/www.offer360.cn。
3. 把微信支付证书放入 ${WECHAT_PAY_CERTS_HOST_PATH:-/opt/offer360/certs}。
4. 执行 APP_IMAGE_TAG=<版本号> IMAGE_ARCHIVE=<离线包路径> bash scripts/deploy-release.sh 正式发布。
EOF
