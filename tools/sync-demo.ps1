# Keep the browser demo in sync with the shared web app (mobile/www).
# The demo is published by GitHub Pages at:
#   https://ejajaka.github.io/vector/demo/
# Usage:  powershell -ExecutionPolicy Bypass -File tools/sync-demo.ps1

$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")

Copy-Item (Join-Path $root "mobile\www\index.html") (Join-Path $root "demo\index.html") -Force
Copy-Item (Join-Path $root "mobile\www\style.css")  (Join-Path $root "demo\style.css")  -Force
Copy-Item (Join-Path $root "mobile\www\app.js")     (Join-Path $root "demo\app.js")     -Force
Copy-Item (Join-Path $root "mobile\www\src")        (Join-Path $root "demo")           -Recurse -Force

Write-Output "Synced demo/ from mobile/www"
