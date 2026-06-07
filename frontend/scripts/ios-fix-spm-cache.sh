#!/usr/bin/env bash
# 修复 Xcode Run 失败：Could not resolve package dependencies / Capacitor.xcframework.zip
# 常见原因：GitHub 下载超时或 SwiftPM 缓存损坏（国内网络尤甚）
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
IOS_APP="$ROOT/ios/App"
ART_DIR="${HOME}/Library/Caches/org.swift.swiftpm/artifacts"
CAP_VER="8.4.0"

CAP_NAME="https___github_com_ionic_team_capacitor_swift_pm_releases_download_${CAP_VER}_Capacitor_xcframework_zip"
COR_NAME="https___github_com_ionic_team_capacitor_swift_pm_releases_download_${CAP_VER}_Cordova_xcframework_zip"
CAP_FILE="$ART_DIR/$CAP_NAME"
COR_FILE="$ART_DIR/$COR_NAME"

CAP_URL="https://github.com/ionic-team/capacitor-swift-pm/releases/download/${CAP_VER}/Capacitor.xcframework.zip"
COR_URL="https://github.com/ionic-team/capacitor-swift-pm/releases/download/${CAP_VER}/Cordova.xcframework.zip"

mkdir -p "$ART_DIR"

download_artifact() {
  local url="$1"
  local dest="$2"
  local label="$3"
  local mirrors=(
    "$url"
    "https://ghfast.top/${url}"
    "https://mirror.ghproxy.com/${url}"
  )
  rm -f "$dest"
  for mirror in "${mirrors[@]}"; do
    echo "==> 下载 ${label} …"
    echo "    ${mirror}"
    if curl -L --http1.1 --connect-timeout 20 --max-time 300 -o "$dest" "$mirror"; then
      if unzip -t "$dest" >/dev/null 2>&1; then
        echo "    OK ($(wc -c < "$dest" | tr -d ' ') bytes)"
        return 0
      fi
      echo "    压缩包损坏，换镜像重试"
      rm -f "$dest"
    fi
  done
  echo "ERROR: 无法下载 ${label}，请开 VPN 后重试本脚本" >&2
  return 1
}

ensure_artifact() {
  local file="$1"
  local url="$2"
  local label="$3"
  if [[ -f "$file" ]] && unzip -t "$file" >/dev/null 2>&1; then
    echo "==> ${label} 缓存正常"
    return 0
  fi
  [[ -f "$file" ]] && rm -f "$file"
  download_artifact "$url" "$file" "$label"
}

echo "==> [SPM] 检查 Capacitor 二进制缓存"
ensure_artifact "$CAP_FILE" "$CAP_URL" "Capacitor.xcframework"
ensure_artifact "$COR_FILE" "$COR_URL" "Cordova.xcframework"

echo "==> [SPM] 解析 Swift Package"
xcodebuild -resolvePackageDependencies -project "$IOS_APP/App.xcodeproj" -scheme App >/dev/null
echo "==> [SPM] 依赖解析完成，可在 Xcode 中 Run"
