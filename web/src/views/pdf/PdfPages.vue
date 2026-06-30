<template>
  <div class="pdf-tool">
    <van-nav-bar title="PDF 页面管理" left-arrow @click-left="backToTools" />

    <main class="pdf-tool__body">
      <section class="pdf-tool__panel">
        <p class="pdf-tool__note">
          <van-icon name="lock" />
          文件仅在当前设备处理，不会上传到服务器。
        </p>
        <button class="pdf-tool__pick" type="button" @click="pickFile">
          <van-icon name="records-o" />
          <strong>选择 PDF</strong>
          <span>排序、删除、旋转页面后导出</span>
        </button>
      </section>

      <section v-if="file" class="pdf-tool__panel">
        <div class="pdf-tool__file-summary">
          <strong>{{ file.name }}</strong>
          <small>{{ originalPageCount }} 页 · {{ formatSize(file.size) }}</small>
          <small v-if="file.size >= LARGE_PDF_FILE_SIZE" class="pdf-tool__warning">
            大文件处理可能需要较长时间，请保持页面打开。
          </small>
        </div>
        <div class="pdf-tool__section-head">
          <h2>页面列表</h2>
          <button type="button" @click="resetPages">重置</button>
        </div>
        <ul class="pdf-page-list">
          <li v-for="(page, index) in pages" :key="page.id">
            <div class="pdf-page-list__info">
              <strong>{{ page.label }}</strong>
              <small>当前位置 {{ index + 1 }} · 旋转 {{ page.rotation }}°</small>
            </div>
            <div class="pdf-page-list__actions">
              <button type="button" :disabled="index === 0" @click="movePage(index, -1)">
                上移
              </button>
              <button
                type="button"
                :disabled="index === pages.length - 1"
                @click="movePage(index, 1)"
              >
                下移
              </button>
              <button type="button" @click="rotatePage(index)">旋转</button>
              <button type="button" :disabled="pages.length === 1" @click="deletePage(index)">
                删除
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
        :disabled="!file || !pages.length"
        @click="onExport"
      >
        导出管理后的 PDF
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
  createPdfPageItems,
  exportManagedPdf,
  inspectPdf,
  type PdfPageItem,
} from '@/utils/pdfTools'

const router = useRouter()
const inputRef = ref<HTMLInputElement | null>(null)
const file = ref<File | null>(null)
const originalPageCount = ref(0)
const pages = ref<PdfPageItem[]>([])
const busy = ref(false)

function backToTools(): void {
  router.push('/tools')
}

function pickFile(): void {
  inputRef.value?.click()
}

async function onFileChange(e: Event): Promise<void> {
  const input = e.target as HTMLInputElement
  const nextFile = input.files?.[0]
  input.value = ''
  if (!nextFile) return

  busy.value = true
  try {
    const info = await inspectPdf(nextFile)
    file.value = info.file
    originalPageCount.value = info.pageCount
    pages.value = createPdfPageItems(info.pageCount)
  } catch (err) {
    showToast(err instanceof Error ? err.message : 'PDF 读取失败')
  } finally {
    busy.value = false
  }
}

function resetPages(): void {
  pages.value = createPdfPageItems(originalPageCount.value)
}

function movePage(index: number, direction: -1 | 1): void {
  const target = index + direction
  if (target < 0 || target >= pages.value.length) return
  const next = [...pages.value]
  const [item] = next.splice(index, 1)
  next.splice(target, 0, item)
  pages.value = next
}

function rotatePage(index: number): void {
  const page = pages.value[index]
  if (!page) return
  page.rotation = (page.rotation + 90) % 360
}

function deletePage(index: number): void {
  if (pages.value.length <= 1) return
  pages.value.splice(index, 1)
}

async function onExport(): Promise<void> {
  if (!file.value) return
  busy.value = true
  try {
    await exportManagedPdf(file.value, pages.value)
    showToast('已导出 PDF')
  } catch (err) {
    showToast(err instanceof Error ? err.message : '导出失败')
  } finally {
    busy.value = false
  }
}
</script>
