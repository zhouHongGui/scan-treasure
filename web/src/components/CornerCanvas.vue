<template>
  <div ref="wrapRef" class="corner-canvas">
    <canvas ref="canvasRef" class="corner-canvas__canvas" />
    <div
      v-for="(c, i) in displayCorners"
      :key="i"
      class="corner-canvas__handle"
      :style="{ transform: `translate(${c.x}px, ${c.y}px)` }"
      @touchstart.prevent="onTouchStart($event, i)"
      @mousedown.prevent="onMouseDown($event, i)"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import type { Corner } from '@/utils/geometry'

const props = defineProps<{
  src: string
  corners: Corner[]
  imgWidth: number
  imgHeight: number
  /** 图片相对画布的安全内边距（CSS 像素），让四角手柄不贴边、不被裁切 */
  pad?: number
}>()
const emit = defineEmits<{
  'update:corners': [Corner[]]
}>()

const wrapRef = ref<HTMLDivElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)

let img = new Image()
let imgLoaded = false

// contain 显示参数（CSS 像素空间）
let drawW = 0
let drawH = 0
let offsetX = 0
let offsetY = 0
let scale = 1
let dpr = 1
let wrapW = 0
let wrapH = 0
const layoutVersion = ref(0)

/** 角点的显示坐标（图片像素 → 画布显示像素） */
const displayCorners = computed(() => {
  layoutVersion.value
  return props.corners.map((c) => ({
    x: offsetX + c.x * scale,
    y: offsetY + c.y * scale,
  }))
})

function computeLayout(): void {
  const wrap = wrapRef.value
  const canvas = canvasRef.value
  if (!wrap || !canvas) return

  wrapW = wrap.clientWidth
  wrapH = wrap.clientHeight
  // 预留安全边距，图片内缩后四角手柄不会贴到画布边缘被裁
  const pad = props.pad || 0
  const availW = Math.max(1, wrapW - pad * 2)
  const availH = Math.max(1, wrapH - pad * 2)
  const imgRatio = props.imgWidth / props.imgHeight
  const availRatio = availW / availH

  if (imgRatio > availRatio) {
    drawW = availW
    drawH = availW / imgRatio
  } else {
    drawH = availH
    drawW = availH * imgRatio
  }
  offsetX = (wrapW - drawW) / 2
  offsetY = (wrapH - drawH) / 2
  scale = drawW / props.imgWidth

  dpr = window.devicePixelRatio || 1
  canvas.width = Math.round(wrapW * dpr)
  canvas.height = Math.round(wrapH * dpr)
  canvas.style.width = wrapW + 'px'
  canvas.style.height = wrapH + 'px'
  layoutVersion.value++
}

function draw(): void {
  const canvas = canvasRef.value
  if (!canvas || !imgLoaded) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.save()
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, wrapW, wrapH)

  // 1. 图片（contain 居中）
  ctx.drawImage(img, offsetX, offsetY, drawW, drawH)

  // 2. 遮罩：半透明黑覆盖 + evenodd 镂空四边形
  const dc = displayCorners.value
  if (dc.length !== 4) return
  ctx.fillStyle = 'rgba(0,0,0,0.5)'
  ctx.beginPath()
  ctx.rect(0, 0, wrapW, wrapH)
  ctx.moveTo(dc[0].x, dc[0].y)
  for (let i = 1; i < 4; i++) ctx.lineTo(dc[i].x, dc[i].y)
  ctx.closePath()
  ctx.fill('evenodd')

  // 3. 四边形边线
  ctx.strokeStyle = '#2f6fed'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(dc[0].x, dc[0].y)
  for (let i = 1; i < 4; i++) ctx.lineTo(dc[i].x, dc[i].y)
  ctx.closePath()
  ctx.stroke()

  ctx.restore()
}

let rafId = 0
function scheduleDraw(): void {
  if (rafId) return
  rafId = requestAnimationFrame(() => {
    rafId = 0
    draw()
  })
}

/** 显示坐标（相对容器）→ 图片像素坐标，并 clamp 到图内 */
function displayToImg(x: number, y: number): Corner {
  return {
    x: Math.max(0, Math.min(props.imgWidth, (x - offsetX) / scale)),
    y: Math.max(0, Math.min(props.imgHeight, (y - offsetY) / scale)),
  }
}

// ---- 拖拽 ----
let dragIndex = -1

function startDrag(i: number): void {
  dragIndex = i
  window.addEventListener('touchmove', onTouchMove, { passive: false })
  window.addEventListener('touchend', endDrag)
  window.addEventListener('touchcancel', endDrag)
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', endDrag)
}
function onTouchStart(_e: TouchEvent, i: number): void {
  startDrag(i)
}
function onMouseDown(_e: MouseEvent, i: number): void {
  startDrag(i)
}
function getPos(e: TouchEvent | MouseEvent): { x: number; y: number } {
  const rect = wrapRef.value!.getBoundingClientRect()
  const cx = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX
  const cy = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY
  return { x: cx - rect.left, y: cy - rect.top }
}
function onTouchMove(e: TouchEvent): void {
  e.preventDefault()
  moveDrag(e)
}
function onMouseMove(e: MouseEvent): void {
  moveDrag(e)
}
function moveDrag(e: TouchEvent | MouseEvent): void {
  if (dragIndex < 0) return
  const { x, y } = getPos(e)
  const next = [...props.corners]
  next[dragIndex] = displayToImg(x, y)
  emit('update:corners', next)
}
function endDrag(): void {
  dragIndex = -1
  window.removeEventListener('touchmove', onTouchMove)
  window.removeEventListener('touchend', endDrag)
  window.removeEventListener('touchcancel', endDrag)
  window.removeEventListener('mousemove', onMouseMove)
  window.removeEventListener('mouseup', endDrag)
}

// ---- 生命周期 ----
let ro: ResizeObserver | null = null

onMounted(() => {
  img = new Image()
  img.onload = () => {
    imgLoaded = true
    computeLayout()
    scheduleDraw()
  }
  img.src = props.src

  ro = new ResizeObserver(() => {
    computeLayout()
    scheduleDraw()
  })
  if (wrapRef.value) ro.observe(wrapRef.value)
})

watch(
  () => props.corners,
  () => nextTick(scheduleDraw),
  { deep: true },
)

onBeforeUnmount(() => {
  ro?.disconnect()
  endDrag()
  if (rafId) cancelAnimationFrame(rafId)
})
</script>

<style scoped>
.corner-canvas {
  position: relative;
  width: 100%;
  height: 100%;
  background: #000;
  touch-action: none; /* 阻止拖拽时浏览器默认手势 */
}
.corner-canvas__canvas {
  display: block;
  width: 100%;
  height: 100%;
}
.corner-canvas__handle {
  position: absolute;
  top: 0;
  left: 0;
  width: 26px;
  height: 26px;
  margin: -13px 0 0 -13px;
  border-radius: 50%;
  background: var(--ss-primary-grad);
  border: 2px solid #fff;
  box-shadow:
    0 0 0 6px rgba(47, 111, 237, 0.22),
    0 2px 8px rgba(0, 0, 0, 0.5);
  z-index: 2;
  cursor: pointer;
  touch-action: none;
}
</style>
