#!/usr/bin/env bash
set -euo pipefail

MP_ROOT="${MP_ROOT:-/root/social-miniprogram}"
REPO_DIR="${MP_ROOT}/repo"
BRANCH="${BRANCH:-feat/taro-miniprogram}"
export PATH="/usr/local/node16/bin:${PATH}"
export GIT_TERMINAL_PROMPT=0

cd "${REPO_DIR}"
git fetch --depth=1 origin "${BRANCH}"
git checkout -B "${BRANCH}" "origin/${BRANCH}"
git reset --hard "origin/${BRANCH}"

cd taro-app
npm ci
npm run build:weapp

pm2 restart social-miniprogram-artifact 2>/dev/null || true
echo "重建完成: ${REPO_DIR}/taro-app/dist"
