import type { PostRow, UserRow } from './types'

/**
 * 文章访问控制 —— 对齐官方 ViewTypeEnum + ResourceCheckAspect。
 *
 * 官方 4 种 viewType：
 *   public    公开
 *   login     登录可见
 *   userLv    达到指定等级可见（viewValue 存等级数字）
 *   password  密码可见（viewValue 存密码）
 *
 * 官方无权限时抛出的提示取 tips，为空则用默认文案。
 */
export type ViewType = 'public' | 'login' | 'userLv' | 'password'

export const VIEW_TYPES: ViewType[] = ['public', 'login', 'userLv', 'password']

export const VIEW_LABEL: Record<ViewType, string> = {
  public: '公开',
  login: '登录可见',
  userLv: '等级可见',
  password: '密码可见'
}

export const isValidViewType = (t: unknown): t is ViewType =>
  typeof t === 'string' && VIEW_TYPES.includes(t as ViewType)

export interface AccessResult {
  allowed: boolean
  /** 拒绝原因码，便于前端区分展示 */
  reason?: 'need_login' | 'need_level' | 'wrong_password'
  /** 给用户的提示 */
  message?: string
  /** 需要的等级（need_level 时有值） */
  needLevel?: number
}

const DEFAULT_TIPS = '您未获得文章访问权限，请联系作者'

/**
 * 判断当前访问者能否看这篇文章的正文。
 *
 * @param post     文章行
 * @param user     当前登录用户，未登录取 null
 * @param password 用户提交的密码（viewType=password 时用）
 */
export function checkAccess(
  post: Pick<PostRow, 'view_type' | 'view_value' | 'tips'>,
  user: UserRow | null,
  password?: string
): AccessResult {
  const type = (post.view_type || 'public') as ViewType
  const tips = (post.tips || '').trim() || DEFAULT_TIPS
  const value = (post.view_value || '').trim()

  if (type === 'public') return { allowed: true }

  /**
   * 密码类型**优先于登录判断**。
   *
   * 官方 ResourceCheckAspect 对 password 分支是直接比对 viewValue，
   * 通过就放行，不要求登录。若先判断登录，未登录用户即使密码正确
   * 也会被「请先登录」挡住，与官方行为不一致。
   */
  if (type === 'password') {
    if (password !== undefined && password === value) return { allowed: true }
    return { allowed: false, reason: 'wrong_password', message: `密码错误。${tips}` }
  }

  // 以下均需登录
  if (!user) {
    return { allowed: false, reason: 'need_login', message: '该文章需要登录后查看' }
  }

  if (type === 'login') return { allowed: true }

  if (type === 'userLv') {
    const need = Number(value) || 1
    const current = user.user_lv ?? 1
    if (current >= need) return { allowed: true }
    return {
      allowed: false,
      reason: 'need_level',
      needLevel: need,
      message: `需要 LV${need} 才能查看（当前 LV${current}）。${tips}`
    }
  }

  return { allowed: true }
}

/**
 * 列表页用的可见性过滤。
 *
 * 官方列表不隐藏文章（只隐藏正文），但这里额外把
 * 「非公开且当前用户无权」的文章标记出来，前端可显示锁图标。
 */
export function canSeeInList(
  post: Pick<PostRow, 'view_type' | 'view_value'>,
  user: UserRow | null
): boolean {
  const type = (post.view_type || 'public') as ViewType
  if (type === 'public') return true
  if (!user) return false
  if (type === 'login') return true
  if (type === 'userLv') return (user.user_lv ?? 1) >= (Number(post.view_value) || 1)
  // password 类型在列表里可见（点进去才要密码）
  return true
}
