import { Capacitor } from '@capacitor/core'
import { useCameraCapture } from './useCameraCapture'

/**
 * 统一的「拍照」入口，按平台分流：
 * - App（Capacitor 原生）：用自定义扫描界面 CameraOverlay（getUserMedia 取景 + 引导框 + 自动检测）
 * - H5（浏览器）：用系统相机（<input capture>），手机上直接调起后置摄像头，体验顺、无需在网页里反复授权
 */
export function useCapture() {
  const camera = useCameraCapture()

  function takePhoto(): Promise<string | null> {
    return Capacitor.isNativePlatform() ? camera.open() : takeViaSystemCamera()
  }

  return { takePhoto }
}

/** H5：用 <input type=file accept=image/* capture> 调起系统相机，返回 dataUrl 或 null（取消/失败） */
function takeViaSystemCamera(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    // capture=environment：手机上直接开后置摄像头；桌面浏览器忽略、退化为选图
    input.setAttribute('capture', 'environment')
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file) return resolve(null)
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(file)
    }
    input.click()
  })
}
