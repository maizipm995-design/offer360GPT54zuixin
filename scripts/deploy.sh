#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

if [ ! -f .env ]; then
  cp .env.example .env
  echo "已根据 .env.example 创建 .env，请按需修改配置后重新执行。"
fi

docker compose --env-file .env up -d --build

echo "offer360 已启动。访问："
echo "- Web: http://localhost:3000"
echo "- API: http://localhost:4000/api"
echo "- Swagger: http://localhost:4000/api/docs"
