# Vector - Complete Build Roadmap (How Everything Was Made)

**Pre-Generation Security Diagnosis of Cloud Infrastructure Prompts Using NLP**
Version 0.7.2 - AWS-only - rule-based NLP - fully offline

> This is the **reimplementation guide**. It records, in order, every step that was
> taken to build this project: the decisions, the code, the exact commands, the
> bugs that appeared, and how each was fixed. Anyone following it end to end can
> rebuild Vector from an empty folder.

Companion documents: `Vector-Market-Analysis.docx` (why), `Vector-Architecture.docx`
(what), `Vector-Roadmap.docx` (plan forward), `Vector-Code-Walkthrough.docx`
(plain-English tour).

---

# PART A - FOUNDATIONS

## A1. Prerequisites (install once)

| Tool | Version used | Needed for |
|---|---|---|
| Node.js | 22.19.0 | everything (engine, CLI, extension, mobile JS) |
| npm | 11.6.0 | dependencies |
| Git | 2.48+ | version control |
| Java (Temurin JDK) | 17.0.20 | Capacitor Android build |
| Android SDK | platforms 33/35/36, build-tools 34/35/36 | Android builds |
| Android Studio | current | Android builds + emulator |

Only **Node + Git** are required for the engine, CLI, extension and evaluation.

Verify:
```powershell
node --version      # v22.x
npm --version       # 11.x
git --version
```

## A2. Initialise the project

```powershell
mkdir project_NLP
cd project_NLP
git init -b main
```

Create `.gitignore`:
```
node_modules/
dist/
*.log
.DS_Store
Thumbs.db
```

## A3. Guiding decisions made before writing code

These decisions shaped everything and should be kept if reimplementing:

1. **Deterministic over probabilistic.** No ML model, no training. Chosen so every
   result is reproducible and explainable.
2. **Zero dependencies.** The engine uses no npm packages, so it runs identically
   in a browser, in Node, and inside React Native.
3. **One engine, many clients.** UI code never contains analysis logic.
4. **Data separated from logic.** All domain knowledge lives in one data file.
5. **AWS only.** Deliberate scope; other clouds get a warning.
6. **Honest limitations.** Limits are documented rather than hidden.

---

# PART B - THE ENGINE (the actual product)

## B1. The knowledge base - `engine/src/taxonomy.js`

This file is **pure data**. It contains no logic. Structure:

```js
const DIMENSIONS = { encryption: "Encryption", access_control: "Access Control", ... };

const SEVERITY_WEIGHT = { high: 3, medium: 2, low: 1 };

// 30 security controls
const REQUIREMENTS = [
  {
    id: "encryption_at_rest",
    label: "Encryption at rest",
    dimension: "encryption",
    severity: "high",
    description: "Why this matters, in plain language.",
    clause: "Encrypt data at rest; specify whether a customer-managed KMS key is required.",
    standards: ["CIS AWS 2.1.1", "AWS FSBP S3.4 / RDS.3", "NIST SP 800-53 SC-28"],
    patterns: ["encrypt(ed|ion)?", "\\bkms\\b", "at rest", "scrambled"],
    notAfter: ["in transit", "over the (network|wire)"]
  },
  // ... 29 more
];

// 78 AWS resources, each mapped to the controls it needs
const RAW_RESOURCES = [
  { id: "s3", label: "S3 bucket (AWS)",
    aliases: ["s3", "simple storage service", "object storage", "bucket"],
    required: ["public_access_block", "data_residency", "versioning", "backup_recovery"] },
  // ... 77 more
];

const DEFAULT_REQUIRED = [
  "encryption_at_rest", "encryption_in_transit", "least_privilege_iam",
  "audit_logging", "regional_restriction"
];

// 9 dangerous phrasings
const RISKY_PATTERNS = [
  { id: "open_ssh",
    pattern: "0\\.0\\.0\\.0/0|::/0|open to (the )?(internet|world|public|anyone)",
    label: "Unrestricted inbound access",
    severity: "high",
    description: "...", fix: "Restrict inbound to a trusted CIDR.",
    neutralize: [[/0\.0\.0\.0\/0/gi, "a restricted trusted CIDR range"]] },
  // ... 8 more
];

// everyday words -> AWS nouns
const SYNONYMS = [
  { test: /\b(bucket|object storage)\b/i, add: " s3 " },
  // ... 18 more
];

// curated alternative phrasings per control
const PARAPHRASES = {
  encryption_at_rest: ["scrambled", "\\bcipher\\b"],
  audit_logging: ["who did what", "activity record"],
  // ... 11 more
};

const TIERS = { encryption_at_rest: "core", data_residency: "clarify", imdsv2: "harden", ... };

// words that flip meaning
const NEGATION_WORDS = ["not","no","never","without","avoid","disable","except","rather than", ...];

// scope-guard vocabularies
const STRONG_TERMS = ["aws","s3","terraform","vpc","iam", ...];
const AMBIGUOUS_ALIASES = ["bucket","queue","table","server", ...];
const NON_AWS_TERMS = ["azure","gcp","bigquery", ...];
const CONTEXT_CUES = { dev: ["dev","sandbox",...], prod: ["production","customer data",...] };
```

