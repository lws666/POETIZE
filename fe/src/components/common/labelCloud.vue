<template>
  <div class="cloud-wrap">
    <div
      ref="lablelCloud"
      class="cloud"
      :style="{ width: width, height: height }"
      @mousemove="listener"
    >
      <div
        v-for="item in clouds"
        :key="item.text"
        class="cloud-item"
        :style="{
          transform: 'translate3d(' + item.x + 'px,' + item.y + 'px,' + item.z + 'px) scale(' + (400 + item.z) / 600 + ')',
          opacity: (400 + item.z) / 600,
          color: item.color
        }"
        @click="handleTag(item)"
      >
        <slot :item="item">
          <div class="label-item" :style="{ border: '1px solid ' + item.color }">
            <span class="icon-wrap">
              <i style="vertical-align: -1px;">
                <svg viewBox="0 0 1024 1024" width="15" height="15">
                  <path d="M179.2 153.6m89.6 0l588.8 0q89.6 0 89.6 89.6l0 486.4q0 89.6-89.6 89.6l-588.8 0q-89.6 0-89.6-89.6l0-486.4q0-89.6 89.6-89.6Z" fill="#FF9C55"/>
                  <path d="M25.6 193.4208A91.0208 91.0208 0 0 1 116.6208 102.4H382.592a91.0208 91.0208 0 0 1 87.5008 65.9712l24.5504 85.7216h412.7488A91.0208 91.0208 0 0 1 998.4 345.1392v485.4528A91.0208 91.0208 0 0 1 907.3792 921.6H116.608A91.0208 91.0208 0 0 1 25.6 830.5792V193.408z" fill="#FFD977"/>
                  <path d="M128 665.6m25.6 0l76.8 0q25.6 0 25.6 25.6l0 0q0 25.6-25.6 25.6l-76.8 0q-25.6 0-25.6-25.6l0 0q0-25.6 25.6-25.6Z" fill="#FFF1C9"/>
                  <path d="M128 768m25.6 0l179.2 0q25.6 0 25.6 25.6l0 0q0 25.6-25.6 25.6l-179.2 0q-25.6 0-25.6-25.6l0 0q0-25.6 25.6-25.6Z" fill="#FFF1C9"/>
                  <path d="M128 486.4m51.2 0l0 0q51.2 0 51.2 51.2l0 0q0 51.2-51.2 51.2l0 0q-51.2 0-51.2-51.2l0 0q0-51.2 51.2-51.2Z" fill="#FFA86A"/>
                </svg>
              </i>
            </span>
            <span class="lable-text">{{ item.text }}</span>
          </div>
        </slot>
      </div>
    </div>
  </div>
</template>

<script>
/**
 * 3D 球形标签云 —— 从 poetize.cn 逆向还原
 *
 * 源码位置：https://poetize.cn/js/7304.402972f9.js
 *           webpack chunk 0x1c88（a86E 字符串解密后提取）
 *
 * 官方算法（逐字对应）：
 *   props:  tags[] / width='100%' / height='100%' / radius='120'
 *   speedX = speedY = Math.PI / 360
 *   CX = refs.lablelCloud.offsetWidth / 3.2
 *   CY = refs.lablelCloud.offsetHeight / 2.5
 *   timer: setInterval(20ms) → rotateX(speedX) + rotateY(speedY)
 *
 *   createTags(): 斐波那契球面分布
 *     Q = (2*(i+1) - 1) / n - 1
 *     G = acos(Q)
 *     x = CX + r * sin(G) * cos(G * sqrt(n * PI))
 *     y = CY + r * sin(G) * sin(G * sqrt(n * PI))
 *     z = r * cos(G)
 *
 *   渲染：translate3d(x, y, z) scale((400+z)/600)
 *        opacity = (400+z)/600
 *        注意 z 是绝对值（-120~120），所以 scale 区间是 0.467~0.867
 *
 *   listener(mousemove): 根据鼠标位置调整旋转速度
 *     l = 0.00002 * radius
 *     speedX = clamp(0.0001 * (clientX - CX), ±l)
 *     speedY = clamp(0.0001 * (clientY - CY), ±l)
 *
 * 关键细节：官方定时器是 20ms 而不是 100ms，
 * 且没有 CSS transition，靠高频重绘实现平滑。
 */
