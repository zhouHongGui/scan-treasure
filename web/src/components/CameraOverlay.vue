<template>
  <div class="cam">
    <video ref="videoRef" class="cam__video" playsinline muted autoplay />
    <canvas ref="detectCanvasRef" class="cam__detect-canvas" />
    <div
      ref="scanWindowRef"
      class="cam__scan-window"
      :class="{
        'cam__scan-window--ok': detected,
        'cam__scan-window--capturing': autoCapturing,
      }"
      aria-hidden="true"
    >
      <span class="cam__corner cam__corner--tl" />
      <span class="cam__corner cam__corner--tr" />
      <span class="cam__corner cam__corner--br" />
      <span class="cam__corner cam__corner--bl" />
      <span v-if="!autoCapturing" class="cam__scan-line" />
    </div>

    <div class="cam__top">
      <button class="cam__icon-btn" @click="cancel"><van-icon name="cross" /></button>
      <span class="cam__title">文档扫描</span>
      <span class="cam__hint" :class="{ 'cam__hint--ok': detected }">
        {{ hintText }}
      </span>
    </div>

    <div class="cam__bottom">
      <p class="cam__tip">
        {{ autoCapturing ? '识别成功，正在生成扫描件…' : '将文档放入扫描框内，保持稳定后自动扫描' }}
      </p>
      <button
        class="cam__shutter"
        :class="{ 'cam__shutter--ready': ready && !errorText }"
        :disabled="!ready || !!errorText"
        @click="capture"
      >
        手动拍摄
      </button>
    </div>

    <div v-if="errorText" class="cam__error">
      <van-icon name="warning-o" size="44" color="#ee0a24" />
      <p class="cam__error-text">{{ errorText }}</p>
      <p v-if="errorSub" class="cam__error-sub">{{ errorSub }}</p>
      <van-button size="small" plain class="cam__error-btn" @click="cancel">关闭</van-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import { useCameraCapture } from '@/composables/useCameraCapture'
import { autoDetectCorners } from '@/composables/useImageProcess'
import type { Corner } from '@/utils/geometry'

const { close, consumeStream } = useCameraCapture()
const videoRef = ref<HTMLVideoElement | null>(null)
const detectCanvasRef = ref<HTMLCanvasElement | null>(null)
const scanWindowRef = ref<HTMLDivElement | null>(null)
const ready = ref(false)
const detected = ref(false)
const autoCapturing = ref(false)
const errorText = ref('')
const errorSub = ref('')
const hintText = computed(() => {
  if (autoCapturing.value) return '正在自动扫描'
  if (detected.value) return '已识别文档，保持稳定'
  return '将文档放入框内'
})

let stream: MediaStream | null = null
let detectTimer: ReturnType<typeof setInterval> | null = null
let autoCaptureTimer: ReturnType<typeof setTimeout> | null = null
let detectBusy = false
let stableHits = 0
let captureLocked = false
let lastNormalizedCorners: Corner[] | null = null
let stopped = false // 卸载后阻断异步 detectLoop 继续写状态

interface VideoRect {
  x: number
  y: number
  width: number
  height: number
}

function fail(text: string, sub: string): void {
  errorText.value = text
  errorSub.value = sub
}

onMounted(async () => {
  stream = consumeStream()
  if (!stream) {
    fail('摄像头未授权', '请重新点击扫描，并在系统或浏览器提示中允许摄像头权限。')
    return
  }

  try {
    const v = videoRef.value
    if (!v) return
    v.srcObject = stream
    await v.play()
    ready.value = true
    detectTimer = setInterval(detectLoop, 350)
    void detectLoop()
  } catch (e) {
    const name = e instanceof Error ? e.name : ''
    fail('无法启动摄像头', name ? `（${name}）` : '请检查摄像头权限与设备。')
  }
})

onBeforeUnmount(() => {
  stopped = true
  if (detectTimer) clearInterval(detectTimer)
  if (autoCaptureTimer) clearTimeout(autoCaptureTimer)
  stream?.getTracks().forEach((t) => t.stop())
  stream = null
})

