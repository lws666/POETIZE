import Vue from 'vue'
import App from './App.vue'
import router from './router'
import store from './store'
import ElementUI from 'element-ui'
import http from './utils/request'
import common from './utils/common'
import constant from './utils/constant'

/**
 * 站长 userId 兜底。
 *
 * constant.js 写死 userId: 1，本项目 admin 是 id=14。
 * home.vue 会从 sysConfig 拿到真实 id 并写 localStorage，
 * 但直接访问 /jotting 等页面时 home.vue 还没执行，
 * 这里在启动时先读一次缓存，避免「+」按钮不显示。
 */
const cachedBossUserId = localStorage.getItem('bossUserId')
if (cachedBossUserId) {
  constant.userId = Number(cachedBossUserId)
}
import mavonEditor from 'mavon-editor'
//引入js
import './utils/live2d'
import './utils/title'
//引入css
import './assets/css/animation.css'
import './assets/css/index.css'
import './assets/css/tocbot.css'
import './assets/css/color.css'
import './assets/css/markdown-highlight.css'
import './assets/css/font-awesome.min.css'
import 'mavon-editor/dist/css/index.css'

import {vueBaberrage} from 'vue-baberrage'

Vue.use(ElementUI)
Vue.use(vueBaberrage)
Vue.use(mavonEditor)

Vue.prototype.$http = http
Vue.prototype.$common = common
Vue.prototype.$constant = constant

Vue.config.productionTip = false

new Vue({
  router,
  store,
  render: h => h(App)
}).$mount('#app')
