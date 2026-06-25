/** 构建时注入的 API（deploy 默认 https://test.manghe.click） */
export function getConfiguredApiBaseUrl() {
  return String(import.meta.env.VITE_API_BASE_URL || "")
    .trim()
    .replace(/\/$/, "");
}

/**
 * 按当前页面访问方式决定 API 基址：
 * - IP 直连（:4175 等）→ 同机 :4000
 * - 域名访问且与构建配置同域 → 当前 origin（走 Nginx 反代）
 * - 其余 → 构建配置或 hostname:4000
 */
export function resolveRuntimeApiBaseUrl() {
  const configured = getConfiguredApiBaseUrl();
  if (typeof window === "undefined") {
    return configured || "http://localhost:4000";
  }

  const { protocol, hostname, origin } = window.location;
  const isIpHost = /^(?:\d{1,3}\.){3}\d{1,3}$/.test(hostname);

  if (isIpHost) {
    return `${protocol}//${hostname}:4000`;
  }

  if (configured) {
    try {
      if (new URL(configured).hostname === hostname) {
        return origin.replace(/\/$/, "");
      }
    } catch (_error) {
      /* ignore */
    }
    return configured;
  }

  return `${protocol}//${hostname}:4000`;
}
