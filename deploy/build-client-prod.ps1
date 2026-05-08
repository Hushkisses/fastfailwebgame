param(
  [Parameter(Mandatory = $true)]
  [string]$ApiWssUrl
)

$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $root

$env:VITE_SERVER_URL = $ApiWssUrl
Write-Host "[deploy] VITE_SERVER_URL=$ApiWssUrl 로 클라이언트 빌드 중..." -ForegroundColor Cyan
npm run build --workspace @game/client
Write-Host "[deploy] 완료: apps/client/dist" -ForegroundColor Green
