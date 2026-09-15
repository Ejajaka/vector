# Package the Chrome extension into dist/vector-extension.zip
# Usage:  powershell -ExecutionPolicy Bypass -File tools/package.ps1

$ErrorActionPreference = "Stop"
$root  = Resolve-Path (Join-Path $PSScriptRoot "..")
$dist  = Join-Path $root "dist"
$stage = Join-Path $dist "vector"

if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
New-Item -ItemType Directory -Path $stage -Force | Out-Null

# Only the files the extension needs at runtime.
$files = @(
  "manifest.json",
  "popup.html", "popup.css", "popup.js",
  "content.js", "content.css",
  "options.html", "options.js"
)
foreach ($f in $files) { Copy-Item (Join-Path $root $f) (Join-Path $stage $f) }

Copy-Item (Join-Path $root "src")   (Join-Path $stage "src")   -Recurse
Copy-Item (Join-Path $root "media") (Join-Path $stage "media") -Recurse

$zip = Join-Path $dist "vector-extension.zip"
if (Test-Path $zip) { Remove-Item $zip -Force }
Compress-Archive -Path (Join-Path $stage "*") -DestinationPath $zip

Write-Output ("Packaged " + $zip)
