# Vector Ã¢â‚¬â€ Market & Competitive Analysis

**Pre-Generation Security Diagnosis of Cloud Infrastructure Prompts Using NLP**
Version 0.5.7 Ã‚Â· AWS-only Ã‚Â· rule-based NLP Ã‚Â· fully offline

---

## 1. Purpose of this document

This document establishes **why Vector should exist** before describing **how it
works** (see `ARCHITECTURE.md`). It answers four questions:

1. Is the problem real and growing?
2. Who already addresses it, and at which stage of the pipeline?
3. Where exactly is the unoccupied space?
4. What is Vector's defensible position, and what is honestly not defensible?

---

## 2. The problem, evidenced

### 2.1 Infrastructure is increasingly generated, not written

- Sonar's 2026 State of Code survey reports **42% of committed code is written or
  assisted by an AI agent**, projected to reach **65% by 2027**.
- The same agents now scaffold Terraform, author resource blocks and fill IAM
  policies on the fly.

### 2.2 Generated IaC is frequently insecure even when it is valid

| Study | Venue | Finding |
|---|---|---|
| **IaC-Eval** | NeurIPS 2024 (Datasets & Benchmarks) | GPT-4 **pass@1 = 19.36%** on 458 human-curated AWS Terraform scenarios, vs 86.6% on equivalent Python |
| **DPIaC-Eval** | FSE 2026 | 6 frontier LLMs, 153 real-world IaC tasks: **20.8Ã¢â‚¬â€œ30.2%** first-attempt deployment success, **8.4%** Checkov compliance |
| **TerraFormer** | ICSE 2026 | 17 frontier LLMs; HCL is harder than YAML/JSON IaC because it is less represented in training data |
| **Security-First Evaluation of Text-to-Terraform** | SBSeg 2026 (arXiv 2608.02672) | "Syntactic validity and security compliance are largely orthogonal" Ã¢â‚¬â€ WizardCoder-33B reached **77.8% validate rate with zero Checkov compliance** |

### 2.3 The failure modes are exactly omission-shaped

Sonar's analysis *"AI is writing more of your Terraform"* names four recurring
failure modes, and the first two map directly onto Vector's taxonomy:

1. **The reach-for-`*` problem** Ã¢â‚¬â€ wildcard IAM, public S3 ACLs, security groups
   open to `0.0.0.0/0`. *Reason given:* "restrictive configurations need boundary
   context that **the prompt rarely supplies**."
2. **The silent omission problem** Ã¢â‚¬â€ `aws_db_instance` without
   `storage_encrypted`, CloudFront without `logging_config`. The resource comes
   up; the protection does not.
3. Hardcoded secrets and literals.
4. Stale provider patterns (deprecated attributes).

### 2.4 Post-hoc verification does not catch any of this

> "`terraform validate` checks that your HCL is syntactically validÃ¢â‚¬Â¦ It does not
> validate remote services." / "`terraform plan` previews the state deltaÃ¢â‚¬Â¦ but it
> doesn't evaluate whether the resulting configuration is secure."

> "A syntactically perfect `aws_s3_bucket` with a public ACL passes both."

**Conclusion:** the gap Vector targets Ã¢â‚¬â€ *security requirements absent from the
natural-language intent* Ã¢â‚¬â€ is documented, measured, and causally linked to real
misconfiguration.

---

## 3. Competitive landscape by pipeline stage

The decisive organising idea is **where in the pipeline a tool intervenes.**

```
  (1) INTENT          (2) GENERATION        (3) PLAN / CODE        (4) DEPLOYED
  the prompt          the LLM writes        the artefact exists    the account
 Ã¢â€Å’Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€Â       Ã¢â€Å’Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€Â         Ã¢â€Å’Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€Â          Ã¢â€Å’Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€Â
 Ã¢â€â€š  VECTOR   Ã¢â€â€š  -->  Ã¢â€â€š Copilot,  Ã¢â€â€š  --->   Ã¢â€â€š Checkov,  Ã¢â€â€š  ---->   Ã¢â€â€š AWS ConfigÃ¢â€â€š
 Ã¢â€â€š           Ã¢â€â€š       Ã¢â€â€š Q Dev,    Ã¢â€â€š         Ã¢â€â€š tfsec,    Ã¢â€â€š          Ã¢â€â€š Security  Ã¢â€â€š
 Ã¢â€â€š           Ã¢â€â€š       Ã¢â€â€š ChatGPT.. Ã¢â€â€š         Ã¢â€â€š SonarQube Ã¢â€â€š          Ã¢â€â€š Hub, etc. Ã¢â€â€š
 Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€Ëœ       Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€Ëœ         Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€Ëœ          Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€Ëœ
   nothing here         insecure by          catches it AFTER       catches it in
   (today)              default              it exists              production
```

