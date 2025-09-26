# 后端使用说明

- Python 版本: 3.10+
- 使用 venv，不使用 conda。

## 准备

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## 运行

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## 主要接口

- GET `/api/regions` 获取地区树
- POST `/api/crawl/start` 启动任务 `{mode, regions}`
- GET `/api/crawl/logs?job_id=...` 实时日志
- GET `/api/progress/{region}` 查询地区 pivot
- GET `/api/projects` 查询命中项目（分页）
- GET `/api/projects/export` 导出 CSV

数据库位于 `backend/data/app.db`，自动创建。
