# Vector Ã¢â‚¬â€ Course Plan Mapping

**Pre-Generation Security Diagnosis of Cloud Infrastructure Prompts Using NLP**

> Maps the project onto a standard **Natural Language Processing** course
> syllabus. Adjust the module names on the left to match your official course
> plan Ã¢â‚¬â€ the right-hand column is what Vector actually demonstrates.

---

## 1. Summary

Vector is a **classical NLP application**: text normalisation, tokenisation,
morphological handling, pattern-based information extraction, negation scope
resolution, a curated lexical resource, and an information-retrieval pass
(TF-IDF + cosine). It deliberately avoids neural methods so that every result is
deterministic and explainable.

| Course area | Covered by Vector | Where in the code |
|---|---|---|
| Text preprocessing | tokenisation, normalisation, stopwords | `src/analyzer.js` steps 1Ã¢â‚¬â€œ2 |
| Lexical resources | synonyms, paraphrase lexicon, negation lexicon | `src/taxonomy.js` |
| Morphology | light stemming in the IR pass | `src/semantic.js` |
| Information extraction | resource + control (entity/attribute) extraction | `src/analyzer.js` steps 6, 10 |
| Negation & scope | 3-guard negation algorithm | `src/analyzer.js` `isNegatedBefore/After` |
| Information retrieval | TF-IDF index, cosine similarity | `src/semantic.js` |
| Text classification | resource Ã¢â€ â€™ control-set mapping | `src/taxonomy.js` `RESOURCES` |
| Evaluation of NLP systems | precision, recall, F1, negation-trap rate, ÃŽÂº | `eval/` |
| Applications of NLP | applied security diagnosis tool | whole project |

---

## 2. Module-by-module mapping

*(Rename the left column to your syllabus wording.)*

### Module 1 Ã¢â‚¬â€ Introduction to NLP and text processing
| Learning outcome | How Vector meets it |
|---|---|
| Explain the NLP pipeline | `ARCHITECTURE.md` Ã‚Â§4 documents an 18-step pipeline |
| Perform basic text preprocessing | `normalize()` + `tokenize()` with a stopword list |
| Handle noisy real-world text | negation-prefix fixup, punctuation stripping, whitespace collapse |

### Module 2 Ã¢â‚¬â€ Lexical semantics and lexical resources
| Learning outcome | How Vector meets it |
|---|---|
| Build/use a lexical resource | `SYNONYMS` (19 entries), `PARAPHRASES` (13 control lexicons), `NEGATION_WORDS` (~40 cues) |
| Handle synonymy | "website" Ã¢â€ â€™ ec2/load balancer; "scrambled on disk" Ã¢â€ â€™ encryption at rest |
| Discuss limitations of hand-built lexicons | documented recall ceiling; negative TF-IDF result in `ARCHITECTURE.md` Ã‚Â§3 step 16 |

### Module 3 Ã¢â‚¬â€ Morphology
| Learning outcome | How Vector meets it |
|---|---|
| Apply stemming/lemmatisation | light suffix stripping in `semantic.tokenize()` |
| Explain stemming trade-offs | discussed in `tools/calibrate.js` analysis |

### Module 4 Ã¢â‚¬â€ Part-of-speech, syntax, and *negation scope*
| Learning outcome | How Vector meets it |
|---|---|
| Handle negation correctly | the **three-guard** algorithm: `before` (odd-count negation in the clause), `after` ("logging disabled"), `notAfter` ("encryption in transit" Ã¢â€°Â  at rest) |
| Clause segmentation | split on punctuation **and** discourse cues: `and, but, or, except, unless, rather than, instead of` |
| Explain why negation is hard | worked examples in `ARCHITECTURE.md` Ã‚Â§3 step 10 |

### Module 5 Ã¢â‚¬â€ Information extraction
| Learning outcome | How Vector meets it |
|---|---|
| Extract entities | `detectResources()` Ã¢â‚¬â€ 78 AWS resources, phrase + regex aliases |
| Extract attributes/relations | resource Ã¢â€ â€™ required-control mapping |
| Design an extraction pattern set | `REQUIREMENTS[].patterns` (30 controls Ãƒâ€” multiple regex each) |

### Module 6 Ã¢â‚¬â€ Text classification
| Learning outcome | How Vector meets it |
|---|---|
| Rule-based classification | requirement *present / missing* decision |
| Feature-based classification | severity + tier weighting feeding the risk score |
| Evaluate a classifier | P/R/F1 in `eval/run-eval.js` |

