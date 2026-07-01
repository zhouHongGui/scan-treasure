# 扫描宝多端打包与 GitHub 下载发布

## 目标

每次更新代码后，能够打包并在 GitHub 提供下载：

- Android：APK，当前项目已具备 Capacitor Android 工程，可直接打 debug APK。
- HarmonyOS：HAP / APP，需要先补 HarmonyOS 原生壳工程和 DevEco / hvigor 构建环境。
- iOS：IPA，需要先补 Capacitor iOS 工程，并配置 Apple 开发者签名材料。

## 本地打包

在项目根目录执行：

```powershell
.\scripts\package-all.ps1
```

只打 Android debug APK：

```powershell
.\scripts\package-android.ps1 -Variant Debug
```

如果需要重新干净安装依赖：

```powershell
.\scripts\package-android.ps1 -Variant Debug -CleanInstall
```

只打 Android release APK：

```powershell
.\scripts\package-android.ps1 -Variant Release
```

产物输出到：

```text
artifacts/
```

当前 Windows 本机适合打 Android。iOS 必须在 macOS + Xcode 环境打包；HarmonyOS 必须有 HarmonyOS 工程和 hvigor。

Android Gradle 需要 JDK 17。脚本会优先使用当前 Java；如果版本低于 17 且本机存在 `D:\jdk17`，会自动切到该 JDK。

## npm 快捷命令

也可以进入 `web` 目录后执行：

```powershell
npm run package:android
npm run package:android:release
npm run package:harmony
npm run package:ios
npm run package:all
```

## GitHub Actions 自动打包

新增 workflow：

```text
.github/workflows/build-apps.yml
```

触发规则：

- push 到 `main` / `master`：自动打包并更新 `latest` GitHub Release，下载入口在 Releases 页面，可直接点击安装包下载。
- 手动执行 `Build App Downloads`：自动打包并更新 `latest` GitHub Release，下载入口同样在 Releases 页面。
- push `v*` 标签：自动打包并创建 / 更新对应版本 GitHub Release，下载入口在 Releases 页面。

最新构建直链：

```text
https://github.com/zhouHongGui/scan-treasure/releases/download/latest/scan-treasure-android-debug.apk
https://github.com/zhouHongGui/scan-treasure/releases/download/latest/scan-treasure-android-release.apk
https://github.com/zhouHongGui/scan-treasure/releases/download/latest/scan-treasure-harmony.hap
https://github.com/zhouHongGui/scan-treasure/releases/download/latest/scan-treasure-ios.ipa
```

说明：当前仓库只有 Android 原生工程，因此 `scan-treasure-android-debug.apk` 会优先可用。Android release、HarmonyOS、iOS 需要对应签名材料或原生工程补齐后才会生成真实安装包。

发布一个带下载链接的版本：

```powershell
git tag v0.1.0
git push origin v0.1.0
```

GitHub 会在 Releases 页面生成 `v0.1.0`，并挂载本次构建产物。版本包的直链格式如下：

```text
https://github.com/zhouHongGui/scan-treasure/releases/download/v0.1.0/scan-treasure-android-debug.apk
```

## Android Release 签名

如果没有配置签名，GitHub 只会稳定提供 debug APK，并生成 `android-release-not-built.txt` 说明。

要生成正式 release APK，需要在 GitHub 仓库：

```text
Settings -> Secrets and variables -> Actions -> Secrets
```

添加：

```text
ANDROID_KEYSTORE_BASE64
ANDROID_KEYSTORE_PASSWORD
ANDROID_KEY_ALIAS
ANDROID_KEY_PASSWORD
```

Windows 生成 keystore base64 示例：

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("release.jks")) | Set-Clipboard
```

不要把 `.jks` / `.keystore` 文件提交到仓库。

## iOS IPA 前置条件

当前仓库还没有 iOS 原生工程。需要先执行：

```powershell
cd web
npm install @capacitor/ios
npx cap add ios
```

iOS 打包还需要 GitHub macOS runner、Xcode、Apple Developer 账号和签名材料。

需要配置 GitHub Secrets：

```text
APPLE_CERTIFICATE_BASE64
APPLE_CERTIFICATE_PASSWORD
APPLE_PROVISION_PROFILE_BASE64
APPLE_TEAM_ID
IOS_PROVISIONING_PROFILE_NAME
IOS_BUNDLE_ID
IOS_EXPORT_METHOD
```

`IOS_EXPORT_METHOD` 常用值：

```text
development
ad-hoc
app-store
enterprise
```

未配置 iOS 工程或签名时，workflow 会输出 `ios-not-built.txt`，不会伪装成 IPA。

## HarmonyOS HAP 前置条件

当前仓库还没有 HarmonyOS 原生工程。建议后续建立一个 HarmonyOS WebView 壳工程，并让它加载 `web/dist` 内的静态资源。

默认工程路径：

```text
web/harmony
```

如果工程放在其他目录，需要在 GitHub：

```text
Settings -> Secrets and variables -> Actions -> Variables
```

添加：

```text
HARMONY_PROJECT_DIR
HARMONY_WEB_DIST_DIR
```

说明：

- `HARMONY_PROJECT_DIR`：HarmonyOS 工程目录。
- `HARMONY_WEB_DIST_DIR`：需要复制 Web 构建产物的目录，可按实际工程结构设置。

未配置 HarmonyOS 工程时，workflow 会输出 `harmony-not-built.txt`，不会伪装成 HAP。

## 每次更新建议流程

1. 本地开发完成后，执行 `npm run type-check` 和 `npm run build`。
2. 如需本地确认 Android 包，执行 `.\scripts\package-android.ps1 -Variant Debug`。
3. push 到 `main` / `master`，GitHub Actions 自动更新 `latest` Release，用户可直接下载最新安装包。
4. 确认功能无问题后打版本标签，例如 `v0.1.0`。
5. GitHub Releases 自动生成正式下载入口。
