#!/usr/bin/env bash
# 阿里云 CDN / DNS 一键配置（需本机 aliyun CLI 已 configure）
set -euo pipefail

export PATH="${HOME}/bin:${PATH}"

ECS_IP="${ECS_IP:-47.110.254.176}"
BACKEND_PORT="${BACKEND_PORT:-4000}"
IMAGE_CDN_DOMAIN="${IMAGE_CDN_DOMAIN:-manghe.me}"
APP_DOMAIN="${APP_DOMAIN:-manghe.me}"
OSS_BUCKET="${OSS_BUCKET:-manghe-social}"
OSS_REGION="${OSS_REGION:-oss-cn-hangzhou}"
OSS_ORIGIN="${OSS_BUCKET}.${OSS_REGION}.aliyuncs.com"

echo "==> 查询 CDN 域名"
aliyun cdn DescribeUserDomains --PageSize 20

echo ""
echo "==> ${IMAGE_CDN_DOMAIN} 证书与 CNAME"
aliyun cdn DescribeDomainCertificateInfo --DomainName "${IMAGE_CDN_DOMAIN}" || true
aliyun cdn DescribeCdnDomainDetail --DomainName "${IMAGE_CDN_DOMAIN}" || true

echo ""
echo "==> ${APP_DOMAIN} 归属校验 TXT（需在 manghe.click 解析中添加）"
aliyun cdn DescribeVerifyContent --DomainName "${APP_DOMAIN}" || true

echo ""
echo "==> 添加 ${APP_DOMAIN} CDN（需先完成 manghe.click 归属校验）"
if aliyun cdn AddCdnDomain \
  --DomainName "${APP_DOMAIN}" \
  --CdnType web \
  --Scope domestic \
  --Sources "[{\"content\":\"${ECS_IP}\",\"type\":\"ipaddr\",\"port\":${BACKEND_PORT},\"priority\":\"20\",\"weight\":\"10\"}]" 2>/dev/null; then
  echo "已添加 ${APP_DOMAIN}"
else
  echo "添加失败：请先在 DNS 添加归属校验 TXT 后重试本脚本"
fi

echo ""
echo "==> 服务器 .env 建议（/root/social-deploy/app/backend/.env）"
cat <<EOF
PUBLIC_SITE_URL=https://${APP_DOMAIN}
ALIYUN_OSS_BUCKET=${OSS_BUCKET}
ALIYUN_OSS_REGION=${OSS_REGION}
ALIYUN_OSS_PUBLIC_BASE_URL=https://${IMAGE_CDN_DOMAIN}
EOF

echo ""
echo "==> DNS 检查清单"
echo "1. ${IMAGE_CDN_DOMAIN}  → CNAME → （CDN 控制台显示的 CNAME，如 ${IMAGE_CDN_DOMAIN}.w.kunlunaq.com）"
echo "2. ${APP_DOMAIN}       → CNAME → （添加 CDN 后控制台给出的 CNAME）"
echo "3. manghe.click         → TXT  verification → （DescribeVerifyContent 返回值）"
echo "4. 安全组放行 ${BACKEND_PORT}；部署后 pm2 restart social-backend"
