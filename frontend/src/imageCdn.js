/** OSS 图片 CDN（img.manghe.me 回源 manghe-social 桶，边缘缓存 30 天） */
export const IMAGE_CDN_BASE = String(import.meta.env.VITE_IMAGE_CDN_BASE || "https://img.manghe.me")
  .trim()
  .replace(/\/$/, "");

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