### 3.1 Stage 1 Ã¢â‚¬â€ Intent (the prompt) Ã‚Â· **Vector**

| Player | What it does | Why it is not Vector |
|---|---|---|
| **Prompt optimisers** Ã¢â‚¬â€ PromptPerfect, Promptfoo, IDE "improve prompt" | Improve clarity/length/quality of a prompt | Optimise for *task performance*, not **security completeness** |
| **LLM guardrails** Ã¢â‚¬â€ Lakera Guard, NeMo Guardrails, Prompt Shields | Block injection, jailbreaks, unsafe content | Defends the **model**, not the **infrastructure being described** |
| **Cloud provider prompt tooling** | General assistant behaviour | No standards-grounded security taxonomy |

**No deployed product was found that analyses a prompt for missing
cloud-security controls against a standards taxonomy.** We state this as "to our
knowledge, this specific niche is unoccupied," not as a proven absence.

### 3.2 Stage 2 Ã¢â‚¬â€ Generation Ã‚Â· adjacent, wrong stage

| Player | Relevance |
|---|---|
| **Amazon Q Developer** | Generates CloudFormation/CDK *and* scans the result Ã¢â‚¬â€ but only **after** generation |
| **GitHub Copilot** (+ code scanning / Autofix) | Writes Terraform; findings arrive on the generated code |
| **Gemini Code Assist**, **Terraform's AI features** | Same shape |

These share Vector's **user and problem** but act **downstream**. They are the
natural integration partners, not competitors.

### 3.3 Stage 3 Ã¢â‚¬â€ Plan / artefact Ã‚Â· the closest functional neighbours

| Player | Stage | Difference |
|---|---|---|
| **Checkov** (Prisma Cloud) | static scan of IaC | judges written code; no prompt awareness |
| **tfsec** (now Trivy) | static scan | same |
| **KICS** (Checkmarx), **Terrascan**, **cfn-nag** | static scan | same |
| **Snyk IaC** | static scan | same |
| **SonarQube IaC** | AST analysis of Terraform/ARM/CFN | same; explicitly post-generation |
| **HashiCorp Sentinel**, **OPA / Conftest**, **Firefly**, **Spacelift**, **env0** | policy-as-code at plan time | shift-left, but policy applies to the **artefact**, and the user must author the policy |

**These are Vector's true comparison set** Ã¢â‚¬â€ all "secure the IaC" Ã¢â‚¬â€ and all work
on something that **already exists**.

### 3.4 Stage 4 Ã¢â‚¬â€ Deployed Ã‚Â· out of scope

**AWS Config, Security Hub, GuardDuty, Prowler** Ã¢â‚¬â€ detect drift and misconfiguration
in a running account. Vector explicitly does not replace them; it reduces what
reaches them.

---

## 4. Positioning

### 4.1 The one-sentence position

> Vector performs **security diagnosis at the natural-language infrastructure
> prompt stage, before any IaC is generated** Ã¢â‚¬â€ identifying omitted controls
> against a standards-grounded taxonomy, quantifying coverage, and interactively
> hardening the prompt.

### 4.2 Capability matrix

| Capability | Prompt optimisers | Guardrails | Q Dev / Copilot | Checkov / tfsec / Sonar | Plan-time policy | **Vector** |
|---|---|---|---|---|---|---|
| Acts before generation | Ã¢Å“â€¦ | Ã¢Å“â€¦ | Ã¢ÂÅ’ | Ã¢ÂÅ’ | Ã¢ÂÅ’ | **Ã¢Å“â€¦** |
| Cloud-security semantics | Ã¢ÂÅ’ | Ã¢ÂÅ’ | Ã¢Å¡Â Ã¯Â¸Â post-hoc | Ã¢Å“â€¦ | Ã¢Å“â€¦ | **Ã¢Å“â€¦** |
| Standards-grounded taxonomy | Ã¢ÂÅ’ | Ã¢ÂÅ’ | Ã¢Å¡Â Ã¯Â¸Â | Ã¢Å“â€¦ | Ã¢ÂÅ’ | **Ã¢Å“â€¦** |
| No policy authoring required | Ã¢Å“â€¦ | Ã¢Å“â€¦ | Ã¢Å“â€¦ | Ã¢Å“â€¦ | Ã¢ÂÅ’ | **Ã¢Å“â€¦** |
| Coverage metric for a prompt | Ã¢ÂÅ’ | Ã¢ÂÅ’ | Ã¢ÂÅ’ | Ã¢ÂÅ’ | Ã¢ÂÅ’ | **Ã¢Å“â€¦** |
| Interactive prompt hardening | Ã¢ÂÅ’ | Ã¢ÂÅ’ | Ã¢ÂÅ’ | Ã¢ÂÅ’ | Ã¢ÂÅ’ | **Ã¢Å“â€¦** |
| Works offline / no account | Ã¢Å¡Â Ã¯Â¸Â | Ã¢Å¡Â Ã¯Â¸Â | Ã¢ÂÅ’ | Ã¢Å“â€¦ | Ã¢Å¡Â Ã¯Â¸Â | **Ã¢Å“â€¦** |
| Deterministic & explainable | Ã¢ÂÅ’ | Ã¢ÂÅ’ | Ã¢ÂÅ’ | Ã¢Å“â€¦ | Ã¢Å“â€¦ | **Ã¢Å“â€¦** |