**Why this shape:** adding a new check = adding a row, not writing code. That is
what makes the tool maintainable.

## B2. The pipeline - `engine/src/analyzer.js`

### B2.1 Module wrapper (so it works in Node *and* the browser)
```js
(function (root) {
  const _VectorTaxonomy = (typeof module !== "undefined" && module.exports)
    ? require("./taxonomy")
    : globalThis.VectorTaxonomy;
  // ... code ...
  if (typeof module !== "undefined" && module.exports) module.exports = VectorAnalyzer;
  root.VectorAnalyzer = VectorAnalyzer;
})(typeof globalThis !== "undefined" ? globalThis : this);
```
**Why:** the same file is loaded by Node (`require`) and by the browser and React
Native (global). Without this wrapper the two environments disagree.

### B2.2 Step 1 - Normalisation
```js
function normalize(text) {
  return String(text || "")
    .replace(/\r\n/g, "\n")
    .toLowerCase()
    .replace(/\bunencrypted\b/g, " not encrypted")   // negation fixup
    .replace(/\bunsecured\b/g, " not secured")
    .replace(/[`"'â€™]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
```
The `unencrypted -> not encrypted` rewrite exists so the negation guard has one
consistent form to detect.

### B2.3 Step 2 - Tokenisation
```js
const STOPWORDS = new Set(["a","an","the","and","or","for","with","to", ...]);
function tokenize(text) {
  return normalize(text).split(/[^a-z0-9.\/]/g)
    .filter(t => t.length > 1 && !STOPWORDS.has(t));
}
```
Token count is later used by the confidence score.

### B2.4 Step 3 - Synonym expansion
```js
function expandSynonyms(text) {
  let out = text;
  for (const s of SYNONYMS) if (s.test.test(text)) out += s.add;
  return out;
}
```
Used **only** for resource detection. Deliberately **not** used in the scope guard
(otherwise "a bucket of water" becomes "s3").

### B2.5 Step 4 - Intent detection
```js
const INTENT_VERBS = [
  ["create", /\b(create|build|set up|provision|make)\b/i],
  ["deploy", /\b(deploy|provision|launch|host)\b/i],
  // ... 7 more
];
```

### B2.6 Step 5 - Resource detection (entity extraction)
```js
function isRegexAlias(alias) { return /[\\^$.*+?()[\]{}|]/.test(alias); }

function aliasMatches(haystack, alias) {
  if (isRegexAlias(alias)) return new RegExp(alias, "i").test(haystack);
  const re = new RegExp("(^|[^a-z0-9])" + escapeRegExp(alias) + "([^a-z0-9]|$)", "i");
  return re.test(haystack);
}

