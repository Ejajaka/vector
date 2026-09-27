# Vector - browser demo

This folder is the **same web app** used by the mobile build, published as a
static site so it can be opened from any browser with no install.

Live link (GitHub Pages):

**https://ejajaka.github.io/vector/ui/web/**

It reuses the shared engine (`engine/src/`) unchanged. The rule engine runs fully
offline, so the analysis works with no setup. The optional Deep scan needs an
API key (paste it in the in-app settings).

Regenerate this folder from `ui/mobile-native/www` with:

```powershell
powershell -ExecutionPolicy Bypass -File tools/sync-demo.ps1
```
