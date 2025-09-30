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

---

## 问题分析与修复 (2025-09-30)

### 原文档的问题

上述第四步的描述**不完整且有误**。实际测试发现：

1. **直接使用 `url` 字段下载会失败**: 项目详情返回的 `url` 字段是文件的存储路径，但直接访问这个路径无法下载，会返回错误或空内容

2. **缺少下载接口的正确调用方式**: 实际下载需要调用特定的下载接口，并且**必须携带验证码**

### 正确的下载流程

经过实际测试（参考 `test/download_pdf.py`），正确的第四步应该是：

#### 第四步：使用专用下载接口下载文件

```
GET https://tzxm.zjzwfw.gov.cn/publicannouncement.do?method=downFile&sendid={sendid}&flag={flag}&Txtidcode={captcha_code}
Cookie: JSESSIONID=xxx; SERVERID=xxx
Referer: https://tzxm.zjzwfw.gov.cn/tzxmweb/zwtpages/resultsPublicity/notice_of_publicity_content_new.html?pUid={projectuuid}&sendid={sendid}
User-Agent: Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36

Parameters:
- method: downFile (固定值)
- sendid: 事项的sendid (从项目详情的itemListInfoVo中获取)
- flag: 通常为 "1"
- Txtidcode: 已验证通过的验证码

Response:
- Content-Type: application/pdf 或其他文件类型
- 二进制文件内容
```

### 关键发现

1. **验证码必须在下载时再次使用**: 不能只验证一次就丢弃，下载接口需要携带验证码
2. **不能直接使用 url 字段**: 必须使用 `method=downFile` 接口
3. **需要 sendid 参数**: 这是事项的唯一标识，从 `itemListInfoVo[].sendid` 获取

### 实现方案

在 `backend/app/services/parse_service.py` 和 `backend/app/api/routes/parse.py` 中实现了正确的下载流程：

1. **验证码会话管理**:
   - 在 `ParseSession` 中添加 `verified_captcha_code` 字段
   - 验证成功后保存验证码供后续下载使用

2. **修正下载函数签名**:
   ```python
   def download_with_session(
       client: PublicAnnouncementClient,
       cookies: str,
       referer: str,
       sendid: str,      # 新增
       flag: str,        # 新增
       captcha_code: str # 新增
   ) -> bytes
   ```

3. **构建正确的下载URL**:
   ```python
   download_url = f"{BASE_HOST}publicannouncement.do?method=downFile&sendid={sendid}&flag={flag}&Txtidcode={captcha_code}"
   ```

4. **API向后兼容**:
   - 保持 `url` 字段可选（用于提取文件名）
   - 新增 `sendid` 和 `flag` 参数
   - 优先使用传入的 `sendid`，否则使用 session 中的 `sendid`

### 测试验证

使用 `test/download_pdf.py` 成功验证了完整流程：
1. 初始化会话 ✓
2. 获取验证码图片 ✓
3. 验证码验证 ✓
4. 使用正确的 URL 格式成功下载 PDF ✓