function detectResources(haystack) {
  const found = [];
  for (const res of RESOURCES) {
    const hit = res.aliases.find(a => aliasMatches(haystack, a));
    if (hit) found.push({ id: res.id, label: res.label, matched: hit });
  }
  return found;
}
```
**Critical detail:** aliases may be plain phrases (`"s3 bucket"`) or regex
(`"\\becr\\b"`). The code decides automatically. *(Earlier this was a bug - see
Part F1.)*

### B2.7 Step 6 - The negation guard (the most important NLP work)
```js
const NEGATION_RE_G = new RegExp(NEGATION_WORDS.map(escape).join("|"), "gi");
const CLAUSE_SPLIT = /[.,;!?\n]|\b(?:and|but|or|then|so|while|however|except|unless|apart from)\b/;

/** true if the clause before the match contains an ODD number of negations */
function isNegatedBefore(text, index) {
  const start = Math.max(0, index - 60);
  const window = text.slice(start, index);
  const parts = window.split(CLAUSE_SPLIT);
  const clause = parts[parts.length - 1] || "";
  const hits = clause.match(NEGATION_RE_G);
  return !!(hits && hits.length % 2 === 1);   // parity -> double negatives work
}

/** true if the match is followed by a disabling word */
function isNegatedAfter(text, index) {
  const window = text.slice(index, index + 18);
  const cut = window.search(CLAUSE_SPLIT);
  const seg = cut >= 0 ? window.slice(0, cut) : window;
  return /\b(disabled|off|turned off|not enabled|inactive)\b/.test(seg);
}
```
Handles: `"do not make it public"` (not public), `"not not encrypted"`
(encrypted), `"logging disabled"` (not stated), `"stored securely rather than
hard-coded"` (not hard-coded).

### B2.8 Step 7 - Requirement detection
```js
function detectRequirement(requirement, text) {
  const matches = findMatches(text, requirement.patterns);
  if (!matches.length) return { present: false, negated: false };
  const positive = matches.some(m => {
    const end = m.index + m.value.length;
    if (isNegatedBefore(text, m.index)) return false;
    if (isNegatedAfter(text, end)) return false;
    if (requirement.notAfter) {
      const seg = text.slice(end, end + 20);
      if (requirement.notAfter.some(p => new RegExp(p, "i").test(seg))) return false;
    }
    return true;
  });
  return { present: positive, negated: !positive };
}
```

### B2.9 Step 8 - The main function
```js
function analyze(prompt, options = {}) {
  const normalized = normalize(prompt);
  const expanded = expandSynonyms(normalized);
  const tokens = tokenize(prompt);
  const intents = detectIntents(expanded);

  // merge org policy
  const { requirements, risky } = applyPolicy(REQUIREMENTS, RISKY_PATTERNS, options.policy);

  const resources = detectResources(expanded);

  // --- scope guard (see B3) ---

  // environment detection
  const isDev  = CONTEXT_CUES.dev.some(c => new RegExp(c,"i").test(normalized));
  const isProd = CONTEXT_CUES.prod.some(c => new RegExp(c,"i").test(normalized));
  const environment = isProd ? "prod" : isDev ? "dev" : "unknown";
  const envFactor = ENV_FACTOR[environment];

  // --- relevant control set ---
  const relevantIds = new Set();
  if (resources.length) {
    for (const r of resources) {
      const def = RESOURCES.find(x => x.id === r.id);
      for (const c of def.required) relevantIds.add(c);
    }
  } else {
    for (const c of DEFAULT_REQUIRED.concat(BASELINE_EXTRA)) relevantIds.add(c);
  }

  // --- the set difference ---
  const mentioned = [], missing = [], relevantCounts = [];
  for (const req of requirements) {
    if (!relevantIds.has(req.id)) continue;
    const weight = SEVERITY_WEIGHT[req.severity] * TIER_MULT[req.tier];
    const res = detectRequirement(req, normalized);
    relevantCounts.push({ id: req.id, weight, missing: !res.present });
    if (res.present) mentioned.push({...});
    else missing.push({ ...req, weight, appliesTo: [...] });
  }

  const riskyFindings = dedupeRiskyFindings(normalized, risky);
  const riskScore = computeRisk(relevantCounts, riskyFindings) * envFactor;
  const coverageScore = Math.round(100 * mentioned.length / (mentioned.length + missing.length));
  // ... build and return the report
}
```

