/**
 * 图像处理（无 opencv）：透视校正 + 增强，全部用 Canvas 像素处理。
 *
 * 为什么不用 opencv：@techstark/opencv-js 在 Worker 死锁、主线程预设 Module 也死锁、
 * 10MB 冷加载冻结 UI，调试耗时极长。这里用纯 Canvas 实现，零依赖、无加载、无死锁、确定性强。
 *
 * - warp：自解 3x3 单应矩阵（8 元线性方程组），逐像素反向映射 + 双线性采样。GPU 用不上也够快
 *   （2560px 内控制在移动端可接受范围，且发生在用户点「下一步」时，有加载反馈，不是无端冻结）。
 * - enhance：彩色/高清/灰度/黑白(自适应阈值)/增亮(除法归一化去阴影)，积分图加速。
 * - detect：纯 Canvas 自动找边，普通文档按最大前景区域识别，身份证按卡片比例优先识别。
 */
import { ref } from 'vue'
import { orderCorners, type Corner } from '@/utils/geometry'
import { loadImage } from '@/utils/image'

export type EnhanceMode = 'color' | 'sharp' | 'brighten' | 'gray' | 'bw'
export type DetectMode = 'document' | 'id-card'
export interface DetectOptions {
  mode?: DetectMode
}

const ready = ref(true) // 无需异步加载引擎，立即可用
const OUTPUT_JPEG_QUALITY = 0.97
const FINAL_JPEG_QUALITY = 0.98

export function useImageClient() {
  return {
    ready,
    /** 自动找边：纯 Canvas 检测，失败返回 null */
    async detect(dataUrl: string, options?: DetectOptions): Promise<Corner[] | null> {
      return autoDetectCorners(dataUrl, options)
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
  sharpenCanvas(outCtx, w, h, 0.16)
  return { dataUrl: outCanvas.toDataURL('image/jpeg', OUTPUT_JPEG_QUALITY), width: w, height: h }
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
    else if (mode === 'sharp') smartDocumentEnhance(d, w, h)
    ctx.putImageData(imgData, 0, 0)
    if (mode !== 'bw') sharpenCanvas(ctx, w, h, mode === 'sharp' ? 0.22 : mode === 'brighten' ? 0.14 : 0.12)
  }
  return { dataUrl: canvas.toDataURL('image/jpeg', OUTPUT_JPEG_QUALITY), width: w, height: h }
}

function sharpenCanvas(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  amount: number,
): void {
  if (amount <= 0 || w < 3 || h < 3) return

  const imgData = ctx.getImageData(0, 0, w, h)
  const src = imgData.data
  const out = new Uint8ClampedArray(src)
  const row = w * 4
  const centerWeight = 1 + amount * 4

  for (let y = 1; y < h - 1; y++) {
    const yOffset = y * row
    for (let x = 1; x < w - 1; x++) {
      const i = yOffset + x * 4
      for (let c = 0; c < 3; c++) {
        out[i + c] = clampByte(
          src[i + c] * centerWeight -
            (src[i - 4 + c] + src[i + 4 + c] + src[i - row + c] + src[i + row + c]) * amount,
        )
      }
    }
  }

  imgData.data.set(out)
  ctx.putImageData(imgData, 0, 0)
}

function clampByte(v: number): number {
  if (v < 0) return 0
  if (v > 255) return 255
  return v
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
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, W, H)
  ctx.drawImage(fImg, pad, pad, cardW, fH)
  ctx.drawImage(bImg, pad, pad + fH + gap, cardW, bH)
  return { dataUrl: canvas.toDataURL('image/jpeg', FINAL_JPEG_QUALITY), width: W, height: H }
}

interface BackgroundSample {
  r: number
  g: number
  b: number
  noise: number
}

interface DetectionCandidate {
  corners: Corner[]
  left: number
  top: number
  right: number
  bottom: number
  area: number
  fill: number
  source: 'component' | 'projection' | 'edge'
  score: number
}

/**
 * 自动找边（无 opencv）：
 * 降采样 → 估计边缘背景 → 生成前景 mask → 找连通域 / 投影外接框 →
 * 普通文档取最大可信主体，身份证按 1.58:1 卡片比例优先评分。
 */