### Module 7 Ã¢â‚¬â€ Information retrieval / vector space models
| Learning outcome | How Vector meets it |
|---|---|
| Build a TF-IDF index | `semantic.buildIndex()` over control documents |
| Compute cosine similarity | `semantic.cosine()` |
| Interpret and critique the model | **measured and reported**: cosine is polarity-blind, so it is restricted to advisory relevance, never compliance |

### Module 8 Ã¢â‚¬â€ Evaluation of NLP systems
| Learning outcome | How Vector meets it |
|---|---|
| Compute precision, recall, F1 | `eval/run-eval.js` over 112 labelled prompts |
| Design a labelled dataset | `dataset.json`, `dataset2.json`, `heldout.json` |
| Measure annotator agreement | Cohen's ÃŽÂº in `eval/kappa.js` |
| Report limitations honestly | "all 112 prompts were seen during development" note |

### Module 9 Ã¢â‚¬â€ Applications / project work
| Learning outcome | How Vector meets it |
|---|---|
| Build an end-to-end NLP application | engine + extension + CLI + two mobile apps + web demo |
| Deploy an NLP system | Edge Add-ons listing, GitHub Pages demo, installable APK |
| Address ethics/privacy | fully offline core; no account, no telemetry; opt-in AI only |

---

## 3. Course-plan deliverables cross-reference

| Typical requirement | Vector artefact |
|---|---|
| Problem statement & motivation | `MARKET-ANALYSIS.md` Ã‚Â§2 + benchmarks |
| Literature / prior art | `MARKET-ANALYSIS.md` Ã‚Â§3, `references/` |
| System design | `ARCHITECTURE.md` Ã‚Â§1Ã¢â‚¬â€œÃ‚Â§7 |
| Methodology | `ARCHITECTURE.md` Ã‚Â§4 (18-step pipeline) + Ã‚Â§5 (scoring) |
| Implementation | `src/`, `extension/`, `cli/`, `mobile-expo/`, `mobile-native/` |
| Evaluation & results | `eval/`, results table in Ã‚Â§4 below |
| Novelty statement | "intervention point" framing Ã¢â‚¬â€ `MARKET-ANALYSIS.md` Ã‚Â§6 |
| Limitations & future work | `ARCHITECTURE.md` Ã‚Â§10, `ROADMAP.md` risks |
| Demo | web demo link + extension + Expo app |
| Report | the four Word documents in `docs/` |

---

## 4. Evidence table (fill final numbers before submission)

| Metric | Value | Source |
|---|---|---|
| Labelled prompts (tuning) | 98 | `dataset.json` (39) + `dataset2.json` (59) |
| Labelled prompts (earlier held-out) | 14 | `heldout.json` |
| Missing-constraint F1 | 1.000* | `npm run eval` |
| Risky-statement F1 | 1.000* | `npm run eval` |
| Negation-trap failures | 0 | `npm run eval` |
| Unit tests | 63 | `npm test` |
| Downstream: insecure Ã¢â€ â€™ hardened Terraform | 6 Ã¢â€ â€™ 0 issues | `npm run downstream` |
| Frozen held-out F1 | *run in Week 1* | `docs/eval-results.txt` |
| LLM study: raw Ã¢â€ â€™ hardened | *run in Week 2* | `npm run study` |
| Inter-annotator ÃŽÂº | *run in Week 2* | `npm run kappa` |

\* indicative only Ã¢â‚¬â€ the sets were used during development. Replace with the
frozen number before submission, and report both.

---

## 5. Mapping to Bloom-style outcomes

| Level | Demonstration |
|---|---|
| **Remember / Understand** | explains the NLP pipeline and why each stage exists |
| **Apply** | applies preprocessing, extraction and IR to a new domain (cloud security) |
| **Analyse** | decomposes prompts into resources and controls; isolates negation scope |
| **Evaluate** | measures P/R/F1, negation traps, ÃŽÂº; reports a *negative* result about TF-IDF |
| **Create** | builds a deployed multi-surface NLP system with a novel metric and workflow |

---

## 6. What this mapping deliberately does **not** claim

- **No neural NLP.** No embeddings, no transformer training. Stated openly.
- **No model training.** The AI component uses an existing model as an optional
  second opinion.
- **No claim of state-of-the-art accuracy.** The evaluation is small and honest
  about it.

Being explicit about scope is itself part of the evaluation outcome: the project
demonstrates *understanding the limits of the chosen NLP techniques*.