## B3. The scope guard (refined after two rounds of bugs)

Goal: **do not produce a security report for text that is not an infrastructure
prompt.** In scope if **any** of these is true:

```js
const infraHits      = termMatches(INFRA_TERMS, normalized) > 0;
const hasStrongTerm  = termMatches(STRONG_TERMS, normalized) > 0;
const strongResource = detectResources(normalized).some(r =>
    isRegexAlias(r.matched) || !AMBIGUOUS_ALIASES.includes(r.matched.toLowerCase()));
const hasRiskySignal = RISKY_PATTERNS.some(p => new RegExp(p.pattern,"i").test(normalized));

const inScope = hasStrongTerm || intents.length > 0 || infraHits >= 2
             || strongResource || hasRiskySignal;

if (!inScope) return { outOfScope: true, riskScore: 0, missing: [], ... };
```

Tested boundary:
```
OUT  "i want a bucket full of water"    IN   "Create an S3 bucket for user documents."
OUT  "a bucket of water"                IN   "Create a bucket for user files."
OUT  "i need a queue for the tickets"   IN   "Deploy our application to the cloud."
OUT  "i will kill u"                    IN   "Hard-code the database password in the app."
```

## B4. Scoring
```js
function computeRisk(relevantCounts, findings) {
  let missingWeight = 0, maxWeight = 0;
  for (const r of relevantCounts) { maxWeight += r.weight; if (r.missing) missingWeight += r.weight; }
  const ratio = missingWeight / Math.max(1, maxWeight);
  let score = 100 * Math.pow(ratio, 1.5);           // super-linear: gaps dominate
  let riskyWeight = 0;
  for (const f of findings) riskyWeight += SEVERITY_WEIGHT[f.severity] * 1.5;
  return Math.min(100, Math.round(score + Math.min(55, riskyWeight * 9)));
}
```
Confidence and `needsDeepScan` as in the Architecture document.
**Risk bands:** >=75 CRITICAL, >=50 HIGH, >=25 MEDIUM, >=1 LOW, else MINIMAL.

## B5. The two interactive helpers

### `project(report, accepted)` - live score preview
Recomputes risk and coverage for a hypothetical accepted set **without**
re-analysing. Powers the "risk 100 -> 46 -> 15 -> 0" feedback in the UI.

### `harden(prompt)` - one tap to zero
```js
function harden(prompt, maxIterations = 8) {
  const base = neutralizeRisky(prompt);            // rewrite risky phrasing
  if (analyze(base).outOfScope) return { prompt: base, clauses: [], report: analyze(base) };
  const clauses = [];
  let current = base;
  for (let i = 0; i < maxIterations; i++) {
    const r = analyze(current);
    const found = r.missing.map(m => m.clause).concat(r.riskyFindings.map(f => f.fix));
    let added = 0;
    for (const c of found) if (c && !clauses.includes(c)) { clauses.push(c); added++; }
    if (added === 0) break;                        // converged
    current = buildImprovedPrompt(base, clauses);
  }
  return { prompt: current, clauses, report: analyze(current) };
}
```
**Why iterative:** an appended clause can mention another service (KMS,
CloudTrail), which the analyser then also finds missing. Two things were needed to
reach convergence - see Part F4.

## B6. Secondary NLP - `engine/src/semantic.js`

TF-IDF over the controls, cosine similarity to the prompt, top matches reported as
"topically related". ~130 lines. **Measured and deliberately restricted** (Part F3).

## B7. Optional AI - `engine/src/llm.js`

