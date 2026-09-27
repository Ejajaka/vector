# Keep the browser demo in sync with the shared web app (mobile-native/www).
# The demo is published by GitHub Pages at:
#   https://ejajaka.github.io/vector/demo/
# Usage:  powershell -ExecutionPolicy Bypass -File tools/sync-demo.ps1

$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")

Copy-Item (Join-Path $root "mobile-native\www\index.html") (Join-Path $root "web\index.html") -Force
Copy-Item (Join-Path $root "mobile-native\www\style.css")  (Join-Path $root "web\style.css")  -Force
Copy-Item (Join-Path $root "mobile-native\www\app.js")     (Join-Path $root "web\app.js")     -Force
Copy-Item (Join-Path $root "mobile-native\www\src")        (Join-Path $root "web")           -Recurse -Force

Write-Output "Synced demo/ into web/ (from mobile-native/www)"
