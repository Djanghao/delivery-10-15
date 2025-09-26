# 1. 审批管理系统数据爬取

审批管理系统链接: https://tzxm.zjzwfw.gov.cn/tzxmweb/zwtpages/resultsPublicity/notice_of_publicity_new.html?page=1
实体关系解释: 网站中有很多项目, 每个项目可能有多个事项先后发生. 每一个事项都是一个政府的监管, 每个事项属于一种监管类型.

## 2. 任务解释

在网站主页(https://tzxm.zjzwfw.gov.cn/tzxmweb/zwtpages/resultsPublicity/notice_of_publicity_new.html)上, 显示了很多事项.


给定一个地区, 我们有其对应的areacode, 从而得到该地区的所有事项列表.
(对照关系在 @docs/0-notes/area-all.json)
例如:
温州市/生态园->    
{
    "id": "330354", (生态园id)
    "pId": "330300",(温州市id)
    "name": "生态园"
},

当有了想找的地区, 得到了该地区的areacode后:

### 3.1 获取地区列表

获取所有地区:
Request URL: https://tzxm.zjzwfw.gov.cn/publicannouncement.do?method=getxzTreeNodes
Request Method: POST
Query String Parameters: method: getxzTreeNodes
response example:
```json "地区列表"
[
    {
        "id": "330000",
        "pId": null,
        "name": "浙江省"
    },
    {
        "id": "330100",
        "pId": "330000",
        "name": "杭州市"
    },
    {
        "id": "330102", # 地区的父id, 即杭州市
        "pId": "330100", # 地区id
        "name": "上城区" # 地区名
    },
    ...
```
由此可获得地区的嵌套关系

### 3.2.1 areacode -> 该地区事项列表的页数
Request URL: https://tzxm.zjzwfw.gov.cn/publicannouncement.do?method=itemList
Request Method: POST
query string parameters: method=itemList
form data: pageFlag=&pageNo=0&area_code=330354&area_flag=0&deal_code=&item_name=
(area_flag要设为0, area_code为地区id, 如生态园的330354, pageNo为要查看的页码)
为了查看总页码数是多少, 需要先将pageNo设为0, 先查看一下总页码数
response example:
```json "某地区的pageNo=0的事项列表"
[
    {
        "itemList": [ # 事项列表
            {
                "deal_code": "2019-330391-47-03-831266", # 项目代码
                "DEAL_STATE": "",
                "DEAL_TIME": "2025-09-19 17:41:05.0",
                "apply_project_name": "温州状元街道三郎桥A02-a地块综合办公楼建设工程", # 项目名称
                "ITEM_NAME": "建设工程规划核验和建设用地复核验收", #事项的监管类型
                "DEAL_NAME": "已办结",
                "DEPT_NAME": "生态园自然资源和规划局",
                "projectuuid": "0ca44f7d00474e1f847b271457bfd852", # 项目id
                "SENDID": "9fd848fd8c6211f09605e8611f6ae756" # 事项id
            },
        ...
        ],
        "counts": "92" # 该地区的事项列表的页码数
    }
]
```
由此获取到了页码数,

### 3.2.2 areacode + pageNo -> 该页中的事项列表
**当希望获得某一页的事项列表时, 修改pageNo即可, 重新请求即可**
填入需要的页码数, 重新请求之后, 可获得这些重要信息: [项目代码, 项目名称, 事项的监管类型, 项目id, 事项id] * N, N为该页的事项数

假如需要查pageNo=2的页
Request URL: https://tzxm.zjzwfw.gov.cn/publicannouncement.do?method=itemList
Request Method: POST
query string parameters: method=itemList
form data: pageFlag=&pageNo=2&area_code=330354&area_flag=0&deal_code=&item_name=
(area_flag要设为0, area_code为地区id, 如生态园的330354, pageNo为要查看的页码: 2)
response example:
```json "某地区pageNo=2的事项列表"
[
    {
        "itemList": [
            {
                "deal_code": "2020-330391-48-03-158734",
                "DEAL_STATE": "",
                "DEAL_TIME": "2025-08-01 11:34:11.0",
                "apply_project_name": "温州生态园三垟湿地市树市花园附属配套工程",
                "ITEM_NAME": "建设工程竣工验收消防备案",
                "DEAL_NAME": "已办结",
                "DEPT_NAME": "住房和城乡建设局",
                "projectuuid": "7b48225d25a74cb2b12aa3f4e39b5ce0",
                "SENDID": "ee5552f2c28642cb8d15f39490508f60"
            },
            ...
        ],
        "counts": "92" # 总事项数 (每页最多10个, 因此有92/10=9页)
    }
]
```

### 3.3 关注监管类型的事项筛选, 进而项目筛选:
总任务: 我们关注的监管类型为:
企业投资（含外商投资）项目备案（基本建设）
企业投资（含外商投资）项目备案（技术改造）
企业投资（含外商投资）项目核准（基本建设）
企业投资（含外商投资）项目核准（技术改造）
我们希望得到进行了这些监管类型的事项的所有项目.
若一个项目包含了有过这些监管类型的事项, 则项目需要收集.

在3.2中, 每个事项可以得到其项目的projectuuid(项目id)
这个id可以获得项目详情页的信息:
例如选择projectuuid=049340da4f3e49219c9e6ecab9ec7f29的项目时:
Request URL: https://tzxm.zjzwfw.gov.cn/publicannouncement.do?method=projectDetail
Request Method: POST
query string parameters: projectuuid=049340da4f3e49219c9e6ecab9ec7f29
response example:
```json "项目详情信息"
[
    {
        "deal_code": "2505-330354-04-01-274607", # 项目代码
        "audit_type": "备案类",
        "apply_project_name": "温州生态园三垟湿地西北片生态景观建设项目三期", # 项目名称
        "project_dept": "温州生态园基础设施建设有限公司",
        "itemListInfoVo": [ # 该项目的事项列表
            {
                "itemsortid": "6512f54b51c611e98ffe3c5282d9db7f",
                "deal_state": "ITEM_BJ",
                "item_name": "企业投资（含外商投资）项目备案（基本建设）", # 事项的监管类型 (这个情况下满足我们需要的监管类型, 则该项目为我们关注的项目)
                "item_symbol": "",
                "deal_name": "已办结",
                "dept_name": "发改和文化旅游局",
                "url": "2025/05/bb4a9da367eb48110167f7f50afe500f/049340da4f3e49219c9e6ecab9ec7f29/6ef3c4669efa409cae517c1f38077651_stamped.pdf", # pdf下载链接
                "sendid": "0545a65f7e8a484cb19b16107517273f", # 事项id
                "ext_sendid": "",
                "sendtype": "",
                "deal_time": "2025-05-29 15:01:44.0"
            },
        ...
        ]
    }
]
```
该项目的详情信息可以看到: itemListInfoVo中是否有item_name=四个重要监管类型的
若有, 则该项目为我们在寻找的项目

具体流程如下:
1. 获取所有地区信息, 选定要爬取的area code
2. 使用area code, 获得总页数
3. 使用area_code+想获得的页数 -> 得到该页的"某地区某页的事项列表" (参考3.2), 获得项目代码, 项目名称, 事项的监管类型, 项目id, 事项id
4. 通过项目id, 可以获得"项目详情信息"(参考3.3), 详情页中包含了当前该项目的所有事项的列表
5. 在3.3中的返回的"项目详情信息"中, 查看该项目的每个事项的监管类型(item_name), 是否是那四个我们关注的
6. 若有, 该项目为我们关注的项目, 保存在数据库