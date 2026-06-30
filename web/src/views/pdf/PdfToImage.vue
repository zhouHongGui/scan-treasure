<template>
  <div class="pdf-tool">
    <van-nav-bar title="PDF 转图片" left-arrow @click-left="backToTools" />

    <main class="pdf-tool__body">
      <section class="pdf-tool__panel">
        <p class="pdf-tool__note">
          <van-icon name="lock" />
          文件仅在当前设备处理，不会上传到服务器。
        </p>
        <button class="pdf-tool__pick" type="button" @click="pickFile">
          <van-icon name="photo" />
          <strong>选择 PDF</strong>
          <span>将指定页面导出为 PNG 或 JPG 图片</span>
        </button>
      </section>

      <section v-if="item" class="pdf-tool__panel">
        <div class="pdf-tool__file-summary">
          <strong>{{ item.file.name }}</strong>
          <small>{{ item.pageCount }} 页 · {{ formatSize(item.file.size) }}</small>
          <small v-if="item.file.size >= LARGE_PDF_FILE_SIZE" class="pdf-tool__warning">
            大文件处理可能需要较长时间，请保持页面打开。
          </small>
        </div>

        <van-field
          v-model="selection"
          label="导出页码"
          placeholder="例如：1-3,5,8"
          clearable
        />
        <p class="pdf-tool__hint">留空时默认导出全部页面；多页会自动打包为 ZIP 下载。</p>
      </section>

      <section v-if="item" class="pdf-tool__panel">
        <div class="pdf-tool__section-head">
          <h2>导出设置</h2>
          <span class="pdf-tool__value">{{ format.toUpperCase() }}</span>
        </div>

        <div class="pdf-choice">
          <button
            type="button"
            :class="{ 'pdf-choice__item--active': format === 'jpeg' }"
            @click="format = 'jpeg'"
          >
            <van-icon name="photo-o" />
            JPG
          </button>
          <button
            type="button"
            :class="{ 'pdf-choice__item--active': format === 'png' }"
            @click="format = 'png'"
          >
            <van-icon name="photo" />
            PNG
          </button>
        </div>

        <div class="pdf-slider">
          <div>
            <strong>清晰度</strong>
            <span>{{ scalePercent }}%</span>
          </div>
          <van-slider v-model="scalePercent" :min="100" :max="240" :step="10" />
        </div>

        <div v-if="format === 'jpeg'" class="pdf-slider">
          <div>
            <strong>JPG 质量</strong>
            <span>{{ qualityPercent }}%</span>
          </div>
          <van-slider v-model="qualityPercent" :min="50" :max="95" :step="5" />
        </div>
      </section>
    </main>

    <footer class="pdf-tool__footer">
      <van-button type="primary" block :loading="busy" :disabled="!item" @click="onExport">
        导出图片
      </van-button>
    </footer>

    <input
      ref="inputRef"
      class="pdf-tool__input"
      type="file"
      accept="application/pdf,.pdf"
      @change="onFileChange"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { showToast } from 'vant'
import { formatSize } from '@/utils/image'
import {
  LARGE_PDF_FILE_SIZE,
  exportPdfPagesAsImages,
  inspectPdf,
  type PdfFileInfo,
  type PdfImageFormat,
} from '@/utils/pdfTools'

const router = useRouter()
const inputRef = ref<HTMLInputElement | null>(null)
const item = ref<PdfFileInfo | null>(null)
const selection = ref('')
const format = ref<PdfImageFormat>('jpeg')
const scalePercent = ref(160)
const qualityPercent = ref(85)
const busy = ref(false)

const scale = computed(() => scalePercent.value / 100)
const quality = computed(() => qualityPercent.value / 100)

function backToTools(): void {
  router.push('/tools')
}

function pickFile(): void {
  inputRef.value?.click()
}

async function onFileChange(e: Event): Promise<void> {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return

  busy.value = true
  try {
    item.value = await inspectPdf(file)
    selection.value = item.value.pageCount > 1 ? `1-${item.value.pageCount}` : '1'
  } catch (err) {
    showToast(err instanceof Error ? err.message : 'PDF 读取失败')
  } finally {
    busy.value = false
  }
}

async function onExport(): Promise<void> {
  if (!item.value) return
  busy.value = true
  try {
    const count = await exportPdfPagesAsImages(item.value.file, {
      selection: selection.value,
      format: format.value,
      scale: scale.value,
      quality: quality.value,
    })
    showToast(`已导出 ${count} 张图片`)
  } catch (err) {
    showToast(err instanceof Error ? err.message : '导出失败')
  } finally {
    busy.value = false
  }
}
</script>
