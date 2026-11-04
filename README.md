# POETIZE 博客

基于开源项目 [POETIZE](https://poetize.cn) 二次开发的个人博客，前端为官方 Vue2 原版，
后端用 Cloudflare Workers + D1 重写，替换掉原版的 Java SpringBoot + MySQL。

## 在线地址

| 服务 | 地址 |
|---|---|
| 博客前端 | https://www.lwsnb.eu.cc |
| 后端 API | https://api.lwsnb.eu.cc |

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | Vue 2.6 + Element UI 2.4 + vue-cli |
| 后端 | Cloudflare Workers + Hono |
| 数据库 | Cloudflare D1（SQLite） |
| 存储 | Backblaze B2 |
| CDN | Cloudflare |

## 目录结构

```
.
├── fe/                     前端（官方 poetize-ui 改造）
│   ├── src/
│   │   ├── components/     页面与组件
│   │   ├── utils/          constant.js 配置、request.js 请求封装
│   │   ├── store/          Vuex
│   │   └── assets/css/     全局样式
│   └── public/             静态资源、index.html、_headers
│
└── backend/                后端（Cloudflare Worker）
    ├── src/
    │   ├── index.ts        入口，挂载路由与 CORS
    │   ├── lib/            类型、鉴权、加密、B2、站点配置
    │   ├── routes/         自有 API（auth/users/posts/stats/...）
    │   └── legacy/         官方接口适配层（article/comment/user/...）
    └── wrangler.toml
```

## 后端接口分两层

**自有 API**：`/api/auth` `/api/users` `/api/posts` `/api/stats` `/api/tokens`
`/api/upload` `/api/album` `/api/site-config` `/api/post-access`

**官方适配层**：`/api/legacy/*`
把 D1 数据映射成官方 Java 后端的响应格式，让官方 Vue 前端无需改动即可运行。
覆盖 `article` `webInfo` `sysConfig` `comment` `user` `family` `weiYan` `resource` 等。

## 功能

- 文章：发布、编辑、删除、分类、标签、封面
- 访问控制：公开 / 登录可见 / 等级可见（LV1-LV6）/ 密码访问
- 用户：注册、登录、等级、用户类型（站长 / 管理员 / 普通）
- 评论：多级回复、点赞
- 随笔、树洞、留言板、表白墙、收藏夹、友人帐
- 资源管理：B2 直传、图库复用
- 管理后台：12 个页面（文章 / 分类 / 评论 / 用户 / 资源配置等）

## 本地开发

### 前端

```bash
cd fe
npm install
npm run serve
```

### 后端

```bash
cd backend
npm install
npx wrangler dev
```

## 部署

### 后端

```bash
cd backend
export CLOUDFLARE_API_TOKEN=<你的 token>
npx wrangler deploy
```

需要在 Cloudflare 配置的 Secret：
- `B2_ACCESS_KEY_ID`
- `B2_SECRET_ACCESS_KEY`
- `UPLOAD_TOKEN`

### 前端

```bash
cd fe
npm install
NODE_OPTIONS=--openssl-legacy-provider npm run build
npx wrangler pages deploy dist --project-name poetize-official
```

## 环境变量

`backend/wrangler.toml` 里的 `[vars]`：

| 变量 | 说明 |
|---|---|
| `ALLOWED_ORIGINS` | CORS 白名单，逗号分隔 |
| `B2_ENDPOINT` / `B2_REGION` / `B2_BUCKET` | B2 配置 |
| `B2_PUBLIC_URL` | B2 公开域名 |
| `SESSION_TTL_HOURS` | 会话有效期 |

## 致谢

前端来自开源项目 [POETIZE](https://poetize.cn)，感谢原作者 sara。
