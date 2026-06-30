<template>
  <div class="pdf-tool">
    <van-nav-bar title="图片转 PDF" left-arrow @click-left="backToTools" />

    <main class="pdf-tool__body">
      <section class="pdf-tool__panel">
        <p class="pdf-tool__note">
          <van-icon name="lock" />
          文件仅在当前设备处理，不会上传到服务器。
        </p>
        <button class="pdf-tool__pick" type="button" @click="pickImages">
          <van-icon name="photo-o" />
          <strong>选择图片</strong>
          <span>多张图片会按选择顺序生成 A4 PDF</span>
        </button>
      </section>

      <section v-if="files.length" class="pdf-tool__panel">
        <div class="pdf-tool__section-head">
          <h2>待转换图片</h2>
          <button type="button" @click="clearFiles">清空</button>
        </div>
        <p v-if="totalSize >= LARGE_PDF_FILE_SIZE" class="pdf-tool__warning">
          图片总量较大，处理可能需要较长时间，请保持页面打开。
        </p>
        <ul class="pdf-file-list">
          <li v-for="(file, index) in files" :key="`${file.name}-${index}`">
            <span>{{ index + 1 }}</span>
            <div>
              <strong>{{ file.name }}</strong>
              <small>{{ formatSize(file.size) }}</small>
            </div>
            <div class="pdf-file-list__actions">
              <button type="button" :disabled="index === 0" @click="moveFile(index, -1)">
                <van-icon name="arrow-up" />
              </button>
              <button
                type="button"
                :disabled="index === files.length - 1"
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
        :disabled="!files.length"
        @click="onExport"
      >
        导出图片 PDF
      </van-button>
    </footer>

    <input
      ref="inputRef"
      class="pdf-tool__input"
      type="file"
      accept="image/*"
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
import { LARGE_PDF_FILE_SIZE, imagesToPdf } from '@/utils/pdfTools'

const router = useRouter()
const inputRef = ref<HTMLInputElement | null>(null)
const files = ref<File[]>([])
const busy = ref(false)
const totalSize = computed(() => files.value.reduce((sum, file) => sum + file.size, 0))

function backToTools(): void {
  router.push('/tools')
}

function pickImages(): void {
  inputRef.value?.click()
}

function clearFiles(): void {
  files.value = []
}

function removeFile(index: number): void {
  files.value.splice(index, 1)
}

function moveFile(index: number, direction: -1 | 1): void {
  const target = index + direction
  if (target < 0 || target >= files.value.length) return
  const next = [...files.value]
  const [item] = next.splice(index, 1)
  next.splice(target, 0, item)
  files.value = next
}

function onFileChange(e: Event): void {
  const input = e.target as HTMLInputElement
  const picked = Array.from(input.files || []).filter((file) =>
    file.type.startsWith('image/'),
  )
  input.value = ''
  if (!picked.length) {
    showToast('请选择图片文件')
    return
  }
  files.value.push(...picked)
}

async function onExport(): Promise<void> {
  busy.value = true
  try {
    await imagesToPdf(files.value)
    showToast('已导出 PDF')
  } catch (err) {
    showToast(err instanceof Error ? err.message : '导出失败')
  } finally {
    busy.value = false
  }
}
</script>
