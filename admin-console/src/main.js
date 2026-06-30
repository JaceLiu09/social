const LS_TOKEN = "blindbox_admin_token";
const LS_API_OVERRIDE = "blindbox_admin_api_base_override";

function defaultApiBase() {
  const v = import.meta.env.VITE_ADMIN_API_BASE_URL;
  return v && String(v).trim() ? String(v).trim().replace(/\/$/, "") : "";
}

function getToken() {
  return localStorage.getItem(LS_TOKEN) || "";
}

function setToken(t) {
  if (t) localStorage.setItem(LS_TOKEN, t);
  else localStorage.removeItem(LS_TOKEN);
}

function apiBase() {
  const override = localStorage.getItem(LS_API_OVERRIDE);
  if (override && override.trim()) return override.trim().replace(/\/$/, "");
  return defaultApiBase();
}

function publicAppUrl() {
  const base = apiBase();
  if (base) return base.replace(/\/$/, "");
  return window.location.origin;
}

async function loginFakeBotToApp(userId) {
  const data = await api(`/admin/api/fake-bots/${encodeURIComponent(userId)}/impersonate`, {
    method: "POST"
  });
  const loginUrl =
    data.url || `${publicAppUrl()}/me?asUser=${encodeURIComponent(String(data.code || ""))}`;
  window.open(loginUrl, "_blank", "noopener,noreferrer");
}

function headers() {
  const h = { "Content-Type": "application/json" };
  const t = getToken();
  if (t) h.Authorization = `Bearer ${t}`;
  return h;
}

async function api(path, options = {}) {
  const base = apiBase();
  const url = base ? `${base}${path}` : path;
  const res = await fetch(url, { ...options, headers: { ...headers(), ...options.headers } });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { message: text || "Invalid JSON" };
  }
  if (!res.ok) {
    const err = new Error(data.message || res.statusText);
    err.status = res.status;
    if (res.status === 401 && getToken()) {
      setToken("");
      renderLogin();
    }
    throw err;
  }
  return data;
}

async function loginRequest(username, password) {
  const base = apiBase();
  const url = base ? `${base}/admin/api/auth/login` : "/admin/api/auth/login";
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { message: text || "Invalid JSON" };
  }
  if (!res.ok) {
    const err = new Error(data.message || res.statusText);
    err.status = res.status;
    throw err;
  }
  return data;
}

const showApiOverride = import.meta.env.DEV || !defaultApiBase();

function mediaUrlOssObjectPath(pathname) {
  const p = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return (
    p.startsWith("/fake-pictures/") ||
    p.startsWith("/chat-history-pictures/") ||
    p.startsWith("/zhenren-pictures/")
  );
}

/** 与 App 一致：种子头像 /avatars/... → API 上 OSS 代理（静态后台目录不一定含 public/avatars） */
function seedAvatarToAdminUrl(s, base) {
  const str = String(s ?? "").trim();
  if (!str.includes("/avatars/")) return null;
  const root = base ? base.replace(/\/$/, "") : "";
  const tailFrom = (pathname) => {
    const i = pathname.indexOf("/avatars/");
    if (i === -1) return null;
    return pathname.slice(i + "/avatars/".length);
  };
  try {
    if (/^https?:\/\//i.test(str) || str.startsWith("//")) {
      const u = new URL(str.startsWith("//") ? `https:${str}` : str);
      const tail = tailFrom(u.pathname);
      if (!tail) return null;
      const path = `/oss-media/fake-pictures/seed-avatars/${tail}${u.search || ""}`;
      return root ? `${root}${path}` : path;
    }
  } catch (_e) {
    return null;
  }
  if (str.startsWith("/avatars/")) {
    const tail = str.slice("/avatars/".length).split("#")[0];
    const path = `/oss-media/fake-pictures/seed-avatars/${tail}`;
    return root ? `${root}${path}` : path;
  }
  return null;
}

