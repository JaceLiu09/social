/** 微信小程序 code2Session */
export function isWechatMpConfigured() {
  return Boolean(process.env.WECHAT_MP_APPID && process.env.WECHAT_MP_SECRET);
}

export function getWechatMpAppId() {
  return String(process.env.WECHAT_MP_APPID || "").trim();
}

export async function code2Session(jsCode) {
  const appid = getWechatMpAppId();
  const secret = String(process.env.WECHAT_MP_SECRET || "").trim();
  if (!appid || !secret) {
    throw new Error("微信小程序 AppID/Secret 未配置");
  }
  const code = String(jsCode || "").trim();
  if (!code) throw new Error("缺少 wx.login code");

  const url = new URL("https://api.weixin.qq.com/sns/jscode2session");
  url.searchParams.set("appid", appid);
  url.searchParams.set("secret", secret);
  url.searchParams.set("js_code", code);
  url.searchParams.set("grant_type", "authorization_code");

  const res = await fetch(url.toString());
  const data = await res.json();
  if (data.errcode) {
    throw new Error(data.errmsg || `微信登录失败 (${data.errcode})`);
  }
  if (!data.openid) throw new Error("未获取到 openid");
  return { openid: data.openid, sessionKey: data.session_key, unionid: data.unionid || null };
}
