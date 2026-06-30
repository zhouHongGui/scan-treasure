import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib'
import { jsPDF } from 'jspdf'
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { loadImage } from './image'
import { createStamp, downloadBlob, readAsArrayBuffer, readAsDataUrl } from './files'

export interface PdfFileInfo {
  file: File
  pageCount: number
}

export interface PdfPageItem {
  id: string
  pageIndex: number
  label: string
  rotation: number
}

export type PdfImageFormat = 'png' | 'jpeg'
export type PageNumberPosition = 'bottom-center' | 'bottom-right' | 'top-right'

export interface PdfToImageOptions {
  selection: string
  format: PdfImageFormat
  scale: number
  quality: number
}

export interface PdfCompressOptions {
  scale: number
  quality: number
}

export interface WatermarkOptions {
  text: string
  fontSize: number
  opacity: number
  rotation: number
  repeat: boolean
}

export interface PageNumberOptions {
  start: number
  fontSize: number
  margin: number
  position: PageNumberPosition
  showTotal: boolean
}

export const LARGE_PDF_FILE_SIZE = 100 * 1024 * 1024

export async function inspectPdf(file: File): Promise<PdfFileInfo> {
  const pdf = await loadPdfDocument(file)
  return { file, pageCount: pdf.getPageCount() }
}

export async function mergePdfFiles(files: File[]): Promise<void> {
  if (files.length < 2) throw new Error('请至少选择 2 个 PDF')

  const output = await PDFDocument.create()
  for (const file of files) {
    const input = await loadPdfDocument(file)
    const pages = await output.copyPages(input, input.getPageIndices())
    pages.forEach((page) => output.addPage(page))
  }

  await savePdf(output, `扫描宝-PDF合并-${createStamp()}.pdf`)
}

export async function splitPdfFile(
  file: File,
  pageSelection: string,
): Promise<void> {
  const input = await loadPdfDocument(file)
  const indices = parsePageSelection(pageSelection, input.getPageCount())
  if (!indices.length) throw new Error('请选择要导出的页面')

  const output = await PDFDocument.create()
  const pages = await output.copyPages(input, indices)
  pages.forEach((page) => output.addPage(page))
  await savePdf(output, `扫描宝-PDF拆分-${createStamp()}.pdf`)
}

export async function exportManagedPdf(
  file: File,
  pagesToExport: PdfPageItem[],
): Promise<void> {
  if (!pagesToExport.length) throw new Error('至少保留 1 页')

  const input = await loadPdfDocument(file)
  const output = await PDFDocument.create()
  const copied = await output.copyPages(
    input,
    pagesToExport.map((page) => page.pageIndex),
  )

  copied.forEach((page, index) => {
    const sourceRotation = page.getRotation().angle
    const extraRotation = pagesToExport[index]?.rotation || 0
    page.setRotation(degrees(normalizeDegrees(sourceRotation + extraRotation)))
    output.addPage(page)
  })

  await savePdf(output, `扫描宝-PDF页面管理-${createStamp()}.pdf`)
}

export async function imagesToPdf(files: File[]): Promise<void> {
  if (!files.length) throw new Error('请选择图片')

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const margin = 10
  const availW = pageW - margin * 2
  const availH = pageH - margin * 2

  for (let i = 0; i < files.length; i++) {
    if (i > 0) doc.addPage()

    const dataUrl = await readAsDataUrl(files[i])
    const img = await loadImage(dataUrl)
    const imgRatio = img.naturalWidth / img.naturalHeight
    let w = availW
    let h = availW / imgRatio
    if (h > availH) {
      h = availH
      w = availH * imgRatio
    }

    const x = (pageW - w) / 2
    const y = (pageH - h) / 2
    const jpeg = reencodeImage(img, 0.9)
    doc.addImage(jpeg, 'JPEG', x, y, w, h)
  }

  await downloadBlob(doc.output('blob'), `扫描宝-图片转PDF-${createStamp()}.pdf`)
}

