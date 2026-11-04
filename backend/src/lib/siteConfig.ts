import type { Env } from './types'

/**
 * 站点配置读写。
 *
 * 存 D1 的 site_config 表（key-value），而不是写死在代码里，
 * 这样后台改头像/背景/公告后无需重新部署。
 *
 * 读多写少，用一次 SELECT 全量取，调用方自行挑字段。
 */
export type SiteConfig = Record<string, string>

/** 默认值：表里缺 key 时兜底，保证前端永远拿得到完整字段 */
const DEFAULTS: SiteConfig = {
  webName: '谢谢の博客',
  webTitle: '谢谢の博客',
  author: '洛神',
  avatar: '/avatar.jpg',
  backgroundImage: '/hero.webp',
  randomCover: '[]',
  notices: '[]',
  footer: '',
  beian: '',
  'bar.menu.show': '首页,记录,家,游记,随笔,相册,百宝箱,音乐,收藏夹,友链,留言',
  status: 'true',
  'local.enable': 'false',
  'qiniu.enable': 'false',
  webStaticResourcePrefix: '/',
  /** 图片绝对化用；换前端域名时改这里 */
  siteOrigin: 'https://www.lwsnb.eu.cc',
  /** 首页弹窗开关（默认关闭，避免打扰访客） */
  'push.enable': 'false',
  friendWebName: '',
  friendUrl: '',
  friendAvatar: '',
  friendIntroduction: '',
  friendCover: ''
}

/** 读取全部配置（带默认值兜底） */
export async function readConfig(db: D1Database): Promise<SiteConfig> {
  const { results } = await db
    .prepare(`SELECT key, value FROM site_config`)
    .all<{ key: string; value: string }>()

  const out: SiteConfig = { ...DEFAULTS }
  for (const r of results) out[r.key] = r.value
  return out
}

/** 批量写入（UPSERT），只允许白名单键 */
export async function writeConfig(
  db: D1Database,
  patch: Record<string, string>
): Promise<number> {
  const allowed = new Set(Object.keys(DEFAULTS))
  const now = new Date().toISOString()

  const stmts = Object.entries(patch)
    .filter(([k]) => allowed.has(k))
    .map(([k, v]) =>
      db
        .prepare(
          `INSERT INTO site_config (key, value, updated_at) VALUES (?1,?2,?3)
           ON CONFLICT(key) DO UPDATE SET value=?2, updated_at=?3`
        )
        .bind(k, String(v), now)
    )

  if (!stmts.length) return 0
  await db.batch(stmts)
  return stmts.length
}

/** 安全 JSON 解析数组字段 */
export function asArray(v: string | undefined): string[] {
  if (!v) return []
  try {
    const a = JSON.parse(v)
    return Array.isArray(a) ? a.map(String) : []
  } catch {
    return []
  }
}
