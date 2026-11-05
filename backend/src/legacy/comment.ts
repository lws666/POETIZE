import { Hono } from 'hono'
import type { Env, UserRow } from '../lib/types'
import { legacyOk, legacyErr } from './response'
import { currentUserLite } from '../lib/auth'
import { nowIso } from '../lib/crypto'
import { sanitizeText } from '../lib/sanitize'

/**
 * 评论 —— 对齐官方 Comment 实体与 comment.vue 的消费结构。
 *
 * 官方字段：
 *   source(文章id) parent_comment_id floor_comment_id type
 *   user_id parent_user_id like_count comment_content comment_info create_time
 *
 * 前端期望（comment.vue）：
 *   { records: [ { id, username, avatar, createTime, createTimeLv,
 *                  commentContent, childComments: {records,total}, ... } ],
 *     total, size, current, pages }
 */
export const comment = new Hono<{ Bindings: Env }>()

interface CommentRow {
  id: number
  source: number
  parent_comment_id: number
  floor_comment_id: number
  type: string
  user_id: number
  parent_user_id: number
  like_count: number
  comment_content: string
  comment_info: string
  create_time: string
}

/** 取用户信息（可能为空，未登录评论靠 comment_info 快照） */
async function userMap(db: D1Database, ids: number[]) {
  const uniq = [...new Set(ids.filter(Boolean))]
  if (!uniq.length) return new Map<number, UserRow>()
  const placeholders = uniq.map((_, i) => `?${i + 1}`).join(',')
  const { results } = await db
    .prepare(`SELECT * FROM users WHERE id IN (${placeholders})`)
    .bind(...uniq)
    .all<UserRow>()
  return new Map(results.map(u => [u.id, u]))
}

/** 转前端结构 */
function toVO(
  r: CommentRow,
  users: Map<number, UserRow>,
  child?: { records: unknown[]; total: number }
) {
  const u = users.get(r.user_id)
  let info: Record<string, string> = {}
  try { info = JSON.parse(r.comment_info || '{}') } catch { /* 忽略 */ }

  return {
    id: r.id,
    source: r.source,
    userId: r.user_id,
    username: u?.username || info.nick || '匿名',
    avatar: u?.avatar || info.avatar || '',
    userLv: u?.user_lv ?? 1,
    createTime: r.create_time,
    createTimeLv: u ? `LV${u.user_lv ?? 1}` : '',
    commentContent: r.comment_content,
    likeCount: r.like_count,
    parentCommentId: r.parent_comment_id,
    ...(child ? { childComments: child } : {})
  }
}

/** POST /comment/listComment —— 一级评论分页 */
comment.post('/listComment', async (c) => {
  const b = await c.req.json<{
    source?: number; type?: string; current?: number; size?: number
  }>().catch(() => ({} as { source?: number; type?: string; current?: number; size?: number }))

  const source = Number(b.source) || 0
  const type = String(b.type || 'article')
  const current = Math.max(1, Number(b.current) || 1)
  const size = Math.min(50, Math.max(1, Number(b.size) || 10))
  const offset = (current - 1) * size

  const total = (await c.env.DB
    .prepare(`SELECT COUNT(*) c FROM poem_comment
               WHERE source=?1 AND type=?2 AND deleted=0 AND parent_comment_id=0`)
    .bind(source, type)
    .first<{ c: number }>())?.c ?? 0

  const { results: floors } = await c.env.DB
    .prepare(`SELECT * FROM poem_comment
               WHERE source=?1 AND type=?2 AND deleted=0 AND parent_comment_id=0
               ORDER BY id DESC LIMIT ?3 OFFSET ?4`)
    .bind(source, type, size, offset)
    .all<CommentRow>()

  if (!floors.length) {
    return legacyOk({ records: [], total, size, current, pages: Math.ceil(total / size) })
  }

  // 取所有子回复
  const floorIds = floors.map(f => f.id)
  const ph = floorIds.map((_, i) => `?${i + 1 + 2}`).join(',')
  const { results: children } = await c.env.DB
    .prepare(`SELECT * FROM poem_comment
               WHERE source=?1 AND type=?2 AND deleted=0
                 AND floor_comment_id IN (${ph}) AND parent_comment_id<>0
               ORDER BY id ASC`)
    .bind(source, type, ...floorIds)
    .all<CommentRow>()

  const users = await userMap(c.env.DB, [
    ...floors.map(f => f.user_id),
    ...children.map(f => f.user_id)
  ])

  const byFloor = new Map<number, CommentRow[]>()
  for (const ch of children) {
    if (!byFloor.has(ch.floor_comment_id)) byFloor.set(ch.floor_comment_id, [])
    byFloor.get(ch.floor_comment_id)!.push(ch)
  }

  const records = floors.map(f => {
    const kids = byFloor.get(f.id) || []
    return toVO(f, users, {
      records: kids.map(k => toVO(k, users)),
      total: kids.length
    })
  })

  return legacyOk({ records, total, size, current, pages: Math.ceil(total / size) })
})