/** 相册 / Fake 图等在库里可能是完整 OSS HTTPS URL；私有桶会 403，必须改走后端 /oss-media 代理 */
function mediaUrl(u) {
  if (!u) return "";
  const s = String(u).trim();
  const base = apiBase();
  const seed = seedAvatarToAdminUrl(s, base);
  if (seed) return seed;

  const toProxy = (pathname, search = "") => {
    const p = pathname.startsWith("/") ? pathname : `/${pathname}`;
    const q = search || "";
    return base ? `${base}/oss-media${p}${q}` : `/oss-media${p}${q}`;
  };

  if (/^https?:\/\//i.test(s)) {
    try {
      const parsed = new URL(s);
      const path = parsed.pathname.startsWith("/") ? parsed.pathname : `/${parsed.pathname}`;
      if (mediaUrlOssObjectPath(path)) return toProxy(path, parsed.search);
      // 库里常见 localhost / 127.0.0.1 / 旧部署 IP 的完整 URL；一律接到当前 API，否则 img 会打到用户本机或错误主机
      if (path.startsWith("/uploads/") || path.startsWith("/oss-media/")) {
        const tail = `${path}${parsed.search || ""}`;
        return base ? `${base}${tail}` : tail;
      }
    } catch (_e) {}
    return s;
  }

  if (s.startsWith("//")) {
    try {
      const parsed = new URL(`https:${s}`);
      const path = parsed.pathname.startsWith("/") ? parsed.pathname : `/${parsed.pathname}`;
      if (mediaUrlOssObjectPath(path)) return toProxy(path, parsed.search);
      if (path.startsWith("/uploads/") || path.startsWith("/oss-media/")) {
        const tail = `${path}${parsed.search || ""}`;
        return base ? `${base}${tail}` : tail;
      }
    } catch (_e) {}
    const proto = typeof window !== "undefined" && window.location?.protocol ? window.location.protocol : "https:";
    return `${proto}${s}`;
  }

  let pathish = s;
  if (/^oss-media\//i.test(pathish)) pathish = `/${pathish}`;
  if (pathish.startsWith("/oss-media/")) return base ? `${base}${pathish}` : pathish;

  const rel = pathish.startsWith("/") ? pathish : `/${pathish}`;
  if (mediaUrlOssObjectPath(rel)) return toProxy(rel, "");

  return base ? `${base}${s}` : s;
}

const app = document.getElementById("app");

function renderLogin(message = "") {
  app.innerHTML = `
    <div class="login-screen">
      <header class="top-bar login-head">
        <h1>盲盒社交 · 后台管理</h1>
      </header>
      <div class="login-card">
        <h2>管理员登录</h2>
        ${message ? `<p class="msg err">${escapeHtml(message)}</p>` : ""}
        <label class="login-field">用户名 <input type="text" id="login-user" autocomplete="username" /></label>
        <label class="login-field">密码 <input type="password" id="login-pass" autocomplete="current-password" /></label>
        <button type="button" class="btn" id="login-submit">登录</button>
      </div>
      <p class="muted login-foot">本地开发依赖 Vite 代理访问后端；远端部署已在构建中注入 API 地址。</p>
    </div>
  `;
  document.getElementById("login-submit").onclick = async () => {
    const username = document.getElementById("login-user").value.trim();
    const password = document.getElementById("login-pass").value;
    try {
      const out = await loginRequest(username, password);
      setToken(out.token);
      await renderShell();
    } catch (e) {
      renderLogin(e.message || String(e));
    }
  };
}

async function renderShell() {
  let sessionUsername = "";
  try {
    const me = await api("/admin/api/auth/me");
    sessionUsername = me.username || "";
    sessionCanManageUsers = me.canManageUsers !== false;
  } catch (e) {
    if (!getToken()) return;
    if (e.status === 401) return;
    setToken("");
    renderLogin(e.message || String(e));
    return;
  }

  const cfgApiDisplay = apiBase() || "(当前页同源 / Vite 代理)";
  const overrideVal = localStorage.getItem(LS_API_OVERRIDE) || "";
  const apiRow = showApiOverride
    ? `<label class="muted">API 覆盖 <input type="text" id="cfg-api-override" style="min-width:220px" placeholder="留空则用默认" value="${escapeAttr(overrideVal)}" /></label>
        <button type="button" class="btn secondary" id="cfg-api-save">保存</button>`
    : `<span class="muted">API：<code>${escapeHtml(cfgApiDisplay)}</code></span>`;

  const canManageUsers = sessionCanManageUsers;
  app.innerHTML = `
    <header class="top-bar">
      <h1>盲盒社交 · 后台管理</h1>
      <div class="config-row">
        ${apiRow}
        <span class="muted">${escapeHtml(sessionUsername)}</span>
        <button type="button" class="btn secondary" id="btn-logout">退出登录</button>
      </div>
    </header>
    <p class="muted" style="margin-top:-8px;margin-bottom:16px">使用管理员账号登录；远端访问时无需手动填写 API（由部署脚本注入 <code>VITE_ADMIN_API_BASE_URL</code>）。</p>
    <nav class="tabs">
      ${canManageUsers ? `<button type="button" data-tab="users" class="active">用户管理</button>` : ""}
      <button type="button" data-tab="online" class="${canManageUsers ? "" : "active"}">在线用户</button>
      <button type="button" data-tab="fakes">Fake 机器人</button>
      <button type="button" data-tab="membership-orders">会员订单</button>
      <button type="button" data-tab="messages">消息管理</button>
    </nav>
    <div id="panel-users" class="panel"></div>
    <div id="panel-online" class="panel hidden"></div>
    <div id="panel-fakes" class="panel hidden"></div>
    <div id="panel-membership-orders" class="panel hidden"></div>
    <div id="panel-messages" class="panel hidden"></div>
  `;

  document.getElementById("btn-logout").onclick = async () => {
    try {
      await api("/admin/api/auth/logout", { method: "POST" });
    } catch {
      /* ignore */
    }
    setToken("");
    renderLogin();
  };

  if (showApiOverride) {
    document.getElementById("cfg-api-save").onclick = () => {
      const v = document.getElementById("cfg-api-override").value.trim();
      if (v) localStorage.setItem(LS_API_OVERRIDE, v);
      else localStorage.removeItem(LS_API_OVERRIDE);
      flash("已保存", "ok");
      renderShell();
    };
  }

  let currentTab = canManageUsers ? "users" : "online";
  document.querySelectorAll(".tabs button").forEach((btn) => {
    btn.onclick = () => {
      currentTab = btn.dataset.tab;
      document.querySelectorAll(".tabs button").forEach((b) => b.classList.toggle("active", b === btn));
      setTab(currentTab);
    };
  });

  setTab(currentTab);
}

async function bootstrap() {
  if (!getToken()) {
    renderLogin();
    return;
  }
  try {
    await api("/admin/api/auth/me");
    await renderShell();
  } catch {
    if (!getToken()) return;
    setToken("");
    renderLogin();
  }
}

function escapeAttr(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

const INCOME_OPTIONS = ["3000以下", "3000-5000", "5000-1万", "1万-2万", "2万以上"];

function incomeSelectHtml(name, selected = "") {
  const sel = String(selected || "").trim();
  let html = `<select name="${escapeAttr(name)}">`;
  if (sel && !INCOME_OPTIONS.includes(sel)) {
    html += `<option value="${escapeAttr(sel)}" selected>${escapeAttr(sel)}（旧值）</option>`;
  }
  for (const opt of INCOME_OPTIONS) {
    const isSelected = sel === opt || (!sel && opt === "5000-1万");
    html += `<option value="${escapeAttr(opt)}"${isSelected ? " selected" : ""}>${opt}</option>`;
  }
  html += "</select>";
  return html;
}

function validateFakeBotMetrics(fd) {
  const age = Number(fd.get("age"));
  if (!Number.isFinite(age) || age < 18 || age > 80) {
    return "年龄请填写 18–80 之间的整数";
  }
  const height = Number(fd.get("height"));
  if (!Number.isFinite(height) || height < 140 || height > 210) {
    return "身高请填写 140–210 之间的整数（单位 cm），请勿多输数字";
  }
  const weight = Number(fd.get("weight"));
  if (!Number.isFinite(weight) || weight < 35 || weight > 120) {
    return "体重请填写 35–120 之间的整数（单位 kg）";
  }
  return null;
}

function flash(text, kind) {
  const el = document.createElement("div");
  el.className = `msg ${kind}`;
  el.textContent = text;
  app.insertBefore(el, app.querySelector(".tabs"));
  setTimeout(() => el.remove(), 4000);
}

/**
 * 消息管理 / 机器人库：查看 Fake 机器人账号资料。
 * @param {{ userId: string; nickname?: string }} ctx
 */
async function openFakeBotProfileModal(ctx) {
  const userId = String(ctx.userId || "").trim();
  if (!userId) return;

  document.getElementById("fake-bot-profile-modal")?.remove();

  const wrap = document.createElement("div");
  wrap.id = "fake-bot-profile-modal";
  wrap.className = "modal-overlay";
  wrap.setAttribute("aria-modal", "true");
  wrap.innerHTML = `
    <div class="modal-card modal-card--wide" role="document">
      <div class="modal-head">
        <h3>Fake 机器人账号</h3>
        <button type="button" class="btn secondary" id="fake-bot-profile-close">关闭</button>
      </div>
      <div id="fake-bot-profile-body"><p class="muted">加载中…</p></div>
    </div>
  `;
  document.body.appendChild(wrap);

  let currentUser = null;

  function closeModal() {
    wrap.remove();
  }

  wrap.querySelector("#fake-bot-profile-close")?.addEventListener("click", closeModal);
  wrap.addEventListener("click", (e) => {
    if (e.target === wrap) closeModal();
  });

  function renderProfileView(u) {
    currentUser = u;
    const body = wrap.querySelector("#fake-bot-profile-body");
    if (!body) return;
    const photos = Array.isArray(u.photoUrls) ? u.photoUrls.filter(Boolean) : [];
    const gallery = photos
      .map(
        (url) =>
          `<a href="${escapeAttr(mediaUrl(url))}" target="_blank" rel="noopener" class="fake-moment-thumb"><img src="${escapeAttr(mediaUrl(url))}" alt="" /></a>`
      )
      .join("");
    body.innerHTML = `
      <div class="fake-bot-profile-head">
        ${
          u.avatarUrl
            ? `<img class="fake-bot-profile-avatar" src="${escapeAttr(mediaUrl(u.avatarUrl))}" alt="" />`
            : `<div class="fake-bot-profile-avatar fake-bot-profile-avatar--empty">无头像</div>`
        }
        <div>
          <strong class="fake-bot-profile-name">${escapeHtml(u.nickname || ctx.nickname || "—")}</strong>
          <div class="muted">${escapeHtml(u.phone || "")}</div>
          <div class="muted">库：${escapeHtml(u.fakeRobotLibrary || "—")} · 动态 ${Number(u._count?.squareMoments || 0)} 条</div>
        </div>
      </div>
      <dl class="fake-bot-profile-dl">
        <div><dt>性别</dt><dd>${u.gender === "MALE" ? "男" : u.gender === "FEMALE" ? "女" : "—"}</dd></div>
        <div><dt>年龄</dt><dd>${u.age ?? "—"}</dd></div>
        <div><dt>身高</dt><dd>${u.height ? `${u.height} cm` : "—"}</dd></div>
        <div><dt>体重</dt><dd>${u.weight ? `${u.weight} kg` : "—"}</dd></div>
        <div><dt>家乡</dt><dd>${escapeHtml(u.hometown || "—")}</dd></div>
        <div><dt>现居</dt><dd>${escapeHtml(u.currentCity || "—")}</dd></div>
        <div><dt>收入</dt><dd>${escapeHtml(u.income || "—")}</dd></div>
        <div><dt>行业</dt><dd>${escapeHtml(u.industry || "—")}</dd></div>
        <div class="fake-bot-profile-span"><dt>爱好（个性展示）</dt><dd>${escapeHtml(u.hobbies || "—")}</dd></div>
        <div class="fake-bot-profile-span"><dt>对另一半期望</dt><dd>${escapeHtml(u.partnerExpectation || "—")}</dd></div>
      </dl>
      ${gallery ? `<div class="fake-moment-previews">${gallery}</div>` : ""}
      <div class="modal-actions">
        <button type="button" class="btn" id="fake-bot-profile-edit">编辑</button>
        <button type="button" class="btn secondary" id="fake-bot-profile-login">登陆盲盒</button>
        ${
          u.fakeRobotLibrary === "USER"
            ? `<button type="button" class="btn secondary" id="fake-bot-profile-moment">发动态</button>`
            : ""
        }
      </div>
    `;
    body.querySelector("#fake-bot-profile-edit")?.addEventListener("click", () => renderProfileEdit(u));
    body.querySelector("#fake-bot-profile-login")?.addEventListener("click", async () => {
      const btn = body.querySelector("#fake-bot-profile-login");
      if (!btn) return;
      btn.disabled = true;
      const prev = btn.textContent;
      btn.textContent = "打开中…";
      try {
        await loginFakeBotToApp(u.id);
        flash(`已打开盲盒主页：${u.nickname || ""}`, "ok");
      } catch (e) {
        flash(e.message || "打开盲盒失败", "err");
      } finally {
        btn.disabled = false;
        btn.textContent = prev;
      }
    });
    body.querySelector("#fake-bot-profile-moment")?.addEventListener("click", () => {
      closeModal();
      switchAdminTab("fakes").then(() => {
        openFakeMomentModal({
          userId: u.id,
          nickname: u.nickname || "",
          gender: u.gender === "MALE" ? "MALE" : "FEMALE"
        });
      });
    });
  }

  function renderProfileEdit(u) {
    const body = wrap.querySelector("#fake-bot-profile-body");
    if (!body) return;
    body.innerHTML = `
      <form id="fake-bot-profile-form" class="form-grid">
        <label>昵称 <input name="nickname" required value="${escapeAttr(u.nickname || "")}" /></label>
        <label>年龄 <input name="age" type="number" min="18" max="80" value="${escapeAttr(String(u.age ?? ""))}" /></label>
        <label>身高 cm <input name="height" type="number" value="${escapeAttr(String(u.height ?? ""))}" /></label>
        <label>体重 kg <input name="weight" type="number" value="${escapeAttr(String(u.weight ?? ""))}" /></label>
        <label>家乡 <input name="hometown" value="${escapeAttr(u.hometown || "")}" /></label>
        <label>现居 <input name="currentCity" value="${escapeAttr(u.currentCity || "")}" /></label>
        <label>收入 ${incomeSelectHtml("income", u.income || "5000-1万")}</label>
        <label>行业 <input name="industry" value="${escapeAttr(u.industry || "")}" /></label>
        <label class="form-full">爱好（个性展示） <textarea name="hobbies">${escapeHtml(u.hobbies || "")}</textarea></label>
        <label class="form-full">对另一半期望 <textarea name="partnerExpectation">${escapeHtml(u.partnerExpectation || "")}</textarea></label>
        <div class="modal-actions form-full">
          <button type="button" class="btn secondary" id="fake-bot-profile-cancel-edit">取消</button>
          <button type="submit" class="btn" id="fake-bot-profile-save">保存</button>
        </div>
      </form>
    `;
    body.querySelector("#fake-bot-profile-cancel-edit")?.addEventListener("click", () => renderProfileView(currentUser || u));
    body.querySelector("#fake-bot-profile-form")?.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const fd = new FormData(ev.target);
      const saveBtn = body.querySelector("#fake-bot-profile-save");
      saveBtn.disabled = true;
      const prev = saveBtn.textContent;
      saveBtn.textContent = "保存中…";
      try {
        const payload = {
          nickname: String(fd.get("nickname") || "").trim(),
          age: Number(fd.get("age") || u.age || 24),
          height: fd.get("height") ? Number(fd.get("height")) : undefined,
          weight: fd.get("weight") ? Number(fd.get("weight")) : undefined,
          hometown: String(fd.get("hometown") || ""),
          currentCity: String(fd.get("currentCity") || ""),
          income: String(fd.get("income") || ""),
          industry: String(fd.get("industry") || ""),
          hobbies: String(fd.get("hobbies") || ""),
          partnerExpectation: String(fd.get("partnerExpectation") || "")
        };
        const data = await api(`/admin/api/fake-bots/${encodeURIComponent(userId)}`, {
          method: "PATCH",
          body: JSON.stringify(payload)
        });
        flash("资料已更新", "ok");
        renderProfileView(data.user || u);
      } catch (e) {
        flash(e.message || "保存失败", "err");
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = prev;
      }
    });
  }

  try {
    const data = await api(`/admin/api/fake-bots/${encodeURIComponent(userId)}`);
    renderProfileView(data.user || {});
  } catch (e) {
    const body = wrap.querySelector("#fake-bot-profile-body");
    if (body) body.innerHTML = `<p class="msg err">${escapeHtml(e.message || String(e))}</p>`;
  }
}

