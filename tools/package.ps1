# Package the Chrome/Edge extension into dist/vector-extension.zip
# Usage:  powershell -ExecutionPolicy Bypass -File tools/package.ps1
#
# Source layout:  extension/  (manifest, popup, content, options)
#                 src/        (shared engine)   media/  (icons)
# The store requires manifest.json at the ZIP ROOT, so the files are flattened
# into the staging folder exactly as the extension loads them.

$ErrorActionPreference = "Stop"
$root  = Resolve-Path (Join-Path $PSScriptRoot "..")
$dist  = Join-Path $root "dist"
$stage = Join-Path $dist "vector"

if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
New-Item -ItemType Directory -Path $stage -Force | Out-Null

# Extension UI files -> zip root
$extensionFiles = @(
  "manifest.json",
  "popup.html", "popup.css", "popup.js",
  "content.js", "content.css",
  "options.html", "options.js"
)
foreach ($f in $extensionFiles) {
  Copy-Item (Join-Path $root "extension\$f") (Join-Path $stage $f)
}

# Shared engine and icons
Copy-Item (Join-Path $root "src")   (Join-Path $stage "src")   -Recurse
Copy-Item (Join-Path $root "media") (Join-Path $stage "media") -Recurse

$zip = Join-Path $dist "vector-extension.zip"
if (Test-Path $zip) { Remove-Item $zip -Force }
Compress-Archive -Path (Join-Path $stage "*") -DestinationPath $zip

Write-Output ("Packaged " + $zip)
