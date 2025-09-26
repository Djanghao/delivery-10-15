# 审批管理系统爬取平台

简洁全栈实现：FastAPI 后端 + Next.js 前端（shadcn 风格），按文档要求实现人工触发爬取、项目存储与查询、导出、历史进度等。

## 结构

- `backend/` FastAPI 服务与爬虫逻辑（Python venv）
- `frontend/` Next.js 管理台（App Router + Tailwind）
- `docs/` 参考与需求文档

## 后端

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

接口见 `backend/README.md`。

## 前端

```bash
cd frontend
npm install
npm run dev
```

默认后端地址 `http://localhost:8000`，如需修改：设置 `NEXT_PUBLIC_API_BASE` 环境变量。

## 注意

- Python 使用 venv，不使用 conda。
- 数据库存于 `backend/data/app.db`。
- UI 中文，Twitter 风格，使用简化的 shadcn 风格组件。
