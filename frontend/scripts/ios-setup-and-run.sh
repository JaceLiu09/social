#!/usr/bin/env bash
set -euo pipefail

# 盲盒星球 iOS 真机安装（推荐方案）
# 前提：Mac 已安装 Xcode.app（App Store）
#
# 用法：
#   ./scripts/ios-setup-and-run.sh
#   ./scripts/ios-setup-and-run.sh --build-only   # 只编译不打开 Xcode
#   DEVELOPMENT_TEAM=XXXXXXXXXX ./scripts/ios-setup-and-run.sh  # 可选：指定 Team ID

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

XCODE_APP="/Applications/Xcode.app"
XCODE_DEV="${XCODE_APP}/Contents/Developer"
BUILD_ONLY=0
if [ "${1:-}" = "--build-only" ]; then
  BUILD_ONLY=1
fi

echo "==> [1/6] 检查 Xcode"
if [ ! -d "$XCODE_APP" ]; then
  echo ""
  echo "未检测到 Xcode。iOS 安装包必须在 Mac 上用 Xcode 签名编译，无法跳过这一步。"
  echo "正在为你打开 App Store 的 Xcode 下载页，请点击「获取/安装」…"
  echo "（约 12GB，装完后重新运行本脚本即可）"
  echo ""
  open "macappstore://apps.apple.com/app/xcode/id497799835" || open "https://apps.apple.com/app/xcode/id497799835"
  exit 1
fi

echo "==> [2/6] 切换开发者目录"
if [ "$(xcode-select -p 2>/dev/null || true)" != "$XCODE_DEV" ]; then
  sudo xcode-select -s "$XCODE_DEV"
fi
sudo xcodebuild -license accept 2>/dev/null || true
xcodebuild -version

echo "==> [3/6] 安装依赖并同步 Capacitor（内置前端包 + 本地静态资源）"
npm install
export VITE_API_BASE_URL="${VITE_API_BASE_URL:-https://manghe.me}"
node scripts/cap-server-url.mjs bundled
npm run build:ios
npx cap sync ios
"$ROOT/scripts/ios-fix-spm-cache.sh"

PROJECT="${ROOT}/ios/App/App.xcodeproj"
SCHEME="App"

echo "==> [4/6] 检测已连接的 iPhone"
DEVICE_LINE=""
if command -v xcrun >/dev/null 2>&1; then
  DEVICE_LINE="$(xcrun xctrace list devices 2>/dev/null | grep -E "iPhone|iPad" | grep -v Simulator | head -1 || true)"
fi
if [ -z "$DEVICE_LINE" ] && command -v instruments >/dev/null 2>&1; then
  DEVICE_LINE="$(instruments -s devices 2>/dev/null | grep -E "iPhone|iPad" | grep -v Simulator | head -1 || true)"
fi

if [ -n "$DEVICE_LINE" ]; then
  echo "已连接设备: $DEVICE_LINE"
  DEVICE_ID="$(echo "$DEVICE_LINE" | sed -n 's/.*\[\([^]]*\)\].*/\1/p')"
else
  echo "未检测到真机（请用数据线连接 iPhone 并点「信任」）。将使用通用 iOS 目标编译。"
  DEVICE_ID=""
fi

echo "==> [5/6] 编译并安装到手机"
XCODEBUILD_ARGS=(
  -project "$PROJECT"
  -scheme "$SCHEME"
  -configuration Debug
  -allowProvisioningUpdates
  CODE_SIGN_STYLE=Automatic
)

if [ -n "${DEVELOPMENT_TEAM:-}" ]; then
  XCODEBUILD_ARGS+=(DEVELOPMENT_TEAM="${DEVELOPMENT_TEAM}")
fi

if [ -n "$DEVICE_ID" ]; then
  XCODEBUILD_ARGS+=(-destination "id=${DEVICE_ID}")
else
  XCODEBUILD_ARGS+=(-destination "generic/platform=iOS")
fi

set +e
xcodebuild "${XCODEBUILD_ARGS[@]}" build install 2>&1 | tail -40
BUILD_EXIT=${PIPESTATUS[0]}
set -e

if [ "$BUILD_EXIT" -ne 0 ]; then
  echo ""
  echo "自动签名/安装失败（常见于尚未在 Xcode 登录 Apple ID）。"
  echo "将打开 Xcode，请你完成最后一次手动操作："
  echo "  1. Signing & Capabilities → Team 选你的 Apple ID"
  echo "  2. 顶部选你的 iPhone → 点 ▶ Run"
  echo ""
  if [ "$BUILD_ONLY" = "0" ]; then
    open "$PROJECT"
  fi
  exit "$BUILD_EXIT"
fi

echo "==> [6/6] 完成"
if [ "$BUILD_ONLY" = "0" ]; then
  echo "App 应已安装到 iPhone。若首次打开提示不受信任："
  echo "  设置 → 通用 → VPN与设备管理 → 信任开发者"
fi
