const { API_BASE } = require("./config.js");

function request({ path, method = "GET", data }) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${API_BASE}${path}`,
      method,
      data: method === "GET" ? data : data,
      header: { "Content-Type": "application/json" },
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
          return;
        }
        const msg =
          (res.data && (res.data.message || res.data.errMsg)) ||
          `请求失败 ${res.statusCode}`;
        reject(new Error(typeof msg === "string" ? msg : JSON.stringify(msg)));
      },
      fail(err) {
        reject(err.errMsg ? new Error(err.errMsg) : err);
      }
    });
  });
}

module.exports = {
  getPosts: () => request({ path: "/square/posts", method: "GET" }),
  getOnlineCount: () => request({ path: "/match/online-count", method: "GET" }),
  register: (body) =>
    request({ path: "/auth/register", method: "POST", data: body }),
  login: (body) => request({ path: "/auth/login", method: "POST", data: body }),
  startMatch: (userId) =>
    request({ path: "/match/start", method: "POST", data: { userId } }),
  diceRound: (sessionId) =>
    request({ path: "/game/dice-round", method: "POST", data: { sessionId } }),
  unlock: (sessionId, maleUserId) =>
    request({
      path: "/match/unlock",
      method: "POST",
      data: { sessionId, maleUserId }
    }),
  subscribe: (userId, plan) =>
    request({
      path: "/membership/subscribe",
      method: "POST",
      data: { userId, plan }
    })
};
