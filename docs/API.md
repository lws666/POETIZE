# 接口文档

后端两个层面：

1. **自有 API** `/api/*` —— 本项目设计的接口，`{ success, data }` 信封
2. **官方适配层** `/api/legacy/*` —— 模拟原 Java 后端，`{ code, message, data }` 信封

> 适配层的存在意义：官方 Vue 前端代码一行不改也能跑，只需把 `baseURL` 指过来。

---

## 响应信封

### 自有 API

```json
{ "success": true, "data": {...} }
{ "success": false, "error": "错误信息", "code": "bad_request" }
```

### 官方适配层

```json
{ "code": 200, "message": "success", "data": {...} }
```

**注意**：`code` 是业务码，HTTP 状态码始终 200。前端判断 `code === 200`。

例外：`/api/legacy/webInfo/getWaifuJson` 返回**裸 JSON**（前端用原生 `fetch`，不走 axios 拦截器）。

---

## 认证

三种凭证，任选其一：

| 方式 | 传法 | 场景 |
|---|---|---|
| Bearer 标准 | `Authorization: Bearer sess_xxx` | 脚本、自有 API |
| **裸 token** | `Authorization: sess_xxx` | **官方前端（request.js 就是这样）** |
| Cookie | `Cookie: sid=sess_xxx` | 同域场景 |

> 裸 token 支持是必须的。官方 `request.js` 写的是
> `headers = { "Authorization": localStorage.getItem("userToken") }`，
> **没有 `Bearer ` 前缀**。缺这个兼容会导致「登录了还是未登录」。

### 用户类型与等级

```
user_type  0=站长  1=管理员  2=普通用户
role       admin / read（由 user_type 推导，自动同步）
user_lv    1..6
```

---

## 一、自有 API

### 认证 `/api/auth`

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/login` | `{username, password}` → 下发 Cookie + 返回 `{username, role, user_type, user_lv}` |
| POST | `/logout` | 清除会话 |
| GET | `/me` | 当前用户，未登录取 `user: null` |
| PUT | `/password` | `{oldPassword, newPassword}` |

### 用户 `/api/users`（需 admin）

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/` | 列表 |
| POST | `/` | 新建 `{username, password, role}` |
| PUT | `/:id` | 改 `role` / `user_type` / `user_lv` / `disabled` / `password` |
| DELETE | `/:id` | 删除 |

**站长保护**（两级）：

1. `user_type=0` 的账号**永久不可降级 / 停用 / 删除**
2. `user_type ∈ {0,1}` 的启用账号至少保留 1 个

### 文章 `/api/posts`

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/` | 列表，支持 `?page=&size=&tag=&category=` |
| GET | `/:slug` | 详情。无权时返回 `locked=true` + 空正文 |
| POST | `/` | 新建（需 write） |
| PUT | `/:slug` | 更新（需 write） |
| DELETE | `/:slug` | 删除（需 write） |

**访问控制返回结构**（无权时 HTTP 仍 200）：

```json
{
  "locked": true,
  "lockReason": "need_login | need_level | wrong_password",
  "lockMessage": "需要 LV3 才能查看（当前 LV1）",
  "needLevel": 3,
  "currentLevel": 1,
  "content": ""
}
```

### 文章访问控制 `/api/post-access`

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/types` | 可选类型清单 |
| GET | `/` | 所有非公开文章 |
| GET | `/:slug` | 读某篇设置 |
| PUT | `/:slug` | 设置 `{view_type, view_value, tips}` |

`view_type` 取值：

| 值 | 含义 | view_value |
|---|---|---|
| `public` | 公开 | 忽略 |
| `login` | 登录可见 | 忽略 |
| `userLv` | 等级可见 | `1`-`6` |
| `password` | 密码可见 | 明文密码 |

**密码优先于登录判断** —— 未登录用户输对密码也能看（对齐官方 `ResourceCheckAspect`）。

### 站点配置 `/api/site-config`

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/` | 公开读 |
| GET | `/admin` | 后台读（需登录） |
| PUT | `/` | 批量更新（需 admin） |

21 个配置键：`webName` `webTitle` `author` `avatar` `backgroundImage`
`randomCover` `notices` `footer` `beian` `bar.menu.show` `status`
`local.enable` `qiniu.enable` `webStaticResourcePrefix` `siteOrigin`
`push.enable` `friend*`（5 个）

### 其他

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/stats` | 站点统计 |
| GET/POST/DELETE | `/api/tokens` | API Token 管理 |
| POST | `/api/upload` | 上传 |
| GET | `/api/album` | 相册列表 |
| GET | `/api/album/file/:key` | 图片代理（公开，CORS `*`） |

