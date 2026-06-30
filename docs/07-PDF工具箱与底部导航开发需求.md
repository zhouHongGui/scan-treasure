# 扫描宝 PDF 工具箱与底部导航开发需求

## 背景

扫描宝当前定位是纯前端、本地处理的文档 / 证件扫描工具。现有技术栈为：

```text
Vue 3 + Vite + TypeScript + Vant + Pinia + vue-router + Capacitor Android + jsPDF + opencv.js
```

后续建议将产品从单一扫描器扩展为：

```text
本地扫描 + PDF 文档工具箱
```

核心原则保持不变：

- 本地处理
- 不上传服务器
- 不保存用户文件
- 无账号
- 无广告

## 改版目标

增加底部导航菜单，将功能拆为两个主模块：

```text
扫描 | 工具
```

- `扫描`：保留当前文档扫描、身份证扫描、拍照 / 相册导入等已有功能。
- `工具`：新增 PDF 与图片文档处理能力。

第一版不建议加入太多主导航项，先保持两个入口。后续功能复杂后，可再扩展第三项：

```text
文件
```

`文件` 可用于最近处理、本地草稿、导出记录、缓存清理等。

## 底部导航

建议使用 `Vant Tabbar` 实现。

导航项：

```text
扫描
工具
```

建议交互：

- 底部导航固定在主页面底部。
- 扫描、工具之间切换时保留清晰的当前选中态。
- 进入具体工具页面后，可保留底部导航，也可使用顶部返回按钮回到工具页，具体按移动端体验决定。

## 扫描模块

保留当前已有能力：

- 文档扫描
- 身份证扫描
- 拍照扫描
- 相册选择
- 边缘识别
- 透视校正
- 图像增强
- 导出图片 / PDF

建议页面命名：

```text
src/views/Home.vue
```

或后续重命名为：

```text
src/views/ScanHome.vue
```

## 工具模块

工具页建议做成宫格入口，第一版展示以下工具：

- PDF 合并
- PDF 拆分
- PDF 页面管理
- 图片转 PDF
- PDF 转图片
- PDF 压缩
- 添加水印
- 添加页码

每个工具入口建议包含：

- 图标
- 工具名称
- 一句话说明
- 不上传、本地处理提示

## 开发优先级

### 第一阶段

优先完成稳定、纯前端可控、与现有扫描能力最贴近的功能：

```text
1. 底部导航
2. 工具首页
3. PDF 合并
4. PDF 拆分
5. PDF 页面管理：排序、删除、旋转
6. 多图转 PDF
```

### 第二阶段

继续补齐高频 PDF 工具：

```text
1. PDF 转图片
2. PDF 压缩
3. 添加水印
4. 添加页码
```

### 第三阶段

谨慎推进文档转换和 OCR：

```text
1. Word 转 PDF，实验版
2. PDF 转 Word，简化版
3. OCR 文字识别
4. 可搜索 PDF
```

## 技术建议

建议新增依赖：

```bash
npm install pdf-lib pdfjs-dist
```

功能与技术对应关系：

| 功能 | 推荐技术 | 说明 |
| --- | --- | --- |
| PDF 合并 | `pdf-lib` | 读取多个 PDF 后复制页面并导出新 PDF |
| PDF 拆分 | `pdf-lib` | 按页码范围或选中页面导出 |
| PDF 页面删除 / 旋转 / 排序 | `pdf-lib` | 适合做页面管理器 |
| 图片转 PDF | 现有 `jsPDF` 或 `pdf-lib` | 可扩展多图、A4、边距、方向、质量 |
| PDF 转图片 | `pdfjs-dist` | 将 PDF 页面渲染到 canvas 后导出 PNG / JPEG |
| PDF 压缩 | `pdfjs-dist` + `jsPDF` / `pdf-lib` | 将页面渲染为图片后按质量重新生成 PDF |
| 水印 / 页码 | `pdf-lib` | 中文水印可能需要嵌入中文字体 |

## 谨慎事项

### Word 转 PDF

