<template>
  <div class="pdf-tool">
    <van-nav-bar title="PDF 拆分" left-arrow @click-left="backToTools" />

    <main class="pdf-tool__body">
      <section class="pdf-tool__panel">
        <p class="pdf-tool__note">
          <van-icon name="lock" />
          文件仅在当前设备处理，不会上传到服务器。
        </p>
        <button class="pdf-tool__pick" type="button" @click="pickFile">
          <van-icon name="cluster-o" />
          <strong>选择 PDF</strong>
          <span>输入页码范围后导出新 PDF</span>
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
        <p class="pdf-tool__hint">支持单页、范围和逗号组合；页码会按输入顺序去重导出。</p>
      </section>
    </main>

    <footer class="pdf-tool__footer">
      <van-button
        type="primary"
        block
        :loading="busy"
        :disabled="!item || !selection.trim()"
        @click="onSplit"
      >
        导出拆分后的 PDF
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
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { showToast } from 'vant'
import { formatSize } from '@/utils/image'
import {
  LARGE_PDF_FILE_SIZE,
  inspectPdf,
  splitPdfFile,
  type PdfFileInfo,
} from '@/utils/pdfTools'

const router = useRouter()
const inputRef = ref<HTMLInputElement | null>(null)
const item = ref<PdfFileInfo | null>(null)
const selection = ref('')
const busy = ref(false)

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

async function onSplit(): Promise<void> {
  if (!item.value) return
  busy.value = true
  try {
    await splitPdfFile(item.value.file, selection.value)
    showToast('已导出新 PDF')
  } catch (err) {
    showToast(err instanceof Error ? err.message : '拆分失败')
  } finally {
    busy.value = false
  }
}
</script>
