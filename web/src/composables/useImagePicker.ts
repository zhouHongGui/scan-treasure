import { ref, onUnmounted } from 'vue'
import { getImageSize } from '@/utils/image'

/** 选中的图片信息（摄像头拍摄无 file/url，故设为可选） */
export interface PickedImage {
  file?: File
  /** objectURL，用于 <img> 显示（性能优于 base64） */
  url?: string
  /** base64 dataURL，后续喂给透视校正时使用 */
  dataUrl: string
  width: number
  height: number
}

/**
 * 图片选择 composable
 * 负责：文件校验、生成显示用 url、读取处理用 dataUrl、获取尺寸、释放 objectURL
 */
export function useImagePicker() {
  const image = ref<PickedImage | null>(null)
  const loading = ref(false)
  const error = ref('')

  async function loadFile(file: File): Promise<void> {
    error.value = ''

    if (!file.type.startsWith('image/')) {
      error.value = '请选择图片文件'
      return
    }

    loading.value = true
    try {
      // 释放上一张的 objectURL，避免内存泄漏
      if (image.value?.url) {
        URL.revokeObjectURL(image.value.url)
      }

      const url = URL.createObjectURL(file)
      const [dataUrl, size] = await Promise.all([
        readAsDataURL(file),
        getImageSize(url),
      ])

      image.value = { file, url, dataUrl, ...size }
    } catch (e) {
      error.value = e instanceof Error ? e.message : '图片加载失败'
      image.value = null
    } finally {
      loading.value = false
    }
  }

  function reset(): void {
    if (image.value?.url) {
      URL.revokeObjectURL(image.value.url)
    }
    image.value = null
    error.value = ''
  }

  onUnmounted(() => {
    if (image.value?.url) {
      URL.revokeObjectURL(image.value.url)
    }
  })

  return { image, loading, error, loadFile, reset }
}

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('读取文件失败'))
    reader.readAsDataURL(file)
  })
}
