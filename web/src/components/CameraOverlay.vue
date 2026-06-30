<template>
  <div class="cam">
    <video ref="videoRef" class="cam__video" playsinline muted autoplay />
    <!-- 取景引导框（静态，提示把文档放进来） -->
    <div class="cam__guide" :class="{ 'cam__guide--ok': detected }" />

    <div class="cam__top">
      <button class="cam__icon-btn" @click="cancel"><van-icon name="cross" /></button>
      <span class="cam__hint" :class="{ 'cam__hint--ok': detected }">
        {{ detected ? '已检测到文档' : '将文档放入框内' }}
      </span>
      <span class="cam__icon-btn cam__icon-btn--ghost" />
    </div>

    <div class="cam__bottom">
      <p class="cam__tip">对准文档，尽量铺满、拍正</p>
      <button
        class="cam__shutter"
        :class="{ 'cam__shutter--ready': ready && !errorText }"
        :disabled="!ready || !!errorText"
        @click="capture"
      >
        <span class="cam__shutter-inner" />
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
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useCameraCapture } from '@/composables/useCameraCapture'
import { autoDetectCorners } from '@/composables/useImageProcess'

const { close } = useCameraCapture()
const videoRef = ref<HTMLVideoElement | null>(null)
const ready = ref(false)
const detected = ref(false)
const errorText = ref('')
const errorSub = ref('')

let stream: MediaStream | null = null
let detectTimer: ReturnType<typeof setInterval> | null = null
let stopped = false // 卸载后阻断异步 detectLoop 继续写状态

function fail(text: string, sub: string): void {
  errorText.value = text
  errorSub.value = sub
}

onMounted(async () => {
  if (!navigator.mediaDevices?.getUserMedia) {
    fail('当前环境不支持摄像头', '网页需在 HTTPS 或 localhost 下打开。')
    return
  }
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' } },
      audio: false,
    })
    const v = videoRef.value
    if (!v) return
    v.srcObject = stream
    await v.play()
    ready.value = true
    detectTimer = setInterval(detectLoop, 600)
  } catch (e) {
    const name = e instanceof Error ? e.name : ''
    if (
      name === 'NotFoundError' ||
      name === 'DevicesNotFoundError' ||
      name === 'OverconstrainedError'
    ) {
      fail(
        '未找到摄像头',
        '本设备可能没有摄像头，或正被占用。请在带摄像头的设备上使用（手机可用 HTTPS 网页或 App 扫描）。',
      )
    } else if (name === 'NotAllowedError' || name === 'SecurityError') {
      fail('摄像头权限被拒绝', '请允许摄像头权限；网页需在 HTTPS 或 localhost 下打开。')
    } else if (name === 'NotReadableError') {
      fail('摄像头被占用', '请关闭其它正在使用摄像头的程序后重试。')
    } else {
      fail('无法访问摄像头', name ? `（${name}）` : '请检查摄像头权限与设备。')
    }
  }
})

onBeforeUnmount(() => {
  stopped = true
  if (detectTimer) clearInterval(detectTimer)
  stream?.getTracks().forEach((t) => t.stop())
  stream = null
})

/** 周期性轻量检测：当前画面里有没有文档大小的主体，点亮"已检测到"提示 */
async function detectLoop(): Promise<void> {
  if (stopped) return
  const v = videoRef.value
  if (!v || !v.videoWidth) return
  const sw = 200
  const sh = Math.max(1, Math.round((sw * v.videoHeight) / v.videoWidth))
  const c = document.createElement('canvas')
  c.width = sw
  c.height = sh
  const ctx = c.getContext('2d')
  if (!ctx) return
  ctx.drawImage(v, 0, 0, sw, sh)
  try {
    const corners = await autoDetectCorners(c.toDataURL('image/jpeg', 0.7))
    if (stopped) return
    detected.value = !!corners && corners.length === 4
  } catch {
    /* 检测异常忽略，不影响拍摄 */
  }
}

/** 拍摄当前帧（原始分辨率）→ 返回 dataUrl */
function capture(): void {
  const v = videoRef.value
  if (!v || !v.videoWidth) return
  const c = document.createElement('canvas')
  c.width = v.videoWidth
  c.height = v.videoHeight
  const ctx = c.getContext('2d')
  if (!ctx) return
  ctx.drawImage(v, 0, 0)
  close(c.toDataURL('image/jpeg', 0.95))
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
}

.cam__video {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* 取景引导框 */
.cam__guide {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 86%;
  aspect-ratio: 1.585 / 1;
  transform: translate(-50%, -50%);
  border: 2px dashed rgba(255, 255, 255, 0.55);
  border-radius: 12px;
  box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.35);
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}
.cam__guide--ok {
  border-color: #18c3a8;
  border-style: solid;
}

.cam__top {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: calc(12px + env(safe-area-inset-top)) 16px 12px;
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
}
.cam__icon-btn--ghost {
  visibility: hidden;
}
.cam__hint {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.85);
  background: rgba(0, 0, 0, 0.4);
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
  z-index: 2;
  margin-top: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  padding: 16px 16px calc(24px + env(safe-area-inset-bottom));
  background: linear-gradient(180deg, transparent, rgba(0, 0, 0, 0.55));
}
.cam__tip {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.7);
}
.cam__shutter {
  width: 70px;
  height: 70px;
  border-radius: 50%;
  border: 4px solid rgba(255, 255, 255, 0.85);
  background: transparent;
  padding: 0;
  cursor: pointer;
  display: grid;
  place-items: center;
  transition: transform 0.1s ease;
}
.cam__shutter:active {
  transform: scale(0.92);
}
.cam__shutter:disabled {
  opacity: 0.4;
}
.cam__shutter-inner {
  width: 54px;
  height: 54px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.9);
}
.cam__shutter--ready .cam__shutter-inner {
  background: var(--ss-primary-grad);
}

.cam__error {
  position: absolute;
  inset: 0;
  z-index: 3;
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
