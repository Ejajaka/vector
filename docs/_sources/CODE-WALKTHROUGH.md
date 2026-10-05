# Vector â€” Code Walkthrough (Simple)

**How to read this:** each file is explained in plain language â€” *what it is*,
*what it does*, and *the one thing to say about it* if you are asked.

> Rule of thumb for the viva: **seven engine files, one idea.** Everything else
> is a client that displays the engine's answer.

---

## 1. The whole project in one picture

```
        A user writes a prompt
                 |
                 v
     â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
     â”‚        engine/src/analyzer.js        â”‚  <- THE BRAIN
     â”‚  reads the prompt, finds the  â”‚
     â”‚  missing security controls    â”‚
     â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                     â”‚ uses
        â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
        v            v            v
   taxonomy.js   semantic.js   (nothing else)
   the knowledge  word-similarity
   base (data)    helper
                     â”‚
                     v
              a REPORT object
                     â”‚
     â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
     v               v                          v
  ui/extension/      engine/cli/                  ui/mobile-expo/ + ui/mobile-native/ + ui/web/
  (browser)       (terminal)            (phones / public page)
```

**The single most important sentence:** all the clients show the *same* report,
because they all call the same `analyze()` function. Nothing is duplicated.

---

## 2. `engine/src/` â€” the engine (read these in this order)

### 2.1 `engine/src/taxonomy.js` â€” the knowledge base (pure data)
**What it is:** lists, not logic. Think of it as the "textbook contents".
**What's inside:**
| Item | Count | Meaning |
|---|---|---|
| `REQUIREMENTS` | 30 | the security controls we check (encryption, IAM, loggingâ€¦) |
| `RESOURCES` | 78 | AWS services (S3, EC2, RDSâ€¦) and which controls each needs |
| `RISKY_PATTERNS` | 9 | dangerous phrasings (`0.0.0.0/0`, public bucketâ€¦) |
| `SYNONYMS` | 19 | everyday words â†’ AWS words ("website" â†’ EC2) |
| `PARAPHRASES` | 13 | alternative wordings per control |
| `NEGATION_WORDS` | ~45 | words that flip meaning ("not", "without", "except") |

**Say this if asked:** *"The taxonomy is the domain knowledge, separated from the
code. Adding a new check means adding a row here, not writing new logic."*

### 2.2 `engine/src/analyzer.js` â€” the brain (the pipeline)
**What it is:** the function that does the actual analysis.
**The one function that matters:**
```js
analyze(prompt)  ->  report
```
**What it does, in 6 plain steps:**
1. Clean the text (lowercase, fix "unencrypted" â†’ "not encrypted").
2. Find the AWS resources mentioned â†’ gives us the list of controls *required*.
3. Check which of those controls are *already stated* (careful about negation).
4. **Missing = required âˆ’ stated.** â† this is the whole product.
5. Find risky phrases and score everything (risk %, coverage %).
6. Return one `report` object.

**Two more helpers worth knowing:**
- `harden(prompt)` â†’ rewrites the prompt until it scores **risk 0 / coverage 100%**.
- `project(report, accepted)` â†’ "what would the score be if I accept these?" (the live update).

**Say this if asked:** *"analyzer.js is a set difference: the controls an S3 bucket
needs, minus the controls your prompt already states."*

### 2.3 `engine/src/semantic.js` â€” word-similarity helper (small, optional)
**What it is:** classic TF-IDF + cosine similarity.
**What it does:** finds which controls are "topically related" to the prompt.
**Important honesty point:** we measured it and found it is **polarity-blind** â€”
"open all ports" looks similar to "restrict ports". So it is used **only as a
hint**, never to decide a control is satisfied.
**Say this if asked:** *"We implemented it, measured it, found its limitation, and
restricted its role. That negative result is in the architecture document."*

### 2.4 `engine/src/llm.js` â€” optional AI second opinion
**What it is:** the deep-scan feature.
**What it does:** asks an existing model *only* for controls the rules may have
missed, then merges the answer (badged "AI").
**Say this if asked:** *"It is off by default, needs a key, and is not our
contribution â€” the deterministic engine is."*

### 2.5 `engine/src/tfcheck.js` â€” checks generated Terraform
**What it is:** 11 simple visual checks on a `.tf` file (public ACL, no
encryption, `0.0.0.0/0`â€¦).
**Why it exists:** to show the honest pipeline â€” we check the prompt *first*, but
you should still scan the generated code. Complementary, not a replacement.

### 2.6 `engine/src/ui.js` â€” draws the report (browser only)
**What it is:** turns the `report` object into the cards you see.
**Not used by:** the React Native app (which has its own UI), so it lives beside
the engine rather than inside it.

### 2.7 `engine/src/settings.js` â€” small shared helpers
**What it is:** saving settings, parsing a policy file, reading history.

---

## 3. The clients (each is thin on purpose)

| Folder | What it is | How to run |
|---|---|---|
| `ui/extension/` | the browser extension (popup, in-page button, options) | load unpacked |
| `engine/cli/` | terminal version | `node engine/cli/vector-cli.js analyze "..."` |
| `ui/mobile-expo/` | React Native app for iOS + Android | `npm run start:device` |
| `ui/mobile-native/` | Capacitor app (Android APK) | `gradlew assembleDebug` |
| `ui/web/` | public demo page | https://ejajaka.github.io/vector/ui/web/ |

**Key point:** none of these contain analysis logic. They collect a prompt, call
`analyze()`, and draw the result. That is why they never disagree.

---

## 4. Supporting folders

| Folder | Purpose |
|---|---|
| `engine/eval/` | the evidence: labelled prompts, precision/recall harness, Îº, downstream study |
| `engine/test/` | 63 unit tests â€” run `npm test` |
| `tools/` | build scripts: `make-docx.js` (docs), `package.ps1` (zip), `sync-*.ps1` |
| `docs/` | the Word documents |
| `ui/store/` | Edge listing text, privacy policy, publishing steps |
| `docs/references/` | the papers and articles we cite |
| `docs/examples/` | sample organisation policy packs |

---

## 5. The five commands you need

```powershell
npm test        # 63 tests
npm run eval    # precision / recall / F1
npm run docx    # regenerate all Word documents
npm run package # build the extension zip
node engine/cli/vector-cli.js analyze "Create an S3 bucket for user documents"
```

---

## 6. If asked "walk me through the code"

Use this 60-second script:

1. *"The knowledge lives in `taxonomy.js` â€” 78 AWS resources and 30 controls,
   each linked to CIS, AWS and NIST references."*
2. *"`analyzer.js` runs the pipeline: it finds the resources, looks up the
   controls they need, checks which ones the prompt already states â€” handling
   negation â€” and the difference is the missing set."*
3. *"Everything else is a client. The extension, the CLI, both mobile apps and the
   web page all call the same function, so they always agree."*
4. *"`harden()` closes the loop: it rewrites the prompt until it scores zero risk."*
5. *"The evidence is in `engine/eval/` â€” 112 labelled prompts, and 63 unit tests."*

---

## 7. Common questions, short answers

| Question | Answer |
|---|---|
| Which file has the logic? | `engine/src/analyzer.js` |
| Where are the rules? | `engine/src/taxonomy.js` (data, not code) |
| Where is the ML? | There is none. Optional AI is in `engine/src/llm.js` and is not the core. |
| What if a prompt isn't AWS? | A scope guard in `analyzer.js` rejects it instead of guessing |
| How do you know it's correct? | `npm test` (63 tests) and `npm run eval` (P/R/F1) |
| Why so many folders? | One engine, many clients â€” each surface is its own folder |
