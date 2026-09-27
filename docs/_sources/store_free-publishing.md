# Publishing for free

The Chrome Web Store costs US$5 (one-time). If you want free distribution, use
one of these instead. The same `store/listing.md`, `store/privacy-policy.md` and
`store/permissions-and-privacy.md` apply to all of them.

## Microsoft Edge Add-ons (recommended, free)
- Store: https://microsoftedge.microsoft.com
- Register: free Microsoft Partner Center account (no fee).
- Upload the **same** `dist/vector-extension.zip`. Edge is Chromium-based, so a
  Chrome Manifest V3 extension runs as-is.
- Flow: Partner Center -> Create new extension -> upload zip -> Availability ->
  Properties -> Privacy -> Store listing -> Publish -> certification (up to ~7
  business days).
- Docs: https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/publish-extension
- Porting note: https://learn.microsoft.com/en-us/microsoft-edge/extensions/developer-guide/port-chrome-extension

## Firefox Add-ons (AMO) - free
- Store: https://addons.mozilla.org
- Free developer account.
- Needs small changes because Firefox uses the `browser.*` namespace:
  - Add `browser` compatibility. Simplest fix: load the
    `webextension-polyfill`, or replace `chrome.` with `browser.` and use
    promises.
  - Our code already falls back gracefully when the on-device `LanguageModel`
    API is missing, so deep scan just stays off.
  - `manifest.json` works with `"manifest_version": 3` on Firefox 109+; keep
    `browser_specific_settings` if Firefox asks for an ID.
- Docs: https://extensionworkshop.com/documentation/publish/

## Opera Add-ons - free
- Store: https://addons.opera.com/developer/
- Free submission. Chromium-based, so the Chrome build works.
- Docs: https://dev.opera.com/extensions/

## Self-host (no store at all) - free
- Put the zip on GitHub Releases or your own site.
- Users install via `chrome://extensions` -> Developer mode -> **Load unpacked**
  (works unpacked folder) or drag-drop the zip.
- Note: Chrome blocks one-click `.crx` installs from outside the Web Store on
  Windows/macOS for security. Edge is more permissive with sideloading.
- Good enough for a class demo or handing the folder to a supervisor.

## Class / demo note
If this is for a course submission, you do **not** need any store:
`chrome://extensions` -> Developer mode -> Load unpacked -> pick the project
folder. Free, instant, offline.
