# 阶段一完成情况汇总（Stage-1 Completed）

本文记录当前系统（后端 FastAPI + 前端 Next.js + 数据层）已完成的能力、API 以及数据库表结构，便于后续阶段的扩展与对齐。

## 概述

- 已实现“审批管理系统”数据爬取平台的最小可用闭环：地区选择 → 触发任务（历史/增量）→ 实时日志 → 命中项目入库 → 结果筛选/导出。
- 后端遵循 `docs/requirements` 的设计要点，持久化每个地区的进度（pivot=SENDID），保证过程可恢复、不重不漏。
- 前端提供操作面板与结果页，支持多地区筛选、CSV 导出、按地区批量删除结果。

## 已完成范围

- 后端（`backend/`）
  - FastAPI 服务与 CORS 配置；SQLite 持久化（默认 `data/app.db`）。
  - 地区树获取与本地缓存（`data/regions.json`）。
  - 任务管理：提交、查询状态、历史运行摘要、协同取消。
  - 爬虫服务：历史模式与增量模式；基于 SENDID 的 pivot 维护；命中项目写入库；过程日志写入文件（`data/logs/crawler.log`）。
  - 项目结果分页查询、CSV 导出、按 UUID/地区删除。
- 前端（`frontend/`）
  - Dashboard：地区树选择、启动历史/增量任务、实时日志、任务状态轮询。
  - 任务管理页：进行中任务与已结束任务分栏查看、终止任务。
  - 结果页：按所选地区筛选、分页列表、CSV 导出、按地区批量删除。
- 数据层（`data/`）
  - SQLite 数据库文件 `app.db`，日志目录 `logs/`，地区缓存 `regions.json`。

---

## API 文档（当前实现）

基础说明：服务默认标题为 `审批管理系统爬取平台 API`。所有接口均返回 JSON（导出除外）。

- `GET /health`
  - 用途：健康检查。
  - 响应：`{"status":"ok"}`

- 地区相关（tags: `regions`）
  - `GET /api/regions`
    - 用途：获取地区树（以“市级”为根结点，包含下属区县）。
    - 响应：`RegionNode[]`
      - `RegionNode`: `{ id: string, name: string, pId?: string, children: RegionNode[] }`
  - `POST /api/regions/refresh`
    - 用途：强制刷新地区树（实时抓取并更新本地缓存）。
    - 响应：同上 `RegionNode[]`

- 爬取任务（tags: `crawl`）
  - `POST /api/crawl/start`
    - 用途：启动任务。
    - 请求体：`{ mode: "history" | "incremental", regions: string[] }`
    - 响应：`{ task_id: string }`
  - `GET /api/crawl/status/{task_id}`
    - 用途：查询单个任务状态。
    - 响应：`TaskStatus`
      - `{ task_id, status: "pending"|"running"|"succeeded"|"failed"|"cancelled", message?, run_id?, mode?, regions?, started_at?, finished_at? }`
  - `GET /api/crawl/status?open_only=true|false`
    - 用途：查询任务状态列表；默认仅返回进行中/等待中任务。
    - 响应：`TaskStatus[]`
  - `GET /api/crawl/runs`
    - 用途：查询任务运行历史摘要（按开始时间倒序）。
    - 响应：`CrawlRunItem[]`
      - `{ id, mode, regions: string[], region_count: number, total_items: number, valuable_projects: number, started_at, finished_at? }`
  - `POST /api/crawl/stop/{task_id}`
    - 用途：请求结束任务（协作式取消）。
    - 响应：`{ task_id: string, status: "cancelled" }`

- 结果数据（tags: `projects`）
  - `GET /api/projects`
    - 用途：分页查询命中项目。
    - 参数：`region`（单选，可选）、`regions`（多选，重复参数，可选）、`page`（默认1）、`size`（默认20，最大200）。
    - 响应：`PaginatedProjects`
      - `{ items: ProjectItem[], total: number, page: number, size: number }`
      - `ProjectItem`: `{ projectuuid, project_name, region_code, discovered_at }`
  - `GET /api/projects/export`
    - 用途：导出筛选结果为 CSV（按 `region/regions` 过滤）。
    - 响应：`text/csv`，下载文件名 `valuable_projects.csv`。
  - `DELETE /api/projects`
    - 用途：按 UUID 批量删除。
    - 请求体：`{ projectuuids: string[] }`
    - 响应：HTTP 204（无正文）。
  - `DELETE /api/projects/by-regions?regions=330100&regions=330200...`
    - 用途：按地区批量删除。
    - 响应：`{ deleted: number }`

