<template>
  <div class="idcard">
    <van-nav-bar :title="navTitle" left-arrow @click-left="onBack" />

    <!-- 步骤指示 -->
    <div class="idcard__steps">
      <div
        v-for="(s, i) in STEPS"
        :key="s.key"
        class="idcard__step"
        :class="{
          'idcard__step--active': stepIndex >= i,
          'idcard__step--current': stepIndex === i,
        }"
      >
        <span class="idcard__step-no">{{ i + 1 }}</span>
        <span class="idcard__step-label">{{ s.label }}</span>
      </div>
    </div>

    <!-- 正面 / 反面：选图 + 调四角 -->
    <template v-if="step !== 'result'">
      <div class="idcard__stage">
        <div v-if="!currentImage" class="idcard__pick" @click="pick(step)">
          <div class="idcard__pick-icon"><van-icon name="photo-o" /></div>
          <p class="idcard__pick-title">选择{{ sideText }}照片</p>
          <p class="idcard__pick-sub">请尽量拍正、铺满画面</p>
        </div>

        <CornerCanvas
          v-else
          :key="currentImage.dataUrl"
          :src="currentImage.dataUrl"
          :corners="currentCorners"
          :img-width="currentImage.width"
          :img-height="currentImage.height"
          :pad="48"
          @update:corners="onCornersUpdate"
        />

        <div v-if="status === 'error'" class="idcard__error">
          <van-icon name="warning-o" size="44" color="#ee0a24" />
          <p>{{ errorMsg }}</p>
        </div>
      </div>

      <footer class="idcard__footer">
        <div class="idcard__actions">
          <van-button v-if="currentImage" plain class="idcard__btn" @click="pick(step)">
            重选
          </van-button>
          <van-button
            type="primary"
            class="idcard__btn"
            :disabled="!currentImage || currentCorners.length !== 4"
            @click="nextStep"
          >
            {{ step === 'front' ? '下一步：反面' : '生成扫描件' }}
          </van-button>
        </div>
      </footer>
    </template>

    <!-- 结果：合成扫描件预览 + 导出 -->
    <template v-else>
      <div class="idcard__stage">
        <div v-if="status === 'processing' && !combined" class="idcard__loading">
          <van-loading type="spinner" size="40px" />
          <p>{{ statusText }}</p>
        </div>

        <div v-else-if="combined" class="idcard__preview">
          <img :src="combined.dataUrl" class="idcard__img" alt="身份证扫描件" />
        </div>

        <div v-else class="idcard__loading">
          <van-icon name="warning-o" size="44" color="#ee0a24" />
          <p>{{ errorMsg || '生成失败' }}</p>
        </div>
      </div>

      <footer class="idcard__footer">
        <div class="idcard__modes">
          <button
            v-for="m in MODES"
            :key="m.value"
            class="idcard__mode"
            :class="{ 'idcard__mode--active': m.value === mode }"
            :disabled="status === 'processing'"
            @click="onMode(m.value)"
          >
            {{ m.label }}
          </button>
        </div>
        <div class="idcard__actions">
          <van-button
            plain
            class="idcard__btn"
            :loading="exporting === 'image'"
            :disabled="!combined"
            @click="onExportImage"
          >
            存图片
          </van-button>
          <van-button
            type="primary"
            class="idcard__btn"
            :loading="exporting === 'pdf'"
            :disabled="!combined"
            @click="onExportPdf"
          >
            导出 PDF
          </van-button>
        </div>
      </footer>
    </template>

    <van-action-sheet
      v-model:show="pickSheet"
      :actions="pickActions"
      cancel-text="取消"
      close-on-click-action
      @select="onPickSelect"
    />

    <input
      ref="fileInputRef"
      type="file"
      accept="image/*"
      class="idcard__file-input"
      @change="onFileChange"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { showToast, type ActionSheetAction } from 'vant'
import {
  useImageClient,
  combineIdCardSides,
  type EnhanceMode,
} from '@/composables/useImageProcess'
import { compressToDataUrl, loadImage, SCAN_IMAGE_MAX_SIDE, SCAN_JPEG_QUALITY } from '@/utils/image'
import { orderCorners, type Corner } from '@/utils/geometry'
import { exportImageToPdf, exportImageFile } from '@/utils/pdf'
import { useCapture } from '@/composables/useCapture'
import CornerCanvas from '@/components/CornerCanvas.vue'

