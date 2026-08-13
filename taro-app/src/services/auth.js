import Taro from "@tarojs/taro";
import { requestJson } from "./api";
import { setAuth, clearAuth, getAuth, updateStoredUser } from "../utils/storage";

export async function loginWithPassword(phone, password) {
  const data = await requestJson("/auth/login", {
    method: "POST",
    data: { phone: String(phone || "").trim(), password }
  });
  setAuth(data.token, data.user);
  return data;
}

export async function registerBasic(phone, password, smsCode = "123456") {
  const data = await requestJson("/auth/register-basic", {
    method: "POST",
    data: {
      phone: String(phone || "").trim(),
      password,
      smsCode: String(smsCode || "").trim()
    }
  });
  setAuth(data.token, data.user);
  return data;
}

export async function completeProfile(payload) {
  const data = await requestJson("/auth/complete-profile", {
    method: "POST",
    data: payload
  });
  updateStoredUser(data.user);
  return data;
}

export async function patchProfile(payload) {
  const data = await requestJson("/auth/profile", {
    method: "PATCH",
    data: payload
  });
  updateStoredUser(data.user);
  return data;
}

export function logout() {
  clearAuth();
  Taro.reLaunch({ url: "/pages/login/index" });
}

export function isLoggedIn() {
  return Boolean(getAuth()?.token);
}

export function getCurrentUser() {
  return getAuth()?.user || null;
}

export function needsProfileSetup(user = getCurrentUser()) {
  return Boolean(user && !user.profileCompleted);
}

export function ensureLoggedIn() {
  if (!isLoggedIn()) {
    Taro.reLaunch({ url: "/pages/login/index" });
    return false;
  }
  return true;
}

export function ensureProfileOrRedirect(user = getCurrentUser()) {
  if (needsProfileSetup(user)) {
    Taro.redirectTo({ url: "/pages/profile-setup/index" });
    return false;
  }
  return true;
}