Two tiers: on-device (Chrome Prompt API) then hosted (OpenAI-compatible). Returns
`{ missing, risky, clean }`. Errors surface the provider's own message.

## B8. Post-generation - `engine/src/tfcheck.js`

11 deterministic checks on a `.tf` file. Used by `vector verify`.

---

# PART C - THE CLIENTS

## C1. Browser extension
`manifest.json` (MV3) + `popup.*` + `content.*` + `options.*`.

Build the store zip:
```powershell
npm run package     # -> dist/vector-extension.zip, manifest at the ZIP ROOT
```
**Key requirement:** the store needs `manifest.json` at the zip root, so
`tools/package.ps1` flattens `ui/extension/` + `engine/src/` + `ui/media/` into a staging
folder before zipping.

## C2. CLI
```powershell
node engine/cli/vector-cli.js analyze "Create an S3 bucket"
node engine/cli/vector-cli.js improved "Create an S3 bucket"
node engine/cli/vector-cli.js verify engine/eval/downstream/insecure.tf   # exit 2/1/0
node engine/cli/vector-cli.js hook "Deploy an S3 bucket public"    # CI gate
```

## C3. React Native (Expo) app
```powershell
cd mobile-expo
npm install
npm run sync            # copy the engine into engine/src/
npm run start:device    # advertises the correct LAN IP
```
Bundles verified with `npx expo export --platform ios|android`.

## C4. Capacitor Android app
```powershell
cd mobile-native
npm install
npm run sync
npm run add:android
cd android
.\gradlew.bat assembleDebug --no-daemon    # -> app-debug.apk
```

## C5. Web demo
`ui/web/` is the same web app, published by GitHub Pages, with script cache-busting.

---

# PART D - EVIDENCE

## D1. Unit tests - `engine/test/run-tests.js`
63 tests covering the engine, the renderer, the deep-scan client, harden and the
scope guard. Run: `npm test`.

## D2. Evaluation harness - `engine/eval/`
Three labelled sets (39 + 59 + 14 = 112 prompts). Metrics: missing-constraint
P/R/F1, risky P/R/F1, negation-trap failures. Run: `npm run eval`.

## D3. Inter-annotator agreement - `engine/eval/kappa.js`
Cohen's kappa between two label files. Run: `npm run kappa -- a.json b.json`.

## D4. Downstream studies - `engine/eval/downstream/`
- `run-downstream.js` - hand-written insecure vs hardened Terraform (6 -> 0).
- `run-llm-study.js` - generate Terraform with an LLM from raw vs hardened
  prompts and score both. Run: `npm run study -- --key <KEY>`.

## D5. CI - `.github/workflows/ci.yml`
Runs tests + eval + downstream + verify on every push.

---

# PART E - THE DOCUMENTATION PIPELINE

Documents are **generated**, never hand-edited, so they never drift:

```
docs/_sources/*.md  --[tools/md-to-docx.js]-->  docs/*.docx
```

- `tools/docx-lib.js` - minimal OOXML writer (a .docx is a ZIP of XML).
- `tools/md-to-docx.js` - Markdown -> Word (headings, lists, tables, code, quotes).
- `tools/make-docx.js` - the hand-authored report documents.

```powershell
npm run docs    # markdown sources -> Word
npm run docx    # report documents -> Word
```

---

# PART F - EVERYTHING THAT BROKE, AND THE FIX

This part is the most useful for reimplementation: it is the list of traps.

## F0. Security Delta Analysis (v0.7.0) - feature added, not a bug

**What:** `computeDelta(previous, current)` compares two reports of the same
prompt and reports added controls, still-missing controls, newly-missing
(regressed) controls, new/fixed risks, and the risk/coverage movement.

**Why it needed care:**
1. **Legacy history stored a count, not ids.** Older entries had
   `missing: 4` (a number), so a delta against them would be nonsense. The
   function returns `null` unless both sides carry id lists.
