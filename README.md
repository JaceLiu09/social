# 盲盒社交 App（MVP）

这是一个从 0 到 1 的「异性互动盲盒社交」基础项目，按前后端分离搭建：

- `frontend`：移动端风格 Web 前端（React + Vite）
- `backend`：API 服务（Node.js + Express + Prisma + MySQL）

## 核心流程（已落地）

1. 用户填写资料注册（包含基本信息和至少一张照片 URL）
2. 进入盲盒广场（仅文字内容 + 盲盒头像）
3. 进入开盲盒页，匹配异性用户
4. 掷骰子互动问答，每回合 +10% 友好度
5. 满足 `5回合` 且 `友好度100%` 后，允许解锁资料
6. 男性用户支付 `1.9元` 解锁女性资料权限（MVP 里是模拟支付）
7. 发起聊天前需会员权限（套餐价格已配置）

## 会员套餐（已配置）

- 月卡：49
- 季卡：129
- 半年卡：199
- 年卡：359

## 后端架构

- `src/server.js`：API 入口，承载业务路由
- `src/fakeBotPhone.js`：系统种子与后台「用户机器人」**共用**手机号生成（`fakem`/`fakef` + 8 位数字），按全局唯一 `phone` 避免冲突
- `src/config.js`：费率、回合数、友好度等业务常量
- `prisma/schema.prisma`：用户、匹配会话、男性解锁支付记录模型
- `prisma/seed.js`：初始化男女测试数据

### 主要接口

- `POST /auth/register`：注册并填写资料
- `POST /auth/login`：登录
- `GET /square/posts`：盲盒广场文本动态
- `GET /match/online-count`：在线人数随机波动
- `POST /match/start`：开始盲盒匹配
- `POST /game/dice-round`：进行一回合掷骰子互动
- `POST /match/unlock`：男性 1.9 解锁
- `POST /membership/subscribe`：开通会员
- `GET /users/:id/profile?viewerId=...`：会员态查看资料

## 前端架构

- `src/App.jsx`
  - 资料填写
  - 底部 3 标签页（开盲盒 / 盲盒广场 / 已互动）
  - 匹配 + 骰子 + 友好度进度
  - 解锁和会员开通入口
- `src/styles.css`：移动端简洁样式

## 机器人库逻辑（系统 vs 用户）

同一套 `User` 表里用字段 **`fakeRobotLibrary`**（Prisma 枚举 `NONE` / `SYSTEM` / `USER`）区分：

| 类型 | 含义 | 写入来源 |
|------|------|----------|
| **系统机器人库（SYSTEM）** | 种子生成的约两百个「隐藏款」账号，**只做首页 / 登录页头像展示**与盲盒星球卡片轮播 | 后端启动时 `ensureDefaultUsers` 里 `buildFakeBotUser`，手机号 `fakem*` / `fakef*` |
| **用户机器人库（USER）** | **玩家匹配、小游戏 bot 池**只从这里抽 | 管理后台「Fake 机器人」表单提交，`POST /admin/api/fake-bots` 写入；手机号格式与系统库相同，见 `fakeBotPhone.js` |

业务规则概要：

- **登录页顶部头像**：未登录时请求 `GET /public/robot-library/system`（公开接口），展示系统库头像。
- **登录后盲盒星球「附近推荐」卡片**：`GET /planet/robot-library/system`（需登录），只含系统库、异性向。
- **匹配与小游戏对手**：`GET /planet/robot-library/user`；`POST /match/start` 只在 **`fakeRobotLibrary === USER`** 的异性机器人里抽对象。
- **旧数据迁移**：服务启动时会把历史上 `fakem`/`fakef` 且无标记的记录标成 **SYSTEM**；若手机号曾为后台旧格式 **`fakefadm*` / `fakemadm*`**，会标成 **USER**。

数据库变更后请执行：`cd backend && npx prisma generate && npx prisma db push`。

若星球页长期显示「正在加载隐藏款资料」：**后端已对「仅有 fakem/fakef 手机号但尚未写入枚举」的旧数据做兼容查询**；仍为空时请确认后端已重启、数据库可连，且库里确实存在对应性别的机器人账号。

---

## 本地启动

先启动后端：

```bash
cd backend
npm install
cp .env.example .env
# 填入远程 MySQL 的 DATABASE_URL
npx prisma generate
npx prisma db push
node prisma/seed.js
npm run dev
```

再启动前端：

```bash
cd frontend
npm install
npm run dev
```

打开浏览器访问 Vite 输出地址即可。

## 远端部署：Node 与旧系统（glibc）

- **常见云主机 CentOS 7**：系统 **glibc 较旧**，官方 **Node 20** 预编译包可能无法运行（报 `GLIBC_2.27` / `GLIBC_2.28` 等）。本项目 **`deploy.sh` 使用 Node 16 LTS**，并把 **sharp 固定在 0.32.x**，与 Node 16、旧 glibc 更易共存。
- **sharp**：聊天缩略图用 **动态 `import('sharp')`**；若原生模块无法加载，仅不写缩略图，聊天仍可用原图。
- **若系统较新**（Ubuntu 22+ 等），可自行改用 Node 20：升级 `sharp` 至 0.33+ 并调整 `engines`；当前仓库默认面向旧机兼容。

---

## 远端部署后管理后台无法登录（500）

1. **默认账号**：`deploy.sh` 会在构建前执行 `prisma db push` 与 `npm run seed`。后台账号由 seed 写入 **AdminAccount**，默认 **`admin` / `123456`**（全部权限）。用户名 **`ellie`** / **`eliie`** 也可登录，但 **`canManageUsers` 为 false**，用户管理等 Tab 会受限；登录接口应对二者一致。
2. **若浏览器只显示「Internal Server Error」**：多为后端抛错未落到前端文案，请在服务器查看 **`pm2 logs social-backend`**。常见原因：**数据库连不上**（`P1001`）、**缺列 / 未迁移**（`P2022`，需在同一目录执行 `npx prisma db push` 与 `npm run seed`）、或部署未完成导致进程旧代码。
3. **自检**：本机 `curl -s http://127.0.0.1:4000/admin/api/health` 应返回 JSON；再 `curl -s -X POST http://127.0.0.1:4000/admin/api/auth/login -H "Content-Type: application/json" -d '{"username":"admin","password":"123456"}'` 应返回含 `token` 的 JSON。

## 下一步建议

- 接入真实短信登录、鉴权（JWT）
- 接入真实支付（微信/支付宝）和订单系统
- 增加聊天服务（WebSocket + 会话存储）
- 完善风控（人脸审核、收入证明审核、举报与拉黑）