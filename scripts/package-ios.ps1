param(
  [string]$OutDir,
  [switch]$RequireBuild
)

$ErrorActionPreference = "Stop"

$RootDir = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$WebDir = Join-Path $RootDir "web"
$IosDir = Join-Path $WebDir "ios"

if (-not $OutDir) {
  $OutDir = Join-Path $RootDir "artifacts\ios"
}

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$StalePackageNames = @(
  "scan-treasure-ios.ipa",
  "ScanTreasure-iOS.ipa"
)
foreach ($Name in $StalePackageNames) {
  $Path = Join-Path $OutDir $Name
  if (Test-Path $Path) {
    Remove-Item -LiteralPath $Path -Force
  }
}

function Write-SkipNote {
  param([string]$Message)
  $Path = Join-Path $OutDir "ios-not-built.txt"
  $Message | Set-Content -Encoding UTF8 -Path $Path
  Write-Host $Message
  if ($RequireBuild) {
    throw $Message
  }
}

$IsMac = [System.Runtime.InteropServices.RuntimeInformation]::IsOSPlatform(
  [System.Runtime.InteropServices.OSPlatform]::OSX
)

if (-not $IsMac) {
  Write-SkipNote "iOS packaging requires macOS, Xcode, an iOS Capacitor project, and Apple signing assets."
  return
}

$Workspace = Join-Path $IosDir "App\App.xcworkspace"
if (-not (Test-Path $Workspace)) {
  Write-SkipNote "iOS Capacitor project not found. Install @capacitor/ios and run 'npx cap add ios' before packaging."
  return
}

if (-not $env:APPLE_TEAM_ID -or -not $env:IOS_PROVISIONING_PROFILE_NAME) {
  Write-SkipNote "Apple signing environment is incomplete. Set APPLE_TEAM_ID and IOS_PROVISIONING_PROFILE_NAME before building IPA."
  return
}

Push-Location $WebDir
try {
  npm ci
  if ($LASTEXITCODE -ne 0) { throw "npm ci failed" }
  npm run type-check
  if ($LASTEXITCODE -ne 0) { throw "type-check failed" }
  npm run build
  if ($LASTEXITCODE -ne 0) { throw "web build failed" }
  npx cap sync ios
  if ($LASTEXITCODE -ne 0) { throw "cap sync ios failed" }
}
finally {
  Pop-Location
}

$ArchivePath = Join-Path $OutDir "ScanTreasure.xcarchive"
$ExportOptionsPath = Join-Path $OutDir "ExportOptions.plist"
$ExportMethod = if ($env:IOS_EXPORT_METHOD) { $env:IOS_EXPORT_METHOD } else { "ad-hoc" }
$BundleId = if ($env:IOS_BUNDLE_ID) { $env:IOS_BUNDLE_ID } else { "com.smartscan.app" }

@"
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>method</key>
  <string>$ExportMethod</string>
  <key>teamID</key>
  <string>$env:APPLE_TEAM_ID</string>
  <key>signingStyle</key>
  <string>manual</string>
  <key>provisioningProfiles</key>
  <dict>
    <key>$BundleId</key>
    <string>$env:IOS_PROVISIONING_PROFILE_NAME</string>
  </dict>
</dict>
</plist>
"@ | Set-Content -Encoding UTF8 -Path $ExportOptionsPath

xcodebuild `
  -workspace $Workspace `
  -scheme App `
  -configuration Release `
  -sdk iphoneos `
  -archivePath $ArchivePath `
  archive `
  DEVELOPMENT_TEAM=$env:APPLE_TEAM_ID `
  CODE_SIGN_STYLE=Manual `
  PROVISIONING_PROFILE_SPECIFIER=$env:IOS_PROVISIONING_PROFILE_NAME

if ($LASTEXITCODE -ne 0) {
  throw "xcodebuild archive failed with exit code $LASTEXITCODE"
}

xcodebuild `
  -exportArchive `
  -archivePath $ArchivePath `
  -exportPath $OutDir `
  -exportOptionsPlist $ExportOptionsPath

if ($LASTEXITCODE -ne 0) {
  throw "xcodebuild export failed with exit code $LASTEXITCODE"
}

Write-Host "iOS packages:"
$IpaFiles = Get-ChildItem -Path $OutDir -Filter *.ipa -File
foreach ($Ipa in $IpaFiles) {
  $Target = Join-Path $OutDir "ScanTreasure-iOS.ipa"
  if ($Ipa.FullName -ne $Target) {
    Move-Item -LiteralPath $Ipa.FullName -Destination $Target -Force
  }
  Write-Host " - $Target"
}
