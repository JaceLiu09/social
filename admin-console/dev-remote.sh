#!/usr/bin/env bash
# 本地开发：直连远端 API（默认与仓库 deploy.sh 中的 SERVER_IP / BACKEND_PORT 一致）
# 用法：
#   npm run dev:remote
#   SERVER_IP=1.2.3.4 npm run dev:remote
#   VITE_ADMIN_API_BASE_URL=http://example.com:4000 npm run dev:remote
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

SERVER_IP="${SERVER_IP:-112.124.51.207}"
BACKEND_PORT="${BACKEND_PORT:-4000}"
export VITE_ADMIN_API_BASE_URL="${VITE_ADMIN_API_BASE_URL:-http://${SERVER_IP}:${BACKEND_PORT}}"

echo "admin-console dev → API ${VITE_ADMIN_API_BASE_URL}"
exec npx vite
