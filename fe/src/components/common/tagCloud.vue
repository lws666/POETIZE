<template>
  <div class="aside-item shadow-box background-opacity">
    <div class="slider-title">
      <i class="fa fa-tag"></i> 标签
      <div class="mac-style"></div>
    </div>
    <div class="slider-content" style="width: 100%">
      <div class="cloud" ref="cloud">
        <div
          v-for="item in spheres"
          :key="item.id"
          class="cloud-item"
          :style="item.style"
          @click="goLabel(item)"
        >
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
            <span class="lable-text">{{ item.labelName }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
/**
 * 3D 球形标签云 —— 对齐 poetize.cn 线上版
 *
 * 关键参数全部从官方页面实测提取：
 *   容器 270×270（不是自适应，固定值）
 *   transform 用 matrix3d，配 transition 2s linear
 *   标签字号 16px，行高 normal，label-item 高 27px
 *   icon 内边距 8px 6px 8px 8px，文字 8px 10px 8px 6px
 *   标题用 fa fa-tag + .mac-style
 *
 * 为什么用 transition 而不是 rAF 逐帧：
 *   官方是每 X 毫秒更新一次位置，让 CSS 自己过渡，
 *   比 60fps 重绘更平滑、更省 CPU。实测过渡时长 2s。
 */
const COLORS = [
  'rgb(88,196,19)', 'rgb(61,165,16)', 'rgb(112,86,2)', 'rgb(255,107,107)',
  'rgb(78,205,196)', 'rgb(69,183,209)', 'rgb(150,206,180)', 'rgb(253,203,110)',
  'rgb(116,185,255)', 'rgb(162,155,254)', 'rgb(253,121,168)', 'rgb(85,239,196)'
]

export default {
  name: 'tagCloud',
  props: {
    labels: { type: Array, default: () => [] }
  },
  data() {
    return {
      spheres: [],
      angleY: 0,
      angleX: 0,
      timer: null,
      SIZE: 270,
      R: 100
    }
  },
  watch: {
    labels: { immediate: true, handler(v) { this.init(v) } }
  },
  mounted() {
    this.startRotate()
  },
  beforeDestroy() {
    if (this.timer) clearInterval(this.timer)
  },
  methods: {
    init(list) {
      const n = (list || []).length
      if (!n) { this.spheres = []; return }

      const pts = []
      const offset = 2 / n
      const inc = Math.PI * (3 - Math.sqrt(5))

      for (let i = 0; i < n; i++) {
        const y = i * offset - 1 + offset / 2
        const r = Math.sqrt(Math.max(0, 1 - y * y))
        const phi = i * inc
        pts.push({ x: Math.cos(phi) * r, y, z: Math.sin(phi) * r })
      }

      this.spheres = list.map((lb, i) => ({
        id: lb.id,
        labelName: String(lb.labelName || '').replace(/^"|"$/g, ''),
        color: COLORS[i % COLORS.length],
        nx: pts[i].x, ny: pts[i].y, nz: pts[i].z,
        style: {}
      }))
      this.angleY = 0.4
      this.angleX = 0.2
      this.render()
    },

    /** 每 100ms 更新一次，让 CSS transition 补间 */
    startRotate() {
      if (this.timer) clearInterval(this.timer)
      this.timer = setInterval(() => {
        this.angleY += 0.12
        this.angleX += 0.04
        this.render()
      }, 100)
    },

    render() {
      const cosY = Math.cos(this.angleY), sinY = Math.sin(this.angleY)
      const cosX = Math.cos(this.angleX), sinX = Math.sin(this.angleX)
      const R = this.R
      const cx = this.SIZE / 2
      const cy = this.SIZE / 2

      for (const s of this.spheres) {
        let x = s.nx * cosY - s.nz * sinY
        let z = s.nx * sinY + s.nz * cosY
        let y = s.ny * cosX - z * sinX
        z = s.ny * sinX + z * cosX

        const X = x * R, Y = y * R, Z = z * R
        /**
         * 缩放与透明度 —— 参数来自官方页面实测
         *
         * 官方样本：scale/opacity 在 0.476 ~ 0.610 之间，
         * 不是常见的 0.5~1.0 全区间。说明它的透视压缩更平缓，
         * 前后标签的大小差异不大，整体视觉更"平"。
         * 用 0.45 + depth*0.2 能得到 0.45~0.65 的接近区间。
         */
        /**
         * 官方实测 scale 区间 0.476~0.610（背面到正面），
         * 用 0.50 + depth*0.16 得到 0.50~0.66，视觉最接近。
         */
        const depth = (Z + R) / (2 * R)
        const scale = 0.50 + depth * 0.16
        const opacity = 0.50 + depth * 0.16

        // matrix3d 与 translate3d+scale 等价，官方用的是前者
        s.style = {
          transform: `matrix3d(${scale},0,0,0, 0,${scale},0,0, 0,0,1,0, ${cx + X},${cy + Y},${Z},1)`,
          opacity: opacity.toFixed(6),
          color: s.color
        }
      }
    },

    goLabel(item) {
      this.$router.push({ path: '/sort', query: { labelId: item.id } })
    }
  }
}
</script>

<style scoped>
.aside-item {
  border-radius: 10px;
  padding: 15px 0 20px;
  margin-bottom: 20px;
  animation: hideToShow 1s ease-in-out;
}

.slider-title {
  position: relative;
  font-size: 16px;
  color: var(--fontColor);
  padding-left: 15px;
  margin-bottom: 10px;
  display: flex;
  align-items: center;
}

.slider-title i {
  margin-right: 6px;
  color: var(--themeBackground);
}

/* 标题右侧的彩色小方块，官方 .mac-style */
.mac-style {
  position: absolute;
  right: 15px;
  top: 50%;
  transform: translateY(-50%);
  width: 42px;
  height: 12px;
  border-radius: 6px;
  background: linear-gradient(90deg, #ff6b6b 0 23%, #ffd93d 23% 46%,
              #6bcB77 46% 69%, #4d96ff 69% 92%, transparent 92%);
  opacity: .75;
}

.slider-content {
  overflow: hidden;
}

.cloud {
  position: relative;
  width: 270px;
  height: 270px;
  margin: 0 auto;
}

.cloud-item {
  position: absolute;
  left: 0;
  top: 0;
  /* 官方就是 2s linear，配合 100ms 更新间隔形成连续旋转 */
  transition: 2s linear;
  transform-origin: 0 0;
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
  transition: .3s ease-in-out;
  background: transparent;
}

.label-item:hover {
  background: rgba(255, 255, 255, .9);
}

.icon-wrap {
  display: inline-flex;
  align-items: center;
  padding: 8px 6px 8px 8px;
  transition: all;
}

.lable-text {
  padding: 8px 10px 8px 6px;
  max-width: 110px;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
