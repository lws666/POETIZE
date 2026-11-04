import { AwsClient } from 'aws4fetch'
import type { Env } from './types'

/**
 * B2 通过 S3 兼容接口访问。
 * 用 aws4fetch 做 SigV4 签名，无需引入 AWS SDK。
 */
export function b2Client(env: Env) {
  const aws = new AwsClient({
    accessKeyId: env.B2_ACCESS_KEY_ID,
    secretAccessKey: env.B2_SECRET_ACCESS_KEY,
    service: 's3',
    region: 'auto'
  })

  const base = `${env.B2_ENDPOINT}/${env.B2_BUCKET}`

  return {
    /** 上传对象 */
    async put(key: string, body: ArrayBuffer | ReadableStream, contentType: string) {
      const res = await aws.fetch(`${base}/${encodeURI(key)}`, {
        method: 'PUT',
        headers: { 'Content-Type': contentType },
        body
      })
      if (!res.ok) throw new Error(`B2 PUT ${res.status}: ${await res.text().catch(() => '')}`)
      return `${env.B2_PUBLIC_URL.replace(/\/$/, '')}/${key}`
    },

    /** 读取对象 */
    async get(key: string) {
      return aws.fetch(`${base}/${encodeURI(key)}`, { method: 'GET' })
    },

    /** 删除对象 */
    async del(key: string) {
      const res = await aws.fetch(`${base}/${encodeURI(key)}`, { method: 'DELETE' })
      return res.ok
    }
  }
}

/** 从 MIME 推断扩展名 */
export function extOf(mime: string, fallback = 'bin'): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
    'image/gif': 'gif', 'image/svg+xml': 'svg', 'image/avif': 'avif',
    'text/markdown': 'md', 'application/json': 'json'
  }
  return map[mime] || fallback
}
