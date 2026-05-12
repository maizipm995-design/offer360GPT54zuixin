#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/../../.env}"

# shellcheck disable=SC1091
source "$SCRIPT_DIR/common.sh"

ensure_commands docker
load_env
load_state

compose_cmd ps

echo
echo "当前发布状态："
echo "- CURRENT_APP_IMAGE_TAG=${CURRENT_APP_IMAGE_TAG:-}"
echo "- PREVIOUS_APP_IMAGE_TAG=${PREVIOUS_APP_IMAGE_TAG:-}"
echo "- LAST_DEPLOYED_TAG=${LAST_DEPLOYED_TAG:-}"
echo "- LAST_DEPLOYED_AT=${LAST_DEPLOYED_AT:-}"
echo "- LAST_ARCHIVE_PATH=${LAST_ARCHIVE_PATH:-}"
echo "- LAST_ROLLED_BACK_AT=${LAST_ROLLED_BACK_AT:-}"
