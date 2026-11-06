/**
 * 默认头像生成
 *
 * 不用图片文件的原因：
 *   1. 项目里没有头像素材，/assets/avatar-1.png 这类路径全是 404
 *      （Pages 的 SPA fallback 会返回 index.html，content-type 是 text/html，
 *       浏览器 <img> 拿到 HTML 就当坏了，显示为空白）
 *   2. 静态图无法随用户名变化，所有新用户长得一样
 *   3. 多几张图就要多几次请求
 *
 * 改成 data URI 内联 SVG：
 *   - 零请求，不依赖 CDN
 *   - 按用户名哈希取色 + 首字，每个人都不同
 *   - 体积约 300 字节，直接存进 users.avatar
 */

/** 一组饱和度适中、白字可读的底色 */
const PALETTE = [
  '#5B8FF9', '#61DDAA', '#65789B', '#F6BD16', '#7262FD',
  '#78D3F8', '#9661BC', '#F6903D', '#008685', '#F08BB4',
  '#E8684A', '#6DC8EC'
]

/** 简单的字符串哈希（djb2） */
function hashOf(s: string): number {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0
  return h
}

/**
 * 生成一个内联 SVG 头像（data URI）
 *
 * @param seed 用于取色和取字，通常传用户名
 */
export function generateAvatar(seed: string): string {
  const name = (seed || '?').trim()
  const bg = PALETTE[hashOf(name) % PALETTE.length]
  // 取首字符：中文取第一个字，英文全大写
  const ch = name.slice(0, 1).toUpperCase()

  // SVG 里需要转义的字符
  const safe = ch
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">` +
    `<rect width="120" height="120" rx="60" fill="${bg}"/>` +
    `<text x="60" y="60" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif" ` +
    `font-size="52" font-weight="600" fill="#ffffff" text-anchor="middle" dominant-baseline="central">${safe}</text>` +
    `</svg>`

  // encodeURIComponent 而不是 base64：更短，且 SVG 里中文能被正确编码
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}
