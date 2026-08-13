import Taro from "@tarojs/taro";

const AUTH_KEY = "blindbox_auth";

export function setAuth(token, user) {
  Taro.setStorageSync(AUTH_KEY, {
    token: String(token || ""),
    user: user || null
  });
}

export function getAuth() {
  try {
    const raw = Taro.getStorageSync(AUTH_KEY);
    if (!raw?.token) return null;
    return raw;
  } catch (_error) {
    return null;
  }
}

export function clearAuth() {
  try {
    Taro.removeStorageSync(AUTH_KEY);
  } catch (_error) {
    /* ignore */
  }
}

export function updateStoredUser(user) {
  const auth = getAuth();
  if (!auth?.token) return;
  setAuth(auth.token, user);
}
