import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { PickedImage } from '@/composables/useImagePicker'
import type { Corner } from '@/utils/geometry'
import type { EnhanceMode } from '@/composables/useImageProcess'

/** 单页扫描的状态：原图、处理用图、角点 */
export const useScanStore = defineStore('scan', () => {
  // 用户选中的原始图片
  const originalImage = ref<PickedImage | null>(null)
  // 压缩后的处理用图（喂给透视校正），角点坐标基于它的尺寸
  const workingImage = ref<{
    dataUrl: string
    width: number
    height: number
  } | null>(null)
  // 文档四角（workingImage 像素坐标，顺序：左上→右上→右下→左下）
  const corners = ref<Corner[]>([])
  // 透视校正后的正视图（M3 产物，喂给 M4 增强）
  const warpedImage = ref<{
    dataUrl: string
    width: number
    height: number
  } | null>(null)
  // 当前增强模式（默认彩色）
  const enhanceMode = ref<EnhanceMode>('color')
  // 增强后的最终图片（M4 产物，用于 M5 导出）
  const enhancedImage = ref<{
    dataUrl: string
    width: number
    height: number
  } | null>(null)

  function setImage(img: PickedImage) {
    originalImage.value = img
  }
  function setWorkingImage(data: {
    dataUrl: string
    width: number
    height: number
  }) {
    workingImage.value = data
  }
  function setCorners(c: Corner[]) {
    corners.value = c
  }
  function setWarpedImage(data: {
    dataUrl: string
    width: number
    height: number
  }) {
    warpedImage.value = data
  }
  function setEnhanceMode(mode: EnhanceMode) {
    enhanceMode.value = mode
  }
  function setEnhancedImage(data: {
    dataUrl: string
    width: number
    height: number
  }) {
    enhancedImage.value = data
  }
  function reset() {
    originalImage.value = null
    workingImage.value = null
    corners.value = []
    warpedImage.value = null
    enhanceMode.value = 'color'
    enhancedImage.value = null
  }

  return {
    originalImage,
    workingImage,
    corners,
    warpedImage,
    enhanceMode,
    enhancedImage,
    setImage,
    setWorkingImage,
    setCorners,
    setWarpedImage,
    setEnhanceMode,
    setEnhancedImage,
    reset,
  }
})