可以做，但建议作为实验版。纯前端难以保证复杂 Word 排版完全还原，尤其是：

- 页眉页脚
- 表格
- 字体
- 分页
- 图片环绕
- 复杂样式

可选方案：

- 使用 DOCX 渲染库将 Word 渲染为 HTML。
- 再通过浏览器打印或 HTML 转 PDF 方式导出。
- 页面标注“实验功能，复杂排版可能存在差异”。

### PDF 转 Word

不建议第一版实现。高质量 PDF 转 Word 通常需要：

- OCR
- 版面分析
- 段落重建
- 表格识别
- 字体和样式还原

纯前端可以先做简化版：

```text
PDF 提取文字 -> 生成简单 Word / DOCX
```

但不建议宣传为完整排版还原。

## 建议页面结构

```text
src/views/Home.vue
src/views/Tools.vue
src/views/pdf/PdfMerge.vue
src/views/pdf/PdfSplit.vue
src/views/pdf/PdfPages.vue
src/views/pdf/ImageToPdf.vue
src/views/pdf/PdfToImage.vue
src/views/pdf/PdfCompress.vue
src/views/pdf/PdfWatermark.vue
src/views/pdf/PdfPageNumber.vue
```

如决定重命名扫描首页，可调整为：

```text
src/views/ScanHome.vue
```

## 建议路由

```text
/scan
/tools
/tools/pdf-merge
/tools/pdf-split
/tools/pdf-pages
/tools/image-to-pdf
/tools/pdf-to-image
/tools/pdf-compress
/tools/pdf-watermark
/tools/pdf-page-number
```

首页默认建议跳转到：

```text
/scan
```

也可以保留当前 `/` 为扫描首页，同时让底部导航的扫描项指向 `/`。

## 工具页文案建议

工具首页标题：

```text
PDF 工具箱
```

副标题：

```text
合并、拆分、压缩和转换 PDF，全部在本地完成。
```

工具卡片示例：

```text
PDF 合并
将多个 PDF 合成一个文件

PDF 拆分
按页面范围提取新的 PDF

页面管理
排序、删除、旋转 PDF 页面

图片转 PDF
把多张图片合成为 PDF

PDF 转图片
将 PDF 页面导出为图片

PDF 压缩
减小扫描件 PDF 体积

添加水印
给 PDF 添加文字水印

添加页码
为 PDF 自动添加页码
```

## UI 建议

- 工具首页使用宫格布局，移动端优先。
- 工具卡片不宜过大，保持可快速扫描。
- 每个工具页面都要有明确的文件选择入口。
- 文件选择后展示文件名、页数、大小等信息。
- 所有导出按钮文案明确，例如“导出合并后的 PDF”。
- 操作过程中显示加载状态，避免用户以为卡住。
- 出错时给出可理解提示，例如“该 PDF 已加密，请先解除密码后再处理”。

## 隐私提示

所有工具页面都建议保留一句固定提示：

```text
文件仅在当前设备处理，不会上传到服务器。
```

如果页面处理较大的 PDF，也可提示：

```text
大文件处理可能需要较长时间，请保持页面打开。
```

## 验收标准

第一阶段完成后，应满足：

- 底部导航可以在“扫描”和“工具”之间切换。
- 原有扫描功能不回退。
- 工具首页可正常展示 PDF 工具入口。
- PDF 合并可选择多个 PDF 并导出一个合并文件。
- PDF 拆分可按页码或页面选择导出新 PDF。
- PDF 页面管理可完成排序、删除、旋转，并导出新 PDF。
- 图片转 PDF 支持多张图片生成 PDF。
- 所有处理均在浏览器本地完成，不调用上传接口。
- Android Capacitor 打包后功能可正常使用。

## 一句话总结

先把扫描宝改成底部导航结构：

```text
扫描 | 工具
```

扫描页保留原功能，工具页新增 PDF 工具箱。第一版优先实现 PDF 合并、拆分、页面管理、多图转 PDF，这些最稳定，也最符合当前纯前端本地处理的技术路线。
