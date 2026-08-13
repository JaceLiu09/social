import Taro from "@tarojs/taro";
import { requestJson } from "./api";

export async function bindWechatOpenId() {
  const loginRes = await Taro.login();
  const code = loginRes.code;
  if (!code) throw new Error("wx.login 未返回 code");
  return requestJson("/auth/wechat/bind", {
    method: "POST",
    data: { code }
  });
}

export async function ensureWechatOpenId() {
  try {
    await bindWechatOpenId();
  } catch (error) {
    throw new Error(error.message || "微信授权失败，请重试");
  }
}

export function invokeWechatPayment(wechatPay) {
  const params = wechatPay || {};
  return new Promise((resolve, reject) => {
    Taro.requestPayment({
      timeStamp: String(params.timeStamp || ""),
      nonceStr: String(params.nonceStr || ""),
      package: String(params.package || ""),
      signType: params.signType || "RSA",
      paySign: String(params.paySign || ""),
      success: resolve,
      fail: (err) => reject(new Error(err.errMsg || "支付已取消"))
    });
  });
}

export async function confirmWechatPayment(orderType, orderId) {
  return requestJson("/payments/wechat/confirm", {
    method: "POST",
    data: { orderType, orderId }
  });
}
