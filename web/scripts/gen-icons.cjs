/**
 * 生成全套图标（Android 启动图标 + Web favicon + PWA）。
 * 改了 resources/icon.svg 或 icon-fg.svg 后重新运行：npm run gen:icons
 */
const { Resvg } = require('@resvg/resvg-js')
const fs = require('fs')

const svgRound = fs.readFileSync('resources/icon.svg') // 圆角版：legacy 启动图标 / favicon
const svgFg = fs.readFileSync('resources/icon-fg.svg') // 全出血版：自适应图标前景

const render = (svg, w) =>
  new Resvg(svg, { fitTo: { mode: 'width', value: w } }).render().asPng()

// 1024 源图标（留作参考 / 上架商店用）
fs.writeFileSync('resources/icon.png', render(svgRound, 1024))

// Android 启动图标：每个密度 3 个文件（legacy / round / 自适应前景）
const RES = 'android/app/src/main/res'
const densities = {
  'mipmap-mdpi': [48, 108],
  'mipmap-hdpi': [72, 162],
  'mipmap-xhdpi': [96, 216],
  'mipmap-xxhdpi': [144, 324],
  'mipmap-xxxhdpi': [192, 432],
}
for (const [dir, [l, f]] of Object.entries(densities)) {
  const lp = render(svgRound, l)
  const fp = render(svgFg, f)
  fs.writeFileSync(`${RES}/${dir}/ic_launcher.png`, lp)
  fs.writeFileSync(`${RES}/${dir}/ic_launcher_round.png`, lp)
  fs.writeFileSync(`${RES}/${dir}/ic_launcher_foreground.png`, fp)
}

// Web favicon + PWA 图标
fs.writeFileSync('public/favicon.png', render(svgRound, 64))
fs.writeFileSync('public/apple-touch-icon.png', render(svgRound, 180))
fs.writeFileSync('public/pwa-192.png', render(svgRound, 192))
fs.writeFileSync('public/pwa-512.png', render(svgRound, 512))

console.log('✓ 全套图标已生成（Android 启动图标 + favicon + PWA）')
