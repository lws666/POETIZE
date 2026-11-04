import { Hono } from 'hono'
import type { Env, Role } from '../lib/types'
import { requireAdmin, type AuthCtx } from '../lib/auth'
import { randomToken, sha256, nowIso } from '../lib/crypto'
import { ok, badRequest, notFound } from '../lib/response'

const r = new Hono<AuthCtx & { Bindings: Env }>()

r.use('*', requireAdmin)

/** GET /api/tokens —— 列出（不含明文） */
r.get('/', async (c) => {
  const { results } = await c.env.DB
    .prepare(`SELECT id, name, scope, created_at, last_used_at, revoked FROM api_tokens ORDER BY id DESC`)
    .all()
  return ok(results)
})

/** POST /api/tokens —— 新建，**明文只在这里返回一次** */
r.post('/', async (c) => {
  const b = await c.req.json<{ name?: string; scope?: Role }>().catch(() => ({} as { name?: string; scope?: Role }))
  const name = (b.name || '').trim() || 'untitled'
  const scope: Role = ['admin', 'write', 'read'].includes(b.scope as Role) ? (b.scope as Role) : 'read'

  const raw = randomToken('blg')
  const res = await c.env.DB
    .prepare(`INSERT INTO api_tokens (token_hash, name, scope, created_at) VALUES (?1,?2,?3,?4)`)
    .bind(await sha256(raw), name, scope, nowIso())
    .run()

  return ok({ id: res.meta.last_row_id, name, scope, token: raw }, { status: 201 })
})

/** DELETE /api/tokens/:id —— 吊销 */
r.delete('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isFinite(id)) return badRequest('id 非法')
  const res = await c.env.DB.prepare(`UPDATE api_tokens SET revoked = 1 WHERE id = ?1`).bind(id).run()
  if (!res.meta.changes) return notFound('令牌不存在')
  return ok({ revoked: true })
})

export default r
