#!/usr/bin/env bash
set -euo pipefail

# 在本地执行，通过 SSH 触发远程部署
# 用法:
# bash deploy_remote.sh <server_ip> [branch] [project_dir]
# 示例:
# bash deploy_remote.sh 112.124.51.207 main /root/social-main

SERVER_IP="${1:-}"
BRANCH="${2:-main}"
PROJECT_DIR="${3:-/root/social-main}"
REMOTE_SCRIPT="$PROJECT_DIR/scripts/server/redeploy.sh"

if [[ -z "$SERVER_IP" ]]; then
  echo "缺少服务器 IP。"
  echo "用法: bash deploy_remote.sh <server_ip> [branch] [project_dir]"
  exit 1
fi

ssh "root@$SERVER_IP" "bash \"$REMOTE_SCRIPT\" \"$PROJECT_DIR\" \"$BRANCH\""
