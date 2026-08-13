import crypto from "node:crypto";
import fs from "node:fs";

const API_BASE = "https://api.mch.weixin.qq.com";

function readPrivateKey() {
  const inline = String(process.env.WECHAT_MCH_PRIVATE_KEY || "").trim();
  if (inline.includes("BEGIN PRIVATE KEY")) return inline;
  const keyPath = String(process.env.WECHAT_MCH_PRIVATE_KEY_PATH || "").trim();
  if (keyPath && fs.existsSync(keyPath)) {
    return fs.readFileSync(keyPath, "utf8");
  }
  return "";
}

export function isWechatPayConfigured() {
  return Boolean(
    process.env.WECHAT_MCH_ID &&
      process.env.WECHAT_MCH_SERIAL_NO &&
      process.env.WECHAT_MCH_API_V3_KEY &&
      getWechatMpAppId() &&
      readPrivateKey()
  );
}

function getWechatMpAppId() {
  return String(process.env.WECHAT_MP_APPID || "").trim();
}

function getMchId() {
  return String(process.env.WECHAT_MCH_ID || "").trim();
}

function getApiV3Key() {
  return String(process.env.WECHAT_MCH_API_V3_KEY || "").trim();
}

function getNotifyUrl() {
  const raw = String(process.env.WECHAT_PAY_NOTIFY_URL || "").trim();
  if (raw) return raw;
  const site = String(process.env.PUBLIC_SITE_URL || "https://manghe.me").replace(/\/$/, "");
  return `${site}/payments/wechat/notify`;
}

function randomNonce(len = 16) {
  return crypto.randomBytes(len).toString("hex");
}

function signRsaSha256(message) {
  const key = readPrivateKey();
  const sign = crypto.createSign("RSA-SHA256");
  sign.update(message);
  sign.end();
  return sign.sign(key, "base64");
}

function buildAuthorization(method, urlPath, bodyObj) {
  const timestamp = Math.floor(Date.now() / 1000);
  const nonce = randomNonce();
  const body = bodyObj ? JSON.stringify(bodyObj) : "";
  const message = `${method}\n${urlPath}\n${timestamp}\n${nonce}\n${body}\n`;
  const signature = signRsaSha256(message);
  const token = [
    `mchid="${getMchId()}"`,
    `nonce_str="${nonce}"`,
    `signature="${signature}"`,
    `timestamp="${timestamp}"`,
    `serial_no="${String(process.env.WECHAT_MCH_SERIAL_NO || "").trim()}"`
  ].join(",");
  return { authorization: `WECHATPAY2-SHA256-RSA2048 ${token}`, timestamp, nonce };
}

async function wechatPayRequest(method, urlPath, bodyObj) {
  const { authorization } = buildAuthorization(method, urlPath, bodyObj);
  const res = await fetch(`${API_BASE}${urlPath}`, {
    method,
    headers: {
      Authorization: authorization,
      Accept: "application/json",
      "Content-Type": "application/json"
    },
    body: bodyObj ? JSON.stringify(bodyObj) : undefined
  });
  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch (_e) {
    data = { raw: text };
  }
  if (!res.ok) {
    throw new Error(data.message || data.code || `微信支付请求失败 (${res.status})`);
  }
  return data;
}

export function buildOutTradeNo(orderType, orderId) {
  const prefix = orderType === "membership" ? "vip" : "coin";
  const id = String(orderId || "").replace(/[^a-zA-Z0-9]/g, "").slice(0, 24);
  return `${prefix}_${id}`.slice(0, 32);
}

export function parseOutTradeNo(outTradeNo) {
  const s = String(outTradeNo || "");
  if (s.startsWith("vip_")) return { orderType: "membership", orderId: s.slice(4) };
  if (s.startsWith("coin_")) return { orderType: "coin", orderId: s.slice(5) };
  return null;
}

export async function createJsapiPrepay({ description, outTradeNo, amountYuan, openid }) {
  if (!isWechatPayConfigured()) throw new Error("微信支付未配置");
  const appid = getWechatMpAppId();
  const total = Math.max(1, Math.round(Number(amountYuan) * 100));
  const body = {
    appid,
    mchid: getMchId(),
    description: String(description || "盲盒星球").slice(0, 127),
    out_trade_no: outTradeNo,
    notify_url: getNotifyUrl(),
    amount: { total, currency: "CNY" },
    payer: { openid }
  };
  const data = await wechatPayRequest("POST", "/v3/pay/transactions/jsapi", body);
  if (!data.prepay_id) throw new Error("未获取到 prepay_id");
  return buildMiniProgramPayParams(data.prepay_id, appid);
}

function buildMiniProgramPayParams(prepayId, appId) {
  const timeStamp = String(Math.floor(Date.now() / 1000));
  const nonceStr = randomNonce();
  const packageValue = `prepay_id=${prepayId}`;
  const message = `${appId}\n${timeStamp}\n${nonceStr}\n${packageValue}\n`;
  return {
    timeStamp,
    nonceStr,
    package: packageValue,
    signType: "RSA",
    paySign: signRsaSha256(message)
  };
}

export async function queryTransactionByOutTradeNo(outTradeNo) {
  const mchid = getMchId();
  const urlPath = `/v3/pay/transactions/out-trade-no/${encodeURIComponent(outTradeNo)}?mchid=${encodeURIComponent(mchid)}`;
  return wechatPayRequest("GET", urlPath, null);
}

function decryptNotifyResource(resource) {
  const key = getApiV3Key();
  const { ciphertext, nonce, associated_data: associatedData } = resource || {};
  if (!ciphertext || !nonce || !key) throw new Error("回调解密参数不完整");
  const cipherBuf = Buffer.from(ciphertext, "base64");
  const authTag = cipherBuf.subarray(cipherBuf.length - 16);
  const data = cipherBuf.subarray(0, cipherBuf.length - 16);
  const decipher = crypto.createDecipheriv("aes-256-gcm", Buffer.from(key, "utf8"), Buffer.from(nonce, "utf8"));
  if (associatedData) decipher.setAAD(Buffer.from(associatedData, "utf8"));
  decipher.setAuthTag(authTag);
  const decoded = Buffer.concat([decipher.update(data), decipher.final()]);
  return JSON.parse(decoded.toString("utf8"));
}

export function parseWechatPayNotify(reqBody) {
  const body = reqBody || {};
  if (body.event_type !== "TRANSACTION.SUCCESS") {
    return { handled: false, reason: "ignored_event" };
  }
  const plain = decryptNotifyResource(body.resource);
  if (plain.trade_state !== "SUCCESS") {
    return { handled: false, reason: "not_success", plain };
  }
  const parsed = parseOutTradeNo(plain.out_trade_no);
  if (!parsed) return { handled: false, reason: "unknown_trade_no", plain };
  return { handled: true, parsed, plain };
}
