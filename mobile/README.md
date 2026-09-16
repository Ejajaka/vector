# Vector Mobile (Android + iOS)

A Capacitor wrapper around the same rule engine used by the browser extension.
One codebase produces both an Android and an iOS app that can be submitted to
Google Play and the Apple App Store.

- The **engine is reused unchanged** from `../src` (taxonomy, analyzer, semantic,
  ui, llm) and copied into `www/src` by `sync-engine.ps1`.
- The UI is a single screen: paste an AWS prompt, Analyze, see findings grouped
  into Confirmed gaps / Needs clarification / Optional hardening, accept clauses,
  copy the hardened prompt.
- Works fully offline. The optional Deep scan uses the user's own API key.

## Files

```
mobile/
  capacitor.config.json   app id / name / web dir
  package.json            Capacitor deps and scripts
  sync-engine.ps1         copies ../src into www/src (keep in sync)
  www/
    index.html            single screen UI
    style.css             mobile styling
    app.js                app logic (reuses VectorAnalyzer / VectorUI / VectorLLM)
    src/                  generated copies of the shared engine
```

## Build

Prerequisites: Node.js 18+, and:
- Android: Android Studio + JDK 17
- iOS: **a Mac with Xcode** (Apple requirement). If you do not have a Mac, use a
  cloud macOS build service (GitHub Actions macOS runner, Ionic Appflow, or
  switch to Expo/EAS which builds iOS in the cloud).

```powershell
cd mobile
npm install

# keep the engine in sync with the extension
npm run sync

# one-time: add the native platforms
npm run add:android
npm run add:ios        # macOS only

# copy web assets into the native projects
npm run copy
```

Then:
- Android: `npm run open:android` -> build a signed **AAB** in Android Studio.
- iOS: `npm run open:ios` -> archive in Xcode (requires an Apple Developer account).

## Publish

| Store | Cost | Notes |
|---|---|---|
| Google Play | **$25 one-time** | Upload the signed AAB. Needs privacy policy URL, screenshots, content rating. |
| Apple App Store | **$99/year** | Apple Developer Program. Xcode archive + App Store Connect. Stricter review. |

Both listings can reuse:
- Privacy policy: `../store/privacy-policy.html` (host it, e.g. GitHub Pages).
- Description and permission notes: `../store/listing.md`,
  `../store/permissions-and-privacy.md`.

## Build status

- **Android: verified.** `npx cap add android` + `gradlew assembleDebug` produced
  `android/app/build/outputs/apk/debug/app-debug.apk` (~3.7 MB) containing the
  web app and engine. BUILD SUCCESSFUL with JDK 17 and Android SDK platform 33.
- **Runtime not verified here:** a headless emulator did not finish booting in
  this environment, so the app was not launched on a device. Run it yourself on
  the `Medium_Phone` emulator or a physical device to confirm the UI.

## Honest caveats

- The UI was written but **not launched on a device** in this environment; do a
  debug run before submitting.
- A mobile app is a **secondary surface** for a developer-facing tool; the
  browser extension remains the primary deliverable.
- No account, no tracking, no backend. The only network call is the optional
  hosted deep scan to the user's configured endpoint.
