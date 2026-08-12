import Taro from "@tarojs/taro";
import { requestJson } from "./api";
import { setAuth, clearAuth, getAuth } from "../utils/storage";

export async function loginWithPassword(phone, password) {
  const data = await requestJson("/auth/login", {
    method: "POST",
    data: { phone: String(phone || "").trim(), password }
  });
  setAuth(data.token, data.user);
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