/** 周期性检测：识别文档区域，连续稳定后自动拍摄 */
async function detectLoop(): Promise<void> {
  if (stopped || detectBusy || autoCapturing.value || captureLocked) return
  const v = videoRef.value
  if (!v || !v.videoWidth) return
  const crop = getScanWindowVideoRect(v)
  if (!crop) return
  detectBusy = true
  const longSide = 460
  const cropRatio = crop.width / crop.height
  const sw = cropRatio >= 1 ? longSide : Math.max(1, Math.round(longSide * cropRatio))
  const sh = cropRatio >= 1 ? Math.max(1, Math.round(longSide / cropRatio)) : longSide
  const c = document.createElement('canvas')
  c.width = sw
  c.height = sh
  const ctx = c.getContext('2d')
  if (!ctx) {
    detectBusy = false
    return
  }
  ctx.drawImage(v, crop.x, crop.y, crop.width, crop.height, 0, 0, sw, sh)
  try {
    const corners = await autoDetectCorners(c.toDataURL('image/jpeg', 0.78), {
      mode: 'document',
    })
    if (stopped) return
    if (corners && corners.length === 4) {
      const normalized = normalizeCropCorners(corners, sw, sh, crop, v.videoWidth, v.videoHeight)
      detected.value = true
      drawDetection(denormalizeCorners(normalized, v.videoWidth, v.videoHeight), v.videoWidth, v.videoHeight)
      stableHits = isStableDetection(normalized) ? stableHits + 1 : 1
      lastNormalizedCorners = normalized

      if (stableHits >= 3) {
        autoCapturing.value = true
        autoCaptureTimer = setTimeout(() => {
          if (!stopped) capture()
        }, 180)
      }
    } else {
      resetDetectionState()
    }
  } catch {
    resetDetectionState()
  } finally {
    detectBusy = false
  }
}

/** 拍摄当前帧（原始分辨率）→ 返回 dataUrl */
function capture(): void {
  if (captureLocked || stopped) return
  const v = videoRef.value
  if (!v || !v.videoWidth) return
  captureLocked = true
  const c = document.createElement('canvas')
  c.width = v.videoWidth
  c.height = v.videoHeight
  const ctx = c.getContext('2d')
  if (!ctx) {
    captureLocked = false
    return
  }
  ctx.drawImage(v, 0, 0)
  close({
    dataUrl: c.toDataURL('image/jpeg', 0.98),
    corners: getCaptureCorners(v),
  })
}

function resetDetectionState(): void {
  detected.value = false
  stableHits = 0
  lastNormalizedCorners = null
  clearDetectionCanvas()
}

function normalizeCropCorners(
  corners: Corner[],
  sourceW: number,
  sourceH: number,
  crop: VideoRect,
  videoW: number,
  videoH: number,
): Corner[] {
  return corners.map((p) => ({
    x: (crop.x + (p.x / sourceW) * crop.width) / videoW,
    y: (crop.y + (p.y / sourceH) * crop.height) / videoH,
  }))
}

function isStableDetection(current: Corner[]): boolean {
  if (!lastNormalizedCorners) return false

  const drift =
    current.reduce((sum, p, i) => {
      const prev = lastNormalizedCorners?.[i]
      if (!prev) return sum + 1
      return sum + Math.hypot(p.x - prev.x, p.y - prev.y)
    }, 0) / current.length

  return drift < 0.035
}

function getCaptureCorners(v: HTMLVideoElement): Corner[] {
  if (lastNormalizedCorners && isUsableNormalizedCorners(lastNormalizedCorners)) {
    return denormalizeCorners(lastNormalizedCorners, v.videoWidth, v.videoHeight)
  }

  const crop = getScanWindowVideoRect(v)
  if (crop) {
    return [
      { x: crop.x, y: crop.y },
      { x: crop.x + crop.width, y: crop.y },
      { x: crop.x + crop.width, y: crop.y + crop.height },
      { x: crop.x, y: crop.y + crop.height },
    ]
  }

  return [
    { x: 0, y: 0 },
    { x: v.videoWidth, y: 0 },
    { x: v.videoWidth, y: v.videoHeight },
    { x: 0, y: v.videoHeight },
  ]
}

function isUsableNormalizedCorners(corners: Corner[]): boolean {
  const xs = corners.map((p) => p.x)
  const ys = corners.map((p) => p.y)
  const left = Math.min(...xs)
  const right = Math.max(...xs)
  const top = Math.min(...ys)
  const bottom = Math.max(...ys)
  const w = right - left
  const h = bottom - top
  const area = w * h
  if (w < 0.28 || h < 0.22 || area < 0.12) return false
  return !(left < 0.035 && top < 0.035 && right > 0.965 && bottom > 0.965)
}

function denormalizeCorners(corners: Corner[], w: number, h: number): Corner[] {
  return corners.map((p) => ({ x: p.x * w, y: p.y * h }))
}

