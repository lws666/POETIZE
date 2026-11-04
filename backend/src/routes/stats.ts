import { Hono } from 'hono'
import type { Env } from '../lib/types'
import { ok } from '../lib/response'
import { parseArr } from '../lib/posts'

const r = new Hono<{ Bindings: Env }>()

/** GET /api/stats —— 公开，站点统计 */
r.get('/', async (c) => {
  const [posts, cats, tags] = await Promise.all([
    c.env.DB.prepare(`SELECT COUNT(*) c FROM posts WHERE draft=0`).first<{ c: number }>(),
    c.env.DB.prepare(`SELECT categories FROM posts WHERE draft=0`).all<{ categories: string }>(),
    c.env.DB.prepare(`SELECT tags FROM posts WHERE draft=0`).all<{ tags: string }>()
  ])

  const catSet = new Set<string>()
  const tagSet = new Set<string>()
  for (const row of cats.results) for (const k of parseArr(row.categories)) catSet.add(k)
  for (const row of tags.results) for (const k of parseArr(row.tags)) tagSet.add(k)

  return ok({
    post_count: posts?.c ?? 0,
    category_count: catSet.size,
    tag_count: tagSet.size
  })
})

export default r