function renderAdminThreadBubble(m, botUserId) {
  const isBot = m.fromUserId === botUserId;
  const content =
    m.kind === "TEXT"
      ? escapeHtml(m.text || "")
      : m.kind === "IMAGE"
        ? `<a href="${escapeAttr(mediaUrl(m.mediaUrl))}" target="_blank" rel="noopener">[图片]</a>`
        : m.kind === "AUDIO"
          ? `<a href="${escapeAttr(mediaUrl(m.mediaUrl))}" target="_blank" rel="noopener">[语音]</a>`
          : escapeHtml(m.text || "");
  return `
    <div class="admin-thread-bubble ${isBot ? "admin-thread-bubble--bot" : "admin-thread-bubble--user"}">
      <div class="admin-thread-bubble-meta">${isBot ? "机器人" : "用户"} · ${formatDate(m.createdAt)}</div>
      <div class="admin-thread-bubble-text">${content}</div>
    </div>
  `;
}

/**
 * 消息管理：会话线程（历史记录 + 代机器人回复）。
 * @param {{ botUserId: string; botName: string; toUserId: string; toName: string; onSent?: () => void }} ctx
 */
async function openMessageReplyModal(ctx) {
  const botUserId = String(ctx.botUserId || "").trim();
  const toUserId = String(ctx.toUserId || "").trim();
  if (!botUserId || !toUserId) return;

  document.getElementById("msg-reply-modal")?.remove();

  const wrap = document.createElement("div");
  wrap.id = "msg-reply-modal";
  wrap.className = "modal-overlay";
  wrap.setAttribute("aria-modal", "true");
  wrap.innerHTML = `
    <div class="modal-card modal-card--thread" role="document">
      <div class="modal-head">
        <h3>${escapeHtml(ctx.botName || "机器人")} ↔ ${escapeHtml(ctx.toName || "用户")}</h3>
        <button type="button" class="btn secondary" id="msg-reply-close">关闭</button>
      </div>
      <div id="msg-thread-list" class="admin-thread-list"><p class="muted">加载历史记录…</p></div>
      <div class="admin-thread-compose">
        <textarea id="msg-reply-text" maxlength="2000" placeholder="以机器人身份回复…"></textarea>
        <button type="button" class="btn" id="msg-reply-send">发送</button>
      </div>
    </div>
  `;
  document.body.appendChild(wrap);

  const listEl = wrap.querySelector("#msg-thread-list");
  const ta = wrap.querySelector("#msg-reply-text");
  const sendBtn = wrap.querySelector("#msg-reply-send");

  function closeModal() {
    wrap.remove();
  }

  wrap.querySelector("#msg-reply-close")?.addEventListener("click", closeModal);
  wrap.addEventListener("click", (e) => {
    if (e.target === wrap) closeModal();
  });

  async function loadThread() {
    const data = await api(
      `/admin/api/messages/thread?botUserId=${encodeURIComponent(botUserId)}&peerUserId=${encodeURIComponent(toUserId)}`
    );
    const messages = Array.isArray(data.messages) ? data.messages : [];
    if (!listEl) return;
    if (!messages.length) {
      listEl.innerHTML = `<p class="muted admin-thread-empty">暂无聊天记录，发送第一条回复吧</p>`;
      return;
    }
    listEl.innerHTML = messages.map((m) => renderAdminThreadBubble(m, botUserId)).join("");
    listEl.scrollTop = listEl.scrollHeight;
  }

  sendBtn?.addEventListener("click", async () => {
    const text = String(ta?.value || "").trim();
    if (!text) {
      flash("请输入回复内容", "err");
      return;
    }
    sendBtn.disabled = true;
    const prev = sendBtn.textContent;
    sendBtn.textContent = "发送中…";
    try {
      const data = await api("/admin/api/messages/reply", {
        method: "POST",
        body: JSON.stringify({ botUserId, toUserId, text })
      });
      ta.value = "";
      const msg = data.message;
      if (msg && listEl) {
        const empty = listEl.querySelector(".admin-thread-empty");
        if (empty) empty.remove();
        listEl.insertAdjacentHTML("beforeend", renderAdminThreadBubble(msg, botUserId));
        listEl.scrollTop = listEl.scrollHeight;
      } else {
        await loadThread();
      }
      ctx.onSent?.();
    } catch (e) {
      flash(e.message || "发送失败", "err");
    } finally {
      sendBtn.disabled = false;
      sendBtn.textContent = prev;
    }
  });

  try {
    await loadThread();
    ta?.focus();
  } catch (e) {
    if (listEl) listEl.innerHTML = `<p class="msg err">${escapeHtml(e.message || String(e))}</p>`;
  }
}

