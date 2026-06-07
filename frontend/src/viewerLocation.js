import { Capacitor } from "@capacitor/core";
import { Geolocation } from "@capacitor/geolocation";

let cached = null;
let cacheTime = 0;
const CACHE_MS = 90_000;

/**
 * 获取当前查看者经纬度（真机走 Capacitor 定位权限，Web 走浏览器 API）。
 * @returns {Promise<{ lat: number, lng: number } | null>}
 */
export async function getViewerLocation({ requestPermission = true } = {}) {
  if (cached && Date.now() - cacheTime < CACHE_MS) {
    return cached;
  }

  try {
    if (Capacitor.isNativePlatform()) {
      let perm = await Geolocation.checkPermissions();
      if (perm.location !== "granted") {
        if (!requestPermission) return null;
        perm = await Geolocation.requestPermissions();
        if (perm.location !== "granted") return null;
      }
      const pos = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 60000
      });
      cached = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      cacheTime = Date.now();
      return cached;
    }

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      return null;
    }

    return await new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          cached = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          cacheTime = Date.now();
          resolve(cached);
        },
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
      );
    });
  } catch {
    return null;
  }
}

export function formatSquareDistanceLabel(km) {
  const n = Number(km);
  if (!Number.isFinite(n) || n < 0) return "距离未知";
  if (n < 1) return "距你小于 1km";
  return `距你 ${n.toFixed(n >= 10 ? 0 : 1)}km`;
}

/** 同一作者多条动态共用同一距离（兜底旧接口随机距离时） */
export function normalizeSquarePostDistances(postList) {
  const byAuthor = new Map();
  return postList.map((post) => {
    const key = String(post.userId || post.nickname || post.id || "");
    if (!byAuthor.has(key)) {
      byAuthor.set(key, post.distanceKm);
    }
    return { ...post, distanceKm: byAuthor.get(key) };
  });
}
