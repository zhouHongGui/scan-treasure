import { useCameraCapture } from './useCameraCapture'
import type { CameraCaptureResult } from './useCameraCapture'

/**
 * 统一的「拍照」入口，按平台分流：
 * 点击后先请求摄像头权限，授权成功才打开自定义扫描界面 CameraOverlay。
 */
export function useCapture() {
  const camera = useCameraCapture()

  function takePhoto(): Promise<CameraCaptureResult | null> {
    return camera.open()
  }

  return { takePhoto }
}
