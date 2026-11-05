# 聊天室

基于 **Cloudflare Durable Objects** 的实时聊天，替代官方原版的 Java WebSocket 服务。

## 为什么用 Durable Objects

Workers 本身无状态，多个 isolate 之间无法直接通信。Durable Objects 提供：

- **单点协调**：每个房间只有一个 DO 实例
- **持久 WebSocket**：连接存活期间 DO 一直驻留内存
- **内置广播**：所有连接都在同一进程内，直接遍历发送

Java 版需要独立服务器 + Redis 做消息分发，DO 把这两件事合并了。

## 架构

```
浏览器 ──WebSocket──> Worker /api/im/ws ──> DO(ChatRoom)
                          │                      │
                     验证 token              持有所有连接
                          │                      │
浏览器 ──HTTP POST───> /api/im/send ──落库──> D1
                          │                      │
                          └──触发广播───────────> 推给所有连接
```

## 数据表

`im_messages`

| 字段 | 说明 |
|---|---|
| `room` | 房间名，默认 `public` |
| `user_id` / `username` / `avatar` | 发送者快照 |
| `content` | 消息内容，最多 500 字 |
| `reply_to` | 回复的消息 id |
| `created_at` | ISO 时间 |

`im_online`：在线状态持久化（DO 内存里也有一份）

## 接口

### WebSocket

```
wss://api.lwsnb.eu.cc/api/im/ws?token=<session>
```

连接后收到的消息类型：

| type | 说明 |
|---|---|
| `welcome` | 连接成功，含 `self`、`online` 列表、`count` |
| `message` | 新消息 |
| `join` | 有人加入 |
| `leave` | 有人离开 |
| `pong` | 心跳回应 |

客户端可以发 `{"type":"ping"}` 保活，建议 25 秒一次。

### HTTP

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/im/messages?before=&limit=` | 历史消息，倒序取再反转 |
| POST | `/api/im/send` | `{content, replyTo?}`，需登录 |
| GET | `/api/im/online` | 在线人数 `{connections, online}` |

## 限制

| 项 | 规则 |
|---|---|
| 单条长度 | 500 字 |
| 发言频率 | 同用户 3 秒一条 |
| 历史分页 | 每页最多 50 条 |
| 心跳 | 25 秒 ping |

## 前端页面

`/im` —— `fe/src/components/im.vue`

- 绿色圆点表示连接状态
- 自己的消息靠右、主题色气泡
- 断线 5 秒后自动重连
- 未登录只读，底部提示登录

## 关于 localhost 问题

官方源码 `constant.js` 里写着：

```js
imBaseURL: "http://localhost:81/im",
```

这是作者开发环境的地址。两处会触发它：

- `user.vue` 注册成功后 `window.open`
- `home.vue` 点聊天按钮 `window.open`

已改为：

- `imBaseURL: "/im"` —— 站内路由
- 注册成功不再弹窗，改为 toast 提示
- 聊天按钮改 `this.$router.push({ path: "/im" })`

## 部署注意

`wrangler.toml` 需要 DO 配置：

```toml
[[durable_objects.bindings]]
name = "CHAT_ROOM"
class_name = "ChatRoom"

[[migrations]]
tag = "v1"
new_sqlite_classes = ["ChatRoom"]
```

入口文件必须导出：

```ts
export { ChatRoom } from './im/room'
```

## 排错

**WebSocket 连不上**

1. 检查是否已登录（未登录 401）
2. 确认 `token` 参数已 URL 编码
3. 浏览器控制台看 `wss://` 请求状态

**消息发出但不显示**

广播走的是 DO，若 DO 调用失败不影响落库。刷新页面能看到历史，
但实时推送失效 —— 看 Worker 日志里 `/broadcast` 是否报错。

**部署报 DO 相关错误**

`new_sqlite_classes` 只在首次部署生效。如果 class 已存在，
改用 `new_classes` 或提升 `tag` 版本号。