### SEO（挂在根路径）

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/sitemap.xml` | 站点地图 |
| GET | `/robots.txt` | 爬虫规则 |
| GET | `/rss.xml` | 文章 RSS |

---

## 二、官方适配层 `/api/legacy`

### 数据结构约定（血泪教训）

这四条必须严格遵守，否则前端显示异常：

| 字段 | 必须类型 | 违反后果 |
|---|---|---|
| `notices` `randomCover` `randomName` `randomAvatar` | **JSON 字符串** | `Unexpected token '欢'` |
| `sort` `label` | **对象** `{id, sortName}` | 页面显示 `undefined` |
| `defaultStoreType` | **必须有值** | 显示 `undefined` |
| `listTreeHole` | **数组** | 弹幕为空 |
| `listCollect` | **分组对象** | 收藏夹空白 |

### 文章 `/api/legacy/article`

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/listArticle` | 分页列表 |
| GET | `/listSortArticle` | 首页按分类分组。**key 必须是 sortId（数字），不能是分类名**；未分类要兜到第一个分类，不能是 `0` |
| GET | `/getArticleById?id=N` | 详情，集成访问控制 |

### 站点信息 `/api/legacy/webInfo`

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/getWebInfo` | **11 个字段**，`notices`/`randomCover` 是 JSON 字符串 |
| GET | `/getSortInfo` | 分类列表，**必须含 `countOfSort`**（侧栏统计用） |
| GET | `/listSortAndLabel` | 分类 + 标签 |
| GET | `/getHistoryInfo` | 后台统计（8 个字段，见下） |
| GET | `/getWaifuJson` | 看板娘配置，**返回裸 JSON** |

`getHistoryInfo` 字段名必须完全一致：

```
ip_history_count  ip_history_province  ip_history_ip
ip_count_today    province_today       username_today
ip_count_yest     username_yest
```

### 用户 `/api/legacy/user`

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/login` | **字段是 `account` 不是 `username`**；密码是 AES-128-ECB 密文，key `sarasarasarasara`；返回 `accessToken` |
| POST | `/regist` | 注册，默认 `user_type=2` `user_lv=1` |
| GET | `/logout` | 登出 |
| GET | `/getUserInfo?id=N` | 公开信息 |
| POST | `/updateUserInfo` | 改资料 |

**AES 解密**：WebCrypto 不支持 ECB，实现为「每 16 字节块用零 IV 做 CBC」，等价 ECB，再手工去 PKCS7 padding。

### 评论 `/api/legacy/comment`

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/listComment` | 一级评论 + 楼层内子回复嵌套 |
| GET | `/getCommentCount` | 计数 |
| POST | `/saveComment` | 需登录 |
| GET | `/likeComment` | 点赞 |

### 其他模块 `/api/legacy`

```
webInfo/getSortInfo  webInfo/getTreeHole  webInfo/saveTreeHole
weiYan/listWeiYan    weiYan/saveWeiYan    weiYan/listNews
family/getAdminFamily  family/listFamily
resource/listResource  resource/upload
```

### 后台管理 `/api/legacy/admin/*`

```
POST /admin/article/boss/list          文章列表
GET  /admin/article/getArticleById     编辑页取完整文章
GET  /admin/article/changeArticleStatus 改状态（articleId + 具名参数）
POST /admin/user/list                  用户列表
GET  /admin/user/changeUserType        改用户类型
POST /admin/comment/boss/list          评论列表
POST /admin/treeHole/boss/list         树洞列表
```

---

## 三、HTTP 方法对照（易错点）

多个删除接口前端用的是 **GET**，不是 POST：

| 接口 | 方法 |
|---|---|
| `article/deleteArticle` | **GET** |
| `sysConfig/deleteConfig` | **GET** |
| `family/deleteFamily` | **GET** |
| `webInfo/deleteTreeHole` | **GET** |
| `webInfo/deleteResourcePath` | **GET** |
| `resource/deleteResource` | POST |

只注册 POST 时前端拿到 405，表现就是「点了删除没反应」。

---

## 四、跨域

`ALLOWED_ORIGINS` 白名单 + 正则放行预览域名：

```
^https://[a-z0-9-]+\.(poetize-official|lwsnb-poetize|lwsnb-sveltekit)\.pages\.dev$
```

图片代理 `/api/album/file/*` **跳过 secureHeaders**，返回 `Access-Control-Allow-Origin: *`。

原因：`secureHeaders` 默认注入 `Cross-Origin-Resource-Policy: same-origin`，
会让第三方站点 `<img>` 加载失败（后台资源列表显示「加载失败」）。
