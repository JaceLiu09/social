import Taro from "@tarojs/taro";
import { API_BASE } from "../constants";
import { getAuth } from "../utils/storage";

export function request(path, options = {}) {
  const auth = getAuth();
  const header = {
    "Content-Type": "application/json",
    ...(options.header || {})
  };
  if (auth?.token) {
    header.Authorization = `Bearer ${auth.token}`;
  }
  const rel = String(path || "").trim();
  const url = rel.startsWith("http") ? rel : `${API_BASE}${rel.startsWith("/") ? rel : `/${rel}`}`;
  return Taro.request({
    ...options,
    url,
    header
  });
}

export async function requestJson(path, options = {}) {
  const res = await request(path, options);
  const data = res.data || {};
  if (res.statusCode >= 400) {
    const msg = data.message || data.error || `请求失败 (${res.statusCode})`;
    throw new Error(msg);
  }
  return data;
}
