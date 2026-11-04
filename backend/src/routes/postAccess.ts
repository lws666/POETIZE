import { Hono } from 'hono'
import type { Env, PostRow } from '../lib/types'
import { requireWrite, type AuthCtx } from '../lib/auth'
import { VIEW_LABEL, isValidViewType, VIEW_TYPES, type ViewType } from '../lib/access'
import { ok, badRequest, notFound, fail } from '../lib/response'

const r = new Hono<AuthCtx & { Bindings: Env }>()

/** GET /api/post-access/types —— 可选类型清单（给后台下拉框用） */
r.get('/types', (c) =>
  ok(VIEW_TYPES.map(t => ({ value: t, label: VIEW_LABEL[t] })))
)

/** GET /api/post-access/:slug —— 读某篇的访问设置 */
r.get('/:slug', async (c) => {
  const row = await c.env.DB
    .prepare(`SELECT slug, view_type, view_value, tips FROM posts WHERE slug = ?1`)
    .bind(c.req.param('slug'))
    .first<Pick<PostRow, 'slug' | 'view_type' | 'view_value' | 'tips'>>()
  if (!row) return notFound('文章不存在')
  return ok(row)
})

/**
 * PUT /api/post-access/:slug
 * body: { view_type, view_value?, tips? }
 *
 * 校验（对齐官方 saveArticle）：
 *   - view_type 必须是 4 种之一
 *   - userLv 与 password 必须提供 view_value
 *   - userLv 的 view_value 必须是 1..6
 */
r.put('/:slug', requireWrite, async (c) => {
  const slug = c.req.param('slug')
  const b = await c.req.json<{ view_type?: string; view_value?: string; tips?: string }>()
    .catch(() => ({} as { view_type?: string; view_value?: string; tips?: string }))

  const type = b.view_type
  if (!isValidViewType(type)) {
    return badRequest(`view_type 必须是 ${VIEW_TYPES.join(' / ')}`)
  }

  let value = (b.view_value ?? '').toString().trim()
  const tips = (b.tips ?? '').toString().trim()

  if (type === 'public' || type === 'login') {
    value = ''
  } else if (type === 'userLv') {
    const n = Number(value)
    if (!Number.isInteger(n) || n < 1 || n > 6) {
      return badRequest('等级必须 1-6')
    }
    value = String(n)
  } else if (type === 'password') {
    if (!value) return badRequest('密码类型必须设置 view_value')
    if (value.length < 4) return badRequest('访问密码至少 4 位')
  }

  const exists = await c.env.DB.prepare(`SELECT id FROM posts WHERE slug = ?1`).bind(slug).first()
  if (!exists) return notFound('文章不存在')

  await c.env.DB
    .prepare(`UPDATE posts SET view_type=?1, view_value=?2, tips=?3, updated_at=?4 WHERE slug=?5`)
    .bind(type as ViewType, value, tips, new Date().toISOString(), slug)
    .run()

  return ok({ slug, view_type: type, view_value: value, tips })
})

/** GET /api/post-access —— 列出所有非公开文章 */
r.get('/', async (c) => {
  const { results } = await c.env.DB
    .prepare(`SELECT slug, title, view_type, view_value, tips FROM posts WHERE view_type <> 'public' ORDER BY id DESC`)
    .all()
  return ok(results)
})

export default r
