/**
 * 邮件发送 —— 基于 Brevo HTTP API
 *
 * 为什么不用 Cloudflare Email Routing：
 *   send_email 只能发给"已验证目标地址"，无法给注册用户发信。
 *
 * 为什么不用 Resend：
 *   它拒绝 eu.cc 这类免费公共域（"We don't allow free public domains"），
 *   任何子域都不行。
 *
 * Brevo 接受 lwsnb.eu.cc，免费额度 300 封/天。
 */

export interface MailEnv {
  BREVO_API_KEY: string
  MAIL_FROM: string
  MAIL_FROM_NAME: string
}

interface SendOpts {
  to: string
  toName?: string
  subject: string
  html: string
  text?: string
}

/** 发一封邮件，返回 messageId；失败抛错 */
export async function sendMail(env: MailEnv, opts: SendOpts): Promise<string> {
  if (!env.BREVO_API_KEY) throw new Error('BREVO_API_KEY 未配置')

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'api-key': env.BREVO_API_KEY,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      sender: {
        email: env.MAIL_FROM || 'admin@lwsnb.eu.cc',
        name: env.MAIL_FROM_NAME || '谢谢の博客'
      },
      to: [{ email: opts.to, name: opts.toName || opts.to.split('@')[0] }],
      subject: opts.subject,
      htmlContent: opts.html,
      ...(opts.text ? { textContent: opts.text } : {})
    })
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Brevo ${res.status}: ${body.slice(0, 200)}`)
  }

  const data = await res.json<{ messageId?: string }>().catch(() => ({} as { messageId?: string }))
  return data.messageId || ''
}

/** 生成 6 位数字验证码 */
export function genCode(): string {
  const arr = new Uint32Array(1)
  crypto.getRandomValues(arr)
  return String(arr[0] % 1000000).padStart(6, '0')
}

/** 验证码邮件模板 */
export function verifyCodeHtml(code: string, username: string, expireMin = 15): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f5f6f8;font-family:-apple-system,BlinkMacSystemFont,'PingFang SC','Microsoft YaHei',sans-serif">
  <div style="max-width:520px;margin:40px auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.06)">
    <div style="background:linear-gradient(135deg,#5b8c85,#7fb3aa);padding:28px 32px">
      <div style="color:#fff;font-size:19px;font-weight:600">谢谢の博客</div>
      <div style="color:rgba(255,255,255,.85);font-size:13px;margin-top:6px">邮箱验证</div>
    </div>
    <div style="padding:32px">
      <p style="margin:0 0 16px;color:#333;font-size:15px">你好，<strong>${esc(username)}</strong>：</p>
      <p style="margin:0 0 22px;color:#666;font-size:14px;line-height:1.7">
        你正在注册本站账号，请使用下面的验证码完成验证：
      </p>
      <div style="background:#f7f9fa;border:1px dashed #cfe0dc;border-radius:8px;padding:22px;text-align:center">
        <div style="font-size:34px;font-weight:700;letter-spacing:10px;color:#5b8c85;font-family:'SF Mono',Consolas,monospace">${code}</div>
        <div style="color:#999;font-size:12px;margin-top:10px">${expireMin} 分钟内有效</div>
      </div>
      <p style="margin:22px 0 0;color:#999;font-size:13px;line-height:1.7">
        如果不是你本人操作，请忽略这封邮件。
      </p>
    </div>
    <div style="background:#fafbfc;padding:18px 32px;border-top:1px solid #eef1f3">
      <div style="color:#b0b8c0;font-size:12px">此邮件由系统自动发送，请勿直接回复。</div>
    </div>
  </div>
</body></html>`
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
