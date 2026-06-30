export interface Corner {
  x: number
  y: number
}

/**
 * 将 4 个角点排序为固定顺序：左上 → 右上 → 右下 → 左下
 * 用 (x+y) 与 (x-y) 的极值判定，透视变换需要这个顺序
 *   - 左上：x+y 最小
 *   - 右下：x+y 最大
 *   - 右上：x-y 最大
 *   - 左下：x-y 最小
 */
export function orderCorners(corners: Corner[]): Corner[] {
  const bySum = [...corners].sort((a, b) => a.x + a.y - (b.x + b.y))
  const byDiff = [...corners].sort((a, b) => a.x - a.y - (b.x - b.y))
  return [
    bySum[0], // 左上
    byDiff[byDiff.length - 1], // 右上
    bySum[bySum.length - 1], // 右下
    byDiff[0], // 左下
  ]
}

/** 生成图片四角（全图），作为边缘检测失败的兜底初始框 */
export function fullImageCorners(width: number, height: number): Corner[] {
  // 内缩几个像素，避免角点贴边难以拖拽
  const inset = Math.round(Math.min(width, height) * 0.02)
  return [
    { x: inset, y: inset },
    { x: width - inset, y: inset },
    { x: width - inset, y: height - inset },
    { x: inset, y: height - inset },
  ]
}
