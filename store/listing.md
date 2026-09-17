# Chrome Web Store listing

Use this text in the Developer Dashboard when creating the listing.

## Name (max 45 chars)
Vector - Cloud Prompt Security

## Short description (max 132 chars)
Find missing AWS security controls in your infrastructure prompts before code generation. One-click fix clauses. Runs offline.

## Category
Developer Tools

## Language
English

## Detailed description

Vector checks a natural-language AWS infrastructure prompt BEFORE code is
generated and tells you which security controls the prompt forgot to mention —
then lets you add each one with a single click.

Large language models happily produce Terraform or CloudFormation that is valid
but insecure, because the prompt described what you wanted and left out things
like encryption, IAM least privilege, public-access blocking, audit logging and
data residency. Post-deployment scanners catch that too late. Vector moves the
check to the point of intent: the prompt.

HOW IT WORKS
- Rule-based NLP runs fully offline. No account, no sign-in, no data collection.
- 78 AWS resources and 30 security controls, grounded in CIS AWS, AWS
  Well-Architected, AWS Foundational Security Best Practices and NIST SP 800-53.
- Detects missing controls AND risky statements (0.0.0.0/0, public buckets,
  wildcard IAM, hard-coded secrets, disabled logging).
- Understands negation: "do not make it public" is not treated as public.
- Gives a risk score and a confidence score.

WHAT YOU GET
- A risk panel listing missing controls, each with a ready-to-add clause.
- One-click "Add clause" to build an improved prompt.
- Copy the hardened prompt into your AI tool of choice.
- Works in the toolbar popup, or in-page on supported AI chat sites via a
  floating button.
- Optional organisation policy (paste your own JSON rules).
- Optional AI deep scan for unusual prompts: uses Chrome's built-in on-device
  model when available (no key, no network), or your own API key if you prefer.

PRIVACY
- The rule engine is fully local. Nothing is uploaded.
- Deep scan is off unless you run it. With the on-device model it also stays
  local. With a hosted provider you supply, only the prompt text is sent, to the
  endpoint you configured.

Not affiliated with Amazon Web Services. Appropriate for prompts intended to
generate AWS infrastructure.

## Support / homepage (optional)
(Add your project page or GitHub URL if you have one.)
