# Sonar — "AI is Writing More of Your Terraform"

- Author: Taylor Luttrell-Williams (Sonar)
- Date: 18 June 2026
- URL: https://www.sonarsource.com/blog/ai-is-writing-more-of-your-terraform/
- Retrieved: for the Vector project reference folder

## Why it supports Vector's premise

The article documents how AI coding agents generate Infrastructure as Code that
is syntactically valid but insecure, and names failure modes that match Vector's
taxonomy.

## Four failure modes

1. **The reach-for-`*` problem** — permissive defaults: wildcard IAM, public S3
   ACLs, security groups open to `0.0.0.0/0` on SSH/RDP.
   > "Restrictive configurations need boundary context that the prompt rarely
   > supplies; permissive defaults satisfy the immediate request and ship."

2. **The silent omission problem** — resources that appear complete but skip
   security blocks:
   > "`aws_db_instance` without `storage_encrypted`, `aws_cloudfront_distribution`
   > without a `logging_config` block"

3. **The hardcoded-everything problem** — literal secrets in `*.tf`/`*.tfvars`.

4. **The stale-training-data problem** — deprecated attributes (e.g. inline S3
   `acl` in provider v4 vs. the separate resource in v5).

## Why existing checks miss it

> "`terraform validate` checks that your HCL is syntactically valid... It does
> not validate remote services." / "`terraform plan` previews the state delta...
> but it doesn't evaluate whether the resulting configuration is secure."

> "A syntactically perfect `aws_s3_bucket` with a public ACL passes both."

## Numbers cited (useful for the report)

- Sonar 2026 State of Code survey: **42% of committed code is written/assisted by
  an AI agent**, expected 65% by 2027.
- IaC-Eval (NeurIPS 2024): GPT-4 **pass@1 = 19.36%** on 458 human-curated AWS
  Terraform scenarios (vs 86.6% on equivalent Python).
- DPIaC-Eval (FSE 2026): 6 frontier LLMs, 153 IaC tasks; first-attempt deployment
  success **20.8–30.2%**, Checkov compliance **8.4%**.
- TerraFormer (ICSE 2026): HCL is harder for LLMs than YAML/JSON IaC.

## Caveat for our positioning

The article's answer is **post-generation** scanning (SonarQube parses HCL into
an AST and applies rules). That is prior art, and it is downstream of the prompt.
Vector sits earlier. Do not claim Vector replaces such scanners.
