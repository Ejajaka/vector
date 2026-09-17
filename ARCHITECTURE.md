# Vector — Architecture & Pipeline (Detailed)

Pre-Generation Security Diagnosis of Cloud Infrastructure Prompts Using NLP
**Version 0.5.6 · AWS-only · rule-based NLP · fully offline**

---

## 1. Executive summary

Vector sits **between a user's natural-language prompt and the LLM that turns it
into infrastructure code**. It reads the prompt, decides which AWS resources are
being described, looks up the security controls those resources require, subtracts
the controls the prompt already states, and reports the remainder as **missing
constraints** together with any **risky statements**. Every finding carries a
ready-to-add clause and the Terraform attribute to set. One tap rewrites the
prompt into a hardened version that re-analyses to **risk 0 / coverage 100%**.

No machine learning, no trained model, no network for the core path. The
"knowledge" is a curated, standards-grounded taxonomy.

```
      user prompt
          │
          ▼
   ┌─────────────┐     deterministic, offline, no key
   │   VECTOR    │ ─────────────────────────────────────┐
   └─────────────┘                                      │
          │  missing controls · risky statements        │
          │  risk score · coverage score                │
          │  ready-to-add clauses + Terraform hints     │
          ▼                                             ▼
   hardened prompt ──►  LLM (Terraform / CloudFormation)
          │
          ▼
   generated .tf ──►  vector verify   (post-generation check, closes the loop)
```

---

## 2. System architecture

### 2.1 Layers

| Layer | Files | Responsibility |
|---|---|---|
| **Data / knowledge base** | `src/taxonomy.js` | Resources, controls, risky patterns, synonyms, paraphrase lexicon, tiers, Terraform hints, context cues, non-AWS terms, scope vocabularies |
| **Core engine** | `src/analyzer.js` | The analysis pipeline (normalise → detect → omit → score → recommend) |
| **Secondary NLP** | `src/semantic.js` | TF-IDF index + cosine similarity (topical relevance, advisory only) |
| **Optional AI** | `src/llm.js` | Deep scan via an existing model (on-device or hosted) + merge |
| **Post-generation** | `src/tfcheck.js` | Deterministic checks on generated Terraform |
| **Shared utilities** | `src/settings.js`, `src/ui.js`, `src/ui.css` | Storage/policy helpers; shared results renderer |
| **Surface: extension** | `manifest.json`, `popup.*`, `content.*`, `options.*` | Toolbar popup, in-page button, settings/policy/history |
| **Surface: CLI** | `cli/vector-cli.js` | analyze / improved / verify / hook + policy packs |
| **Surface: mobile** | `mobile/` (Capacitor), `mobile-rn/` (React Native/Expo) | Android + iOS |
| **Surface: web demo** | `demo/` | Static GitHub Pages build |
| **Quality** | `test/`, `eval/`, `.github/workflows/ci.yml` | Unit tests, metrics harnesses, CI |

### 2.2 Layering rule

The engine is **UI-agnostic and dependency-free**. Every surface loads the same
files and calls the same functions (`analyze`, `harden`, `project`,
`mergeFindings`). This is why the extension, CLI, mobile apps and web demo all
produce identical results.

```
   src/taxonomy.js ─┐
   src/semantic.js ─┼─► src/analyzer.js ──► report object ──┬─► src/ui.js (DOM)
   src/settings.js ─┘                                       ├─► popup.js / content.js
                                                            ├─► App.js (React Native)
                                                            ├─► cli/vector-cli.js
                                                            └─► app.js / demo
   src/llm.js ──► mergeFindings ──► same report object
   src/tfcheck.js ──► independent post-generation path
```

### 2.3 File map

```
project_NLP/
├── manifest.json              MV3 manifest (v0.5.6)
├── popup.html/.css/.js        toolbar popup
├── content.js/.css            in-page floating button + panel
├── options.html/.js           settings, org policy, history, "List models"
├── src/
│   ├── taxonomy.js            KNOWLEDGE BASE (78 resources, 30 controls, 9 risky)
│   ├── analyzer.js            PIPELINE + scoring + harden + project + merge
│   ├── semantic.js            TF-IDF relevance (advisory)
│   ├── llm.js                 optional deep scan (on-device / hosted)
│   ├── tfcheck.js             post-generation Terraform checks
│   ├── settings.js            chrome.storage helpers + policy parse
│   └── ui.js / ui.css         shared renderer (risk card, tiers, clauses)
├── cli/vector-cli.js          CLI + CI hook + verify
├── eval/
│   ├── dataset.json           39 labelled prompts (tuning)
│   ├── dataset2.json          59 labelled prompts (tuning)
│   ├── heldout.json           14 labelled prompts
│   ├── run-eval.js            precision / recall / F1 + negation traps
│   ├── kappa.js               inter-annotator agreement
│   └── downstream/            insecure vs hardened Terraform + LLM study
├── test/run-tests.js          60 unit tests
├── tools/                     icons, docx, package, sync, calibrate
├── docs/                      Word documents
├── store/                     listing, privacy, publishing steps
├── references/                supporting literature
├── mobile/                    Capacitor app (Android verified)
├── mobile-rn/                 React Native app (iOS+Android bundles verified)
└── demo/                      GitHub Pages build of the web app
```

