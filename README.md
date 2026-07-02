# 扫描宝 · Scan Treasure

扫描宝是一个**免费、开源、纯本地处理**的文档扫描、证件扫描与 PDF 工具箱项目。

项目核心目标是：用户可以在手机浏览器或 App 内完成拍照扫描、图片增强、证件合成、PDF 导出和常用 PDF 处理，文件尽量留在本机处理，不上传到服务器。

## 当前状态

- Web/H5 应用已实现，代码位于 `web/`。
- Android Capacitor 工程已存在，代码位于 `web/android/`，当前可以打包 Android debug APK。
- iOS 原生工程、Apple 签名材料暂未准备，因此当前不打包 IPA。
- HarmonyOS 原生工程、DevEco/hvigor 环境暂未准备，因此当前不打包 HAP/APP。
- GitHub 会在每次推送到 `master/main` 后自动打包 Android，并更新 `latest` Release，用户可以在 Releases 页面直接点击 APK 下载。

## 功能

### 扫描功能

- 扫描文件：调用摄像头进入全屏扫描界面，适合文档拍摄。
- 文档扫描：从相册选择图片后进入裁剪与增强流程。
- 身份证扫描：支持正反面选择、区域裁剪、合成导出。
- 自动框选：扫描和选图后会尝试识别文档边缘；识别失败时使用接近取景框的兜底区域。
- 图像增强：支持彩色、高清、亮化、灰度、黑白等本地增强模式。
- 导出：支持导出图片和 PDF。

### PDF 工具箱

- PDF 合并
- PDF 拆分
- PDF 页面管理
- 图片转 PDF
- PDF 转图片
- PDF 压缩
- PDF 加水印
- PDF 加页码

说明：Word 转 PDF、PDF 转 Word 暂未实现。此类转换如果要保证格式、字体和排版质量，通常需要后端服务、LibreOffice、商业 SDK 或原生能力支持；纯前端实现很难稳定覆盖复杂文档。

## 隐私与合规

- 扫描、裁剪、增强、PDF 处理默认在当前设备本地完成。
- 项目代码中不依赖上传接口处理用户文件。
- 核心工具免费使用，无登录、无内购。
- 官网或应用中如出现外部推广入口，需要清晰标注，不能伪装成核心扫描功能。
- 本项目仅用于合法文档数字化，禁止用于伪造、变造证件或其它违法用途。

## 技术栈

- Vue 3
- Vite
- TypeScript
- Vant 4
- Capacitor
- pdf-lib
- pdfjs-dist
- jsPDF
- Canvas 本地图像处理

## 本地开发

```powershell
cd web
npm install
npm run dev
```

类型检查：

```powershell
cd web
npm run type-check
```

生产构建：

```powershell
cd web
npm run build
```

## 本地打包

在项目根目录执行：

```powershell
.\scripts\package-android.ps1 -Variant Debug
```

或进入 `web` 目录执行：

```powershell
npm run package:android
```

打包产物会输出到：

```text
artifacts/android/
```

当前本机和 GitHub Actions 都只启用 Android 打包。iOS 和 HarmonyOS 等准备好原生工程、签名材料与构建环境后再接入。

## GitHub 下载与自动打包

仓库地址：

- Actions: <https://github.com/zhouHongGui/scan-treasure/actions>
- Releases: <https://github.com/zhouHongGui/scan-treasure/releases>

当前可用的直接下载链接：

| 平台 | 链接 |
|---|---|
| Android Debug APK | <https://github.com/zhouHongGui/scan-treasure/releases/download/latest/ScanTreasure-Android-Debug.apk> |

暂未提供其它平台直接下载的原因：

- Android Release APK：需要先配置 Android 签名 Secrets。
- iOS IPA：需要先补齐 Capacitor iOS 工程，并配置 Apple 签名材料。
- HarmonyOS HAP/APP：需要先补齐 HarmonyOS 原生工程和 DevEco/hvigor 构建环境。

