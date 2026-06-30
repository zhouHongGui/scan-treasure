# 扫描宝 开发交接文档

> 交接日期：2026-06-22
> 最近更新：2026-06-22（完成 M3/M4/M5，type-check + 生产构建均通过）
> 接手方：后续开发者/AI
> 前序开发：Claude（GLM）完成 M0~M2；Codex 完成 M3/M4/M5 + 已知待办修复

---

## 0. 一分钟速览

扫描宝 = **开源（MIT）、免费、纯前端**的文档/证件扫描 H5。手机浏览器扫码即用，所有图像处理在本地，证件不上传。

**当前进度**：M0~M5 全部完成（选图→边缘→透视→增强→导出 PDF 已闭环）。`npm run type-check` 与 `npm run build` 均通过。**待办**：真机端到端验收（11MB wasm 首次编译耗时、iOS 内存、各模式视觉效果），以及 P1 多页/证件拼版（M6+）。

---

## 1. 不可违背的约束（已与产品方确认）

| 约束 | 原因 |
|---|---|
| **纯前端，无后端服务器** | 隐私（证件不上传）+ 零成本 + 开源友好 |
| **开源 MIT** | 已定协议，根目录有 LICENSE |
| **不对标任何商业产品**（不要写"扫描全能王替代"等）| 商标/不正当竞争风险，见 docs/06 |
| **主打相册选图**，相机仅辅助 | iOS/微信内置浏览器相机基本调不起来 |
| **图像进 OpenCV 前压缩最长边 ≤ 2000px** | 防 iOS Safari wasm 内存崩溃 |
| **OCR 列 P2，MVP 不做** | 次要功能，主流程不需要 |

---

## 2. ⚠️ 已踩的坑（最重要，别重复踩）

### 坑 1：opencv.js 不能用外网 CDN
`docs.opencv.org` **国内访问不通**，会一直 loading。
**解决**：opencv.js 已本地化到 `web/public/opencv.js`（11MB），来源是 npm 包 `@techstark/opencv-js@4.12`。走 vite 静态服务，手机通过局域网加载。

### 坑 2：@techstark/opencv-js 的 cv 是"工厂函数"，不是直接对象
它的 UMD 是 emscripten **MODULARIZE** 输出：
```js
// window.cv 不是对象也不是 Promise，是一个函数！
// 必须调用 cv() 才返回 Promise<Module>
const realCv = await window.cv()
realCv.Mat // 真正的模块
```
`src/composables/useOpenCV.ts` 已写好兼容 4 种形态的判断（工厂函数 / Promise / 带 Mat 的对象 / onRuntimeInitialized），并带 60s 超时兜底。**如果复测还卡 loading，第一步就是查这里**——加 `console.log(typeof window.cv)` 确认形态。

### 坑 3：vue-router 必须 4.x、pinia 必须 2.x
装最新版（vue-router 5 / pinia 3）会要求 vite 7+，与当前 vite 5 peer 冲突，报 ERESOLVE。
**解决**：`npm install vue-router@4 pinia@2`。package.json 已锁定 `^4.6.4` / `^2.3.1`。

### 坑 4：dev server 后台启动在该环境可能被清理
Claude 工具里 `npm run dev &` 后台跑，进程可能被回收。**建议让用户自己在输入框用 `! npm run dev` 启动**，更稳。

---

## 3. 项目结构（当前文件清单与职责）

```
smart-scan/
├─ README.md                         项目门面（特性、文档导航、免责摘要）
├─ LICENSE                           MIT
├─ docs/
│  ├─ 01-产品需求文档.md              功能清单 + 优先级（OCR 已降 P2）
│  ├─ 02-技术方案对比.md              H5/原生/混合三方案
│  ├─ 03-技术难度评估.md              逐模块难度与风险
│  ├─ 04-开发计划.md                  里程碑、时间、PDF规格、边缘fallback、测试集
│  ├─ 05-架构决策-纯前端无服务器.md    为什么无服务器 + 移动端坑位
│  ├─ 06-法律合规与免责.md            协议/商标/使用规范/免责
│  └─ HANDOFF.md                     ← 本文件
└─ web/                              前端工程
   ├─ package.json                   vue3 / vite5 / vant4 / vue-router4 / pinia2
   ├─ vite.config.ts                 @别名 + px→vw适配(375) + host 0.0.0.0
   ├─ tsconfig.json / tsconfig.node.json
   ├─ index.html                     移动端 viewport + 安全区
   ├─ public/
   │  └─ opencv.js                   ★11MB 本地化，勿删、勿改
   └─ src/
      ├─ main.ts                     挂载 Vue + pinia + router + Vant全量
      ├─ App.vue                     <router-view> + keep-alive
      ├─ types/opencv.d.ts           window.cv 宽松类型声明
      ├─ styles/main.css             全局样式 + CSS变量
      ├─ router/index.ts             / (Home) + /edit (懒加载)
      ├─ store/scan.ts               pinia: 原图/处理图/角点
      ├─ utils/
      │  ├─ image.ts                 loadImage / getImageSize / formatSize / compressToDataUrl
      │  └─ geometry.ts              Corner类型 / orderCorners(排序) / fullImageCorners(兜底)
      ├─ composables/
      │  ├─ useImagePicker.ts        选图：校验/url/dataUrl/尺寸/释放
      │  ├─ useOpenCV.ts             ★opencv.js加载，兼容4种cv形态（见坑2）
      │  └─ useEdgeDetect.ts         边缘检测算法，手动管理Mat内存
      ├─ components/
      │  └─ CornerCanvas.vue         ★可拖拽角点画布：Canvas绘图+遮罩+触摸拖拽+DPR
      └─ views/
         ├─ Home.vue                 M1：选图→跳/edit  ✅已验证
         └─ Edit.vue                 M2：opencv加载→压缩→检测→手动调边  🟡待复测
```

