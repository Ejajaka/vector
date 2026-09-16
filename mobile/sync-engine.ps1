# Copy the shared engine from ../src into www/src so the mobile app stays in
# sync with the extension's analyzer. Run after changing anything in ../src.
# Usage:  powershell -ExecutionPolicy Bypass -File sync-engine.ps1

$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$dst  = Join-Path $PSScriptRoot "www\src"

if (-not (Test-Path $dst)) { New-Item -ItemType Directory -Path $dst -Force | Out-Null }

$files = @("taxonomy.js", "semantic.js", "analyzer.js", "ui.js", "llm.js", "ui.css")
foreach ($f in $files) {
  Copy-Item (Join-Path $root "src\$f") (Join-Path $dst $f) -Force
}

Write-Output ("Synced " + $files.Count + " engine files into mobile\www\src")
