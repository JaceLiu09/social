# ECS 独立小程序目录

与主站 `/root/social-deploy/app` **分离**，专门存放 Taro 小程序源码与构建产物。

## 目录结构（setup 之后）

```
/root/social-miniprogram/
  repo/          # git clone feat/taro-miniprogram
  taro-app/      # → repo/taro-app
  dist/          # → repo/taro-app/dist
```

## 首次初始化（在 ECS 上）

```bash
bash /root/social-miniprogram/repo/scripts/ecs-miniprogram/setup-standalone.sh
```

或从本仓库拉取后：

```bash
cd /root/social-deploy/app
git fetch origin feat/taro-miniprogram
git checkout feat/taro-miniprogram
bash scripts/ecs-miniprogram/setup-standalone.sh
```

## 日常更新构建

```bash
bash /root/social-miniprogram/repo/scripts/ecs-miniprogram/rebuild.sh
```

## pm2 服务

| 名称 | 作用 |
|------|------|
| `social-miniprogram-artifact` | 在 **4188** 端口提供 `dist/` 静态访问（检查构建结果用） |

主站 API 仍在 `social-backend`（4000）/ `manghe.me`，**不需要**单独的小程序后端。

## 微信开发者工具

打开目录：`/root/social-miniprogram/taro-app/`（含 `project.config.json` 与 `dist/`）
