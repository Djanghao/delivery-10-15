
# 审批管理系统爬取平台 - 后端设计文档

## 一、总体目标

* 支持用户在前端选择地区后，人工触发爬取任务。
* 任务可以是 **历史阶段** 或 **增量阶段**。
* 爬取过程全程可恢复，不丢数据。
* 数据库结构尽量简洁，便于维护。

---

## 二、系统架构

### 核心模块

1. **任务控制模块**

   * 前端传入地区列表和任务类型（历史 / 增量）。
   * 后端创建任务并启动执行。
2. **爬虫执行模块**

   * 按照既定逻辑调用接口：`getxzTreeNodes`、`projectDetail`。
   * 采用 pivot (`SENDID`) 确保任务断点可恢复。
3. **数据库存储**

   * 存储命中监管类型的项目（valuable_projects）。
   * 存储每个地区的最新 pivot（crawl_progress）。
4. **API 接口模块**

   * 任务触发接口
   * 任务进度查询接口
   * 项目查询导出接口

---

## 三、数据库设计

尽量精简，保证可用即可：

```sql
-- 有价值的项目
CREATE TABLE valuable_projects (
    projectuuid VARCHAR(64) PRIMARY KEY,
    project_name VARCHAR(255),
    region_code VARCHAR(20)
);

-- 各地区的爬取进度
CREATE TABLE crawl_progress (
    region_code VARCHAR(20) PRIMARY KEY,
    last_pivot_sendid VARCHAR(64)
);
```

说明：

* valuable_projects 只保存唯一命中项目。
* crawl_progress 只保存各地区最新进度。
* 不再设计日志表，日志直接写文件/控制台即可。

---

## 四、API 设计

### 1. 任务控制

- `POST /api/crawl/start`

  * 参数:
    ```json
    {
      "mode": "history" | "incremental",
      "regions": ["330100", "330200", "330300"]
    }
    ```
  * 功能: 启动指定地区的爬取任务。
- `GET /api/progress/:region`

  * 功能: 查询某地区的 pivot 信息。

### 2. 数据查询

- `GET /api/projects`

  * 参数: `region`, `page`, `size`
  * 返回: valuable_projects 列表。
- `GET /api/projects/export`

  * 功能: 导出全部 valuable_projects（CSV/Excel）。

---

## 五、爬取流程

### 历史阶段

1. 从最旧事项往新翻。
2. 每个事项：
   * 判断项目是否已存在 → 跳过。
   * 请求详情，判断监管类型。
   * 命中 → 写入 valuable_projects。
   * 更新 crawl_progress。

### 增量阶段

1. 从 `last_pivot_sendid` 开始。
2. **先定位**：从最新往旧翻，直到找到 pivot。
3. **再处理**：从 pivot 往新，执行与历史阶段相同的逻辑。
4. 更新 crawl_progress。

---

## 六、实现要点

* 所有任务均为 **人工触发**，前端多选地区后调用 API。暂不实现随时自动触发.
* 每个地区单独维护 pivot，互不影响。
