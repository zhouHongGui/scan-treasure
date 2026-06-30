/**
 * 图片处理工具函数
 */

/** 加载图片为 HTMLImageElement */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('图片加载失败'))
    img.src = src
  })
}

/** 获取图片原始尺寸 */
export function getImageSize(
  src: string,
): Promise<{ width: number; height: number }> {
  return loadImage(src).then((img) => ({
    width: img.naturalWidth,
    height: img.naturalHeight,
  }))
}

/** 格式化文件大小 */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

/**
 * 将图片压缩到最长边不超过 maxSide，返回 JPEG dataURL
 * 用途：进透视校正前预处理，控制尺寸以兼顾清晰度与处理速度
 */
export async function compressToDataUrl(
  src: string,
  maxSide = 2000,
  quality = 0.92,
): Promise<{ dataUrl: string; width: number; height: number }> {
  const img = await loadImage(src)
  let w = img.naturalWidth
  let h = img.naturalHeight

  const longest = Math.max(w, h)
  if (longest > maxSide) {
    const scale = maxSide / longest
    w = Math.round(w * scale)
    h = Math.round(h * scale)
  }

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas 2d 上下文不可用')
  ctx.drawImage(img, 0, 0, w, h)
  return { dataUrl: canvas.toDataURL('image/jpeg', quality), width: w, height: h }
}
