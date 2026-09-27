# Vector — Code Walkthrough (Simple)

**How to read this:** each file is explained in plain language — *what it is*,
*what it does*, and *the one thing to say about it* if you are asked.

> Rule of thumb for the viva: **seven engine files, one idea.** Everything else
> is a client that displays the engine's answer.

---

## 1. The whole project in one picture

```
        A user writes a prompt
                 |
                 v
     ┌───────────────────────────────┐
     │        src/analyzer.js        │  <- THE BRAIN
     │  reads the prompt, finds the  │
     │  missing security controls    │
     └───────────────┬───────────────┘
                     │ uses
        ┌────────────┼────────────┐
        v            v            v
   taxonomy.js   semantic.js   (nothing else)
   the knowledge  word-similarity
   base (data)    helper
                     │
                     v
              a REPORT object
                     │
     ┌───────────────┼──────────────────────────┐
     v               v                          v
  extension/      cli/                  mobile-expo/ + mobile-native/ + web/
  (browser)       (terminal)            (phones / public page)
```

**The single most important sentence:** all the clients show the *same* report,
because they all call the same `analyze()` function. Nothing is duplicated.

---

## 2. `src/` — the engine (read these in this order)

### 2.1 `src/taxonomy.js` — the knowledge base (pure data)
**What it is:** lists, not logic. Think of it as the "textbook contents".
**What's inside:**
| Item | Count | Meaning |
|---|---|---|
| `REQUIREMENTS` | 30 | the security controls we check (encryption, IAM, logging…) |
| `RESOURCES` | 78 | AWS services (S3, EC2, RDS…) and which controls each needs |
| `RISKY_PATTERNS` | 9 | dangerous phrasings (`0.0.0.0/0`, public bucket…) |
| `SYNONYMS` | 19 | everyday words → AWS words ("website" → EC2) |
| `PARAPHRASES` | 13 | alternative wordings per control |
| `NEGATION_WORDS` | ~45 | words that flip meaning ("not", "without", "except") |

**Say this if asked:** *"The taxonomy is the domain knowledge, separated from the
code. Adding a new check means adding a row here, not writing new logic."*

### 2.2 `src/analyzer.js` — the brain (the pipeline)
**What it is:** the function that does the actual analysis.
**The one function that matters:**
```js
analyze(prompt)  ->  report
```
**What it does, in 6 plain steps:**
1. Clean the text (lowercase, fix "unencrypted" → "not encrypted").
2. Find the AWS resources mentioned → gives us the list of controls *required*.
3. Check which of those controls are *already stated* (careful about negation).
4. **Missing = required − stated.** ← this is the whole product.
5. Find risky phrases and score everything (risk %, coverage %).
6. Return one `report` object.

**Two more helpers worth knowing:**
- `harden(prompt)` → rewrites the prompt until it scores **risk 0 / coverage 100%**.
- `project(report, accepted)` → "what would the score be if I accept these?" (the live update).

**Say this if asked:** *"analyzer.js is a set difference: the controls an S3 bucket
needs, minus the controls your prompt already states."*

### 2.3 `src/semantic.js` — word-similarity helper (small, optional)
**What it is:** classic TF-IDF + cosine similarity.
**What it does:** finds which controls are "topically related" to the prompt.
**Important honesty point:** we measured it and found it is **polarity-blind** —
"open all ports" looks similar to "restrict ports". So it is used **only as a
hint**, never to decide a control is satisfied.
**Say this if asked:** *"We implemented it, measured it, found its limitation, and
restricted its role. That negative result is in the architecture document."*

### 2.4 `src/llm.js` — optional AI second opinion
**What it is:** the deep-scan feature.
**What it does:** asks an existing model *only* for controls the rules may have
missed, then merges the answer (badged "AI").
**Say this if asked:** *"It is off by default, needs a key, and is not our
contribution — the deterministic engine is."*

### 2.5 `src/tfcheck.js` — checks generated Terraform
**What it is:** 11 simple visual checks on a `.tf` file (public ACL, no
encryption, `0.0.0.0/0`…).
**Why it exists:** to show the honest pipeline — we check the prompt *first*, but
you should still scan the generated code. Complementary, not a replacement.

### 2.6 `src/ui.js` — draws the report (browser only)
**What it is:** turns the `report` object into the cards you see.
**Not used by:** the React Native app (which has its own UI), so it lives beside
the engine rather than inside it.

### 2.7 `src/settings.js` — small shared helpers
**What it is:** saving settings, parsing a policy file, reading history.

---

## 3. The clients (each is thin on purpose)

| Folder | What it is | How to run |
|---|---|---|
| `extension/` | the browser extension (popup, in-page button, options) | load unpacked |
| `cli/` | terminal version | `node cli/vector-cli.js analyze "..."` |
| `mobile-expo/` | React Native app for iOS + Android | `npm run start:device` |
| `mobile-native/` | Capacitor app (Android APK) | `gradlew assembleDebug` |
| `web/` | public demo page | https://ejajaka.github.io/vector/web/ |

**Key point:** none of these contain analysis logic. They collect a prompt, call
`analyze()`, and draw the result. That is why they never disagree.

---

## 4. Supporting folders

| Folder | Purpose |
|---|---|
| `eval/` | the evidence: labelled prompts, precision/recall harness, κ, downstream study |
| `test/` | 63 unit tests — run `npm test` |
| `tools/` | build scripts: `make-docx.js` (docs), `package.ps1` (zip), `sync-*.ps1` |
| `docs/` | the Word documents |
| `store/` | Edge listing text, privacy policy, publishing steps |
| `references/` | the papers and articles we cite |
| `examples/` | sample organisation policy packs |

---

## 5. The five commands you need

```powershell
npm test        # 63 tests
npm run eval    # precision / recall / F1
npm run docx    # regenerate all Word documents
npm run package # build the extension zip
node cli/vector-cli.js analyze "Create an S3 bucket for user documents"
```

---

## 6. If asked "walk me through the code"

Use this 60-second script:

1. *"The knowledge lives in `taxonomy.js` — 78 AWS resources and 30 controls,
   each linked to CIS, AWS and NIST references."*
2. *"`analyzer.js` runs the pipeline: it finds the resources, looks up the
   controls they need, checks which ones the prompt already states — handling
   negation — and the difference is the missing set."*
3. *"Everything else is a client. The extension, the CLI, both mobile apps and the
   web page all call the same function, so they always agree."*
4. *"`harden()` closes the loop: it rewrites the prompt until it scores zero risk."*
5. *"The evidence is in `eval/` — 112 labelled prompts, and 63 unit tests."*

---

## 7. Common questions, short answers

| Question | Answer |
|---|---|
| Which file has the logic? | `src/analyzer.js` |
| Where are the rules? | `src/taxonomy.js` (data, not code) |
| Where is the ML? | There is none. Optional AI is in `src/llm.js` and is not the core. |
| What if a prompt isn't AWS? | A scope guard in `analyzer.js` rejects it instead of guessing |
| How do you know it's correct? | `npm test` (63 tests) and `npm run eval` (P/R/F1) |
| Why so many folders? | One engine, many clients — each surface is its own folder |
