/**
 * 密码哈希 —— PBKDF2-SHA256。
 *
 * 格式与旧后端完全一致：`pbkdf2$<iter>$<b64salt>$<b64hash>`
 * 这样线上已有的 2 个用户无需重置密码即可继续登录。
 */

const ITER = 100_000
const KEYLEN = 32

const b64 = (buf: ArrayBuffer | Uint8Array): string => {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s)
}

const unb64 = (s: string): Uint8Array => {
  const bin = atob(s)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function pbkdf2(password: string, salt: Uint8Array, iter: number): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' },
    key,
    KEYLEN * 8
  )
  return b64(bits)
}

/** 生成新密码哈希 */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const hash = await pbkdf2(password, salt, ITER)
  return `pbkdf2$${ITER}$${b64(salt)}$${hash}`
}

/** 校验密码；用恒定时间比较避免时序泄漏 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$')
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false
  const iter = Number(parts[1])
  const salt = unb64(parts[2])
  const expect = parts[3]
  const actual = await pbkdf2(password, salt, iter)
  return timingSafeEqual(actual, expect)
}

/** 恒定时间字符串比较 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/** SHA-256 hex（用于 token / session 存取） */
export async function sha256(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('')
}

/** 生成带前缀的随机令牌 */
export function randomToken(prefix: string, bytes = 24): string {
  const arr = crypto.getRandomValues(new Uint8Array(bytes))
  const s = [...arr].map(b => b.toString(16).padStart(2, '0')).join('')
  return `${prefix}_${s}`
}

export const nowIso = () => new Date().toISOString()
