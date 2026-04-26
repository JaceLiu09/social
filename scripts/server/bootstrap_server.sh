#!/usr/bin/env bash
set -euo pipefail

# 用法:
# bash bootstrap_server.sh <git_repo_url> [branch] [project_dir]
# 示例:
# bash bootstrap_server.sh git@github.com:yourname/social-main.git main /root/social-main

GIT_REPO_URL="${1:-}"
BRANCH="${2:-main}"
PROJECT_DIR="${3:-/root/social-main}"

if [[ -z "$GIT_REPO_URL" ]]; then
  echo "缺少 git 仓库地址。"
  echo "用法: bash bootstrap_server.sh <git_repo_url> [branch] [project_dir]"
  exit 1
fi

if ! command -v git >/dev/null 2>&1; then
  apt-get update -y
  apt-get install -y git
fi

if ! command -v node >/dev/null 2>&1; then
  echo "未检测到 Node.js，请先安装 Node.js 18+。"
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "未检测到 npm，请先安装 npm。"
  exit 1
fi

if [[ ! -d "$PROJECT_DIR/.git" ]]; then
  rm -rf "$PROJECT_DIR"
  git clone -b "$BRANCH" "$GIT_REPO_URL" "$PROJECT_DIR"
else
  echo "检测到已有仓库目录: $PROJECT_DIR"
fi

cd "$PROJECT_DIR"

# PM2 用于守护前后端进程
if ! command -v pm2 >/dev/null 2>&1; then
  npm install -g pm2
fi

chmod +x scripts/server/redeploy.sh
echo "初始化完成。下一步执行:"
echo "bash $PROJECT_DIR/scripts/server/redeploy.sh $PROJECT_DIR"
