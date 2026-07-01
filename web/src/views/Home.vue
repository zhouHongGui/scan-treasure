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
        <button
          class="option option--primary"
          type="button"
          :disabled="scanStarting"
          @click="startCameraScan"
        >
          <div class="option__icon"><van-icon name="scan" /></div>
          <p class="option__title">{{ scanStarting ? '请求摄像头权限…' : '扫描文件' }}</p>
          <p class="option__sub">自动识别文档并扫描</p>
        </button>
        <button class="option" type="button" @click="triggerAlbumPick">
          <div class="option__icon"><van-icon name="description" /></div>
          <p class="option__title">文档扫描</p>
          <p class="option__sub">从相册选择图片</p>
        </button>
        <button class="option" type="button" @click="goIdCard">
          <div class="option__icon option__icon--id"><van-icon name="credit-pay" /></div>
          <p class="option__title">身份证扫描</p>
          <p class="option__sub">正反面合成扫描件</p>
        </button>
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

    <aside v-if="showPromo" class="promo">
      <a class="promo__link" :href="PROMO_URL" target="_blank" rel="noopener noreferrer">
        <span class="promo__icon"><van-icon name="gift-o" /></span>
        <span class="promo__text">
          <strong>19元 享 250GB 大流量</strong>
          <small>移动 / 电信 号卡 · 在线申请包邮 · 推广</small>
        </span>
        <span class="promo__cta">去办理 <van-icon name="arrow" /></span>
      </a>
      <button class="promo__close" type="button" aria-label="关闭推广" @click="dismissPromo">
        <van-icon name="cross" />
      </button>
    </aside>

    <footer class="home__footer">
      <p v-if="error || cameraError" class="home__error">{{ error || cameraError }}</p>
      <p class="home__tip">文件仅在当前设备处理，不会上传服务器</p>
    </footer>

    <input
      ref="albumInputRef"
      type="file"
      accept="image/*"
      class="home__file-input"
      @change="onFileChange"
    />
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { showToast } from 'vant'
import { useImagePicker } from '@/composables/useImagePicker'
import { useScanStore } from '@/store/scan'
import { formatSize, loadImage } from '@/utils/image'
import { useCameraCapture, type CameraCaptureResult } from '@/composables/useCameraCapture'

const router = useRouter()
const store = useScanStore()
const albumInputRef = ref<HTMLInputElement | null>(null)
const { image, loading, error, loadFile } = useImagePicker()
const camera = useCameraCapture()
const cameraError = ref('')
const scanStarting = ref(false)

// 自有店铺推广（办卡）：点击新标签打开；可关闭，关闭状态仅记本地、不上传
const PROMO_URL = 'https://hklingqu.chshebei.cn/ProductEn/Index/01190a6b967b8267'
const PROMO_DISMISS_KEY = 'scan-treasure:promo-dismissed'
const showPromo = ref(!localStorage.getItem(PROMO_DISMISS_KEY))
function dismissPromo(): void {
  showPromo.value = false
  try {
    localStorage.setItem(PROMO_DISMISS_KEY, '1')
  } catch {
    /* 无痕模式等不可写时忽略 */
  }
}

onMounted(() => {
  camera.reset()
})

/** 扫描文件：点击后打开全屏摄像头取景层，像扫一扫一样扫描文件 */
function startCameraScan(): void {
  void fromCamera()
}

/** 文档扫描：从相册选图 */
function triggerAlbumPick(): void {
  albumInputRef.value?.click()
}

function goIdCard(): void {
  router.push('/idcard')
}

async function fromCamera(): Promise<void> {
  cameraError.value = ''
  scanStarting.value = true
  try {
    const result = await camera.open()
    if (!result) return
    await enterEditWithCameraResult(result)
  } catch (err) {
    const msg = err instanceof Error ? err.message : '无法打开摄像头'
    cameraError.value = msg
    showToast(msg)
  } finally {
    scanStarting.value = false
  }
}

async function enterEditWithCameraResult(result: CameraCaptureResult): Promise<void> {
  const img = await loadImage(result.dataUrl)
  store.reset()
  store.setImage({
    dataUrl: result.dataUrl,
    url: result.dataUrl,
    width: img.naturalWidth,
    height: img.naturalHeight,
  })
  if (result.corners?.length === 4) {
    store.setOriginalCorners(result.corners)
  }
  router.push('/edit')
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
  border: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-height: 142px;
  padding: 28px 14px;
  border-radius: var(--ss-radius-lg);
  background: var(--ss-surface);
  box-shadow: var(--ss-shadow-card);
  color: var(--ss-text);
  cursor: pointer;
  font-family: inherit;
  transition:
    transform 0.15s ease,
    box-shadow 0.15s ease;
}
.option--primary {
  grid-column: 1 / -1;
  min-height: 154px;
}
.option:active {
  transform: scale(0.97);
  box-shadow: var(--ss-shadow-sm);
}
.option:disabled {
  cursor: not-allowed;
  opacity: 0.72;
  transform: none;
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
.promo {
  position: relative;
  max-width: 460px;
  margin: 4px auto 14px;
  border-radius: var(--ss-radius-lg);
  background: linear-gradient(135deg, #ff9a5a 0%, #ff5a3c 100%);
  box-shadow: 0 10px 24px rgba(255, 90, 60, 0.28);
  overflow: hidden;
}
.promo__link {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 44px 16px 14px;
  color: #fff;
  text-decoration: none;
}
.promo__icon {
  flex: 0 0 auto;
  width: 42px;
  height: 42px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: rgba(255, 255, 255, 0.22);
  color: #fff;
  font-size: 22px;
}
.promo__text {
  flex: 1;
  min-width: 0;
}
.promo__text strong {
  display: block;
  font-size: 15px;
  font-weight: 800;
  letter-spacing: 0.3px;
}
.promo__text small {
  display: block;
  margin-top: 3px;
  color: rgba(255, 255, 255, 0.88);
  font-size: 12px;
  line-height: 1.4;
}
.promo__cta {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 8px 14px;
  border-radius: var(--ss-radius-pill);
  background: #fff;
  color: #ff5a3c;
  font-size: 13px;
  font-weight: 700;
  white-space: nowrap;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
}
.promo__close {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 24px;
  height: 24px;
  border: 0;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.25);
  color: #fff;
  display: grid;
  place-items: center;
  cursor: pointer;
  font-size: 12px;
}

.home__file-input {
  position: fixed;
  left: -9999px;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}
</style>
