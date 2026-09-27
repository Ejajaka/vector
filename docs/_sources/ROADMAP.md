# Vector Ã¢â‚¬â€ Step-by-Step Roadmap

**Pre-Generation Security Diagnosis of Cloud Infrastructure Prompts Using NLP**
Version 0.5.7 Ã‚Â· AWS-only Ã‚Â· rule-based NLP

> Companion documents: `MARKET-ANALYSIS.md` (why), `ARCHITECTURE.md` (how),
> `COURSE-PLAN-MAPPING.md` (syllabus links).

---

## 0. Status snapshot (17 September 2026)

**Already built and working.** The roadmap below is therefore split into
"already done" (for the report) and "remaining" (the plan).

| Component | Status |
|---|---|
| Rule engine (78 resources, 30 controls, 9 risky patterns) | Ã¢Å“â€¦ done |
| Risk + confidence + coverage scoring | Ã¢Å“â€¦ done |
| Relevance tiers, context awareness, Terraform hints | Ã¢Å“â€¦ done |
| One-tap harden to risk 0 / coverage 100% | Ã¢Å“â€¦ done |
| Scope guard + non-AWS guard | Ã¢Å“â€¦ done |
| Browser extension (popup, in-page, options) | Ã¢Å“â€¦ done, submitted to Edge |
| CLI (analyze, improved, verify, hook) | Ã¢Å“â€¦ done |
| React Native (Expo) app Ã¢â‚¬â€ iOS + Android bundles verified | Ã¢Å“â€¦ done |
| Capacitor Android app Ã¢â‚¬â€ APK build verified | Ã¢Å“â€¦ done |
| Public web demo | Ã¢Å“â€¦ done |
| AI deep scan (on-device + hosted, 3 providers) | Ã¢Å“â€¦ done |
| Unit tests (63) | Ã¢Å“â€¦ done |
| Evaluation harness (112 labelled prompts) | Ã¢Å“â€¦ done |
| Documentation set | Ã¢Å“â€¦ done |

**Remaining work is evidence and polish, not features.**

---

## Phase 1 Ã¢â‚¬â€ Freeze & measure (Weeks 1Ã¢â‚¬â€œ2)

### Week 1 Ã¢â‚¬â€ Frozen evaluation set
| Task | Output | Done when |
|---|---|---|
| Expand labelled prompts past 150, including adversarial paraphrase | `eval/dataset3.json` | new prompts committed |
| **Freeze the patterns** Ã¢â‚¬â€ stop editing `taxonomy.js` | a git tag | `git tag freeze-eval` |
| Add a genuinely unseen set written after the freeze | `eval/final-holdout.json` | separate file, never used for tuning |
| Run the harness on all sets | numbers | `npm run eval` output saved to `docs/eval-results.txt` |

**Why first:** the current F1 = 1.000 is optimistic because all 112 prompts were
seen during development. This phase produces an honest number.

### Week 2 Ã¢â‚¬â€ Two studies that prove the claim
| Task | Command | Output |
|---|---|---|
| **LLM downstream study** Ã¢â‚¬â€ generate Terraform from raw vs hardened prompts, score both | `npm run study -- --key <KEY>` | table: issues raw Ã¢â€ â€™ hardened |
| **Inter-annotator agreement** Ã¢â‚¬â€ a teammate labels 30 prompts independently | `npm run kappa -- a.json b.json` | Cohen's ÃŽÂº |
| Post-generation check on real generated code | `npm run verify -- gen.tf` | issues list |

**Why second:** these two turn "we built a tool" into "we measured an effect".

---

## Phase 2 Ã¢â‚¬â€ Harden the deliverable (Weeks 3Ã¢â‚¬â€œ4)

