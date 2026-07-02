param(
  [string]$ProjectDir,
  [string]$WebDistDir,
  [string]$OutDir,
  [switch]$RequireBuild
)

$ErrorActionPreference = "Stop"

$RootDir = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$WebDir = Join-Path $RootDir "web"

if (-not $ProjectDir) {
  $ProjectDir = if ($env:HARMONY_PROJECT_DIR) { $env:HARMONY_PROJECT_DIR } else { Join-Path $WebDir "harmony" }
}

if (-not $OutDir) {
  $OutDir = Join-Path $RootDir "artifacts\harmony"
}

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$StalePackageNames = @(
  "scan-treasure-harmony.hap",
  "scan-treasure-harmony.app",
  "ScanTreasure-HarmonyOS.hap",
  "ScanTreasure-HarmonyOS.app"
)
foreach ($Name in $StalePackageNames) {
  $Path = Join-Path $OutDir $Name
  if (Test-Path $Path) {
    Remove-Item -LiteralPath $Path -Force
  }
}

function Write-SkipNote {
  param([string]$Message)
  $Path = Join-Path $OutDir "harmony-not-built.txt"
  $Message | Set-Content -Encoding UTF8 -Path $Path
  Write-Host $Message
  if ($RequireBuild) {
    throw $Message
  }
}

if (-not (Test-Path $ProjectDir)) {
  Write-SkipNote "HarmonyOS project not found. Create a HarmonyOS WebView shell and set HARMONY_PROJECT_DIR before packaging."
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
}
finally {
  Pop-Location
}

if ($WebDistDir) {
  New-Item -ItemType Directory -Force -Path $WebDistDir | Out-Null
  Copy-Item -Path (Join-Path $WebDir "dist\*") -Destination $WebDistDir -Recurse -Force
}

$Hvigor = Join-Path $ProjectDir "hvigorw.bat"
if (-not (Test-Path $Hvigor)) {
  $Hvigor = Join-Path $ProjectDir "hvigorw"
}

if (-not (Test-Path $Hvigor)) {
  Write-SkipNote "HarmonyOS hvigor wrapper not found in $ProjectDir. Open the project in DevEco Studio once or add hvigorw."
  return
}

Push-Location $ProjectDir
try {
  & $Hvigor assembleHap --no-daemon
  if ($LASTEXITCODE -ne 0) {
    throw "HarmonyOS build failed with exit code $LASTEXITCODE"
  }
}
finally {
  Pop-Location
}

$Packages = Get-ChildItem -Path $ProjectDir -Recurse -Include *.hap,*.app -File -ErrorAction SilentlyContinue
if (-not $Packages) {
  throw "HarmonyOS build finished, but no .hap or .app package was found."
}

foreach ($Package in $Packages) {
  $TargetName = if ($Package.Extension -eq ".hap") { "ScanTreasure-HarmonyOS.hap" } else { "ScanTreasure-HarmonyOS.app" }
  Copy-Item -LiteralPath $Package.FullName -Destination (Join-Path $OutDir $TargetName) -Force
}

Write-Host "HarmonyOS packages:"
$Packages | ForEach-Object { Write-Host " - $($_.FullName)" }