export async function autoDetectCorners(
  dataUrl: string,
  options: DetectOptions = {},
): Promise<Corner[] | null> {
  const img = await loadImage(dataUrl)
  const W = img.naturalWidth
  const H = img.naturalHeight
  if (!W || !H) return null

  const mode = options.mode || 'document'
  // 降采样到长边 ~320：比旧版 180 保留更多边缘信息，仍然足够快
  const factor = Math.min(1, 320 / Math.max(W, H))
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
  const candidates: DetectionCandidate[] = []
  for (const threshold of detectionThresholds(bg, mode)) {
    const { mask, count } = buildForegroundMask(d, sw, sh, bg, threshold)
    const ratio = count / (sw * sh)
    if (ratio < 0.015 || ratio > 0.92) continue

    candidates.push(...findComponentCandidates(mask, sw, sh, W, H, mode))
    const projected = projectionCandidate(mask, sw, sh, W, H, mode, 'projection')
    if (projected) candidates.push(projected)
  }

  const edgeMask = buildEdgeMask(d, sw, sh, mode)
  if (edgeMask.count / (sw * sh) > 0.008) {
    const edgeCandidate = projectionCandidate(edgeMask.mask, sw, sh, W, H, mode, 'edge')
    if (edgeCandidate) candidates.push(edgeCandidate)
  }

  candidates.sort((a, b) => b.score - a.score)
  return candidates[0]?.corners || null
}

function detectionThresholds(bg: BackgroundSample, mode: DetectMode): number[] {
  const minBase = mode === 'id-card' ? 34 : 44
  const base = Math.max(minBase, bg.noise * 2.25)
  const values = mode === 'id-card'
    ? [base * 0.72, base, base * 1.25, base * 1.55, base * 1.9]
    : [base * 0.85, base, base * 1.3, base * 1.65, base * 2]
  return [...new Set(values.map((v) => Math.max(24, Math.min(150, Math.round(v)))))]
}

function buildForegroundMask(
  d: Uint8ClampedArray,
  w: number,
  h: number,
  bg: BackgroundSample,
  threshold: number,
): { mask: Uint8Array; count: number } {
  const mask = new Uint8Array(w * h)
  let count = 0
  for (let p = 0, i = 0; p < mask.length; p++, i += 4) {
    const diff =
      Math.abs(d[i] - bg.r) + Math.abs(d[i + 1] - bg.g) + Math.abs(d[i + 2] - bg.b)
    if (diff > threshold) {
      mask[p] = 1
      count++
    }
  }
  return { mask, count }
}

function buildEdgeMask(
  d: Uint8ClampedArray,
  w: number,
  h: number,
  mode: DetectMode,
): { mask: Uint8Array; count: number } {
  const gray = new Uint8Array(w * h)
  for (let p = 0, i = 0; p < gray.length; p++, i += 4) {
    gray[p] = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2])
  }

  const threshold = mode === 'id-card' ? 34 : 42
  const mask = new Uint8Array(w * h)
  let count = 0
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const p = y * w + x
      const gx = Math.abs(gray[p + 1] - gray[p - 1])
      const gy = Math.abs(gray[p + w] - gray[p - w])
      if (gx + gy > threshold) {
        mask[p] = 1
        count++
      }
    }
  }
  return { mask, count }
}

