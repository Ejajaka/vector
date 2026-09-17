# VECTOR — Complete Build & Usage Manual

Pre-Generation Security Diagnosis of Cloud Infrastructure Prompts Using NLP
(AWS-only). This document lets anyone recreate the entire project from a clean
machine.

Repository: https://github.com/Ejajaka/vector

---

## 0. What this project is

A pre-generation security analyser for **AWS** infrastructure prompts.
You paste a natural-language prompt; it returns the security controls the prompt
omits, risky statements, a risk score and a coverage score, and it can build a
hardened prompt you can feed to an LLM that generates Terraform/CloudFormation.

It is delivered as:
- a **Chrome/Edge browser extension** (primary), published to Microsoft Edge Add-ons
- a **CLI** (analyse, improved, CI hook)
- a **React Native (Expo)** mobile app (iOS + Android)
- a **Capacitor** mobile app (Android build verified)
- an **evaluation harness** with labelled datasets

The engine is **rule-based NLP, fully offline**. No account, no backend. An
optional "deep scan" can call an existing LLM (on-device or the user's own key).

---

## 1. Prerequisites

| Tool | Version used | Needed for |
|---|---|---|
| Node.js | 22.19.0 | everything (engine, CLI, extension, mobile JS) |
| npm | 11.6.0 | dependencies |
| Git | 2.48+ | clone/push |
| Java (Temurin JDK) | 17.0.20 | Capacitor Android build |
| Android SDK | platforms 33/35/36, build-tools 34/35/36 | Android builds |
| Android Studio | current | Android builds / emulator |
| (optional) Python | 3.13 | not required by the shipped code |

Install Node from https://nodejs.org, Git from https://git-scm.com.
Java + Android SDK come with Android Studio.

> The core engine, CLI, extension and evaluation need **only Node + Git**.

---

## 2. Repository layout

```
project_NLP/
├── manifest.json            Chrome/Edge MV3 manifest (v0.5.5)
├── popup.html/.css/.js       extension toolbar popup
├── content.js/.css           in-page floating button
├── options.html/.js          settings, policy, history
├── src/
│   ├── taxonomy.js           78 AWS resources, 30 controls, risky patterns,
│   │                         synonyms, paraphrase lexicon, tiers, non-AWS terms
│   ├── analyzer.js           the rule engine (pipeline)
│   ├── semantic.js           TF-IDF semantic relevance (advisory)
│   ├── settings.js           shared chrome.storage helpers
│   ├── ui.js / ui.css        shared results renderer
│   └── llm.js                optional deep scan (on-device + hosted)
├── cli/vector-cli.js         command line interface
├── eval/
│   ├── dataset.json          39 labelled prompts (tuning)
│   ├── dataset2.json         59 labelled prompts (tuning)
│   ├── heldout.json          14 labelled prompts
│   ├── run-eval.js           precision/recall/F1 harness
│   └── downstream/           insecure vs secured Terraform demo
├── test/run-tests.js         42 unit tests
├── tools/
│   ├── make-icons.js         PNG icon generator
│   ├── make-docx.js          Word doc generator
│   ├── package.ps1           build the store zip
│   └── calibrate.js          semantic threshold calibration
├── docs/                     Vector-Features.docx, Vector-Pipeline.docx
├── store/                    listing, privacy policy, publishing steps
├── references/               supporting literature
├── mobile/                   Capacitor app (Android verified)
├── mobile-rn/                React Native (Expo) app (both bundles verified)
└── README.md
```

---

## 3. Recreate from scratch — the 10-minute path

```powershell
git clone https://github.com/Ejajaka/vector.git
cd vector

npm test            # 42 unit tests
npm run eval        # precision/recall/F1 over 112 labelled prompts
npm run downstream  # insecure vs hardened Terraform demo
```

Expected:
- `42 passed, 0 failed`
- `Overall worst F1 across sets: 1.000`
- `Summary: 6 -> 0 issues.`

No `npm install` is needed for the core — the engine has zero dependencies.

---

## 4. Part A — The engine

### 4.1 Files
- `src/taxonomy.js` — the knowledge base.
- `src/analyzer.js` — the pipeline.
- `src/semantic.js` — TF-IDF relevance (advisory only).
- `src/ui.js` + `src/ui.css` — DOM renderer (browser/extension).
- `src/tfcheck.js` — post-generation Terraform verifier (used by `vector verify`).

### 4.2 The pipeline (in `analyzer.js`)

```
1. normalise        lowercase, "unencrypted" -> "not encrypted"
2. tokenise         split, drop stopwords
3. synonym expand   "website" -> ec2 / load balancer
4. intent detect    create/deploy/allow/restrict/...
5. paraphrase       curated lexicon extends control patterns
6. resource detect  78 AWS resources (phrase + regex aliases)
7. policy merge     apply custom org policy + non-AWS guard
8. relevant set     union of each resource's controls (+ defaults / baseline)
9. requirement       regex match + negation guard
   detection         (before parity, after "disabled", notAfter qualifiers)
10. omission        relevant - stated = MISSING
11. risky detect    9 patterns, negation-aware
12. scoring         risk 0-100 (tier-weighted) + confidence 0-100
13. tiers           core / clarify / harden
14. recommendations clause (missing) or fix (risky)
15. deep scan       optional LLM merge (source: "ai")
16. report + render
```

### 4.3 Key concepts

- **Controls** (30): e.g. `encryption_at_rest`, `public_access_block`,
  `network_restricted`, `audit_logging`, `secrets_management`, `backup_recovery`.
- **Resources** (78): S3, EC2, RDS, Lambda, IAM, EKS, DynamoDB, CloudFront, KMS,
  SQS, SNS, Redshift, OpenSearch, SageMaker, …
- **Risky patterns** (9): `open_ssh`, `public_bucket`, `wildcard_iam`,
  `no_encryption`, `hardcoded_secret`, `disabled_logging`, `weak_auth`,
  `public_database`, `no_backup`.
- **Tiers**: `core` (strongly implied), `clarify` (context-dependent),
  `harden` (optional).
- **Terraform hints**: every control also carries the concrete HCL to set
  (`m.tf`), e.g. `storage_encrypted = true`, `block_public_acls = true`.
- **Context awareness**: rule-based cues detect `dev` vs `prod` and adjust the
  risk score (`envFactor` 0.75 / 1.1 / 1.0).
- **Scope guard**: input with no AWS resource, no infrastructure vocabulary and
  no infrastructure intent is rejected (`report.outOfScope`) instead of scored.
- **Harden**: `VectorAnalyzer.harden(prompt)` neutralises risky phrases in the
  base prompt and appends missing-control clauses iteratively until re-analysis
  is clean (risk 0, coverage 100%). One tap in the UIs.
- **Negation guard**: "do not make it public" is not "public"; "not not
  encrypted" is positive; "logging disabled" is not "logging".
- **Aliases** may be plain phrases (`"s3 bucket"`) or regex (`"\becr\b"`).
  Regex aliases are matched as regex, plain ones with word boundaries.

### 4.4 Run the engine directly

```powershell
node -e "const {analyze}=require('./src/analyzer'); console.log(analyze('Create an S3 bucket and make it public').riskyFindings.map(f=>f.id));"
```

---

## 5. Part B — CLI

`cli/vector-cli.js`:

```powershell
node cli/vector-cli.js analyze "Create an S3 bucket and an EC2 instance"
node cli/vector-cli.js analyze --json "Create an S3 bucket for user documents"
node cli/vector-cli.js improved "Create an S3 bucket"
node cli/vector-cli.js hook "Deploy an S3 bucket open to the public"   # exit 2 CRITICAL / 1 HIGH
node cli/vector-cli.js analyze --policy examples/policy.example.json "Deploy in us-east-1"
node cli/vector-cli.js verify "eval/downstream/insecure.tf"   # post-generation check, exit 2/1/0
```

npm shortcuts: `npm run analyze`, `npm run improved`.

---

## 6. Part C — The browser extension

### 6.1 Load it locally (fastest way to test)
1. Open `chrome://extensions` (or `edge://extensions`).
2. Enable **Developer mode**.
3. **Load unpacked** → select the project folder.

### 6.2 Use it
- Toolbar icon → paste a prompt → **Analyze**.
- Or **Sample**; then **+ Add clause**; **Copy** the improved prompt.
- `content.js` adds a floating **V** on chatgpt.com / claude.ai / gemini.google.com.

### 6.3 Build the store zip

```powershell
npm run package
```

Produces `dist/vector-extension.zip` (only runtime files; manifest at zip root).
The version comes from `manifest.json` — **bump it before every upload** (Edge
rejects a re-upload with the same version).

---

## 7. Part D — Publishing to Microsoft Edge Add-ons

Full detail in `store/edge-submission.md`. Summary:

1. Register a **free** developer account at
   https://partner.microsoft.com/dashboard/microsoftedge/public/login
   (choose **Individual**; no fee for Edge).
2. Create extension → upload `dist/vector-extension.zip`.
3. Availability → Public. Properties → Category **Developer tools**.
4. Privacy tab → paste from `store/permissions-and-privacy.md`:
   - Single purpose, permission justifications, remote code = **No**,
     data usage = **Website content**, privacy policy URL.
5. Store listing → description from `store/listing.md`, logo
   `media/store-logo-300.png`.
6. Notes for certification → see the prepared text in
   `store/edge-submission.md`.
7. Publish → review (up to ~7 business days).

Privacy policy must be hosted publicly. This repo enables GitHub Pages:
`https://ejajaka.github.io/vector/store/privacy-policy.html`.

Store ID (this submission): `0RDCKBP2L55J`.

Chrome Web Store: same zip, but **US$5 one-time** registration.

---

## 8. Part E — Mobile app (Capacitor) — Android verified

```powershell
cd mobile
npm install
npm run sync                 # copies ../src engine into www/src
npm run add:android          # generates the native Android project
npm run copy

$env:ANDROID_HOME="$env:LOCALAPPDATA\Android\Sdk"
$env:ANDROID_SDK_ROOT=$env:ANDROID_HOME
cd android
.\gradlew.bat assembleDebug --no-daemon
```

Result: `mobile/android/app/build/outputs/apk/debug/app-debug.apk` (~3.7 MB).
This was verified: **BUILD SUCCESSFUL** with JDK 17 + SDK platform 33.

Run on your emulator/phone:
```powershell
& "$env:ANDROID_HOME\platform-tools\adb.exe" install -r "mobile\android\app\build\outputs\apk\debug\app-debug.apk"
```

iOS with Capacitor requires a Mac + Xcode.

---

## 9. Part F — Mobile app (React Native / Expo) — iOS + Android bundles verified

```powershell
cd mobile-rn
npm install
npm run sync                 # copies engine files into src/
npx expo start               # then scan the QR with Expo Go on a phone
```

**Run on a real iPhone with no Mac and no Apple account** using the **Expo Go**
app + `npx expo start`.

### Running on your iPhone (step by step)

1. On the iPhone, install **Expo Go** from the App Store.
2. Make sure the iPhone and the PC are on the **same Wi-Fi network** (an Ethernet
   PC and a Wi-Fi iPhone on the same router is the same LAN, which is fine).
   If the network isolates devices, use `npx expo start --tunnel` instead.
3. On the PC:
   ```powershell
   cd mobile-rn
   npm install
   npm run sync
   npx expo start
   ```
4. A QR code appears in the terminal. Open the **Camera** app on the iPhone,
   point it at the QR, and tap the banner to open it in Expo Go.
   (You can also open Expo Go and type the `exp://...` URL shown in the terminal.)
5. The Vector app loads on the phone. Tap **Sample** and **Analyze** to test.
6. If it says "project is incompatible", your Expo Go is newer/older than the
   project SDK. Fix:
   ```powershell
   npx expo install expo@latest
   npx expo install --fix
   npx expo start
   ```
7. To stop the server, press `Ctrl+C` in the terminal.

> No Mac, no Xcode and no Apple Developer account are needed for Expo Go.
> For a standalone installable iOS build (App Store / TestFlight) you need EAS
> Build plus the $99/year Apple Developer Program — see below.

Compile check (verified in this repo):
```powershell
npx expo export --platform ios       # iOS bundle, 580 modules, 1.5 MB Hermes
npx expo export --platform android
```

Store builds use EAS (cloud, no Mac for iOS):
```powershell
npm install -g eas-cli
eas login
eas build -p ios --profile production       # needs Apple Developer $99/yr
eas build -p android --profile production
eas submit -p ios
eas submit -p android
```

`ui.js` (DOM) is **not** reused in React Native; only the pure engine is.

---

## 10. Part G — Evaluation and tools

```powershell
npm run eval          # precision / recall / F1 + negation traps
npm run downstream    # insecure vs hardened Terraform (6 -> 0 issues)
npm run verify -- <file.tf>   # post-generation check of generated Terraform
npm run study -- --key <API_KEY>   # generate Terraform with an LLM, raw vs hardened
npm run kappa -- a.json b.json     # inter-annotator agreement (Cohen's kappa)
npm run docx          # regenerate docs/Vector-Features.docx + Vector-Pipeline.docx
npm run icons         # regenerate media/icon*.png + store-logo-300.png
node tools/calibrate.js   # inspect TF-IDF similarity thresholds
```

Evaluation sets: `eval/dataset.json` (39) + `dataset2.json` (59) +
`heldout.json` (14) = **112 labelled prompts**. Metrics: missing-constraint
P/R/F1, risky-statement P/R/F1, negation-trap failures.

**Honest note for reports:** the 98 tuning prompts and the 14 originals were all
used during development, so the F1 = 1.000 is indicative, not a clean held-out
result. State it that way.

---

## 11. Part H — Deep scan (optional AI)

Off by default. Two tiers:
1. **On-device** (Chrome's built-in model) — no key, no network. Not available in
   Edge; availability varies.
2. **Hosted** — any OpenAI-compatible endpoint using the user's own key.

Set the key in the extension **Options** page. Never commit an API key; the
extension and repo ship with none.

### Providers (key, Base URL and model must match)

| Provider | Base URL | Example model |
|---|---|---|
| Gemini (free tier, browser-friendly) | `https://generativelanguage.googleapis.com/v1beta/openai` | `gemini-2.5-flash` |
| OpenAI | `https://api.openai.com/v1` | `gpt-4o-mini` |
| OpenCode Zen | `https://opencode.ai/zen/v1` | `deepseek-v4-flash` |

Notes:
- **Model names change.** `gemini-2.0-flash` was retired and returns 404. Use the
  **"List models for my key"** button in Options to see what your key can call.
- **CORS:** a **web page** (the GitHub Pages demo) can only call providers that
  send CORS headers (Gemini does; OpenCode Zen does not). The **extension**
  (host permissions) and the **mobile app** (native networking) bypass CORS.
- The manifest `host_permissions` must include the provider host:
  `api.openai.com`, `generativelanguage.googleapis.com`, `opencode.ai`.
- Use **chat-completions** models. OpenCode Zen GPT/Grok ids use `/responses`,
  which this client does not call.

### When it runs
- **Manually:** the **Deep scan** button.
- **Automatically:** when the analysis is low-confidence (`confidence < 50%`)
  **or** coverage is below 50%. The extension requires *Auto deep scan* to be
  ticked in Options; the mobile app runs it whenever a key is saved. The UI shows
  a `deep scan recommended` / `low confidence` indicator.

---

## 12. Version history

| Version | Change |
|---|---|
| 0.2.0 | first Edge submission (AWS-only, 59 resources, rule engine) |
| 0.3.0 | coverage score + TF-IDF semantic relevance |
| 0.4.0 | paraphrase lexicon, non-AWS guard, disclaimer, UI banner, tests |
| 0.4.1 | default to Gemini endpoint; drop `response_format` for compatibility |
| 0.4.2 | auto deep scan also triggers on low coverage |
| 0.4.3 | reword clauses (encryption/network/residency/region); fix credentials false positive |
| 0.4.4 | relevance tiers (confirmed/clarify/optional), API Gateway fix, "rather than" negation, tier-weighted risk |
| 0.4.5 | fix public-database false positive; RN app safe-area, live coverage, richer UI, auto AI fallback |
| 0.4.6 | live risk + coverage projection on clause accept; concise clauses (all <= 160 chars) |
| 0.4.7 | context-aware env weighting, Terraform attribute hints, post-generation `verify` (src/tfcheck.js), LLM downstream study + kappa harnesses |
| 0.4.8 | expand to 78 AWS resources, scope-aware negation (except/unless), GitHub Actions CI, CIS org policy pack (`examples/policy-cis.json`) |
| 0.5.0 | one-tap `harden()`: neutralises risky phrases + iterates clauses until risk 0 / coverage 100% |
| 0.5.1 | scope guard: reject non-infrastructure input instead of scoring it |
| 0.5.2 | fix deep scan 404 (retired `gemini-2.0-flash` -> `gemini-2.5-flash`); surface provider error detail |
| 0.5.3 | Options "List models for my key" button |
| 0.5.4 | allow `opencode.ai` host (OpenCode Zen OpenAI-compatible endpoint) |
| 0.5.5 | visible low-confidence indicator + Deep scan guidance (popup + mobile) |

---

## 13. Troubleshooting (issues actually encountered)

| Symptom | Cause | Fix |
|---|---|---|
| Edge package validation: "description exceeded max length 132" | manifest description too long | keep `manifest.description` <= 132 chars |
| ECR / ALB / EMR / SFTP never detected | regex aliases were escaped and never matched | `aliasMatches()` treats metachar aliases as regex |
| "open all ports" treated as *restricted* | TF-IDF is polarity-blind | semantic pass is advisory only, never overrides rules |
| "stored securely rather than hard-coded" flagged as hard-coded | "rather than" not a negation | added `rather than` / `instead of` to `NEGATION_WORDS` |
| Azure prompt analysed as AWS | "blob" synonym mapped to S3 | removed `blob` synonym; added non-AWS guard |
| Everything scored CRITICAL | risk saturation | recalibrated curve + tier weighting |
| `ANDROID_HOME` empty; `adb` not on PATH | env not set | set `ANDROID_HOME` to `%LOCALAPPDATA%\Android\Sdk` |
| Headless emulator never booted | no hardware acceleration | run the emulator from Android Studio UI |
| Expo Go: "couldn't connect to the server" | tunnel blocked, or phone/PC on different networks | use the emulator (`npx expo start`, press `a`) or same Wi-Fi + firewall |
| Expo Go: SDK incompatible | project SDK older than current Expo Go | upgrade: `npx expo install expo@latest && npx expo install --fix` |
| Metro: "Cannot read properties of undefined (reading 'transformFile')" | `babel-preset-expo` not resolvable at top level after an SDK jump | clean reinstall + `npx expo install babel-preset-expo` |
| Emulator: "Unknown AVD name" | wrong AVD name | use the real name from `%USERPROFILE%\.android\avd\*.ini` (e.g. `Medium_Phone_API_36`) |

---

## 14. Reproduce-everything checklist

- [ ] `git clone` → `npm test` (42 pass)
- [ ] `npm run eval` (F1 1.000)
- [ ] `npm run downstream` (6 → 0)
- [ ] `npm run package` → `dist/vector-extension.zip`
- [ ] Load unpacked in Edge/Chrome and analyze the Sample prompt
- [ ] `cd mobile && npm install && npm run add:android && gradlew assembleDebug`
- [ ] `cd mobile-rn && npm install && npx expo export --platform ios`
- [ ] `npx expo start` + Expo Go on a phone
- [ ] Read `store/edge-submission.md` and publish (optional)
