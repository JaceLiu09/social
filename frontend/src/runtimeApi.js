/** 构建时注入的 API（deploy 默认 https://test.manghe.click） */
export function getConfiguredApiBaseUrl() {
  return String(import.meta.env.VITE_API_BASE_URL || "")
    .trim()
    .replace(/\/$/, "");
}

function isIpHostname(hostname) {
  return /^(?:\d{1,3}\.){3}\d{1,3}$/.test(hostname);
}

function isLocalHostname(hostname) {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

/**
 * 按当前页面访问方式决定 API 基址：
 * - IP / 本机 dev：与页面同源（Vite preview/server 或 Nginx 反代到 4000）
 * - 正式域名且与构建配置同域 → 当前 origin
 * - 其余 → 构建配置或 hostname:4000
 */
export function resolveRuntimeApiBaseUrl() {
  const configured = getConfiguredApiBaseUrl();
  if (typeof window === "undefined") {
    return configured || "http://localhost:4000";
  }

  const { protocol, hostname, origin } = window.location;

  if (isIpHostname(hostname) || isLocalHostname(hostname)) {
    return origin.replace(/\/$/, "");
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
