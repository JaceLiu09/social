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
      <button type="button" data-tab="messages">消息管理</button>
    </nav>
    <div id="panel-users" class="panel"></div>
    <div id="panel-online" class="panel hidden"></div>
    <div id="panel-fakes" class="panel hidden"></div>
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

function flash(text, kind) {
  const el = document.createElement("div");
  el.className = `msg ${kind}`;
  el.textContent = text;
  app.insertBefore(el, app.querySelector(".tabs"));
  setTimeout(() => el.remove(), 4000);
}

let userPage = 1;
let msgPage = 1;
let msgFilterTo = "";
/** 来自 /auth/me，无「用户管理」权限时为 false */
let sessionCanManageUsers = true;

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

function fakeBotTableRows(users, maxRows) {
  const slice = users.slice(0, maxRows);
  return slice
    .map(
      (u) => `
              <tr>
                <td>${u.avatarUrl ? `<img class="thumb" src="${escapeAttr(mediaUrl(u.avatarUrl))}" alt="" />` : "—"}</td>
                <td>${escapeHtml(u.nickname)}</td>
                <td class="muted">${escapeHtml(u.phone)}</td>
                <td>${escapeHtml(u.currentCity || "")}</td>
                <td class="muted">${escapeHtml((u.hobbies || "").slice(0, 40))}${(u.hobbies || "").length > 40 ? "…" : ""}</td>
              </tr>`
    )
    .join("");
}

