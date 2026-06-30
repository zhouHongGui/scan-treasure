<template>
  <div class="pdf-tool">
    <van-nav-bar title="PDF 合并" left-arrow @click-left="backToTools" />

    <main class="pdf-tool__body">
      <section class="pdf-tool__panel">
        <p class="pdf-tool__note">
          <van-icon name="lock" />
          文件仅在当前设备处理，不会上传到服务器。
        </p>
        <button class="pdf-tool__pick" type="button" @click="pickFiles">
          <van-icon name="description" />
          <strong>选择多个 PDF</strong>
          <span>按选择顺序合并为一个文件</span>
        </button>
      </section>

      <section v-if="items.length" class="pdf-tool__panel">
        <div class="pdf-tool__section-head">
          <h2>待合并文件</h2>
          <button type="button" @click="clearFiles">清空</button>
        </div>
        <p v-if="totalSize >= LARGE_PDF_FILE_SIZE" class="pdf-tool__warning">
          文件总量较大，处理可能需要较长时间，请保持页面打开。
        </p>
        <ul class="pdf-file-list">
          <li v-for="(item, index) in items" :key="`${item.file.name}-${index}`">
            <span>{{ index + 1 }}</span>
            <div>
              <strong>{{ item.file.name }}</strong>
              <small>{{ item.pageCount }} 页 · {{ formatSize(item.file.size) }}</small>
            </div>
            <div class="pdf-file-list__actions">
              <button type="button" :disabled="index === 0" @click="moveFile(index, -1)">
                <van-icon name="arrow-up" />
              </button>
              <button
                type="button"
                :disabled="index === items.length - 1"
                @click="moveFile(index, 1)"
              >
                <van-icon name="arrow-down" />
              </button>
              <button type="button" @click="removeFile(index)">
                <van-icon name="delete-o" />
              </button>
            </div>
          </li>
        </ul>
      </section>
    </main>

    <footer class="pdf-tool__footer">
      <van-button
        type="primary"
        block
        :loading="busy"
        :disabled="items.length < 2"
        @click="onMerge"
      >
        导出合并后的 PDF
      </van-button>
    </footer>

    <input
      ref="inputRef"
      class="pdf-tool__input"
      type="file"
      accept="application/pdf,.pdf"
      multiple
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
  inspectPdf,
  mergePdfFiles,
  type PdfFileInfo,
} from '@/utils/pdfTools'

const router = useRouter()
const inputRef = ref<HTMLInputElement | null>(null)
const items = ref<PdfFileInfo[]>([])
const busy = ref(false)
const totalSize = computed(() => items.value.reduce((sum, item) => sum + item.file.size, 0))

function backToTools(): void {
  router.push('/tools')
}

function pickFiles(): void {
  inputRef.value?.click()
}

function clearFiles(): void {
  items.value = []
}

function removeFile(index: number): void {
  items.value.splice(index, 1)
}

function moveFile(index: number, direction: -1 | 1): void {
  const target = index + direction
  if (target < 0 || target >= items.value.length) return
  const next = [...items.value]
  const [item] = next.splice(index, 1)
  next.splice(target, 0, item)
  items.value = next
}

async function onFileChange(e: Event): Promise<void> {
  const input = e.target as HTMLInputElement
  const files = Array.from(input.files || [])
  input.value = ''
  if (!files.length) return

  busy.value = true
  try {
    const inspected = await Promise.all(files.map((file) => inspectPdf(file)))
    items.value.push(...inspected)
  } catch (err) {
    showToast(err instanceof Error ? err.message : 'PDF 读取失败')
  } finally {
    busy.value = false
  }
}

async function onMerge(): Promise<void> {
  busy.value = true
  try {
    await mergePdfFiles(items.value.map((item) => item.file))
    showToast('已导出合并 PDF')
  } catch (err) {
    showToast(err instanceof Error ? err.message : '合并失败')
  } finally {
    busy.value = false
  }
}
</script>