export async function exportPdfPagesAsImages(
  file: File,
  options: PdfToImageOptions,
): Promise<number> {
  const pdf = await loadPdfForRender(file)
  const pageCount = pdf.numPages
  const indices = parsePageSelection(options.selection || `1-${pageCount}`, pageCount)
  if (!indices.length) throw new Error('请选择要导出的页面')

  try {
    const images: ZipEntry[] = []
    for (const pageIndex of indices) {
      const page = await pdf.getPage(pageIndex + 1)
      const blob = await renderPageToBlob(page, options)
      images.push({
        name: `第${pageIndex + 1}页.${options.format === 'png' ? 'png' : 'jpg'}`,
        blob,
      })
      page.cleanup()
    }

    if (images.length === 1) {
      await downloadBlob(images[0].blob, `扫描宝-PDF转图片-${createStamp()}-${images[0].name}`)
    } else {
      const zip = await createZip(images)
      await downloadBlob(zip, `扫描宝-PDF转图片-${createStamp()}.zip`)
    }
    return indices.length
  } finally {
    await pdf.destroy()
  }
}

export async function compressPdfFile(
  file: File,
  options: PdfCompressOptions,
): Promise<{ originalSize: number; outputSize: number }> {
  const pdf = await loadPdfForRender(file)
  let doc: jsPDF | null = null

  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber)
      const baseViewport = page.getViewport({ scale: 1 })
      const rendered = await renderPageToBlob(page, {
        format: 'jpeg',
        scale: options.scale,
        quality: options.quality,
      })
      const dataUrl = await blobToDataUrl(rendered)
      const width = baseViewport.width
      const height = baseViewport.height
      const orientation = width > height ? 'landscape' : 'portrait'

      if (!doc) {
        doc = new jsPDF({ unit: 'pt', format: [width, height], orientation })
      } else {
        doc.addPage([width, height], orientation)
      }
      doc.addImage(dataUrl, 'JPEG', 0, 0, width, height, undefined, 'FAST')
      page.cleanup()
    }

    if (!doc) throw new Error('PDF 没有可处理页面')
    const output = doc.output('blob')
    await downloadBlob(output, `扫描宝-PDF压缩-${createStamp()}.pdf`)
    return { originalSize: file.size, outputSize: output.size }
  } finally {
    await pdf.destroy()
  }
}

export async function addWatermarkToPdf(
  file: File,
  options: WatermarkOptions,
): Promise<void> {
  const text = options.text.trim()
  if (!text) throw new Error('请输入水印文字')

  const pdf = await loadPdfDocument(file)
  const pages = pdf.getPages()
  for (const page of pages) {
    const { width, height } = page.getSize()
    const pngBytes = await createWatermarkPng(width, height, options)
    const watermark = await pdf.embedPng(pngBytes)
    page.drawImage(watermark, { x: 0, y: 0, width, height })
  }

  await savePdf(pdf, `扫描宝-PDF水印-${createStamp()}.pdf`)
}

export async function addPageNumbersToPdf(
  file: File,
  options: PageNumberOptions,
): Promise<void> {
  const pdf = await loadPdfDocument(file)
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const pages = pdf.getPages()
  const start = Math.max(1, Math.floor(options.start || 1))
  const margin = Math.max(12, options.margin || 28)
  const fontSize = Math.max(8, options.fontSize || 11)

  pages.forEach((page, index) => {
    const { width, height } = page.getSize()
    const current = start + index
    const text = options.showTotal ? `${current} / ${start + pages.length - 1}` : String(current)
    const textWidth = font.widthOfTextAtSize(text, fontSize)
    const x = resolvePageNumberX(options.position, width, textWidth, margin)
    const y = options.position.startsWith('top') ? height - margin : margin
    page.drawText(text, {
      x,
      y,
      size: fontSize,
      font,
      color: rgb(0.24, 0.27, 0.35),
    })
  })

  await savePdf(pdf, `扫描宝-PDF页码-${createStamp()}.pdf`)
}

export function createPdfPageItems(pageCount: number): PdfPageItem[] {
  return Array.from({ length: pageCount }, (_, index) => ({
    id: `${index + 1}-${Date.now()}`,
    pageIndex: index,
    label: `第 ${index + 1} 页`,
    rotation: 0,
  }))
}

export function parsePageSelection(value: string, pageCount: number): number[] {
  const trimmed = value.trim()
  if (!trimmed) return []

  const seen = new Set<number>()
  const indices: number[] = []
  for (const rawPart of trimmed.split(',')) {
    const part = rawPart.trim()
    if (!part) continue

    const range = part.match(/^(\d+)\s*-\s*(\d+)$/)
    if (range) {
      const start = Number(range[1])
      const end = Number(range[2])
      const min = Math.min(start, end)
      const max = Math.max(start, end)
      for (let page = min; page <= max; page++) addPage(page)
      continue
    }

    if (!/^\d+$/.test(part)) throw new Error('页码格式不正确')
    addPage(Number(part))
  }

  return indices

  function addPage(page: number): void {
    if (page < 1 || page > pageCount) {
      throw new Error(`页码超出范围：${page}`)
    }
    const index = page - 1
    if (!seen.has(index)) {
      seen.add(index)
      indices.push(index)
    }
  }
}

