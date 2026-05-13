/**
 * 连通性探测：向 OSS 写入一个小对象（不写死在代码里的密钥）。
 *
 * 用法（在项目 backend 目录）：
 *   export ALIYUN_OSS_ACCESS_KEY_ID="..."
 *   export ALIYUN_OSS_ACCESS_KEY_SECRET="..."
 *   export ALIYUN_OSS_BUCKET="fake-images"
 *   export ALIYUN_OSS_REGION="oss-cn-hangzhou"
 *   export ALIYUN_OSS_ENDPOINT="https://xxx.oss-cn-hangzhou.oss-accesspoint.aliyuncs.com"
 *   npm run test:oss
 *
 * 可选：
 *   ALIYUN_OSS_TEST_PREFIX=fake-pictures   （默认 fake-pictures）
 *
 * 接入点说明：
 *   ali-oss 默认用虚拟主机样式，会变成 bucket.接入点域名 → DNS 不存在。
 *   使用 oss-accesspoint 域名时会自动开启 path 样式（sldEnable），请求形如：
 *   https://接入点/Bucket名/对象路径
 *
 * 可选：
 *   ALIYUN_OSS_SLD=0   强制关闭 path 样式（极少用）
 */

import OSS from "ali-oss";

function requireEnv(name) {
  const v = process.env[name];
  if (!v || !String(v).trim()) {
    console.error(`缺少环境变量: ${name}`);
    process.exit(1);
  }
  return String(v).trim();
}

const prefix = (process.env.ALIYUN_OSS_TEST_PREFIX || "fake-pictures").replace(/^\/+|\/+$/g, "");
const key = `${prefix}/smoke-${Date.now()}.txt`;
const body = Buffer.from(`social-main OSS smoke test ${new Date().toISOString()}\n`, "utf8");

async function main() {
  requireEnv("ALIYUN_OSS_ACCESS_KEY_ID");
  requireEnv("ALIYUN_OSS_ACCESS_KEY_SECRET");
  const bucket = requireEnv("ALIYUN_OSS_BUCKET");
  const region = requireEnv("ALIYUN_OSS_REGION");
  const endpoint = requireEnv("ALIYUN_OSS_ENDPOINT");

  if (!endpoint.startsWith("https://") && !endpoint.startsWith("http://")) {
    console.error("ALIYUN_OSS_ENDPOINT 需带协议，例如 https://xxx.oss-cn-hangzhou.oss-accesspoint.aliyuncs.com");
    process.exit(1);
  }

  const endpointLc = endpoint.toLowerCase();
  const envSld = process.env.ALIYUN_OSS_SLD;
  const sldEnable =
    envSld === "0" || envSld === "false"
      ? false
      : envSld === "1" || envSld === "true"
        ? true
        : endpointLc.includes("oss-accesspoint.aliyuncs.com");

  const client = new OSS({
    region,
    accessKeyId: process.env.ALIYUN_OSS_ACCESS_KEY_ID.trim(),
    accessKeySecret: process.env.ALIUN_OSS_ACCESS_KEY_SECRET.trim(),
    bucket,
    endpoint,
    secure: endpoint.startsWith("https://"),
    sldEnable
  });

  console.log("Uploading…", { bucket, key, endpoint, sldEnable });
  const putRes = await client.put(key, body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" }
  });

  console.log("put OK:", putRes.res?.statusCode, putRes.name || key);

  try {
    const head = await client.head(key);
    console.log("head OK:", head.res?.statusCode, "Content-Length:", head.res?.headers?.["content-length"]);
  } catch (e) {
    console.warn("head 警告（权限或接入点策略可能导致 head 失败）:", e.message);
  }

  console.log("\n成功：说明 AccessKey + Endpoint + Bucket 组合可用。");
  console.log("可在 OSS 控制台 → fake-images →", prefix, "下查看对象:", key.split("/").pop());
  console.log("\n业务目录约定（供后续改代码）：");
  console.log("  chat-history-pictures/");
  console.log("  fake-pictures/");
  console.log("  zhenren-pictures/");
}

main().catch((e) => {
  console.error("失败:", e.message || e);
  if (e.status) console.error("HTTP:", e.status);
  process.exit(1);
});
