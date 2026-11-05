import { Hono } from 'hono'
import type { Env, UserRow } from '../lib/types'
import { currentUserLite } from '../lib/auth'
import { ok, badRequest, fail } from '../lib/response'
import { nowIso } from '../lib/crypto'

/**
 * 聊天室
 *
 *   GET  /api/im/ws           WebSocket 入口（需登录）
 *   GET  /api/im/messages     历史消息分页
 *   POST /api/im/send         发消息（落库 + 广播）
 *   GET  /api/im/online       在线人数
 */
const r = new Hono<{ Bindings: Env }>()

const ROOM = 'public'

/** 取当前用户（WebSocket 场景无法带 header，从 query 读 token） */
async function resolveUser(c: { env: Env; req: { header: (k: string) => string | undefined; query: (k: string) => string | undefined } }) {
  const token = c.req.query('token') || ''
  const auth = c.req.header('Authorization') || ''
  return currentUserLite(
    c.env.DB,
    auth || (token ? `Bearer ${token}` : ''),
    c.req.header('Cookie')
  )
}

/** GET /api/im/ws —— WebSocket 升级 */
r.get('/ws', async (c) => {
  if (c.req.header('Upgrade') !== 'websocket') {
    return fail('需要 WebSocket 连接', 426, 'upgrade_required')
  }

  const user = await resolveUser(c)
  if (!user) return fail('请先登录', 401, 'unauthorized')

  const id = c.env.CHAT_ROOM.idFromName(ROOM)
  const stub = c.env.CHAT_ROOM.get(id)

  const url = new URL(c.req.url)
  url.searchParams.set('uid', String(user.id))
  url.searchParams.set('name', user.username)
  url.searchParams.set('avatar', user.avatar || '')

  return stub.fetch(new Request(url.toString(), c.req.raw))
})

/** GET /api/im/messages?before=&limit= */
r.get('/messages', async (c) => {
  const before = Number(c.req.query('before')) || 0
  const limit = Math.min(50, Math.max(1, Number(c.req.query('limit')) || 30))

  const sql = before
    ? `SELECT * FROM im_messages WHERE room=?1 AND deleted=0 AND id<?2 ORDER BY id DESC LIMIT ?3`
    : `SELECT * FROM im_messages WHERE room=?1 AND deleted=0 ORDER BY id DESC LIMIT ?3`
  const params = before ? [ROOM, before, limit] : [ROOM, 0, limit]

  const { results } = await c.env.DB.prepare(sql).bind(...params).all<Record<string, unknown>>()

  // 反转为正序（旧 → 新）
  const records = results.reverse().map(m => ({
    id: m.id,
    userId: m.user_id,
    username: m.username,
    avatar: m.avatar,
    content: m.content,
    type: m.type,
    replyTo: m.reply_to,
    createdAt: m.created_at
  }))

  return ok({ records, hasMore: results.length === limit })
})

/** POST /api/im/send  { content, replyTo? } */
r.post('/send', async (c) => {
  const user = await resolveUser(c)
  if (!user) return fail('请先登录', 401, 'unauthorized')

  const b = await c.req.json<{ content?: string; replyTo?: number }>()
    .catch(() => ({} as { content?: string; replyTo?: number }))

  const content = String(b.content || '').trim()
  if (!content) return badRequest('消息不能为空')
  if (content.length > 500) return badRequest('消息最多 500 字')

  // 限流：同一用户 3 秒一条
  const last = await c.env.DB
    .prepare(`SELECT created_at FROM im_messages WHERE user_id=?1 ORDER BY id DESC LIMIT 1`)
    .bind(user.id).first<{ created_at: string }>()
  if (last) {
    const gap = Date.now() - new Date(last.created_at).getTime()
    if (gap < 3000) return fail(`请等待 ${Math.ceil((3000 - gap) / 1000)} 秒再发言`, 429, 'rate_limited')
  }

  const now = nowIso()
  const res = await c.env.DB
    .prepare(`INSERT INTO im_messages (room,user_id,username,avatar,content,type,reply_to,deleted,created_at)
              VALUES (?1,?2,?3,?4,?5,'text',?6,0,?7)`)
    .bind(ROOM, user.id, user.username, user.avatar || '', content, Number(b.replyTo) || 0, now)
    .run()

  const message = {
    id: Number(res.meta.last_row_id),
    userId: user.id,
    username: user.username,
    avatar: user.avatar || '',
    content,
    type: 'text',
    replyTo: Number(b.replyTo) || 0,
    createdAt: now
  }

  // 广播到房间
  try {
    const id = c.env.CHAT_ROOM.idFromName(ROOM)
    const stub = c.env.CHAT_ROOM.get(id)
    await stub.fetch('https://do/broadcast', {
      method: 'POST',
      body: JSON.stringify({ type: 'message', message })
    })
  } catch { /* 广播失败不影响落库 */ }

  return ok(message)
})

/** GET /api/im/online */
r.get('/online', async (c) => {
  try {
    const id = c.env.CHAT_ROOM.idFromName(ROOM)
    const stub = c.env.CHAT_ROOM.get(id)
    const res = await stub.fetch('https://do/stats')
    const stats = await res.json<{ connections: number; online: number }>()
    return ok(stats)
  } catch {
    return ok({ connections: 0, online: 0 })
  }
})

export default r
