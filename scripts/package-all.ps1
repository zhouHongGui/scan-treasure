param(
  [ValidateSet("Debug", "Release", "Both")]
  [string]$AndroidVariant = "Debug"
)

$ErrorActionPreference = "Stop"

$RootDir = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$ArtifactsDir = Join-Path $RootDir "artifacts"

New-Item -ItemType Directory -Force -Path $ArtifactsDir | Out-Null

& (Join-Path $PSScriptRoot "package-android.ps1") -Variant $AndroidVariant -OutDir (Join-Path $ArtifactsDir "android")

Write-Host "Android package outputs are under: $(Join-Path $ArtifactsDir "android")"
Write-Host "iOS and HarmonyOS packaging are not enabled in this repository yet."
