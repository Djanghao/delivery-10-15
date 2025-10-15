# 审批管理系统爬取平台

一个具备全流程控制的浙江审批项目爬取平台，包含 FastAPI 后端服务与 Next.js + Ant Design 前端控制台。开发按 `docs/requirements` 与参考爬虫实现。

## 目录结构

- `backend/` FastAPI 服务与爬虫调度
- `frontend/` Next.js 前端
- `data/` SQLite 数据库与日志文件（运行时生成）
- `docs/` 需求与参考资料

## 后端（FastAPI）

1. **创建虚拟环境**
   ```bash
   cd backend
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   ```
2. **启动服务**
   ```bash
   uvicorn app.main:app --reload
   ```

### 关键接口

- `GET /api/regions` 地区树
- `POST /api/crawl/start` 启动历史/增量任务
- `GET /api/crawl/status` 当前任务状态
- `GET /api/crawl/runs` 任务历史摘要
- `GET /api/projects` 命中项目分页列表
- `GET /api/projects/export` 项目导出（支持多地区）
- `GET /api/logs` / `DELETE /api/logs` 日志查看与清空

日志存储在 `data/logs/crawler.log`，任务运行数据写入 `data/app.db`。

## 前端（Next.js + Ant Design）

1. 安装依赖
   ```bash
   cd frontend
   npm install
   ```
2. 启动开发服务
   ```bash
   npm run dev
   ```
3. 如需与后端联调，请在 `.env.local` 中配置：
   ```ini
   NEXT_PUBLIC_API_BASE_URL=http://localhost:8010
   ```

### 功能速览

- 左侧侧边菜单切换“数据爬取 / 爬取结果”两大页面
- 数据爬取页：
  - 地区树多选（自动加载城市/区县）
  - 历史 / 增量模式切换
  - 实时日志终端 + 最近任务列表
- 爬取结果页：
  - 地区筛选 + CSV 导出
  - 命中项目表格（Ant Design Table）
  - 任务执行摘要（模式 / 地区数 / 事项数 / 合格项目数）

## 生产部署（阿里云 ECS）

### 服务器准备

- 配置：2核4G以上
- 系统：Ubuntu 20.04/22.04
- 开放端口：80, 443, 22

### 环境安装

```bash
sudo apt update
sudo apt install python3 python3-pip python3-venv nginx

curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20

npm install -g pm2
```

### 部署步骤

```bash
git clone https://github.com/your-username/gov-stats-crawler.git
cd gov-stats-crawler

cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
pm2 start "uvicorn app.main:app --host 0.0.0.0 --port 8010" --name backend

cd ../frontend
npm install
npm run build
pm2 start npm --name frontend -- start

pm2 save
pm2 startup
```

### Nginx 配置

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location /api {
        proxy_pass http://localhost:8010;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

保存至 `/etc/nginx/sites-available/gov-stats`，然后：

```bash
sudo ln -s /etc/nginx/sites-available/gov-stats /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## 注意事项

- 网络访问受限环境下，爬虫可能无法直接访问浙江政务平台，请提前确认出口策略。
- 任务执行日志写入文件，无需额外数据库表，保持目录整洁即可。
- 如需扩展自动调度，可在 `backend/app/services/task_manager.py` 中引入定时器/消息队列。
- 首次启动时 `app.db` 和必要目录会自动创建。