---

## 3. The analysis pipeline (detailed)

Entry point: `VectorAnalyzer.analyze(prompt, options)` in `src/analyzer.js`.
`options = { policy, strictMode }`.

### Step 0 — Input

| Input | Type | Notes |
|---|---|---|
| `prompt` | string | the natural-language infrastructure request |
| `options.policy` | object \| null | custom organisation rules (`requirements`, `riskyPatterns`) |
| `options.strictMode` | boolean | promote medium severity to high in the weighting |

### Step 1 — Normalisation

```
"Store data UNENCRYPTED in the S3 bucket"
   -> lowercase, quotes removed, whitespace collapsed
   -> "store data unencrypted in the s3 bucket"
   -> negation prefix fixup: "unencrypted" -> "not encrypted"
   -> "store data not encrypted in the s3 bucket"
```

Purpose: give the negation guard a consistent form. `unsecured/unauthorized`
are mapped similarly.

### Step 2 — Tokenisation

Split on non-alphanumerics, drop a stopword list. Tokens drive the
token-count component of the **confidence** score and are returned in the report.

### Step 3 — Synonym expansion

Everyday words are mapped to canonical AWS nouns (from `SYNONYMS`).

```
"website"        -> ec2, load balancer
"object storage" -> s3
"serverless"     -> lambda
"container"      -> kubernetes/eks
"relational db"  -> rds
```

Used **only** for resource detection. Deliberately excluded from the scope guard
so that "a bucket of water" cannot become "an s3 bucket".

### Step 4 — Intent detection

Verb groups matched on the expanded text:
`create · deploy · store · allow · restrict · secure · connect · backup · monitor`.
Intents are reported and count as a scope signal.

### Step 5 — Policy merge (`applyPolicy`)

Before detection, custom org policy is folded in:
- `policy.requirements[]` → appended; `alwaysRequired: true` marks them relevant
  regardless of which resources were detected.
- `policy.riskyPatterns[]` → appended to the risky list.

### Step 6 — Resource detection

78 AWS resources, each with `aliases`. An alias is matched either as a
**phrase** (word-boundary aware) or as a **regex** if it contains regex
metacharacters — decided by `aliasMatches()`.

```
plain  alias : "s3 bucket"     -> word-boundary phrase match
regex  alias : "\becr\b"       -> regex match
```

This distinction matters: escaping a regex alias would make it never match
(a defect the evaluation harness caught).

### Step 7 — Scope guard

Decides whether this is an infrastructure prompt **at all**. In scope if any of:

1. a **strong, unambiguous term** (`STRONG_TERMS`: `aws`, `s3`, `vpc`, `terraform`,
   `iam`, `rds`, …), or
2. an **infrastructure intent verb**, or
3. **two or more** infrastructure terms (`INFRA_TERMS`), or
4. a resource matched by a **non-ambiguous** alias (not `bucket`, `queue`,
   `table`, `server`, `database` … from `AMBIGUOUS_ALIASES`), or
5. a **risky** statement ("hard-code the password", "send plaintext").

If out of scope, the function returns immediately with
`outOfScope: true`, `riskScore: 0`, no findings and a short message.

Tested boundaries:
```
OUT  "i want a bucket full of water"      IN  "Create an S3 bucket for user documents."
OUT  "a bucket of water"                  IN  "Create a bucket for user files."
OUT  "i need a queue for the tickets"     IN  "Deploy our application to the cloud."
OUT  "i will kill u"                      IN  "Hard-code the database password in the application."
```

### Step 8 — Context detection

Rule-based environment cues adjust the risk weight later:

| Cue set | Terms | Factor |
|---|---|---|
| dev | dev, sandbox, test, staging, poc, prototype | **0.75** |
| prod | production, live, customer data, PII, regulated, PCI, HIPAA | **1.10** |
| unknown | — | 1.00 |

Also detects **non-AWS** terms (`azure`, `gcp`, `bigquery`, …) and sets
`nonAwsLikely` so the UI can warn instead of giving AWS-specific advice.

