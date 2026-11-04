import { Hono } from 'hono'
import type { Env } from '../lib/types'
import { legacyOk } from './response'
import { nowIso } from '../lib/crypto'

/**
 * 访问统计 —— main.vue 后台首页用。
 *
 * 官方 /webInfo/getHistoryInfo 返回今日与历史访问量。
 * 本实现从 poem_history 表聚合，并额外提供 IP 明细列表。
 */
export const history = new Hono<{ Bindings: Env }>()

/** 记录一次访问（前端可调用，失败静默） */
history.post('/record', async (c) => {
  const ip = c.req.header('CF-Connecting-IP') || ''
  const ua = c.req.header('User-Agent') || ''
  const body = await c.req.json<{ url?: string; nation?: string; province?: string; city?: string }>()
    .catch(() => ({} as { url?: string; nation?: string; province?: string; city?: string }))

  // Cloudflare 提供的地理信息
  const nation = body.nation || c.req.header('CF-IPCountry') || ''
  const city = body.city || (c.req as unknown as { cf?: { city?: string } }).cf?.city || ''

  await c.env.DB
    .prepare(`INSERT INTO poem_history (ip,nation,province,city,user_agent,url,create_time) VALUES (?1,?2,?3,?4,?5,?6,?7)`)
    .bind(ip, nation, body.province || '', city, ua.slice(0, 200), body.url || '', nowIso())
    .run()

  return legacyOk({ recorded: true })
})

/**
 * GET /webInfo/getHistoryInfo
 *
 * 返回结构对齐官方：{ historyAllCount, historyDayCount, ... }
 * 额外补充 ipList 供「访问 IP」面板使用。
 */
history.get('/info', async (c) => {
  const today = new Date().toISOString().slice(0, 10)

  const all = await c.env.DB.prepare(`SELECT COUNT(*) c FROM poem_history`).first<{ c: number }>()
  const day = await c.env.DB
    .prepare(`SELECT COUNT(*) c FROM poem_history WHERE create_time LIKE ?1`)
    .bind(`${today}%`)
    .first<{ c: number }>()

  // 最近 50 条 IP 明细
  const { results } = await c.env.DB
    .prepare(`SELECT ip, nation, city, user_agent, url, create_time FROM poem_history ORDER BY id DESC LIMIT 50`)
    .all()

  return legacyOk({
    historyAllCount: all?.c ?? 0,
    historyDayCount: day?.c ?? 0,
    ipList: results
  })
})

/** GET /admin/history/list —— 分页 IP 明细 */
history.get('/list', async (c) => {
  const current = Math.max(1, Number(c.req.query('current')) || 1)
  const size = Math.min(100, Math.max(1, Number(c.req.query('size')) || 20))

  const total = (await c.env.DB.prepare(`SELECT COUNT(*) c FROM poem_history`).first<{ c: number }>())?.c ?? 0
  const { results } = await c.env.DB
    .prepare(`SELECT * FROM poem_history ORDER BY id DESC LIMIT ?1 OFFSET ?2`)
    .bind(size, (current - 1) * size)
    .all()

  return legacyOk({ records: results, total, size, current, pages: Math.ceil(total / size) })
})
