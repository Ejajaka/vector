# Vector Ã¢â‚¬â€ Finalized Architecture & Workflow

**Pre-Generation Security Diagnosis of Cloud Infrastructure Prompts Using NLP**
Version 0.5.7 Ã‚Â· AWS-only Ã‚Â· rule-based NLP Ã‚Â· fully offline

> Companion documents: `MARKET-ANALYSIS.md` (why), `ROADMAP.md` (plan),
> `COURSE-PLAN-MAPPING.md` (syllabus links).

---

## 1. Final architecture at a glance

```
Ã¢â€Å’Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€Â
Ã¢â€â€š                          USER SURFACES (clients)                          Ã¢â€â€š
Ã¢â€â€š                                                                          Ã¢â€â€š
Ã¢â€â€š   extension/        cli/          mobile-expo/       mobile-native/  web/ Ã¢â€â€š
Ã¢â€â€š   (popup,           (analyze,     (React Native /    (Capacitor,    (demo)Ã¢â€â€š
Ã¢â€â€š    in-page,          improved,     Expo, iOS +        Android)             Ã¢â€â€š
Ã¢â€â€š    options)          verify, hook) Android)                                Ã¢â€â€š
Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€Â¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€Ëœ
                               Ã¢â€â€š  all call the same functions
                               Ã¢â€“Â¼
Ã¢â€Å’Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€Â
Ã¢â€â€š                        SHARED ENGINE  (src/)                               Ã¢â€â€š
Ã¢â€â€š                                                                            Ã¢â€â€š
Ã¢â€â€š  taxonomy.js   Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€“Âº analyzer.js Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€“Âº report   ui.js/.css  (DOM renderer)    Ã¢â€â€š
Ã¢â€â€š  semantic.js   Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€“Âº                 object   llm.js      (optional AI)     Ã¢â€â€š
Ã¢â€â€š  settings.js   Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€“Âº                          tfcheck.js  (post-gen checks) Ã¢â€â€š
Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€Ëœ
                               Ã¢â€â€š
                               Ã¢â€“Â¼
               report { missing, risky, risk, coverage, tiers, ... }
```

**One rule holds the whole design together:** every surface is a *client* of the
same engine. That is why the extension, CLI, both mobile apps and the web demo
return identical results for the same prompt.

---

## 2. Final folder structure