/**
 * 用户机器人库表格「发动态」：弹层内上传图 + 文案，走 `POST /admin/api/fake-bots/:id/square-moments`。
 * @param {{ userId: string; nickname: string; gender: string }} ctx
 */
function openFakeMomentModal(ctx) {
  const userId = String(ctx.userId || "").trim();
  const gender = ctx.gender === "MALE" ? "MALE" : "FEMALE";
  if (!userId) return;

  document.getElementById("fake-moment-modal")?.remove();

  const wrap = document.createElement("div");
  wrap.id = "fake-moment-modal";
  wrap.className = "modal-overlay";
  wrap.setAttribute("aria-modal", "true");
  wrap.innerHTML = `
    <div class="modal-card" role="document">
      <div class="modal-head">
        <h3>发动态 <span id="fake-moment-who" class="muted"></span></h3>
        <button type="button" class="btn secondary" id="fake-moment-close">关闭</button>
      </div>
      <p class="muted" style="margin:0 0 10px;font-size:12px">发布后将出现在广场信息流，以及该机器人账号在 App 内「我的动态」列表（与本人发帖一致）。</p>
      <label class="fake-moment-label" for="fake-moment-text">文字</label>
      <textarea id="fake-moment-text" maxlength="2000" placeholder="可只发图、只发文，或图文一起"></textarea>
      <label class="fake-moment-label" for="fake-moment-files">图片（最多 9 张，每张 ≤4MB）</label>
      <input type="file" id="fake-moment-files" accept="image/*" multiple />
      <div id="fake-moment-previews" class="fake-moment-previews"></div>
      <div class="modal-actions">
        <button type="button" class="btn secondary" id="fake-moment-cancel">取消</button>
        <button type="button" class="btn" id="fake-moment-publish">发布</button>
      </div>
    </div>
  `;
  document.body.appendChild(wrap);

  const who = wrap.querySelector("#fake-moment-who");
  if (who) who.textContent = ctx.nickname ? `· ${ctx.nickname}` : "";

  /** @type {File[]} */
  const draftFiles = [];
  /** @type {string[]} */
  let objectUrls = [];

  const previews = wrap.querySelector("#fake-moment-previews");
  const ta = wrap.querySelector("#fake-moment-text");
  const fileInput = wrap.querySelector("#fake-moment-files");
  const publishBtn = wrap.querySelector("#fake-moment-publish");

  function revokeAllPreviews() {
    objectUrls.forEach((u) => URL.revokeObjectURL(u));
    objectUrls = [];
  }

  function renderPreviews() {
    if (!previews) return;
    revokeAllPreviews();
    previews.innerHTML = "";
    draftFiles.forEach((file, i) => {
      const url = URL.createObjectURL(file);
      objectUrls.push(url);
      const cell = document.createElement("div");
      cell.className = "fake-moment-thumb";
      const img = document.createElement("img");
      img.src = url;
      img.alt = "";
      const rm = document.createElement("button");
      rm.type = "button";
      rm.className = "fake-moment-remove";
      rm.textContent = "移除";
      rm.dataset.index = String(i);
      rm.addEventListener("click", () => {
        draftFiles.splice(i, 1);
        renderPreviews();
      });
      cell.appendChild(img);
      cell.appendChild(rm);
      previews.appendChild(cell);
    });
  }

  function closeModal() {
    revokeAllPreviews();
    wrap.remove();
  }

  fileInput?.addEventListener("change", () => {
    const add = Array.from(fileInput.files || []).filter((f) => String(f.type || "").startsWith("image/"));
    fileInput.value = "";
    for (const f of add) {
      if (draftFiles.length >= 9) break;
      draftFiles.push(f);
    }
    renderPreviews();
  });

  wrap.querySelector("#fake-moment-close")?.addEventListener("click", closeModal);
  wrap.querySelector("#fake-moment-cancel")?.addEventListener("click", closeModal);
  wrap.addEventListener("click", (e) => {
    if (e.target === wrap) closeModal();
  });

  publishBtn?.addEventListener("click", async () => {
    const text = String(ta?.value || "").trim();
    if (!text && !draftFiles.length) {
      flash("请填写文字或选择至少一张图片", "err");
      return;
    }
    publishBtn.disabled = true;
    const prevLabel = publishBtn.textContent;
    try {
      const imageUrls = [];
      for (let i = 0; i < draftFiles.length; i++) {
        publishBtn.textContent = `上传 ${i + 1}/${draftFiles.length}…`;
        const dataUrl = await fileToDataUrl(draftFiles[i]);
        const up = await api("/admin/api/upload", {
          method: "POST",
          body: JSON.stringify({ fileName: draftFiles[i].name, dataUrl, gender })
        });
        imageUrls.push(up.url);
      }
      publishBtn.textContent = "发布中…";
      await api(`/admin/api/fake-bots/${encodeURIComponent(userId)}/square-moments`, {
        method: "POST",
        body: JSON.stringify({ text, imageUrls })
      });
      flash("动态已发布", "ok");
      closeModal();
    } catch (e) {
      flash(e.message || "发布失败", "err");
    } finally {
      publishBtn.disabled = false;
      publishBtn.textContent = prevLabel;
    }
  });
}

