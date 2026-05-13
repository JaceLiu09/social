/**
 * 将库里仍为「完整 OSS / CDN HTTPS」的媒体地址改成同源代理路径 `/oss-media/{objectKey}`，
 * 避免私有桶下浏览器直连 403。
 *
 * 匹配规则：URL 的 host 为 *.aliyuncs.com，或等于 ALIYUN_OSS_PUBLIC_BASE_URL 的 host，
 * 或列入 OSS_URL_REWRITE_EXTRA_HOSTS；且 pathname 对象键以 fake-pictures/、chat-history-pictures/、zhenren-pictures/ 开头。
 *
 *   cd backend && node scripts/migrate-oss-urls-to-proxy.mjs
 *   OSS_URL_REWRITE_DRY_RUN=1 node scripts/migrate-oss-urls-to-proxy.mjs   # 只打印不改库
 *
 * 依赖：DATABASE_URL（或与 prisma 一致的数据库连接）；无需 OSS AK。
 */

import { prisma } from "../src/prisma.js";

function parsePublicBaseHost() {
  const pub = process.env.ALIYUN_OSS_PUBLIC_BASE_URL?.trim();
  if (!pub) return null;
  try {
    return new URL(pub.startsWith("http") ? pub : `https://${pub}`).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function extraMatchSubstrings() {
  const raw = process.env.OSS_URL_REWRITE_EXTRA_HOSTS?.trim();
  const list = raw ? raw.split(",").map((s) => s.trim()).filter(Boolean) : [];
  const pub = parsePublicBaseHost();
  if (pub) list.push(pub);
  return [...new Set(list)];
}

/** @param {string} hostname */
function hostMatchesRewrite(hostname) {
  const h = String(hostname || "").toLowerCase();
  if (h.endsWith(".aliyuncs.com")) return true;
  for (const sub of extraMatchSubstrings()) {
    if (!sub) continue;
    if (h === sub.toLowerCase()) return true;
  }
  return false;
}

/** @param {string | null | undefined} s */
function rewriteOssHttpToProxy(s) {
  const t = String(s ?? "").trim();
  if (!t || t.startsWith("/oss-media/") || t.startsWith("/uploads/")) {
    return { changed: false, out: t };
  }
  let url;
  try {
    if (t.startsWith("//")) url = new URL(`https:${t}`);
    else if (/^https?:\/\//i.test(t)) url = new URL(t);
    else return { changed: false, out: t };
  } catch {
    return { changed: false, out: t };
  }
  if (!hostMatchesRewrite(url.hostname)) return { changed: false, out: t };
  const path = url.pathname.startsWith("/") ? url.pathname : `/${url.pathname}`;
  const key = path.replace(/^\/+/, "");
  if (!key || key.includes("..")) return { changed: false, out: t };
  if (
    !key.startsWith("fake-pictures/") &&
    !key.startsWith("chat-history-pictures/") &&
    !key.startsWith("zhenren-pictures/")
  ) {
    return { changed: false, out: t };
  }
  return { changed: true, out: `/oss-media/${key}${url.search || ""}` };
}

function buildContainsOr(fields, substrings) {
  const OR = [];
  for (const field of fields) {
    for (const sub of substrings) {
      OR.push({ [field]: { contains: sub } });
    }
  }
  return OR.length ? { OR } : {};
}

async function main() {
  const dry = ["1", "true", "yes"].includes(String(process.env.OSS_URL_REWRITE_DRY_RUN || "").toLowerCase());
  const substrings = ["aliyuncs.com", ...extraMatchSubstrings().filter((s) => s !== "aliyuncs.com")];

  let usersUpdated = 0;
  let messagesUpdated = 0;

  const userWhere = buildContainsOr(["avatarUrl", "photoUrls"], substrings);
  const users = await prisma.user.findMany({
    where: Object.keys(userWhere).length ? userWhere : { id: "__none__" },
    select: { id: true, avatarUrl: true, photoUrls: true }
  });

  if (Object.keys(userWhere).length === 0) {
    console.warn("未配置可匹配的 URL 子串（至少需要库里存在 aliyuncs.com 或设置 OSS_URL_REWRITE_EXTRA_HOSTS）。");
  }

  for (const u of users) {
    let avatarUrl = u.avatarUrl;
    const av = rewriteOssHttpToProxy(avatarUrl);
    if (av.changed) avatarUrl = av.out;

    let photosArr = [];
    try {
      photosArr = JSON.parse(u.photoUrls || "[]");
    } catch {
      photosArr = [];
    }
    if (!Array.isArray(photosArr)) photosArr = [];

    let photosChanged = false;
    const newPhotos = photosArr.map((p) => {
      if (typeof p !== "string") return p;
      const r = rewriteOssHttpToProxy(p);
      if (r.changed) photosChanged = true;
      return r.changed ? r.out : p;
    });

    const avatarChanged = av.changed;
    if (!avatarChanged && !photosChanged) continue;

    if (dry) {
      console.log("[dry-run] User", u.id, {
        avatarUrl: avatarChanged ? { from: u.avatarUrl, to: avatarUrl } : undefined,
        photoUrls: photosChanged ? { from: u.photoUrls, to: JSON.stringify(newPhotos) } : undefined
      });
      usersUpdated++;
      continue;
    }

    await prisma.user.update({
      where: { id: u.id },
      data: {
        ...(avatarChanged ? { avatarUrl } : {}),
        ...(photosChanged ? { photoUrls: JSON.stringify(newPhotos) } : {})
      }
    });
    usersUpdated++;
    console.log("已更新 User", u.id);
  }

  const msgWhere = buildContainsOr(["mediaUrl", "thumbMediaUrl"], substrings);
  const messages = await prisma.chatMessage.findMany({
    where: Object.keys(msgWhere).length ? msgWhere : { id: "__none__" },
    select: { id: true, mediaUrl: true, thumbMediaUrl: true }
  });

  for (const m of messages) {
    const mu = rewriteOssHttpToProxy(m.mediaUrl);
    const tu = rewriteOssHttpToProxy(m.thumbMediaUrl);
    if (!mu.changed && !tu.changed) continue;

    if (dry) {
      console.log("[dry-run] ChatMessage", m.id, {
        mediaUrl: mu.changed ? { from: m.mediaUrl, to: mu.out } : undefined,
        thumbMediaUrl: tu.changed ? { from: m.thumbMediaUrl, to: tu.out } : undefined
      });
      messagesUpdated++;
      continue;
    }

    await prisma.chatMessage.update({
      where: { id: m.id },
      data: {
        ...(mu.changed ? { mediaUrl: mu.out } : {}),
        ...(tu.changed ? { thumbMediaUrl: tu.out } : {})
      }
    });
    messagesUpdated++;
    console.log("已更新 ChatMessage", m.id);
  }

  console.log(
    dry ? `[dry-run] 将改写 User ${usersUpdated} 条、ChatMessage ${messagesUpdated} 条（未写库）。`
      : `完成。改写 User ${usersUpdated} 条、ChatMessage ${messagesUpdated} 条。`
  );
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
