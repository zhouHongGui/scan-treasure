/**
 * 图像处理（无 opencv）：透视校正 + 增强，全部用 Canvas 像素处理。
 *
 * 为什么不用 opencv：@techstark/opencv-js 在 Worker 死锁、主线程预设 Module 也死锁、
 * 10MB 冷加载冻结 UI，调试耗时极长。这里用纯 Canvas 实现，零依赖、无加载、无死锁、确定性强。
 *
 * - warp：自解 3x3 单应矩阵（8 元线性方程组），逐像素反向映射 + 双线性采样。GPU 用不上也够快
 *   （1600px 约 1s 量级，且发生在用户点「下一步」时，有加载反馈，不是无端冻结）。
 * - enhance：彩色/灰度/黑白(自适应阈值)/增亮(除法归一化去阴影)，积分图加速。
 * - detect：纯 Canvas 轻量自动找边（背景差异投影出轴对齐外接框），失败回退手动拖四角。
 */
import { ref } from 'vue'
import { orderCorners, type Corner } from '@/utils/geometry'
import { loadImage } from '@/utils/image'

export type EnhanceMode = 'color' | 'brighten' | 'gray' | 'bw'

const ready = ref(true) // 无需异步加载引擎，立即可用

export function useImageClient() {
  return {
    ready,
    /** 自动找边：纯 Canvas 轻量检测（对比背景上的轴对齐外接框），失败返回 null */
    async detect(dataUrl: string): Promise<Corner[] | null> {
      return autoDetectCorners(dataUrl)
    },
    async warp(
      dataUrl: string,
      corners: Corner[],
    ): Promise<{ dataUrl: string; width: number; height: number }> {
      return warpPerspective(dataUrl, corners)
    },
    async enhance(
      dataUrl: string,
      mode: EnhanceMode,
    ): Promise<{ dataUrl: string; width: number; height: number }> {
      return enhanceImage(dataUrl, mode)
    },
  }
}

// ============================ 透视校正 ============================

async function warpPerspective(
  dataUrl: string,
  corners: Corner[],
): Promise<{ dataUrl: string; width: number; height: number }> {
  if (corners.length !== 4) throw new Error('透视校正需要 4 个角点')
  // 防御性排序：确保 TL→TR→BR→BL，角点被拖乱也能正确校正
  const ordered = orderCorners(corners)

  const img = await loadImage(dataUrl)
  const iw = img.naturalWidth
  const ih = img.naturalHeight

  // 取输入像素
  const inCanvas = document.createElement('canvas')
  inCanvas.width = iw
  inCanvas.height = ih
  const inCtx = inCanvas.getContext('2d')
  if (!inCtx) throw new Error('canvas 2d 上下文不可用')
  inCtx.drawImage(img, 0, 0)
  const inData = inCtx.getImageData(0, 0, iw, ih).data

  // 输出尺寸：取四条边长度的最大值，避免裁切
  const [tl, tr, br, bl] = ordered
  const w = Math.max(1, Math.round(Math.max(edge(tl, tr), edge(bl, br))))
  const h = Math.max(1, Math.round(Math.max(edge(tl, bl), edge(tr, br))))

  // 单应矩阵：输出像素坐标 -> 输入像素坐标（反向映射便于采样）
  const H = homographyFrom4Points(
    [
      [0, 0],
      [w, 0],
      [w, h],
      [0, h],
    ],
    [
      [tl.x, tl.y],
      [tr.x, tr.y],
      [br.x, br.y],
      [bl.x, bl.y],
    ],
  )
  const h0 = H[0], h1 = H[1], h2 = H[2], h3 = H[3], h4 = H[4], h5 = H[5], h6 = H[6], h7 = H[7]

  const outCanvas = document.createElement('canvas')
  outCanvas.width = w
  outCanvas.height = h
  const outCtx = outCanvas.getContext('2d')
  if (!outCtx) throw new Error('canvas 2d 上下文不可用')
  const out = outCtx.createImageData(w, h)
  const od = out.data

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const denom = h6 * x + h7 * y + 1
      const sx = (h0 * x + h1 * y + h2) / denom
      const sy = (h3 * x + h4 * y + h5) / denom
      const o = (y * w + x) * 4
      const xi = sx | 0
      const yi = sy | 0
      if (xi < 0 || yi < 0 || xi >= iw || yi >= ih) {
        // 落在原图范围外（四边形外区域）→ 黑
        od[o] = od[o + 1] = od[o + 2] = 0
        od[o + 3] = 255
      } else {
        // 最后一行/列重复边缘采样，避免校正结果边缘出现黑线
        const cx = xi >= iw - 1 ? iw - 2 : xi
        const cy = yi >= ih - 1 ? ih - 2 : yi
        const fx = xi >= iw - 1 ? 1 : sx - xi
        const fy = yi >= ih - 1 ? 1 : sy - yi
        const i00 = (cy * iw + cx) * 4
        const i10 = i00 + 4
        const i01 = i00 + iw * 4
        const i11 = i01 + 4
        for (let c = 0; c < 3; c++) {
          const top = inData[i00 + c] * (1 - fx) + inData[i10 + c] * fx
          const bot = inData[i01 + c] * (1 - fx) + inData[i11 + c] * fx
          od[o + c] = top * (1 - fy) + bot * fy
        }
        od[o + 3] = 255
      }
    }
  }
  outCtx.putImageData(out, 0, 0)
  return { dataUrl: outCanvas.toDataURL('image/jpeg', 0.92), width: w, height: h }
}

