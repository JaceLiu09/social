const LS_KEY = "blindbox_admin_config";

function loadConfig() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveConfig(base, secret) {
  localStorage.setItem(LS_KEY, JSON.stringify({ base, secret }));
}

function apiBase() {
  const { base } = loadConfig();
  return (base || "").replace(/\/$/, "") || "";
}

function headers() {
  const { secret } = loadConfig();
  return {
    "Content-Type": "application/json",
    "x-admin-secret": secret || ""
  };
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
  if (!res.ok) throw new Error(data.message || res.statusText);
  return data;
}

function mediaUrl(u) {
  if (!u) return "";
  if (u.startsWith("http")) return u;
  const base = apiBase();
  return base ? `${base}${u}` : u;
}

const app = document.getElementById("app");

function render() {
  const cfg = loadConfig();
  app.innerHTML = `
    <header class="top-bar">
      <h1>盲盒社交 · 后台管理</h1>
      <div class="config-row">
        <label>API 地址 <input type="text" id="cfg-base" placeholder="http://localhost:4000" value="${escapeAttr(cfg.base || "")}" /></label>
        <label>ADMIN_API_SECRET <input type="password" id="cfg-secret" placeholder="与后端环境变量一致" value="${escapeAttr(cfg.secret || "")}" /></label>
        <button type="button" class="btn" id="cfg-save">保存连接</button>
      </div>
    </header>
    <p class="muted" style="margin-top:-8px;margin-bottom:16px">本控制台为独立项目，不放在 frontend/backend 目录内。开发时可将 API 填 <code>http://localhost:4000</code>，并依赖 Vite 代理；直连远端时请填完整域名。</p>
    <nav class="tabs">
      <button type="button" data-tab="users" class="active">用户管理</button>
      <button type="button" data-tab="online">在线用户</button>
      <button type="button" data-tab="fakes">Fake 机器人</button>
      <button type="button" data-tab="messages">消息管理</button>
    </nav>
    <div id="panel-users" class="panel"></div>
    <div id="panel-online" class="panel hidden"></div>
    <div id="panel-fakes" class="panel hidden"></div>
    <div id="panel-messages" class="panel hidden"></div>
  `;

  document.getElementById("cfg-save").onclick = () => {
    const base = document.getElementById("cfg-base").value.trim();
    const secret = document.getElementById("cfg-secret").value.trim();
    saveConfig(base, secret);
    flash("已保存", "ok");
    setTab(currentTab);
  };

  let currentTab = "users";
  document.querySelectorAll(".tabs button").forEach((btn) => {
    btn.onclick = () => {
      currentTab = btn.dataset.tab;
      document.querySelectorAll(".tabs button").forEach((b) => b.classList.toggle("active", b === btn));
      setTab(currentTab);
    };
  });

  setTab("users");
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

async function setTab(tab) {
  document.querySelectorAll('[id^="panel-"]').forEach((p) => p.classList.add("hidden"));
  const panel = document.getElementById(`panel-${tab}`);
  if (!panel) return;
  panel.classList.remove("hidden");

  if (!loadConfig().secret) {
    panel.innerHTML = `<p class="msg err">请先在顶部填写并保存 <strong>ADMIN_API_SECRET</strong>（与后端 <code>ADMIN_API_SECRET</code> 环境变量一致）。</p>`;
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

async function renderFakes(panel) {
  const data = await api("/admin/api/fake-bots");
  panel.innerHTML = `
    <h2>Fake 机器人库</h2>
    <p class="muted">手机号以 <code>fakem</code> / <code>fakef</code> 开头，与主站盲盒/匹配逻辑一致。默认密码与种子用户相同：<code>123456</code>（仅测试环境）。</p>
    <h3 style="margin:20px 0 12px;font-size:14px">新增机器人</h3>
    <form id="fake-form" class="form-grid">
      <label>昵称 <input name="nickname" required placeholder="如 隐藏款女099" /></label>
      <label>性别
        <select name="gender"><option value="FEMALE">女</option><option value="MALE">男</option></select>
      </label>
      <label>年龄 <input name="age" type="number" value="24" min="18" max="80" /></label>
      <label>身高 cm <input name="height" type="number" placeholder="默认按性别" /></label>
      <label>体重 kg <input name="weight" type="number" placeholder="默认按性别" /></label>
      <label>家乡 <input name="hometown" placeholder="杭州" /></label>
      <label>现居城市 <input name="currentCity" placeholder="上海" /></label>
      <label>收入 <input name="income" value="8k-15k" /></label>
      <label>行业 <input name="industry" value="互联网" /></label>
      <label class="form-full">爱好（个性展示） <textarea name="hobbies" placeholder="羽毛球, 徒步, 美食"></textarea></label>
      <label class="form-full">对另一半期望（签名感文案） <textarea name="partnerExpectation" placeholder="真诚沟通，彼此尊重"></textarea></label>
      <div class="form-full upload-block">
        <strong>头像（必选）</strong>
        <p class="muted" style="margin:4px 0 8px">从本地上传一张，将作为头像并写入服务器 uploads。</p>
        <input type="file" id="fake-avatar" accept="image/*" required />
      </div>
      <div class="form-full upload-block">
        <strong>相册（可选，可多选）</strong>
        <p class="muted" style="margin:4px 0 8px">可选多张；提交后与头像一起保存为相册列表（头像 + 这些图片）。</p>
        <input type="file" id="fake-album" accept="image/*" multiple />
      </div>
      <div class="form-full">
        <button type="submit" class="btn" id="fake-submit-btn">提交到机器人库</button>
      </div>
    </form>
    <div id="fake-list-wrap" style="margin-top:24px">
      <h3 style="font-size:14px;margin-bottom:8px">已有 ${data.users.length} 个（仅 fakem/fakef）</h3>
      <div style="overflow-x:auto">
        <table class="data">
          <thead>
            <tr><th></th><th>昵称</th><th>手机</th><th>城市</th><th>爱好</th></tr>
          </thead>
          <tbody>
            ${data.users
              .slice(0, 80)
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
              .join("")}
          </tbody>
        </table>
      </div>
      ${data.users.length > 80 ? `<p class="muted">仅显示前 80 条，完整列表可通过接口拉取。</p>` : ""}
    </div>
  `;

  async function uploadImageFile(file) {
    const dataUrl = await fileToDataUrl(file);
    const res = await api("/admin/api/upload", {
      method: "POST",
      body: JSON.stringify({ fileName: file.name, dataUrl })
    });
    return res.url;
  }

  document.getElementById("fake-form").onsubmit = async (ev) => {
    ev.preventDefault();
    const avatarInput = document.getElementById("fake-avatar");
    const albumInput = document.getElementById("fake-album");
    const avatarFile = avatarInput.files?.[0];
    if (!avatarFile) {
      flash("请选择头像图片（本地上传）", "err");
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
        age: Number(fd.get("age") || 24),
        height: fd.get("height") ? Number(fd.get("height")) : undefined,
        weight: fd.get("weight") ? Number(fd.get("weight")) : undefined,
        hometown: fd.get("hometown") || "",
        currentCity: fd.get("currentCity") || "",
        income: fd.get("income") || "",
        industry: fd.get("industry") || "",
        hobbies: fd.get("hobbies") || "",
        partnerExpectation: fd.get("partnerExpectation") || "",
        avatarUrl,
        photoUrls
      };
      submitBtn.textContent = "正在创建…";
      await api("/admin/api/fake-bots", { method: "POST", body: JSON.stringify(body) });
      flash("已加入 Fake 机器人库", "ok");
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

render();
