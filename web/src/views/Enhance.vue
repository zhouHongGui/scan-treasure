<template>
  <div class="enhance">
    <van-nav-bar title="预览与导出" left-arrow @click-left="onBack" />

    <div class="enhance__stage">
      <div v-if="status === 'loading'" class="enhance__loading">
        <van-loading type="spinner" size="36px" />
        <p class="enhance__loading-text">{{ statusText }}</p>
      </div>

      <div v-else-if="status === 'ready' && enhanced" class="enhance__preview">
        <img :src="enhanced.dataUrl" class="enhance__img" alt="预览" />
      </div>

      <div v-else class="enhance__error">
        <van-icon name="warning-o" size="48" color="#ee0a24" />
        <p class="enhance__error-text">{{ errorMsg }}</p>
        <van-button size="small" plain @click="onBack">返回调整</van-button>
      </div>
    </div>

    <footer class="enhance__bar" v-if="status === 'ready'">
      <div class="enhance__modes">
        <button
          v-for="m in MODES"
          :key="m.value"
          class="enhance__mode"
          :class="{ 'enhance__mode--active': m.value === mode }"
          @click="onMode(m.value)"
        >
          {{ m.label }}
        </button>
      </div>
      <div class="enhance__actions">
        <van-button
          plain
          class="enhance__btn"
          :loading="exporting === 'image'"
          @click="onExportImage"
        >
          存图片
        </van-button>
        <van-button
          type="primary"
          class="enhance__btn"
          :loading="exporting === 'pdf'"
          @click="onExportPdf"
        >
          导出 PDF
        </van-button>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { showToast } from 'vant'
import { useScanStore } from '@/store/scan'
import { useImageClient, type EnhanceMode } from '@/composables/useImageProcess'
import { exportImageToPdf, exportImageFile } from '@/utils/pdf'

const MODES: { value: EnhanceMode; label: string }[] = [
  { value: 'color', label: '彩色' },
  { value: 'brighten', label: '增亮' },
  { value: 'gray', label: '灰度' },
  { value: 'bw', label: '黑白' },
]

const router = useRouter()
const store = useScanStore()
const client = useImageClient()

type Status = 'loading' | 'ready' | 'error'
const status = ref<Status>('loading')
const statusText = ref('正在校正透视...')
const errorMsg = ref('')
const mode = ref<EnhanceMode>(store.enhanceMode || 'color')
const enhanced = ref<{
  dataUrl: string
  width: number
  height: number
} | null>(null)
const exporting = ref<'' | 'pdf' | 'image'>('')

// 透视校正后的中间结果（重新选模式时基于它重算）
let warped: { dataUrl: string; width: number; height: number } | null = null

onMounted(async () => {
  const work = store.workingImage
  const corners = store.corners
  if (!work || corners.length !== 4) {
    router.replace('/')
    return
  }

  try {
    // 复用已校正过的结果（从 Edit 返回再回来时省一次 warp）
    if (store.warpedImage) {
      warped = store.warpedImage
    } else {
      statusText.value = '正在校正透视...'
      warped = await client.warp(work.dataUrl, corners)
      store.setWarpedImage(warped)
    }

    statusText.value = '正在增强图像...'
    enhanced.value = await client.enhance(warped.dataUrl, mode.value)
    store.setEnhancedImage(enhanced.value)
    store.setEnhanceMode(mode.value)
    status.value = 'ready'
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : '处理失败'
    status.value = 'error'
  }
})

async function onMode(m: EnhanceMode): Promise<void> {
  if (m === mode.value || !warped || status.value !== 'ready') return
  mode.value = m
  statusText.value = '正在切换效果...'
  const prev = status.value
  status.value = 'loading'
  try {
    enhanced.value = await client.enhance(warped.dataUrl, m)
    store.setEnhancedImage(enhanced.value)
    store.setEnhanceMode(m)
    status.value = prev
  } catch (e) {
    status.value = 'error'
    errorMsg.value = e instanceof Error ? e.message : '增强失败'
  }
}

async function onExportPdf(): Promise<void> {
  if (!enhanced.value) return
  exporting.value = 'pdf'
  try {
    await exportImageToPdf(enhanced.value.dataUrl)
    showToast('已导出 PDF')
  } catch (e) {
    showToast(e instanceof Error ? e.message : '导出失败')
  } finally {
    exporting.value = ''
  }
}

async function onExportImage(): Promise<void> {
  if (!enhanced.value) return
  exporting.value = 'image'
  try {
    await exportImageFile(enhanced.value.dataUrl)
    showToast('已保存图片')
  } catch (e) {
    showToast(e instanceof Error ? e.message : '保存失败')
  } finally {
    exporting.value = ''
  }
}

function onBack(): void {
  router.push('/edit')
}
</script>

<style scoped>
.enhance {
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

.enhance__stage {
  flex: 1;
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.enhance__loading,
.enhance__error {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--ss-text-on-dark);
  gap: 16px;
}
.enhance__loading-text,
.enhance__error-text {
  font-size: 13px;
  color: var(--ss-text-on-dark-light);
  padding: 0 32px;
  text-align: center;
}

.enhance__preview {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}
.enhance__img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  border-radius: var(--ss-radius);
  box-shadow: var(--ss-shadow-dark);
}

.enhance__bar {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px 16px;
  padding-bottom: calc(14px + env(safe-area-inset-bottom));
  background: linear-gradient(180deg, transparent, var(--ss-stage) 40%);
  border-top: 1px solid var(--ss-stage-bar);
}

.enhance__modes {
  display: flex;
  gap: 8px;
}
.enhance__mode {
  flex: 1;
  height: 38px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.04);
  color: var(--ss-text-on-dark-light);
  border-radius: var(--ss-radius-pill);
  font-size: 13px;
  cursor: pointer;
  transition:
    color 0.15s ease,
    background 0.15s ease,
    border-color 0.15s ease;
}
.enhance__mode--active {
  border-color: transparent;
  color: #fff;
  background: var(--ss-primary-grad);
  box-shadow: var(--ss-shadow-primary);
}

.enhance__actions {
  display: flex;
  gap: 12px;
}
.enhance__btn {
  flex: 1;
}
/* 深色背景上的次级（描边）按钮：改成中性浅色，避免深色字看不清 */
.enhance__actions :deep(.van-button--plain) {
  color: var(--ss-text-on-dark);
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.16);
}
</style>
