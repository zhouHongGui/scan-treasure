import { Capacitor } from '@capacitor/core'
import { Directory, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'

export function readAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as ArrayBuffer)
    reader.onerror = () => reject(new Error('文件读取失败'))
    reader.readAsArrayBuffer(file)
  })
}

export function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('文件读取失败'))
    reader.readAsDataURL(file)
  })
}

export async function downloadBlob(blob: Blob, filename: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    await saveBlobInNativeApp(blob, filename)
    return
  }

  triggerBrowserDownload(blob, filename)
}

function triggerBrowserDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1500)
}

async function saveBlobInNativeApp(blob: Blob, filename: string): Promise<void> {
  const safeName = sanitizeFilename(filename)
  const path = `扫描宝/${safeName}`
  const data = await blobToBase64(blob)

  await ensurePublicStoragePermission()
  const writeResult = await Filesystem.writeFile({
    path,
    data,
    directory: Directory.Documents,
    recursive: true,
  })

  const uri =
    writeResult.uri ||
    (
      await Filesystem.getUri({
        path,
        directory: Directory.Documents,
      })
    ).uri

  const canShare = await Share.canShare().catch(() => ({ value: false }))
  if (!canShare.value) return

  await Share.share({
    title: safeName,
    text: '扫描宝已生成文件，可保存或分享。',
    files: [uri],
    dialogTitle: '保存或分享文件',
  }).catch(() => undefined)
}

async function ensurePublicStoragePermission(): Promise<void> {
  const current = await Filesystem.checkPermissions().catch(() => ({ publicStorage: 'granted' }))
  if (current.publicStorage === 'granted') return

  const requested = await Filesystem.requestPermissions()
  if (requested.publicStorage !== 'granted') {
    throw new Error('请允许文件存储权限后重试')
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result || '')
      resolve(result.includes(',') ? result.split(',')[1] : result)
    }
    reader.onerror = () => reject(new Error('文件读取失败'))
    reader.readAsDataURL(blob)
  })
}

function sanitizeFilename(filename: string): string {
  return filename.replace(/[\\/:*?"<>|]/g, '_').trim() || `扫描宝-${createStamp()}`
}

export function createStamp(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return (
    `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}` +
    `${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
  )
}