```
project_NLP/                     <- open THIS in VS Code
Ã¢â€â€š
Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ docs/                        Ã°Å¸â€œâ€ž THE FOUR DELIVERABLE DOCUMENTS (+2 extra)
Ã¢â€â€š   Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ Vector-Market-Analysis.docx
Ã¢â€â€š   Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ Vector-Architecture.docx
Ã¢â€â€š   Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ Vector-Roadmap.docx
Ã¢â€â€š   Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ Vector-Course-Plan-Mapping.docx
Ã¢â€â€š   Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ Vector-Features.docx
Ã¢â€â€š   Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬ Vector-Progress-Report.docx
Ã¢â€â€š
Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ src/                         Ã°Å¸Â§Â  SHARED ENGINE (the product)
Ã¢â€â€š   Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ taxonomy.js              knowledge base: 78 resources, 30 controls
Ã¢â€â€š   Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ analyzer.js              the pipeline + scoring + harden
Ã¢â€â€š   Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ semantic.js              TF-IDF relevance (advisory only)
Ã¢â€â€š   Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ llm.js                   optional deep scan
Ã¢â€â€š   Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ tfcheck.js               post-generation Terraform checks
Ã¢â€â€š   Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ settings.js              shared storage/policy helpers
Ã¢â€â€š   Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬ ui.js / ui.css           shared results renderer
Ã¢â€â€š
Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ extension/                   Ã°Å¸Å’Â BROWSER EXTENSION CLIENT
Ã¢â€â€š   Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ manifest.json
Ã¢â€â€š   Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ popup.html/.css/.js
Ã¢â€â€š   Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ content.js/.css
Ã¢â€â€š   Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬ options.html/.js
Ã¢â€â€š
Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ cli/                         Ã¢Å’Â¨Ã¯Â¸Â  COMMAND-LINE CLIENT
Ã¢â€â€š   Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬ vector-cli.js
Ã¢â€â€š
Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ mobile-expo/                 Ã°Å¸â€œÂ± REACT NATIVE (iOS + Android) CLIENT
Ã¢â€â€š   Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ App.js, app.json, package.json
Ã¢â€â€š   Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ src/  (generated copies of the engine)
Ã¢â€â€š   Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬ sync-engine.ps1
Ã¢â€â€š
Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ mobile-native/               Ã°Å¸â€œÂ± CAPACITOR (Android) CLIENT
Ã¢â€â€š   Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ www/  (index.html, app.js, style.css, src/)
Ã¢â€â€š   Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ capacitor.config.json
Ã¢â€â€š   Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬ sync-engine.ps1
Ã¢â€â€š
Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ web/                         Ã°Å¸â€“Â¥Ã¯Â¸Â  PUBLIC DEMO CLIENT
Ã¢â€â€š   Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬ (GitHub Pages build; synced from mobile-native/www)
Ã¢â€â€š
Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ eval/                        Ã°Å¸â€œÅ  EVIDENCE
Ã¢â€â€š   Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ dataset.json, dataset2.json, heldout.json
Ã¢â€â€š   Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ run-eval.js, kappa.js
Ã¢â€â€š   Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬ downstream/
Ã¢â€â€š
Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ test/                        Ã¢Å“â€¦ UNIT TESTS
Ã¢â€â€š   Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬ run-tests.js
Ã¢â€â€š
Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ tools/                       Ã°Å¸â€Â§ BUILD SCRIPTS
Ã¢â€â€š   Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ make-docx.js, make-icons.js, package.ps1
Ã¢â€â€š   Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ sync-demo.ps1, calibrate.js
Ã¢â€â€š
Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ store/                       Ã°Å¸ÂÂª PUBLISHING (Edge listing, privacy, steps)
Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ references/                  Ã°Å¸â€œÅ¡ LITERATURE
Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ examples/                    Ã°Å¸â€œÅ½ SAMPLE POLICY PACKS
Ã¢â€â€š
Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ MARKET-ANALYSIS.md           top-level reading order
Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ ARCHITECTURE.md
Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ ROADMAP.md
Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ COURSE-PLAN-MAPPING.md
Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ MANUAL.md                    recreate-from-scratch build manual
Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬ README.md
```

**Deliverable documents (the four you asked for):** `docs/Vector-Market-Analysis.docx`,
`docs/Vector-Architecture.docx`, `docs/Vector-Roadmap.docx`,
`docs/Vector-Course-Plan-Mapping.docx` Ã¢â‚¬â€ with `.md` sources at the repo root.

---

## 3. Final workflow (end to end)

```
 Ã¢â€˜Â  USER WRITES A PROMPT
    "Create an S3 bucket for user documents"
              Ã¢â€â€š
              Ã¢â€“Â¼
 Ã¢â€˜Â¡ ANALYZE  (src/analyzer.js)
    normalise Ã¢â€ â€™ tokenise Ã¢â€ â€™ synonyms Ã¢â€ â€™ intents Ã¢â€ â€™ resources Ã¢â€ â€™ scope guard
    Ã¢â€ â€™ map resources to required controls Ã¢â€ â€™ detect stated controls
      (regex + paraphrase + negation guard) Ã¢â€ â€™ MISSING = required Ã¢Ë†â€™ stated
    Ã¢â€ â€™ risky patterns Ã¢â€ â€™ risk score Ã¢â€ â€™ coverage Ã¢â€ â€™ tiers Ã¢â€ â€™ feedback
              Ã¢â€â€š
              Ã¢â€“Â¼
 Ã¢â€˜Â¢ REPORT
    risk 100 CRITICAL Ã‚Â· coverage 0% Ã‚Â· 11 missing Ã‚Â· 2 risky
    grouped: Confirmed gaps | Needs clarification | Optional hardening
              Ã¢â€â€š
              Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€“Âº Ã¢â€˜Â£ REVIEW          user reads findings
              Ã¢â€â€š
              Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€“Âº Ã¢â€˜Â¤ DEEP SCAN       optional; hides rule answer,
              Ã¢â€â€š                 (src/llm.js)     reveals merged result at once
              Ã¢â€â€š
              Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€“Âº Ã¢â€˜Â¥ ADD CLAUSES     one click per finding
              Ã¢â€â€š
              Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€“Âº Ã¢â€˜Â¦ HARDEN          one tap Ã¢â€ â€™ risk 0 / coverage 100%
                                (analyzer.harden)
              Ã¢â€â€š
              Ã¢â€“Â¼
 Ã¢â€˜Â§ IMPROVED PROMPT  Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€“Âº  copied into the LLM
              Ã¢â€â€š
              Ã¢â€“Â¼
 Ã¢â€˜Â¨ LLM GENERATES Terraform / CloudFormation
              Ã¢â€â€š
              Ã¢â€“Â¼
 Ã¢â€˜Â© VERIFY  (src/tfcheck.js, `vector verify`)   optional post-generation check
```

