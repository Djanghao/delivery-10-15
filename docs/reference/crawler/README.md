# Crawler Module

This folder contains the smallest possible crawler reference for浙江省投资项目审批
管理系统公告接口。它只展示“如何拿到原始数据”，方便后续按照
`docs/requirements` 中的方案去搭建后端服务与前端页面。

## 结构

- `client.py` — 使用 `urllib` 封装的轻量 HTTP 客户端，可调用
  `getxzTreeNodes`、`itemList`、`projectDetail` 三个接口。
- `models.py` — 数据类定义，对接口返回 JSON 做字段解析和简易清洗。
- `scripts/`
  - `test_public_announcement.py` — 烟雾测试脚本，验证单个地区的接口
    链路是否通畅：获取地区树、查询第一页事项、拉取该项目详情。
  - `find_target_projects.py` — 遍历指定地区所有事项，筛选命中关注监管
    类型的项目，并输出为 JSON（可初步验证统计结果）。
- `tmp_eco_projects.json` — 示例运行结果，记录 area_code `330354`
  （温州生态园）命中的 20 个项目及对应事项。

## 使用方法

脚本默认放在 `crawler/scripts/` 下，可通过设定 `PYTHONPATH` 在仓库根目录执行：

```bash
PYTHONPATH=crawler python3 crawler/scripts/test_public_announcement.py
LOG_LEVEL=WARNING PYTHONPATH=crawler python3 crawler/scripts/find_target_projects.py > crawler/tmp_eco_projects.json
```

> `LOG_LEVEL` 环境变量可调节日志级别，默认为 `INFO`。
