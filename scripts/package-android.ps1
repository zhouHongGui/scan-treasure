param(
  [ValidateSet("Debug", "Release", "Both")]
  [string]$Variant = "Debug",
  [string]$OutDir,
  [switch]$CleanInstall
)

$ErrorActionPreference = "Stop"

$RootDir = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$WebDir = Join-Path $RootDir "web"
$AndroidDir = Join-Path $WebDir "android"

if (-not $OutDir) {
  $OutDir = Join-Path $RootDir "artifacts\android"
}

function Invoke-Checked {
  param(
    [string]$Name,
    [string]$FilePath,
    [string[]]$Arguments,
    [string]$WorkingDirectory
  )

  Write-Host "==> $Name"
  Push-Location $WorkingDirectory
  try {
    & $FilePath @Arguments
    if ($LASTEXITCODE -ne 0) {
      throw "$Name failed with exit code $LASTEXITCODE"
    }
  }
  finally {
    Pop-Location
  }
}

if (-not (Test-Path $AndroidDir)) {
  throw "Android project not found: $AndroidDir"
}

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

function Get-JavaMajorVersion {
  try {
    $VersionText = (& java -version 2>&1 | Out-String)
    if ($VersionText -match 'version "(\d+)') {
      return [int]$Matches[1]
    }
  }
  catch {
    return 0
  }

  return 0
}

if ((Get-JavaMajorVersion) -lt 17) {
  $LocalJdk17 = "D:\jdk17"
  if (Test-Path $LocalJdk17) {
    $env:JAVA_HOME = $LocalJdk17
    $env:Path = "$env:JAVA_HOME\bin;$env:Path"
    Write-Host "Using local JDK 17: $env:JAVA_HOME"
  }
}

if ($CleanInstall -or -not (Test-Path (Join-Path $WebDir "node_modules"))) {
  Invoke-Checked "Install web dependencies" "npm.cmd" @("ci") $WebDir
}
else {
  Write-Host "==> Reuse existing web dependencies. Pass -CleanInstall to run npm ci."
}
Invoke-Checked "Type check" "npm.cmd" @("run", "type-check") $WebDir
Invoke-Checked "Build web" "npm.cmd" @("run", "build") $WebDir
Invoke-Checked "Sync Capacitor Android" "npx.cmd" @("cap", "sync", "android") $WebDir

$Gradle = if ($IsWindows -or $env:OS -eq "Windows_NT") {
  Join-Path $AndroidDir "gradlew.bat"
} else {
  Join-Path $AndroidDir "gradlew"
}
$Tasks = switch ($Variant) {
  "Debug" { @("assembleDebug") }
  "Release" { @("assembleRelease") }
  "Both" { @("assembleDebug", "assembleRelease") }
}

foreach ($Task in $Tasks) {
  Invoke-Checked "Gradle $Task" $Gradle @($Task, "--no-daemon") $AndroidDir
}

$Patterns = @(
  "app\build\outputs\apk\debug\*.apk",
  "app\build\outputs\apk\release\*.apk",
  "app\build\outputs\bundle\release\*.aab"
)

$Copied = @()
foreach ($Pattern in $Patterns) {
  Get-ChildItem -Path (Join-Path $AndroidDir $Pattern) -ErrorAction SilentlyContinue | ForEach-Object {
    $Target = Join-Path $OutDir $_.Name
    Copy-Item -LiteralPath $_.FullName -Destination $Target -Force
    $Copied += $Target
  }
}

if ($Copied.Count -eq 0) {
  throw "No Android package was produced."
}

Write-Host "Android packages:"
$Copied | ForEach-Object { Write-Host " - $_" }