这些平台未接入前不会提供假链接，避免点击后 404。

自动打包配置位于：

```text
.github/workflows/build-apps.yml
```

触发规则：

| 操作 | 结果 | 下载位置 |
|---|---|---|
| push 到 `master` / `main` | 自动构建 Android 并更新 `latest` Release | GitHub Releases 页面，可直接点击 APK |
| 手动运行 `Build App Downloads` | 自动构建 Android 并更新 `latest` Release | GitHub Releases 页面，可直接点击 APK |
| push `v*` 标签，例如 `v0.0.1` | 自动构建并创建/更新对应版本 Release | GitHub Releases 页面 |

发布一个带下载链接的版本：

```powershell
git push origin master
git tag v0.0.1
git push origin v0.0.1
```

注意：

- 如果只提交到本地，没有 `git push`，GitHub 不会触发自动打包。
- push 到 `master/main` 后会更新 `latest` Release，适合作为“最新测试版”直接下载。
- 推送 `v*` 标签后会创建版本 Release，适合作为正式版本留档下载。

## 各平台打包说明

| 平台 | 当前仓库状态 | GitHub 是否能直接产出 |
|---|---|---|
| Android | 已有 `web/android` Capacitor 工程 | 可以产出 debug APK；配置签名后可产出 release APK |
| iOS | 暂无 `web/ios/App` 工程，暂无 Apple 签名材料 | 暂不接入自动打包 |
| HarmonyOS | 暂无 `web/harmony` 工程，暂无 DevEco/hvigor 环境 | 暂不接入自动打包 |

Android release APK 需要在 GitHub Actions Secrets 配置：

```text
ANDROID_KEYSTORE_BASE64
ANDROID_KEYSTORE_PASSWORD
ANDROID_KEY_ALIAS
ANDROID_KEY_PASSWORD
```

当前 GitHub Actions 未启用 iOS 打包。以后如果要生成 IPA，需要先加入 Capacitor iOS 工程，并配置 Apple 签名相关 Secrets：

```text
APPLE_CERTIFICATE_BASE64
APPLE_CERTIFICATE_PASSWORD
APPLE_PROVISION_PROFILE_BASE64
APPLE_TEAM_ID
IOS_PROVISIONING_PROFILE_NAME
IOS_BUNDLE_ID
IOS_EXPORT_METHOD
```

当前 GitHub Actions 未启用 HarmonyOS 打包。以后如果要生成 HAP/APP，需要先加入 HarmonyOS 原生壳工程，并按实际目录配置：

```text
HARMONY_PROJECT_DIR
HARMONY_WEB_DIST_DIR
```

## 官网

静态官网位于：

```text
official-site/
```

官网用于展示产品介绍、下载入口、隐私说明和外部推广入口。官网修改后可直接静态部署。

## 文档

| 文档 | 内容 |
|---|---|
| [产品需求文档](docs/01-产品需求文档.md) | 功能清单、优先级 |
| [技术方案对比](docs/02-技术方案对比.md) | H5 / 原生 / 混合对比 |
| [技术难度评估](docs/03-技术难度评估.md) | 逐模块难度与风险 |
| [开发计划](docs/04-开发计划.md) | 里程碑、时间、PDF 规格、测试集 |
| [架构决策](docs/05-架构决策-纯前端无服务器.md) | 为什么纯前端、无服务器 |
| [法律合规与免责](docs/06-法律合规与免责.md) | 协议、商标、使用规范、免责 |
| [PDF 工具箱与底部导航开发需求](docs/07-PDF工具箱与底部导航开发需求.md) | PDF 工具箱和底部导航规划 |
| [多端打包与 GitHub 下载发布](docs/08-多端打包与GitHub下载发布.md) | Android 打包、GitHub Release 下载与未来多端接入说明 |

## 开源协议

[MIT License](LICENSE) —— 可自由使用、修改、分发，请保留版权声明。
