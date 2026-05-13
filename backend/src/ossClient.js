import OSS from "ali-oss";
import { randomUUID } from "node:crypto";

let cachedClient = null;

export function ossConfigured() {
  return Boolean(
    process.env.ALIYUN_OSS_ACCESS_KEY_ID?.trim() &&
      process.env.ALIYUN_OSS_ACCESS_KEY_SECRET?.trim() &&
      process.env.ALIYUN_OSS_BUCKET?.trim() &&
      process.env.ALIYUN_OSS_REGION?.trim()
  );
}

/** 是否走服务端同源代理 /oss-media/{key}（桶可保持私有，仅用 AK 读） */
function useOssProxyUrls() {
  const base = process.env.ALIYUN_OSS_PUBLIC_BASE_URL?.trim();
  if (base) return false;
  const mode = process.env.ALIYUN_OSS_READ_MODE?.trim().toLowerCase();
  if (mode === "direct") return false;
  const directFlag = process.env.ALIYUN_OSS_USE_DIRECT_URL?.trim().toLowerCase();
  if (directFlag === "1" || directFlag === "true" || directFlag === "yes") return false;
  return true;
}

/** 代理读允许的 object key 前缀（与上传目录一致） */
export function isAllowedOssProxyKey(objectKey) {
  const k = String(objectKey || "").replace(/^\/+/, "");
  if (!k || k.includes("..")) return false;
  return (
    k.startsWith("fake-pictures/") ||
    k.startsWith("chat-history-pictures/") ||
    k.startsWith("zhenren-pictures/")
  );
}

/**
 * 写入 DB / 返回给客户端的「读」URL。
 * - 默认：同源 `/oss-media/{key}`，由服务端持 AK 代理读（桶无需匿名读）。
 * - `ALIYUN_OSS_PUBLIC_BASE_URL`：CDN/自定义域直链（仍公开可读）。
 * - `ALIYUN_OSS_READ_MODE=direct` 或 `ALIYUN_OSS_USE_DIRECT_URL=1`：虚拟主机式 OSS HTTPS URL。
 * @param {string} objectKey 不含前导 /
 */
export function publicUrlForObjectKey(objectKey) {
  const key = String(objectKey || "").replace(/^\/+/, "");
  const base = process.env.ALIYUN_OSS_PUBLIC_BASE_URL?.trim().replace(/\/$/, "");
  if (base) return `${base}/${key}`;
  if (!useOssProxyUrls()) {
    const bucket = process.env.ALIYUN_OSS_BUCKET.trim();
    const region = process.env.ALIYUN_OSS_REGION.trim();
    return `https://${bucket}.${region}.aliyuncs.com/${key}`;
  }
  return `/oss-media/${key}`;
}

function getOssClient() {
  if (!ossConfigured()) {
    throw new Error("OSS 未配置：请设置 ALIYUN_OSS_ACCESS_KEY_ID / SECRET / BUCKET / REGION");
  }
  if (cachedClient) return cachedClient;
  const region = process.env.ALIYUN_OSS_REGION.trim();
  const endpoint = `https://${region}.aliyuncs.com`;
  cachedClient = new OSS({
    region,
    accessKeyId: process.env.ALIYUN_OSS_ACCESS_KEY_ID.trim(),
    accessKeySecret: process.env.ALIYUN_OSS_ACCESS_KEY_SECRET.trim(),
    bucket: process.env.ALIYUN_OSS_BUCKET.trim(),
    endpoint,
    secure: true,
    sldEnable: false,
    authorizationV4: false
  });
  return cachedClient;
}

/**
 * @param {string} objectKey
 */
export async function getOssObjectBuffer(objectKey) {
  const client = getOssClient();
  return client.get(objectKey.replace(/^\/+/, ""));
}

/**
 * @param {string} objectKey
 */
export async function headOssObject(objectKey) {
  const client = getOssClient();
  return client.head(objectKey.replace(/^\/+/, ""));
}

/**
 * @param {string} objectKey
 * @param {Buffer} buffer
 * @param {string} contentType
 */
export async function putObject(buffer, objectKey, contentType) {
  const client = getOssClient();
  await client.put(objectKey.replace(/^\/+/, ""), buffer, {
    headers: { "Content-Type": contentType || "application/octet-stream" }
  });
  return publicUrlForObjectKey(objectKey);
}

/**
 * 管理后台 Fake 机器人图片 → fake-pictures/male|female/
 * @param {"MALE"|"FEMALE"} gender
 */
export async function uploadFakeBotImageBuffer(buffer, ext, gender) {
  const folder = gender === "MALE" ? "male" : "female";
  const safeExt = String(ext || "jpg").replace(/^\./, "") || "jpg";
  const objectKey = `fake-pictures/${folder}/${Date.now()}-${randomUUID()}.${safeExt}`;
  const mime =
    safeExt === "png"
      ? "image/png"
      : safeExt === "webp"
        ? "image/webp"
        : safeExt === "gif"
          ? "image/gif"
          : "image/jpeg";
  return putObject(buffer, objectKey, mime);
}

/**
 * 聊天图：chat-history-pictures/ + thumb；真人资料：zhenren-pictures/ 仅原图
 * @param {"chat-history-pictures"|"zhenren-pictures"} prefix
 */
export async function uploadProfileOrChatImage(buffer, ext, mimeType, prefix) {
  const safeExt = String(ext || "jpg").replace(/^\./, "") || "jpg";
  const stem = `${Date.now()}-${randomUUID()}`;
  const mainKey = `${prefix}/${stem}.${safeExt}`;
  const ct =
    mimeType ||
    (safeExt === "png"
      ? "image/png"
      : safeExt === "webp"
        ? "image/webp"
        : safeExt === "gif"
          ? "image/gif"
          : "image/jpeg");

  const mainUrl = await putObject(buffer, mainKey, ct);

  if (prefix === "zhenren-pictures") {
    return { url: mainUrl, thumbUrl: mainUrl };
  }

  const thumbKey = `chat-history-pictures/thumb/thumb-${stem}.jpg`;
  try {
    const { default: sharp } = await import("sharp");
    const thumbBuf = await sharp(buffer)
      .rotate()
      .resize({ width: 360, height: 360, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 80, mozjpeg: true })
      .toBuffer();
    const thumbUrl = await putObject(thumbBuf, thumbKey, "image/jpeg");
    return { url: mainUrl, thumbUrl };
  } catch (_e) {
    return { url: mainUrl, thumbUrl: mainUrl };
  }
}

/** 聊天语音 */
export async function uploadChatAudioBuffer(buffer, ext, mimeType) {
  const safeExt = String(ext || "webm").replace(/^\./, "") || "webm";
  const objectKey = `chat-history-pictures/audio/${Date.now()}-${randomUUID()}.${safeExt}`;
  const ct = mimeType || "application/octet-stream";
  const url = await putObject(buffer, objectKey, ct);
  return { url, thumbUrl: null };
}
