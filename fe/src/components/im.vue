<template>
  <div class="im-page">
    <div class="im-head">
      <div class="im-title">
        <span class="im-dot" :class="{ on: connected }"></span>
        公共聊天室
      </div>
      <div class="im-online" v-if="connected">{{ onlineCount }} 人在线</div>
      <div class="im-online off" v-else>连接中…</div>
    </div>

    <div class="im-body" ref="body">
      <div v-if="loading" class="im-loading">加载中…</div>
      <div v-else-if="messages.length === 0" class="im-empty">
        还没有人说话，来发第一条吧
      </div>
      <div v-for="m in messages" :key="m.id" class="im-item" :class="{ mine: m.userId === myId }">
        <el-avatar :size="34" :src="m.avatar"></el-avatar>
        <div class="im-main">
          <div class="im-meta">
            <span class="im-name">{{ m.username }}</span>
            <span class="im-time">{{ fmtTime(m.createdAt) }}</span>
          </div>
          <div class="im-text">{{ m.content }}</div>
        </div>
      </div>
    </div>

    <div class="im-foot">
      <template v-if="currentUser && currentUser.id">
        <input
          class="im-input"
          v-model="draft"
          placeholder="说点什么…（Enter 发送）"
          maxlength="500"
          @keyup.enter="send"
          :disabled="!connected"
        />
        <button class="im-send" @click="send" :disabled="!connected || !draft.trim()">发送</button>
      </template>
      <div v-else class="im-login">
        请先 <a href="/user" style="color: var(--themeBackground)">登录</a> 后参与聊天
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'im',
  data() {
    return {
      messages: [],
      draft: '',
      connected: false,
      onlineCount: 0,
      loading: true,
      ws: null,
      retryTimer: null,
      pingTimer: null,
      myId: 0
    }
  },
  computed: {
    currentUser() {
      return this.$store.state.currentUser
    }
  },
  created() {
    this.myId = (this.$store.state.currentUser || {}).id || 0
    this.loadHistory()
  },
  mounted() {
    this.connect()
  },
  beforeDestroy() {
    this.cleanup()
  },
  methods: {
    apiBase() {
      // /api/legacy 是官方适配层，自有 API 在 /api 下
      return this.$constant.baseURL.replace(/\/api\/legacy\/?$/, '/api')
    },
    token() {
      return localStorage.getItem('userToken') || ''
    },
    async loadHistory() {
      try {
        const res = await fetch(`${this.apiBase()}/im/messages?limit=40`)
        const j = await res.json()
        if (j.success) {
          this.messages = j.data.records || []
          this.scrollBottom()
        }
      } catch (e) { /* 忽略 */ }
      this.loading = false
    },
    connect() {
      const tk = this.token()
      if (!tk) {
        this.connected = false
        return
      }
      const base = this.apiBase().replace(/^http/, 'ws')
      const url = `${base}/im/ws?token=${encodeURIComponent(tk)}`
      try {
        this.ws = new WebSocket(url)
      } catch (e) {
        this.scheduleRetry()
        return
      }

      this.ws.onopen = () => {
        this.connected = true
        this.pingTimer = setInterval(() => {
          try { this.ws.send(JSON.stringify({ type: 'ping' })) } catch (e) {}
        }, 25000)
      }

      this.ws.onmessage = (evt) => {
        let data
        try { data = JSON.parse(evt.data) } catch (e) { return }
        // 后端广播时做过一次 JSON.stringify，可能拿到字符串
        if (typeof data === 'string') {
          try { data = JSON.parse(data) } catch (e) { return }
        }
        if (data.type === 'welcome') {
          this.onlineCount = data.count || 1
        } else if (data.type === 'message' && data.message) {
          if (!this.messages.some(m => m.id === data.message.id)) {
            this.messages.push(data.message)
            this.scrollBottom()
          }
        } else if (data.type === 'join' || data.type === 'leave') {
          this.onlineCount = data.count || this.onlineCount
        }
      }

      this.ws.onclose = () => {
        this.connected = false
        this.cleanup()
        this.scheduleRetry()
      }
      this.ws.onerror = () => {
        this.connected = false
      }
    },
    scheduleRetry() {
      if (this.retryTimer) return
      this.retryTimer = setTimeout(() => {
        this.retryTimer = null
        this.connect()
      }, 5000)
    },
    cleanup() {
      if (this.pingTimer) { clearInterval(this.pingTimer); this.pingTimer = null }
      if (this.ws) {
        try { this.ws.onclose = null; this.ws.close() } catch (e) {}
        this.ws = null
      }
    },
    async send() {
      const content = this.draft.trim()
      if (!content || !this.connected) return
      this.draft = ''
      try {
        const res = await fetch(`${this.apiBase()}/im/send`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.token()}`
          },
          body: JSON.stringify({ content })
        })
        const j = await res.json()
        if (!j.success) {
          this.$message({ message: j.error || '发送失败', type: 'error' })
          this.draft = content
        }
      } catch (e) {
        this.$message({ message: '网络错误', type: 'error' })
        this.draft = content
      }
    },
    scrollBottom() {
      this.$nextTick(() => {
        const el = this.$refs.body
        if (el) el.scrollTop = el.scrollHeight
      })
    },
    fmtTime(t) {
      if (!t) return ''
      const d = new Date(t)
      const diff = (Date.now() - d.getTime()) / 1000
      if (diff < 60) return '刚刚'
      if (diff < 3600) return Math.floor(diff / 60) + ' 分钟前'
      if (diff < 86400) return Math.floor(diff / 3600) + ' 小时前'
      return `${d.getMonth() + 1}-${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    }
  }
}
</script>

<style scoped>
.im-page {
  max-width: 820px;
  margin: 24px auto 40px;
  background: var(--background);
  border-radius: 12px;
  box-shadow: 0 2px 16px rgba(0, 0, 0, .06);
  display: flex;
  flex-direction: column;
  height: calc(100vh - 160px);
  min-height: 460px;
  overflow: hidden;
}
.im-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--borderColor);
}
.im-title { font-size: 16px; font-weight: 600; color: var(--fontColor); display: flex; align-items: center; }
.im-dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: #ccc; margin-right: 8px; transition: background .3s;
}
.im-dot.on { background: #4caf50; box-shadow: 0 0 0 3px rgba(76, 175, 80, .18); }
.im-online { font-size: 13px; color: var(--greyFont); }
.im-online.off { color: #e6a23c; }

.im-body {
  flex: 1;
  overflow-y: auto;
  padding: 18px 20px;
  background: var(--favoriteBg, #fafbfc);
}
.im-loading, .im-empty {
  text-align: center; color: var(--greyFont); font-size: 14px; padding: 60px 0;
}
.im-item { display: flex; gap: 10px; margin-bottom: 18px; }
.im-item.mine { flex-direction: row-reverse; }
.im-main { max-width: 74%; }
.im-item.mine .im-main { text-align: right; }
.im-meta { font-size: 12px; color: var(--greyFont); margin-bottom: 5px; }
.im-name { color: var(--themeBackground); margin-right: 8px; font-weight: 500; }
.im-text {
  display: inline-block;
  background: var(--background);
  border: 1px solid var(--borderColor);
  padding: 9px 13px;
  border-radius: 10px;
  font-size: 14px;
  line-height: 1.6;
  color: var(--fontColor);
  word-break: break-word;
  text-align: left;
}
.im-item.mine .im-text {
  background: var(--themeBackground);
  color: #fff;
  border-color: transparent;
}

.im-foot {
  border-top: 1px solid var(--borderColor);
  padding: 12px 20px;
  display: flex;
  gap: 10px;
  align-items: center;
}
.im-input {
  flex: 1;
  height: 40px;
  padding: 0 14px;
  border: 1px solid var(--borderColor);
  border-radius: 20px;
  outline: none;
  font-size: 14px;
  background: var(--favoriteBg, #fafbfc);
  color: var(--fontColor);
  transition: border-color .2s;
}
.im-input:focus { border-color: var(--themeBackground); }
.im-send {
  height: 40px;
  padding: 0 22px;
  border: none;
  border-radius: 20px;
  background: var(--themeBackground);
  color: #fff;
  font-size: 14px;
  cursor: pointer;
  transition: opacity .2s;
}
.im-send:disabled { opacity: .45; cursor: not-allowed; }
.im-login { width: 100%; text-align: center; font-size: 14px; color: var(--greyFont); padding: 6px 0; }

@media screen and (max-width: 768px) {
  .im-page { margin: 12px; height: calc(100vh - 140px); border-radius: 8px; }
  .im-main { max-width: 82%; }
}
</style>
