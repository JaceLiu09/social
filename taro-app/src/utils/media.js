import { IMAGE_CDN_BASE } from "../constants";

/** /avatars/male/x.jpg → CDN */
export function resolveAvatarUrl(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  const m = s.match(/^\/avatars\/(male|female)\/([^/?#]+)$/i);
  if (m) {
    return `${IMAGE_CDN_BASE}/fake-pictures/seed-avatars/${m[1]}/${m[2]}`;
  }
  if (s.startsWith("/uploads/") || s.startsWith("/oss-media/")) {
    return `https://manghe.me${s}`;
  }
  return s;
}