function edge(a: Corner, b: Corner): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

/**
 * 由 4 组 src->dst 对应点求 3x3 单应矩阵（h8 隐含为 1）。
 * 返回 [h0..h7]，使 dst ~ H·src（齐次坐标）。
 */
function homographyFrom4Points(src: number[][], dst: number[][]): number[] {
  const A: number[][] = []
  const b: number[] = []
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i]
    const [X, Y] = dst[i]
    A.push([x, y, 1, 0, 0, 0, -x * X, -y * X])
    b.push(X)
    A.push([0, 0, 0, x, y, 1, -x * Y, -y * Y])
    b.push(Y)
  }
  return solveLinear(A, b)
}

/** 高斯-若尔当消元解线性方程组 A x = b（A 为 n×n） */
function solveLinear(A: number[][], b: number[]): number[] {
  const n = b.length
  const M = A.map((row, i) => [...row, b[i]])
  for (let col = 0; col < n; col++) {
    let piv = col
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r
    }
    if (piv !== col) {
      ;[M[col], M[piv]] = [M[piv], M[col]]
    }
    const d = M[col][col]
    if (Math.abs(d) < 1e-12) throw new Error('无法计算透视矩阵（角点可能共线）')
    for (let r = 0; r < n; r++) {
      if (r === col) continue
      const f = M[r][col] / d
      for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c]
    }
  }
  const x = new Array<number>(n)
  for (let i = 0; i < n; i++) x[i] = M[i][n] / M[i][i]
  return x
}

// ============================ 增强 ============================

async function enhanceImage(
  dataUrl: string,
  mode: EnhanceMode,
): Promise<{ dataUrl: string; width: number; height: number }> {
  const img = await loadImage(dataUrl)
  const w = img.naturalWidth
  const h = img.naturalHeight
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas 2d 上下文不可用')
  ctx.drawImage(img, 0, 0)
  if (mode !== 'color') {
    // 非彩色模式才做像素处理；color 直接用原图，省一次无谓的取/写像素往返
    const imgData = ctx.getImageData(0, 0, w, h)
    const d = imgData.data
    if (mode === 'gray') toGray(d)
    else if (mode === 'bw') adaptiveThreshold(d, w, h)
    else if (mode === 'brighten') divideNormalize(d, w, h)
    ctx.putImageData(imgData, 0, 0)
  }
  return { dataUrl: canvas.toDataURL('image/jpeg', 0.92), width: w, height: h }
}

