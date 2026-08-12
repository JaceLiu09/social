# 盲盒星球 · Taro 原生微信小程序

API 与 H5 共用远端：**https://manghe.me**

## 在 ECS 服务器上构建（推荐）

```bash
cd /root/social-deploy/app
git fetch origin feat/taro-miniprogram
git checkout feat/taro-miniprogram

bash taro-app/build-on-server.sh
```

或随 deploy 一键构建：

```bash
BRANCH=feat/taro-miniprogram BUILD_TARO=1 bash deploy.sh
```

构建产物：`taro-app/dist/`（微信小程序代码）

## 微信开发者工具

1. 打开目录 **`taro-app/`**（不是 `miniprogram/` web-view 旧工程）
2. `project.config.json` 已设置 `"miniprogramRoot": "dist/"`
3. 先在服务器构建好 `dist/`，或将整个 `taro-app` 同步到本机
4. 测试号后台配置 **服务器域名**：`https://manghe.me`
5. 真机调试可开「打开调试」跳过域名校验

## 目录说明

| 路径 | 说明 |
|------|------|
| `src/pages/login` | 登录（调 `/auth/login`） |
| `src/pages/planet` | 首页 Tab · 附近推荐 |
| `src/pages/square` | 广场（占位，待迁移） |
| `src/pages/chat` | 聊天（占位，待迁移） |
| `src/pages/me` | 我的 · 退出登录 |
| `src/constants.js` | `API_BASE = https://manghe.me` |

## 与旧 miniprogram/ 的关系

- `miniprogram/`：web-view 套壳 H5（过渡方案）
- `taro-app/`：Taro 原生小程序（本分支长期开发）
