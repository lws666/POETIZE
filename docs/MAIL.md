# 邮件服务配置

注册验证邮件使用 **Brevo**（原 Sendinblue）。

## 为什么不用其他方案

| 方案 | 结论 |
|---|---|
| Cloudflare Email Routing | `send_email` 只能发给"已验证目标地址"，无法给注册用户发信 |
| Resend | 拒绝 `eu.cc` 等免费公共域，任何子域都不行 |
| **Brevo** | ✅ 接受 `lwsnb.eu.cc`，免费 300 封/天 |

## 已完成配置

### 发件人

```
admin@lwsnb.eu.cc
显示名：谢谢の博客
```

### DNS 记录（Cloudflare）

| 类型 | 名称 | 值 |
|---|---|---|
| CNAME | `brevo1._domainkey` | `b1.lwsnb-eu-cc.dkim.brevo.com` |
| CNAME | `brevo2._domainkey` | `b2.lwsnb-eu-cc.dkim.brevo.com` |
| TXT | `@` | `brevo-code:f7d50f8aa8e0710d79f5ccc68bef0a35` |
| TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:rua@dmarc.brevo.com` |

SPF 已合并两个服务商：

```
v=spf1 include:_spf.mx.cloudflare.net include:spf.brevo.com ~all
```

### Worker Secret

```bash
npx wrangler secret put BREVO_API_KEY
```

环境变量（`wrangler.toml` 的 `[vars]`）：

```toml
MAIL_FROM = "admin@lwsnb.eu.cc"
MAIL_FROM_NAME = "谢谢の博客"
```

## 接口

### POST /api/mail/send-code

```json
{ "email": "user@example.com", "purpose": "register" }
```

响应：

```json
{ "success": true, "data": { "sent": true, "expireMinutes": 15 } }
```

限流：同邮箱 60 秒一次、每小时 5 次。

### POST /api/mail/verify-code

```json
{ "email": "user@example.com", "code": "123456" }
```

### 注册时校验

`POST /api/legacy/user/regist` 增加 `code` 字段：

```
username=xxx&password=xxx&email=xxx&code=123456
```

传了 `code` 就必须校验通过，不传则跳过（兼容脚本注册）。

## 数据库

`email_codes` 表：

| 字段 | 说明 |
|---|---|
| `email` | 目标邮箱 |
| `code` | 6 位数字 |
| `purpose` | `register` / `reset` / `bind` |
| `attempts` | 错误次数，≥5 锁定 |
| `used` | 1 = 已使用 |
| `expires_at` | 15 分钟后过期 |

## 安全机制

| 机制 | 规则 |
|---|---|
| 发送冷却 | 同邮箱 60 秒 |
| 频率上限 | 同邮箱每小时 5 次 |
| 尝试次数 | 单个验证码最多试 5 次 |
| 有效期 | 15 分钟 |
| 一次性 | 用后立即标记 `used=1` |
| 旧码作废 | 发新码时把旧码全部标记已用 |

## 免费额度

```
Brevo Free:
  300 封/天
  无收件人限制
  无需绑卡
```

## 排错

**邮件没收到**

1. 检查垃圾箱
2. 看 `/tmp/m1` 类的 API 响应是否有 messageId
3. 在 Brevo 后台 → Transactional → Logs 查投递状态

**报 `BREVO_API_KEY 未配置`**

```bash
cd backend
npx wrangler secret put BREVO_API_KEY
npx wrangler deploy
```

**报 `邮件发送失败：Brevo 401`**

API Key 失效或权限不足，去 Brevo 重新生成。

**SPF 校验失败**

一个域名只能有一条 SPF。检查是否重复：

```bash
dig +short TXT lwsnb.eu.cc | grep spf1
```