---

## 4. The 18-step pipeline (final)

| # | Step | What happens |
|---|---|---|
| 0 | Input | prompt + optional policy + strict flag |
| 1 | Normalise | lowercase, negation fixup (`unencrypted` Ã¢â€ â€™ `not encrypted`) |
| 2 | Tokenise | split, drop stopwords (drives confidence) |
| 3 | Synonym expansion | "website" Ã¢â€ â€™ ec2, "object storage" Ã¢â€ â€™ s3 (resource detection only) |
| 4 | Intent detection | create/deploy/allow/restrict/secure/backup/monitor |
| 5 | Policy merge | org rules appended; `alwaysRequired` always relevant |
| 6 | Resource detection | 78 AWS resources (phrase + regex aliases) |
| 7 | Scope guard | reject non-infrastructure input instead of scoring it |
| 8 | Context detection | dev / prod / unknown Ã¢â€ â€™ risk factor 0.75 / 1.10 / 1.00 |
| 9 | Relevant controls | union of resource controls + defaults (+ baseline) |
| 10 | Requirement detection | regex + paraphrase + **3 negation guards** |
| 11 | Omission analysis | `MISSING = relevant Ã¢Ë†â€™ stated` |
| 12 | Risky detection | 9 patterns, negation-aware, de-duplicated |
| 13 | Scoring | `missingRatio^1.5` + risky bump, scaled by env factor |
| 14 | Confidence | tokens + resource clarity Ã¢â€ â€™ `needsDeepScan` |
| 15 | Tiering + coverage | core / clarify / harden; `mentioned / total` |
| 16 | Semantic relevance | TF-IDF top matches (advisory only) |
| 17 | Report | single object consumed by every surface |
| 18 | Render | UI cards, clauses, Terraform hints, one-click actions |

---

## 5. Scoring formulas (final)

```
severityWeight : high = 3 Ã‚Â· medium = 2 Ã‚Â· low = 1
tierMultiplier : core = 1.0 Ã‚Â· clarify = 0.6 Ã‚Â· harden = 0.3

weight        = severityWeight Ãƒâ€” tierMultiplier
missingRatio  = ÃŽÂ£ weight(missing) / ÃŽÂ£ weight(relevant)
base          = round(100 Ãƒâ€” missingRatio^1.5 + min(55, riskyWeight Ãƒâ€” 9))
riskScore     = clamp(round(base Ãƒâ€” envFactor), 0, 100)

coverageScore = round(100 Ãƒâ€” mentioned / (mentioned + missing))

confidence    = (baseline ? 34 : 78)
              Ã¢Ë†â€™ 22 (tokens < 4) Ã¢Ë†â€™ 8 (tokens < 8) Ã¢Ë†â€™ 20 (no controls matched)
              + 6  (Ã¢â€°Â¥ 2 resources), clamped 5Ã¢â‚¬Â¦98
needsDeepScan = confidence < 50  OR  coverageScore < 50
```

