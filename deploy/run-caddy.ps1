$ErrorActionPreference = "Stop"
$deployDir = $PSScriptRoot
$envFile = Join-Path $deployDir "caddy.env"
$caddyfile = Join-Path $deployDir "Caddyfile"

if (-not (Test-Path $envFile)) {
  Copy-Item (Join-Path $deployDir "caddy.env.example") $envFile
  Write-Host "[deploy] caddy.env 가 없어 예시를 복사했습니다. 도메인·경로를 수정한 뒤 다시 실행하세요." -ForegroundColor Yellow
  exit 1
}

Get-Content -LiteralPath $envFile -Encoding UTF8 | ForEach-Object {
  $line = $_.Trim()
  if ($line -eq "" -or $line.StartsWith("#")) { return }
  $p = $line.IndexOf("=")
  if ($p -lt 1) { return }
  $key = $line.Substring(0, $p).Trim()
  $val = $line.Substring($p + 1).Trim()
  Set-Item -Path "Env:$key" -Value $val
}

$need = @("GAME_WEB_HOST", "GAME_API_HOST", "GAME_DIST_ROOT")
foreach ($k in $need) {
  $v = [Environment]::GetEnvironmentVariable($k, "Process")
  if ([string]::IsNullOrWhiteSpace($v)) {
    Write-Host "[deploy] 환경변수 $k 가 비었습니다. deploy/caddy.env 를 채우세요." -ForegroundColor Red
    exit 1
  }
}

$dist = [Environment]::GetEnvironmentVariable("GAME_DIST_ROOT", "Process")
if (-not (Test-Path -LiteralPath $dist)) {
  Write-Host "[deploy] GAME_DIST_ROOT 폴더가 없습니다: $dist" -ForegroundColor Red
  Write-Host "        먼저: .\deploy\build-client-prod.ps1 -ApiWssUrl `"wss://api.내도메인`"" -ForegroundColor Yellow
  exit 1
}

$caddyExe = [Environment]::GetEnvironmentVariable("CADDY_EXE", "Process")
if (-not [string]::IsNullOrWhiteSpace($caddyExe)) {
  $caddyExe = $caddyExe.Trim()
}
$caddyResolved = $null
if (-not [string]::IsNullOrWhiteSpace($caddyExe) -and (Test-Path -LiteralPath $caddyExe)) {
  $caddyResolved = (Resolve-Path -LiteralPath $caddyExe).Path
}

if (-not $caddyResolved) {
  $caddyCmd = Get-Command caddy -ErrorAction SilentlyContinue
  if ($caddyCmd) {
    $caddyResolved = "caddy"
  }
}

if (-not $caddyResolved) {
  Write-Host "[deploy] Caddy 실행 파일을 찾을 수 없습니다." -ForegroundColor Red
  Write-Host "       deploy\caddy.env 에 CADDY_EXE=.../caddy.exe 를 넣거나, PATH 에 caddy 를 추가하세요." -ForegroundColor Yellow
  exit 1
}

$wh = [Environment]::GetEnvironmentVariable("GAME_WEB_HOST", "Process")
$ah = [Environment]::GetEnvironmentVariable("GAME_API_HOST", "Process")
Write-Host "[deploy] Caddy 시작 — 웹: $wh  |  API 프록시: $ah -> localhost:2567" -ForegroundColor Cyan
Write-Host "[deploy] dist: $dist" -ForegroundColor DarkGray
Write-Host "[deploy] caddy: $caddyResolved" -ForegroundColor DarkGray

Push-Location $deployDir
try {
  & $caddyResolved run --config $caddyfile
} finally {
  Pop-Location
}