### Step 9 — Relevant control set

For each detected resource, the union of its `required` controls is collected.
Resources may opt out of the shared defaults via `noDefaults` (identity and
governance services where encryption does not apply).

```
DEFAULT_REQUIRED = encryption_at_rest, encryption_in_transit, least_privilege_iam,
                   audit_logging, regional_restriction
no resource detected  ->  baseline set (+ network_restricted, network_isolation,
                           secrets_management, backup_recovery, monitoring_alerting)
alwaysRequired policy rules are added unconditionally
```

### Step 10 — Requirement detection (with negation guard)

Each control has regex `patterns` plus a curated **paraphrase lexicon**
(`PARAPHRASES`). A control counts as **stated** only if at least one match
survives three guards:

| Guard | Rule | Example |
|---|---|---|
| **before** | the clause before the match (last 60 chars, split on `. , ; ! ?` and `and/but/or/then/so/while/however/except/unless/...`) must contain an **odd** number of negation words | "do **not** make it public" → not public |
| **after** | the next 18 chars must not be `disabled/off/not enabled/inactive` | "logging **disabled**" → audit_logging not stated |
| **notAfter** | a control may declare qualifiers that disqualify a match | "encryption **in transit**" does **not** satisfy *at rest* |

Negation words include `not, no, never, without, avoid, disable, deny, cannot,
except, rather than, instead of, as opposed to …`

```
"do not make it public"    -> public_access_block NOT counted as stated
"not not encrypted"        -> encrypted IS stated (even count)
"logging disabled"         -> audit_logging NOT stated
"stored securely rather than hard-coded" -> no hardcoded_secret finding
```

### Step 11 — Omission analysis

```
MISSING = relevant controls  −  stated controls
```

Each missing control carries: `id, label, dimension, severity, tier, weight,
tf (Terraform hint), description, clause, standards[], appliesTo[], source`.

### Step 12 — Risky-statement detection

Nine built-in risky patterns, matched negated-aware and de-duplicated by id:

| id | Detects |
|---|---|
| `open_ssh` | `0.0.0.0/0`, "open to the internet", "all ports" |
| `public_bucket` | "make the bucket public", "world-readable" |
| `wildcard_iam` | `"*"`, admin/root/full access |
| `no_encryption` | "without encryption", "unencrypted", "plaintext" |
| `hardcoded_secret` | "hard-code", "password in the code" |
| `disabled_logging` | "disable logging", "logging off" |
| `weak_auth` | "without MFA", "no authentication" |
| `public_database` | "publicly accessible database/RDS" |
| `no_backup` | "without backups", "no snapshot" |

Each pattern may define `neutralize` rewrite rules used by `harden()`.

### Step 13 — Scoring

```
severityWeight : high = 3, medium = 2, low = 1
tierMultiplier : core = 1.0, clarify = 0.6, harden = 0.3

weight_i  = severityWeight(severity_i) × tierMultiplier(tier_i)
missingWeight = Σ weight_i over missing controls
maxWeight     = Σ weight_i over all relevant controls
riskyWeight   = Σ (severityWeight × 1.5) over risky findings

missingRatio = missingWeight / maxWeight
base         = round( 100 × missingRatio^1.5  +  min(55, riskyWeight × 9) )
riskScore    = clamp( round(base × envFactor), 0, 100 )
```

Risk levels: `≥75 CRITICAL · ≥50 HIGH · ≥25 MEDIUM · ≥1 LOW · else MINIMAL`.

### Step 14 — Confidence

```
confidence = (baseline mode ? 34 : 78)
           − 22 if tokens < 4  ·  − 8 if tokens < 8
           − 20 if no controls matched
           + 6  if ≥ 2 resources
clamp 5…98   ·   label: ≥75 high · ≥45 medium · else low
needsDeepScan = confidence < 50  OR  coverageScore < 50
```

### Step 15 — Tiering and coverage

```
TIERS: core (strongly implied) · clarify (context-dependent) · harden (optional)
coverageScore = round( 100 × mentioned / (mentioned + missing) )
tierCounts    = count of missing per tier
```

### Step 16 — Semantic relevance (secondary NLP)

`src/semantic.js` builds a TF-IDF index over the controls (each control is a
document: label + description + clause) and ranks them by cosine similarity to
the prompt. The top matches are reported as **"topically related controls"**.

It is **deliberately advisory only**. Measurement showed cosine similarity is
polarity-blind:

```
"open all ports to the internet"  vs  restrict-ports control  -> 0.49  (wrong)
"scrambled on disk"               vs  encryption at rest       -> 0.20  (right, low)
```

