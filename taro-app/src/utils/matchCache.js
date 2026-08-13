import Taro from "@tarojs/taro";

const MATCH_RESULT_KEY = "planet_match_result";

export function saveMatchResult(payload) {
  Taro.setStorageSync(MATCH_RESULT_KEY, payload || null);
}

export function getMatchResult() {
  try {
    return Taro.getStorageSync(MATCH_RESULT_KEY) || null;
  } catch (_error) {
    return null;
  }
}

export function clearMatchResult() {
  try {
    Taro.removeStorageSync(MATCH_RESULT_KEY);
  } catch (_error) {
    /* ignore */
  }
}