async function renderFakes(panel) {
  const [systemData, userData] = await Promise.all([
    api("/admin/api/fake-bots?pool=system"),
    api("/admin/api/fake-bots?pool=user")
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
      <label>年龄 <input name="age" type="number" value="21" min="18" max="80" /></label>
      <label>身高 cm <input name="height" type="number" value="163" placeholder="默认按性别" /></label>
      <label>体重 kg <input name="weight" type="number" value="48" placeholder="默认按性别" /></label>
      <label>家乡 <input name="hometown" placeholder="杭州" /></label>
      <label>收入 <input name="income" value="5-6k" /></label>
      <label>行业 <input name="industry" value="互联网" /></label>
      <label class="form-full">爱好（个性展示） <textarea name="hobbies" placeholder="羽毛球, 徒步, 美食"></textarea></label>
      <label class="form-full">对另一半期望（签名感文案） <textarea name="partnerExpectation" placeholder="真诚沟通，彼此尊重"></textarea></label>
      <div class="form-full upload-block">
        <strong>头像（必选）</strong>
        <p class="muted" style="margin:4px 0 8px">从本地上传一张，将作为头像并写入服务器 uploads。</p>
        <input type="file" id="fake-avatar" accept="image/*" />
      </div>
      <div class="form-full upload-block">
        <strong>相册（可选，可多选）</strong>
        <p class="muted" style="margin:4px 0 8px">支持拖拽多张到下方区域批量添加；或点按钮在系统文件框内按住 Ctrl/Cmd 点选多张。提交后与头像一起写入相册列表。</p>
        <div id="fake-album-drop" class="drop-zone" aria-label="相册拖放区">
          <p id="fake-album-hint" class="drop-hint muted">将多张图片拖到此处释放（可分批追加）</p>
          <button type="button" class="btn secondary" id="fake-album-browse">选择多张图片…</button>
          <input type="file" id="fake-album" accept="image/png,image/jpeg,image/webp,image/gif" multiple class="hidden" tabindex="-1" />
        </div>
      </div>
      <div class="form-full">
        <button type="submit" class="btn" id="fake-submit-btn">提交到用户机器人库</button>
      </div>
    </form>
    <div id="fake-list-wrap" style="margin-top:24px">
      <h3 style="font-size:14px;margin-bottom:8px">用户机器人库（后台录入 / 匹配用）· 已有 ${userData.users.length} 个</h3>
      <div style="overflow-x:auto;margin-bottom:20px">
        <table class="data">
          <thead>
            <tr><th></th><th>昵称</th><th>手机</th><th>城市</th><th>爱好</th></tr>
          </thead>
          <tbody>
            ${fakeBotTableRows(userData.users, 80)}
          </tbody>
        </table>
      </div>
      ${userData.users.length > 80 ? `<p class="muted">用户库仅显示前 80 条。</p>` : ""}

      <h3 style="font-size:14px;margin-bottom:8px">系统机器人库（种子 / 展示用）· 已有 ${systemData.users.length} 个</h3>
      <div style="overflow-x:auto">
        <table class="data">
          <thead>
            <tr><th></th><th>昵称</th><th>手机</th><th>城市</th><th>爱好</th></tr>
          </thead>
          <tbody>
            ${fakeBotTableRows(systemData.users, 80)}
          </tbody>
        </table>
      </div>
      ${systemData.users.length > 80 ? `<p class="muted">系统库仅显示前 80 条。</p>` : ""}
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

  function bindFakeAlbumDropZone() {
    const albumInput = document.getElementById("fake-album");
    const zone = document.getElementById("fake-album-drop");
    const hint = document.getElementById("fake-album-hint");
    const browse = document.getElementById("fake-album-browse");
    if (!albumInput || !zone || !hint) return;

    function updateHint() {
      const n = albumInput.files?.length || 0;
      hint.textContent = n
        ? `已添加 ${n} 张相册图（可继续拖拽或点击按钮追加）`
        : "将多张图片拖到此处释放（可分批追加）；或点击下方按钮多选";
    }

    function mergeIncoming(incomingList) {
      const add = Array.from(incomingList || []).filter((f) => String(f.type || "").startsWith("image/"));
      if (!add.length) return;
      const prev = albumInput.files?.length ? Array.from(albumInput.files) : [];
      const dt = new DataTransfer();
      [...prev, ...add].forEach((f) => dt.items.add(f));
      albumInput.files = dt.files;
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
    albumInput.addEventListener("change", updateHint);
    updateHint();
  }
  bindFakeAlbumDropZone();

  document.getElementById("fake-form").onsubmit = async (ev) => {
    ev.preventDefault();
    const avatarInput = document.getElementById("fake-avatar");
    const albumInput = document.getElementById("fake-album");
    const avatarFile = avatarInput.files?.[0];
    if (!avatarFile) {
      flash("请先选择头像图片（必选）：点「头像」下的文件框选一张本地图，再提交。", "err");
      avatarInput.scrollIntoView({ behavior: "smooth", block: "center" });
      avatarInput.focus();
      return;
    }

    const submitBtn = document.getElementById("fake-submit-btn");
    const fd = new FormData(ev.target);
    const albumFiles = albumInput.files ? Array.from(albumInput.files) : [];

    submitBtn.disabled = true;
    const prevText = submitBtn.textContent;
    try {
      submitBtn.textContent = "正在上传图片…";
      const avatarUrl = await uploadImageFile(avatarFile);
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

async function renderMessages(panel) {
  const data = await api(
    `/admin/api/messages?page=${msgPage}&pageSize=30${msgFilterTo ? `&toUserId=${encodeURIComponent(msgFilterTo)}` : ""}`
  );
  const botOptions = data.fakeBots
    .map((b) => `<option value="${escapeAttr(b.id)}" ${b.id === msgFilterTo ? "selected" : ""}>${escapeHtml(b.nickname)} (${escapeHtml(b.phone.slice(0, 12))}…)</option>`)
    .join("");
  panel.innerHTML = `
    <h2>发往 Fake 机器人的消息</h2>
    <p class="muted">仅展示 <code>toUserId</code> 为 fakem/fakef 机器人的聊天消息。</p>
    <div class="toolbar">
      <label>筛选接收机器人
        <select id="msg-to">
          <option value="">全部 Fake</option>
          ${botOptions}
        </select>
      </label>
      <button type="button" class="btn secondary" id="msg-apply">应用</button>
      <span class="muted">共 ${data.total} 条</span>
    </div>
    <div style="overflow-x:auto">
      <table class="data">
        <thead>
          <tr>
            <th>时间</th><th>发送者</th><th>接收机器人</th><th>类型</th><th>内容</th>
          </tr>
        </thead>
        <tbody>
          ${data.messages
            .map((m) => {
              const content =
                m.kind === "TEXT"
                  ? escapeHtml(m.text || "")
                  : m.kind === "IMAGE"
                    ? `<a href="${escapeAttr(mediaUrl(m.mediaUrl))}" target="_blank" rel="noopener">图片</a>`
                    : m.kind === "AUDIO"
                      ? `<a href="${escapeAttr(mediaUrl(m.mediaUrl))}" target="_blank" rel="noopener">语音</a>`
                      : escapeHtml(m.text || "");
              return `
            <tr>
              <td class="muted">${formatDate(m.createdAt)}</td>
              <td>${escapeHtml(m.fromUser?.nickname || "")}<div class="muted">${escapeHtml(m.fromUser?.phone || "")}</div></td>
              <td>${escapeHtml(m.toUser?.nickname || "")}</td>
              <td>${escapeHtml(m.kind)}</td>
              <td style="max-width:280px;word-break:break-word">${content}</td>
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
  document.getElementById("msg-prev").onclick = () => {
    msgPage = Math.max(1, msgPage - 1);
    renderMessages(panel);
  };
  document.getElementById("msg-next").onclick = () => {
    msgPage += 1;
    renderMessages(panel);
  };
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