**文件完成度**：
- ✅ 完成且端到端验证：`Home.vue`、`useImagePicker.ts`、`image.ts`
- ✅ 完成编译/类型检查，但真机交互未验证：`CornerCanvas.vue`、`useEdgeDetect.ts`
- 🟡 完成但加载逻辑刚改、待复测：`useOpenCV.ts`、`Edit.vue`
      ├─ router/index.ts             / (Home) + /edit + /enhance (均懒加载)
      ├─ store/scan.ts               pinia: 原图/处理图/角点/摆正图/增强模式/增强结果
      ├─ utils/
      │  ├─ image.ts                 loadImage / getImageSize / formatSize / compressToDataUrl
      │  ├─ geometry.ts              Corner类型 / orderCorners(排序) / fullImageCorners(兜底)
      │  └─ pdf.ts                   ★M5：exportImageToPdf (A4居中) / exportImageFile / dataUrlToBlob
      ├─ composables/
      │  ├─ useImagePicker.ts        选图：校验/url/dataUrl/尺寸/释放
      │  ├─ useOpenCV.ts             ★opencv.js加载，兼容4种cv形态（见坑2）+ 60s超时
      │  ├─ useEdgeDetect.ts         边缘检测算法，手动管理Mat内存
      │  ├─ usePerspective.ts        ★M3：warpToQuad 透视校正（getPerspectiveTransform+warpPerspective）
      │  └─ useEnhance.ts            ★M4：enhanceImage 四模式（color/brighten/gray/bw）
      ├─ components/
      │  └─ CornerCanvas.vue         ★可拖拽角点画布：Canvas绘图+遮罩+触摸拖拽+DPR
      └─ views/
         ├─ Home.vue                 M1：选图→跳/edit  ✅已验证
         ├─ Edit.vue                 M2：opencv加载→压缩→检测→手动调边→跳/enhance
         └─ Enhance.vue              ★M3+M4+M5：透视校正→预览→模式切换→导出PDF/存图

> 上方为 M2 阶段的旧快照，M3~M5 后的当前结构见「文件完成度」与源码：
- ✅ 完成编译/类型检查（type-check + build 通过），真机交互待验收：`CornerCanvas.vue`、`useEdgeDetect.ts`、`Edit.vue`、`Enhance.vue`、`usePerspective.ts`、`useEnhance.ts`、`pdf.ts`、`useOpenCV.ts`
- ⏳ 真机端到端验收（wasm 首次编译耗时、各模式视觉效果、PDF 下载）尚未做

---

## 4. 如何运行

```bash
# 环境：Node v20.15.1 / npm 10.7.0（已确认）
cd web
npm install          # 已装好，除非删了 node_modules
npm run dev
```

启动后：
- 电脑：http://localhost:5173/
- 手机（同 WiFi）：终端显示的 Network 地址，如 http://10.10.1.100:5173/
- 防火墙要放行 5173 端口

构建：`npm run build`（产物 dist/，可托管 GitHub Pages）
类型检查：`npm run type-check`

---

## 5. 接手第一步：复测 M2（关键）

M2 代码已完成，但产品方最后反馈"一直卡 loading"，我已定位并修复（坑 2：cv 是工厂函数），**但产品方尚未确认修复有效**。接手者请先确认：

### 验证步骤
1. `npm run dev` 启动
2. 手机硬刷新 `http://<IP>:5173/`，选一张**有明显边缘**的文档照片（放桌上、背景有色差）
3. 自动跳 `/edit`，显示 loading
4. 观察：
   - **预期成功**：几秒~20秒（11MB wasm 编译，中端机 3~10s，低端机可能 10~20s）后 loading 消失，显示图片 + 蓝色四边形 + 4 个可拖圆点
   - **预期兜底**：识别不出 → 全图四角 + 顶部橙字"未自动识别，请拖动四角"