So similarity is **never** allowed to mark a control as stated. The negative
result is documented rather than hidden.

### Step 17 — Report

```
REPORT {
  prompt, tokens, intents, resources,
  mentioned[], missing[], riskyFindings[],
  riskScore, riskLevel, riskColor,
  coverageScore, tierCounts, totalWeight,
  confidence, confidenceScore, needsDeepScan,
  environment, envFactor, nonAwsLikely, outOfScope,
  semanticRelated[], feedback[], disclaimer, stats{}, standards[], dimensions{}
}
```

### Step 18 — Rendering

`src/ui.js` draws the report: banner (non-AWS / out-of-scope), risk card with
score + level + coverage + tier counts, risky section, and tier-grouped missing
controls with clause + **Terraform hint** + one-click "Add clause".

---

## 4. Interactive helpers

### 4.1 `project(report, accepted)`

Recomputes risk and coverage for a hypothetical set of accepted clauses, without
re-analysing. Powers the live feedback in the UI.

```
bare S3 bucket:  risk 100 CRITICAL  coverage 0%
+3 clauses       risk  46 MEDIUM    coverage 27%
+6 clauses       risk  15 LOW       coverage 55%
all clauses      risk   0           coverage 100%
```

### 4.2 `harden(prompt)` — one-tap hardening

```
harden(prompt):
    base = neutralizeRisky(prompt)          # rewrite risky phrasing into safe wording
    if analyze(base).outOfScope: return unchanged

    clauses = []
    repeat up to 8 times:
        report = analyze(current)
        found  = report.missing[].clause  +  report.riskyFindings[].fix
        add any clause not already present
        if none added: stop
        current = base + "Security requirements:" + clauses

    return { prompt: current, clauses, report: analyze(current) }
```

Why iterative: appended clauses can mention *other* services (KMS, CloudTrail,
GuardDuty…), which the analyser then also finds missing. Why neutralisation:
the original text may still say `0.0.0.0/0` or `admin access`, which would keep
the risky finding alive.

```
"Create an S3 bucket for user documents."                         -> risk 0, coverage 100%
"S3 + EC2 + SSH from 0.0.0.0/0 + IAM admin access"                -> risk 0, coverage 100%
"RDS PostgreSQL database + S3 bucket for uploads"                 -> risk 0, coverage 100%
```

### 4.3 `mergeFindings(report, external)`

Merges deep-scan output: de-duplicates by label, marks `source: "ai"`, recomputes
`stats`, `tierCounts`, `totalWeight` and risk.

---

## 5. Optional AI deep scan

`src/llm.js`. **Off by default.** Two tiers, tried in order:

| Tier | Endpoint | Key | Network |
|---|---|---|---|
| 1 · on-device | browser Prompt API (Gemini Nano) | no | no |
| 2 · hosted | OpenAI-compatible `/chat/completions` | user's own | yes |

Provider matrix (key, base URL and model must match):

| Provider | Base URL | Example model |
|---|---|---|
| Gemini (free tier, CORS-friendly) | `https://generativelanguage.googleapis.com/v1beta/openai` | `gemini-2.5-flash` |
| OpenAI | `https://api.openai.com/v1` | `gpt-4o-mini` |
| OpenCode Zen | `https://opencode.ai/zen/v1` | `deepseek-v4-flash` |

Mechanics: the model is asked **only** for controls that appear missing and for
risky statements, as strict JSON. `parseFindings` tolerates surrounding prose,
normalises severity, caps results (10 missing, 5 risky) and marks them `ai`.
Errors surface the provider's own message (Google returns an array-shaped error
body, which is handled). Auto-trigger runs when `needsDeepScan` is true.

**CORS reality:** a static web page (the demo) can only call providers that send
CORS headers — Gemini does, OpenCode Zen does not. The **extension** (via
`host_permissions`) and the **mobile app** (native networking) bypass CORS.

---

## 6. Post-generation loop

`src/tfcheck.js` + `vector verify <file.tf>` runs 11 deterministic checks over
generated HCL (public ACL, missing public-access block, S3/RDS encryption,
`0.0.0.0/0`, wildcard IAM, hard-coded credential, missing trail/versioning/
IMDSv2/backups), prints fixes and exits `2` (high), `1` (other) or `0`.

This is the honest architecture: prompt-stage diagnosis is **complementary** to
post-generation scanning, not a replacement.

---

## 7. Surfaces

### 7.1 Browser extension (primary)
`popup` (typed prompt) and `content` (floating V on ChatGPT/Claude/Gemini).
Buttons: Analyze · Deep scan · Harden prompt · Add clause · Accept all · Copy.
Settings toggles: Auto deep scan, Strict mode, org policy JSON, history,
"List models for my key".