### Week 3 Ã¢â‚¬â€ Mobile + store
| Task | Output |
|---|---|
| Run the Expo app on a real iPhone (Expo Go) and a real Android device | screenshots |
| Fix any UI issues found on device | commit |
| Capture store screenshots (640Ãƒâ€”480 or 1280Ãƒâ€”800) | 3 images |
| Upload the latest extension zip to Edge Add-ons, paste certification notes | submission in review |
| Add screenshots to the store listing | listing complete |

### Week 4 Ã¢â‚¬â€ Quality + gaps
| Task | Output |
|---|---|
| Fix detection gaps found by the frozen set | commit + re-run eval |
| Add unit tests for any new rule | `test/run-tests.js` |
| Verify CI passes on a clean clone | GitHub Actions green |
| Update all four documents with final numbers | `npm run docx` |

---

## Phase 3 Ã¢â‚¬â€ Report & demo (Weeks 5Ã¢â‚¬â€œ6)

### Week 5 Ã¢â‚¬â€ Documents and demo script
| Task | Output |
|---|---|
| Finalise the four documents (market, architecture, roadmap, course mapping) | `docs/*.docx` |
| Write the 5-minute demo script | `docs/demo-script.md` |
| Rehearse: prompt Ã¢â€ â€™ findings Ã¢â€ â€™ harden Ã¢â€ â€™ copy Ã¢â€ â€™ verify | run-through |
| Prepare the viva answer set (see below) | notes |

### Week 6 Ã¢â‚¬â€ Buffer and submission
| Task |
|---|
| Polish README and MANUAL |
| Final git commit and tag `v1.0` |
| Rehearse demo twice end to end |
| Submit |

---

## Week-by-week gantt (compact)

```
Week 1  eval freeze Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
Week 2  LLM study + kappa Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
Week 3  mobile test + store Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
Week 4  quality + doc update Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
Week 5  report + demo script Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
Week 6  buffer + submission Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
```

---

## Ready-made viva answers

**"Where is the NLP?"**
> Normalisation and negation-aware matching, a curated paraphrase lexicon, intent
> extraction, synonym mapping, and a TF-IDF information-retrieval pass. It is
> classical rule-based NLP, chosen for determinism and auditability.

**"What is novel?"**
> Not the techniques Ã¢â‚¬â€ the **intervention point**. Every comparable tool evaluates
> an artefact. Vector evaluates **intent**, adds a **coverage metric**, and
> closes the loop with an interactive **harden-to-zero** prompt.

**"Wouldn't an LLM just do this?"**
> An LLM is used as an *optional second opinion* (deep scan). It is deliberately
> not the core, because the core must be deterministic, offline and auditable Ã¢â‚¬â€
> and because the literature shows prompt engineering alone is insufficient, so
> the tool positions as complementary to scanning.

**"Is it accurate?"**
> On the tuning sets, F1 = 1.000, but those prompts were used during development.
> The frozen held-out number is in `docs/eval-results.txt`. We report both.

**"What are the limits?"**
> AWS only. Rule-based recall has a ceiling on arbitrary paraphrase. It diagnoses
> prompts, not deployed posture, so it is a diagnostic aid, not a guarantee.

---

## Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Evaluation seen as overfit | High | High | Frozen held-out set + ÃŽÂº |
| No Mac for iOS | Medium | Medium | Expo Go + EAS cloud build |
| Store review delay | Medium | Low | Load unpacked for the demo |
| Scope creep | Medium | High | Secondary features explicitly deferrable |
| CORS blocks deep scan on the web demo | Certain | Low | Rule engine only on web; AI in extension/mobile |
| Time lost to UI polish | Medium | Medium | Docs and evidence take priority |

---

## Deliverables checklist

- [ ] Four documents finalised and committed
- [ ] Frozen evaluation results recorded
- [ ] LLM downstream study run
- [ ] Inter-annotator ÃŽÂº recorded
- [ ] Expo app verified on iOS and Android
- [ ] Store screenshots captured
- [ ] Edge listing live at the latest version
- [ ] Demo rehearsed
- [ ] Repository tagged `v1.0`
