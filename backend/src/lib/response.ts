import type { Envelope } from './types'

/** 所有接口统一走这两个函数，保证信封一致 */
export const ok = <T>(data: T, init?: ResponseInit) =>
  Response.json({ success: true, data } satisfies Envelope<T>, init)

export const fail = (error: string, status = 400, code?: string) =>
  Response.json({ success: false, error, ...(code ? { code } : {}) } satisfies Envelope<never>, { status })

export const unauthorized = (msg = '未认证') => fail(msg, 401, 'unauthorized')
export const forbidden = (msg = '无权限') => fail(msg, 403, 'forbidden')
export const notFound = (msg = '不存在') => fail(msg, 404, 'not_found')
export const badRequest = (msg = '参数错误') => fail(msg, 400, 'bad_request')
