# Vector

**Pre-Generation Security Diagnosis of Cloud Infrastructure Prompts Using NLP**

Vector analyses a natural-language **AWS** infrastructure prompt *before* code is
generated, flags the security constraints the prompt omitted, and turns each one
into a ready-to-add clause you can accept with one click.

Ships as a **Chrome extension** (Manifest V3) plus a **CLI**. The core engine is
**rule-based NLP** - no ML model and no network calls. An optional AI deep scan
(preferring Chrome's built-in on-device model, so no API key) can be added.

> **Full step-by-step build & usage manual:** [`MANUAL.md`](MANUAL.md) — recreate
> the whole project (engine, CLI, extension, evaluation, mobile apps, publishing)
> from a clean machine.

---

## How it works (no ML)

```
prompt
  -> normalise + tokenise
  -> synonym expansion        ("website" -> ec2 / load balancer)
  -> resource detection       (78 AWS resources + aliases)
  -> requirement detection    (30 controls, regex + negation guard)
  -> omissions                (needed controls  MINUS  stated controls)
  -> risky statements         (0.0.0.0/0, public buckets, wildcard IAM ...)
  -> risk score + confidence + fillable clauses
```

The engine is deterministic and explainable. No training, no weights, no model
files - the "knowledge" is the curated taxonomy in `src/taxonomy.js`.

## Deep scan (optional AI)

Two tiers, tried in order:

1. **On-device** - Chrome's built-in model (Gemini Nano) via the browser Prompt
   API. **No API key, no network.** Used automatically when available.
2. **Hosted API** - OpenAI-compatible endpoint. Needs a key, set in Settings.

Either way we only *ask an existing model* for controls we may have missed and
merge the answer back. Every finding is badged **AI** vs rule. If neither tier is
available the extension still works - rules only.

## Confidence
Every analysis returns a rule-engine confidence (0-100):

- `high` (>=75): resources clearly recognised.
- `medium` (45-74).
- `low` (<50): baseline mode, very short prompt, or nothing matched.

If **Auto deep scan** is on, the popup runs a deep scan automatically when either
confidence is low **or** coverage is below 50% (so a recognised-but-thin prompt,
where a paraphrased control may have been missed, still gets the AI pass).

## Coverage score

`coverageScore = mentioned / (mentioned + missing)`, as a percentage. The popup
shows it, and updates live as you accept clauses (e.g. `0% → 64%`). The CLI
prints it too. It is the project's own metric: how much of the required security
surface the prompt already states.

## Semantic relevance (TF-IDF)

`src/semantic.js` treats each control as a document and ranks them by cosine
similarity to the prompt (top 3 shown as "topically related controls"). This is
deliberately **informational only**: measurement (`tools/calibrate.js`) showed
cosine similarity is polarity-blind — "open all ports" scores 0.49 against the
*restrict ports* control — so it is never allowed to mark a control as already
stated. That negative result is documented rather than hidden.

## One-tap harden

`VectorAnalyzer.harden(prompt)` produces a prompt that re-analyses to **risk 0 /
coverage 100%**: it neutralises risky phrases in the base prompt (e.g. `0.0.0.0/0`
-> "a restricted trusted CIDR range") and appends missing-control clauses,
re-analysing until nothing new appears. Available as a **Harden prompt** button
in the popup, the in-page panel and the mobile app.

## Scope guard

Input with no AWS resource, no infrastructure vocabulary and no infrastructure
intent (e.g. "tell me a joke") is rejected (`report.outOfScope`) with a short
message instead of a security score.

## Install the Chrome extension

1. `chrome://extensions` -> enable **Developer mode**.
2. **Load unpacked** -> select this folder.
3. Use the toolbar popup, or the floating **V** button on `chatgpt.com`,
   `claude.ai`, `gemini.google.com`. Right-click the toolbar icon -> **Options**
   for settings, policy and history.

Or load `dist/vector-extension.zip` (built with `npm run package`).

## Evaluation

```powershell
npm run eval          # precision / recall / F1 over labelled prompts
npm test              # 29 unit tests
npm run downstream    # insecure vs hardened Terraform demo
```

| Set | Missing-constraint F1 | Risky F1 | Negation failures |
|---|---|---|---|
| `eval/dataset.json` (39) | 1.000 | 1.000 | 0 |
| `eval/dataset2.json` (59) | 1.000 | 1.000 | 0 |
| `eval/heldout.json` (14) | 1.000 | 1.000 | 0 |

**Honest caveat:** these are small, hand-labelled sets and patterns were improved
after seeing failures, so the numbers are optimistic. Treat them as indicative.
Expand the sets (100+ cases, adversarial paraphrase) before quoting them.
`eval/downstream/run-downstream.js` shows 6 issues -> 0 for hardened Terraform.

## CLI

```powershell
node cli/vector-cli.js analyze "Create an S3 bucket and an EC2 instance"
node cli/vector-cli.js improved "Create an S3 bucket"
node cli/vector-cli.js hook "Deploy an S3 bucket open to the public"   # exit 2/1
node cli/vector-cli.js verify "eval/downstream/insecure.tf"           # post-generation check
node cli/vector-cli.js analyze --policy examples/policy-cis.json "Deploy in us-east-1"
```

## Custom organisation policy

Options page (or `--policy file.json` on the CLI):

```json
{
  "requirements": [
    { "id": "org_tagging", "label": "Mandatory tagging", "severity": "medium",
      "description": "Every resource must be tagged.",
      "clause": "Tag every resource with Owner, Environment and CostCenter.",
      "patterns": ["tagged", "tags"], "alwaysRequired": true }
  ],
  "riskyPatterns": [
    { "id": "banned_region", "pattern": "us-east-1", "label": "Banned region",
      "severity": "high", "fix": "Use eu-west-1." }
  ]
}
```

## Project layout

```
manifest.json         Chrome MV3 manifest (popup + content script + options)
popup.html/.css/.js   toolbar popup
content.js/.css       floating in-page button
options.html/.js      settings, policy and history
src/taxonomy.js       resources, controls, risky patterns, synonyms
src/analyzer.js       rule engine (negation guard, scoring, merge)
src/settings.js       chrome.storage helpers (shared by all UIs)
src/ui.js/.css        shared results renderer
src/llm.js            optional deep scan (on-device + hosted)
cli/vector-cli.js     CLI + CI hook + `verify` (post-generation)
eval/                 labelled sets + metrics + downstream demo
test/run-tests.js     29 unit tests
tools/                icon generator, packaging script
```

## To keep the code small for a rewrite

Everything extra is isolated. If you need fewer files, you can delete
`tools/`, `eval/downstream/`, `options.*`, `src/llm.js` and `src/settings.js` and
still have a working rule-based popup + content script + CLI.

## Manual Chrome test checklist

I cannot run Chrome here, so verify on your machine:

1. Load unpacked - the toolbar shows the Vector icon (coloured V).
2. Popup -> **Sample** -> **Analyze** -> a risk panel appears.
3. Click **+ Add clause** -> the improved prompt updates -> **Copy**.
4. Open a supported chat site -> the floating **V** appears -> type a prompt ->
   **Analyze composer text**.
5. Options page -> paste an invalid policy -> **Save** shows an error; valid
   policy saves.
6. On-device: open `chrome://flags`, enable the Prompt API for Gemini Nano if
   offered. Options page then says the on-device model is available.

## Grounding

CIS AWS Foundations Benchmark, AWS Well-Architected (Security), AWS Foundational
Security Best Practices, NIST SP 800-53 Rev.5, GDPR Art. 5/32, India DPDP Act 2023.
