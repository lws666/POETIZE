import { Hono } from 'hono'
import type { Env } from '../lib/types'
import { requireWrite, type AuthCtx } from '../lib/auth'
import { b2Client } from '../lib/b2'
import { ok, badRequest, notFound } from '../lib/response'

const r = new Hono<AuthCtx & { Bindings: Env }>()

interface UploadRow {
  id: number
  b2_key: string
  filename: string
  mime_type: string
  size: number
  url: string
  created_at: string
}

/** GET /api/album?page=1&limit=50 —— 相册列表（公开） */
r.get('/', async (c) => {
  const page = Math.max(1, Number(c.req.query('page') || 1))
  const limit = Math.min(100, Math.max(1, Number(c.req.query('limit') || 50)))
  const offset = (page - 1) * limit

  const totalRow = await c.env.DB
    .prepare(`SELECT COUNT(*) c FROM uploads WHERE mime_type LIKE 'image/%'`)
    .first<{ c: number }>()

  const { results } = await c.env.DB
    .prepare(
      `SELECT * FROM uploads WHERE mime_type LIKE 'image/%'
        ORDER BY id DESC LIMIT ?1 OFFSET ?2`
    )
    .bind(limit, offset)
    .all<UploadRow>()

  const total = totalRow?.c ?? 0

  return ok({
    images: results.map(row => ({
      id: row.id,
      b2_key: row.b2_key,
      filename: row.filename,
      mime_type: row.mime_type,
      size: row.size,
      url: row.url,
      created_at: row.created_at
    })),
    pagination: { page, limit, total, total_pages: Math.ceil(total / limit) }
  })
})

/**
 * GET /api/album/file/:key{.+} —— 代理读取
 *
 * 图片是公开资源，任何源的 <img> 都应该能加载。
 * 全局 CORS 中间件对不带 Origin 的请求只回白名单源，
 * 浏览器做图片跨域校验时会判定失败（显示「加载失败」）。
 * 这里直接给 * 通配，不参与全局白名单逻辑。
 */
r.get('/file/:key{.+}', async (c) => {
  const key = c.req.param('key')
  if (!key || key.includes('..')) return badRequest('key 非法')

  const res = await b2Client(c.env).get(key)
  if (!res.ok) return notFound('图片不存在')

  return new Response(res.body, {
    headers: {
      'Content-Type': res.headers.get('Content-Type') || 'application/octet-stream',
      'Cache-Control': 'public, max-age=31536000, immutable',
      /* 图片是公开资源：允许任意源内联引用，避免 <img> 跨域校验失败 */
      'Access-Control-Allow-Origin': '*',
      'Cross-Origin-Resource-Policy': 'cross-origin'
    }
  })
})

/** DELETE /api/album/:id —— 删除（需 write） */
r.delete('/:id', requireWrite, async (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isFinite(id)) return badRequest('id 非法')

  const row = await c.env.DB
    .prepare(`SELECT b2_key FROM uploads WHERE id = ?1`)
    .bind(id)
    .first<{ b2_key: string }>()
  if (!row) return notFound('记录不存在')

  await b2Client(c.env).del(row.b2_key).catch(() => {})
  await c.env.DB.prepare(`DELETE FROM uploads WHERE id = ?1`).bind(id).run()

  return ok({ deleted: true })
})

export default r
