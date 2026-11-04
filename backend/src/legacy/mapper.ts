import type { PostRow } from '../lib/types'
import { parseArr, stripFrontmatter } from '../lib/posts'

/**
 * 适配层：把本项目的 D1 数据映射成 **poetize 官方 Vue2 前端**需要的结构。
 *
 * 官方结构（从 poetize-ui/src 逆向）：
 *   Article  { id, articleTitle, articleCover, articleContent, createTime, updateTime,
 *              sortId, sort, labelId, label, viewCount, likeCount, commentCount,
 *              hasVideo, videoUrl, userId, username, commentStatus }
 *   Page     { records: Article[], total, size, current, pages }
 *   Sort     { id, sortName, sortDescription, priority, labels? }
 *   Label    { id, labelName, countOfLabel, sortId }
 *   WebInfo  { id, webName, webTitle, notices, footer, avatar, randomCover[],
 *              backgroundImage, historyAllCount, status, waifuJson }
 */
export interface LegacyArticle {
  id: number
  articleTitle: string
  articleCover: string
  articleContent: string
  createTime: string
  updateTime: string
  sortId: number | null
  sort: { id: number; sortName: string }
  labelId: number | null
  label: { id: number; labelName: string }
  viewCount: number
  likeCount: number
  commentCount: number
  hasVideo: boolean
  videoUrl: string
  userId: number
  username: string
  commentStatus: boolean
  articleType: string
}

export interface LegacyPage<T> {
  records: T[]
  total: number
  size: number
  current: number
  pages: number
}

export interface LegacySort {
  id: number
  sortName: string
  sortDescription: string
  priority: number
  /** 该分类下文章数 —— 前端 getters.articleTotal 依赖此字段 */
  countOfSort: number
  labels: LegacyLabel[]
}

export interface LegacyLabel {
  id: number
  labelName: string
  countOfLabel: number
  sortId: number
}

/** 「分类」在官方是 Sort（一级），「标签」是 Label（挂在 Sort 下） */
export function toLegacyArticle(
  r: PostRow,
  opts: { sortIdByName?: Map<string, number>; labelIds?: Map<string, number>; withContent?: boolean; username?: string } = {}
): LegacyArticle {
  const cats = parseArr(r.categories)
  const tags = parseArr(r.tags)
  const sortName = cats[0] || '未分类'
  const labelName = tags[0] || ''

  return {
    id: r.id,
    articleTitle: r.title,
    articleCover: r.cover || '',
    /**
     * 必须剥离 frontmatter。
     * 后端 posts.content 里存的是含 YAML 头的原始 markdown，
     * 直接透传会让标题/日期/tags 全部显示在正文顶部。
     */
    articleContent: opts.withContent ? stripFrontmatter(r.content || '') : '',
    createTime: r.date,
    updateTime: r.updated || r.date,
    sortId: opts.sortIdByName?.get(sortName) ?? null,
    /**
     * sort 与 label 必须是**对象**，不是字符串。
     * article.vue 第 144 行渲染的是：
     *   article.sort.sortName + " ▶ " + article.label.labelName
     * 返回字符串时两个 .xxx 都是 undefined，页面就显示 "undefined ▶ undefined"。
     */
    sort: { id: opts.sortIdByName?.get(sortName) ?? 0, sortName: sortName || '未分类' },
    labelId: labelName ? (opts.labelIds?.get(labelName) ?? null) : null,
    label: { id: labelName ? (opts.labelIds?.get(labelName) ?? 0) : 0, labelName: labelName || '' },
    viewCount: 0,
    likeCount: 0,
    commentCount: 0,
    hasVideo: false,
    videoUrl: '',
    userId: 1,
    username: opts.username || 'lwsnb',
    commentStatus: !!r.comment,
    articleType: r.type || 'article'
  }
}

/** 由 posts 聚合出 Sort（用 categories 字段） */
export function deriveSorts(rows: PostRow[]): LegacySort[] {
  const map = new Map<string, number>()
  for (const r of rows) {
    for (const c of parseArr(r.categories)) map.set(c, (map.get(c) || 0) + 1)
  }
  let id = 1
  return [...map.entries()].map(([name, count]) => ({
    id: id++,
    sortName: name,
    sortDescription: `${count} 篇文章`,
    priority: 0,
    countOfSort: count,
    labels: []
  }))
}

/** 由 posts 聚合出 Label（用 tags 字段） */
export function deriveLabels(rows: PostRow[], sorts: LegacySort[]): LegacyLabel[] {
  const sortId = new Map(sorts.map(s => [s.sortName, s.id]))
  const out: LegacyLabel[] = []
  const seen = new Map<string, number>()
  let id = 1

  for (const r of rows) {
    const cat = parseArr(r.categories)[0] || '未分类'
    for (const t of parseArr(r.tags)) {
      const key = `${cat}::${t}`
      if (seen.has(key)) {
        out.find(x => x.id === seen.get(key))!.countOfLabel++
        continue
      }
      seen.set(key, id)
      out.push({
        id: id++,
        labelName: t,
        countOfLabel: 1,
        sortId: sortId.get(cat) ?? 0
      })
    }
  }
  return out
}
