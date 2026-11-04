import { Hono } from 'hono'
import type { Env, Role, UserRow } from '../lib/types'
import { requireAdmin, type AuthCtx } from '../lib/auth'
import { hashPassword, nowIso } from '../lib/crypto'
import { roleOf, userTypeOf, isValidType, isValidLv } from '../lib/userModel'
import { ok, badRequest, notFound, fail } from '../lib/response'

const r = new Hono<AuthCtx & { Bindings: Env }>()

r.use('*', requireAdmin)

const ROLES: Role[] = ['admin', 'write', 'read']

/** 输出时不带 password_hash */
const strip = (u: UserRow) => ({
  id: u.id,
  username: u.username,
  role: u.role,
  /** 官方字段 */
  user_type: u.user_type,
  user_lv: u.user_lv,
  email: u.email,
  avatar: u.avatar,
  gender: u.gender,
  introduction: u.introduction,
  disabled: !!u.disabled,
  created_at: u.created_at,
  last_login_at: u.last_login_at
})

/** GET /api/users */
r.get('/', async (c) => {
  const { results } = await c.env.DB
    .prepare(`SELECT * FROM users ORDER BY id ASC`)
    .all<UserRow>()
  return ok(results.map(strip))
})

/** POST /api/users —— 新建用户 */
r.post('/', async (c) => {
  const b = await c.req.json<{ username?: string; password?: string; role?: Role }>().catch(() => ({} as { username?: string; password?: string; role?: Role }))
  if (!b.username || !b.password) return badRequest('用户名和密码必填')
  if (!/^[a-zA-Z0-9_-]{3,32}$/.test(b.username)) return badRequest('用户名 3-32 位字母数字下划线')
  if (b.password.length < 8) return badRequest('密码至少 8 位')
  const role: Role = ROLES.includes(b.role as Role) ? (b.role as Role) : 'read'

  const exists = await c.env.DB.prepare(`SELECT id FROM users WHERE username = ?1`)
    .bind(b.username).first()
  if (exists) return fail('用户名已存在', 409, 'conflict')

  const res = await c.env.DB
    .prepare(`INSERT INTO users (username, password_hash, role, created_at) VALUES (?1,?2,?3,?4)`)
    .bind(b.username, await hashPassword(b.password), role, nowIso())
    .run()

  return ok({ id: res.meta.last_row_id, username: b.username, role }, { status: 201 })
})

/** PUT /api/users/:id —— 改角色 / 启用停用 / 重置密码 */
r.put('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isFinite(id)) return badRequest('id 非法')

  const target = await c.env.DB.prepare(`SELECT * FROM users WHERE id = ?1`).bind(id).first<UserRow>()
  if (!target) return notFound('用户不存在')

  const b = await c.req.json<{
    role?: Role
    user_type?: number
    user_lv?: number
    disabled?: boolean
    password?: string
    email?: string
    introduction?: string
  }>().catch(() => ({} as Record<string, never>)) as {
    role?: Role
    user_type?: number
    user_lv?: number
    disabled?: boolean
    password?: string
    email?: string
    introduction?: string
  }

  /**
   * 站长保护（两级）：
   *
   * 1. **user_type=0 是站长，永久不可降级/停用**
   *    官方设计里 0 只属于站长本人，连站长自己都不能把 0 让出去，
   *    否则一旦误操作就再没有超级权限可恢复。
   *
   * 2. 用户类型 1（管理员）与 0 合计不能少于 1 个启用账号，
   *    避免把所有管理权限都清空。
   */
  const targetIsBoss = target.user_type === 0
  const demotingByRole = b.role !== undefined && b.role !== 'admin'
  const demotingByType = b.user_type !== undefined && b.user_type !== 0
  const demoteTypeToOne = b.user_type !== undefined && b.user_type === 1

  if (targetIsBoss && (demotingByRole || demoteTypeToOne || b.user_type === 2 || b.disabled === true)) {
    return fail('站长账号不可降级或停用', 409, 'boss_protected')
  }

  if ((demotingByRole || demotingByType || b.disabled === true) && (target.role === 'admin' || target.user_type <= 1)) {
    const admins = await c.env.DB
      .prepare(`SELECT COUNT(*) c FROM users WHERE user_type IN (0,1) AND disabled=0`)
      .first<{ c: number }>()
    if ((admins?.c ?? 0) <= 1) {
      return fail('至少保留一个管理员', 409, 'last_admin')
    }
  }

  const sets: string[] = []
  const vals: unknown[] = []

  // 用户类型（0=admin 1=管理员 2=普通），同时同步 role
  if (b.user_type !== undefined) {
    if (!isValidType(b.user_type)) return badRequest('user_type 必须是 0/1/2')
    sets.push(`user_type = ?${vals.length + 1}`); vals.push(b.user_type)
    sets.push(`role = ?${vals.length + 1}`); vals.push(roleOf(b.user_type))
  } else if (b.role && ROLES.includes(b.role)) {
    sets.push(`role = ?${vals.length + 1}`); vals.push(b.role)
    sets.push(`user_type = ?${vals.length + 1}`); vals.push(userTypeOf(b.role))
  }

  // 等级 1..6
  if (b.user_lv !== undefined) {
    if (!isValidLv(b.user_lv)) return badRequest('user_lv 必须是 1-6')
    sets.push(`user_lv = ?${vals.length + 1}`); vals.push(b.user_lv)
  }

  if (typeof b.disabled === 'boolean') { sets.push(`disabled = ?${vals.length + 1}`); vals.push(b.disabled ? 1 : 0) }
  if (b.email !== undefined) { sets.push(`email = ?${vals.length + 1}`); vals.push(b.email) }
  if (b.introduction !== undefined) { sets.push(`introduction = ?${vals.length + 1}`); vals.push(b.introduction) }

  if (b.password) {
    if (b.password.length < 8) return badRequest('密码至少 8 位')
    sets.push(`password_hash = ?${vals.length + 1}`); vals.push(await hashPassword(b.password))
  }
  if (!sets.length) return badRequest('没有要更新的字段')

  await c.env.DB.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?${vals.length + 1}`)
    .bind(...vals, id).run()

  // 停用或改密时吊销该用户所有会话
  if (b.disabled === true || b.password) {
    await c.env.DB.prepare(`DELETE FROM sessions WHERE user_id = ?1`).bind(id).run()
  }

  return ok({ updated: true })
})

/** DELETE /api/users/:id */
r.delete('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  const me = c.get('user')
  if (me.id === id) return fail('不能删除自己', 409, 'self_delete')

  const target = await c.env.DB.prepare(`SELECT * FROM users WHERE id = ?1`).bind(id).first<UserRow>()
  if (!target) return notFound('用户不存在')

  // 站长账号永久不可删除
  if (target.user_type === 0) {
    return fail('站长账号不可删除', 409, 'boss_protected')
  }

  if (target.user_type <= 1 || target.role === 'admin') {
    const admins = await c.env.DB
      .prepare(`SELECT COUNT(*) c FROM users WHERE user_type IN (0,1) AND disabled=0`).first<{ c: number }>()
    if ((admins?.c ?? 0) <= 1) return fail('至少保留一个管理员', 409, 'last_admin')
  }

  await c.env.DB.batch([
    c.env.DB.prepare(`DELETE FROM sessions WHERE user_id = ?1`).bind(id),
    c.env.DB.prepare(`DELETE FROM users WHERE id = ?1`).bind(id)
  ])
  return ok({ deleted: true })
})

export default r
