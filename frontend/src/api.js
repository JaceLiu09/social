const API_BASE = "http://localhost:3001/api";

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.message || "请求失败");
  }

  return response.json();
}

export const api = {
  registerProfile(payload) {
    return request("/users/register", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  getPlazaPosts() {
    return request("/plaza/posts");
  },
  matchBlindbox(userId) {
    return request("/match/start", {
      method: "POST",
      body: JSON.stringify({ userId })
    });
  },
  playRound(sessionId, payload) {
    return request(`/match/${sessionId}/round`, {
      method: "POST",
      body: JSON.stringify(payload)
    });
  }
};
