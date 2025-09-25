# 审批管理系统爬取方案

## 一、目标

* 爬取浙江投资项目审批系统的事项数据。
* 找出所有 **发生过指定监管类型事项的项目**。
* 保证过程 **万无一失**：不中断、不丢、不重。

---

## 二、关注的监管类型

* 企业投资（含外商投资）项目备案（基本建设）
* 企业投资（含外商投资）项目备案（技术改造）
* 企业投资（含外商投资）项目核准（基本建设）
* 企业投资（含外商投资）项目核准（技术改造）

---

## 三、核心概念

* **项目 (Project)**
  唯一标识：`projectuuid`
  一个项目包含多个事项。
* **事项 (Item)**
  唯一标识：`SENDID`（作为 pivot 使用）。
  属于一个项目。
* **地区 (Region)**
  唯一标识：`area_code`。
  每个地区独立维护一个 pivot。

---

## 四、数据库表设计

```sql
-- 有价值的项目（命中过目标监管类型）
CREATE TABLE valuable_projects (
    projectuuid VARCHAR(64) PRIMARY KEY,
    project_name VARCHAR(255),
    region_code VARCHAR(20)
);

-- 每个地区的爬取进度
CREATE TABLE crawl_progress (
    region_code VARCHAR(20) PRIMARY KEY,
    last_pivot_sendid VARCHAR(64)
);
```

---

## 五、阶段一：历史数据爬取

**目标**：补齐历史上所有命中过的项目。

### 流程

1. 获取地区列表 (参考 @docs/requirements/req-1.md 3.1 获取地区列表)
2. 对于选取的地区，从页码最大的那一页开始往前爬。 
   (获取最大页码: @docs/requirements/req-1.md:3.2.1) (爬取某一页的事项列表: @docs/requirements/req-1.md:3.2.2)
3. 对每个事项：

   * 如果 `projectuuid` 已在 `valuable_projects` → 跳过。
   * 否则：请求项目详情页（接口：`projectDetail`），遍历事项：
     * 如果发现目标监管类型 → 项目写入 `valuable_projects`。
   * **随时更新 pivot = 当前 SENDID**。
4. 该地区历史爬取完成后，`crawl_progress.last_pivot_sendid = 最新 SENDID`。

---

## 六、阶段二：增量数据爬取

**目标**：持续捕捉新增事项，保证不漏。

### 流程

1. 读取该地区的 `last_pivot_sendid`。
2. **第一步：新→旧找 pivot**

   * 从第一页（最新事项）往旧翻，查看每一页的事项, 直到找到 pivot → 停止。
   * 这一步只定位，不做业务处理。

3. **第二步：从 pivot→新处理**

   * 从 pivot 开始，往新扫描到最新事项。
   * 对每个事项：
     * 如果 `projectuuid` 已在 `valuable_projects` → 跳过。
     * 否则：请求项目详情页，遍历事项：
       * 如果发现目标监管类型 → 项目写入 `valuable_projects`。
     * **随时更新 pivot = 当前 SENDID**。
4. 结束后，`crawl_progress.last_pivot_sendid = 最新 SENDID`。

---

## 七、流程图（文字版）

```
历史阶段（一次性）：
  遍历事项（旧→新）
    → 项目是否在 valuable_projects?
        是 → 跳过
        否 → 请求项目详情
              命中监管类型? 是→项目入 valuable_projects
    → pivot = 当前 SENDID（实时更新）

增量阶段（循环执行）：
  步骤1：新→旧找 pivot（只定位，不做业务）
  步骤2：从 pivot→新扫描
    → 项目是否在 valuable_projects?
        是 → 跳过
        否 → 请求项目详情
              命中监管类型? 是→项目入 valuable_projects
    → pivot = 当前 SENDID（实时更新）
```
