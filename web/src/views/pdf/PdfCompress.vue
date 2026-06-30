<template>
  <div class="pdf-tool">
    <van-nav-bar title="PDF 压缩" left-arrow @click-left="backToTools" />

    <main class="pdf-tool__body">
      <section class="pdf-tool__panel">
        <p class="pdf-tool__note">
          <van-icon name="lock" />
          文件仅在当前设备处理，不会上传到服务器。
        </p>
        <button class="pdf-tool__pick" type="button" @click="pickFile">
          <van-icon name="shrink" />
          <strong>选择 PDF</strong>
          <span>重新渲染页面并按图片质量压缩</span>
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
        <p class="pdf-tool__hint">压缩会把页面重新生成图片型 PDF，适合扫描件；文字型 PDF 可能失去可复制文字。</p>
      </section>

      <section v-if="item" class="pdf-tool__panel">
        <div class="pdf-tool__section-head">
          <h2>压缩设置</h2>
          <span class="pdf-tool__value">{{ qualityPercent }}%</span>
        </div>

        <div class="pdf-slider">
          <div>
            <strong>图片质量</strong>
            <span>{{ qualityPercent }}%</span>
          </div>
          <van-slider v-model="qualityPercent" :min="40" :max="90" :step="5" />
        </div>

        <div class="pdf-slider">
          <div>
            <strong>渲染清晰度</strong>
            <span>{{ scalePercent }}%</span>
          </div>
          <van-slider v-model="scalePercent" :min="90" :max="180" :step="10" />
        </div>

        <div v-if="resultText" class="pdf-result">
          <van-icon name="passed" />
          <span>{{ resultText }}</span>
        </div>
      </section>
    </main>

    <footer class="pdf-tool__footer">
      <van-button type="primary" block :loading="busy" :disabled="!item" @click="onCompress">
        导出压缩后的 PDF
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
  compressPdfFile,
  inspectPdf,
  type PdfFileInfo,
} from '@/utils/pdfTools'

const router = useRouter()
const inputRef = ref<HTMLInputElement | null>(null)
const item = ref<PdfFileInfo | null>(null)
const qualityPercent = ref(70)
const scalePercent = ref(120)
const resultText = ref('')
const busy = ref(false)

const quality = computed(() => qualityPercent.value / 100)
const scale = computed(() => scalePercent.value / 100)

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
  resultText.value = ''
  try {
    item.value = await inspectPdf(file)
  } catch (err) {
    showToast(err instanceof Error ? err.message : 'PDF 读取失败')
  } finally {
    busy.value = false
  }
}

async function onCompress(): Promise<void> {
  if (!item.value) return
  busy.value = true
  try {
    const result = await compressPdfFile(item.value.file, {
      quality: quality.value,
      scale: scale.value,
    })
    resultText.value = `${formatSize(result.originalSize)} → ${formatSize(result.outputSize)}`
    showToast('已导出压缩 PDF')
  } catch (err) {
    showToast(err instanceof Error ? err.message : '压缩失败')
  } finally {
    busy.value = false
  }
}
</script>
