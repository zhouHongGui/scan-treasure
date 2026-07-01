import { ref } from 'vue'
import type { Corner } from '@/utils/geometry'

export interface CameraCaptureResult {
  dataUrl: string
  corners?: Corner[]
}

/**
 * 摄像头拍摄：全局单例。open() 先请求摄像头权限，授权成功后才打开全屏取景界面并返回 Promise；
 * 用户拍摄后 resolve(dataUrl)，取消则 resolve(null)。
 * 实际取景 UI 见 components/CameraOverlay.vue（由 App.vue 在 isOpen 时挂载）。
 */
const isOpen = ref(false)
const hasRequest = ref(false)
let pendingStream: MediaStream | null = null
let resolver: ((value: CameraCaptureResult | null) => void) | null = null

function stopPendingStream(): void {
  pendingStream?.getTracks().forEach((track) => track.stop())
  pendingStream = null
}

function cameraErrorMessage(e: unknown): string {
  if (!navigator.mediaDevices?.getUserMedia) {
    return '当前环境不支持摄像头，请使用 HTTPS 网页、localhost 或 App 扫描。'
  }

  const name = e instanceof Error ? e.name : ''
  if (
    name === 'NotFoundError' ||
    name === 'DevicesNotFoundError' ||
    name === 'OverconstrainedError'
  ) {
    return '未找到摄像头，或摄像头正被占用。请在带摄像头的设备上使用。'
  }
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return '摄像头权限未授权，请允许摄像头权限后再点击扫描。'
  }
  if (name === 'NotReadableError') {
    return '摄像头被占用，请关闭其它正在使用摄像头的程序后重试。'
  }
  return name ? `无法访问摄像头（${name}）` : '无法访问摄像头，请检查设备和权限。'
}

async function requestCameraStream(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error(cameraErrorMessage(null))
  }

  try {
    return await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 2560 },
        height: { ideal: 1440 },
      },
      audio: false,
    })
  } catch (e) {
    throw new Error(cameraErrorMessage(e))
  }
}

export function useCameraCapture() {
  return {
    isOpen,
    hasRequest,
    async open(): Promise<CameraCaptureResult | null> {
      resolver?.(null)
      resolver = null
      stopPendingStream()

      hasRequest.value = true
      try {
        pendingStream = await requestCameraStream()
      } catch (e) {
        hasRequest.value = false
        isOpen.value = false
        throw e
      }

      isOpen.value = true
      return new Promise<CameraCaptureResult | null>((resolve) => {
        resolver = resolve
      })
    },
    consumeStream(): MediaStream | null {
      const stream = pendingStream
      pendingStream = null
      return stream
    },
    close(value: CameraCaptureResult | null): void {
      isOpen.value = false
      hasRequest.value = false
      stopPendingStream()
      resolver?.(value)
      resolver = null
    },
    reset(): void {
      isOpen.value = false
      hasRequest.value = false
      stopPendingStream()
      resolver?.(null)
      resolver = null
    },
  }
}