### 4.3 Where Vector does **not** compete

- It does **not** generate infrastructure code.
- It does **not** replace IaC scanners. arXiv 2608.02672 explicitly concludes
  that *"prompt engineering alone is insufficient"* and that scanning remains
  necessary. Vector positions as **upstream and complementary**.
- It does **not** read live cloud accounts.
- It is **AWS-only**; Azure/GCP prompts receive a warning, not results.

---

## 5. Target users

| Persona | Pain | Vector's value |
|---|---|---|
| **Developer using an LLM for Terraform** | Doesn't know which controls to state | Instant list of omissions + one-tap hardened prompt |
| **Junior / student team** | No cloud-security background | Plain-language findings with standards references |
| **Platform / DevOps team** | Inconsistent prompts across the org | Org policy packs + CLI/CI gate on prompt files |
| **Security reviewer** | Reviews intent late and manually | Machine-readable coverage before generation |

---

## 6. Differentiation summary

1. **Intervention point.** Every comparable product evaluates an artefact.
   Vector evaluates **intent**.
2. **Prompt Security Coverage Score.** A metric no adjacent tool produces:
   `mentioned / required`, shown before and after hardening
   (e.g. **risk 100 Ã¢â€ â€™ 0, coverage 0% Ã¢â€ â€™ 100%**).
3. **Interactive harden-to-zero.** Not just "you missed X" but a rewritten prompt
   that re-analyses clean.
4. **Determinism and auditability.** Same prompt Ã¢â€ â€™ same report. No sampling, no
   hallucination on the rule path.
5. **Zero-friction distribution.** Offline, no account, no backend; extension,
   CLI, mobile and a public web demo sharing one engine.

---

## 7. Honest weaknesses against the market

| Weakness | Reality | Mitigation |
|---|---|---|
| Recall ceiling | Rules miss arbitrary paraphrase | Optional AI deep scan; limitation documented |
| AWS-only | No Azure/GCP | Deliberate scope; warning instead of misleading output |
| Not a proof of safety | Diagnoses *prompts*, not deployed posture | Positioned as a diagnostic aid, complementing scanners |
| Big vendors could absorb it | IaC scanning is a feature for Snyk/Sonar/Prisma | Moat is the **prompt-stage metric and workflow**, and speed |
| Evaluation is small | 112 labelled prompts, tuned | Frozen held-out set + LLM downstream study planned |

---

## 8. References

- Sonar, *AI is writing more of your Terraform* (2026) Ã¢â‚¬â€
  https://www.sonarsource.com/blog/ai-is-writing-more-of-your-terraform/
- Vargas, Mansilha, Kreutz, *Security-First Evaluation of Text-to-Terraform*,
  SBSeg 2026 Ã¢â‚¬â€ https://arxiv.org/abs/2608.02672
- *IaC-Eval*, NeurIPS 2024 Datasets & Benchmarks Track
- *DPIaC-Eval*, FSE 2026 Ã¢â‚¬â€ https://arxiv.org/abs/2506.05623
- *TerraFormer*, ICSE 2026 Ã¢â‚¬â€ https://arxiv.org/abs/2601.08734
- CIS AWS Foundations Benchmark v3.0 Ã‚Â· AWS Well-Architected (Security Pillar) Ã‚Â·
  AWS Foundational Security Best Practices Ã‚Â· NIST SP 800-53 Rev.5 Ã‚Â·
  GDPR Art. 5/32 Ã‚Â· India DPDP Act 2023

Full extracts and the positioning caution are stored in `references/`.