async function savePdf(pdf: PDFDocument, filename: string): Promise<void> {
  const bytes = await pdf.save()
  const buffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer
  await downloadBlob(new Blob([buffer], { type: 'application/pdf' }), filename)
}

function normalizeDegrees(value: number): number {
  return ((value % 360) + 360) % 360
}

function reencodeImage(img: HTMLImageElement, quality: number): string {
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas 2d 上下文不可用')
  ctx.drawImage(img, 0, 0)
  return canvas.toDataURL('image/jpeg', quality)
}

async function loadPdfForRender(file: File): Promise<PDFDocumentProxy> {
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl
  const data = new Uint8Array(await readAsArrayBuffer(file))
  try {
    return await pdfjs.getDocument({
      data,
      cMapUrl: resolvePublicAssetUrl('pdfjs/cmaps/'),
      cMapPacked: true,
      standardFontDataUrl: resolvePublicAssetUrl('pdfjs/standard_fonts/'),
    }).promise
  } catch (err) {
    throw normalizePdfError(err)
  }
}

async function loadPdfDocument(file: File): Promise<PDFDocument> {
  try {
    return await PDFDocument.load(await readAsArrayBuffer(file))
  } catch (err) {
    throw normalizePdfError(err)
  }
}

function normalizePdfError(err: unknown): Error {
  const message = err instanceof Error ? err.message : String(err || '')
  const name = err instanceof Error ? err.name : ''
  if (/encrypt|password|PasswordException/i.test(`${name} ${message}`)) {
    return new Error('该 PDF 已加密，请先解除密码后再处理')
  }
  if (/Invalid PDF|Failed to parse|No PDF header/i.test(message)) {
    return new Error('PDF 文件格式异常，请换一个文件重试')
  }
  return err instanceof Error ? err : new Error('PDF 读取失败')
}

function resolvePublicAssetUrl(path: string): string {
  const base = import.meta.env.BASE_URL || './'
  return new URL(`${base}${path}`, document.baseURI).toString()
}

async function renderPageToBlob(
  page: PDFPageProxy,
  options: Pick<PdfToImageOptions, 'format' | 'scale' | 'quality'>,
): Promise<Blob> {
  const scale = clamp(options.scale, 0.8, 3)
  const viewport = page.getViewport({ scale })
  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(viewport.width)
  canvas.height = Math.ceil(viewport.height)

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas 2d 上下文不可用')

  await page.render({ canvasContext: ctx, viewport }).promise
  const type = options.format === 'png' ? 'image/png' : 'image/jpeg'
  return canvasToBlob(canvas, type, options.format === 'png' ? undefined : options.quality)
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob)
        else reject(new Error('图片生成失败'))
      },
      type,
      quality,
    )
  })
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('文件读取失败'))
    reader.readAsDataURL(blob)
  })
}

async function createWatermarkPng(
  pageWidth: number,
  pageHeight: number,
  options: WatermarkOptions,
): Promise<ArrayBuffer> {
  const pixelWidth = Math.min(Math.max(Math.ceil(pageWidth * 2), 900), 2400)
  const ratio = pixelWidth / pageWidth
  const pixelHeight = Math.max(1, Math.ceil(pageHeight * ratio))
  const canvas = document.createElement('canvas')
  canvas.width = pixelWidth
  canvas.height = pixelHeight

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas 2d 上下文不可用')

  ctx.scale(ratio, ratio)
  ctx.clearRect(0, 0, pageWidth, pageHeight)
  ctx.globalAlpha = clamp(options.opacity, 0.08, 0.6)
  ctx.fillStyle = '#334155'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `600 ${Math.max(18, options.fontSize)}px "Microsoft YaHei", sans-serif`

  const draw = (x: number, y: number): void => {
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate((options.rotation * Math.PI) / 180)
    ctx.fillText(options.text, 0, 0)
    ctx.restore()
  }

  if (options.repeat) {
    const stepX = Math.max(180, options.text.length * options.fontSize * 0.9)
    const stepY = Math.max(130, options.fontSize * 5)
    for (let y = stepY / 2; y < pageHeight + stepY; y += stepY) {
      for (let x = stepX / 2; x < pageWidth + stepX; x += stepX) {
        draw(x, y)
      }
    }
  } else {
    draw(pageWidth / 2, pageHeight / 2)
  }

  return canvasToBlob(canvas, 'image/png').then((blob) => blob.arrayBuffer())
}

