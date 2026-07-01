<template>
  <div class="edit">
    <van-nav-bar title="调整边缘" left-arrow @click-left="onBack">
      <template #right>
        <span v-if="detecting" class="edit__info">自动识别中…</span>
        <span v-else-if="status === 'ready' && !autoOk" class="edit__warn">
          未自动识别，请拖动四角
        </span>
      </template>
    </van-nav-bar>

    <div class="edit__stage">
      <div v-if="status === 'loading'" class="edit__loading">
        <van-loading type="spinner" size="36px" />
        <p class="edit__loading-text">{{ statusText }}</p>
      </div>

      <CornerCanvas
        v-else-if="status === 'ready' && working"
        :src="working.dataUrl"
        :corners="corners"
        :img-width="working.width"
        :img-height="working.height"
        :pad="24"
        @update:corners="onCornersUpdate"
      />

      <div v-else class="edit__error">
        <van-icon name="warning-o" size="48" color="#ee0a24" />
        <p class="edit__error-text">{{ errorMsg }}</p>
        <van-button size="small" plain @click="onBack">返回重选</van-button>
      </div>
    </div>

    <footer class="edit__footer">
      <van-button plain class="edit__btn" @click="reDetect">
        重置为全图
      </van-button>
      <van-button
        type="primary"
        class="edit__btn"
        :disabled="corners.length !== 4"
        @click="onNext"
      >
        下一步
      </van-button>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { showToast } from 'vant'
import { useScanStore } from '@/store/scan'
import { useImageClient } from '@/composables/useImageProcess'
import { compressToDataUrl, SCAN_IMAGE_MAX_SIDE, SCAN_JPEG_QUALITY } from '@/utils/image'
import { fullImageCorners, type Corner } from '@/utils/geometry'
import CornerCanvas from '@/components/CornerCanvas.vue'

const router = useRouter()
const store = useScanStore()
const client = useImageClient()

type Status = 'loading' | 'ready' | 'error'
const status = ref<Status>('loading')
const statusText = ref('正在处理图片...')
const errorMsg = ref('')
const autoOk = ref(false)
// 后台自动识别进行中（非阻塞：用户已可拖角点）
const detecting = ref(false)
const corners = ref<Corner[]>([])
const working = ref<{
  dataUrl: string
  width: number
  height: number
} | null>(null)

// 用户是否手动拖过角点（拖过则后台识别结果不覆盖）
let userEdited = false
let unmounted = false

onMounted(async () => {
  const orig = store.originalImage
  if (!orig) {
    router.replace('/')
    return
  }

  try {
    // 1. 先用纯 canvas 压缩，立刻让用户看到图 + 可拖角点
    // 文档文字对分辨率敏感，保留更高最长边以减少小字发糊
    const data = await compressToDataUrl(orig.dataUrl, SCAN_IMAGE_MAX_SIDE, SCAN_JPEG_QUALITY)
    working.value = data
    store.setWorkingImage(data)
    const cameraCorners = scaleOriginalCornersToWorking(
      store.originalCorners,
      orig.width,
      orig.height,
      data.width,
      data.height,
    )
    corners.value = cameraCorners || fullImageCorners(data.width, data.height)
    store.setCorners(corners.value)
    autoOk.value = !!cameraCorners
    status.value = 'ready' // 立刻可交互，不等自动识别

    if (cameraCorners) {
      showToast('已根据扫描框自动框选，可微调四角')
    } else {
      // 2. 后台自动找边；识别失败则保持全图四角，用户手动拖
      runBackgroundDetect(data.dataUrl)
    }
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : '处理失败'
    status.value = 'error'
  }
})

/** 后台自动找边：成功则更新四角（用户已手动调整则不覆盖），失败保持全图 */
async function runBackgroundDetect(dataUrl: string): Promise<void> {
  detecting.value = true
  try {
    const detected = await client.detect(dataUrl, { mode: 'document' })
    if (unmounted) return
    if (detected && !userEdited) {
      corners.value = detected
      store.setCorners(detected)
      autoOk.value = true
      showToast('已自动识别，可拖动角点微调')
    } else if (detected && userEdited) {
      autoOk.value = false
      // 用户已手动调整，保留用户结果
    }
    // 未检测到：保持全图角点，用户可手动
  } catch (e) {
    // 自动识别失败不阻塞手动调边
    console.warn('[Edit] 背景自动识别失败', e)
    if (!unmounted) showToast('自动识别不可用，请手动拖角')
  } finally {
    if (!unmounted) detecting.value = false
  }
}

function onCornersUpdate(c: Corner[]): void {
  userEdited = true
  corners.value = c
  store.setCorners(c)
}

function scaleOriginalCornersToWorking(
  originalCorners: Corner[],
  originalW: number,
  originalH: number,
  workingW: number,
  workingH: number,
): Corner[] | null {
  if (originalCorners.length !== 4 || !originalW || !originalH || !workingW || !workingH) return null
  const sx = workingW / originalW
  const sy = workingH / originalH
  const scaled = originalCorners.map((p) => ({
    x: Math.max(0, Math.min(workingW, p.x * sx)),
    y: Math.max(0, Math.min(workingH, p.y * sy)),
  }))
  const xs = scaled.map((p) => p.x)
  const ys = scaled.map((p) => p.y)
  const w = Math.max(...xs) - Math.min(...xs)
  const h = Math.max(...ys) - Math.min(...ys)
  if (w < workingW * 0.12 || h < workingH * 0.12) return null
  return scaled
}

function reDetect(): void {
  if (!working.value) return
  userEdited = false
  corners.value = fullImageCorners(working.value.width, working.value.height)
  autoOk.value = false
  store.setCorners(corners.value)
  showToast('已重置为全图，请拖动四角')
}

function onNext(): void {
  store.setCorners(corners.value)
  router.push('/enhance')
}

function onBack(): void {
  router.push('/')
}

onBeforeUnmount(() => {
  unmounted = true
})
</script>

<style scoped>
.edit {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--ss-stage-grad);
}

/* 深色导航栏 */
:deep(.van-nav-bar) {
  background: transparent;
}
:deep(.van-nav-bar__title),
:deep(.van-nav-bar .van-icon),
:deep(.van-nav-bar__text) {
  color: var(--ss-text-on-dark);
}

.edit__stage {
  flex: 1;
  position: relative;
  overflow: hidden;
}

.edit__loading {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--ss-text-on-dark);
  gap: 16px;
}

.edit__loading-text {
  font-size: 13px;
  color: var(--ss-text-on-dark-light);
  padding: 0 32px;
  text-align: center;
}

.edit__warn {
  font-size: 12px;
  color: #ffb084;
}

.edit__info {
  font-size: 12px;
  color: var(--ss-text-on-dark-light);
}

.edit__error {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--ss-text-on-dark);
  gap: 16px;
}

.edit__error-text {
  font-size: 14px;
  color: var(--ss-text-on-dark-light);
  padding: 0 32px;
  text-align: center;
}

.edit__footer {
  display: flex;
  gap: 12px;
  padding: 14px 16px;
  padding-bottom: calc(14px + env(safe-area-inset-bottom));
  background: linear-gradient(180deg, transparent, var(--ss-stage) 45%);
  border-top: 1px solid var(--ss-stage-bar);
}

.edit__btn {
  flex: 1;
}
/* 深色背景上的次级（描边）按钮：改成中性浅色，避免深色字看不清 */
.edit__footer :deep(.van-button--plain) {
  color: var(--ss-text-on-dark);
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.16);
}
</style>
