# POETIZE 博客

[![GitHub stars](https://img.shields.io/github/stars/lws666/POETIZE?style=social)](https://github.com/lws666/POETIZE/stargazers)
[![Frontend](https://img.shields.io/badge/Frontend-Vue%202.6-42b883?logo=vue.js)]()
[![Backend](https://img.shields.io/badge/Backend-Cloudflare%20Workers-f38020?logo=cloudflare)]()
[![Database](https://img.shields.io/badge/Database-D1-f38020?logo=cloudflare)]()
[![License](https://img.shields.io/badge/License-MIT-green)]()
[![Last Commit](https://img.shields.io/github/last-commit/lws666/POETIZE?label=Last%20Commit)](https://github.com/lws666/POETIZE/commits)
[![Repo Size](https://img.shields.io/github/repo-size/lws666/POETIZE?label=Repo%20Size)](https://github.com/lws666/POETIZE)

> ⭐ **如果这个项目对你有帮助，点个 Star 支持一下～**

基于开源项目 [POETIZE](https://poetize.cn) 二次开发的**动态博客系统**。前端保留官方 Vue 2.6 原版，后端用 **Cloudflare Workers + D1** 完全重写，替换掉原本需要独立服务器的 Java SpringBoot + MySQL。

发布文章**无需重新构建**，数据落 D1 即时生效。

> [!IMPORTANT]
> **为什么重写后端**
> 官方后端是 Java SpringBoot，部署需要一台服务器 + MySQL。
> 本项目的后端跑在 Cloudflare 边缘网络，**零服务器成本**，
> 通过一层适配器把 D1 数据映射成官方接口格式，**前端一行代码不改**。

---

### 📍 快速导航

- 🚀 [在线演示](#-在线演示)
- ✨ [功能特性](#-功能特性)
- 🏗️ [架构说明](#%EF%B8%8F-架构说明)
- 📦 [目录结构](#-目录结构)
- 🖥️ [环境要求](#%EF%B8%8F-环境要求)
- 🚀 [部署步骤](#-部署步骤)
- ⚙️ [配置说明](#%EF%B8%8F-配置说明)
- 🔌 [接口文档](#-接口文档)
- 🔒 [安全说明](#-安全说明)
- ❓ [常见问题](#-常见问题)

---

## 🚀 在线演示

| 服务 | 地址 |
|---|---|
| 博客前端 | https://www.lwsnb.eu.cc |
| 后端 API | https://api.lwsnb.eu.cc |
| 代码仓库 | https://github.com/lws666/POETIZE |

---

## ✨ 功能特性

| 模块 | 说明 |
|---|---|
| **文章管理** | 发布、编辑、删除、分类、标签、封面、置顶 |
| **访问控制** | 公开 / 登录可见 / 等级可见（LV1-LV6）/ 密码访问 |
| **用户系统** | 注册、登录、等级、用户类型（站长/管理员/普通） |
| **邮箱验证** | 注册验证码，Brevo 发信，15 分钟有效 |
| **评论系统** | 多级回复、点赞、表情、图片 |
| **内容模块** | 随笔、树洞、留言板、表白墙、收藏夹、友人帐 |
| **资源管理** | B2 直传、图库复用、缩略图预览 |
| **管理后台** | 12 个管理页（文章/分类/评论/用户/资源/配置等）|
| **SEO** | sitemap、robots、RSS、OG 卡片、JSON-LD |
| **CDN 缓存** | 分级缓存策略，图片边缘命中 |

---

## 🏗️ 架构说明

```
┌─────────────┐
│   浏览器     │
└──────┬──────┘
       │
       ├─────────────────────────┐
       │                         │
┌──────▼──────────┐    ┌────────▼─────────┐
│  Cloudflare     │    │   Cloudflare     │
│  Pages          │    │   Workers        │
│  （前端静态）    │    │   （后端 API）    │
└─────────────────┘    └────────┬─────────┘
                                │
                    ┌───────────┼───────────┐
                    │           │           │
              ┌─────▼─────┐ ┌───▼───┐ ┌────▼────┐
              │    D1     │ │  B2   │ │ Brevo  │
              │  （数据）  │ │（存储）│ │（邮件） │
              └───────────┘ └───────┘ └─────────┘
```

**关键设计：接口分两层**

| 层 | 路径 | 用途 |
|---|---|---|
| 自有 API | `/api/*` | 本项目设计，`{success, data}` 信封 |
| 官方适配层 | `/api/legacy/*` | 模拟原 Java 后端，`{code, message, data}` |

适配层的存在，让官方 Vue 前端**无需任何改动**即可运行，只需把 `baseURL` 指过来。

---

## 📦 目录结构

```
POETIZE/
├── fe/                         前端（官方 poetize-ui 改造）
│   ├── src/
│   │   ├── components/         页面组件
│   │   ├── utils/              constant.js 配置、request.js 请求封装
│   │   ├── store/              Vuex
│   │   └── assets/css/         全局样式
│   ├── public/                 静态资源、index.html、_headers
│   └── vue.config.js
│
├── backend/                    后端（Cloudflare Worker）
│   ├── src/
│   │   ├── index.ts            入口、CORS、安全头
│   │   ├── lib/                类型、鉴权、加密、B2、邮件
│   │   ├── routes/             自有 API
│   │   └── legacy/             官方接口适配层
│   ├── schema.sql              数据库结构（17 张表）
│   └── wrangler.toml
│
├── docs/                       文档
│   ├── API.md                  接口文档
│   ├── DEPLOY.md               部署指南
│   ├── SECURITY.md             安全审查记录
│   ├── MAIL.md                 邮件服务配置
│   └── ASSETS.md               图片资源优化
│
└── .github/workflows/          CI/CD
    ├── deploy-backend.yml
    └── deploy-frontend.yml
```

---

## 🖥️ 环境要求

| 工具 | 版本 | 说明 |
|---|---|---|
| Node.js | ≥ 20 | 前端构建用 20，后端可用 22 |
| npm | ≥ 10 | 随 Node 安装 |
| Cloudflare 账号 | - | 免费版即可 |
| Git | ≥ 2.30 | - |

> [!NOTE]
> 前端用的是 **vue-cli 4 + webpack 4**，在 Node 17+ 上构建必须加
> `NODE_OPTIONS=--openssl-legacy-provider`，否则报 `ERR_OSSL_EVP_UNSUPPORTED`。

---

## 🚀 部署步骤

### 通用前置

```bash
git clone https://github.com/lws666/POETIZE.git
cd POETIZE
```

### 🔐 获取必要令牌

**1. Cloudflare API Token**

访问 https://dash.cloudflare.com/profile/api-tokens → Create Token

需要权限：

| 范围 | 权限 |
|---|---|
| Account → Cloudflare Pages | Edit |
| Account → Workers Scripts | Edit |
| Account → D1 | Edit |
| Zone → DNS | Edit |

**2. Brevo API Key**（邮箱验证，可选）

https://www.brevo.com 注册 → Settings → SMTP & API → API Keys

---

### 后端部署

```bash
cd backend

# 1. 创建 D1 数据库
npx wrangler d1 create blog-db
# 把输出里的 database_id 填进 wrangler.toml

# 2. 初始化表结构
npx wrangler d1 execute blog-db --file=./schema.sql

# 3. 配置密钥
npx wrangler secret put B2_ACCESS_KEY_ID
npx wrangler secret put B2_SECRET_ACCESS_KEY
npx wrangler secret put UPLOAD_TOKEN
npx wrangler secret put BREVO_API_KEY     # 可选

# 4. 部署
npx wrangler deploy
```

---

### 前端部署

```bash
cd fe

# 1. 修改接口地址
vi src/utils/constant.js
# baseURL 改成你的 Worker 域名

# 2. 安装依赖
npm install

# 3. 构建
NODE_OPTIONS=--openssl-legacy-provider npm run build

# 4. 部署到 Pages
npx wrangler pages deploy dist --project-name poetize-official
```

---

### 自动部署（可选）

配置 GitHub Secrets 后，push 到 `main` 自动构建部署：

```
仓库 → Settings → Secrets and variables → Actions

CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
D1_DATABASE_ID
```

| 改动路径 | 触发的工作流 |
|---|---|
| `backend/**` | 类型检查 → 部署 Worker |
| `fe/**` | 构建 → 部署 Pages |

---

## ⚙️ 配置说明

### 站点配置（D1 `site_config` 表，21 项）

| 键 | 说明 | 示例 |
|---|---|---|
| `webName` | 站点名称 | 谢谢の博客 |
| `webTitle` | 站点标题 | 谢谢の博客 |
| `author` | 站长昵称 | 洛神 |
| `avatar` | 头像地址 | /avatar.jpg |
| `backgroundImage` | 背景图 | /hero.webp |
| `randomCover` | 随机封面池（JSON 数组）| `["/covers/1.jpg"]` |
| `notices` | 公告（JSON 数组）| `["欢迎"]` |
| `footer` | 页脚文案 | © 2026 |
| `bar.menu.show` | 导航菜单（逗号分隔）| 首页,记录,家 |
| `push.enable` | 首页弹窗开关 | `true` / `false` |
| `siteOrigin` | 图片绝对化源 | https://www.xxx.cc |
| `webStaticResourcePrefix` | 静态资源前缀 | `/` |

后台改法：**配置管理 → 编辑**，全中文名，图形化操作。

### 环境变量（`wrangler.toml` 的 `[vars]`）

```toml
ALLOWED_ORIGINS = "https://www.lwsnb.eu.cc"   # CORS 白名单，逗号分隔
B2_ENDPOINT = "https://s3.us-east-005.backblazeb2.com"
B2_REGION = "us-east-005"
B2_BUCKET = "Valaxy"
B2_PUBLIC_URL = "https://img.lwsnb.eu.cc"
MAIL_FROM = "admin@example.com"
MAIL_FROM_NAME = "谢谢の博客"
SESSION_TTL_HOURS = "168"
```

---

## 🔌 接口文档

完整文档见 **[docs/API.md](docs/API.md)**，这里列几个关键约定。

### 响应信封

```json
// 自有 API
{ "success": true, "data": {...} }

// 官方适配层
{ "code": 200, "message": "success", "data": {...} }
```

### 三种凭证传法

| 方式 | 传法 | 场景 |
|---|---|---|
| 标准 | `Authorization: Bearer sess_xxx` | 脚本、自有 API |
| **裸 token** | `Authorization: sess_xxx` | **官方前端就是这样** |
| Cookie | `Cookie: sid=sess_xxx` | 同域 |

> [!WARNING]
> 裸 token 支持是必须的。官方 `request.js` 写的是
> `headers = { "Authorization": localStorage.getItem("userToken") }`，
> **没有 `Bearer ` 前缀**。缺这个兼容会导致「登录了还是未登录」。

### 字段类型约定（血泪教训）

| 字段 | 必须 | 违反后果 |
|---|---|---|
| `notices` `randomCover` | **JSON 字符串** | `Unexpected token '欢'` |
| `sort` `label` | **对象** | 显示 `undefined` |
| `defaultStoreType` | **必须有值** | 显示 `undefined` |
| `listTreeHole` | **数组** | 弹幕空白 |
| `listCollect` | **分组对象** | 收藏夹空白 |

### HTTP 方法对照

多个删除接口前端用 **GET**，不是 POST：

```
article/deleteArticle         GET
sysConfig/deleteConfig        GET
family/deleteFamily           GET
webInfo/deleteTreeHole        GET
webInfo/deleteResourcePath    GET
resource/deleteResource       POST   ← 只有这个是 POST
```

---

## 🔒 安全说明

详见 **[docs/SECURITY.md](docs/SECURITY.md)**。

**已实施**

| 项 | 措施 |
|---|---|
| 密码存储 | PBKDF2-SHA256，10 万次迭代 |
| 令牌存储 | 只存 SHA-256 哈希，库中无明文 |
| 恒定时间比较 | 密码校验、静态令牌比对 |
| SQL 注入 | 全部 `bind` 参数化，列名是常量 |
| XSS | 用户输入统一 HTML 转义 |
| 路径穿越 | `includes('..')` 拦截 |
| SVG 上传 | 扫描 `<script>` / `onerror` |
| CORS | 白名单 + credentials 条件放行 |
| 禁用用户 | 会话查询强制校验 `disabled` |

**已知限制**

- 登录限流是内存 Map，Worker 多实例下不共享
- 无 CSRF token（依赖 `SameSite=Lax`）
- 无操作审计日志
- 注册密码仅要求 6 位

---

## ❓ 常见问题

### 构建报 `ERR_OSSL_EVP_UNSUPPORTED`

缺环境变量：

```bash
NODE_OPTIONS=--openssl-legacy-provider npm run build
```

### 部署后页面 522

DNS 记录指向了 zone 通用 IP，应改为：

```
CNAME → <project>.pages.dev
代理状态：已代理（橙色云）
```

### 接口返回 200 但前端显示未登录

官方 `request.js` 传的是裸 token（无 `Bearer ` 前缀），后端必须兼容。

### 后台资源列表图片「加载失败」

`secureHeaders` 注入了 `Cross-Origin-Resource-Policy: same-origin`，
`/api/album/file/*` 需要跳过该中间件并返回 `Access-Control-Allow-Origin: *`。

### 改了配置前台不生效

后台保存后必须 commit 回 Vuex store（`loadWebInfo`），
只调 `getWebInfo()` 刷新表单是不够的。

### 验证码邮件收不到

优先看 Brevo 后台的投递日志。常见原因：

- `eu.cc` 这类免费公共域被 Gmail 判定为垃圾邮件
- 发件人未在 Brevo 验证

### 发布文章后首页看不到

检查文章的 `categories` 是否为空。前端首页只渲染 `getSortInfo`
返回的分类，未分类文章会落到 `sortId=0`，不在列表中。

---

## 📄 License

MIT

## 🙏 致谢

- 前端来自开源项目 [POETIZE](https://poetize.cn)，感谢原作者 sara
- 图标与部分静态资源来自官方仓库
