import { Hono } from 'hono'
import type { Env, PostRow } from '../lib/types'
import type { AuthCtx } from '../lib/auth'
import { requireWrite } from '../lib/auth'
import { toDTO, stripFrontmatter } from '../lib/posts'
import { checkAccess } from '../lib/access'
import { currentUserLite } from '../lib/auth'
import { ok, notFound, badRequest, fail } from '../lib/response'

const r = new Hono<AuthCtx & { Bindings: Env }>()

/**
 * GET /api/posts?page=1&limit=10&tag=&category=&q=
 * 公开。只返回未草稿的文章，按 top 降序 + 日期降序。
 */
r.get('/', async (c) => {
  const page = Math.max(1, Number(c.req.query('page') || 1))
  const limit = Math.min(50, Math.max(1, Number(c.req.query('limit') || 10)))
  const offset = (page - 1) * limit
  const tag = c.req.query('tag') || ''
  const category = c.req.query('category') || ''
  const q = (c.req.query('q') || '').trim()

  const where: string[] = [`draft = 0`, `(hide IS NULL OR hide = '')`]
  const vals: unknown[] = []

  if (tag) { where.push(`tags LIKE ?${vals.length + 1}`); vals.push(`%"${tag}"%`) }
  if (category) { where.push(`categories LIKE ?${vals.length + 1}`); vals.push(`%"${category}"%`) }
  if (q) { where.push(`(title LIKE ?${vals.length + 1} OR excerpt LIKE ?${vals.length + 2})`); vals.push(`%${q}%`, `%${q}%`) }

  const cond = where.length ? `WHERE ${where.join(' AND ')}` : ''

  const totalRow = await c.env.DB
    .prepare(`SELECT COUNT(*) c FROM posts ${cond}`)
    .bind(...vals)
    .first<{ c: number }>()
  const total = totalRow?.c ?? 0

  const { results } = await c.env.DB
    .prepare(
      `SELECT * FROM posts ${cond} ORDER BY top DESC, date DESC, id DESC LIMIT ?${vals.length + 1} OFFSET ?${vals.length + 2}`
    )
    .bind(...vals, limit, offset)
    .all<PostRow>()

  return ok({
    posts: results.map(toDTO),
    pagination: {
      page,
      limit,
      total,
      total_pages: Math.ceil(total / limit)
    }
  })
})

/** GET /api/posts/:slug —— 公开，返回正文 */
r.get('/:slug', async (c) => {
  const slug = c.req.param('slug')
  const row = await c.env.DB
    .prepare(`SELECT * FROM posts WHERE slug = ?1 AND draft = 0`)
    .bind(slug)
    .first<PostRow>()

  if (!row) return notFound('文章不存在')

  /**
   * 访问控制（对齐官方 ResourceCheckAspect）：
   *   public    直接返回正文
   *   login     需登录
   *   userLv    当前用户 level >= view_value 才返回正文
   *   password  请求需带 ?password=xxx
   *
   * 无权时仍返回 200 + 文章元信息，但 content 为空、locked=true，
   * 前端据此渲染「需要 LV3」或「输入密码」界面。
   */
  const user = await currentUserLite(c.env.DB, c.req.header('Authorization'), c.req.header('Cookie'))
  const pwd = c.req.query('password')
  const access = checkAccess(row, user, pwd)

  if (!access.allowed) {
    return ok({
      ...toDTO(row),
      content: '',
      summary: '',
      frontmatter: safeJson(row.frontmatter),
      comment: false,
      toc: false,
      /** 前端用来渲染遮罩 */
      locked: true,
      lockReason: access.reason,
      lockMessage: access.message,
      needLevel: access.needLevel ?? null,
      view_type: row.view_type || 'public',
      currentLevel: user?.user_lv ?? 0
    })
  }

  return ok({
    ...toDTO(row),
    content: stripFrontmatter(row.content || ''),
    summary: row.summary || '',
    frontmatter: safeJson(row.frontmatter),
    comment: !!row.comment,
    toc: !!row.toc,
    locked: false
  })
})

function safeJson(s: string | null): Record<string, unknown> {
  if (!s) return {}
  try { return JSON.parse(s) } catch { return {} }
}

/** 以下为写操作，需 write 及以上 */

/** POST /api/posts —— 新建 */
r.post('/', requireWrite, async (c) => {
  const b = await c.req.json().catch(() => null)
  if (!b || !b.slug || !b.title) return badRequest('slug 与 title 必填')

  const exists = await c.env.DB.prepare(`SELECT id FROM posts WHERE slug = ?1`).bind(b.slug).first()
  if (exists) return fail('slug 已存在', 409, 'conflict')

  const now = new Date().toISOString()
  const res = await c.env.DB
    .prepare(
      `INSERT INTO posts (slug,title,date,updated,tags,categories,excerpt,cover,type,top,draft,content,created_at,updated_at)
       VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14)`
    )
    .bind(
      b.slug, b.title, b.date || now.slice(0, 10), b.updated || '',
      JSON.stringify(b.tags || []), JSON.stringify(b.categories || []),
      b.excerpt || '', b.cover || '', b.type || 'post', Number(b.top) || 0,
      b.draft ? 1 : 0, b.content || '', now, now
    )
    .run()

  return ok({ id: res.meta.last_row_id, slug: b.slug }, { status: 201 })
})

/** PUT /api/posts/:slug —— 更新（白名单字段） */
r.put('/:slug', requireWrite, async (c) => {
  const slug = c.req.param('slug')
  const b = await c.req.json<Record<string, unknown>>().catch(() => ({} as Record<string, unknown>))

  const exists = await c.env.DB.prepare(`SELECT id FROM posts WHERE slug = ?1`).bind(slug).first()
  if (!exists) return notFound('文章不存在')

  const allowed: Record<string, 'json' | 'raw' | 'num' | 'bool'> = {
    title: 'raw', date: 'raw', updated: 'raw', excerpt: 'raw', cover: 'raw',
    type: 'raw', tags: 'json', categories: 'json', content: 'raw',
    top: 'num', draft: 'bool', comment: 'bool', toc: 'bool',
    view_type: 'raw', view_value: 'raw', tips: 'raw'
  }

  const sets: string[] = []
  const vals: unknown[] = []
  for (const [k, kind] of Object.entries(allowed)) {
    if (!(k in b)) continue
    let v = b[k]
    if (kind === 'json') v = JSON.stringify(v || [])
    else if (kind === 'num') v = Number(v) || 0
    else if (kind === 'bool') v = v ? 1 : 0
    sets.push(`${k} = ?${vals.length + 1}`)
    vals.push(v)
  }
  if (!sets.length) return badRequest('没有要更新的字段')

  sets.push(`updated_at = ?${vals.length + 1}`)
  vals.push(new Date().toISOString())

  await c.env.DB.prepare(`UPDATE posts SET ${sets.join(', ')} WHERE slug = ?${vals.length + 1}`)
    .bind(...vals, slug).run()

  return ok({ updated: true })
})

/** DELETE /api/posts/:slug */
r.delete('/:slug', requireWrite, async (c) => {
  const slug = c.req.param('slug')
  const res = await c.env.DB.prepare(`DELETE FROM posts WHERE slug = ?1`).bind(slug).run()
  if (!res.meta.changes) return notFound('文章不存在')
  return ok({ deleted: true })
})

export default r
