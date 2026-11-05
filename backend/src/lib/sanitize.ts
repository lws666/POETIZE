/**
 * 用户输入的 HTML 净化
 *
 * 背景：评论、随笔、树洞都用 v-html 渲染，后端原样存储，
 * 传入 <img src=x onerror=alert(1)> 会直接执行脚本。
 *
 * 策略：不允许任何 HTML 标签，全部转义成实体。
 *   - 评论/随笔/树洞都是纯文本场景，不需要富文本
 *   - 前端的面表情（[微笑]）和图片语法（[图片,url]）由 common.js 处理，
 *     作用在转义后的文本上依然有效
 *   - Markdown 文章正文不走这里，那是作者本人内容
 */

const ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
  '/': '&#x2F;'
}

/** 转义 HTML 特殊字符 */
export function escapeHtml(input: string): string {
  return String(input || '').replace(/[&<>"'/]/g, ch => ESCAPE_MAP[ch] || ch)
}

/**
 * 净化用户提交的短文本（评论 / 随笔 / 树洞 / 微言）
 *
 * 1. 先反转义已有的实体，避免二次转义（&amp; → & → &amp;）
 * 2. 再统一转义
 * 3. 保留换行（前端用 \n 转 <br/>）
 */
export function sanitizeText(input: string): string {
  let s = String(input || '')

  // 反转义一次，避免用户输入 &lt;script&gt; 被存成 &amp;lt;script&amp;gt;
  s = s.replace(/&lt;/g, '<')
       .replace(/&gt;/g, '>')
       .replace(/&quot;/g, '"')
       .replace(/&#39;/g, "'")
       .replace(/&#x2F;/g, '/')
       .replace(/&amp;/g, '&')

  // 去掉控制字符（除换行、制表）
  s = s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')

  return escapeHtml(s)
}

/**
 * 校验并规范化用户提供的 URL（头像、封面、友链等）
 * 只允许 http/https/相对路径，拒绝 javascript: data: 等危险协议。
 */
export function sanitizeUrl(input: string): string {
  const s = String(input || '').trim()
  if (!s) return ''
  // 相对路径
  if (s.startsWith('/')) return s
  // 绝对 URL 仅允许 http(s)
  if (/^https?:\/\//i.test(s)) return s
  // 其余一律丢弃（javascript:、data:、vbscript: 等）
  return ''
}
