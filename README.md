# PaddleOCR 在线文字识别工具

基于 Cloudflare Workers + PaddleOCR 在线 API 的文字识别工具，支持图片上传识别文字，自带登录保护。

## ✨ 功能特点

- 🔐 **登录保护**：用户名/密码通过环境变量配置
- 📄 **图片识别**：支持 JPG / PNG / BMP / WebP
- 📋 **一键复制**：识别结果一键复制到剪贴板
- 🖱️ **拖拽上传**：支持点击或拖拽上传
- 🌐 **完全免费**：部署在 Cloudflare 免费额度上
- 🔒 **隐私安全**：不存储任何用户数据

## 🧠 默认 OCR 引擎

本项目默认使用 **百度 PaddleOCR 在线 API**：

| 项目 | 说明 |
|------|------|
| **服务商** | 百度飞桨 PaddleOCR |
| **模型名称** | `PaddleOCR-VL-1.6` |
| **免费额度** | 每日 **20,000 页** |
| **支持语言** | 中文（简体/繁体）、英文、日文、韩文等 |
| **获取 Token** | https://aistudio.baidu.com/account/accessToken |

## 📋 前置准备

1. 一个 Cloudflare 账号
2. 一个 PaddleOCR Access Token
3. 一个 Cloudflare API Token（如在网页上部署，则不需要）

## 🚀 部署方式一：纯网页操作（推荐）

### 第一步：获取代码

从本 GitHub 仓库复制 `worker.js` 的全部内容

### 第二步：部署 Worker

1. 登录 Cloudflare Dashboard：https://dash.cloudflare.com/
2. 左侧菜单点击 **Workers 和 Pages**
3. 点击 **创建应用程序** → **创建 Worker**
4. 给 Worker 起个名字，例如 `paddle-ocr`
5. 点击 **编辑代码**
6. 删除所有默认代码，粘贴 `worker.js` 的全部内容
7. 点击 **保存并部署**

### 第三步：设置环境变量

1. 在 Worker 页面，点击顶部 **设置** 选项卡
2. 左侧菜单点击 **变量**
3. 在 **环境变量** 部分，点击 **添加变量**
4. 依次添加以下变量（选择 **"密钥"** 类型）：

| 变量名 | 说明 | 示例值 |
|--------|------|--------|
| `PADDLEOCR_TOKEN` | PaddleOCR Access Token | 你获取的 Token |

5. 添加完后，点击 **保存并部署**

### 第四步：测试

1. 在 Worker 的 **概述** 页面，点击访问地址
2. 输入用户名和密码登录
3. 上传一张图片测试识别功能

---

## 🚀 部署方式二：curl + 网页混合部署

环境变量仍然使用网页版设置

### 第一步：准备变量

```bash
ACCOUNT_ID="你的Cloudflare账户ID"
API_TOKEN="你的Cloudflare_API_Token"
WORKER_NAME="paddle-ocr"
```

### 第二步：部署 Worker

```bash
curl -X PUT "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/workers/scripts/$WORKER_NAME" \
  -H "Authorization: Bearer $API_TOKEN" \
  -F "metadata={\"main_module\":\"worker.js\",\"compatibility_date\":\"2025-01-01\"};type=application/json" \
  -F "worker.js=@worker.js;type=application/javascript+module"
```

### 第三步：设置环境变量

1. 进入 Cloudflare Dashboard → **Workers 和 Pages** → 点击你的 Worker
2. 点击 **设置** → **变量**
3. 添加以下密钥类型变量：

| 变量名 | 值 |
|--------|------|
| `PADDLEOCR_TOKEN` | 你的 PaddleOCR Token |

4. 点击 **保存并部署**

### 第四步：验证 Worker 是否正常运行

```bash
curl -X POST "https://你的Worker域名" \
  -H "Content-Type: application/json" \
  -d '{"imageUrl":"https://paddleocr.bj.bcebos.com/demo/test.jpg"}'
```


## 📱 使用说明

1. 访问你的 Worker 地址
2. 输入用户名和密码登录
3. 上传图片，点击 **识别文字**
4. 结果自动显示，点击 **复制** 即可复制

## 🔧 环境变量说明

| 变量名 | 必填 | 说明 |
|--------|------|------|
| `PADDLEOCR_TOKEN` | ✅ 是 | PaddleOCR Access Token |
| `USERNAME` | ✅ 是 | 登录用户名 |
| `PASSWORD` | ✅ 是 | 登录密码 |

## 注意

项目代码使用了AI

## 📄 许可证

MIT
