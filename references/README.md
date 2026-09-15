# References

Sources relevant to Vector's problem statement (pre-generation security
diagnosis for AI-generated cloud infrastructure). Kept here for the report and
viva.

## Directly supporting the problem

| Source | URL | Why it matters |
|---|---|---|
| Sonar, "AI is writing more of your Terraform" (Jun 2026) | https://www.sonarsource.com/blog/ai-is-writing-more-of-your-terraform/ | Documents four failure modes, incl. **silent omission** (missing encryption/logging) and **permissive defaults** (wildcard IAM, public S3, 0.0.0.0/0). Says `terraform validate`/`plan` cannot catch these. |
| Vargas, Mansilha, Kreutz, "Security-First Evaluation of Text-to-Terraform" (arXiv 2608.02672, SBSeg 2026) | https://arxiv.org/abs/2608.02672 | Shows LLM/SLM-generated AWS Terraform is often insecure despite being valid; **"syntactic validity and security compliance are largely orthogonal."** |

Saved summaries: `sonar-ai-writing-terraform.md`, `arxiv-2608.02672.md`.

## Benchmarks cited by the above

| Benchmark | Venue | URL |
|---|---|---|
| IaC-Eval (GPT-4 pass@1 19.36% on 458 AWS Terraform scenarios) | NeurIPS 2024 Datasets & Benchmarks | https://proceedings.neurips.cc/paper_files/paper/2024/hash/f26b29298ae8acd94bd7e839688e329b-Abstract-Datasets_and_Benchmarks_Track.html |
| DPIaC-Eval (first-attempt 20.8-30.2%; 8.4% Checkov compliance) | FSE 2026 | https://arxiv.org/abs/2506.05623 |
| TerraFormer (17 frontier LLMs; HCL harder than YAML/JSON) | ICSE 2026 | https://arxiv.org/abs/2601.08734 |

## Unverified

| Source | URL | Note |
|---|---|---|
| eurekamag aggregator entry 109996961 | https://eurekamag.com/research/109/996/109996961.php | Returns HTTP 403; aggregator, not the primary source. Find the original DOI before citing. |

## How to position the project (important)

- The sources above support the **problem** (AI-generated IaC is insecure; prompts
  omit security constraints). They do **not** prove that pre-generation diagnosis
  is novel or sufficient.
- arXiv 2608.02672 explicitly concludes that **prompt engineering alone is
  insufficient** and that post-generation scanning remains necessary.
- Therefore Vector must be presented as **complementary**, not a replacement:

> "Recent work shows AI-generated Terraform is often insecure and that prompt
> engineering alone is insufficient; post-generation scanning is necessary.
> Vector complements that by diagnosing missing security constraints at the
> prompt stage, before generation, with an explainable offline engine and a
> coverage metric."

Do **not** claim that diagnosing the prompt removes the need for IaC scanners.
