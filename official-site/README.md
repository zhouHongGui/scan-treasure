# 扫描宝官网静态版

这个目录是独立的官网项目，使用纯 `HTML + CSS + JavaScript`，不依赖 Vue、Vite 或构建步骤。首页正文、标题、FAQ、结构化数据都直接写在 `index.html` 里，更适合百度等搜索引擎抓取。

## 目录

- `index.html`：官网首页和百度 SEO 主要内容。
- `styles.css`：响应式样式。
- `app.js`：导航高亮、返回顶部、FAQ 折叠等增强交互。
- `robots.txt`：允许搜索引擎抓取。
- `sitemap.template.xml`：上线后替换为真实域名再改名为 `sitemap.xml`。
- `assets/`：官网图片和图标。

## 本地预览

直接用浏览器打开 `index.html` 即可。如果要模拟线上路径，可以在本目录运行静态服务器。

## 上线前要改

1. 把 `index.html` 的 `<body data-app-url="../web/">` 改成真实扫描工具地址，例如 `/app/`。
2. 有正式域名后，在 `<head>` 增加绝对地址的 canonical。
3. 把 `sitemap.template.xml` 里的 `https://your-domain.com/` 改成真实域名，并重命名为 `sitemap.xml`。
4. 在 `robots.txt` 追加真实 sitemap 地址，例如 `Sitemap: https://your-domain.com/sitemap.xml`。
5. 到百度搜索资源平台提交站点、验证文件和 sitemap。

## SEO 设计

- 静态 HTML 直接输出 `title`、`description`、`keywords`、H1、H2、FAQ 和产品正文。
- 不使用客户端渲染生成核心内容，禁用 JavaScript 后仍可阅读完整官网。
- 保留中文关键词：文档扫描、证件扫描、身份证扫描、图片转 PDF、本地扫描、开源扫描工具。
- 图片设置 `alt` 文本，首屏图使用 `preload`。