function getScanWindowVideoRect(v: HTMLVideoElement): VideoRect | null {
  const scanWindow = scanWindowRef.value
  if (!scanWindow || !v.videoWidth || !v.videoHeight) return null

  const videoRect = v.getBoundingClientRect()
  const scanRect = scanWindow.getBoundingClientRect()
  const cssW = videoRect.width
  const cssH = videoRect.height
  if (!cssW || !cssH) return null

  const sourceRatio = v.videoWidth / v.videoHeight
  const viewRatio = cssW / cssH
  let drawW = cssW
  let drawH = cssH
  let offsetX = 0
  let offsetY = 0
  if (sourceRatio > viewRatio) {
    drawH = cssH
    drawW = cssH * sourceRatio
    offsetX = (cssW - drawW) / 2
  } else {
    drawW = cssW
    drawH = cssW / sourceRatio
    offsetY = (cssH - drawH) / 2
  }

  const left = clamp((scanRect.left - videoRect.left - offsetX) / drawW, 0, 1)
  const top = clamp((scanRect.top - videoRect.top - offsetY) / drawH, 0, 1)
  const right = clamp((scanRect.right - videoRect.left - offsetX) / drawW, 0, 1)
  const bottom = clamp((scanRect.bottom - videoRect.top - offsetY) / drawH, 0, 1)
  const x = Math.floor(left * v.videoWidth)
  const y = Math.floor(top * v.videoHeight)
  const rightPx = Math.ceil(right * v.videoWidth)
  const bottomPx = Math.ceil(bottom * v.videoHeight)
  const width = Math.max(1, Math.min(v.videoWidth - x, rightPx - x))
  const height = Math.max(1, Math.min(v.videoHeight - y, bottomPx - y))
  return { x, y, width, height }
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

function drawDetection(corners: Corner[], sourceW: number, sourceH: number): void {
  const canvas = detectCanvasRef.value
  const v = videoRef.value
  if (!canvas || !v) return

  const rect = canvas.getBoundingClientRect()
  const cssW = rect.width
  const cssH = rect.height
  if (!cssW || !cssH) return

  const dpr = window.devicePixelRatio || 1
  canvas.width = Math.round(cssW * dpr)
  canvas.height = Math.round(cssH * dpr)

  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, cssW, cssH)

  const sourceRatio = sourceW / sourceH
  const viewRatio = cssW / cssH
  let drawW = cssW
  let drawH = cssH
  let offsetX = 0
  let offsetY = 0
  if (sourceRatio > viewRatio) {
    drawH = cssH
    drawW = cssH * sourceRatio
    offsetX = (cssW - drawW) / 2
  } else {
    drawW = cssW
    drawH = cssW / sourceRatio
    offsetY = (cssH - drawH) / 2
  }

  const points = corners.map((p) => ({
    x: offsetX + (p.x / sourceW) * drawW,
    y: offsetY + (p.y / sourceH) * drawH,
  }))

  ctx.save()
  ctx.lineWidth = 3
  ctx.strokeStyle = '#18c3a8'
  ctx.shadowColor = 'rgba(24, 195, 168, 0.8)'
  ctx.shadowBlur = 14
  ctx.beginPath()
  ctx.moveTo(points[0].x, points[0].y)
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y)
  ctx.closePath()
  ctx.stroke()
  ctx.restore()

  ctx.fillStyle = '#18c3a8'
  for (const p of points) {
    ctx.beginPath()
    ctx.arc(p.x, p.y, 5, 0, Math.PI * 2)
    ctx.fill()
  }
}

function clearDetectionCanvas(): void {
  const canvas = detectCanvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, canvas.width, canvas.height)
}

function cancel(): void {
  close(null)
}
</script>

<style scoped>
.cam {
  position: fixed;
  inset: 0;
  z-index: 2000;
  background: #000;
  display: flex;
  flex-direction: column;
  height: 100svh;
  overflow: hidden;
  touch-action: none;
  user-select: none;
}

