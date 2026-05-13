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

/** 将 OSS / ali-oss 常见英文错误转成可读中文，便于前端 Toast 展示 */
export function humanizeOssError(err) {
  const code = String(err?.code || err?.name || "");
  const raw = String(err?.message || (typeof err === "string" ? err : "") || "").trim();
  const blob = `${code} ${raw}`.trim();
  if (/UserDisable/i.test(blob)) {
    return "阿里云 OSS 提示账号已禁用（UserDisable）：请在 RAM 控制台启用该子账号，或更换一对有效的 AccessKey。";
  }
  if (/InvalidAccessKeyId/i.test(blob)) {
    return "OSS AccessKeyId 无效或未开通，请检查 ALIYUN_OSS_ACCESS_KEY_ID。";
  }
  if (/SignatureDoesNotMatch/i.test(blob)) {
    return "OSS 签名不匹配，请核对 ALIYUN_OSS_ACCESS_KEY_SECRET 与 Region/Bucket 是否一致。";
  }
  if (/NoSuchBucket/i.test(blob)) {
    return "OSS 中不存在该 Bucket，请检查 ALIYUN_OSS_BUCKET 与 Region。";
  }
  if (/AccessDenied/i.test(blob)) {
    return "OSS 拒绝访问（权限不足或策略限制），请检查 RAM 策略与 Bucket 权限。";
  }
  return raw || "OSS 上传失败";
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
  const customEndpoint = process.env.ALIYUN_OSS_ENDPOINT?.trim();
  const regionalEndpoint = `https://${region}.aliyuncs.com`;
  const isAccessPoint =
    Boolean(customEndpoint) && customEndpoint.toLowerCase().includes("oss-accesspoint.aliyuncs.com");
  const forceApSdk = ["1", "true", "yes"].includes(
    String(process.env.ALIYUN_OSS_USE_AP_FOR_SDK || "").toLowerCase()
  );

  let endpoint;
  let sldEnable;
  let authorizationV4;

  if (customEndpoint && (!isAccessPoint || forceApSdk)) {
    endpoint = customEndpoint;
    const endpointLc = endpoint.toLowerCase();
    const apHost = endpointLc.includes("oss-accesspoint.aliyuncs.com");
    const envSld = process.env.ALIYUN_OSS_SLD;
    sldEnable =
      envSld === "0" || envSld === "false"
        ? false
        : envSld === "1" || envSld === "true"
          ? true
          : apHost;
    const envV4 = process.env.ALIYUN_OSS_AUTH_V4;
    authorizationV4 =
      envV4 === "0" || envV4 === "false"
        ? false
        : envV4 === "1" || envV4 === "true"
          ? true
          : apHost;
  } else {
    // 配置了接入点但未强制走接入点 SDK 时：ali-oss 对接入点常出现 SignatureDoesNotMatch，与 test-oss-upload 一致改用区域 Endpoint 签名
    endpoint = regionalEndpoint;
    sldEnable = false;
    authorizationV4 = false;
  }

  const secure = endpoint.startsWith("https://");
  cachedClient = new OSS({
    region,
    accessKeyId: process.env.ALIYUN_OSS_ACCESS_KEY_ID.trim(),
    accessKeySecret: process.env.ALIYUN_OSS_ACCESS_KEY_SECRET.trim(),
    bucket: process.env.ALIYUN_OSS_BUCKET.trim(),
    endpoint,
    secure,
    sldEnable,
    authorizationV4
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
