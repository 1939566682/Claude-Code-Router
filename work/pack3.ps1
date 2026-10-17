$asarCmd = 'D:\Github\claude-code-router\node_modules\.bin\asar.cmd'
$diy = 'D:\SoftWare\gateway\claude_code_router_diy'
$src = Join-Path $diy 'resources\app.asar'
$tmp = Join-Path $diy 'resources\app.asar.extract.tmp'
$electronDist = 'D:\Github\claude-code-router\packages\electron\dist'
if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
& $asarCmd extract $src $tmp
if (Test-Path $tmp) { Write-Host 'extract ok' }
# Must update BOTH asar locations: Electron's entry is dist/main/main.js (from package.json "main"),
# but the repack's source is packages/electron/dist/main/main.js — so sync to both dist/main and dist/electron/main.
# Use copy of individual files to avoid nesting (dist/main/dist/main) from cp -r.
robocopy $electronDist (Join-Path $tmp 'dist\electron') /E /NFL /NDL /NJH /NJS | Out-Null
# Also sync the entry path that Electron actually loads (dist/main/main.js), otherwise stale asar runs old code.
Copy-Item (Join-Path $electronDist 'main\main.js') (Join-Path $tmp 'dist\main\main.js') -Force
Copy-Item (Join-Path $electronDist 'main\request-log-worker.js') (Join-Path $tmp 'dist\main\request-log-worker.js') -Force
Copy-Item (Join-Path $electronDist 'main\request-log-worker.js') (Join-Path $tmp 'dist\electron\main\request-log-worker.js') -Force -ErrorAction SilentlyContinue
Write-Host 'robocopy+sync done'
& $asarCmd pack $tmp $src
Write-Host "pack exit $LASTEXITCODE"
Get-ChildItem $src | Select-Object Length,LastWriteTime | Format-Table -AutoSize
Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
Write-Host 'done'
