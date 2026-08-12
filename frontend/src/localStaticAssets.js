import { Capacitor } from "@capacitor/core";
import avatarManifest from "./avatarManifest.json";

const CITY_POOL = ["上海", "深圳", "广州", "杭州", "成都", "北京", "重庆", "南京"];
const HOBBIES_POOL = {
  MALE: ["篮球,健身,电影", "跑步,摄影,咖啡", "露营,自驾,音乐", "羽毛球,桌游,旅行"],
  FEMALE: ["旅行,探店,摄影", "阅读,瑜伽,电影", "烘焙,插花,音乐", "羽毛球,徒步,美食"]
};

export function shouldPreferLocalSeedAvatars() {
  try {
    return Capacitor.isNativePlatform();
  } catch (_error) {
    return false;
  }
}

/** OSS / manifest 路径 → 内置 public/avatars 相对路径 */
export function mapSeedAssetToLocal(raw) {
  if (!shouldPreferLocalSeedAvatars()) return null;
  const s = String(raw ?? "").trim();
  if (!s) return null;
  if (s.startsWith("/avatars/")) return s.split("#")[0];
  const ossMatch = s.match(/seed-avatars\/(male|female)\/([^/?#]+)/i);
  if (ossMatch) return `/avatars/${ossMatch[1]}/${ossMatch[2]}`;
  try {
    if (/^https?:\/\//i.test(s) || s.startsWith("//")) {
      const u = new URL(s.startsWith("//") ? `https:${s}` : s);
      const i = u.pathname.indexOf("/avatars/");
      if (i !== -1) return u.pathname.slice(i).split("#")[0];
      const ossInPath = u.pathname.match(/seed-avatars\/(male|female)\/([^/?#]+)/i);
      if (ossInPath) return `/avatars/${ossInPath[1]}/${ossInPath[2]}`;
    }
  } catch (_error) {
    /* ignore */
  }
  return null;
}

function buildProfileFromAvatar(src, index, gender) {
  const male = gender === "MALE";
  return {
    id: `local-${gender.toLowerCase()}-${index}`,
    nickname: `隐藏款${male ? "男" : "女"}${String(index + 1).padStart(3, "0")}`,
    age: 18 + (index % 9),
    city: CITY_POOL[index % CITY_POOL.length],
    hometown: CITY_POOL[(index + 2) % CITY_POOL.length],
    hobbies: HOBBIES_POOL[gender][index % HOBBIES_POOL[gender].length],
    avatar: src,
    gender,
    galleryUrls: [src]
  };
}

/** 登录页固定 8 张（均为 frontend/public 内置图，避免 OSS/CDN 偶发 404） */
const LOGIN_HERO_AVATAR_PATHS = [
  "/avatars/male/male-002.jpg",
  "/avatars/male/male-005.jpg",
  "/avatars/male/male-007.jpg",
  "/avatars/male/male-008.jpeg",
  "/avatars/female/female-001.jpg",
  "/avatars/female/female-002.jpg",
  "/avatars/female/female-003.jpg",
  "/avatars/female/female-004.jpg"
];

export function getLocalLoginHeroAvatars(count = 8) {
  const picked = LOGIN_HERO_AVATAR_PATHS.slice(0, count);
  return picked.map((src, i) => ({
    src,
    gender: src.includes("/male/") ? "MALE" : "FEMALE",
    alt: "",
    key: `local-hero-${i}-${src}`
  }));
}

export function getLocalSystemRobotProfiles(viewerGender = "MALE", count = 12) {
  const preferredGender = viewerGender === "MALE" ? "FEMALE" : "MALE";
  const pool =
    preferredGender === "FEMALE" ? avatarManifest.female || [] : avatarManifest.male || [];
  return pool.slice(0, count).map((src, index) => buildProfileFromAvatar(src, index, preferredGender));
}

/** Web 开发或接口无数据时，用内置头像做星球推荐兜底 */
export function getSystemRobotProfilesFallback(viewerGender = "MALE", count = 12) {
  return getLocalSystemRobotProfiles(viewerGender, count);
}

function collectLocalDisplayUrls(viewerGender = "MALE") {
  const urls = new Set();
  for (const item of getLocalLoginHeroAvatars(8)) urls.add(item.src);
  for (const profile of getLocalSystemRobotProfiles(viewerGender, 12)) {
    urls.add(profile.avatar);
    for (const u of profile.galleryUrls || []) urls.add(u);
  }
  return [...urls].map((raw) => mapSeedAssetToLocal(raw) || raw);
}

export function preloadLocalDisplayAssets(viewerGender = "MALE") {
  if (!shouldPreferLocalSeedAvatars()) return Promise.resolve();
  const urls = collectLocalDisplayUrls(viewerGender);
  return Promise.all(
    urls.map(
      (src) =>
        new Promise((resolve) => {
          const img = new Image();
          img.onload = () => resolve(true);
          img.onerror = () => resolve(false);
          img.src = src.startsWith("/") ? src : src;
        })
    )
  );
}
