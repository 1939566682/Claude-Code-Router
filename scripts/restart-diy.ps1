param(
  [string]$RestoreAsarBackup = ''
)

$ErrorActionPreference = 'Stop'
$exe = 'D:\SoftWare\gateway\claude_code_router_diy\Claude Code Router.exe'
$healthUrl = 'http://127.0.0.1:3456/health'

if (-not (Test-Path -LiteralPath $exe)) {
  throw "DIY gateway executable not found: $exe"
}

$processes = Get-Process -Name 'Claude Code Router' -ErrorAction SilentlyContinue
if ($processes) {
  $processes | Stop-Process -Force
}
Start-Sleep -Seconds 2
if ($RestoreAsarBackup) {
  if (-not (Test-Path -LiteralPath $RestoreAsarBackup)) { throw "Requested app.asar backup not found: $RestoreAsarBackup" }
  Copy-Item -LiteralPath $RestoreAsarBackup -Destination (Join-Path (Split-Path -Parent $exe) 'resources\app.asar') -Force
}
Start-Process -FilePath $exe -WorkingDirectory (Split-Path -Parent $exe) -WindowStyle Hidden

$healthy = $false
for ($attempt = 0; $attempt -lt 30; $attempt++) {
  try {
    $response = Invoke-RestMethod -Uri $healthUrl -TimeoutSec 2
    if ($response.status -eq 'ok') {
      Write-Output "health $($response.runtimeId) ok"
      $healthy = $true
      break
    }
  } catch {
    Start-Sleep -Seconds 1
  }
}

if (-not $healthy) {
  throw 'DIY gateway did not become healthy at 127.0.0.1:3456.'
}

$middleware = Join-Path $env:APPDATA 'claude-code-router\bin\ccr-codex-cli-middleware.js'
if (Test-Path -LiteralPath $middleware) {
  & node --check $middleware
  if ($LASTEXITCODE -ne 0) { throw 'Codex CLI middleware syntax check failed.' }
}
