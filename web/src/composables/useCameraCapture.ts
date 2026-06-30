import { ref } from 'vue'

/**
 * 摄像头拍摄：全局单例。open() 打开全屏取景界面并返回 Promise；
 * 用户拍摄后 resolve(dataUrl)，取消则 resolve(null)。
 * 实际取景 UI 见 components/CameraOverlay.vue（由 App.vue 在 isOpen 时挂载）。
 */
const isOpen = ref(false)
const hasRequest = ref(false)
let resolver: ((value: string | null) => void) | null = null

export function useCameraCapture() {
  return {
    isOpen,
    hasRequest,
    open(): Promise<string | null> {
      resolver?.(null)
      resolver = null
      hasRequest.value = true
      isOpen.value = true
      return new Promise<string | null>((resolve) => {
        resolver = resolve
      })
    },
    close(value: string | null): void {
      isOpen.value = false
      hasRequest.value = false
      resolver?.(value)
      resolver = null
    },
    reset(): void {
      isOpen.value = false
      hasRequest.value = false
      resolver?.(null)
      resolver = null
    },
  }
}
