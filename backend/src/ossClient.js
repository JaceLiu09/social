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

/**
 * 公网读 URL（需 Bucket/对象 ACL 或策略允许匿名读；或用 CDN 自定义域自行填 ALIYUN_OSS_PUBLIC_BASE_URL）
 * @param {string} objectKey 不含前导 /
 */
export function publicUrlForObjectKey(objectKey) {
  const key = String(objectKey || "").replace(/^\/+/, "");
  const base = process.env.ALIYUN_OSS_PUBLIC_BASE_URL?.trim().replace(/\/$/, "");
  if (base) return `${base}/${key}`;
  const bucket = process.env.ALIYUN_OSS_BUCKET.trim();
  const region = process.env.ALIYUN_OSS_REGION.trim();
  return `https://${bucket}.${region}.aliyuncs.com/${key}`;
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
