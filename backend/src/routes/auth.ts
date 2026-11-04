import { Hono } from 'hono'
import { setCookie, deleteCookie } from 'hono/cookie'
import type { Env, UserRow } from '../lib/types'
import type { AuthCtx } from '../lib/auth'
import { findUserByName, rawSessionToken } from '../lib/auth'
import { hashPassword, randomToken, sha256, verifyPassword, nowIso } from '../lib/crypto'
import { ok, fail, unauthorized, badRequest } from '../lib/response'

const r = new Hono<AuthCtx & { Bindings: Env }>()

const SESSION_TTL_H = 24 * 7

/** 简单内存限流：同一 IP 每分钟最多 10 次登录尝试 */
const attempts = new Map<string, { n: number; reset: number }>()
function rateLimit(ip: string, max = 10, windowMs = 60_000): boolean {
  const now = Date.now()
  const cur = attempts.get(ip)
  if (!cur || now > cur.reset) {
    attempts.set(ip, { n: 1, reset: now + windowMs })
    return true
  }
  cur.n++
  return cur.n <= max
}

/** POST /api/auth/login */
r.post('/login', async (c) => {
  const ip = c.req.header('CF-Connecting-IP') || 'unknown'
  if (!rateLimit(ip)) return fail('尝试过于频繁，请稍后再试', 429, 'rate_limited')

  const body = await c.req.json<{ username?: string; password?: string }>().catch(() => ({} as { username?: string; password?: string }))
  const { username, password } = body
  if (!username || !password) return badRequest('用户名和密码必填')

  const user = await findUserByName(c.env.DB, username)
  // 无论用户是否存在都跑一次校验，避免用户名枚举（时序一致）
  const dummy = 'pbkdf2$100000$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='
  const passOk = await verifyPassword(password, user?.password_hash || dummy)

  if (!user || !passOk || user.disabled) return unauthorized('用户名或密码错误')

  const sid = randomToken('sess')
  const expires = new Date(Date.now() + SESSION_TTL_H * 3600_000).toISOString()

  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?1,?2,?3,?4)`
    ).bind(await sha256(sid), user.id, nowIso(), expires),
    c.env.DB.prepare(`UPDATE users SET last_login_at = ?1 WHERE id = ?2`).bind(nowIso(), user.id),
    // 顺带清理过期会话
    c.env.DB.prepare(`DELETE FROM sessions WHERE expires_at < ?1`).bind(nowIso())
  ])

  setCookie(c, 'sid', sid, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: SESSION_TTL_H * 3600
  })

  return ok({
    username: user.username,
    role: user.role,
    user_type: user.user_type,
    user_lv: user.user_lv,
    avatar: user.avatar,
    isBoss: user.user_type === 0
  })
})

/** POST /api/auth/logout */
r.post('/logout', async (c) => {
  const sid = rawSessionToken(c)
  if (sid) {
    await c.env.DB.prepare(`DELETE FROM sessions WHERE token_hash = ?1`).bind(await sha256(sid)).run()
  }
  deleteCookie(c, 'sid', { path: '/' })
  return ok({ loggedOut: true })
})

/** GET /api/auth/me */
r.get('/me', async (c) => {
  const sid = rawSessionToken(c)
  if (!sid) return ok({ user: null })

  const row = await c.env.DB
    .prepare(
      `SELECT u.id, u.username, u.role, u.disabled, s.expires_at
         FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?1`
    )
    .bind(await sha256(sid))
    .first<{ id: number; username: string; role: string; disabled: number; expires_at: string }>()

  if (!row || row.disabled || new Date(row.expires_at) <= new Date()) return ok({ user: null })
  return ok({ user: { id: row.id, username: row.username, role: row.role } })
})

/** PUT /api/auth/password —— 改自己的密码 */
r.put('/password', async (c) => {
  const sid = rawSessionToken(c)
  if (!sid) return unauthorized()
  const me = await c.env.DB
    .prepare(`SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?1`)
    .bind(await sha256(sid))
    .first<UserRow>()
  if (!me) return unauthorized()

  const { oldPassword, newPassword } = await c.req.json<{ oldPassword?: string; newPassword?: string }>().catch(() => ({} as { oldPassword?: string; newPassword?: string }))
  if (!oldPassword || !newPassword) return badRequest('原密码与新密码必填')
  if (newPassword.length < 8) return badRequest('新密码至少 8 位')
  if (!(await verifyPassword(oldPassword, me.password_hash))) return unauthorized('原密码错误')

  await c.env.DB.prepare(`UPDATE users SET password_hash = ?1 WHERE id = ?2`)
    .bind(await hashPassword(newPassword), me.id)
    .run()

  // 改密后踢掉其它会话，只保留当前
  await c.env.DB.prepare(`DELETE FROM sessions WHERE user_id = ?1 AND token_hash <> ?2`)
    .bind(me.id, await sha256(sid))
    .run()

  return ok({ updated: true })
})

export default r