function findComponentCandidates(
  mask: Uint8Array,
  w: number,
  h: number,
  origW: number,
  origH: number,
  mode: DetectMode,
): DetectionCandidate[] {
  const total = w * h
  const visited = new Uint8Array(total)
  const stack = new Int32Array(total)
  const candidates: DetectionCandidate[] = []

  for (let start = 0; start < total; start++) {
    if (!mask[start] || visited[start]) continue

    let size = 0
    let top = h
    let bottom = 0
    let left = w
    let right = 0
    let minSum = Infinity
    let maxSum = -Infinity
    let minDiff = Infinity
    let maxDiff = -Infinity
    let tl = { x: 0, y: 0 }
    let tr = { x: 0, y: 0 }
    let br = { x: 0, y: 0 }
    let bl = { x: 0, y: 0 }

    let sp = 0
    stack[sp++] = start
    visited[start] = 1

    while (sp > 0) {
      const p = stack[--sp]
      const x = p % w
      const y = (p / w) | 0
      size++
      if (x < left) left = x
      if (x > right) right = x
      if (y < top) top = y
      if (y > bottom) bottom = y

      const sum = x + y
      const diff = x - y
      if (sum < minSum) {
        minSum = sum
        tl = { x, y }
      }
      if (sum > maxSum) {
        maxSum = sum
        br = { x, y }
      }
      if (diff > maxDiff) {
        maxDiff = diff
        tr = { x, y }
      }
      if (diff < minDiff) {
        minDiff = diff
        bl = { x, y }
      }

      pushIfMask(p - 1, x > 0)
      pushIfMask(p + 1, x < w - 1)
      pushIfMask(p - w, y > 0)
      pushIfMask(p + w, y < h - 1)
    }

    const boxW = right - left + 1
    const boxH = bottom - top + 1
    const boxArea = boxW * boxH
    if (boxW < w * 0.16 || boxH < h * 0.16 || boxArea < total * 0.035) continue

    const fill = size / boxArea
    const useBox = fill < 0.22
    const corners = useBox
      ? cornersFromBox(left, top, right, bottom, origW, origH, w, h)
      : scaleCorners([tl, tr, br, bl], origW, origH, w, h)
    const candidate = makeCandidate(corners, left, top, right, bottom, size, fill, mode, 'component', w, h)
    if (candidate) candidates.push(candidate)

    function pushIfMask(next: number, ok: boolean): void {
      if (ok && mask[next] && !visited[next]) {
        visited[next] = 1
        stack[sp++] = next
      }
    }
  }

  return candidates
}

function projectionCandidate(
  mask: Uint8Array,
  w: number,
  h: number,
  origW: number,
  origH: number,
  mode: DetectMode,
  source: 'projection' | 'edge',
): DetectionCandidate | null {
  const col = new Uint32Array(w)
  const row = new Uint32Array(h)
  let count = 0
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!mask[y * w + x]) continue
      col[x]++
      row[y]++
      count++
    }
  }
  if (count === 0) return null

  const trim = source === 'edge' ? 0.035 : 0.02
  const left = lowerQuantileIndex(col, count * trim)
  const right = upperQuantileIndex(col, count * (1 - trim))
  const top = lowerQuantileIndex(row, count * trim)
  const bottom = upperQuantileIndex(row, count * (1 - trim))
  if (right - left < w * 0.18 || bottom - top < h * 0.18) return null

  const fill = count / Math.max(1, (right - left + 1) * (bottom - top + 1))
  const corners = cornersFromBox(left, top, right, bottom, origW, origH, w, h)
  return makeCandidate(corners, left, top, right, bottom, count, fill, mode, source, w, h)
}

function makeCandidate(
  corners: Corner[],
  left: number,
  top: number,
  right: number,
  bottom: number,
  area: number,
  fill: number,
  mode: DetectMode,
  source: DetectionCandidate['source'],
  w: number,
  h: number,
): DetectionCandidate | null {
  const boxW = right - left + 1
  const boxH = bottom - top + 1
  const boxAreaRatio = (boxW * boxH) / (w * h)
  if (boxAreaRatio < 0.035) return null

  const oversizePenalty = boxAreaRatio > 0.94 ? 0.9 : 0
  const areaScore = Math.min(1, boxAreaRatio / 0.62)
  const fillScore = Math.min(1, Math.max(0, fill))
  const sourceBonus = source === 'component' ? 0.25 : source === 'projection' ? 0.12 : 0
  let score = areaScore * 2 + fillScore + sourceBonus - oversizePenalty

  if (mode === 'id-card') {
    const longRatio = Math.max(boxW / boxH, boxH / boxW)
    const ratioError = Math.abs(Math.log(longRatio / 1.586))
    const ratioScore = Math.max(0, 1 - ratioError / Math.log(1.65))
    score = ratioScore * 3.2 + areaScore + fillScore * 0.7 + sourceBonus - oversizePenalty
    if (ratioScore < 0.35) score -= 1.2
  }

  return {
    corners: orderCorners(corners),
    left,
    top,
    right,
    bottom,
    area,
    fill,
    source,
    score,
  }
}