2. **Different resource sets are not comparable.** An S3 prompt and an
   "S3 + RDS" prompt have different required control sets. The delta flags
   `resources.changed` and the UI warns rather than showing a misleading number.
3. **The sync script copied the wrong way.** `tools/sync-engine.ps1` used to
   copy `ui/mobile-native/www` into `ui/web`, which overwrote web edits. Fixed:
   the **web client is now the source of truth** and Capacitor mirrors it.

## F1. Regex aliases were never matching
**Symptom:** ECR, ALB, EMR, Transfer, Organizations were never detected.
**Cause:** aliases like `"\\becr\\b"` were passed through `escapeRegExp()`, so the
backslashes were escaped and the pattern became literal text.
**Fix:** `isRegexAlias()` decides; regex aliases are used as regex, plain aliases
get word-boundary wrapping. **Lesson:** the evaluation harness found this, not
manual testing.

## F2. Everything scored CRITICAL
**Symptom:** a detailed, secure prompt still scored 100.
**Cause:** the linear risk formula saturated.
**Fix:** `missingRatio^1.5` plus separated risky weight, then tier multipliers, then
the environment factor. **Lesson:** calibrate scoring against real examples.

## F3. TF-IDF marked opposite meaning as "stated"
**Symptom:** "open all ports to the internet" scored 0.49 against the
*restrict ports* control.
**Cause:** bag-of-words is polarity-blind.
**Fix:** measured it (`tools/calibrate.js`), then **demoted it to advisory** -
similarity is never allowed to mark a control satisfied. The negative result is
documented. **Lesson:** implement, measure, then restrict - do not ship a feature
that misfires.