.cam__video {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cam__detect-canvas {
  position: absolute;
  inset: 0;
  z-index: 2;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.cam__scan-window {
  position: absolute;
  z-index: 1;
  top: 50%;
  left: 50%;
  width: 95vw;
  height: 95svh;
  transform: translate(-50%, -50%);
  border-radius: 18px;
  box-shadow:
    0 0 0 9999px rgba(0, 0, 0, 0.36),
    inset 0 0 0 1px rgba(255, 255, 255, 0.14);
  overflow: hidden;
  transition:
    box-shadow 0.2s ease,
    transform 0.2s ease;
}

.cam__scan-window--ok {
  box-shadow:
    0 0 0 9999px rgba(0, 0, 0, 0.28),
    0 0 34px rgba(24, 195, 168, 0.32),
    inset 0 0 0 1px rgba(24, 195, 168, 0.24);
}

.cam__scan-window--capturing {
  transform: translate(-50%, -50%) scale(0.985);
  box-shadow:
    0 0 0 9999px rgba(0, 0, 0, 0.45),
    0 0 42px rgba(24, 195, 168, 0.45),
    inset 0 0 0 1px rgba(24, 195, 168, 0.4);
}

.cam__corner {
  position: absolute;
  width: 38px;
  height: 38px;
  border-color: rgba(255, 255, 255, 0.94);
  transition: border-color 0.2s ease;
}

.cam__scan-window--ok .cam__corner,
.cam__scan-window--capturing .cam__corner {
  border-color: #18c3a8;
}

.cam__corner--tl {
  top: 0;
  left: 0;
  border-top: 4px solid;
  border-left: 4px solid;
  border-top-left-radius: 18px;
}

.cam__corner--tr {
  top: 0;
  right: 0;
  border-top: 4px solid;
  border-right: 4px solid;
  border-top-right-radius: 18px;
}

.cam__corner--br {
  right: 0;
  bottom: 0;
  border-right: 4px solid;
  border-bottom: 4px solid;
  border-bottom-right-radius: 18px;
}

.cam__corner--bl {
  bottom: 0;
  left: 0;
  border-bottom: 4px solid;
  border-left: 4px solid;
  border-bottom-left-radius: 18px;
}

.cam__scan-line {
  position: absolute;
  left: 18px;
  right: 18px;
  top: 18px;
  height: 2px;
  border-radius: 999px;
  background: linear-gradient(90deg, transparent, rgba(24, 195, 168, 0.95), transparent);
  box-shadow: 0 0 18px rgba(24, 195, 168, 0.72);
  animation: cam-scan-line 1.85s ease-in-out infinite;
}

@keyframes cam-scan-line {
  0% {
    transform: translateY(0);
    opacity: 0.2;
  }
  12% {
    opacity: 1;
  }
  88% {
    opacity: 1;
  }
  100% {
    transform: translateY(calc(95svh - 38px));
    opacity: 0.2;
  }
}

@media (orientation: landscape) {
  .cam__scan-window {
    width: 95vw;
    height: 95svh;
  }

  @keyframes cam-scan-line {
    0% {
      transform: translateY(0);
      opacity: 0.2;
    }
    12% {
      opacity: 1;
    }
    88% {
      opacity: 1;
    }
    100% {
      transform: translateY(calc(95svh - 38px));
      opacity: 0.2;
    }
  }
}

.cam__top {
  position: relative;
  z-index: 3;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: calc(14px + env(safe-area-inset-top)) 16px 12px;
}
.cam__icon-btn {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  border: none;
  background: rgba(0, 0, 0, 0.45);
  color: #fff;
  font-size: 18px;
  display: grid;
  place-items: center;
  cursor: pointer;
  flex: 0 0 auto;
}

.cam__title {
  color: #fff;
  font-size: 17px;
  font-weight: 700;
  text-shadow: 0 1px 12px rgba(0, 0, 0, 0.45);
  flex: 1;
}

.cam__hint {
  max-width: 42vw;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.85);
  background: rgba(0, 0, 0, 0.42);
  padding: 6px 14px;
  border-radius: 999px;
  transition: background 0.2s ease, color 0.2s ease;
}
.cam__hint--ok {
  background: rgba(24, 195, 168, 0.9);
  color: #fff;
  font-weight: 600;
}

.cam__bottom {
  position: relative;
  z-index: 3;
  margin-top: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 22px 16px calc(28px + env(safe-area-inset-bottom));
  background: linear-gradient(180deg, transparent, rgba(0, 0, 0, 0.68));
}
.cam__tip {
  max-width: 320px;
  min-height: 21px;
  font-size: 14px;
  line-height: 1.5;
  color: rgba(255, 255, 255, 0.86);
  text-align: center;
  text-shadow: 0 1px 12px rgba(0, 0, 0, 0.55);
}
.cam__shutter {
  position: relative;
  min-width: 104px;
  height: 38px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.24);
  background: rgba(0, 0, 0, 0.36);
  color: rgba(255, 255, 255, 0.9);
  padding: 0 18px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  transition:
    transform 0.1s ease,
    background 0.16s ease,
    border-color 0.16s ease;
}
.cam__shutter:active {
  transform: scale(0.96);
}
.cam__shutter:disabled {
  opacity: 0.4;
}
.cam__shutter--ready {
  border-color: rgba(255, 255, 255, 0.34);
  background: rgba(255, 255, 255, 0.14);
}

.cam__error {
  position: absolute;
  inset: 0;
  z-index: 4;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  text-align: center;
  padding: 32px;
  background: rgba(0, 0, 0, 0.92);
  color: #fff;
}
.cam__error-text {
  font-size: 15px;
  font-weight: 600;
}
.cam__error-sub {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.65);
  line-height: 1.6;
  max-width: 300px;
}
.cam__error-btn {
  margin-top: 8px;
}
</style>