- 日志（tags: `logs`）
  - `GET /api/logs?limit=200`
    - 用途：读取最近 N 条日志（默认 200，上限 500）。
    - 响应：`LogEntry[]`，`{ timestamp, level, message }`
  - `DELETE /api/logs`
    - 用途：清空日志文件。
    - 响应：HTTP 200（空）。

---

## 数据库表结构（SQLite）

当前代码模型（`backend/app/models.py`）定义并实际使用以下表：

- 表：`valuable_projects`
  - 主键：`projectuuid` (VARCHAR(64))
  - 字段：
    - `project_name` (VARCHAR(255)) 项目名称
    - `region_code` (VARCHAR(20)) 地区编码
    - `discovered_at` (DATETIME) 命中写入时间
  - 说明：保存“命中过指定监管类型”的唯一项目（去重以 `projectuuid` 为准）。

- 表：`crawl_progress`
  - 主键：`region_code` (VARCHAR(20))
  - 字段：
    - `last_pivot_sendid` (VARCHAR(64)) 该地区最近处理到的事项 SENDID
    - `updated_at` (DATETIME) 记录更新时间
  - 说明：维护每个地区的爬取进度（pivot），支持断点续跑。

- 表：`crawl_runs`
  - 主键：`id` (VARCHAR(36)) 运行 ID（UUID）
  - 字段：
    - `mode` (VARCHAR(20)) 运行模式：history / incremental
    - `regions_json` (TEXT) 本次覆盖的地区列表（JSON 数组）
    - `total_items` (INTEGER) 处理事项总数
    - `valuable_projects` (INTEGER) 新入库项目数
    - `started_at` (DATETIME) 开始时间
    - `finished_at` (DATETIME, 可空) 结束时间
  - 说明：记录每次任务运行的汇总数据，用于“任务历史”与进行中任务的 UI 展示。

实际数据库中当前还存在以下表（非代码路径直接使用，可能为后续扩展预留）：

- 表：`project_extracted`
  - 主键：`projectuuid` (VARCHAR(64))
  - 字段：`data_json` (TEXT), `extracted_at` (DATETIME)
- 表：`valuable_project_items`
  - 主键：`sendid` (VARCHAR(64))
  - 字段：`projectuuid` (VARCHAR(64)), `item_name` (VARCHAR(255)), `region_code` (VARCHAR(20)), `url` (VARCHAR(1024)), `deal_time` (DATETIME), `created_at` (DATETIME)

> 注：上述两张表并未被当前业务代码读写，后续若启用请在模型层补充相应 ORM 定义与接口。

---

## 关键实现要点（与需求对齐）

- 地区获取：`POST publicannouncement.do?method=getxzTreeNodes`，前端展示为“市级为根”的树形结构，并可刷新缓存。
- 历史阶段：按页从旧到新遍历事项；命中则写入 `valuable_projects`；每处理一条均更新 pivot（SENDID）。
- 增量阶段：从最新往旧定位到上次 pivot，再从 pivot→最新执行与历史同样的处理逻辑，过程同样实时更新 pivot。
- 命中判定：`ProjectDetail.itemListInfoVo.item_name` ∈ 四类监管类型（详见 `docs/requirements/crawler.md`）。
- 可靠性：
  - 进度按地区粒度维护，天然支持断点续跑与幂等（重复命中不重复入库）。
  - 任务支持协作式取消，避免长任务无法中止。
  - 日志追加到 `data/logs/crawler.log`，前端可视化查看/清空。

---

## 配置与运行

- 环境变量：
  - `GOV_STATS_DATA_DIR`：数据目录（默认仓库 `data/`）。
  - `GOV_STATS_DATABASE_URL`：数据库 URL（默认 `sqlite:///data/app.db`）。
  - 前端：`NEXT_PUBLIC_API_BASE_URL` 指向后端服务根地址（默认 `http://localhost:8010`）。
- 关键路径：
  - 数据库：`data/app.db`
  - 日志：`data/logs/crawler.log`
  - 地区缓存：`data/regions.json`

---

## 阶段性进度小结

- 按 `docs/requirements/backend.md` / `crawler.md` 的目标，Stage-1 的“历史数据爬取”闭环已完成，并同步具备“增量数据爬取”。
- 前端围绕“地区选择、启动任务、查看日志、查看与导出结果、任务管理”等核心流程已打通。
- 数据库结构保持最小化且与业务一致，可支撑后续细化（如明细项入库、附件抓取等）。

如需我继续补充阶段二（Stage-2）的实施计划或对外 API 变更说明，请告知。

