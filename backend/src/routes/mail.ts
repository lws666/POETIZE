import { Hono } from 'hono'
import type { Env } from '../lib/types'
import { sendMail, genCode, verifyCodeHtml } from '../lib/mail'
import { ok, badRequest, fail } from '../lib/response'
import { nowIso } from '../lib/crypto'

/**
 * 邮箱验证码接口
 *
 *   POST /api/mail/send-code   发送验证码
 *   POST /api/mail/verify-code 校验验证码（注册时调用）
 *
 * 限流：同一邮箱 60 秒一次、每小时 5 次。
 */
const r = new Hono<{ Bindings: Env }>()

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const CODE_TTL_MIN = 15

/** 简单限流（内存，Worker 实例级） */
const lastSend = new Map<string, { at: number; count: number; windowStart: number }>()

function rateLimit(key: string): string | null {
  const now = Date.now()
  const cur = lastSend.get(key)

  if (!cur) {
    lastSend.set(key, { at: now, count: 1, windowStart: now })
    return null
  }
  // 60 秒冷却
  if (now - cur.at < 60_000) {
    return `请等待 ${Math.ceil((60_000 - (now - cur.at)) / 1000)} 秒后再试`
  }
  // 每小时 5 次
  if (now - cur.windowStart > 3_600_000) {
    cur.windowStart = now
    cur.count = 1
  } else if (cur.count >= 5) {
    return '该邮箱发送过于频繁，请一小时后再试'
  } else {
    cur.count++
  }
  cur.at = now
  return null
}

/** POST /api/mail/send-code  { email, purpose? } */
r.post('/send-code', async (c) => {
  const b = await c.req.json<{ email?: string; purpose?: string }>()
    .catch(() => ({} as { email?: string; purpose?: string }))
  const email = (b.email || '').trim().toLowerCase()
  const purpose = (b.purpose || 'register').trim()

  if (!EMAIL_RE.test(email)) return badRequest('邮箱格式不正确')

  const limited = rateLimit(`${email}:${purpose}`)
  if (limited) return fail(limited, 429, 'rate_limited')

  // 已注册的邮箱不再发验证码
  if (purpose === 'register') {
    const exists = await c.env.DB
      .prepare(`SELECT id FROM users WHERE email=?1 AND email<>''`)
      .bind(email).first()
    if (exists) return fail('该邮箱已被注册', 409, 'email_taken')
  }

  const code = genCode()
  const expires = new Date(Date.now() + CODE_TTL_MIN * 60_000).toISOString()

  // 作废旧码
  await c.env.DB
    .prepare(`UPDATE email_codes SET used=1 WHERE email=?1 AND purpose=?2 AND used=0`)
    .bind(email, purpose).run()

  await c.env.DB
    .prepare(`INSERT INTO email_codes (email,code,purpose,attempts,used,expires_at,created_at)
              VALUES (?1,?2,?3,0,0,?4,?5)`)
    .bind(email, code, purpose, expires, nowIso()).run()

  try {
    await sendMail(c.env as never, {
      to: email,
      subject: `【谢谢の博客】验证码 ${code}`,
      html: verifyCodeHtml(code, email.split('@')[0], CODE_TTL_MIN)
    })
  } catch (e) {
    return fail(`邮件发送失败：${(e as Error).message}`, 502, 'mail_failed')
  }

  return ok({ sent: true, expireMinutes: CODE_TTL_MIN })
})

/**
 * 校验验证码（供注册接口内部调用，也可单独调用）
 * 返回 true 表示通过，并标记为已用。
 */
export async function consumeCode(
  db: D1Database,
  email: string,
  code: string,
  purpose = 'register'
): Promise<{ ok: boolean; reason?: string }> {
  const row = await db
    .prepare(`SELECT id, code, attempts, expires_at FROM email_codes
              WHERE email=?1 AND purpose=?2 AND used=0 ORDER BY id DESC LIMIT 1`)
    .bind(email.toLowerCase(), purpose)
    .first<{ id: number; code: string; attempts: number; expires_at: string }>()

  if (!row) return { ok: false, reason: '验证码不存在或已使用' }
  if (new Date(row.expires_at).getTime() < Date.now()) return { ok: false, reason: '验证码已过期' }
  if (row.attempts >= 5) return { ok: false, reason: '尝试次数过多，请重新获取' }

  if (row.code !== code.trim()) {
    await db.prepare(`UPDATE email_codes SET attempts=attempts+1 WHERE id=?1`).bind(row.id).run()
    return { ok: false, reason: '验证码错误' }
  }

  await db.prepare(`UPDATE email_codes SET used=1 WHERE id=?1`).bind(row.id).run()
  return { ok: true }
}

/** POST /api/mail/verify-code  { email, code } —— 仅供测试/前端预校验 */
r.post('/verify-code', async (c) => {
  const b = await c.req.json<{ email?: string; code?: string }>().catch(() => ({} as { email?: string; code?: string }))
  const email = (b.email || '').trim()
  const code = (b.code || '').trim()
  if (!EMAIL_RE.test(email) || !code) return badRequest('参数不完整')

  const res = await consumeCode(c.env.DB, email, code)
  if (!res.ok) return fail(res.reason || '验证失败', 400, 'code_invalid')
  return ok({ verified: true })
})

export default r
