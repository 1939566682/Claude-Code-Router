# verify provider filter is correct
$f = Get-Content 'D:\Github\claude-code-router\packages\core\src\observability\request-log-store.ts' -Raw
if ($f -match 'COLLATE NOCASE') { Write-Host 'COLLATE patched' } else { Write-Host 'COLLATE missing' }
if ($f -match 'readDistinctValues') { Write-Host 'readDistinctValues present' }
# Check provider line
Select-String -Path 'D:\Github\claude-code-router\packages\core\src\observability\request-log-store.ts' -Pattern 'provider.*COLLATE' -SimpleMatch | ForEach-Object { Write-Host .Line }
