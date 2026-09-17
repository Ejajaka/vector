# Vector Mobile (React Native / Expo)

React Native version of Vector for **iOS and Android**, reusing the same rule
engine as the extension and the Capacitor app.

## Verified in this repo

- JSX parses cleanly (`@babel/parser`).
- `npx expo export --platform ios` → **iOS bundle built** (Hermes bytecode, 1.5 MB).
- `npx expo export --platform android` → **Android bundle built** (1.5 MB).

Runs on **Expo SDK 57 / React Native 0.86 / React 19**, which matches the current
**Expo Go** app (older SDKs are rejected by Expo Go).

That proves the app code and engine imports compile for both platforms.
A native `.ipa`/`.apk` still has to be produced (see below).

## The no-Mac path (important)

**You do not need a Mac to run this on an iPhone.** Expo Go lets you run the app
on a real device over the network:

```powershell
cd mobile-rn
npm install
npm run sync        # copy the shared engine into src/
npx expo start
```

Or use the helper that advertises the correct LAN IP automatically (fixes the
"couldn't connect to the server" / blank screen on a phone):

```powershell
npm run start:device
```

In the app: **Sample** → **Analyze** → **Harden prompt → risk 0** (one tap)
produces a prompt that re-analyses to risk 0 / coverage 100%.

Then install **Expo Go** on the phone and scan the QR code. Instant demo, no
build, no Apple account.

## Store builds (EAS, cloud)

Requires an Expo account (free tier) and:
- Apple App Store: **Apple Developer Program, $99/year**
- Google Play: **$25 one-time**

```powershell
npm install -g eas-cli
eas login
eas build -p ios --profile production       # builds in the cloud, no Mac
eas build -p android --profile production
eas submit -p ios
eas submit -p android
```

Store metadata can reuse `../store/privacy-policy.html` and `../store/listing.md`.

## Files

```
mobile-rn/
  App.js                 single-screen UI (React Native components)
  app.json               Expo config (bundle id com.vector.security)
  package.json           Expo SDK 57 (RN 0.86, React 19)
  babel.config.js
  sync-engine.ps1        copies ../src engine files into src/
  src/                   taxonomy.js, semantic.js, analyzer.js, llm.js (generated)
```

## Caveats

- `ui.js` (DOM) is **not** reused; React Native has its own UI. Only the pure
  engine is shared.
- This duplicates the Capacitor app in `../mobile`. For an RN requirement, use
  this one and ignore/remove the Capacitor one, or keep both (they share the
  same engine).
- Not launched on a device here (no emulator/simulator). Run `npx expo start`
  and verify the UI before submitting.
