<template>
  <div class="home">
    <header class="home__header">
      <div class="home__brand">
        <div class="home__logo"><van-icon name="description" /></div>
        <div class="home__brand-text">
          <h1 class="home__title">扫描宝</h1>
          <p class="home__subtitle">Scan Treasure · 文档 / 证件扫描</p>
        </div>
      </div>
      <p class="home__tag"><van-icon name="lock" /> 纯本地处理 · 不上传服务器</p>
    </header>

    <main class="home__main">
      <div v-if="!image && !loading" class="options">
        <div class="option" @click="fromCamera">
          <div class="option__icon"><van-icon name="scan" /></div>
          <p class="option__title">扫描文件</p>
          <p class="option__sub">拍照扫描文档</p>
        </div>
        <div class="option" @click="triggerPick">
          <div class="option__icon"><van-icon name="description" /></div>
          <p class="option__title">文档扫描</p>
          <p class="option__sub">从相册选择图片</p>
        </div>
        <div class="option" @click="goIdCard">
          <div class="option__icon option__icon--id"><van-icon name="credit-pay" /></div>
          <p class="option__title">身份证扫描</p>
          <p class="option__sub">正反面合成扫描件</p>
        </div>
      </div>

      <div v-else-if="loading" class="home__loading">
        <van-loading type="spinner" size="40px" color="#2f6fed" />
        <p>读取中…</p>
      </div>

      <div v-else-if="image" class="preview">
        <img :src="image.url" class="preview__img" alt="预览" />
        <div class="preview__meta">
          <span>{{ image.width }} × {{ image.height }}</span>
          <span>{{ image.file ? formatSize(image.file.size) : '拍摄' }}</span>
        </div>
      </div>
    </main>

    <footer class="home__footer">
      <p v-if="error" class="home__error">{{ error }}</p>
      <p class="home__tip">提示：先拍照或截屏，再从相册选择</p>
    </footer>

    <input
      ref="fileInputRef"
      type="file"
      accept="image/*"
      class="home__file-input"
      @change="onFileChange"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useImagePicker } from '@/composables/useImagePicker'
import { useScanStore } from '@/store/scan'
import { formatSize, loadImage } from '@/utils/image'
import { useCapture } from '@/composables/useCapture'

const router = useRouter()
const store = useScanStore()
const fileInputRef = ref<HTMLInputElement | null>(null)
const { image, loading, error, loadFile } = useImagePicker()
const capture = useCapture()

/** 文档扫描：从相册选图 */
function triggerPick(): void {
  fileInputRef.value?.click()
}

function goIdCard(): void {
  router.push('/idcard')
}

/** 扫描文件：H5 走系统相机、App 走自定义扫描界面，不会弹"未找到摄像头" */
async function fromCamera(): Promise<void> {
  const dataUrl = await capture.takePhoto()
  if (!dataUrl) return
  try {
    const img = await loadImage(dataUrl)
    store.reset()
    store.setImage({
      dataUrl,
      url: dataUrl,
      width: img.naturalWidth,
      height: img.naturalHeight,
    })
    router.push('/edit')
  } catch {
    /* 忽略 */
  }
}

async function onFileChange(e: Event): Promise<void> {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  await loadFile(file)

  if (image.value) {
    store.reset()
    store.setImage(image.value)
    router.push('/edit')
  }
  // 清空 value，便于重复选择同一张图
  input.value = ''
}
</script>

<style scoped>
.home {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  padding: 22px 18px;
  padding-top: calc(22px + env(safe-area-inset-top));
  padding-bottom: calc(22px + env(safe-area-inset-bottom));
  background:
    radial-gradient(70% 36% at 100% 0%, rgba(91, 155, 255, 0.16), transparent 60%),
    radial-gradient(55% 30% at 0% 8%, rgba(37, 99, 235, 0.1), transparent 60%),
    var(--ss-bg);
}

.home__header {
  margin-bottom: 6px;
}
.home__brand {
  display: flex;
  align-items: center;
  gap: 12px;
}
.home__logo {
  width: 46px;
  height: 46px;
  border-radius: 14px;
  display: grid;
  place-items: center;
  background: var(--ss-primary-grad);
  color: #fff;
  font-size: 24px;
  box-shadow: var(--ss-shadow-primary);
}
.home__title {
  font-size: 22px;
  font-weight: 700;
  color: var(--ss-text);
  letter-spacing: 0.5px;
}
.home__subtitle {
  font-size: 12px;
  color: var(--ss-text-light);
  margin-top: 2px;
}
.home__tag {
  margin-top: 16px;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: var(--ss-primary);
  background: var(--ss-primary-soft);
  padding: 5px 12px;
  border-radius: var(--ss-radius-pill);
  font-weight: 500;
}

.home__main {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 10px 0;
}

.options {
  width: 100%;
  max-width: 460px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}
.option {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 28px 14px;
  border-radius: var(--ss-radius-lg);
  background: var(--ss-surface);
  box-shadow: var(--ss-shadow-card);
  color: var(--ss-text);
  cursor: pointer;
  transition:
    transform 0.15s ease,
    box-shadow 0.15s ease;
}
.option:active {
  transform: scale(0.97);
  box-shadow: var(--ss-shadow-sm);
}
.option__icon {
  width: 56px;
  height: 56px;
  border-radius: 16px;
  display: grid;
  place-items: center;
  background: var(--ss-primary-grad);
  color: #fff;
  font-size: 28px;
  margin-bottom: 8px;
  box-shadow: var(--ss-shadow-primary);
}
.option__icon--id {
  background: linear-gradient(135deg, #18c3a8, #0f9b87);
  box-shadow: 0 8px 20px rgba(15, 155, 135, 0.28);
}
.option__title {
  font-size: 15px;
  font-weight: 600;
}
.option__sub {
  font-size: 12px;
  color: var(--ss-text-light);
}

.home__loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  color: var(--ss-text-light);
}

.preview {
  width: 100%;
  max-width: 420px;
}
.preview__img {
  width: 100%;
  max-height: 55vh;
  object-fit: contain;
  border-radius: var(--ss-radius);
  box-shadow: var(--ss-shadow-card);
}
.preview__meta {
  display: flex;
  justify-content: center;
  gap: 10px;
  margin-top: 16px;
}
.preview__meta span {
  font-size: 12px;
  color: var(--ss-text-light);
  background: var(--ss-surface);
  padding: 5px 14px;
  border-radius: var(--ss-radius-pill);
  box-shadow: var(--ss-shadow-sm);
}

.home__footer {
  padding-bottom: 2px;
}
.home__error {
  color: #ee0a24;
  font-size: 13px;
  margin-top: 10px;
  text-align: center;
}
.home__tip {
  font-size: 12px;
  color: var(--ss-text-lighter);
  margin-top: 12px;
  text-align: center;
}
.home__file-input {
  display: none;
}
</style>
