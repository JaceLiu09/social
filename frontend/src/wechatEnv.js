/** 是否运行在微信小程序 web-view 内（UA 含 miniProgram 或 JSSDK 注入环境） */
export function isWechatMiniProgramWebView() {
  if (typeof window === "undefined") return false;
  try {
    const p = new URLSearchParams(window.location.search);
    if (p.get("mp") === "1" || p.get("from") === "miniprogram") return true;
  } catch (_error) {
    /* ignore */
  }
  if (window.__wxjs_environment === "miniprogram") return true;
  return /miniprogram/i.test(String(navigator.userAgent || ""));
}

/**
 * 小程序 web-view 内跨域 img CDN 常被拦截或极慢，改走页面同源 /oss-media。
 */
export function shouldPreferSameOriginMedia() {
  return isWechatMiniProgramWebView();
}