function cornersFromBox(
  left: number,
  top: number,
  right: number,
  bottom: number,
  origW: number,
  origH: number,
  w: number,
  h: number,
): Corner[] {
  const pad = 1
  return scaleCorners(
    [
      { x: Math.max(0, left - pad), y: Math.max(0, top - pad) },
      { x: Math.min(w - 1, right + pad), y: Math.max(0, top - pad) },
      { x: Math.min(w - 1, right + pad), y: Math.min(h - 1, bottom + pad) },
      { x: Math.max(0, left - pad), y: Math.min(h - 1, bottom + pad) },
    ],
    origW,
    origH,
    w,
    h,
  )
}

function scaleCorners(corners: Corner[], origW: number, origH: number, w: number, h: number): Corner[] {
  const sx = origW / w
  const sy = origH / h
  return corners.map((p) => ({
    x: Math.max(0, Math.min(origW, p.x * sx)),
    y: Math.max(0, Math.min(origH, p.y * sy)),
  }))
}

function lowerQuantileIndex(values: Uint32Array, target: number): number {
  let acc = 0
  for (let i = 0; i < values.length; i++) {
    acc += values[i]
    if (acc >= target) return i
  }
  return 0
}

function upperQuantileIndex(values: Uint32Array, target: number): number {
  let acc = 0
  for (let i = 0; i < values.length; i++) {
    acc += values[i]
    if (acc >= target) return i
  }
  return values.length - 1
}

/** 取图像边缘小块的均值和噪声作为背景估计 */
function sampleBackground(
  d: Uint8ClampedArray,
  w: number,
  h: number,
): BackgroundSample {
  const ring = Math.max(2, Math.round(Math.min(w, h) * 0.045))
  let rs = 0
  let gs = 0
  let bs = 0
  let n = 0
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (x >= ring && x < w - ring && y >= ring && y < h - ring) continue
      const i = (y * w + x) * 4
      rs += d[i]
      gs += d[i + 1]
      bs += d[i + 2]
      n++
    }
  }
  const bg = { r: rs / n, g: gs / n, b: bs / n }
  let noise = 0
  let sampled = 0
  for (let y = 0; y < h; y += 2) {
    for (let x = 0; x < w; x += 2) {
      if (x >= ring && x < w - ring && y >= ring && y < h - ring) continue
      const i = (y * w + x) * 4
      noise += Math.abs(d[i] - bg.r) + Math.abs(d[i + 1] - bg.g) + Math.abs(d[i + 2] - bg.b)
      sampled++
    }
  }
  return { ...bg, noise: sampled ? noise / sampled : 0 }
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

/**
 * 文档高清增强：
 * - 大窗口背景估计：压掉灰底、阴影和局部光照不均
 * - 局部对比：让浅字、细线、表格线更明显
 * - 保留少量原色：印章/证件颜色不过度丢失
 */
function smartDocumentEnhance(d: Uint8ClampedArray, w: number, h: number): void {
  const gray = toGrayArray(d, w, h)
  const I = integral(gray, w, h)
  const half = (clampOdd(Math.round(Math.min(w, h) / 5) | 1, 35, 181) - 1) >> 1

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x
      const x0 = Math.max(0, x - half)
      const x1 = Math.min(w - 1, x + half)
      const y0 = Math.max(0, y - half)
      const y1 = Math.min(h - 1, y + half)
      const area = (x1 - x0 + 1) * (y1 - y0 + 1)
      const mean = boxSum(I, w, x0, y0, x1, y1) / area

      let v = (gray[p] * 255) / (mean + 1)
      v = 128 + (v - 128) * 1.34
      if (v > 178) v = 190 + (v - 178) * 1.22
      if (v < 150) v *= 0.86
      v = clampByte(v)

      const o = p * 4
      const ratio = gray[p] > 1 ? v / gray[p] : 1
      d[o] = clampByte(d[o] * ratio * 0.62 + v * 0.38)
      d[o + 1] = clampByte(d[o + 1] * ratio * 0.62 + v * 0.38)
      d[o + 2] = clampByte(d[o + 2] * ratio * 0.62 + v * 0.38)
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
