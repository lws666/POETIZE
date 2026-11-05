# 安全审查与修复记录

2026-11-05 对后端做了一次完整审查，发现 4 类问题并全部修复。

## 一、`/api/legacy` 全部接口无鉴权（严重）

### 问题

94 个 legacy 路由，**0 个有权限校验**。为了适配官方 Vue 前端追求"能跑通"，
路由直接用 `admin.post(...)` 注册，没走 Hono 的 `requireRole` 中间件。

实测未登录可直接：

- 读取用户列表（含邮箱）
- 修改用户等级 / 类型 / 状态
- 删除用户
- 删除文章
- 修改站点配置
- 新建文章

### 修复

新增 `backend/src/legacy/guard.ts`：

```ts
requireWrite(c)   需 user_type <= 1（站长/管理员）
requireBoss(c)    需 user_type === 0（站长）
requireLogin(c)   需已登录
```

在 `admin.ts` / `modules.ts` 的写操作路由开头调用：

```ts
const denied = await requireWrite(c)
if (denied) return denied
```

### 兜底路由也要鉴权

`legacy.all('/*', c => ok([]))` 会吞掉未匹配的管理路径。
未登录访问 `/admin/user/changeUserLv` 命中兜底，返回 `200 + []`，
看起来"调用成功"，实际是鉴权缺失的假象。

修复：兜底里按路径判断，`/admin/`、`/user/change*`、`/save*` 等要求管理员。

### 验证

10 个高危接口全部返回 401。

## 二、存储型 XSS（高危）

### 问题

评论、随笔、树洞用 `v-html` 渲染，后端原样存储。

实测提交：

```
<img src=x onerror=alert(1)>XSS_PROBE
```

原样入库，前端会执行脚本。

涉及：`comment.vue:52/78`、`jotting.vue:56`、`treeHole.vue:17`、`process.vue:21`

### 修复

新增 `backend/src/lib/sanitize.ts`：

- `sanitizeText()` 转义 `& < > " ' /`，先反转义一次避免二次转义
- `sanitizeUrl()` 只允许 http/https/相对路径，拒绝 `javascript:` `data:`
- 去掉控制字符

应用到 `comment.ts` 的 saveComment、`modules.ts` 的 saveWeiYan / saveNews / saveTreeHole。

**注意**：文章正文不走这里（作者本人内容，且需要 Markdown 渲染）。

### 验证

`<img src=x onerror=alert(1)>` → `&lt;img src=x onerror=alert(1)&gt;`

## 三、禁用用户仍可操作（中危）

### 问题

`currentUserLite()` 的 SQL 缺 `u.disabled = 0`：

```sql
SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
WHERE s.token_hash = ?1 AND s.expires_at > ?2
-- 缺 AND u.disabled = 0
```

`resolveUser()` 有检查，但 `currentUserLite()` 没有。
后者被 `comment.ts` / `modules.ts` / `article.ts` / `posts.ts` 使用。

后果：被封禁的用户仍能发评论、发随笔、看等级文章。

### 修复

补上 `AND u.disabled = 0`。

## 四、CORS 降级策略（低危）

### 问题

```js
origin: isAllowed ? origin : allow[0]
```

不放行时返回白名单首项，而非拒绝。配合 `credentials: true`，
虽然浏览器仍会拦截（origin 不匹配），但会返回"看似合法"的 CORS 响应。

### 修复

不放行时不下发 `Access-Control-Allow-Origin`，是更明确的拒绝信号。

## 做得好的部分

| 项 | 状态 |
|---|---|
| 密码哈希 | PBKDF2-SHA256，10 万次迭代 ✓ |
| 恒定时间比较 | 密码、UPLOAD_TOKEN 都做了 ✓ |
| Token 存储 | 只存 SHA-256 哈希 ✓ |
| SQL 注入 | 全部 `bind` 参数化，列名是常量 ✓ |
| 路径穿越 | `includes('..')` 拦截，实测有效 ✓ |
| SVG 上传 | 扫描 `<script>` / `onerror` ✓ |
| 自建 API | `/api/*` 鉴权完整 ✓ |

## 遗留建议

1. **登录限流是内存 Map**，Worker 多实例下不共享。建议改用 D1 或 KV 持久化计数。
2. **无 CSRF 防护**。Session Cookie 用 `SameSite=Lax`，能挡住大部分跨站 POST，但建议加 CSRF token。
3. **无审计日志**。建议记录管理端的写操作（谁在何时改了什么）。
4. **密码策略偏弱**。注册仅要求 6 位，建议提到 8 位以上并要求复杂度。