let userPage = 1;
let msgPage = 1;
let membershipOrderPage = 1;
let membershipOrderStatus = "";
let msgFilterTo = "";
/** 用户机器人库列表排序：createdAt | moments_desc | moments_asc */
let fakeUserSort = "createdAt";
/** 来自 /auth/me，无「用户管理」权限时为 false */
let sessionCanManageUsers = true;

function switchAdminTab(tab) {
  const btn = document.querySelector(`.tabs button[data-tab="${tab}"]`);
  if (!btn) return;
  document.querySelectorAll(".tabs button").forEach((b) => b.classList.toggle("active", b === btn));
  return setTab(tab);
}

async function setTab(tab) {
  document.querySelectorAll('[id^="panel-"]').forEach((p) => p.classList.add("hidden"));
  const panel = document.getElementById(`panel-${tab}`);
  if (!panel) return;
  panel.classList.remove("hidden");

  if (!getToken()) {
    panel.innerHTML = `<p class="msg err">请先登录。</p>`;
    return;
  }

  if (tab === "users" && !sessionCanManageUsers) {
    panel.innerHTML = `<p class="msg err">当前账号无「用户管理」权限。</p>`;
    return;
  }

  try {
    if (tab === "users") await renderUsers(panel);
    if (tab === "online") await renderOnline(panel);
    if (tab === "fakes") await renderFakes(panel);
    if (tab === "membership-orders") await renderMembershipOrders(panel);
    if (tab === "messages") await renderMessages(panel);
  } catch (e) {
    panel.innerHTML = `<div class="msg err">${e.message || String(e)}</div>`;
  }
}

async function renderUsers(panel) {
  const q = panel._q ?? "";
  const data = await api(`/admin/api/users?page=${userPage}&pageSize=20&q=${encodeURIComponent(q)}`);
  panel.innerHTML = `
    <h2>注册用户</h2>
    <div class="toolbar">
      <input type="search" placeholder="手机 / 昵称 / 城市" value="${escapeAttr(q)}" id="user-q" />
      <button type="button" class="btn secondary" id="user-search">搜索</button>
      <span class="muted">共 ${data.total} 条</span>
    </div>
    <div style="overflow-x:auto">
      <table class="data">
        <thead>
          <tr>
            <th>头像</th><th>昵称</th><th>手机</th><th>类型</th><th>性别</th><th>年龄</th><th>城市</th><th>注册时间</th>
          </tr>
        </thead>
        <tbody>
          ${data.users
            .map(
              (u) => `
            <tr>
              <td>${u.avatarUrl ? `<img class="thumb" src="${escapeAttr(mediaUrl(u.avatarUrl))}" alt="" />` : "—"}</td>
              <td>${escapeHtml(u.nickname)}</td>
              <td>${escapeHtml(u.phone)}</td>
              <td>${u.isFakeBot ? '<span class="badge fake">FAKE</span>' : "用户"}</td>
              <td>${u.gender === "MALE" ? "男" : "女"}</td>
              <td>${u.age}</td>
              <td>${escapeHtml(u.currentCity || "")}</td>
              <td class="muted">${formatDate(u.createdAt)}</td>
            </tr>`
            )
            .join("")}
        </tbody>
      </table>
    </div>
    <div class="pagination">
      <button type="button" class="btn secondary" ${data.page <= 1 ? "disabled" : ""} id="user-prev">上一页</button>
      <span>第 ${data.page} / ${Math.max(1, Math.ceil(data.total / data.pageSize))} 页</span>
      <button type="button" class="btn secondary" ${data.page * data.pageSize >= data.total ? "disabled" : ""} id="user-next">下一页</button>
    </div>
  `;
  document.getElementById("user-search").onclick = () => {
    panel._q = document.getElementById("user-q").value.trim();
    userPage = 1;
    renderUsers(panel);
  };
  document.getElementById("user-prev").onclick = () => {
    userPage = Math.max(1, userPage - 1);
    renderUsers(panel);
  };
  document.getElementById("user-next").onclick = () => {
    userPage += 1;
    renderUsers(panel);
  };
}

