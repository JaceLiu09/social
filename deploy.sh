#!/usr/bin/env bash
set -euo pipefail

# =========================
# Deploy Config
# =========================
BRANCH="${BRANCH:-main}"
# 显式走 ssh.github.com:443，避免 22 端口问题
GIT_REPO_SSH="${GIT_REPO_SSH:-ssh://git@ssh.github.com:443/JaceLiu09/social.git}"

BASE_DIR="${BASE_DIR:-/root/social-deploy}"
APP_DIR="${APP_DIR:-${BASE_DIR}/app}"

SERVER_IP="${SERVER_IP:-112.124.51.207}"
FRONTEND_PORT="${FRONTEND_PORT:-4175}"
ADMIN_CONSOLE_PORT="${ADMIN_CONSOLE_PORT:-4176}"
BACKEND_PORT="${BACKEND_PORT:-4000}"

# 浏览器实际访问的 HTTPS 域名（与 Nginx server_name 一致，勿末尾斜杠）。
# Nginx 机反代 /oss-media、/match 等到本机 BACKEND_PORT 时，前端应走同源域名，避免跨域与混合内容。
PUBLIC_SITE_URL="${PUBLIC_SITE_URL:-https://test.manghe.click}"

# 前端 / 管理后台构建时注入的 API 基址（默认 = PUBLIC_SITE_URL）。
# 仅内网直连调试时手动指定，例如：VITE_API_BASE_URL=http://127.0.0.1:4000
# 不推荐再用 IP（HTTPS 页面会跨域）：VITE_API_BASE_URL=http://${SERVER_IP}:${BACKEND_PORT}
if [ "${USE_LEGACY_IP_API:-0}" = "1" ]; then
  export VITE_API_BASE_URL="${VITE_API_BASE_URL:-http://${SERVER_IP}:${BACKEND_PORT}}"
  export VITE_ADMIN_API_BASE_URL="${VITE_ADMIN_API_BASE_URL:-http://${SERVER_IP}:${BACKEND_PORT}}"
else
  export VITE_API_BASE_URL="${VITE_API_BASE_URL:-${PUBLIC_SITE_URL}}"
  export VITE_ADMIN_API_BASE_URL="${VITE_ADMIN_API_BASE_URL:-${PUBLIC_SITE_URL}}"
fi
# 本地开发管理后台并指向远端 API：admin-console 目录 npm run dev:remote（见 admin-console/dev-remote.sh）

# Git/SSH 连接参数（不再强制 -p，URL 已含 443）
export GIT_TERMINAL_PROMPT=0
export GIT_SSH_COMMAND="ssh -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new -o ConnectTimeout=8 -o ConnectionAttempts=1 -o ServerAliveInterval=5 -o ServerAliveCountMax=2"

echo "==> [1/12] Load nvm & node（CentOS7 等旧系统 glibc 低，勿用 Node 20；使用 Node 16 LTS + sharp@0.32）"
export NVM_DIR="/root/.nvm"
. "$NVM_DIR/nvm.sh"
if ! nvm use 16 >/dev/null 2>&1; then
  echo "Node 16 未安装，正在 nvm install 16 …"
  nvm install 16
  nvm use 16 >/dev/null
fi
node -v

echo "==> [2/12] Preflight GitHub SSH:443 (retry)"
# 认证提示这句是正常的，不影响
timeout 20s ssh -T -p 443 git@ssh.github.com || true

ok=0
for i in 1 2 3; do
  echo "$(date '+%F %T') ls-remote attempt $i..."
  if timeout 60s git ls-remote "${GIT_REPO_SSH}" >/dev/null; then
    ok=1
    break
  fi
  sleep 2
done

if [ "$ok" -ne 1 ]; then
  echo "ERROR: cannot reach/auth GitHub via SSH:443 after retries."
  echo "Manual check:"
  echo "  timeout 60s git ls-remote ${GIT_REPO_SSH}"
  exit 1
fi

echo "==> [3/12] Prepare app dir"
mkdir -p "${BASE_DIR}"

echo "==> [4/12] Clone or fetch/reset (with retry + progress)"
if [ ! -d "${APP_DIR}/.git" ]; then
  echo "first deploy: clone"
  rm -rf "${APP_DIR}"
  cd "${BASE_DIR}"

  for i in 1 2 3; do
    echo "$(date '+%F %T') clone attempt $i..."
    if timeout 180s git clone --progress --depth=1 --single-branch --branch "${BRANCH}" "${GIT_REPO_SSH}" "${APP_DIR}"; then
      break
    fi
    if [ "$i" -eq 3 ]; then
      echo "clone failed after 3 attempts"
      exit 1
    fi
    sleep 2
  done
