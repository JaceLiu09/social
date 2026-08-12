import { shouldPreferSameOriginMedia } from "./wechatEnv.js";

/** OSS 图片 CDN（img.manghe.me 回源 manghe-social 桶，边缘缓存 30 天） */
export const IMAGE_CDN_BASE = String(import.meta.env.VITE_IMAGE_CDN_BASE || "https://img.manghe.me")
  .trim()
  .replace(/\/$/, "");

export function ossPathToSameOriginApiUrl(apiBase, ossPath, search = "") {
  const base = String(apiBase || "")
    .trim()
    .replace(/\/$/, "");
  if (!base) return null;
  const p = ossPath.startsWith("/") ? ossPath : `/${ossPath}`;
  return `${base}/oss-media${p}${search}`;
}

function rewriteCdnUrlToSameOrigin(apiBase, cdnUrl) {
  if (!cdnUrl || !shouldPreferSameOriginMedia()) return null;
  try {
    const u = new URL(cdnUrl);
    const ossRest = ossObjectPathFromUrlPathname(u.pathname);
    if (ossRest) return ossPathToSameOriginApiUrl(apiBase, ossRest, u.search || "");
  } catch (_error) {
    /* ignore */
  }
  return null;
}

const OSS_MARKERS = ["/fake-pictures/", "/chat-history-pictures/", "/zhenren-pictures/"];

export function ossObjectPathFromUrlPathname(pathname) {
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  for (const marker of OSS_MARKERS) {
    const i = path.indexOf(marker);
    if (i !== -1) return path.slice(i);
  }
  return null;
}

export function ossObjectToCdnUrl(ossPath, search = "") {
  const p = ossPath.startsWith("/") ? ossPath : `/${ossPath}`;
  return `${IMAGE_CDN_BASE}${p}${search}`;
}

/** /avatars/male/x.jpg → CDN 上的 seed-avatars 对象 */
export function seedAvatarPathToCdn(localAvatarPath) {
  const m = String(localAvatarPath || "").match(/^\/avatars\/(male|female)\/([^/?#]+)$/i);
  if (!m) return null;
  return `${IMAGE_CDN_BASE}/fake-pictures/seed-avatars/${m[1]}/${m[2]}`;
}

/** /oss-media/{key} 或 OSS 路径 → img CDN（聊天头像、用户上传图） */
export function resolveOssMediaToCdnUrl(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  if (s.startsWith("/oss-media/")) {
    const key = s.slice("/oss-media/".length).split("#")[0];
    const path = `/${key.replace(/^\/+/, "")}`;
    const ossRest = ossObjectPathFromUrlPathname(path);
    if (ossRest) {
      const [pathOnly, search = ""] = ossRest.split("?");
      return ossObjectToCdnUrl(pathOnly, search ? `?${search}` : "");
    }
  }
  const ossRest = ossObjectPathFromUrlPathname(s.startsWith("/") ? s.split("#")[0] : `/${s.split("#")[0]}`);
  if (ossRest) return ossObjectToCdnUrl(ossRest.split("?")[0]);
  return null;
}

/** seed-avatars OSS/CDN 路径 → 站点内置 /avatars（随前端 dist 部署，小程序同源加载） */
export function seedAvatarUrlToBundledPath(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  if (s.startsWith("/avatars/")) return s.split("#")[0];
  const ossMatch = s.match(/seed-avatars\/(male|female)\/([^/?#]+)/i);
  if (ossMatch) return `/avatars/${ossMatch[1]}/${ossMatch[2]}`;
  try {
    if (/^https?:\/\//i.test(s) || s.startsWith("//")) {
      const u = new URL(s.startsWith("//") ? `https:${s}` : s);
      if (u.pathname.startsWith("/avatars/")) return u.pathname.split("#")[0];
      const inPath = u.pathname.match(/seed-avatars\/(male|female)\/([^/?#]+)/i);
      if (inPath) return `/avatars/${inPath[1]}/${inPath[2]}`;
    }
  } catch (_error) {
    /* ignore */
  }
  return null;
}

/** 展示用：小程序 web-view 走同源 /oss-media，其余走 img CDN */
export function resolveSeedAvatarDisplayUrl(raw, apiBase) {
  if (shouldPreferSameOriginMedia()) {
    const bundled = seedAvatarUrlToBundledPath(raw);
    if (bundled) return bundled;
  }
  const sameOrigin = rewriteCdnUrlToSameOrigin(apiBase, resolveSeedAvatarCdnUrl(raw));
  if (sameOrigin) return sameOrigin;
  return resolveSeedAvatarCdnUrl(raw);
}

/** localhost /avatars、/oss-media 等 → img CDN */
export function resolveSeedAvatarCdnUrl(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return null;

  if (s.startsWith("/avatars/")) {
    return seedAvatarPathToCdn(s.split("#")[0]);
  }
  if (s.startsWith("/oss-media/fake-pictures/seed-avatars/")) {
    const tail = s.replace(/^\/oss-media\/fake-pictures\/seed-avatars\//, "").split("#")[0];
    return tail ? seedAvatarPathToCdn(`/avatars/${tail}`) : null;
  }
  if (s.startsWith("/fake-pictures/seed-avatars/")) {
    return ossObjectToCdnUrl(s.split("#")[0]);
  }

  try {
    if (/^https?:\/\//i.test(s) || s.startsWith("//")) {
      const u = new URL(s.startsWith("//") ? `https:${s}` : s);
      if (u.pathname.startsWith("/avatars/")) {
        return seedAvatarPathToCdn(u.pathname.split("#")[0]);
      }
      const ossRest = ossObjectPathFromUrlPathname(u.pathname);
      if (ossRest?.startsWith("/fake-pictures/seed-avatars/")) {
        return ossObjectToCdnUrl(ossRest, u.search || "");
      }
      const ossInPath = u.pathname.match(/seed-avatars\/(male|female)\/([^/?#]+)/i);
      if (ossInPath) {
        return seedAvatarPathToCdn(`/avatars/${ossInPath[1]}/${ossInPath[2]}`);
      }
    }
  } catch (_error) {
    /* ignore */
  }
  return null;
}

/** 展示用：小程序 web-view 走同源 /oss-media，其余走 img CDN */
export function resolveOssMediaDisplayUrl(raw, apiBase) {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  if (shouldPreferSameOriginMedia() && apiBase) {
    if (s.startsWith("/oss-media/")) {
      return `${String(apiBase).replace(/\/$/, "")}${s.split("#")[0]}`;
    }
    const sameOrigin = rewriteCdnUrlToSameOrigin(apiBase, resolveOssMediaToCdnUrl(raw));
    if (sameOrigin) return sameOrigin;
  }
  return resolveOssMediaToCdnUrl(raw);
}