async function renderOnline(panel) {
  const data = await api("/admin/api/online");
  panel.innerHTML = `
    <h2>当前在线 <span class="badge online">${data.onlineCount}</span></h2>
    <p class="muted">数据来源：Socket 连接（与主站实时一致）</p>
    <div style="overflow-x:auto">
      <table class="data">
        <thead>
          <tr><th>头像</th><th>昵称</th><th>手机</th><th>类型</th><th>城市</th></tr>
        </thead>
        <tbody>
          ${data.users
            .map(
              (u) => `
            <tr>
              <td>${u.avatarUrl ? `<img class="thumb" src="${escapeAttr(mediaUrl(u.avatarUrl))}" alt="" />` : "—"}</td>
              <td>${escapeHtml(u.nickname)}</td>
              <td>${escapeHtml(u.phone)}</td>
              <td>${u.isFakeBot ? '<span class="badge fake">FAKE</span>' : "用户"}</td>
              <td>${escapeHtml(u.currentCity || "")}</td>
            </tr>`
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function fakeBotMomentCount(u) {
  return Number(u?.momentCount ?? u?._count?.squareMoments ?? 0);
}

function fakeBotTableRows(users, maxRows, opts) {
  const withMoment = Boolean(opts?.withMomentButton);
  const withMomentCount = opts?.withMomentCount !== false;
  const slice = maxRows > 0 ? users.slice(0, maxRows) : users;
  return slice
    .map(
      (u) => `
              <tr>
                <td>${u.avatarUrl ? `<img class="thumb" src="${escapeAttr(mediaUrl(u.avatarUrl))}" alt="" />` : "—"}</td>
                <td>
                  <button type="button" class="link-btn fake-bot-login" data-user-id="${escapeAttr(u.id)}" title="以该账号打开盲盒 App">
                    ${escapeHtml(u.nickname || "—")}
                  </button>
                </td>
                <td class="muted">${escapeHtml(u.phone)}</td>
                <td>${escapeHtml(u.currentCity || "")}</td>
                <td class="muted">${escapeHtml((u.hobbies || "").slice(0, 40))}${(u.hobbies || "").length > 40 ? "…" : ""}</td>
                ${withMomentCount ? `<td class="num fake-bot-moment-count">${fakeBotMomentCount(u)}</td>` : ""}
                ${
                  withMoment
                    ? `<td><button type="button" class="btn secondary fake-moment-open" data-user-id="${escapeAttr(u.id)}" data-nickname="${escapeAttr(u.nickname || "")}" data-gender="${escapeAttr(u.gender === "MALE" ? "MALE" : "FEMALE")}">发动态</button></td>`
                    : ""
                }
              </tr>`
    )
    .join("");
}

function fakeBotSortSelectHtml(current) {
  const options = [
    { value: "createdAt", label: "添加时间（新→旧）" },
    { value: "moments_desc", label: "动态数量（多→少）" },
    { value: "moments_asc", label: "动态数量（少→多）" }
  ];
  return options
    .map(
      (opt) =>
        `<option value="${escapeAttr(opt.value)}"${opt.value === current ? " selected" : ""}>${opt.label}</option>`
    )
    .join("");
}

async function renderFakes(panel) {
  const sort = fakeUserSort || "createdAt";
  const sortQuery = `&sort=${encodeURIComponent(sort)}`;
  const [systemData, userData] = await Promise.all([
    api(`/admin/api/fake-bots?pool=system${sortQuery}`),
    api(`/admin/api/fake-bots?pool=user${sortQuery}`)
  ]);
  panel.innerHTML = `
    <h2>机器人库</h2>
    <p class="muted">手机号仍以 <code>fakem</code> / <code>fakef</code> 开头。<strong>下方表单录入的账号进入「用户机器人库」</strong>，供玩家匹配；种子/系统库机器人仅用于首页与登录页展示。默认密码：<code>123456</code>（仅测试环境）。</p>
    <h3 style="margin:20px 0 12px;font-size:14px">新增机器人（进入用户机器人库）</h3>
    <form id="fake-form" class="form-grid">
      <label>昵称 <input name="nickname" required placeholder="如 隐藏款女099" /></label>
      <label>性别
        <select name="gender"><option value="FEMALE">女</option><option value="MALE">男</option></select>
      </label>
      <label>年龄 <input name="age" type="number" value="21" min="18" max="80" required /></label>
      <label>身高 cm <input name="height" type="number" value="163" min="140" max="210" step="1" placeholder="140–210" required /></label>
      <label>体重 kg <input name="weight" type="number" value="48" min="35" max="120" step="1" placeholder="35–120" required /></label>
      <label>家乡 <input name="hometown" placeholder="杭州" /></label>
      <label>收入 ${incomeSelectHtml("income", "5000-1万")}</label>
      <label>行业 <input name="industry" value="互联网" /></label>
      <label class="form-full">爱好（个性展示） <textarea name="hobbies" placeholder="羽毛球, 徒步, 美食"></textarea></label>
      <label class="form-full">对另一半期望（签名感文案） <textarea name="partnerExpectation" placeholder="真诚沟通，彼此尊重"></textarea></label>
      <div class="form-full upload-block">
        <strong>头像（必选）</strong>
        <p class="muted" style="margin:4px 0 8px">从本地上传一张，将作为头像并写入服务器 uploads。选错可点缩略图上的移除后重选。</p>
        <input type="file" id="fake-avatar" accept="image/*" />
        <div id="fake-avatar-preview" class="fake-moment-previews fake-form-previews" aria-live="polite"></div>
      </div>
      <div class="form-full upload-block">
        <strong>相册（可选，可多选）</strong>
        <p class="muted" style="margin:4px 0 8px">支持拖拽多张到下方区域批量添加；或点按钮在系统文件框内按住 Ctrl/Cmd 点选多张。下方可预览，点「移除」可删掉单张后再追加。</p>
        <div id="fake-album-drop" class="drop-zone" aria-label="相册拖放区">
          <p id="fake-album-hint" class="drop-hint muted">将多张图片拖到此处释放（可分批追加）</p>
          <button type="button" class="btn secondary" id="fake-album-browse">选择多张图片…</button>
          <input type="file" id="fake-album" accept="image/png,image/jpeg,image/webp,image/gif" multiple class="hidden" tabindex="-1" />
        </div>
        <div id="fake-album-preview" class="fake-moment-previews fake-form-previews" aria-live="polite"></div>
      </div>
      <div class="form-full">
        <button type="submit" class="btn" id="fake-submit-btn">提交到用户机器人库</button>
      </div>
    </form>
    <div id="fake-list-wrap" style="margin-top:24px">
      <div class="toolbar fake-bot-list-toolbar">
        <h3 style="font-size:14px;margin:0">用户机器人库（后台录入 / 匹配用）· 已有 ${userData.users.length} 个</h3>
        <label class="fake-bot-sort-label">排序
          <select id="fake-user-sort">${fakeBotSortSelectHtml(sort)}</select>
        </label>
      </div>
      <p class="muted" style="margin:6px 0 10px">点击昵称将以该 Fake 账号打开盲盒 App，便于编辑主页。</p>
      <div style="overflow-x:auto;margin-bottom:20px">
        <table class="data">
          <thead>
            <tr><th></th><th>昵称</th><th>手机</th><th>城市</th><th>爱好</th><th>动态数量</th><th>操作</th></tr>
          </thead>
          <tbody>
            ${fakeBotTableRows(userData.users, 0, { withMomentButton: true, withMomentCount: true })}
          </tbody>
        </table>
      </div>

      <h3 style="font-size:14px;margin-bottom:8px">系统机器人库（种子 / 展示用）· 已有 ${systemData.users.length} 个</h3>
      <div style="overflow-x:auto">
        <table class="data">
          <thead>
            <tr><th></th><th>昵称</th><th>手机</th><th>城市</th><th>爱好</th><th>动态数量</th></tr>
          </thead>
          <tbody>
            ${fakeBotTableRows(systemData.users, 200, { withMomentCount: true })}
          </tbody>
        </table>
      </div>
      ${systemData.users.length > 200 ? `<p class="muted">系统库仅显示前 200 条。</p>` : ""}
    </div>
  `;

  async function uploadImageFile(file) {
    const genderEl = document.querySelector('#fake-form [name="gender"]');
    const gender = genderEl?.value === "MALE" ? "MALE" : "FEMALE";
    const dataUrl = await fileToDataUrl(file);
    const res = await api("/admin/api/upload", {
      method: "POST",
      body: JSON.stringify({ fileName: file.name, dataUrl, gender })
    });
    return res.url;
  }

  /** @type {File | null} */
  let avatarDraftFile = null;
  let avatarPreviewObjectUrl = null;
  const avatarInput = document.getElementById("fake-avatar");
  const avatarPreviewWrap = document.getElementById("fake-avatar-preview");

  function revokeAvatarPreviewUrl() {
    if (avatarPreviewObjectUrl) {
      URL.revokeObjectURL(avatarPreviewObjectUrl);
      avatarPreviewObjectUrl = null;
    }
  }

  function renderAvatarPreview() {
    revokeAvatarPreviewUrl();
    if (!avatarPreviewWrap) return;
    avatarPreviewWrap.innerHTML = "";
    if (!avatarDraftFile) return;
    avatarPreviewObjectUrl = URL.createObjectURL(avatarDraftFile);
    const cell = document.createElement("div");
    cell.className = "fake-moment-thumb";
    const img = document.createElement("img");
    img.src = avatarPreviewObjectUrl;
    img.alt = "";
    const rm = document.createElement("button");
    rm.type = "button";
    rm.className = "fake-moment-remove";
    rm.textContent = "移除";
    rm.addEventListener("click", () => {
      avatarDraftFile = null;
      if (avatarInput) avatarInput.value = "";
      renderAvatarPreview();
    });
    cell.appendChild(img);
    cell.appendChild(rm);
    avatarPreviewWrap.appendChild(cell);
  }

  avatarInput?.addEventListener("change", () => {
    const f = avatarInput.files?.[0];
    avatarInput.value = "";
    if (!f || !String(f.type || "").startsWith("image/")) {
      avatarDraftFile = null;
      renderAvatarPreview();
      return;
    }
    avatarDraftFile = f;
    renderAvatarPreview();
  });

  /** @type {File[]} */
  const albumDraftFiles = [];
  /** @type {string[]} */
  let albumPreviewObjectUrls = [];

  function bindFakeAlbumDropZone() {
    const albumInput = document.getElementById("fake-album");
    const zone = document.getElementById("fake-album-drop");
    const hint = document.getElementById("fake-album-hint");
    const browse = document.getElementById("fake-album-browse");
    const albumPreviewEl = document.getElementById("fake-album-preview");
    if (!albumInput || !zone || !hint || !albumPreviewEl) return;

    function revokeAlbumPreviewUrls() {
      albumPreviewObjectUrls.forEach((u) => URL.revokeObjectURL(u));
      albumPreviewObjectUrls = [];
    }

    function renderAlbumPreviews() {
      revokeAlbumPreviewUrls();
      albumPreviewEl.innerHTML = "";
      albumDraftFiles.forEach((file, i) => {
        const url = URL.createObjectURL(file);
        albumPreviewObjectUrls.push(url);
        const cell = document.createElement("div");
        cell.className = "fake-moment-thumb";
        const img = document.createElement("img");
        img.src = url;
        img.alt = "";
        const rm = document.createElement("button");
        rm.type = "button";
        rm.className = "fake-moment-remove";
        rm.textContent = "移除";
        rm.addEventListener("click", () => {
          albumDraftFiles.splice(i, 1);
          renderAlbumPreviews();
          updateHint();
        });
        cell.appendChild(img);
        cell.appendChild(rm);
        albumPreviewEl.appendChild(cell);
      });
    }

    function updateHint() {
      const n = albumDraftFiles.length;
      hint.textContent = n
        ? `已选择 ${n} 张相册图（可继续拖拽或点击按钮追加；缩略图可单张移除）`
        : "将多张图片拖到此处释放（可分批追加）；或点击下方按钮多选";
    }

    function mergeIncoming(incomingList) {
      const add = Array.from(incomingList || []).filter((f) => String(f.type || "").startsWith("image/"));
      if (!add.length) return;
      for (const f of add) albumDraftFiles.push(f);
      renderAlbumPreviews();
      updateHint();
    }

    zone.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      zone.classList.add("drop-zone--active");
    });
    zone.addEventListener("dragleave", () => zone.classList.remove("drop-zone--active"));
    zone.addEventListener("drop", (e) => {
      e.preventDefault();
      zone.classList.remove("drop-zone--active");
      mergeIncoming(e.dataTransfer?.files);
    });
    browse?.addEventListener("click", () => albumInput.click());
    albumInput.addEventListener("change", () => {
      mergeIncoming(albumInput.files);
      albumInput.value = "";
    });
    updateHint();
  }
  bindFakeAlbumDropZone();

  panel.querySelector("#fake-user-sort")?.addEventListener("change", (e) => {
    fakeUserSort = String(e.target.value || "createdAt");
    renderFakes(panel);
  });

  if (panel._fakePanelClick) {
    panel.removeEventListener("click", panel._fakePanelClick);
  }
  panel._fakePanelClick = async (e) => {
    const loginBtn = e.target.closest(".fake-bot-login");
    if (loginBtn) {
      e.preventDefault();
      const userId = loginBtn.getAttribute("data-user-id") || "";
      if (!userId) return;
      const prev = loginBtn.textContent;
      loginBtn.disabled = true;
      loginBtn.textContent = "打开中…";
      try {
        await loginFakeBotToApp(userId);
        flash(`已打开盲盒 App：${prev.trim()}`, "ok");
      } catch (err) {
        flash(err.message || "打开盲盒失败", "err");
      } finally {
        loginBtn.disabled = false;
        loginBtn.textContent = prev;
      }
      return;
    }
    const btn = e.target.closest(".fake-moment-open");
    if (!btn) return;
    e.preventDefault();
    openFakeMomentModal({
      userId: btn.getAttribute("data-user-id") || "",
      nickname: btn.getAttribute("data-nickname") || "",
      gender: btn.getAttribute("data-gender") === "MALE" ? "MALE" : "FEMALE"
    });
  };
  panel.addEventListener("click", panel._fakePanelClick);

  document.getElementById("fake-form").onsubmit = async (ev) => {
    ev.preventDefault();
    if (!avatarDraftFile) {
      flash("请先选择头像图片（必选）：点「头像」下的文件框选一张本地图，再提交。", "err");
      avatarInput?.scrollIntoView({ behavior: "smooth", block: "center" });
      avatarInput?.focus();
      return;
    }

    const submitBtn = document.getElementById("fake-submit-btn");
    const fd = new FormData(ev.target);
    const metricError = validateFakeBotMetrics(fd);
    if (metricError) {
      flash(metricError, "err");
      return;
    }
    const albumFiles = [...albumDraftFiles];

    submitBtn.disabled = true;
    const prevText = submitBtn.textContent;
    try {
      submitBtn.textContent = "正在上传图片…";
      const avatarUrl = await uploadImageFile(avatarDraftFile);
      const albumUrls = [];
      for (let i = 0; i < albumFiles.length; i++) {
        submitBtn.textContent = `上传相册 ${i + 1}/${albumFiles.length}…`;
        albumUrls.push(await uploadImageFile(albumFiles[i]));
      }
      const photoUrls = [avatarUrl, ...albumUrls];

      const body = {
        nickname: fd.get("nickname"),
        gender: fd.get("gender"),
        age: Number(fd.get("age") || 21),
        height: fd.get("height") ? Number(fd.get("height")) : undefined,
        weight: fd.get("weight") ? Number(fd.get("weight")) : undefined,
        hometown: fd.get("hometown") || "",
        income: fd.get("income") || "",
        industry: fd.get("industry") || "",
        hobbies: fd.get("hobbies") || "",
        partnerExpectation: fd.get("partnerExpectation") || "",
        avatarUrl,
        photoUrls
      };
      submitBtn.textContent = "正在创建…";
      await api("/admin/api/fake-bots", { method: "POST", body: JSON.stringify(body) });
      flash("已加入用户机器人库", "ok");
      renderFakes(panel);
    } catch (e) {
      flash(e.message, "err");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = prevText;
    }
  };
}

async function renderMembershipOrders(panel) {
  const data = await api(
    `/admin/api/membership-orders?page=${membershipOrderPage}&pageSize=30${
      membershipOrderStatus ? `&status=${encodeURIComponent(membershipOrderStatus)}` : ""
    }`
  );
  panel.innerHTML = `
    <h2>会员订单</h2>
    <p class="muted">展示用户开通会员的待支付 / 已支付 / 已取消订单。</p>
    <div class="toolbar">
      <label>状态
        <select id="membership-order-status">
          <option value="">全部</option>
          <option value="PENDING" ${membershipOrderStatus === "PENDING" ? "selected" : ""}>待支付</option>
          <option value="PAID" ${membershipOrderStatus === "PAID" ? "selected" : ""}>已支付</option>
          <option value="FAILED" ${membershipOrderStatus === "FAILED" ? "selected" : ""}>已取消/失败</option>
        </select>
      </label>
      <button type="button" class="btn secondary" id="membership-order-apply">筛选</button>
      <span class="muted">共 ${data.total} 条</span>
    </div>
    <div style="overflow-x:auto">
      <table class="data">
        <thead>
          <tr>
            <th>创建时间</th><th>用户</th><th>套餐</th><th>支付通道</th><th>金额</th><th>状态</th><th>支付时间</th><th>会员到期</th>
          </tr>
        </thead>
        <tbody>
          ${data.orders
            .map(
              (row) => `
            <tr>
              <td class="muted">${formatDate(row.createdAt)}</td>
              <td>${escapeHtml(row.user?.nickname || "")}<div class="muted">${escapeHtml(row.user?.phone || "")}</div></td>
              <td>${escapeHtml(row.planLabel || row.plan)}</td>
              <td>${escapeHtml(row.paymentChannelLabel || row.paymentChannel)}</td>
              <td>¥${Number(row.amount || 0).toFixed(2)}</td>
              <td>${escapeHtml(row.statusLabel || row.status)}</td>
              <td class="muted">${row.paidAt ? formatDate(row.paidAt) : "—"}</td>
              <td class="muted">${row.user?.membershipExpireAt ? formatDate(row.user.membershipExpireAt) : "—"}</td>
            </tr>`
            )
            .join("")}
        </tbody>
      </table>
    </div>
    <div class="pagination">
      <button type="button" class="btn secondary" ${data.page <= 1 ? "disabled" : ""} id="membership-order-prev">上一页</button>
      <span>第 ${data.page} 页</span>
      <button type="button" class="btn secondary" ${data.page * data.pageSize >= data.total ? "disabled" : ""} id="membership-order-next">下一页</button>
    </div>
  `;
  document.getElementById("membership-order-apply").onclick = () => {
    membershipOrderStatus = document.getElementById("membership-order-status").value;
    membershipOrderPage = 1;
    renderMembershipOrders(panel);
  };
  document.getElementById("membership-order-prev").onclick = () => {
    membershipOrderPage = Math.max(1, membershipOrderPage - 1);
    renderMembershipOrders(panel);
  };
  document.getElementById("membership-order-next").onclick = () => {
    membershipOrderPage += 1;
    renderMembershipOrders(panel);
  };
}

async function renderMessages(panel) {
  const data = await api(
    `/admin/api/messages?page=${msgPage}&pageSize=30${msgFilterTo ? `&toUserId=${encodeURIComponent(msgFilterTo)}` : ""}`
  );
  const botOptions = data.fakeBots
    .map((b) => `<option value="${escapeAttr(b.id)}" ${b.id === msgFilterTo ? "selected" : ""}>${escapeHtml(b.nickname)} (${escapeHtml(b.phone.slice(0, 12))}…)</option>`)
    .join("");
  panel.innerHTML = `
    <h2>发往 Fake 机器人的消息</h2>
    <p class="muted">按「用户 + 机器人」合并为会话。点击回复可查看完整聊天记录并代机器人回复；点击机器人昵称可查看/编辑账号。</p>
    <div class="toolbar">
      <label>筛选接收机器人
        <select id="msg-to">
          <option value="">全部 Fake</option>
          ${botOptions}
        </select>
      </label>
      <button type="button" class="btn secondary" id="msg-apply">应用</button>
      <button type="button" class="btn secondary" id="msg-refresh">刷新</button>
      <span class="muted">共 ${data.total} 个会话</span>
    </div>
    <div style="overflow-x:auto">
      <table class="data">
        <thead>
          <tr>
            <th>最近时间</th><th>用户</th><th>机器人</th><th>消息数</th><th>最近一条</th><th>操作</th>
          </tr>
        </thead>
        <tbody>
          ${(data.conversations || [])
            .map((c) => {
              const botId = c.botUserId || c.botUser?.id || "";
              const botName = c.botUser?.nickname || "";
              const peerId = c.peerUserId || c.peerUser?.id || "";
              const peerName = c.peerUser?.nickname || "";
              const preview = escapeHtml(c.lastPreview || "");
              return `
            <tr>
              <td class="muted">${formatDate(c.lastAt)}</td>
              <td>${escapeHtml(peerName)}<div class="muted">${escapeHtml(c.peerUser?.phone || "")}</div></td>
              <td>
                <button type="button" class="link-btn msg-bot-open" data-bot-id="${escapeAttr(botId)}" data-bot-name="${escapeAttr(botName)}">
                  ${escapeHtml(botName)}
                </button>
              </td>
              <td>${Number(c.messageCount || 0)}</td>
              <td style="max-width:280px;word-break:break-word">${preview}</td>
              <td>
                <button
                  type="button"
                  class="btn secondary msg-reply-open"
                  data-bot-id="${escapeAttr(botId)}"
                  data-bot-name="${escapeAttr(botName)}"
                  data-to-id="${escapeAttr(peerId)}"
                  data-to-name="${escapeAttr(peerName)}"
                >回复</button>
              </td>
            </tr>`;
            })
            .join("")}
        </tbody>
      </table>
    </div>
    <div class="pagination">
      <button type="button" class="btn secondary" ${data.page <= 1 ? "disabled" : ""} id="msg-prev">上一页</button>
      <span>第 ${data.page} 页</span>
      <button type="button" class="btn secondary" ${data.page * data.pageSize >= data.total ? "disabled" : ""} id="msg-next">下一页</button>
    </div>
  `;
  document.getElementById("msg-apply").onclick = () => {
    msgFilterTo = document.getElementById("msg-to").value;
    msgPage = 1;
    renderMessages(panel);
  };
  document.getElementById("msg-refresh").onclick = () => {
    renderMessages(panel);
  };
  document.getElementById("msg-prev").onclick = () => {
    msgPage = Math.max(1, msgPage - 1);
    renderMessages(panel);
  };
  document.getElementById("msg-next").onclick = () => {
    msgPage += 1;
    renderMessages(panel);
  };

  if (panel._msgClick) panel.removeEventListener("click", panel._msgClick);
  panel._msgClick = (e) => {
    const botBtn = e.target.closest(".msg-bot-open");
    if (botBtn) {
      e.preventDefault();
      openFakeBotProfileModal({
        userId: botBtn.getAttribute("data-bot-id") || "",
        nickname: botBtn.getAttribute("data-bot-name") || ""
      });
      return;
    }
    const replyBtn = e.target.closest(".msg-reply-open");
    if (replyBtn) {
      e.preventDefault();
      openMessageReplyModal({
        botUserId: replyBtn.getAttribute("data-bot-id") || "",
        botName: replyBtn.getAttribute("data-bot-name") || "",
        toUserId: replyBtn.getAttribute("data-to-id") || "",
        toName: replyBtn.getAttribute("data-to-name") || "",
        onSent: () => renderMessages(panel)
      });
    }
  };
  panel.addEventListener("click", panel._msgClick);
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d) ? iso : d.toLocaleString("zh-CN");
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

bootstrap();
