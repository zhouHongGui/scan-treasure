<template>
  <div class="pdf-tool">
    <van-nav-bar title="添加页码" left-arrow @click-left="backToTools" />

    <main class="pdf-tool__body">
      <section class="pdf-tool__panel">
        <p class="pdf-tool__note">
          <van-icon name="lock" />
          文件仅在当前设备处理，不会上传到服务器。
        </p>
        <button class="pdf-tool__pick" type="button" @click="pickFile">
          <van-icon name="orders-o" />
          <strong>选择 PDF</strong>
          <span>为每一页自动添加页码</span>
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

        <van-field v-model="startText" type="number" label="起始页码" placeholder="1" />
        <van-cell center title="显示总页数">
          <template #right-icon>
            <van-switch v-model="showTotal" size="22px" />
          </template>
        </van-cell>
      </section>

      <section v-if="item" class="pdf-tool__panel">
        <div class="pdf-tool__section-head">
          <h2>页码位置</h2>
          <span class="pdf-tool__value">{{ positionLabel }}</span>
        </div>

        <div class="pdf-choice pdf-choice--three">
          <button
            type="button"
            :class="{ 'pdf-choice__item--active': position === 'bottom-center' }"
            @click="position = 'bottom-center'"
          >
            底部居中
          </button>
          <button
            type="button"
            :class="{ 'pdf-choice__item--active': position === 'bottom-right' }"
            @click="position = 'bottom-right'"
          >
            底部右侧
          </button>
          <button
            type="button"
            :class="{ 'pdf-choice__item--active': position === 'top-right' }"
            @click="position = 'top-right'"
          >
            顶部右侧
          </button>
        </div>

        <div class="pdf-slider">
          <div>
            <strong>字号</strong>
            <span>{{ fontSize }}pt</span>
          </div>
          <van-slider v-model="fontSize" :min="9" :max="18" :step="1" />
        </div>

        <div class="pdf-slider">
          <div>
            <strong>边距</strong>
            <span>{{ margin }}pt</span>
          </div>
          <van-slider v-model="margin" :min="18" :max="60" :step="2" />
        </div>
      </section>
    </main>

    <footer class="pdf-tool__footer">
      <van-button type="primary" block :loading="busy" :disabled="!item" @click="onExport">
        导出带页码 PDF
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
  addPageNumbersToPdf,
  inspectPdf,
  type PageNumberPosition,
  type PdfFileInfo,
} from '@/utils/pdfTools'

const router = useRouter()
const inputRef = ref<HTMLInputElement | null>(null)
const item = ref<PdfFileInfo | null>(null)
const startText = ref('1')
const showTotal = ref(true)
const position = ref<PageNumberPosition>('bottom-center')
const fontSize = ref(11)
const margin = ref(28)
const busy = ref(false)

const positionLabel = computed(() => {
  if (position.value === 'bottom-right') return '底部右侧'
  if (position.value === 'top-right') return '顶部右侧'
  return '底部居中'
})

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
  } catch (err) {
    showToast(err instanceof Error ? err.message : 'PDF 读取失败')
  } finally {
    busy.value = false
  }
}

async function onExport(): Promise<void> {
  if (!item.value) return
  const start = Number(startText.value)
  if (!Number.isFinite(start) || start < 1) {
    showToast('起始页码必须大于 0')
    return
  }

  busy.value = true
  try {
    await addPageNumbersToPdf(item.value.file, {
      start,
      fontSize: fontSize.value,
      margin: margin.value,
      position: position.value,
      showTotal: showTotal.value,
    })
    showToast('已导出带页码 PDF')
  } catch (err) {
    showToast(err instanceof Error ? err.message : '导出失败')
  } finally {
    busy.value = false
  }
}
</script>
