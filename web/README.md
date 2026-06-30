# 扫描宝 Web（Scan Treasure）

Vue 3 + Vite + TypeScript + Vant 4 前端工程。

> 🔧 **后续开发交接给 Kimi**，完整背景见 [`../docs/HANDOFF.md`](../docs/HANDOFF.md)
> （含已踩的坑、当前进度、M3~M5 路线）。

## 开发

```bash
npm install
npm run dev
```

手机预览（同一 WiFi 下）：用手机浏览器打开终端里显示的 `Network: http://<电脑IP>:5173`。

> 注意：手机访问需电脑防火墙放行 5173 端口。

## 构建

```bash
npm run build      # 产物在 dist/，可直接托管到 GitHub Pages
npm run preview    # 本地预览构建产物
npm run type-check # 仅类型检查
```

## 当前进度

- [x] **M0** 脚手架（Vite + Vue3 + TS + Vant + 移动端适配）
- [x] **M1** 相册选图 + 显示（已端到端验证）
- [~] **M2** 边缘检测 + 手动调边（代码完成，opencv.js 加载刚修复工厂函数分支，**待复测**）
- [ ] **M3** 透视校正
- [ ] **M4** 去阴影 / 增强
- [ ] **M5** PDF 导出 → 🎉 MVP

## 重要提醒（给接手者）
- `public/opencv.js`（11MB）是本地化的图像引擎，**勿删勿改**，来源 `@techstark/opencv-js@4.12`
- `window.cv` 是**工厂函数**，需调用 `cv()`（详见 `src/composables/useOpenCV.ts`）
- vue-router 锁 4.x、pinia 锁 2.x（5.x/3.x 与 vite 5 冲突）
- 详细交接说明见 [`../docs/HANDOFF.md`](../docs/HANDOFF.md)
