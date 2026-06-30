import { jsPDF } from 'jspdf'
import { loadImage } from './image'
import { downloadBlob } from './files'

/**
 * 单张图片导出为 PDF（A4，按比例居中）
 *
 * 规格（docs/04）：
 *   - JPEG 质量 0.85
 *   - A4 (210×297mm) 居中按原图比例适配
 *   - 图片最长边压缩到 ≤ 2000px，在 A4 上可满足 ≥150 DPI
 *
 * @param dataUrl  图片 dataUrl（JPEG）
 * @param opts     文件名、是否横向
 */
export async function exportImageToPdf(
  dataUrl: string,
  opts: { filename?: string; landscape?: boolean } = {},
): Promise<void> {
  const filename = opts.filename || `scan-treasure-${stamp()}.pdf`

  // 校验图片可解码，提前失败而非在 addImage 才报错
  const img = await loadImage(dataUrl)
  const orient = opts.landscape ? 'landscape' : 'portrait'
  const doc = new jsPDF({ orientation: orient, unit: 'mm', format: 'a4' })

  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()

  // 留 10mm 边距，按原图比例缩放到页面内
  const margin = 10
  const availW = pageW - margin * 2
  const availH = pageH - margin * 2
  const imgRatio = img.naturalWidth / img.naturalHeight
  let w = availW
  let h = availW / imgRatio
  if (h > availH) {
    h = availH
    w = availH * imgRatio
  }
  const x = (pageW - w) / 2
  const y = (pageH - h) / 2

  // 重新编码为 0.85 JPEG，统一质量并降低体积
  const jpeg = await reencodeJpeg(img, 0.85)
  doc.addImage(jpeg, 'JPEG', x, y, w, h)
  await downloadBlob(doc.output('blob'), filename)
}

/** 直接导出图片文件（PNG/JPEG 原样落盘） */
export async function exportImageFile(
  dataUrl: string,
  filename = `scan-treasure-${stamp()}.jpg`,
): Promise<void> {
  const blob = dataUrlToBlob(dataUrl)
  await downloadBlob(blob, filename)
}

/** 把 dataURL 转 Blob */
export function dataUrlToBlob(dataUrl: string): Blob {
  const [head, base64] = dataUrl.split(',')
  const mime = head.match(/data:(.*?);/)?.[1] || 'image/jpeg'
  const bin = atob(base64 || '')
  const len = bin.length
  const u8 = new Uint8Array(len)
  for (let i = 0; i < len; i++) u8[i] = bin.charCodeAt(i)
  return new Blob([u8], { type: mime })
}

async function reencodeJpeg(
  img: HTMLImageElement,
  quality: number,
): Promise<string> {
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas 2d 上下文不可用')
  ctx.drawImage(img, 0, 0)
  return canvas.toDataURL('image/jpeg', quality)
}

function stamp(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return (
    `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}` +
    `${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
  )
}