export default {
  name: 'labelCloud',
  props: {
    tags: { type: Array, default: () => [] },
    width: { type: String, default: '100%' },
    height: { type: String, default: '100%' },
    radius: { type: String, default: '120' }
  },
  data() {
    return {
      clouds: [],
      speedX: Math.PI / 360,
      speedY: Math.PI / 360,
      timer: null
    }
  },
  /**
   * CX / CY 不用 computed —— 官方用 computed，但那是建立在
   * 组件首次渲染前 $refs 已存在的前提下。
   * 实测本项目里 computed 会在 mounted 之前求值，
   * $refs.lablelCloud 为 undefined，导致坐标算成 NaN。
   *
   * 改成方法，在 mounted 之后调用，配合 nextTick 确保 DOM 已挂载。
   */
  computed: {},
  mounted() {
    this.$nextTick(() => {
      this.clouds = this.createTags()
    })
    this.timer = setInterval(() => {
      // clouds 还没算出来时跳过，避免对空数组做旋转
      if (!this.clouds.length) return
      this.rotateX(this.speedX)
      this.rotateY(this.speedY)
    }, 20)
  },
  beforeDestroy() {
    if (this.timer) clearInterval(this.timer)
  },
  methods: {
    /** 球心 X（容器宽 / 3.2） */
    getCX() {
      const el = this.$refs.lablelCloud
      return el ? el.offsetWidth / 3.2 : 0
    },

    /** 球心 Y（容器高 / 2.5） */
    getCY() {
      const el = this.$refs.lablelCloud
      return el ? el.offsetHeight / 2.5 : 0
    },

    handleTag(item) {
      this.$emit('tagClick', item)
    },

    /** 斐波那契球面均匀分布 */
    createTags() {
      const tags = []
      const { tags: list, radius } = this
      for (let i = 0, n = list.length; i < n; i++) {
        const phi = Math.acos((2 * (i + 1) - 1) / n - 1)
        const theta = phi * Math.sqrt(n * Math.PI)
        const x = this.getCX() + Number(radius) * Math.sin(phi) * Math.cos(theta)
        const y = this.getCY() + Number(radius) * Math.sin(phi) * Math.sin(theta)
        const z = Number(radius) * Math.cos(phi)

        tags.push({
          x, y, z,
          text: list[i].labelName,
          color: this.$common.getRandomColor(),
          sortId: list[i].sortId,
          labelId: list[i].id
        })
      }
      return tags
    },

    /** 绕 X 轴旋转 */
    rotateX(angle) {
      const cos = Math.cos(angle)
      const sin = Math.sin(angle)
      this.clouds.forEach(item => {
        const y = (item.y - this.getCY()) * cos - item.z * sin + this.getCY()
        const z = item.z * cos + (item.y - this.getCY()) * sin
        item.y = y
        item.z = z
      })
    },

    /** 绕 Y 轴旋转 */
    rotateY(angle) {
      const cos = Math.cos(angle)
      const sin = Math.sin(angle)
      this.clouds.forEach(item => {
        const x = (item.x - this.getCX()) * cos - item.z * sin + this.getCX()
        const z = item.z * cos + (item.x - this.getCX()) * sin
        item.x = x
        item.z = z
      })
    },

    /** 鼠标移动时改变旋转速度与方向 */
    listener(e) {
      const x = e.clientX - this.getCX()
      const y = e.clientY - this.getCY()
      const max = 0.00002 * Number(this.radius)

      this.speedX = 0.0001 * x > 0
        ? Math.min(max, 0.0001 * x)
        : Math.max(-max, 0.0001 * x)

      this.speedY = 0.0001 * y > 0
        ? Math.min(max, 0.0001 * y)
        : Math.max(-max, 0.0001 * y)
    }
  }
}
</script>

<style scoped>
.cloud {
  position: relative;
  margin: 0 auto;
  overflow: hidden;
}

.cloud-item {
  position: absolute;
  left: 0;
  top: 0;
  cursor: pointer;
  will-change: transform, opacity;
}

.label-item {
  display: flex;
  align-items: center;
  height: 27px;
  box-sizing: border-box;
  border-radius: 25px;
  overflow: hidden;
  font-size: 16px;
  line-height: normal;
  color: #fff;
  white-space: nowrap;
  background: transparent;
}

.icon-wrap {
  display: inline-flex;
  align-items: center;
  padding: 8px 6px 8px 8px;
}

.lable-text {
  padding: 8px 10px 8px 6px;
  max-width: 110px;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
