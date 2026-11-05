<template>
  <div class="tag-cloud-box shadow-box background-opacity wow">
    <div class="card-content2-title">
      <i class="el-icon-price-tag card-content2-icon"></i>
      <span>标签云</span>
    </div>

    <div class="cloud-stage" ref="stage" @mouseenter="paused = true" @mouseleave="paused = false">
      <div
        v-for="(item, i) in spheres"
        :key="item.id"
        class="cloud-item"
        :style="item.style"
        @click="goLabel(item)"
      >
        <div class="label-item" :style="{ borderColor: item.color, color: item.color }">
          <span class="icon-wrap">
            <svg viewBox="0 0 1024 1024" width="13" height="13">
              <path d="M179.2 153.6m89.6 0l588.8 0q89.6 0 89.6 89.6l0 486.4q0 89.6-89.6 89.6l-588.8 0q-89.6 0-89.6-89.6l0-486.4q0-89.6 89.6-89.6Z" fill="#FF9C55"/>
              <path d="M25.6 193.4208A91.0208 91.0208 0 0 1 116.6208 102.4H382.592a91.0208 91.0208 0 0 1 87.5008 65.9712l24.5504 85.7216h412.7488A91.0208 91.0208 0 0 1 998.4 345.1392v485.4528A91.0208 91.0208 0 0 1 907.3792 921.6H116.608A91.0208 91.0208 0 0 1 25.6 830.5792V193.408z" fill="#FFD977"/>
            </svg>
          </span>
          <span class="label-text">{{ item.labelName }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
/**
 * 3D 球形标签云
 *
 * 算法：把标签均匀分布在球面上（黄金螺旋），
 * 每帧按固定角速度绕 Y 轴旋转，再用透视投影算 2D 坐标与缩放。
 *
 * 前方的标签（z > 0）更大更不透明，后方的更小更淡，
 * 形成立体感。鼠标悬停暂停旋转，点击跳转到标签页。
 */
const COLORS = [
  '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7',
  '#dfe6e9', '#74b9ff', '#a29bfe', '#fd79a8', '#55efc4',
  '#fdcb6e', '#e17055', '#00b894', '#0984e3', '#6c5ce7'
]

export default {
  name: 'tagCloud',
  props: {
    labels: { type: Array, default: () => [] }
  },
  data() {
    return {
      paused: false,
      spheres: [],
      angleY: 0,
      angleX: 0,
      raf: null,
      radius: 100,
      stageW: 260
    }
  },
  watch: {
    labels: {
      immediate: true,
      handler(v) {
        this.init(v)
      }
    }
  },
  mounted() {
    this.measure()
    window.addEventListener('resize', this.measure)
    this.animate()
  },
  beforeDestroy() {
    if (this.raf) cancelAnimationFrame(this.raf)
    window.removeEventListener('resize', this.measure)
  },
  methods: {
    measure() {
      const el = this.$refs.stage
      if (!el) return
      const w = el.clientWidth || 260
      this.stageW = w
      // 半径随容器宽度自适应
      this.radius = Math.min(w, 260) * 0.38
    },

    /** 黄金螺旋均匀分布在球面 */
    init(list) {
      const n = (list || []).length
      if (!n) { this.spheres = []; return }

      const pts = []
      const offset = 2 / n
      const inc = Math.PI * (3 - Math.sqrt(5))   // 黄金角

      for (let i = 0; i < n; i++) {
        const y = i * offset - 1 + offset / 2
        const r = Math.sqrt(Math.max(0, 1 - y * y))
        const phi = i * inc
        pts.push({
          x: Math.cos(phi) * r,
          y,
          z: Math.sin(phi) * r
        })
      }

      this.spheres = list.map((lb, i) => ({
        id: lb.id,
        labelName: lb.labelName,
        count: lb.countOfLabel || 0,
        color: COLORS[i % COLORS.length],
        // 归一化坐标，渲染时乘半径
        nx: pts[i].x, ny: pts[i].y, nz: pts[i].z,
        style: {}
      }))
      this.render()
    },

    animate() {
      const step = () => {
        if (!this.paused) {
          this.angleY += 0.004
          this.angleX += 0.0012
          this.render()
        }
        this.raf = requestAnimationFrame(step)
      }
      this.raf = requestAnimationFrame(step)
    },

    render() {
      const cosY = Math.cos(this.angleY), sinY = Math.sin(this.angleY)
      const cosX = Math.cos(this.angleX), sinX = Math.sin(this.angleX)
      const R = this.radius
      const cx = this.stageW / 2
      const cy = 145
      const perspective = 600

      for (const s of this.spheres) {
        // 绕 Y 轴
        let x = s.nx * cosY - s.nz * sinY
        let z = s.nx * sinY + s.nz * cosY
        // 绕 X 轴
        let y = s.ny * cosX - z * sinX
        z = s.ny * sinX + z * cosX

        const X = x * R
        const Y = y * R
        const Z = z * R

        // 透视投影
        const scale = perspective / (perspective - Z)
        const px = cx + X * scale
        const py = cy + Y * scale
        // 深度：Z 越大越靠前
        const depth = (Z + R) / (2 * R)    // 0..1
        const opacity = 0.35 + depth * 0.65
        const sizeScale = 0.55 + depth * 0.55

        s.style = {
          transform: `translate3d(${px}px, ${py}px, 0) scale(${sizeScale})`,
          opacity: opacity,
          zIndex: Math.round(depth * 100)
        }
      }
    },

    goLabel(item) {
      // 标签名可能含引号/空格，交给路由自己处理
      const name = String(item.labelName || '').replace(/^"|"$/g, '')
      this.$router.push({ path: '/sort', query: { labelId: item.id } })
    }
  }
}
</script>

<style scoped>
.tag-cloud-box {
  padding: 20px 18px 10px;
  border-radius: 10px;
  margin-bottom: 20px;
  animation: hideToShow 1s ease-in-out;
}

.cloud-stage {
  position: relative;
  width: 100%;
  height: 290px;
  overflow: hidden;
}

.cloud-item {
  position: absolute;
  top: 0;
  left: 0;
  will-change: transform, opacity;
  /* 用 translate3d 定位元素中心，去掉自身宽高影响 */
  margin-left: -50%;
  cursor: pointer;
}

.label-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border: 1px solid;
  border-radius: 25px;
  font-size: 13px;
  line-height: 1.4;
  white-space: nowrap;
  background: rgba(255, 255, 255, .65);
  transition: all .3s ease-in-out;
  transform: translateX(-50%);
}

.label-item:hover {
  background: rgba(255, 255, 255, .95);
  box-shadow: 0 2px 10px rgba(0, 0, 0, .12);
}

.icon-wrap {
  display: inline-flex;
  align-items: center;
}

.label-text {
  max-width: 90px;
  overflow: hidden;
  text-overflow: ellipsis;
}

@media screen and (max-width: 1100px) {
  .cloud-stage { height: 250px; }
}
</style>