/** GET /comment/getCommentCount */
comment.get('/getCommentCount', async (c) => {
  const source = Number(c.req.query('source')) || 0
  const type = String(c.req.query('type') || 'article')
  const n = (await c.env.DB
    .prepare(`SELECT COUNT(*) c FROM poem_comment WHERE source=?1 AND type=?2 AND deleted=0`)
    .bind(source, type)
    .first<{ c: number }>())?.c ?? 0
  return legacyOk(n)
})

/** POST /comment/saveComment —— 发布评论（需登录） */
comment.post('/saveComment', async (c) => {
  const user = await currentUserLite(c.env.DB, c.req.header('Authorization'), c.req.header('Cookie'))
  if (!user) return legacyErr('请先登录后再评论', 401)

  const b = await c.req.json<{
    source?: number; type?: string; commentContent?: string
    parentCommentId?: number; floorCommentId?: number
  }>().catch(() => ({} as Record<string, unknown> as {
    source?: number; type?: string; commentContent?: string
    parentCommentId?: number; floorCommentId?: number
  }))

  const raw = String(b.commentContent || '').trim()
  if (!raw) return legacyErr('评论内容不能为空', 400)
  if (raw.length > 2000) return legacyErr('评论过长（最多 2000 字）', 400)

  /**
   * 净化 HTML —— 前端用 v-html 渲染评论，
   * 不转义会导致 <img onerror=alert(1)> 直接执行。
   */
  const content = sanitizeText(raw)

  const source = Number(b.source) || 0
  const type = String(b.type || 'article')
  const parentId = Number(b.parentCommentId) || 0
  const floorId = Number(b.floorCommentId) || 0

  // 回复时取父评论的 userId
  let parentUserId = 0
  if (parentId) {
    const p = await c.env.DB
      .prepare(`SELECT user_id FROM poem_comment WHERE id=?1`)
      .bind(parentId)
      .first<{ user_id: number }>()
    parentUserId = p?.user_id ?? 0
  }

  const res = await c.env.DB
    .prepare(
      `INSERT INTO poem_comment
        (source,parent_comment_id,floor_comment_id,type,user_id,parent_user_id,
         like_count,comment_content,comment_info,create_time,deleted)
       VALUES (?1,?2,?3,?4,?5,?6,0,?7,?8,?9,0)`
    )
    .bind(
      source, parentId, parentId ? floorId || parentId : 0,
      type, user.id, parentUserId,
      content,
      JSON.stringify({ nick: user.username, avatar: user.avatar || '' }),
      nowIso()
    )
    .run()

  return legacyOk({ id: Number(res.meta.last_row_id) })
})

/** 评论点赞 */
comment.get('/likeComment', async (c) => {
  const id = Number(c.req.query('id'))
  if (!Number.isFinite(id)) return legacyErr('id 非法', 400)
  await c.env.DB.prepare(`UPDATE poem_comment SET like_count=like_count+1 WHERE id=?1`).bind(id).run()
  return legacyOk({ liked: true })
})

/** 后台：评论列表 */
comment.post('/admin/listComment', async (c) => {
  const b = await c.req.json<{ current?: number; size?: number; source?: number }>()
    .catch(() => ({} as { current?: number; size?: number; source?: number }))
  const current = Math.max(1, Number(b.current) || 1)
  const size = Math.min(50, Math.max(1, Number(b.size) || 10))

  const total = (await c.env.DB.prepare(`SELECT COUNT(*) c FROM poem_comment WHERE deleted=0`)
    .first<{ c: number }>())?.c ?? 0
  const { results } = await c.env.DB
    .prepare(`SELECT * FROM poem_comment WHERE deleted=0 ORDER BY id DESC LIMIT ?1 OFFSET ?2`)
    .bind(size, (current - 1) * size)
    .all<CommentRow>()

  const users = await userMap(c.env.DB, results.map(r => r.user_id))
  return legacyOk({
    records: results.map(r => toVO(r, users)),
    total, size, current, pages: Math.ceil(total / size)
  })
})

/** 后台：删除评论（软删） */
comment.get('/admin/deleteComment', async (c) => {
  const id = Number(c.req.query('id'))
  if (!Number.isFinite(id)) return legacyErr('id 非法', 400)
  await c.env.DB.prepare(`UPDATE poem_comment SET deleted=1 WHERE id=?1`).bind(id).run()
  return legacyOk({ deleted: true })
})
