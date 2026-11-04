# lwsnb API v2

重写版后端。**与旧 `worker/` 使用同一套 D1 库、同一个 Worker 名 `blog-worker`**，
可原地替换部署，也可随时回滚。

## 相比旧版的改动

| 维度 | 旧版 | 新版 |
|---|---|---|
| 代码量 | 4103 行 | ~900 行 |
| 认证 | Session + Token 混在 index.ts | 拆到 `lib/auth.ts`，双凭证统一入口 |
| 响应 | 分散在各处 | `lib/response.ts` 统一信封 |
| 类型 | 部分 any | 全量 TS 类型，`tsc --noEmit` 零错误 |
| 安全 | — | CORS 白名单 + secureHeaders + 登录限流 + 恒定时间比较 |
| 多用户 | users 路由 137 行 | 完整角色体系 + 最后管理员保护 + 改密踢会话 |

## 目录

```
src/
├─ index.ts          入口：CORS / 安全头 / 路由挂载 / 错误兜底
├─ lib/
│  ├─ types.ts       环境绑定与数据行类型
│  ├─ response.ts    统一信封 ok() / fail()
│  ├─ crypto.ts      PBKDF2 密码哈希 + SHA-256 + 随机令牌
│  ├─ auth.ts        Session/Token 双凭证解析 + 角色守卫
│  ├─ posts.ts       DTO 转换 + frontmatter 剥离 + slug 校验
│  └─ b2.ts          B2 S3 兼容客户端
└─ routes/
   ├─ auth.ts        登录/登出/me/改密
   ├─ users.ts       多用户管理（仅 admin）
   ├─ posts.ts       文章 CRUD
   ├─ stats.ts       站点统计
   ├─ tokens.ts      API 令牌（仅 admin）
   └─ upload.ts      B2 上传 + 代理读取
```

## 接口

### 公开
| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/health` | 健康检查 |
| GET | `/api/posts` | 文章列表（page/limit/tag/category/q） |
| GET | `/api/posts/:slug` | 文章详情（含正文） |
| GET | `/api/stats` | 站点统计 |

### 认证
| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/auth/login` | 登录，下发 HttpOnly Cookie |
| POST | `/api/auth/logout` | 登出 |
| GET | `/api/auth/me` | 当前用户 |
| PUT | `/api/auth/password` | 改自己的密码 |

### 内容（需 write）
| 方法 | 路径 |
|---|---|
| POST | `/api/posts` |
| PUT | `/api/posts/:slug` |
| DELETE | `/api/posts/:slug` |
| POST | `/api/upload` |

### 管理（需 admin）
| 方法 | 路径 |
|---|---|
| GET/POST/PUT/DELETE | `/api/users` `/api/users/:id` |
| GET/POST/DELETE | `/api/tokens` `/api/tokens/:id` |

## 角色

```
read   只读（可访问公开接口 + me）
write  read + 文章与上传的增删改
admin  write + 用户与令牌管理
```

## 部署

```bash
# 首次：注入 B2 密钥（不写进仓库）
npx wrangler secret put B2_KEY_ID
npx wrangler secret put B2_APP_KEY

npx wrangler deploy
```

回滚：把 `wrangler.toml` 的 `main` 改回 `../worker/src/index.ts` 再 deploy。

## 统一响应

```json
{ "success": true,  "data": { ... } }
{ "success": false, "error": "消息", "code": "bad_request" }
```
