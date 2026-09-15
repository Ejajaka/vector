# arXiv 2608.02672 — Security-First Evaluation of Text-to-Terraform

- Title: Security-First Evaluation of Text-to-Terraform: Benchmarking LLMs and
  SLMs for Secure IaC Generation
- Authors: Francis Luis Santos Vargas, Rodrigo Brandão Mansilha, Diego Kreutz
- Submitted: 2 Aug 2026
- Venue: accepted for publication at SBSeg 2026
- Subjects: cs.CR, cs.AI, cs.ET, cs.SE
- URL: https://arxiv.org/abs/2608.02672
- PDF: https://arxiv.org/pdf/2608.02672

## Abstract (as published)

> Cloud misconfiguration remains a leading cause of security incidents, yet
> whether LLMs and SLMs can generate security-compliant Infrastructure-as-Code
> is an open question. We benchmark seven models, three closed LLMs (Claude Opus
> 4, GPT-5.4, Gemini 2.5 Pro) and four open SLMs (Qwen2.5-Coder-14B,
> WizardCoder-33B, CodeLlama-13B, Magicoder-S-CL-7B), on AWS Terraform generation
> across 17 scenarios, integrating Checkov and Trivy scanners into a GitLab
> CI/CD pipeline and evaluating two prompt strategies at three security levels
> (pass@5). Syntactic validity and security compliance are largely orthogonal
> properties in LLM-generated IaC, a model that reliably produces well-formed
> Terraform does not necessarily produce secure Terraform: WizardCoder-33B
> achieves 77.8% validate rate yet zero Checkov compliance, while Claude Opus 4
> reaches 23.1% Checkov and 92.5% Trivy pass rates under detailed security
> prompting. Consequently, prompt engineering alone is insufficient: automated
> multi-tool scanning remains a necessary complement to LLM-assisted IaC
> generation regardless of model family or prompt strategy. All artifacts are
> publicly available.

## What supports Vector

- **"Syntactic validity and security compliance are largely orthogonal"** —
  direct evidence that valid IaC can be insecure.
- WizardCoder-33B: **77.8% validate rate, zero Checkov compliance.**
- Detailed security prompting improves compliance (Claude Opus 4: 23.1% Checkov,
  92.5% Trivy) — evidence that **better prompts change the security outcome**,
  which is the mechanism Vector relies on.

## What challenges Vector (must be acknowledged)

- **"Prompt engineering alone is insufficient"** and "automated multi-tool
  scanning remains a necessary complement." So a prompt-stage tool cannot be
  presented as a replacement for scanning.

## Positioning consequence

Frame Vector as **complementary and upstream**: it reduces the omissions that
downstream scanners later have to catch. Do not claim it makes scanning
unnecessary.
