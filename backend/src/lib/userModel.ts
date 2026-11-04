import type { UserRow, UserVO, Role, UserType, UserLv } from './types'

/**
 * 官方用户体系映射。
 *
 * 官方两套字段并存：
 *   user_type  0=admin(站长) 1=管理员 2=普通用户
 *   user_lv    1..6（UserLvEnum，纯展示等级）
 *
 * 本项目另有一套 role: admin/write/read（用于接口鉴权）
 * 两者保持同步，role 由 user_type 推导，避免数据不一致。
 */

/** user_type → role（鉴权用） */
export function roleOf(userType: number): Role {
  if (userType === 0 || userType === 1) return 'admin'
  return 'read'
}

/** role → user_type（写入时用） */
export function userTypeOf(role: Role): UserType {
  if (role === 'admin') return 0
  if (role === 'write') return 1
  return 2
}

/** 等级中文名（官方 LV1..LV6） */
export const LV_LABEL: Record<number, string> = {
  1: 'LV1', 2: 'LV2', 3: 'LV3', 4: 'LV4', 5: 'LV5', 6: 'LV6'
}

/** 等级对应的权限描述（可自行调整阈值） */
export const LV_RULE: Record<number, string> = {
  1: '新手上路',
  2: '常驻居民',
  3: '活跃用户',
  4: '资深用户',
  5: '核心贡献者',
  6: '荣誉成员'
}

/** 校验等级合法性 */
export const isValidLv = (n: unknown): n is UserLv =>
  typeof n === 'number' && n >= 1 && n <= 6 && Number.isInteger(n)

/** 校验用户类型合法性 */
export const isValidType = (n: unknown): n is UserType =>
  n === 0 || n === 1 || n === 2

/**
 * UserRow → 官方 UserVO
 *
 * 关键：**绝不能带出 password_hash**。
 * isBoss 对应官方「是否站长」，即 user_type === 0。
 */
export function toUserVO(u: UserRow, accessToken?: string): UserVO {
  const vo: UserVO = {
    id: u.id,
    username: u.username,
    email: u.email || '',
    phoneNumber: u.phone_number || '',
    gender: u.gender ?? 0,
    avatar: u.avatar || '',
    userLv: u.user_lv ?? 1,
    introduction: u.introduction || '',
    subscribe: u.subscribe || '',
    createTime: u.created_at,
    isBoss: u.user_type === 0
  }
  if (accessToken) vo.accessToken = accessToken
  return vo
}

/** 随机头像（对齐官方 PoetryUtil.getRandomAvatar） */
const AVATARS = [
  '/assets/avatar-1.png', '/assets/avatar-2.png',
  '/assets/avatar-3.png', '/assets/avatar-4.png'
]
export function randomAvatar(): string {
  return AVATARS[Math.floor(Math.random() * AVATARS.length)]
}
