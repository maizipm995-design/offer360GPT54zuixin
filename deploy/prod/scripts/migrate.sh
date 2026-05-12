#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/../../.env}"
APP_IMAGE_TAG="${APP_IMAGE_TAG:-${1:-}}"

if [ -z "$APP_IMAGE_TAG" ]; then
  echo "请通过 APP_IMAGE_TAG 环境变量或脚本第一个参数传入迁移镜像标签。"
  exit 1
fi

# shellcheck disable=SC1091
source "$SCRIPT_DIR/common.sh"

ensure_commands docker
load_env
load_state

export APP_IMAGE_TAG

compose_cmd up -d mysql redis elasticsearch
compose_cmd run --rm migrator

echo "数据库迁移执行完成：$APP_IMAGE_TAG"