/** 把正面/反面两张已校正的图竖直拼接到白底上，生成身份证扫描件（正面在上、反面在下） */
export async function combineIdCardSides(
  front: { dataUrl: string; width: number; height: number },
  back: { dataUrl: string; width: number; height: number },
): Promise<{ dataUrl: string; width: number; height: number }> {
  const fImg = await loadImage(front.dataUrl)
  const bImg = await loadImage(back.dataUrl)
  // 统一到相同宽度（取较大），保持各自长宽比
  const cardW = Math.max(fImg.naturalWidth, bImg.naturalWidth)
  const fH = Math.round((fImg.naturalHeight * cardW) / fImg.naturalWidth)
  const bH = Math.round((bImg.naturalHeight * cardW) / bImg.naturalWidth)
  const gap = Math.round(cardW * 0.1) // 正反面间距
  const pad = Math.round(cardW * 0.08) // 白边
  const W = cardW + pad * 2
  const H = fH + gap + bH + pad * 2
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas 2d 上下文不可用')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, W, H)
  ctx.drawImage(fImg, pad, pad, cardW, fH)
  ctx.drawImage(bImg, pad, pad + fH + gap, cardW, bH)
  return { dataUrl: canvas.toDataURL('image/jpeg', 0.95), width: W, height: H }
}

/**
 * 轻量自动找边（无 opencv）：
 * 降采样 → 取四角背景色 → 计算每个像素与背景的差异 → 按列/行投影 →
 * 找到差异密集区的外接框作为文档/卡片的四角（轴对齐）。
 * 适合「主体放在相对均匀背景上」的拍照场景；背景杂乱或主体铺满画面时可能失败（返回 null）。
 */
export async function autoDetectCorners(dataUrl: string): Promise<Corner[] | null> {
  const img = await loadImage(dataUrl)
  const W = img.naturalWidth
  const H = img.naturalHeight
  if (!W || !H) return null

  // 降采样到长边 ~180，保证速度
  const factor = Math.min(1, 180 / Math.max(W, H))
  const sw = Math.max(1, Math.round(W * factor))
  const sh = Math.max(1, Math.round(H * factor))
  const c = document.createElement('canvas')
  c.width = sw
  c.height = sh
  const ctx = c.getContext('2d')
  if (!ctx) return null
  ctx.drawImage(img, 0, 0, sw, sh)
  const d = ctx.getImageData(0, 0, sw, sh).data

  const bg = sampleBackground(d, sw, sh)
  const TH = 80 // 单像素与背景的差异阈值（三通道绝对差之和）

  const colDiff = new Uint32Array(sw)
  const rowDiff = new Uint32Array(sh)
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      const i = (y * sw + x) * 4
      const diff =
        Math.abs(d[i] - bg.r) + Math.abs(d[i + 1] - bg.g) + Math.abs(d[i + 2] - bg.b)
      if (diff > TH) {
        colDiff[x]++
        rowDiff[y]++
      }
    }
  }

  // 列/行被视为「主体」的差异像素数门槛
  const colGate = Math.max(2, sh * 0.12)
  const rowGate = Math.max(2, sw * 0.12)
  let left = 0
  while (left < sw && colDiff[left] < colGate) left++
  let right = sw - 1
  while (right > left && colDiff[right] < colGate) right--
  let top = 0
  while (top < sh && rowDiff[top] < rowGate) top++
  let bottom = sh - 1
  while (bottom > top && rowDiff[bottom] < rowGate) bottom--

  // 检出的框太小则视为失败
  if (right - left < sw * 0.2 || bottom - top < sh * 0.2) return null

  const sx = W / sw
  const sy = H / sh
  const corners: Corner[] = [
    { x: left * sx, y: top * sy },
    { x: right * sx, y: top * sy },
    { x: right * sx, y: bottom * sy },
    { x: left * sx, y: bottom * sy },
  ]
  return orderCorners(corners)
}

