#!/usr/bin/env bash
set -euo pipefail

# 用法:
# bash redeploy.sh [project_dir] [branch]
# 示例:
# bash redeploy.sh /root/social-main main

PROJECT_DIR="${1:-/root/social-main}"
BRANCH="${2:-main}"

FRONTEND_DIR="$PROJECT_DIR/frontend"
BACKEND_DIR="$PROJECT_DIR/backend"

echo "[1/7] 进入项目目录: $PROJECT_DIR"
cd "$PROJECT_DIR"

echo "[2/7] 拉取最新代码"
git fetch origin
git checkout "$BRANCH"
git pull origin "$BRANCH"

echo "[3/7] 安装前后端依赖"
npm --prefix "$FRONTEND_DIR" install
npm --prefix "$BACKEND_DIR" install

echo "[4/7] 构建前端"
npm --prefix "$FRONTEND_DIR" run build

echo "[5/7] 同步 Prisma"
npx --prefix "$BACKEND_DIR" prisma generate
npx --prefix "$BACKEND_DIR" prisma db push

echo "[6/7] 重启后端 PM2 进程"
if pm2 describe blindbox-backend >/dev/null 2>&1; then
  pm2 restart blindbox-backend
else
  pm2 start "$BACKEND_DIR/src/server.js" --name blindbox-backend
fi

echo "[7/7] 重启前端 PM2 静态服务"
if pm2 describe blindbox-frontend >/dev/null 2>&1; then
  pm2 delete blindbox-frontend
fi
pm2 serve "$FRONTEND_DIR/dist" 5173 --name blindbox-frontend --spa

pm2 save
echo "部署完成。"
echo "前端: http://<服务器IP>:5173"
echo "后端: http://<服务器IP>:4000"
