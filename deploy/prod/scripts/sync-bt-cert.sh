#!/usr/bin/env bash
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "请使用 root 执行该脚本。"
  exit 1
fi

LE_DOMAIN="${1:-offer360.cn}"
BT_CERT_DOMAIN="${2:-www.offer360.cn}"

LE_DIR="/etc/letsencrypt/live/${LE_DOMAIN}"
BT_DIR="/www/server/panel/vhost/cert/${BT_CERT_DOMAIN}"

if [ ! -f "${LE_DIR}/fullchain.pem" ] || [ ! -f "${LE_DIR}/privkey.pem" ]; then
  echo "未找到 Let's Encrypt 证书文件：${LE_DIR}"
  exit 1
fi

mkdir -p "${BT_DIR}"
cp -f "${LE_DIR}/fullchain.pem" "${BT_DIR}/fullchain.pem"
cp -f "${LE_DIR}/privkey.pem" "${BT_DIR}/privkey.pem"

chmod 644 "${BT_DIR}/fullchain.pem"
chmod 600 "${BT_DIR}/privkey.pem"

/usr/bin/nginx -t
/etc/init.d/nginx reload

echo "证书已同步到宝塔 Nginx：${BT_DIR}"
