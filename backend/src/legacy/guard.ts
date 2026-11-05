import type { Context } from 'hono'
import type { Env, UserRow } from '../lib/types'
import { currentUserLite } from '../lib/auth'
import { legacyErr } from './response'

/**
 * legacy 层的鉴权守卫
 *
 * 为什么单独写：legacy 是为适配官方 Vue 前端做的，路由直接用
 * admin.post(...) 注册，没有走 Hono 的 requireRole 中间件。
 * 结果 94 个接口全部裸奔 —— 未登录就能删文章、改配置、提权。
 *
 * 这里提供两个 require* 辅助函数，在需要保护的路由里手动调用。
 * 返回 null 表示通过，返回 Response 表示拒绝（直接 return 即可）。
 */

type Ctx = Context<{ Bindings: Env }>

/** 取当前用户（复用 currentUserLite，已含 disabled 检查） */
export async function guardUser(c: Ctx): Promise<UserRow | null> {
  return currentUserLite(
    c.env.DB,
    c.req.header('Authorization'),
    c.req.header('Cookie')
  )
}

/**
 * 要求写权限（user_type 0 站长 / 1 管理员）。
 * 返回 null 表示通过。
 */
export async function requireWrite(c: Ctx): Promise<Response | null> {
  const u = await guardUser(c)
  if (!u) return legacyErr('请先登录', 401)
  if (u.user_type > 1) return legacyErr('需要管理员权限', 403)
  return null
}

/**
 * 要求站长权限（user_type === 0）。
 * 用于删除用户、改用户类型这类高危操作。
 */
export async function requireBoss(c: Ctx): Promise<Response | null> {
  const u = await guardUser(c)
  if (!u) return legacyErr('请先登录', 401)
  if (u.user_type !== 0) return legacyErr('需要站长权限', 403)
  return null
}

/** 要求已登录（任意等级） */
export async function requireLogin(c: Ctx): Promise<Response | null> {
  const u = await guardUser(c)
  if (!u) return legacyErr('请先登录', 401)
  return null
}