type Step = 'front' | 'back' | 'result'
type WorkImg = { dataUrl: string; width: number; height: number }

const STEPS: { key: Step; label: string }[] = [
  { key: 'front', label: '正面' },
  { key: 'back', label: '反面' },
  { key: 'result', label: '完成' },
]
const MODES: { value: EnhanceMode; label: string }[] = [
  { value: 'color', label: '彩色' },
  { value: 'sharp', label: '高清' },
  { value: 'brighten', label: '增亮' },
  { value: 'gray', label: '灰度' },
  { value: 'bw', label: '黑白' },
]

const router = useRouter()
const client = useImageClient()
const capture = useCapture()

const pickSheet = ref(false)
const pickActions: ActionSheetAction[] = [{ name: '拍照' }, { name: '从相册选择' }]

const step = ref<Step>('front')
const front = ref<WorkImg | null>(null)
const frontCorners = ref<Corner[]>([])
const back = ref<WorkImg | null>(null)
const backCorners = ref<Corner[]>([])

const warpedFront = ref<WorkImg | null>(null)
const warpedBack = ref<WorkImg | null>(null)
const combined = ref<WorkImg | null>(null)
const mode = ref<EnhanceMode>('color')

const status = ref<'idle' | 'processing' | 'error'>('idle')
const statusText = ref('正在生成扫描件…')
const errorMsg = ref('')
const exporting = ref<'' | 'pdf' | 'image'>('')

const fileInputRef = ref<HTMLInputElement | null>(null)
let pendingSide: 'front' | 'back' = 'front'

const stepIndex = computed(() => STEPS.findIndex((s) => s.key === step.value))
const navTitle = computed(() =>
  step.value === 'result' ? '身份证扫描件' : `身份证 · ${sideText.value}`,
)
const sideText = computed(() => (step.value === 'front' ? '正面' : '反面'))
const currentImage = computed(() => (step.value === 'front' ? front.value : back.value))
const currentCorners = computed(() =>
  step.value === 'front' ? frontCorners.value : backCorners.value,
)

function pick(side: 'front' | 'back'): void {
  pendingSide = side
  pickSheet.value = true
}

function onPickSelect(item: ActionSheetAction): void {
  if (item.name === '拍照') {
    void fromCamera()
  } else {
    fileInputRef.value?.click()
  }
}

/** 由 dataUrl（相册或拍摄）加载某一面：压缩 → 自动框选 → 写入 */
async function loadSide(dataUrl: string, sourceCorners?: Corner[]): Promise<void> {
  const sourceImage = sourceCorners?.length === 4 ? await loadImage(dataUrl) : null
  const work = await compressToDataUrl(dataUrl, SCAN_IMAGE_MAX_SIDE, SCAN_JPEG_QUALITY)

  let corners =
    sourceImage && sourceCorners
      ? scaleSourceCornersToWork(sourceCorners, sourceImage.naturalWidth, sourceImage.naturalHeight, work.width, work.height)
      : null

  if (!corners) {
    const detected = await client.detect(work.dataUrl, { mode: 'id-card' })
    corners = normalizeIdCardCorners(detected, work.width, work.height)
  }

  if (corners) {
    showToast('已自动框选，可微调四角')
  } else {
    corners = centeredIdCardCorners(work.width, work.height)
    showToast('已按证件比例预框选，可微调四角')
  }

  if (pendingSide === 'front') {
    front.value = work
    frontCorners.value = corners
  } else {
    back.value = work
    backCorners.value = corners
  }
}

async function fromCamera(): Promise<void> {
  const result = await capture.takePhoto()
  if (!result) return
  try {
    await loadSide(result.dataUrl, result.corners)
  } catch (err) {
    showToast(err instanceof Error ? err.message : '拍摄处理失败')
  }
}

function scaleSourceCornersToWork(
  corners: Corner[],
  sourceW: number,
  sourceH: number,
  workW: number,
  workH: number,
): Corner[] | null {
  if (corners.length !== 4 || !sourceW || !sourceH || !workW || !workH) return null
  const sx = workW / sourceW
  const sy = workH / sourceH
  return normalizeIdCardCorners(
    corners.map((p) => ({
      x: p.x * sx,
      y: p.y * sy,
    })),
    workW,
    workH,
  )
}

