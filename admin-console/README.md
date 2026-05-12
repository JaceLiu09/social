# 盲盒社交 · 后台管理控制台

独立 Web 项目（不在 `frontend/`、`backend/` 目录内），用于：

- **用户管理**：分页查看注册用户，支持按手机 / 昵称 / 城市搜索。
- **在线用户**：读取主站 Socket 在线列表（与后端 `userSockets` 一致）。
- **Fake 机器人**：列表分为 **系统机器人库（SYSTEM）** 与 **用户机器人库（USER）**；表单录入的账号写入 **用户库**，供玩家匹配；系统库为种子展示账号（详见仓库根目录 `README.md`）。
- **消息管理**：查看所有 **接收方为 Fake 机器人** 的 `ChatMessage`（文本 / 图片 / 语音）。

## 后端配置

主 API 进程需设置环境变量（见 `backend/.env.example`）：

```bash
ADMIN_API_SECRET="至少8位随机字符串"
```

未配置或密钥短于 8 位时，`/admin/api` 返回 503。

## 本地运行

1. 启动主后端（默认 `http://localhost:4000`）。
2. 安装并启动本控制台：

```bash
cd admin-console
npm install
npm run dev
```

浏览器打开提示的地址（默认 `http://localhost:5274`）。

3. 在页面顶部填写：

- **API 地址**：开发时若使用 Vite 代理，可留空（请求走相对路径 `/admin/api`）；直连后端时填 `http://localhost:4000`。
- **ADMIN_API_SECRET**：与后端 `.env` 中一致。

点击「保存连接」后切换各 Tab 即可。

Fake 机器人创建：**头像、相册均在本页选择本地图片**，提交时依次调用 `POST /admin/api/upload` 写入后端 `uploads/image/`，再创建用户（无需手动填 URL）。

## 生产部署

- 将 `npm run build` 产物静态托管，或继续用 `vite preview`。
- 必须 **HTTPS + 强密钥**；管理接口仅在内网或 VPN 暴露。
- 主站静态托管需已为 SPA 配置回退；管理后台同理。
