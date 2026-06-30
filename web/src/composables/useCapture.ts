import { useCameraCapture } from './useCameraCapture'

/**
 * 统一的「拍照」入口，按平台分流：
 * 点击后统一打开自定义扫描界面 CameraOverlay。
 * CameraOverlay 内部调用 getUserMedia，浏览器会在用户点击后请求摄像头权限。
 */
export function useCapture() {
  const camera = useCameraCapture()

  function takePhoto(): Promise<string | null> {
    return camera.open()
  }

  return { takePhoto }
}
