import { Hono } from 'hono'
import type { Env } from '../lib/types'
import { requireAdmin, requireAuth, type AuthCtx } from '../lib/auth'
import { readConfig, writeConfig } from '../lib/siteConfig'
import { ok, badRequest } from '../lib/response'

const r = new Hono<AuthCtx & { Bindings: Env }>()

/** GET /api/site-config —— 公开读（前端渲染需要） */
r.get('/', async (c) => ok(await readConfig(c.env.DB)))

/** GET /api/site-config/admin —— 管理后台读（含空字段，便于表单回填） */
r.get('/admin', requireAuth, async (c) => ok(await readConfig(c.env.DB)))

/**
 * PUT /api/site-config —— 批量更新（仅 admin）
 * body: { "avatar": "/x.jpg", "notices": "[\"a\",\"b\"]" }
 * 只接受 site_config 白名单内的键，其余忽略。
 */
r.put('/', requireAdmin, async (c) => {
  const body = await c.req.json<Record<string, unknown>>().catch(() => null)
  if (!body || typeof body !== 'object') return badRequest('请求体必须是 JSON 对象')

  const patch: Record<string, string> = {}
  for (const [k, v] of Object.entries(body)) {
    if (v === null || v === undefined) continue
    // 数组自动转 JSON 字符串（randomCover / notices 常用）
    patch[k] = Array.isArray(v) ? JSON.stringify(v) : String(v)
  }

  const n = await writeConfig(c.env.DB, patch)
  if (!n) return badRequest('没有可更新的合法字段')

  return ok({ updated: n, config: await readConfig(c.env.DB) })
})

export default r
