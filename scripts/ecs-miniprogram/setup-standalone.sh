#!/usr/bin/env bash
# 在 ECS 上初始化独立小程序工程目录（与 /root/social-deploy/app 分离）
set -euo pipefail

MP_ROOT="${MP_ROOT:-/root/social-miniprogram}"
REPO_DIR="${MP_ROOT}/repo"
GIT_REPO="${GIT_REPO_SSH:-ssh://git@ssh.github.com:443/JaceLiu09/social.git}"
BRANCH="${BRANCH:-feat/taro-miniprogram}"
ARTIFACT_PORT="${ARTIFACT_PORT:-4188}"
export PATH="/usr/local/node16/bin:${PATH}"
export GIT_TERMINAL_PROMPT=0
export GIT_SSH_COMMAND="${GIT_SSH_COMMAND:-ssh -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new -o ConnectTimeout=15}"

echo "==> 小程序独立目录: ${MP_ROOT}"
mkdir -p "${MP_ROOT}"

if [ ! -d "${REPO_DIR}/.git" ]; then
  echo "==> 首次 clone (${BRANCH})"
  git clone --depth=1 --single-branch --branch "${BRANCH}" "${GIT_REPO}" "${REPO_DIR}"
else
  echo "==> 更新代码"
  cd "${REPO_DIR}"
  git remote set-url origin "${GIT_REPO}"
  git fetch --depth=1 origin "${BRANCH}"
  git checkout -B "${BRANCH}" "origin/${BRANCH}"
  git reset --hard "origin/${BRANCH}"
fi

echo "==> 安装依赖并构建 weapp"
cd "${REPO_DIR}/taro-app"
if [ -f package-lock.json ]; then
  npm ci
else
  npm install
fi
npm run build:weapp

ln -sfn "${REPO_DIR}/taro-app/dist" "${MP_ROOT}/dist"
ln -sfn "${REPO_DIR}/taro-app" "${MP_ROOT}/taro-app"

echo "==> pm2: 小程序构建产物静态目录（仅方便下载/检查，非微信运行服务）"
pm2 delete social-miniprogram-artifact 2>/dev/null || true
pm2 start npx --name social-miniprogram-artifact --cwd "${REPO_DIR}/taro-app" -- serve -s dist -l "${ARTIFACT_PORT}"
pm2 save

echo ""
echo "完成。"
echo "  源码:     ${REPO_DIR}"
echo "  构建产物: ${REPO_DIR}/taro-app/dist"
echo "  快捷路径: ${MP_ROOT}/dist"
echo "  产物 HTTP: http://$(curl -sS --max-time 3 http://100.100.100.200/latest/meta-data/eipv4 2>/dev/null || echo 127.0.0.1):${ARTIFACT_PORT}/"
echo "  重新构建: bash ${REPO_DIR}/scripts/ecs-miniprogram/rebuild.sh"
echo ""
echo "说明: 微信小程序在用户手机微信里运行，API 仍走 https://manghe.me；"
echo "      ECS 上这里是「独立目录 + 构建 + 产物浏览」，不是给用户的线上服务。"
