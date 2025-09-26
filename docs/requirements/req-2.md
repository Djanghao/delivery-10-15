# 审批管理系统文档下载

在@docs/1-requirements/req-1.md中, 已经得到了需要的项目信息.
那么在前端中需要下载这些项目的文件

## 下载流程技术分析

经测试验证，完整的文档下载流程如下:

### 第一步：建立会话 (获取Cookie)
```
POST https://tzxm.zjzwfw.gov.cn/publicannouncement.do?method=projectDetail
Content-Type: application/x-www-form-urlencoded; charset=UTF-8
User-Agent: Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36

Form Data:
projectuuid=fbf61bfa55574425aef789722aaa57dc (从事项列表获得)

Response Headers:
Set-Cookie: JSESSIONID=xxx; Path=/; HttpOnly
Set-Cookie: SERVERID=xxx|timestamp|timestamp;Path=/
```

### 第二步：获取验证码图片
```
GET https://tzxm.zjzwfw.gov.cn/publicannouncement.do?method=publicCheckContent&t={timestamp}
Accept: image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8
Cookie: JSESSIONID=xxx; SERVERID=xxx
Referer: https://tzxm.zjzwfw.gov.cn/tzxmweb/zwtpages/resultsPublicity/notice_of_publicity_content_new.html?pUid={projectuuid}&sendid={sendid}
User-Agent: Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36

Response: JPEG图片 (70x35像素)
```

### 第三步：提交验证码
```
POST https://tzxm.zjzwfw.gov.cn/publicannouncement.do?method=CheckRandom
Content-Type: application/x-www-form-urlencoded; charset=UTF-8
Cookie: JSESSIONID=xxx; SERVERID=xxx
Referer: https://tzxm.zjzwfw.gov.cn/tzxmweb/zwtpages/resultsPublicity/notice_of_publicity_content_new.html?pUid={projectuuid}&sendid={sendid}
User-Agent: Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36

Form Data:
Txtidcode={captcha_code}

Response:
- 成功: [{"random_flag":"1"}]
- 失败: [{"random_flag":"0"}]
```

### 第四步：下载文件
验证码验证成功后，可直接访问项目详情页response中的`url`字段进行文件下载。

## 关键技术要点

1. **会话管理**: 必须先调用项目详情API建立会话，获取JSESSIONID和SERVERID cookie
2. **Referer验证**: 验证码相关接口需要正确的Referer头，格式为项目详情页URL
3. **验证码识别**: 需要OCR或人工识别70x35像素的JPEG验证码图片
4. **文件URL构造**: 下载链接从项目详情response的`itemListInfoVo[].url`字段获取

## 下载文件路径示例

从项目详情API返回的数据中，每个事项包含`url`字段，如:
- PDF文件: `EcaFiles/2025_04/21144df1-5c61-4fa2-bb65-dedd71a7fd47.pdf`
- OFD文件: `2025/05/4b6dc947130d404a8674188f7d4ede7f/fbf61bfa55574425aef789722aaa57dc/1.2.156.3005.2.11100000000013338W009.11330105002500287C.2025052201.002.0.OFD`

完整下载URL需要加上域名前缀: `https://tzxm.zjzwfw.gov.cn/` + url字段
