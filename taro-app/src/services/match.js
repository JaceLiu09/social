import Taro from "@tarojs/taro";
import { requestJson } from "./api";
import { getCurrentUser } from "./auth";
import { saveMatchResult } from "../utils/matchCache";

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function startPlanetMatch({ onProgress } = {}) {
  const user = getCurrentUser();
  if (!user?.id) throw new Error("请先登录");

  const minWaitMs = Math.round(3000 + Math.random() * 2000);
  const startedAt = Date.now();
  const tick = () => {
    const sec = Math.floor((Date.now() - startedAt) / 1000);
    onProgress?.(`附近雷达扫描中，已 ${sec} 秒`);
  };
  tick();
  const timer = setInterval(tick, 250);

  try {
    const [, data] = await Promise.all([
      wait(minWaitMs),
      requestJson("/match/start", {
        method: "POST",
        data: { userId: user.id }
      })
    ]);

    const profile = data.targetPlanetProfile || null;
    const payload = {
      session: data.session,
      targetBlindBox: data.targetBlindBox,
      profile,
      randomKm: profile ? 1 + Math.floor(Math.random() * 120) : null
    };
    saveMatchResult(payload);
    return payload;
  } finally {
    clearInterval(timer);
    onProgress?.("");
  }
}

export async function startMatchFlow() {
  Taro.showLoading({ title: "匹配中…", mask: true });
  try {
    await startPlanetMatch({
      onProgress: (hint) => {
        if (hint) Taro.showLoading({ title: hint, mask: true });
      }
    });
    Taro.hideLoading();
    Taro.navigateTo({ url: "/pages/match/index" });
  } catch (error) {
    Taro.hideLoading();
    Taro.showToast({ title: error.message || "匹配失败", icon: "none" });
  }
}
