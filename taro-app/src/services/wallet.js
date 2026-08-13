import { getCurrentUser } from "./auth";
import { requestJson } from "./api";
import { ensureWechatOpenId, invokeWechatPayment, confirmWechatPayment } from "./wechat";

function requireUserId() {
  const user = getCurrentUser();
  if (!user?.id) throw new Error("请先登录");
  return user.id;
}

export function fetchWallet() {
  return requestJson("/wallet");
}

export function fetchCoinPackages() {
  return requestJson("/coins/packages");
}

export function fetchCoinLedger(limit = 30) {
  return requestJson(`/coins/ledger?limit=${limit}`);
}

export async function createCoinOrder(packageId) {
  return requestJson("/coins/recharge/orders", {
    method: "POST",
    data: {
      userId: requireUserId(),
      packageId,
      paymentChannel: "WECHAT"
    }
  });
}

export async function createMembershipOrder(plan) {
  return requestJson("/membership/orders", {
    method: "POST",
    data: {
      userId: requireUserId(),
      plan,
      paymentChannel: "WECHAT"
    }
  });
}

async function payWithWechat(orderType, orderId) {
  await ensureWechatOpenId();
  const payPath =
    orderType === "membership"
      ? `/membership/orders/${encodeURIComponent(orderId)}/pay`
      : `/coins/recharge/orders/${encodeURIComponent(orderId)}/pay`;
  const prepay = await requestJson(payPath, {
    method: "POST",
    data: {
      userId: requireUserId(),
      paymentMode: "wechat_jsapi"
    }
  });
  if (prepay.wechatPay) {
    await invokeWechatPayment(prepay.wechatPay);
    return confirmWechatPayment(orderType, orderId);
  }
  return prepay;
}

async function payWithMock(orderType, orderId) {
  const payPath =
    orderType === "membership"
      ? `/membership/orders/${encodeURIComponent(orderId)}/pay`
      : `/coins/recharge/orders/${encodeURIComponent(orderId)}/pay`;
  return requestJson(payPath, {
    method: "POST",
    data: {
      userId: requireUserId(),
      paymentMode: "mock"
    }
  });
}

export async function payCoinOrder(orderId) {
  try {
    return await payWithWechat("coin", orderId);
  } catch (error) {
    const msg = String(error.message || "");
    if (/cancel|取消/.test(msg)) throw error;
    if (/未配置|503|微信/.test(msg)) {
      return payWithMock("coin", orderId);
    }
    throw error;
  }
}

export async function payMembershipOrder(orderId) {
  try {
    return await payWithWechat("membership", orderId);
  } catch (error) {
    const msg = String(error.message || "");
    if (/cancel|取消/.test(msg)) throw error;
    if (/未配置|503|微信/.test(msg)) {
      return payWithMock("membership", orderId);
    }
    throw error;
  }
}

export function fetchMembershipRedeemOptions() {
  return requestJson("/membership/points-redeem");
}

export async function redeemMembership(redeemId) {
  return requestJson("/membership/redeem", {
    method: "POST",
    data: { redeemId }
  });
}
