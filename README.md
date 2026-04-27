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

## 下一步建议

- 接入真实短信登录、鉴权（JWT）
- 接入真实支付（微信/支付宝）和订单系统
- 增加聊天服务（WebSocket + 会话存储）
- 完善风控（人脸审核、收入证明审核、举报与拉黑）