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
 * 403 / SignatureDoesNotMatch：
 *   部分「接入点 + ali-oss」组合签名仍与服务端不一致（SDK 与接入点演进不同步）。
 *   脚本会在接入点失败时自动改用「区域 Endpoint」重试（同一 Bucket、同一对象键）：
 *   https://{region}.aliyuncs.com （虚拟主机 bucket.region.aliyuncs.com）
 *   业务上仍可用 fake-pictures/ 等前缀；接入点更多是权限与网络边界，可用控制台策略配合。
 *   跳过自动回退： ALIYUN_OSS_SKIP_AP_FALLBACK=1
 *
 * 可选：
 *   ALIYUN_OSS_SLD=0
 *   ALIYUN_OSS_AUTH_V4=0
 */

import OSS from "ali-oss";

function requireEnv(name) {
  const v = process.env[name];
  if (v === undefined || v === null || !String(v).trim()) {
    console.error(`缺少或未设置环境变量: ${name}`);
    console.error("请在本终端先 export（见本文件顶部注释），变量值只能是密钥本身，不要带 accessKeyId 等前缀。");
    process.exit(1);
  }
  return String(v).trim();
}

function regionalPublicEndpoint(region) {
  const r = String(region || "").trim();
  if (!r) return "";
  return `https://${r}.aliyuncs.com`;
}

function isSignatureOr403(err) {
  const msg = String(err?.message || err || "");
  const code = err?.status ?? err?.statusCode;
  return (
    code === 403 ||
    /signature|SignatureDoesNotMatch|signature we calculated/i.test(msg)
  );
}

const prefix = (process.env.ALIYUN_OSS_TEST_PREFIX || "fake-pictures").replace(/^\/+|\/+$/g, "");
const key = `${prefix}/smoke-${Date.now()}.txt`;
const body = Buffer.from(`social-main OSS smoke test ${new Date().toISOString()}\n`, "utf8");

function formatEndpoint(ep) {
  if (!ep) return "";
  if (typeof ep === "string") return ep;
  return ep.href || ep.hostname || String(ep);
}

async function putOnce(label, client) {
  console.log(`Uploading (${label})…`, {
    bucket: client.options.bucket,
    key,
    endpoint: formatEndpoint(client.options.endpoint),
    sldEnable: client.options.sldEnable,
    authorizationV4: client.options.authorizationV4
  });
  const putRes = await client.put(key, body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" }
  });
  console.log("put OK:", putRes.res?.statusCode, putRes.name || key);
  try {
    const head = await client.head(key);
    console.log("head OK:", head.res?.statusCode, "Content-Length:", head.res?.headers?.["content-length"]);
  } catch (e) {
    console.warn("head 警告:", e.message);
  }
}

async function main() {
  const accessKeyId = requireEnv("ALIYUN_OSS_ACCESS_KEY_ID");
  const accessKeySecret = requireEnv("ALIYUN_OSS_ACCESS_KEY_SECRET");
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

  const apHost = endpointLc.includes("oss-accesspoint.aliyuncs.com");
  const envV4 = process.env.ALIYUN_OSS_AUTH_V4;
  const authorizationV4 =
    envV4 === "0" || envV4 === "false"
      ? false
      : envV4 === "1" || envV4 === "true"
        ? true
        : apHost;

  const secure = endpoint.startsWith("https://");
  const clientAp = new OSS({
    region,
    accessKeyId,
    accessKeySecret,
    bucket,
    endpoint,
    secure,
    sldEnable,
    authorizationV4
  });

  try {
    await putOnce("接入点 / 当前 Endpoint", clientAp);
  } catch (firstErr) {
    const skipFb = process.env.ALIYUN_OSS_SKIP_AP_FALLBACK === "1";
    if (apHost && !skipFb && isSignatureOr403(firstErr)) {
      const regUrl = regionalPublicEndpoint(region);
      console.warn("\n接入点请求失败（403/签名），改用区域公网 Endpoint 重试（与控制台「Endpoint」一致）：");
      console.warn(regUrl);
      console.warn(
        "若本次成功，说明 AccessKey 与 Bucket 正常；接入点需单独对照阿里云文档配置桶委托策略，或业务直连区域域名上传。\n"
      );

      const clientRg = new OSS({
        region,
        accessKeyId,
        accessKeySecret,
        bucket,
        endpoint: regUrl,
        secure: true,
        sldEnable: false,
        authorizationV4: false
      });
      try {
        await putOnce("区域 Endpoint（回退）", clientRg);
      } catch (secondErr) {
        const clientRgV4 = new OSS({
          region,
          accessKeyId,
          accessKeySecret,
          bucket,
          endpoint: regUrl,
          secure: true,
          sldEnable: false,
          authorizationV4: true
        });
        console.warn("\n区域 Endpoint + V2 仍失败，再试区域 + V4 …");
        await putOnce("区域 Endpoint + V4", clientRgV4);
      }
    } else {
      throw firstErr;
    }
  }

  console.log("\n成功：可在 OSS 控制台 →", bucket, "→", prefix, "下查看:", key.split("/").pop());
  console.log("\n业务目录前缀约定：");
  console.log("  chat-history-pictures/");
  console.log("  fake-pictures/");
  console.log("  zhenren-pictures/");
}

main().catch((e) => {
  console.error("失败:", e.message || e);
  if (e.status) console.error("HTTP:", e.status);
  if (process.env.DEBUG_OSS) console.error(e.stack);
  process.exit(1);
});
