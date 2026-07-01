param(
  [ValidateSet("Debug", "Release", "Both")]
  [string]$AndroidVariant = "Debug"
)

$ErrorActionPreference = "Stop"

$RootDir = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$ArtifactsDir = Join-Path $RootDir "artifacts"

New-Item -ItemType Directory -Force -Path $ArtifactsDir | Out-Null

& (Join-Path $PSScriptRoot "package-android.ps1") -Variant $AndroidVariant -OutDir (Join-Path $ArtifactsDir "android")
& (Join-Path $PSScriptRoot "package-harmony.ps1") -OutDir (Join-Path $ArtifactsDir "harmony")
& (Join-Path $PSScriptRoot "package-ios.ps1") -OutDir (Join-Path $ArtifactsDir "ios")

Write-Host "All package outputs are under: $ArtifactsDir"