### 7.2 CLI
```
vector analyze "…"        vector analyze --json "…"
vector analyze-file f.txt vector improved "…"
vector hook "…"           (exit 2 CRITICAL, 1 HIGH, 0 otherwise)
vector verify file.tf     (post-generation)
--policy file.json        --strict
```

### 7.3 Mobile
`mobile/` (Capacitor, Android build verified) and `mobile-rn/` (React Native,
Expo SDK 57, iOS + Android bundles verified). Both reuse the engine unchanged
via `sync-engine.ps1`; `mobile-rn` rebuilds the UI in React Native components
and adds `npm run start:device` to advertise the correct LAN IP.

### 7.4 Web demo
`demo/` — the same web app published by GitHub Pages, cache-busted with a
version query so a new build is always picked up.

---

## 8. Evaluation methodology

| Artifact | Purpose |
|---|---|
| `eval/dataset.json` (39) · `dataset2.json` (59) | tuning sets |
| `eval/heldout.json` (14) | written before the last round of pattern fixes |
| `eval/run-eval.js` | missing-constraint P/R/F1, risky P/R/F1, negation-trap failures |
| `eval/kappa.js` | Cohen's κ between two independent labelers |
| `eval/downstream/run-downstream.js` | hand-written insecure vs hardened Terraform |
| `eval/downstream/run-llm-study.js` | generate Terraform with an LLM from **raw vs hardened** prompts and score both |

**Honest status.** All 112 prompts were seen and used during development, so
`F1 = 1.000` is **indicative, not a clean held-out result** — state it that way.
Two results that would strengthen the claim are wired but need external inputs:
the LLM downstream study (needs an API key) and inter-annotator agreement (needs
a second human labeler).

---

## 9. Grounding and standards

CIS AWS Foundations Benchmark v3.0 · AWS Well-Architected Framework (Security
Pillar) · AWS Foundational Security Best Practices · NIST SP 800-53 Rev.5
(AC, SC, AU, CP, IA, SI, PM) · GDPR Art. 5/32 · India DPDP Act 2023 (s.16).

Each control carries its `standards[]` citations, shown on the finding.

---

## 10. Properties, limits and design decisions

**Guarantees**
- Deterministic: same prompt → same report. No temperature, no sampling.
- Explainable: every finding traces to a named control and pattern.
- Offline: no network for the core path; no account; no telemetry.
- Never empty: unrecognised-but-in-scope prompts get baseline controls.

**Known limits**
- **AWS only.** Azure/GCP prompt → warning, not results.
- **Rule-based recall ceiling** on arbitrary paraphrase; deep scan covers the
  long tail and is optional.
- **Ambiguity** is inherent to keyword matching; the scope guard removes the
  obvious failures, not every odd sentence.
- **Not a guarantee** — a diagnostic aid that complements post-generation
  scanning.

**Deliberate decisions**
- TF-IDF is advisory only (polarity-blind) — documented negative result.
- Risky phrases are rewritten by `harden()`; the improved prompt is what should
  be handed to the generator.
- Model names change; the UI offers "List models for my key" rather than a
  hard-coded list.

---

## 11. Version history

| Version | Change |
|---|---|
| 0.2.0 | first Edge submission (AWS-only, rule engine) |
| 0.3.0 | coverage score + TF-IDF semantic relevance |
| 0.4.0 | paraphrase lexicon, non-AWS guard, disclaimer, UI banner, tests |
| 0.4.1 | default to Gemini; drop `response_format` |
| 0.4.2 | auto deep scan also on low coverage |
| 0.4.3 | reworded clauses; fix credentials false positive |
| 0.4.4 | relevance tiers, API Gateway fix, "rather than" negation, tier weighting |
| 0.4.5 | public-database false positive; RN safe-area, live coverage, auto AI |
| 0.4.6 | live risk/coverage projection; concise clauses |
| 0.4.7 | context-aware risk, Terraform hints, `verify`, study + kappa harnesses |
| 0.4.8 | 78 resources, scope-aware negation, CI, CIS policy pack |
| 0.5.0 | one-tap `harden()` to risk 0 |
| 0.5.1 | scope guard: reject non-infrastructure input |
| 0.5.2 | deep-scan 404 fix (retired model) + error detail |
| 0.5.3 | "List models for my key" |
| 0.5.4 | OpenCode Zen host permission |
| 0.5.5 | low-confidence indicator + Deep scan guidance |
| 0.5.6 | scope guard tightened (ambiguous words alone); risky-only prompts in scope; demo cache-buster |
