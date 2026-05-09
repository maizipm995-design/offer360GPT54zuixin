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
load_state
render_active_upstream "${ACTIVE_SLOT:-blue}"

mkdir -p "${WECHAT_PAY_CERTS_HOST_PATH:-/opt/offer360/certs}"

compose_cmd up -d mysql redis elasticsearch gateway

cat <<EOF
生产环境基础设施初始化完成：
- 部署目录：$ROOT_DIR
- 环境文件：$ENV_FILE
- 当前激活槽位：${ACTIVE_SLOT:-blue}
- 网关健康检查：http://127.0.0.1:${GATEWAY_HTTP_PORT:-80}/__gateway_health

下一步：
1. 补齐 $ENV_FILE 中的全部生产环境变量。
2. 把微信支付证书放入 ${WECHAT_PAY_CERTS_HOST_PATH:-/opt/offer360/certs}。
3. 由 CI/CD 传入 APP_IMAGE_TAG 调用 scripts/deploy-release.sh 执行正式发布。
EOF
