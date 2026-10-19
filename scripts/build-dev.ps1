param(
  [switch]$Install,
  [switch]$UnpackedOnly
)
# 一键构建 Dev 版到 D:\SoftWare\gateway\claude-code-router-dev
#   .\scripts\build-dev.ps1                # 免安装版 win-unpacked
#   .\scripts\build-dev.ps1 -Install       # 打 NSIS 安装包（安装后与原版共存需改 productName/appId）
#   .\scripts\build-dev.ps1 -UnpackedOnly  # 只编 dist+拷贝到 unpacked，不走 electron-builder（最快验证）

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot/..
$DevOutput = "D:/SoftWare/gateway/claude-code-router-dev"

Write-Host "==> build:assets (esbuild)..."
npm run build:assets
if ($LASTEXITCODE -ne 0) { throw "build:assets failed" }

if ($UnpackedOnly) {
  # 仅验证产物已在 packages/electron/dist
  Write-Host "==> UnpackedOnly: 产物在 packages/electron/dist，手动调试用 npm run dev:electron 更快"
  Write-Host "    如需免安装目录，请用不带 -UnpackedOnly 的默认模式"
  exit 0
}

# 预检
node build/windows-package-preflight.mjs
if ($LASTEXITCODE -ne 0) { throw "windows preflight failed" }

if ($Install) {
  Write-Host "==> electron-builder (NSIS 安装包) -> $DevOutput ..."
  npx electron-builder --config build/electron-builder.dev.cjs --win --publish never
} else {
  Write-Host "==> electron-builder (win unpacked 免安装) -> $DevOutput ..."
  npx electron-builder --config build/electron-builder.dev.cjs --win --publish never --dir
}
if ($LASTEXITCODE -ne 0) { throw "electron-builder failed" }

Write-Host ""
Write-Host "✅ 完成 -> $DevOutput"
Get-ChildItem $DevOutput -Directory -ErrorAction SilentlyContinue | Format-Table Name, LastWriteTime -AutoSize
Get-ChildItem $DevOutput -File -ErrorAction SilentlyContinue | Select-Object Name, Length, LastWriteTime | Format-Table -AutoSize
Write-Host ""
Write-Host "运行：$DevOutput/win-unpacked/Claude Code Router.exe"
Write-Host "开发热更：npm run dev:electron  (改代码即生效，无需重新打包)"
