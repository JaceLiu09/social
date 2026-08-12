#!/usr/bin/env bash
# 在 ECS 上构建 Taro 微信小程序（输出 taro-app/dist/）
set -euo pipefail

APP_DIR="${APP_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
TARO_DIR="${APP_DIR}/taro-app"

echo "==> Taro 小程序构建（API: https://manghe.me）"
echo "    目录: ${TARO_DIR}"

if [ -s /root/.nvm/nvm.sh ]; then
  export NVM_DIR="/root/.nvm"
  # shellcheck source=/dev/null
  . "$NVM_DIR/nvm.sh"
  nvm use 16 >/dev/null 2>&1 || nvm use 16
elif [ -x /usr/local/node16/bin/node ]; then
  export PATH="/usr/local/node16/bin:${PATH}"
fi

echo "Node: $(node -v)"

cd "${TARO_DIR}"
if [ -f package-lock.json ]; then
  npm ci
else
  npm install
fi
npm run build:weapp

echo ""
echo "构建完成: ${TARO_DIR}/dist/"
echo "下一步:"
echo "  1) 用微信开发者工具打开目录: taro-app/（miniprogramRoot 指向 dist/）"
echo "  2) 或打包 dist/ 下载到本机预览 / 真机调试"
echo "  3) 小程序请求已全部指向 https://manghe.me"
