# 部署与运维指南

本文档说明如何在本地开发测试、如何将前端/后端部署到服务器，以及在服务器上如何用 PM2 管理服务。

## 目录结构（与部署相关）

- `scripts/deploy.sh`：本地构建并部署到服务器（rsync + sshpass）
- `scripts/server-install.sh`：服务器安装/更新 Python 依赖（venv + pip）
- `scripts/server-start.sh`：服务器上用 PM2 启动前端与后端
- `scripts/server-stop.sh`：停止 PM2 管理的所有进程（本项目）
- `scripts/server-restart.sh`：重启 PM2 进程
- `scripts/server-status.sh`：查看 PM2 状态与日志命令
- `scripts/start-dev.sh`：本地开发（前端 dev + 后端 uvicorn --reload）
- `ecosystem.config.js`：PM2 配置（后端 `gov-crawler-backend`，前端 `gov-crawler-frontend`）

---

## 一、本地开发/测试

前置：已安装 Python 3.8+、Node.js 18+、npm。

开发模式（热更新）：

```bash
./scripts/start-dev.sh
# 前端: http://localhost:6060
# 后端: http://localhost:8010  (Swagger: /docs)
```

停止：在运行脚本的终端按 Ctrl+C。

可选：本地验证生产构建（更贴近线上）：

```bash
# 安装后端依赖
./scripts/server-install.sh

# 构建前端
cd frontend && npm run build && cd -

# 用 PM2 按 ecosystem.config.js 启动
npm i -g pm2
pm2 start ecosystem.config.js
pm2 list

# 停止
pm2 stop ecosystem.config.js
```

---

## 二、部署到远程服务器

1) 设置服务器参数（如有变化）：

编辑 `scripts/deploy.sh` 顶部参数：

```bash
SERVER_IP="60.205.111.170"
SERVER_USER="root"
REMOTE_DIR="/root/gov-stats-crawler"
```

2) 运行部署脚本：

```bash
./scripts/deploy.sh
```

脚本会执行：
- 本地前端构建（Next.js）
- 通过 sshpass + rsync 同步：
  - 后端代码到 `$REMOTE_DIR/backend/`
  - 前端构建产物到 `$REMOTE_DIR/frontend/`
  - `ecosystem.config.js`、`package.json` 以及 `server-*.sh` 脚本到远程根目录
- 初始化远端目录、清理旧包装脚本、赋可执行权限

认证方式说明：
- 若已配置 SSH Key，将直接使用密钥登录。
- 若系统安装了 `sshpass`，脚本会询问一次密码并复用（不再读取 `.env.password`）。
- 若未安装 `sshpass`，则每次 `ssh/rsync` 调用时终端将交互式提示输入密码。

---

## 三、服务器上开启/管理服务

登录服务器并进入部署目录：

```bash
ssh root@60.205.111.170
cd /root/gov-stats-crawler
```

首次安装/更新依赖：

```bash
./scripts/server-install.sh
```

启动服务（PM2）：

```bash
./scripts/server-start.sh
```

查看状态与日志：

```bash
./scripts/server-status.sh
# 或者直接：
pm2 list
pm2 logs gov-crawler-backend
pm2 logs gov-crawler-frontend
```

重启/停止：

```bash
./scripts/server-restart.sh
./scripts/server-stop.sh
```

访问：

- 前端：http://60.205.111.170:3000
- 后端：http://60.205.111.170:8010

---

## 常见问题（FAQ）

- 提示 “Frontend build not found”：
  - 说明还没部署前端构建产物。请先在本地运行 `./scripts/deploy.sh`，再去服务器 `./scripts/server-start.sh`。

- 服务器上找不到 pm2：
  - `./scripts/server-start.sh` 会自动安装 pm2（`npm i -g pm2`）。也可手动安装后再运行。

- 修改了服务器 IP/目录后如何生效？
  - 更新 `scripts/deploy.sh` 顶部参数并重新执行 `./scripts/deploy.sh`。

- Next.js 环境变量：
  - 生产环境变量建议放在仓库根目录 `.env.production` 或前端自身 `.env.production`（按需配置），确保在本地 build 时可读取。
