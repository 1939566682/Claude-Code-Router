$asarCmd = 'D:\Github\claude-code-router\node_modules\.bin\asar.cmd'
$diy = 'D:\SoftWare\gateway\claude_code_router_diy'
$src = Join-Path $diy 'resources\app.asar'
$tmp = Join-Path $diy 'resources\app.asar.extract.tmp'
$electronDist = 'D:\Github\claude-code-router\packages\electron\dist'
if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
cmd /c  "$asarCmd" extract $src"  $tmp"
if (Test-Path $tmp) { Write-Host 'extract ok' }
robocopy $electronDist (Join-Path $tmp 'dist\electron') /E /NFL /NDL /NJH /NJS | Out-Null
Write-Host 'robocopy done'
cmd /c "$asarCmd" pack $tmp"  $src"
Write-Host pack exit $LASTEXITCODE
Get-ChildItem $src | Select-Object Length,LastWriteTime | Format-Table -AutoSize
Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
Write-Host 'done'
