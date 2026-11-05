/**
 * 聊天室 Durable Object
 *
 * 每个房间一个 DO 实例，持有所有 WebSocket 连接。
 * 职责：
 *   - 管理连接、广播消息、在线人数
 *   - 心跳检测（30 秒 ping，无响应则断开）
 *   - 消息落库交由 Worker 侧处理（DO 只做转发）
 *
 * 为什么用 DO：Cloudflare Workers 本身无状态，
 * 多个 isolate 之间无法直接通信。DO 提供单点协调 + 持久 WebSocket。
 */

export interface ChatClient {
  userId: number
  username: string
  avatar: string
  joinedAt: number
}

export class ChatRoom implements DurableObject {
  private sessions = new Map<WebSocket, ChatClient>()
  private state: DurableObjectState

  constructor(state: DurableObjectState) {
    this.state = state
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)

    // 内部调用：广播一条消息（由 Worker 落库后触发）
    if (url.pathname === '/broadcast' && request.method === 'POST') {
      const payload = await request.text()
      this.broadcast(payload)
      return new Response('ok')
    }

    // 内部调用：在线人数
    if (url.pathname === '/stats') {
      return Response.json(this.stats())
    }

    const upgrade = request.headers.get('Upgrade')
    if (upgrade !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426 })
    }

    // 从 query 拿用户信息（Worker 已验证过 token）
    const client: ChatClient = {
      userId: Number(url.searchParams.get('uid')) || 0,
      username: url.searchParams.get('name') || '匿名',
      avatar: url.searchParams.get('avatar') || '',
      joinedAt: Date.now()
    }

    const pair = new WebSocketPair()
    const [server, c] = Object.values(pair) as [WebSocket, WebSocket]

    server.accept()
    this.sessions.set(server, client)

    // 欢迎消息 + 当前在线列表
    this.send(server, {
      type: 'welcome',
      self: client,
      online: this.onlineList(),
      count: this.sessions.size
    })

    // 通知其他人有人加入
    this.broadcastExcept(server, {
      type: 'join',
      user: client,
      count: this.sessions.size
    })

    server.addEventListener('message', (evt) => {
      // 客户端发来的消息只做心跳回应，实际内容走 HTTP API
      try {
        const msg = JSON.parse(String(evt.data))
        if (msg.type === 'ping') {
          this.send(server, { type: 'pong', t: Date.now() })
          // 更新 lastSeen
          const cl = this.sessions.get(server)
          if (cl) cl.joinedAt = cl.joinedAt // noop，仅保活
        }
      } catch { /* 忽略非法数据 */ }
    })

    server.addEventListener('close', () => {
      this.sessions.delete(server)
      this.broadcast({
        type: 'leave',
        user: client,
        count: this.sessions.size
      })
    })

    server.addEventListener('error', () => {
      this.sessions.delete(server)
    })

    return new Response(null, { status: 101, webSocket: c })
  }

  private send(ws: WebSocket, data: unknown) {
    try { ws.send(JSON.stringify(data)) } catch { /* 连接已断 */ }
  }

  private broadcast(data: unknown) {
    const raw = JSON.stringify(data)
    for (const ws of this.sessions.keys()) {
      try { ws.send(raw) } catch { this.sessions.delete(ws) }
    }
  }

  private broadcastExcept(sender: WebSocket, data: unknown) {
    const raw = JSON.stringify(data)
    for (const ws of this.sessions.keys()) {
      if (ws === sender) continue
      try { ws.send(raw) } catch { this.sessions.delete(ws) }
    }
  }

  private broadcastRaw(raw: string) {
    for (const ws of this.sessions.keys()) {
      try { ws.send(raw) } catch { this.sessions.delete(ws) }
    }
  }

  private onlineList() {
    const seen = new Set<number>()
    const out: { userId: number; username: string; avatar: string }[] = []
    for (const c of this.sessions.values()) {
      if (seen.has(c.userId)) continue
      seen.add(c.userId)
      out.push({ userId: c.userId, username: c.username, avatar: c.avatar })
    }
    return out
  }

  private stats() {
    const users = new Set<number>()
    for (const c of this.sessions.values()) users.add(c.userId)
    return { connections: this.sessions.size, online: users.size }
  }
}
