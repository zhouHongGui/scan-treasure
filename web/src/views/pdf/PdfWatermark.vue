<template>
  <div class="pdf-tool">
    <van-nav-bar title="添加水印" left-arrow @click-left="backToTools" />

    <main class="pdf-tool__body">
      <section class="pdf-tool__panel">
        <p class="pdf-tool__note">
          <van-icon name="lock" />
          文件仅在当前设备处理，不会上传到服务器。
        </p>
        <button class="pdf-tool__pick" type="button" @click="pickFile">
          <van-icon name="font-o" />
          <strong>选择 PDF</strong>
          <span>添加文字水印后导出新文件</span>
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

        <van-field v-model="text" label="水印文字" placeholder="例如：仅供内部使用" clearable />
        <van-cell center title="平铺水印">
          <template #right-icon>
            <van-switch v-model="repeat" size="22px" />
          </template>
        </van-cell>
      </section>

      <section v-if="item" class="pdf-tool__panel">
        <div class="pdf-tool__section-head">
          <h2>水印样式</h2>
          <span class="pdf-tool__value">{{ opacityPercent }}%</span>
        </div>

        <div class="pdf-slider">
          <div>
            <strong>字号</strong>
            <span>{{ fontSize }}px</span>
          </div>
          <van-slider v-model="fontSize" :min="22" :max="72" :step="2" />
        </div>

        <div class="pdf-slider">
          <div>
            <strong>透明度</strong>
            <span>{{ opacityPercent }}%</span>
          </div>
          <van-slider v-model="opacityPercent" :min="10" :max="50" :step="5" />
        </div>

        <div class="pdf-slider">
          <div>
            <strong>旋转角度</strong>
            <span>{{ rotation }}°</span>
          </div>
          <van-slider v-model="rotation" :min="-60" :max="60" :step="5" />
        </div>
      </section>
    </main>

    <footer class="pdf-tool__footer">
      <van-button
        type="primary"
        block
        :loading="busy"
        :disabled="!item || !text.trim()"
        @click="onExport"
      >
        导出带水印 PDF
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
  addWatermarkToPdf,
  inspectPdf,
  type PdfFileInfo,
} from '@/utils/pdfTools'

const router = useRouter()
const inputRef = ref<HTMLInputElement | null>(null)
const item = ref<PdfFileInfo | null>(null)
const text = ref('仅供查看')
const repeat = ref(true)
const fontSize = ref(36)
const opacityPercent = ref(18)
const rotation = ref(-30)
const busy = ref(false)

const opacity = computed(() => opacityPercent.value / 100)

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
  busy.value = true
  try {
    await addWatermarkToPdf(item.value.file, {
      text: text.value,
      repeat: repeat.value,
      fontSize: fontSize.value,
      opacity: opacity.value,
      rotation: rotation.value,
    })
    showToast('已导出带水印 PDF')
  } catch (err) {
    showToast(err instanceof Error ? err.message : '导出失败')
  } finally {
    busy.value = false
  }
}
</script>