else
  echo "incremental deploy: fetch/reset"
  cd "${APP_DIR}"

  git remote set-url origin "${GIT_REPO_SSH}"

  fetched=0
  for i in 1 2 3; do
    echo "$(date '+%F %T') fetch attempt $i..."
    if timeout 120s git fetch --progress --prune --depth=1 origin "${BRANCH}"; then
      fetched=1
      break
    fi
    sleep 2
  done

  if [ "$fetched" -ne 1 ]; then
    echo "fetch failed after 3 attempts"
    exit 1
  fi

  git checkout -B "${BRANCH}" FETCH_HEAD
  git reset --hard FETCH_HEAD
  # 仅删「未跟踪且未被 .gitignore 忽略」的文件；backend/uploads/ 已忽略，避免每次发布清空用户图
  git clean -fd
fi

echo "==> [5/12] Verify latest code"
cd "${APP_DIR}"
git rev-parse HEAD
git log -1 --oneline

echo "==> [6/12] Backend deps"
cd "${APP_DIR}/backend"
npm ci

echo "==> [7/12] Prisma generate + db push + seed"
npx prisma generate
npx prisma db push
npm run seed

echo "==> [8/12] Frontend deps"
cd "${APP_DIR}/frontend"
npm ci

echo "==> [9/12] Frontend build"
echo "PUBLIC_SITE_URL=${PUBLIC_SITE_URL}"
echo "VITE_API_BASE_URL=${VITE_API_BASE_URL}"
npm run build
if grep -rq "112.124.51.207" dist 2>/dev/null; then
  echo "WARN: frontend dist 仍含 112.124.51.207，请确认 VITE_API_BASE_URL 是否为 HTTPS 域名"
fi

echo "==> [10/12] Admin console deps"
cd "${APP_DIR}/admin-console"
npm ci

echo "==> [11/12] Admin console build"
echo "VITE_ADMIN_API_BASE_URL=${VITE_ADMIN_API_BASE_URL}"
npm run build

echo "==> [12/12] Restart services (PM2)"
# 与 backend server.js 中 PORT 一致；勿在 Node 16 环境上升 sharp≥0.33（需 Node≥18.17）
export PORT="${BACKEND_PORT}"
export PUBLIC_SITE_URL="${PUBLIC_SITE_URL}"
if pm2 describe social-backend >/dev/null 2>&1; then
  pm2 restart social-backend --update-env
else
  pm2 start npm --name social-backend --cwd "${APP_DIR}/backend" -- run start
fi

if pm2 describe social-frontend >/dev/null 2>&1; then
  pm2 restart social-frontend --update-env
else
  pm2 start npm --name social-frontend --cwd "${APP_DIR}/frontend" -- run preview -- --host 0.0.0.0 --port "${FRONTEND_PORT}"
fi

if pm2 describe social-admin >/dev/null 2>&1; then
  pm2 restart social-admin --update-env
else
  pm2 start npm --name social-admin --cwd "${APP_DIR}/admin-console" -- run preview -- --host 0.0.0.0 --port "${ADMIN_CONSOLE_PORT}"
fi

pm2 save
pm2 ls

echo "Deploy done."
echo "用户端（Nginx 反代后）:  ${PUBLIC_SITE_URL}/"
echo "用户端（应用机直连）:    http://${SERVER_IP}:${FRONTEND_PORT}/"
echo "Admin 控制台（直连）:    http://${SERVER_IP}:${ADMIN_CONSOLE_PORT}/"
echo "Backend（本机）:         http://127.0.0.1:${BACKEND_PORT}/"
echo "构建 API 基址:           ${VITE_API_BASE_URL}"
echo ""
echo "说明: 管理后台已注入 API（VITE_ADMIN_API_BASE_URL）；默认 admin / 123456（seed）。"
echo "若浏览器仍请求 http://${SERVER_IP}:${BACKEND_PORT}：请确认已用本脚本重建并强刷缓存。"
echo "若 ERR_CONNECTION_REFUSED: 1) 安全组放行 ${BACKEND_PORT}  2) pm2 logs social-backend  3) curl -sS http://127.0.0.1:${BACKEND_PORT}/health"
