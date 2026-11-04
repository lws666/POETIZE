import { Hono } from 'hono'
import type { Context } from 'hono'
import type { Env } from '../lib/types'
import { requireWrite, type AuthCtx } from '../lib/auth'
import { b2Client, extOf } from '../lib/b2'
import { ok, badRequest, fail } from '../lib/response'
import { nowIso } from '../lib/crypto'

const r = new Hono<AuthCtx & { Bindings: Env }>()

/** 允许的类型与大小上限 */
const IMAGE_MAX = 10 * 1024 * 1024      // 10 MB
const FILE_MAX = 20 * 1024 * 1024       // 20 MB
const ALLOWED_IMAGE = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml', 'image/avif'])

/** POST /api/upload —— multipart，字段名 file；可选 ?dir=album|posts */
r.post('/', requireWrite, async (c) => {
  const form = await c.req.formData().catch(() => null)
  const file = form?.get('file')
  if (!file || typeof file === 'string') return badRequest('缺少 file 字段')

  const mime = file.type || 'application/octet-stream'
  const isImage = ALLOWED_IMAGE.has(mime)
  const max = isImage ? IMAGE_MAX : FILE_MAX

  if (file.size > max) return fail(`文件超过 ${Math.round(max / 1024 / 1024)}MB`, 413, 'too_large')
  if (mime === 'image/svg+xml') {
    // SVG 可能含脚本，做最小检查
    const text = await file.text()
    if (/<script[\s>]/i.test(text) || /\son\w+\s*=/i.test(text)) {
      return badRequest('SVG 含脚本，已拒绝')
    }
    return uploadBytes(c, text, mime, isImage)
  }

  return uploadBytes(c, await file.arrayBuffer(), mime, isImage)
})

/** 真正写入 B2 并登记 uploads 表 */
async function uploadBytes(
  c: Context<AuthCtx & { Bindings: Env }>,
  body: ArrayBuffer | string,
  mime: string,
  isImage: boolean
) {
  const dir = isImage ? 'album' : 'files'
  const key = `${dir}/${Date.now()}_${Math.random().toString(36).slice(2, 10)}.${extOf(mime)}`

  const url = await b2Client(c.env).put(
    key,
    typeof body === 'string' ? (new TextEncoder().encode(body).buffer as ArrayBuffer) : body,
    mime
  )

  await c.env.DB
    .prepare(`INSERT INTO uploads (b2_key, filename, mime_type, size, url, created_at) VALUES (?1,?2,?3,?4,?5,?6)`)
    .bind(key, key.split('/').pop(), mime, typeof body === 'string' ? body.length : body.byteLength, url, nowIso())
    .run()

  return ok({ key, url, mime, size: typeof body === 'string' ? body.length : body.byteLength }, { status: 201 })
}

/** GET /api/upload/file/:key{.+} —— 代理读取（私有桶时用）*/
r.get('/file/:key{.+}', async (c) => {
  const key = c.req.param('key')
  if (!key || key.includes('..')) return badRequest('key 非法')

  const res = await b2Client(c.env).get(key)
  if (!res.ok) return fail('文件不存在', 404)

  return new Response(res.body, {
    headers: {
      'Content-Type': res.headers.get('Content-Type') || 'application/octet-stream',
      'Cache-Control': 'public, max-age=31536000, immutable'
    }
  })
})

export default r