function normalizeIdCardCorners(corners: Corner[] | null, width: number, height: number): Corner[] | null {
  if (!corners || corners.length !== 4) return null
  const ordered = orderCorners(
    corners.map((p) => ({
      x: Math.max(0, Math.min(width, p.x)),
      y: Math.max(0, Math.min(height, p.y)),
    })),
  )
  return isUsableIdCardBox(ordered, width, height) ? ordered : null
}

function isUsableIdCardBox(corners: Corner[], width: number, height: number): boolean {
  const xs = corners.map((p) => p.x)
  const ys = corners.map((p) => p.y)
  const boxW = Math.max(...xs) - Math.min(...xs)
  const boxH = Math.max(...ys) - Math.min(...ys)
  if (boxW <= 0 || boxH <= 0) return false

  const areaRatio = (boxW * boxH) / (width * height)
  if (areaRatio < 0.035) return false

  const longRatio = Math.max(boxW / boxH, boxH / boxW)
  const ratioError = Math.abs(Math.log(longRatio / 1.586))
  if (ratioError > Math.log(1.38)) return false

  const imageLongRatio = Math.max(width / height, height / width)
  const fullImageLooksLikeCard = Math.abs(Math.log(imageLongRatio / 1.586)) <= Math.log(1.18)
  if (areaRatio > 0.88 && !fullImageLooksLikeCard) return false

  return true
}

function centeredIdCardCorners(width: number, height: number): Corner[] {
  const ratio = 1.586
  let cardW = width * 0.86
  let cardH = cardW / ratio
  const maxH = height * 0.72
  if (cardH > maxH) {
    cardH = maxH
    cardW = cardH * ratio
  }

  const left = (width - cardW) / 2
  const top = (height - cardH) / 2
  return [
    { x: left, y: top },
    { x: left + cardW, y: top },
    { x: left + cardW, y: top + cardH },
    { x: left, y: top + cardH },
  ]
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = () => reject(new Error('读取文件失败'))
    r.readAsDataURL(file)
  })
}

async function onFileChange(e: Event): Promise<void> {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  input.value = ''
  try {
    await loadSide(await readFileAsDataUrl(file))
  } catch (err) {
    showToast(err instanceof Error ? err.message : '图片读取失败')
  }
}

function onCornersUpdate(c: Corner[]): void {
  if (step.value === 'front') frontCorners.value = c
  else backCorners.value = c
}

function nextStep(): void {
  if (step.value === 'front') {
    step.value = 'back'
  } else {
    void generate()
  }
}

async function generate(): Promise<void> {
  if (!front.value || !back.value) return
  step.value = 'result'
  status.value = 'processing'
  statusText.value = '正在校正…'
  combined.value = null
  try {
    warpedFront.value = await client.warp(front.value.dataUrl, frontCorners.value)
    statusText.value = '正在校正反面…'
    warpedBack.value = await client.warp(back.value.dataUrl, backCorners.value)
    await applyMode()
  } catch (err) {
    status.value = 'error'
    errorMsg.value = err instanceof Error ? err.message : '生成失败'
  }
}

async function applyMode(): Promise<void> {
  if (!warpedFront.value || !warpedBack.value) return
  status.value = 'processing'
  statusText.value = mode.value === 'color' ? '正在合成…' : '正在增强…'
  try {
    const ef = await client.enhance(warpedFront.value.dataUrl, mode.value)
    const eb = await client.enhance(warpedBack.value.dataUrl, mode.value)
    combined.value = await combineIdCardSides(ef, eb)
    status.value = 'idle'
  } catch (err) {
    if (combined.value) {
      // 已有结果（切换模式失败）：保留上一个结果，仅提示，不丢图
      status.value = 'idle'
      showToast(err instanceof Error ? err.message : '增强失败，已保留上一个效果')
    } else {
      // 首次生成失败：进错误态
      status.value = 'error'
      errorMsg.value = err instanceof Error ? err.message : '增强失败'
    }
  }
}

async function onMode(m: EnhanceMode): Promise<void> {
  if (m === mode.value) return
  mode.value = m
  await applyMode()
}