function resolvePageNumberX(
  position: PageNumberPosition,
  pageWidth: number,
  textWidth: number,
  margin: number,
): number {
  if (position === 'bottom-right' || position === 'top-right') {
    return pageWidth - margin - textWidth
  }
  return (pageWidth - textWidth) / 2
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

interface ZipEntry {
  name: string
  blob: Blob
}

async function createZip(entries: ZipEntry[]): Promise<Blob> {
  const files = await Promise.all(
    entries.map(async (entry) => ({
      nameBytes: new TextEncoder().encode(entry.name),
      data: new Uint8Array(await entry.blob.arrayBuffer()),
    })),
  )

  const chunks: Uint8Array[] = []
  const central: Uint8Array[] = []
  let offset = 0

  for (const file of files) {
    const crc = crc32(file.data)
    const local = createLocalZipHeader(file.nameBytes, file.data.length, crc)
    chunks.push(local, file.data)
    central.push(createCentralZipHeader(file.nameBytes, file.data.length, crc, offset))
    offset += local.length + file.data.length
  }

  const centralOffset = offset
  const centralSize = central.reduce((sum, item) => sum + item.length, 0)
  chunks.push(...central, createEndOfCentralDirectory(files.length, centralSize, centralOffset))
  return new Blob(chunks.map(toArrayBuffer), { type: 'application/zip' })
}

function toArrayBuffer(value: Uint8Array): ArrayBuffer {
  return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength) as ArrayBuffer
}

function createLocalZipHeader(name: Uint8Array, size: number, crc: number): Uint8Array {
  const header = new Uint8Array(30 + name.length)
  const view = new DataView(header.buffer)
  view.setUint32(0, 0x04034b50, true)
  view.setUint16(4, 20, true)
  view.setUint16(6, 0x0800, true)
  view.setUint16(8, 0, true)
  view.setUint32(10, dosDateTime(), true)
  view.setUint32(14, crc, true)
  view.setUint32(18, size, true)
  view.setUint32(22, size, true)
  view.setUint16(26, name.length, true)
  header.set(name, 30)
  return header
}

function createCentralZipHeader(
  name: Uint8Array,
  size: number,
  crc: number,
  offset: number,
): Uint8Array {
  const header = new Uint8Array(46 + name.length)
  const view = new DataView(header.buffer)
  view.setUint32(0, 0x02014b50, true)
  view.setUint16(4, 20, true)
  view.setUint16(6, 20, true)
  view.setUint16(8, 0x0800, true)
  view.setUint16(10, 0, true)
  view.setUint32(12, dosDateTime(), true)
  view.setUint32(16, crc, true)
  view.setUint32(20, size, true)
  view.setUint32(24, size, true)
  view.setUint16(28, name.length, true)
  view.setUint32(42, offset, true)
  header.set(name, 46)
  return header
}

function createEndOfCentralDirectory(
  count: number,
  centralSize: number,
  centralOffset: number,
): Uint8Array {
  const header = new Uint8Array(22)
  const view = new DataView(header.buffer)
  view.setUint32(0, 0x06054b50, true)
  view.setUint16(8, count, true)
  view.setUint16(10, count, true)
  view.setUint32(12, centralSize, true)
  view.setUint32(16, centralOffset, true)
  return header
}

function dosDateTime(): number {
  const now = new Date()
  const time =
    (now.getHours() << 11) |
    (now.getMinutes() << 5) |
    Math.floor(now.getSeconds() / 2)
  const date =
    ((now.getFullYear() - 1980) << 9) |
    ((now.getMonth() + 1) << 5) |
    now.getDate()
  return (date << 16) | time
}

let crcTable: Uint32Array | null = null

function crc32(data: Uint8Array): number {
  const table = getCrcTable()
  let crc = 0xffffffff
  for (const byte of data) {
    crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function getCrcTable(): Uint32Array {
  if (crcTable) return crcTable
  crcTable = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let value = i
    for (let bit = 0; bit < 8; bit++) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
    }
    crcTable[i] = value >>> 0
  }
  return crcTable
}