/** 取图像四角小块的均值作为背景色估计 */
function sampleBackground(
  d: Uint8ClampedArray,
  w: number,
  h: number,
): { r: number; g: number; b: number } {
  const r = Math.max(1, Math.round(Math.min(w, h) * 0.05))
  const spots = [
    [0, 0],
    [w - r, 0],
    [0, h - r],
    [w - r, h - r],
  ]
  let rs = 0
  let gs = 0
  let bs = 0
  let n = 0
  for (const [cx, cy] of spots) {
    for (let y = cy; y < cy + r; y++) {
      for (let x = cx; x < cx + r; x++) {
        const i = (y * w + x) * 4
        rs += d[i]
        gs += d[i + 1]
        bs += d[i + 2]
        n++
      }
    }
  }
  return { r: rs / n, g: gs / n, b: bs / n }
}

function toGray(d: Uint8ClampedArray): void {
  for (let i = 0; i < d.length; i += 4) {
    const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
    d[i] = d[i + 1] = d[i + 2] = g
  }
}

/** 自适应阈值（box 均值）：抗光照，扫描文档效果稳定 */
function adaptiveThreshold(d: Uint8ClampedArray, w: number, h: number): void {
  const gray = toGrayArray(d, w, h)
  const I = integral(gray, w, h)
  const half = (clampOdd(Math.round(Math.min(w, h) / 12) | 1, 11, 75) - 1) >> 1
  const C = 12
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - half)
      const x1 = Math.min(w - 1, x + half)
      const y0 = Math.max(0, y - half)
      const y1 = Math.min(h - 1, y + half)
      const area = (x1 - x0 + 1) * (y1 - y0 + 1)
      const mean = boxSum(I, w, x0, y0, x1, y1) / area
      const v = gray[y * w + x] > mean - C ? 255 : 0
      const o = (y * w + x) * 4
      d[o] = d[o + 1] = d[o + 2] = v
    }
  }
}

/** 除法归一化去阴影：out = 255 * gray / (blur(gray) + 1) */
function divideNormalize(d: Uint8ClampedArray, w: number, h: number): void {
  const gray = toGrayArray(d, w, h)
  const I = integral(gray, w, h)
  const half = (clampOdd(Math.round(Math.min(w, h) / 6) | 1, 21, 151) - 1) >> 1
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - half)
      const x1 = Math.min(w - 1, x + half)
      const y0 = Math.max(0, y - half)
      const y1 = Math.min(h - 1, y + half)
      const area = (x1 - x0 + 1) * (y1 - y0 + 1)
      const mean = boxSum(I, w, x0, y0, x1, y1) / area
      const v = Math.min(255, (gray[y * w + x] * 255) / (mean + 1))
      const o = (y * w + x) * 4
      d[o] = d[o + 1] = d[o + 2] = v
    }
  }
}

function toGrayArray(d: Uint8ClampedArray, w: number, h: number): Float32Array {
  const g = new Float32Array(w * h)
  for (let i = 0, j = 0; i < d.length; i += 4, j++) {
    g[j] = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
  }
  return g
}

/** 积分图（含一行/一列 0 填充），用 Float64 避免大图累加精度损失 */
function integral(gray: Float32Array, w: number, h: number): Float64Array {
  const W = w + 1
  const I = new Float64Array(W * (h + 1))
  for (let y = 1; y <= h; y++) {
    for (let x = 1; x <= w; x++) {
      I[y * W + x] =
        gray[(y - 1) * w + (x - 1)] + I[(y - 1) * W + x] + I[y * W + (x - 1)] - I[(y - 1) * W + (x - 1)]
    }
  }
  return I
}

function boxSum(I: Float64Array, w: number, x0: number, y0: number, x1: number, y1: number): number {
  const W = w + 1
  return I[(y1 + 1) * W + (x1 + 1)] - I[y0 * W + (x1 + 1)] - I[(y1 + 1) * W + x0] + I[y0 * W + x0]
}

function clampOdd(n: number, min: number, max: number): number {
  let v = Math.max(min, Math.min(max, n))
  if (v % 2 === 0) v += 1
  if (v > max) v -= 2
  return Math.max(min, v)
}
