import type { PostRow, PostDTO } from './types'

/** 安全解析 JSON 数组字段 */
export function parseArr(v: string | null | undefined): string[] {
  if (!v) return []
  try {
    const a = JSON.parse(v)
    return Array.isArray(a) ? a.map(String) : []
  } catch {
    return []
  }
}

/** DB 行 → 对外 DTO（列表用，不含正文） */
export const toDTO = (r: PostRow): PostDTO => ({
  slug: r.slug,
  title: r.title,
  date: r.date,
  updated: r.updated || '',
  tags: parseArr(r.tags),
  categories: parseArr(r.categories),
  excerpt: r.excerpt || '',
  cover: r.cover || '',
  type: r.type || 'post',
  top: r.top || 0,
  hide: r.hide || '',
  view_type: r.view_type || 'public'
})

/**
 * 剥离 frontmatter —— 与前端 markdown.ts 同一套行级逻辑。
 * 后端存的是原始 md（含 frontmatter），输出给前端前先剥掉，
 * 保证 API 返回的 content 是纯正文。
 */
export function stripFrontmatter(md: string): string {
  if (!md) return ''
  const lines = md.replace(/^\uFEFF/, '').split(/\r?\n/)
  if (lines[0]?.trim() !== '---') return md
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') return lines.slice(i + 1).join('\n')
  }
  return md
}

/** slug 合法性：URL 安全、不含路径穿越 */
export const isValidSlug = (s: string): boolean =>
  /^[a-zA-Z0-9\u4e00-\u9fa5][a-zA-Z0-9\u4e00-\u9fa5._-]{0,120}$/.test(s) && !s.includes('..')