### 如果还卡 loading（超过 30 秒）
按顺序排查：
1. 浏览器控制台看报错
2. 在 `useOpenCV.ts` 的 `script.onload` 开头加 `console.log('cv loaded, type:', typeof w.cv, w.cv)`
3. 确认 `typeof w.cv === 'function'` → 应走工厂分支 `exported()`
4. 给工厂调用加 `.then(cv => console.log('ready', !!cv.Mat))`
5. **加超时**：当前代码无超时，建议加 60s 超时 reject，避免永久 pending

### M2 验证通过的标志
- [ ] opencv.js 能加载并初始化（loading 消失）
- [ ] 干净背景图能自动框出文档四边形
- [ ] 角点可用手指/鼠标拖动，遮罩和边线实时跟随
- [ ] "重置为全图"按钮工作正常

---

## 6. 开发路线（M3 ~ M5 已完成，M6+ 待办）

### M3：透视校正（摆正）
- [x] 新建 `/enhance` 路由 + `views/Enhance.vue`
- [x] `usePerspective.ts`：`warpToQuad()` 用 `getPerspectiveTransform` + `warpPerspective`，目标宽高取角点边长最大值，Mat 全部 delete
- [x] Edit.vue 的 `onNext` 改为 `router.push('/enhance')`，摆正结果存 store.warpedImage
  > ⚠️ opencv.js 的 `getPerspectiveTransform` 是 **2 参返回式**（返回新 3x3 Mat），**没有** 3 参写回式，别写错。

### M4：去阴影 / 增强 / 多色彩模式
- [x] `useEnhance.ts`：`enhanceImage()` 四模式 —— color（Unsharp Masking 轻锐化）/ brighten（除法归一化去阴影，denom=blur+1 防除零）/ gray / bw（adaptiveThreshold 自适应阈值）
- [x] 单通道结果统一 `cvtColor(GRAY2RGBA)` 再导出，imshow/JPEG 编码一致
- [x] Enhance.vue 提供彩色/增亮/灰度/黑白 切换，结果存 store.enhancedImage
  > ⚠️ opencv.js 的 `cv.add(src1, src2, dst)` 必须传 dst，不能用 `new cv.Scalar` 当 src2（会报参数数错）。

### M5：PDF 导出 → 🎉 MVP
- [x] 装依赖 `jspdf@^2.5`（沙箱会拦 npm cache 写入 AppData，需放开权限安装）
- [x] `utils/pdf.ts`：`exportImageToPdf()` —— A4(210×297mm)、留 10mm 边距按比例居中、JPEG 重编码 0.85、`doc.save()` 触发下载；`exportImageFile()` 直接存图
- [x] Enhance.vue 接入「导出 PDF」+「存图片」按钮
- [ ] 身份证拼版（P1，仍属 M6+）

### M6+（P1，可选）
- 多页管理（Pinia 存数组，缩略图列表，拖拽排序）
- 证件模板拼版
- OCR（P2，前端 Tesseract.js，文档提供"自部署 PaddleOCR"可选出口）

---

## 7. 代码风格与约定

- **TypeScript 严格模式**（`tsconfig.json` 的 strict + noUnusedLocals/Parameters）→ 写代码注意别留未用变量/参数（`_` 前缀豁免）
- **opencv.js 内存必须手动管**：每个 `new cv.Mat()` 用完 `.delete()`，`MatVector`、`cv.Size`、`cv.Mat.ones()` 同样。否则 iOS 很快崩。参考 `useEdgeDetect.ts` 的 try/finally 模式
- **角点坐标基于 workingImage 尺寸**（压缩到 2000px 后的），不是原图
- **移动端适配**：用 px（postcss 自动转 vw，375 设计稿基准）
- **注释中文**，与现有一致

---

## 8. 已知待办 / 改进点

| 项 | 说明 |
|---|---|
| ~~useOpenCV 加超时~~ | ✅ 已加 60s 超时（LOAD_TIMEOUT_MS），wasm 卡死不再永久 pending |
| ~~Edit.vue loading 文案~~ | ✅ 已改为“正在加载图像引擎/处理图片/识别文档边缘” |
| CornerCanvas 真机顺滑度 | rAF 节流已加，但未真机验证；触摸跟手性可能需调 |
| 角点初始命中区 | handle 28px 圆点，手指粗的可能误触相邻；可扩大命中区但视觉不变 |
| opencv.js 体积 | 11MB，可考虑自行编译精简版（只含需要的模块），但工程量大，先不做 |
| 测试图片集 | docs/04 计划 20~30 张验收集，尚未建立 |
| 错误上报 | 暂不做（个人项目过度工程），后期用户量大再考虑 |

---

## 9. 设计文档索引
完整背景见 `docs/01~06`：
- 01 产品需求 / 02 方案对比 / 03 难度评估 / 04 开发计划（含 PDF 规格、边缘 fallback、测试集）/ 05 架构决策 / 06 法律合规

**遇到取舍先看 docs/04（开发计划）和 docs/05（架构决策），大部分决策已论证过。**
