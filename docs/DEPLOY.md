# 部署指南

## 一、首次配置

### 1. Cloudflare API Token

访问 https://dash.cloudflare.com/profile/api-tokens → Create Token

需要权限：

| 范围 | 权限 |
|---|---|
| Account → Cloudflare Pages | Edit |
| Account → Workers Scripts | Edit |
| Account → D1 | Edit |
| Zone → DNS | Edit |

拿到的 token 加到 GitHub Secrets。

### 2. GitHub Secrets

仓库 → Settings → Secrets and variables → Actions → New repository secret

| Name | 值 |
|---|---|
| `CLOUDFLARE_API_TOKEN` | 上一步的 token |
| `CLOUDFLARE_ACCOUNT_ID` | 账号 ID（Dashboard 右侧可见） |

### 3. 后端 Secret

Worker 的运行时密钥不写在代码里，用 wrangler 注入：

```bash
cd backend
npx wrangler secret put B2_ACCESS_KEY_ID
npx wrangler secret put B2_SECRET_ACCESS_KEY
npx wrangler secret put UPLOAD_TOKEN
```

### 4. D1 数据库

```bash
cd backend
npx wrangler d1 create blog-db
# 把输出的 database_id 填进 wrangler.toml
```

建表（按需执行，完整 schema 见 `backend/schema.sql`）。

---

## 二、自动部署

配置好 Secrets 后，push 到 `main` 会自动触发：

| 改动路径 | 触发的工作流 |
|---|---|
| `backend/**` | Deploy Backend |
| `fe/**` | Deploy Frontend |

也可以手动触发：仓库 → Actions → 选工作流 → Run workflow

工作流会先跑 `tsc --noEmit` 类型检查，通过后才部署。

---

## 三、手动部署

### 后端

```bash
cd backend

export CLOUDFLARE_API_TOKEN=<token>

npx tsc --noEmit          # 类型检查
npx wrangler deploy       # 部署
```

### 前端

```bash
cd fe

npm install
NODE_OPTIONS=--openssl-legacy-provider npm run build
npx wrangler pages deploy dist --project-name=poetize-official --branch=main
```

> `NODE_OPTIONS=--openssl-legacy-provider` 是必须的。
> vue-cli 用的是 webpack 4，在 Node 17+ 上会因 OpenSSL 3 报 `ERR_OSSL_EVP_UNSUPPORTED`。

---

## 四、SEO 文件更新

`sitemap.xml` / `rss.xml` 是**静态文件**放在 `fe/public/`，文章变动后不会自动更新。

发现过的问题：用 Pages Functions（`_worker.js`）做代理会导致整站
`Error 1019 Compute server error`，已放弃该方案。

更新步骤：

```bash
curl -s https://api.lwsnb.eu.cc/sitemap.xml > fe/public/sitemap.xml
curl -s https://api.lwsnb.eu.cc/rss.xml    > fe/public/rss.xml
git add fe/public && git commit -m "chore: 更新 sitemap" && git push
```

---

## 五、回滚

### 后端

```bash
cd backend
npx wrangler deployments list
npx wrangler rollback <deployment-id>
```

### 前端

Cloudflare Dashboard → Pages → poetize-official → Deployments
找到上一个正常版本 → ⋯ → Rollback to this deployment

---

## 六、常见问题

**构建报 `ERR_OSSL_EVP_UNSUPPORTED`**
缺 `NODE_OPTIONS=--openssl-legacy-provider`。

**部署后页面 522**
DNS 记录指向了 zone 通用 IP，应改为 CNAME → `<project>.pages.dev`，且开启 Cloudflare 代理（橙色云）。

**接口返回 200 但前端显示未登录**
官方 `request.js` 传的是裸 token（无 `Bearer ` 前缀），后端必须兼容。

**后台资源列表图片「加载失败」**
`secureHeaders` 注入了 `Cross-Origin-Resource-Policy: same-origin`，
`/api/album/file/*` 需要跳过该中间件并返回 `Access-Control-Allow-Origin: *`。

**改了配置前台不生效**
后台保存后必须 commit 回 Vuex store（`loadWebInfo`），
只调 `getWebInfo()` 刷新表单是不够的。