async function onExportImage(): Promise<void> {
  if (!combined.value) return
  exporting.value = 'image'
  try {
    await exportImageFile(combined.value.dataUrl)
    showToast('已保存图片')
  } catch (err) {
    showToast(err instanceof Error ? err.message : '保存失败')
  } finally {
    exporting.value = ''
  }
}

async function onExportPdf(): Promise<void> {
  if (!combined.value) return
  exporting.value = 'pdf'
  try {
    await exportImageToPdf(combined.value.dataUrl)
    showToast('已导出 PDF')
  } catch (err) {
    showToast(err instanceof Error ? err.message : '导出失败')
  } finally {
    exporting.value = ''
  }
}

function onBack(): void {
  if (step.value === 'result') step.value = 'back'
  else if (step.value === 'back') step.value = 'front'
  else router.push('/')
}
</script>

<style scoped>
.idcard {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--ss-stage-grad);
}

:deep(.van-nav-bar) {
  background: transparent;
}
:deep(.van-nav-bar__title),
:deep(.van-nav-bar .van-icon),
:deep(.van-nav-bar__text) {
  color: var(--ss-text-on-dark);
}

/* 步骤条 */
.idcard__steps {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 12px 16px 4px;
}
.idcard__step {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--ss-text-on-dark-light);
  font-size: 12px;
  opacity: 0.5;
  transition: opacity 0.2s ease;
}
.idcard__step--active {
  opacity: 1;
}
.idcard__step-no {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: rgba(255, 255, 255, 0.12);
  color: var(--ss-text-on-dark-light);
  font-size: 12px;
}
.idcard__step--current .idcard__step-no {
  background: var(--ss-primary-grad);
  color: #fff;
}
.idcard__step--current .idcard__step-label {
  color: var(--ss-text-on-dark);
  font-weight: 600;
}
.idcard__step:not(:last-child)::after {
  content: '';
  width: 16px;
  height: 1px;
  background: rgba(255, 255, 255, 0.16);
  margin-left: 6px;
}

.idcard__stage {
  flex: 1;
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 选图占位 */
.idcard__pick {
  width: calc(100% - 32px);
  max-width: 460px;
  aspect-ratio: 1.585 / 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: 2px dashed rgba(255, 255, 255, 0.22);
  border-radius: var(--ss-radius-lg);
  background: rgba(255, 255, 255, 0.04);
  color: var(--ss-text-on-dark);
  cursor: pointer;
}
.idcard__pick:active {
  background: rgba(255, 255, 255, 0.07);
}
.idcard__pick-icon {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: rgba(47, 111, 237, 0.18);
  color: #6ea4ff;
  font-size: 32px;
  margin-bottom: 4px;
}
.idcard__pick-title {
  font-size: 16px;
  font-weight: 600;
}
.idcard__pick-sub {
  font-size: 12px;
  color: var(--ss-text-on-dark-light);
}

.idcard__loading,
.idcard__error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  color: var(--ss-text-on-dark-light);
  font-size: 13px;
  text-align: center;
  padding: 0 32px;
}

.idcard__preview {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}
.idcard__img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  border-radius: var(--ss-radius);
  box-shadow: var(--ss-shadow-dark);
}

/* 底部 */
.idcard__footer {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px 16px;
  padding-bottom: calc(14px + env(safe-area-inset-bottom));
  background: linear-gradient(180deg, transparent, var(--ss-stage) 40%);
  border-top: 1px solid var(--ss-stage-bar);
}
.idcard__actions {
  display: flex;
  gap: 12px;
}
.idcard__btn {
  flex: 1;
}
/* 底部按钮加大，更好按 */
.idcard__footer :deep(.van-button) {
  height: 52px;
  line-height: 52px;
  font-size: 15px;
  font-weight: 600;
}
.idcard__footer :deep(.van-button--plain) {
  color: var(--ss-text-on-dark);
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.16);
}

/* 增强模式选择 */
.idcard__modes {
  display: flex;
  gap: 8px;
}
.idcard__mode {
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
    background 0.15s ease;
}
.idcard__mode:disabled {
  opacity: 0.5;
}
.idcard__mode--active {
  border-color: transparent;
  color: #fff;
  background: var(--ss-primary-grad);
  box-shadow: var(--ss-shadow-primary);
}

.idcard__file-input {
  display: none;
}
</style>
