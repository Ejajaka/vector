# Copy the shared engine into the UI clients that need a bundled copy, and keep
# the web client and the Capacitor client identical.
#
#   engine/src  ->  ui/mobile-expo/src       (React Native: pure engine only)
#   engine/src  ->  ui/web/src               (web demo: full engine + ui.js)
#   ui/web      ->  ui/mobile-native/www     (Capacitor mirrors the web client)
#
# The WEB CLIENT IS THE SOURCE OF TRUTH for the web/Capacitor UI. Edit ui/web,
# then run this to push the changes into ui/mobile-native/www.
#
# Run after changing engine/src or ui/web.
# Usage:  powershell -ExecutionPolicy Bypass -File tools/sync-engine.ps1

$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")

# --- React Native app: pure engine only (ui.js / ui.css are DOM-specific) ---
$expoDst = Join-Path $root "ui\mobile-expo\src"
New-Item -ItemType Directory -Path $expoDst -Force | Out-Null
foreach ($f in @("taxonomy.js", "semantic.js", "analyzer.js", "llm.js")) {
  Copy-Item (Join-Path $root "engine\src\$f") (Join-Path $expoDst $f) -Force
}
foreach ($f in @("ui.js", "ui.css", "settings.js")) {
  $stale = Join-Path $expoDst $f
  if (Test-Path $stale) { Remove-Item $stale -Force }
}

# --- Web demo: full engine + renderer ---
$webDst = Join-Path $root "ui\web\src"
New-Item -ItemType Directory -Path $webDst -Force | Out-Null
foreach ($f in @("taxonomy.js", "semantic.js", "analyzer.js", "ui.js", "ui.css", "llm.js")) {
  Copy-Item (Join-Path $root "engine\src\$f") (Join-Path $webDst $f) -Force
}
$staleSettings = Join-Path $webDst "settings.js"
if (Test-Path $staleSettings) { Remove-Item $staleSettings -Force }

# --- Capacitor client mirrors the web client ---
$native = Join-Path $root "ui\mobile-native\www"
Copy-Item (Join-Path $root "ui\web\index.html") (Join-Path $native "index.html") -Force
Copy-Item (Join-Path $root "ui\web\style.css")  (Join-Path $native "style.css")  -Force
Copy-Item (Join-Path $root "ui\web\app.js")     (Join-Path $native "app.js")     -Force
# copy engine files into the existing src folder (not "src" into "src", which
# would create src/src)
$nativeSrc = Join-Path $native "src"
New-Item -ItemType Directory -Path $nativeSrc -Force | Out-Null
foreach ($f in @("taxonomy.js", "semantic.js", "analyzer.js", "ui.js", "ui.css", "llm.js")) {
  Copy-Item (Join-Path $webDst $f) (Join-Path $nativeSrc $f) -Force
}
$staleNative = Join-Path $nativeSrc "settings.js"
if (Test-Path $staleNative) { Remove-Item $staleNative -Force }

Write-Output "Synced: engine/src -> ui/mobile-expo/src, ui/web/src;  ui/web -> ui/mobile-native/www"
