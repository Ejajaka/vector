# Copy the shared engine from ../src into src/ for the React Native app.
# Run after changing anything in ../src.
# Usage:  powershell -ExecutionPolicy Bypass -File sync-engine.ps1

$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$dst  = Join-Path $PSScriptRoot "src"

if (-not (Test-Path $dst)) { New-Item -ItemType Directory -Path $dst -Force | Out-Null }

# ui.js is DOM-based and is intentionally NOT copied; React Native has its own UI.
$files = @("taxonomy.js", "semantic.js", "analyzer.js", "llm.js")
foreach ($f in $files) {
  Copy-Item (Join-Path $root "src\$f") (Join-Path $dst $f) -Force
}

Write-Output ("Synced " + $files.Count + " engine files into mobile-rn\src")