**Risk bands:** Ã¢â€°Â¥75 CRITICAL Ã‚Â· Ã¢â€°Â¥50 HIGH Ã‚Â· Ã¢â€°Â¥25 MEDIUM Ã‚Â· Ã¢â€°Â¥1 LOW Ã‚Â· else MINIMAL.

---

## 6. Data model (final)

### Control (30)
```js
{ id, label, dimension, severity, tier, standards[], description,
  clause, patterns[], notAfter[], tf, paraphrase[] }
```

### Resource (78)
```js
{ id, label, aliases[], required[] /* control ids */, noDefaults? }
```

### Risky pattern (9)
```js
{ id, label, pattern, severity, description, fix, neutralize[[regex, repl]] }
```

### Report
```js
{ prompt, tokens, intents, resources, mentioned[], missing[], riskyFindings[],
  riskScore, riskLevel, riskColor, coverageScore, tierCounts, totalWeight,
  confidence, confidenceScore, needsDeepScan, environment, envFactor,
  nonAwsLikely, outOfScope, aiClean, semanticRelated[], feedback[],
  disclaimer, stats{}, standards[], dimensions{} }
```

---

## 7. Interfaces between components

| From | To | Contract |
|---|---|---|
| any surface | engine | `analyze(prompt, options) Ã¢â€ â€™ report` |
| any surface | engine | `harden(prompt) Ã¢â€ â€™ { prompt, clauses, report }` |
| any surface | engine | `project(report, accepted) Ã¢â€ â€™ { riskScore, coverageScore }` |
| extension/mobile | engine | `mergeFindings(report, external) Ã¢â€ â€™ report` |
| engine | surface | `report` object (shape above) |
| CLI | verifier | `verifyText(tfSource) Ã¢â€ â€™ issues[]` |
| mobile/web | engine | engine **copied** into the client by `sync-engine.ps1` |

---

## 8. Technology stack (final)

| Layer | Choice | Reason |
|---|---|---|
| Engine | plain JavaScript (ES5-compatible, no deps) | runs identically in browser, Node, React Native |
| Extension | Manifest V3 | Chrome + Edge, store-publishable |
| CLI | Node.js stdlib only | zero install |
| Mobile (iOS+Android) | React Native via Expo SDK 57 | one codebase, EAS cloud builds (no Mac needed) |
| Mobile (Android) | Capacitor | installable APK, verified build |
| Web demo | static files on GitHub Pages | shareable link, no install |
| Docs | generated OOXML `.docx` from a Node script | reproducible, no manual Word edits |
| CI | GitHub Actions | tests + eval on every push |

**No ML library, no model weights, no backend, no database, no accounts.**

---

## 9. Deployment architecture

| Artefact | Where | How |
|---|---|---|
| Extension | Microsoft Edge Add-ons (Store ID `0RDCKBP2L55J`) | `npm run package` Ã¢â€ â€™ upload zip |
| CLI | local / CI | `node cli/vector-cli.js` |
| Mobile (Expo) | Expo Go (demo) / EAS build (store) | `npm run start:device`, `eas build` |
| Mobile (Android) | installable APK | `gradlew assembleDebug` |
| Web demo | GitHub Pages | push to `main` |
| Source | https://github.com/Ejajaka/vector | git |

---

## 10. Design principles (final)

1. **Deterministic over probabilistic** for the core path.
2. **Explainable** Ã¢â‚¬â€ every finding traces to a control and a pattern.
3. **Offline by default** Ã¢â‚¬â€ no network, no account, no telemetry.
4. **One engine, many clients** Ã¢â‚¬â€ never fork the logic.
5. **Fail safe** Ã¢â‚¬â€ unrecognised but in-scope input gets baseline controls;
   out-of-scope input is refused; a failed deep scan restores the rule answer.
6. **Never overclaim** Ã¢â‚¬â€ the tool is a diagnostic aid, complementary to
   post-generation scanning.
