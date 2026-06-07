#!/usr/bin/env bash
set -euo pipefail

# 在 Mac 上打开 Xcode 并同步 Capacitor iOS 工程。
# 用法：
#   ./scripts/ios-open.sh
#   CAPACITOR_SERVER_URL=https://test.manghe.click ./scripts/ios-open.sh
#   IOS_MODE=bundled ./scripts/ios-open.sh

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ "${IOS_MODE:-remote}" = "bundled" ]; then
  npm run ios:prepare:bundled
else
  if [ -n "${CAPACITOR_SERVER_URL:-}" ]; then
    node scripts/cap-server-url.mjs remote "${CAPACITOR_SERVER_URL}"
  else
    npm run cap:remote
  fi
  npm run cap:sync:remote
fi

npx cap open ios
