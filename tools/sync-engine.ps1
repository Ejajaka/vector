# Copy the shared engine into the UI clients that need a bundled copy.
#   engine/src  ->  ui/mobile-expo/src
#   engine/src  ->  ui/mobile-native/www/src
#   ui/mobile-native/www  ->  ui/web
#
# Run after changing anything in engine/src.
# Usage:  powershell -ExecutionPolicy Bypass -File tools/sync-engine.ps1

$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")

# --- React Native app ---
$expoDst = Join-Path $root "ui\mobile-expo\src"
New-Item -ItemType Directory -Path $expoDst -Force | Out-Null
foreach ($f in @("taxonomy.js", "semantic.js", "analyzer.js", "llm.js")) {
  Copy-Item (Join-Path $root "engine\src\$f") (Join-Path $expoDst $f) -Force
}

# --- Capacitor app (www/src) ---
$nativeDst = Join-Path $root "ui\mobile-native\www\src"
New-Item -ItemType Directory -Path $nativeDst -Force | Out-Null
foreach ($f in @("taxonomy.js", "semantic.js", "analyzer.js", "ui.js", "llm.js", "ui.css")) {
  Copy-Item (Join-Path $root "engine\src\$f") (Join-Path $nativeDst $f) -Force
}

# --- Web demo (same web app as the Capacitor www) ---
$webSrc = Join-Path $root "ui\mobile-native\www"
$webDst = Join-Path $root "ui\web"
Copy-Item (Join-Path $webSrc "index.html") (Join-Path $webDst "index.html") -Force
Copy-Item (Join-Path $webSrc "style.css")  (Join-Path $webDst "style.css")  -Force
Copy-Item (Join-Path $webSrc "app.js")     (Join-Path $webDst "app.js")     -Force
Copy-Item (Join-Path $webSrc "src")        $webDst                          -Recurse -Force

Write-Output "Synced engine/src -> ui/mobile-expo/src, ui/mobile-native/www/src, ui/web"