## F4. The hardened prompt still scored 56
**Symptom:** appending all clauses did not reach zero.
**Cause 1:** the base text still contained `0.0.0.0/0` and `admin access`, so the
risky findings survived. **Fix:** `neutralizeRisky()` rewrites them.
**Cause 2:** some clauses did not contain their own keywords ("Avoid wildcard
actions..." did not match the wildcard pattern). **Fix:** rewrote those clauses so
each is **self-satisfying**, and added an automated check.
**Cause 3:** a clause about database ports tripped the public-database pattern.
**Fix:** reworded to "administrative and database ports reachable only from trusted
networks".
**Lesson:** run a convergence check (`tools/selfcheck.js`) over every clause.

## F5. "stored securely rather than hard-coded" flagged as hard-coded
**Cause:** "rather than" was not a negation cue.
**Fix:** added `rather than`, `instead of`, `as opposed to`, `other than` to
`NEGATION_WORDS`.

## F6. False positive - "Publicly reachable database"
**Cause:** the pattern allowed the word `instance` to bridge an unrelated sentence
("available over the internet and survives an instance failure").
**Fix:** tightened the pattern and removed the generic `instance` token.

## F7. "a bucket of water" scored 100
**Cause 1:** `bucket` is an S3 alias. **Cause 2:** the synonym expander turned
`bucket` into `s3` *before* the scope check, so it looked like a strong signal.
**Fix:** judge scope on the **original** text, require a strong term, an intent
verb, two infrastructure terms, a non-ambiguous resource, or a risky statement.
Also removed `blob` from the S3 synonyms (it was mapping Azure prompts to AWS S3).

## F8. Deep scan returned 404
**Cause:** `gemini-2.0-flash` was **retired**; Google returns 404 for an unknown
model.
**Fix:** default to `gemini-2.5-flash`; surface the provider's own error message.
Added a "List models for my key" button so the model list is discovered, not
guessed.

## F9. "Failed to fetch" on the web demo
**Cause:** CORS. A static page cannot call providers that do not send CORS headers
(OpenCode Zen), and the extension also needed a `host_permissions` entry for
`opencode.ai`.
**Fix:** added the host permission; the demo explains that deep scan is blocked and
points to the ui/extension/mobile app.

## F10. Expo Go: "couldn't connect to the server"
**Cause 1:** the wrong LAN IP was advertised (the machine had Ethernet, Wi-Fi,
VMware and WSL addresses). **Fix:** `start-device.ps1` auto-detects the Wi-Fi IP.
**Cause 2:** Expo SDK too old for the current Expo Go. **Fix:** upgraded to SDK 57
(RN 0.86, React 19).
**Cause 3 after the upgrade:** Metro failed with *"Cannot read properties of
undefined (reading 'transformFile')"*. **Cause:** `babel-preset-expo` was not
resolvable at top level. **Fix:** clean reinstall plus `npx expo install
babel-preset-expo`.

## F11. Emulator "Unknown AVD name"
**Cause:** the AVD is named `Medium_Phone_API_36`, not `Medium_Phone`.
**Fix:** use the real name (check `%USERPROFILE%\.android\avd\*.ini`).

## F12. Documentation generator dropped a document
**Cause:** an over-eager text replacement removed the progress report from the
output list.
**Fix:** restored it, and verified that `npm run docx` emits every expected file.

---

# PART G - COMPLETE COMMAND REFERENCE

```powershell
# --- engine ---
npm test                     # 63 unit tests
npm run eval                 # precision / recall / F1 + negation traps
npm run downstream           # insecure vs hardened Terraform (6 -> 0)
npm run study -- --key K     # LLM study: raw vs hardened prompts
npm run kappa -- a.json b.json

# --- build ---
npm run docs                 # markdown sources -> Word
npm run docx                 # report documents -> Word
npm run icons                # regenerate icons
npm run package              # -> dist/vector-extension.zip

# --- use ---
node engine/cli/vector-cli.js analyze "Create an S3 bucket for user documents"
node engine/cli/vector-cli.js improved "Create an S3 bucket"
node engine/cli/vector-cli.js verify engine/eval/downstream/insecure.tf

# --- sync engine into the clients after editing engine/src/ ---
powershell -File ui/mobile-expo/sync-engine.ps1
powershell -File ui/mobile-native/sync-engine.ps1
powershell -File tools/sync-demo.ps1

# --- mobile ---
cd mobile-expo; npm install; npm run start:device
cd mobile-native; npm install; npm run add:android
cd ui/mobile-native/android; .\gradlew.bat assembleDebug --no-daemon
```

---

# PART H - RULES TO FOLLOW IF REIMPLEMENTING

1. **Edit only `engine/src/`.** The copies inside `ui/mobile-expo/src`,
   `ui/mobile-native/www/src` and `ui/web/src` are generated by the sync scripts.
2. **Never edit a `.docx`.** Edit `docs/_sources/*.md` and run `npm run docs`.
3. **Bump `manifest.json`'s version before every store upload.** The store rejects a
   re-upload with the same version.
4. **Run `npm test` and `npm run eval` before every commit.**
5. **Keep clauses self-satisfying** - a clause must contain the keywords its own
   control matches, or `harden()` will never converge.
6. **Judge scope on the original text**, never on the synonym-expanded text.
7. **Measure before shipping an NLP feature.** If it misfires, restrict its role
   and document why (this is how the TF-IDF component ended up advisory-only).
8. **Report limitations honestly.** The evaluation was tuned during development;
   say so, and give the frozen number when it exists.

---

# PART I - TIME TAKEN (approximate)

| Phase | Work | Sessions |
|---|---|---|
| Foundations | decisions, taxonomy skeleton | 1 |
| Engine | pipeline, negation, scoring | 3 |
| First client | extension (popup, content, options) | 2 |
| Evidence | tests, datasets, harness | 2 |
| Mobile | Capacitor build, then React Native | 3 |
| Hardening | scope guard, tiers, harden(), bug fixes (Part F) | 4 |
| Documentation | generator, four documents, manual | 2 |
| **Total** | | **~17 focused sessions** |

The bulk of the effort was not writing the first version - it was **measurement
and correction** (Part F). That is the normal shape of a rule-based NLP system.
