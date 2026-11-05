import type { Context, MiddlewareHandler } from 'hono'
import { getCookie } from 'hono/cookie'
import type { Env, Role, UserRow } from './types'
import { sha256 } from './crypto'
import { forbidden, unauthorized } from './response'

export interface AuthUser {
  id: number
  username: string
  role: Role
  via: 'session' | 'token'
}

export type AuthCtx = { Variables: { user: AuthUser } }

const ROLE_RANK: Record<Role, number> = { read: 1, write: 2, admin: 3 }

/**
 * 解析当前请求的身份。
 *
 * 支持两种凭证：
 *   1. Session Cookie  `sid=<sess_...>`     —— 后台管理页用
 *   2. Bearer Token    `Authorization: Bearer blg_...` —— 脚本 / 外部调用
 *
 * 两者都只存 SHA-256 哈希，数据库中看不到明文。
 */
export async function resolveUser(c: Context<AuthCtx & { Bindings: Env }>): Promise<AuthUser | null> {
  const db = c.env.DB

  // 1) Session
  const sid = getCookie(c, 'sid')
  if (sid) {
    const row = await db
      .prepare(
        `SELECT s.user_id, s.expires_at, u.id, u.username, u.role, u.disabled
           FROM sessions s JOIN users u ON u.id = s.user_id
          WHERE s.token_hash = ?1`
      )
      .bind(await sha256(sid))
      .first<{ user_id: number; expires_at: string; id: number; username: string; role: Role; disabled: number }>()

    if (row && !row.disabled && new Date(row.expires_at) > new Date()) {
      return { id: row.id, username: row.username, role: row.role, via: 'session' }
    }
  }

  // 2) Bearer
  const auth = (c.req.header('Authorization') || '').trim()
  if (auth && auth !== 'null' && auth !== 'undefined') {
    const raw = auth.startsWith('Bearer ') ? auth.slice(7).trim() : auth

    /**
     * 兼容旧版：UPLOAD_TOKEN 本尊等价于 admin。
     * 旧 admin 面板与既有脚本在用这个令牌，换后端不能把它弄失效。
     * 用恒定时间比较，避免通过响应时间逐字节猜出令牌。
     */
    if (c.env.UPLOAD_TOKEN && timingSafeStr(raw, c.env.UPLOAD_TOKEN)) {
      return { id: 0, username: 'upload-token', role: 'admin', via: 'token' }
    }

    const row = await db
      .prepare(
        `SELECT t.id, t.scope, t.revoked FROM api_tokens t WHERE t.token_hash = ?1`
      )
      .bind(await sha256(raw))
      .first<{ id: number; scope: Role; revoked: number }>()

    if (row && !row.revoked) {
      // 记录最近使用时间（失败不影响主流程）
      c.executionCtx.waitUntil(
        db.prepare(`UPDATE api_tokens SET last_used_at = ?1 WHERE id = ?2`)
          .bind(new Date().toISOString(), row.id)
          .run()
          .catch(() => {})
      )
      return { id: 0, username: `token:${row.id}`, role: row.scope, via: 'token' }
    }
  }

  return null
}

/** 要求已登录，且角色 ≥ min */
export function requireRole(min: Role): MiddlewareHandler<AuthCtx & { Bindings: Env }> {
  return async (c, next) => {
    const u = await resolveUser(c)
    if (!u) return unauthorized()
    if (ROLE_RANK[u.role] < ROLE_RANK[min]) return forbidden(`需要 ${min} 权限`)
    c.set('user', u)
    await next()
  }
}

export const requireAuth = requireRole('read')
export const requireWrite = requireRole('write')
export const requireAdmin = requireRole('admin')

/** 从 Cookie 或 Bearer 中提取原始令牌（登出时用） */
export function rawSessionToken(c: Context): string | null {
  return getCookie(c, 'sid') || null
}

export async function findUserByName(db: D1Database, username: string): Promise<UserRow | null> {
  return db.prepare(`SELECT * FROM users WHERE username = ?1`).bind(username).first<UserRow>()
}


/** 恒定时间字符串比较（用于 UPLOAD_TOKEN 这类静态令牌） */
function timingSafeStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}


/**
 * 轻量取当前用户 —— 给不需要完整 Context 泛型的地方用（如 posts 详情）。
 *
 * 同时支持 Bearer 与 Cookie 两种凭证。
 */
export async function currentUserLite(
  db: D1Database,
  authorization: string | undefined,
  cookie: string | undefined
): Promise<UserRow | null> {
  /**
   * 兼容三种传法：
   *   1. Authorization: Bearer sess_xxx    （标准，脚本用）
   *   2. Authorization: sess_xxx           （官方 Vue 前端 request.js 就是这样）
   *   3. Cookie: sid=sess_xxx              （同域场景）
   * 字符串 "null" / "undefined" 视为无凭证。
   */
  let token = ''
  const raw = (authorization || '').trim()
  if (raw && raw !== 'null' && raw !== 'undefined') {
    token = raw.startsWith('Bearer ') ? raw.slice(7).trim() : raw
  }
  if (!token && cookie) token = cookie.match(/sid=([^;]+)/)?.[1] || ''
  if (!token || token === 'null') return null

  return (
    (await db
      .prepare(
        /**
         * 必须检查 u.disabled —— 被封禁的用户不能继续操作。
         * resolveUser 有检查，这里之前漏了，导致被禁用户仍能发评论/随笔。
         */
        `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
          WHERE s.token_hash = ?1 AND s.expires_at > ?2 AND u.disabled = 0`
      )
      .bind(await sha256(token), new Date().toISOString())
      .first<UserRow>()) ?? null
  )
}
