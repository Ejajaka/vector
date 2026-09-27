"use strict";

/**
 * Build Word documents (.docx) for Vector: a feature list and a detailed
 * pipeline. A .docx is just a ZIP of XML parts, so we generate the parts and
 * zip them. No dependencies.
 *
 * Run:  node tools/make-docx.js
 */

const fs = require("fs");
const os = require("os");
const path = require("path");

// ---------------------------------------------------------------- ZIP writer
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function zip(files) {
  const local = [];
  const central = [];
  let offset = 0;
  for (const f of files) {
    const name = Buffer.from(f.name, "utf8");
    const data = Buffer.from(f.data, "utf8");
    const crc = crc32(data);

    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0);
    lh.writeUInt16LE(20, 4);
    lh.writeUInt16LE(0, 8);
    lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(data.length, 18);
    lh.writeUInt32LE(data.length, 22);
    lh.writeUInt16LE(name.length, 26);
    local.push(lh, name, data);

    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0);
    ch.writeUInt16LE(20, 4);
    ch.writeUInt16LE(20, 6);
    ch.writeUInt32LE(crc, 16);
    ch.writeUInt32LE(data.length, 20);
    ch.writeUInt32LE(data.length, 24);
    ch.writeUInt16LE(name.length, 28);
    ch.writeUInt32LE(offset, 42);
    central.push(ch, name);

    offset += 30 + name.length + data.length;
  }
  const cd = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(cd.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([Buffer.concat(local), cd, end]);
}

// --------------------------------------------------------- OOXML paragraphs
function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function para(b) {
  let before = 0;
  let after = 100;
  let rpr = "";
  let ind = "";
  let text = b.text || "";

  if (b.type === "title") {
    rpr = '<w:rPr><w:b/><w:sz w:val="40"/><w:szCs w:val="40"/></w:rPr>';
    after = 200;
  } else if (b.type === "sub") {
    rpr = '<w:rPr><w:i/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr>';
    after = 220;
  } else if (b.type === "h1") {
    rpr = '<w:rPr><w:b/><w:sz w:val="30"/><w:szCs w:val="30"/><w:color w:val="1F3864"/></w:rPr>';
    before = 260;
    after = 120;
  } else if (b.type === "h2") {
    rpr = '<w:rPr><w:b/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr>';
    before = 180;
    after = 80;
  } else if (b.type === "code") {
    rpr = '<w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/><w:sz w:val="18"/><w:szCs w:val="18"/><w:color w:val="333333"/></w:rPr>';
    after = 0;
  } else if (b.type === "bullet") {
    rpr = '<w:rPr><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr>';
    const lvl = b.level || 0;
    ind = '<w:ind w:left="' + (360 + lvl * 360) + '" w:hanging="360"/>';
    text = (b.level ? "\u2013 " : "\u2022 ") + text;
    after = 60;
  } else {
    rpr = '<w:rPr><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr>';
  }

  return (
    "<w:p><w:pPr>" +
    '<w:spacing w:before="' + before + '" w:after="' + after + '"/>' +
    ind +
    "</w:pPr>" +
    "<w:r>" + rpr + '<w:t xml:space="preserve">' + esc(text) + "</w:t></w:r></w:p>"
  );
}

function buildDocx(blocks) {
  const documentXml =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' +
    blocks.map(para).join("") +
    '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>' +
    '<w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr>' +
    "</w:body></w:document>";

  const contentTypes =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
    "</Types>";

  const rels =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
    "</Relationships>";

  return zip([
    { name: "[Content_Types].xml", data: contentTypes },
    { name: "_rels/.rels", data: rels },
    { name: "word/document.xml", data: documentXml }
  ]);
}

const T = (text) => ({ type: "title", text });
const S = (text) => ({ type: "sub", text });
const H1 = (text) => ({ type: "h1", text });
const H2 = (text) => ({ type: "h2", text });
const P = (text) => ({ type: "p", text });
const C = (text) => ({ type: "code", text });
const LI = (text, level) => ({ type: "bullet", text, level: level || 0 });

// ============================================================== FEATURES DOC
const FEATURES = [
  T("Vector - Feature List"),
  S("Pre-Generation Security Diagnosis of Cloud Infrastructure Prompts (AWS). Rule-based NLP, fully offline."),

  H1("1. Core analysis features"),
  LI("Natural-language prompt analysis - accepts a plain-English AWS infrastructure prompt."),
  LI("Resource detection - recognises 78 AWS services (S3, EC2, RDS, Lambda, IAM, EKS, DynamoDB, CloudFront, WAF, KMS, and more), including synonyms and regex aliases."),
  LI("Security requirement detection - recognises controls already stated in the prompt."),
  LI("Missing-constraint detection - flags omitted controls such as encryption, IAM scope, public access, audit logging, data residency, backups and key rotation."),
  LI("Risky-statement detection - catches 0.0.0.0/0, public buckets, wildcard/admin IAM, hard-coded secrets, and disabled logging / backups / MFA."),
  LI("Negation handling - \"do not make it public\" is not treated as public; double negatives are handled (\"not unencrypted\" = encrypted)."),
  LI("Standards-grounded taxonomy - 30 controls mapped to CIS AWS, AWS Well-Architected, AWS Foundational Security Best Practices, NIST SP 800-53 and GDPR / DPDP."),
  LI("Risk score - 0-100 with CRITICAL / HIGH / MEDIUM / LOW."),
  LI("Confidence score - 0-100 (high / medium / low) indicating how complete the analysis is."),
  LI("Baseline mode - unrecognised prompts still receive baseline AWS controls; never returns an empty result."),
  LI("Prompt Security Coverage Score - the share of required controls the prompt already states, shown before and after hardening."),
  LI("TF-IDF semantic relevance - a classic NLP / information-retrieval pass that reports topically related controls (offline, no model)."),
  LI("Paraphrase lexicon - a curated, polarity-safe list of alternative phrasings per control (for example \"scrambled on disk\" -> encryption at rest, \"who did what\" -> audit logging)."),
  LI("Non-AWS guard - warns when a prompt targets Azure or GCP instead of silently applying AWS rules."),
  LI("Advisory disclaimer - results are presented as a diagnostic aid, not a guarantee, and the prompt stays AWS-scoped."),
  LI("One-tap Harden - neutralises risky phrasing and appends missing clauses until the prompt re-analyses to risk 0 / coverage 100%."),
  LI("Scope guard - input with no infrastructure signal is rejected instead of being scored."),
  LI("Targeted recommendations - each finding explained in plain language, with standards references and the resource it applies to."),
  LI("One-click \"Add clause\" - every missing control becomes a ready-to-add clause."),
  LI("Fillable / improved prompt - builds the hardened prompt live as clauses are accepted."),
  LI("Copy improved prompt."),

  H1("2. Integration features"),
  LI("Toolbar popup UI - type or paste a prompt and analyse it."),
  LI("In-page floating button on ChatGPT, Claude and Gemini - analyses the text already in the chat composer."),
  LI("Options page - settings, organisation policy and history."),
  LI("CLI - analyze, analyze-file, improved, hook, with --json, --strict and --policy."),
  LI("CI hook - non-zero exit code on HIGH or CRITICAL findings."),
  LI("Analysis history - last 20 analyses stored locally."),
  LI("Custom organisation policy - paste JSON rules for always-required controls and banned patterns."),
  LI("Strict mode - treats medium-severity omissions as high."),

  H1("3. Optional AI features"),
  LI("Optional deep scan - off by default."),
  LI("On-device tier - uses the browser's built-in model (Gemini Nano) with no API key and no network."),
  LI("Hosted tier - any OpenAI-compatible endpoint, using the user's own API key."),
  LI("Source badges - every finding is marked as rule-based or AI."),
  LI("Auto deep scan - runs automatically when rule confidence is low."),

  H1("4. Privacy and safety"),
  LI("No sign-in, no account, no backend server."),
  LI("Fully offline rule engine; nothing is uploaded."),
  LI("Only two permissions requested: storage and clipboardWrite."),
  LI("Host access is limited to four AI chat sites and the optional API endpoint."),

  H1("5. Quality assurance"),
  LI("29 unit tests covering the engine, the renderer and the deep-scan client."),
  LI("Evaluation harness over 112 hand-labelled AWS prompts, reporting precision, recall, F1 and negation-trap accuracy."),
  LI("Downstream proof - insecure versus hardened Terraform, 6 issues reduced to 0."),
  LI("One-command packaging script for the browser store.")
];

// ============================================================== PIPELINE DOC
const PIPELINE = [
  T("Vector - Detailed Analysis Pipeline"),
  S("Rule-based NLP pipeline for pre-generation security diagnosis of AWS prompts."),

  H1("1. Overall flow"),
  C("user types prompt"),
  C("        |"),
  C("        v"),
  C("   VECTOR (pre-generation)"),
  C("        |  diagnosis + fillable clauses"),
  C("        v"),
  C("   improved prompt  --->  LLM generates Terraform / CloudFormation"),

  H1("2. Engine pipeline (src/analyzer.js)"),
  P("The engine is deterministic and offline. It runs the same way in the extension, the options page and the CLI."),

  H2("Step 1 - Normalisation"),
  P("Lowercase the text, unify negation prefixes, remove quotes and collapse whitespace."),
  C("input : \"Store data UNENCRYPTED in the S3 bucket\""),
  C("output: \"store data not encrypted in the s3 bucket\""),

  H2("Step 2 - Tokenisation"),
  P("Split on non-alphanumeric characters and drop stopwords. Tokens are used for length-based confidence and reported in the output."),

  H2("Step 3 - Synonym expansion"),
  P("Everyday words are mapped to canonical AWS nouns so detection fires even without product names."),
  C("\"website\"        -> ec2, load balancer"),
  C("\"object storage\" -> s3"),
  C("\"relational db\"  -> rds"),
  C("\"serverless\"     -> lambda"),
  C("\"container\"      -> kubernetes / eks"),

  H2("Step 4 - Intent detection"),
  P("Verb groups are matched: create, deploy, store, allow, restrict, secure, connect, backup, monitor. Intents are reported for context."),

  H2("Step 4b - Control paraphrase lexicon"),
  P("Each control also carries a curated, polarity-safe paraphrase lexicon that extends its regex patterns. This improves recall on alternative phrasings that a rule list would miss."),
  C("\"scrambled on disk\"   -> encryption_at_rest"),
  C("\"who did what\"       -> audit_logging"),
  C("\"locked down\"        -> network_restricted"),
  C("\"second factor\"      -> mfa"),
  P("Ambiguous or opposite phrasings (\"reachable from the internet\", \"world-readable\") are deliberately excluded and belong to risky statements instead."),

  H2("Step 5 - Resource detection"),
  P("Each of the 78 AWS resources has a list of aliases. An alias is matched either as a plain phrase (word-boundary aware) or as a regular expression, chosen automatically by whether it contains regex metacharacters."),
  C("plain phrase : \"s3 bucket\"       (word-boundary match)"),
  C("regex alias  : \"\\\\becr\\\\b\", \"route.?53\"  (regex match)"),
  P("This distinction matters: escaping a regex alias would make it never match (a bug the evaluation caught)."),

  H2("Step 6 - Policy merge (applyPolicy)"),
  P("Before detection, any custom organisation policy is merged into the built-in rules. A non-AWS guard also checks for Azure/GCP terms and warns instead of silently applying AWS baseline controls."),
  LI("Custom requirements are appended and every requirement with alwaysRequired=true is treated as relevant regardless of resources."),
  LI("Custom risky patterns are appended to the risky list."),

  H2("Step 7 - Relevant controls"),
  P("For each detected resource, the union of its required controls is collected, plus the defaults for resources that accept them. Resources may opt out of defaults (noDefaults), for example identity services where encryption does not apply."),
  C("defaults = encryption_at_rest, encryption_in_transit, least_privilege_iam,"),
  C("           audit_logging, regional_restriction"),
  C("if no resource is recognised -> baseline set (defaults + network_restricted,"),
  C("   network_isolation, secrets_management, backup_recovery, monitoring_alerting)"),

  H2("Step 8 - Requirement detection (with negation guard)"),
  P("Each relevant control has a list of regex patterns. A control counts as STATED only if at least one match is not negated. Three guards are applied:"),
  LI("before - the last clause before the match (max 60 chars, split on . ; ! ? newline and and/but/or/then/so/while/however) must contain an even number of negation words."),
  LI("after - the next 18 chars must not be disabled / off / turned off / not enabled / inactive (catches \"logging disabled\")."),
  LI("notAfter - a control can declare qualifiers that disqualify a match (e.g. encryption_at_rest is not satisfied by \"encryption in transit\")."),
  C("\"do not make it public\"  -> public not treated as stated"),
  C("\"not not encrypted\"      -> encrypted IS stated (even count)"),
  C("\"logging disabled\"       -> audit_logging NOT stated"),

  H2("Step 9 - Omission analysis"),
  C("MISSING = relevant controls  -  stated controls"),

  H2("Step 10 - Risky detection"),
  P("Nine built-in risky patterns are scanned, negation-aware, and de-duplicated by id:"),
  C("open_ssh, public_bucket, wildcard_iam, no_encryption, hardcoded_secret,"),
  C("disabled_logging, weak_auth, public_database, no_backup"),

  H2("Step 11 - Scoring"),
  P("Risk score (0-100). Each control has a severity weight: high=3, medium=2, low=1."),
  C("missingRatio = missingWeight / maxWeight"),
  C("risk = min(100, round(100 * missingRatio^1.5 + min(55, riskyWeight * 9)))"),
  P("Risk levels: 75+ CRITICAL, 50+ HIGH, 25+ MEDIUM, 1+ LOW, else MINIMAL."),
  P("Confidence score (0-100) estimates how complete the analysis is:"),
  C("baseline prompt        : 34   (else 78)"),
  C("fewer than 4 tokens    : -22"),
  C("fewer than 8 tokens    : -8"),
  C("no controls matched    : -20"),
  C("two or more resources  : +6    (clamped to 5..98)"),
  C("label: >=75 high, >=45 medium, else low; needsDeepScan when < 50"),

  H2("Step 12 - Recommendations"),
  P("Each missing control carries a ready-to-add clause; each risky finding carries a fix. These are what the UI offers as one-click additions."),

  H2("Step 12b - Coverage score and semantic relevance"),
  P("Coverage is the share of required controls already stated: mentioned / (mentioned + missing). The UI shows it before and after clauses are accepted; the CLI prints it."),
  P("A second pass builds a TF-IDF index of the controls (each control is a document) and ranks them by cosine similarity to the prompt. Measurement showed cosine is polarity-blind (\"open all ports\" scores 0.49 against the restrict-ports control), so it is reported only as topically related controls and never marks a control as already stated."),
  C("coverage = round(100 * mentioned / (mentioned + missing))"),
  C("related   = top 3 controls by cosine(prompt, control-document)"),

  H2("Step 13 - Optional deep scan"),
  P("Only when requested, an existing model is asked ONLY for controls the rules may have missed (never trained or shipped by us)."),
  LI("Tier 1 (on-device): the browser's built-in model, no key and no network. Tried first."),
  LI("Tier 2 (hosted): an OpenAI-compatible /chat/completions endpoint using the user's key."),
  LI("parseFindings extracts JSON, normalises severity, caps results (10 missing, 5 risky) and marks them source = ai."),
  LI("mergeFindings de-duplicates by label and recomputes stats and risk."),

  H2("Step 14 - Report and rendering"),
  C("REPORT { prompt, tokens, intents, resources, mentioned, missing,"),
  C("         riskyFindings, riskScore, riskLevel, confidenceScore,"),
  C("         needsDeepScan, feedback, coverage, stats }"),
  P("Scope guard: if the text has no AWS resource, no infrastructure vocabulary and no infrastructure intent, the report is marked outOfScope with no findings instead of inventing them."),
  P("The shared renderer (src/ui.js) draws the report. Accepting clauses calls buildImprovedPrompt; the one-tap Harden calls harden(), which neutralises risky phrasing and iterates clauses until re-analysis is clean (risk 0, coverage 100%)."),

  H1("3. Where the pipeline runs"),
  LI("Popup (popup.js): reads a typed prompt, analyses, renders, accepts clauses, copies the improved prompt, records history, offers deep scan."),
  LI("Content script (content.js): injects a floating button on supported AI sites, reads the composer text on click, analyses it and offers deep scan and copy."),
  LI("Options page (options.js): edits settings, organisation policy and shows history."),
  LI("CLI (cli/vector-cli.js): analyze, analyze-file, improved and hook (CI exit codes)."),

  H1("4. Evaluation methodology"),
  P("Three hand-labelled AWS prompt sets are run through the engine and scored on: missing-constraint precision / recall / F1, risky-statement precision / recall / F1, and negation-trap failures."),
  C("dataset.json   39 prompts (tuning)"),
  C("dataset2.json  59 prompts (tuning)"),
  C("heldout.json   14 prompts (written before pattern fixes)"),
  P("A separate downstream demo checks six controls in insecure versus hardened Terraform (6 issues reduced to 0 with tfsec-style regex checks)."),

  H1("5. Grounding"),
  P("Control definitions live in src/taxonomy.js and map to CIS AWS Foundations Benchmark, AWS Well-Architected Framework (Security Pillar), AWS Foundational Security Best Practices, NIST SP 800-53 Rev.5, GDPR Article 5/32 and the India DPDP Act 2023.")
];

// ============================================================ MARKET ANALYSIS
const MARKET = [
  T("Vector - Market & Competitive Analysis"),
  S("Why Vector should exist: the problem, the landscape by pipeline stage, and the positioning. v0.5.7."),

  H1("1. Purpose"),
  P("This document establishes why Vector should exist before the architecture document describes how it works. It answers four questions: is the problem real and growing; who already addresses it and at which stage of the pipeline; where is the unoccupied space; and what is Vector's defensible position versus what is honestly not defensible."),

  H1("2. The problem, evidenced"),
  H2("2.1 Infrastructure is increasingly generated, not written"),
  LI("Sonar's 2026 State of Code survey reports 42 percent of committed code is written or assisted by an AI agent, projected to reach 65 percent by 2027."),
  LI("The same agents now scaffold Terraform, author resource blocks and fill IAM policies on the fly."),
  H2("2.2 Generated IaC is frequently insecure even when it is valid"),
  LI("IaC-Eval, NeurIPS 2024 Datasets and Benchmarks: GPT-4 pass@1 of 19.36 percent on 458 human-curated AWS Terraform scenarios, versus 86.6 percent on equivalent Python."),
  LI("DPIaC-Eval, FSE 2026: six frontier LLMs across 153 real-world IaC tasks, 20.8 to 30.2 percent first-attempt deployment success, and 8.4 percent Checkov compliance."),
  LI("TerraFormer, ICSE 2026: 17 frontier LLMs; HCL is harder than YAML or JSON IaC because it is less represented in training data."),
  LI("Security-First Evaluation of Text-to-Terraform, SBSeg 2026, arXiv 2608.02672: syntactic validity and security compliance are largely orthogonal. WizardCoder-33B reached a 77.8 percent validate rate with zero Checkov compliance."),
  H2("2.3 The failure modes are omission-shaped"),
  P("Sonar's analysis names four recurring failure modes. The first two map directly onto Vector's taxonomy."),
  LI("The reach-for-star problem: wildcard IAM, public S3 ACLs, security groups open to 0.0.0.0/0. The article's own reason is that restrictive configurations need boundary context that the prompt rarely supplies."),
  LI("The silent omission problem: an aws_db_instance without storage_encrypted, or CloudFront without a logging_config. The resource comes up, the protection does not."),
  LI("Hardcoded secrets and literals."),
  LI("Stale provider patterns and deprecated attributes."),
  H2("2.4 Post-hoc verification does not catch any of this"),
  P("terraform validate checks that HCL is syntactically valid and explicitly does not validate provider APIs. terraform plan previews the state delta but does not evaluate whether the configuration is secure. A syntactically perfect S3 bucket with a public ACL passes both, and so does an IAM policy with Action star."),
  P("Conclusion: the gap Vector targets, namely security requirements absent from the natural-language intent, is documented, measured and causally linked to real misconfiguration."),

  H1("3. Competitive landscape by pipeline stage"),
  P("The organising idea is where in the pipeline a tool intervenes."),
  C("(1) INTENT        (2) GENERATION      (3) PLAN/CODE      (4) DEPLOYED"),
  C("the prompt        the LLM writes      artefact exists    the account"),
  C("  VECTOR   -->    Copilot, Q Dev  -->  Checkov, tfsec -->  AWS Config"),
  C("  (nothing         insecure by         catches it         catches it in"),
  C("   here today)     default             AFTER it exists    production"),
  H2("3.1 Stage 1 - Intent, the prompt: Vector"),
  LI("Prompt optimisers such as PromptPerfect and Promptfoo improve clarity and length for task performance, not security completeness."),
  LI("LLM guardrails such as Lakera Guard, NeMo Guardrails and Prompt Shields defend the model against injection and unsafe content, not the infrastructure being described."),
  LI("No deployed product was found that analyses a prompt for missing cloud-security controls against a standards taxonomy. We state this as to our knowledge the niche is unoccupied, not as a proven absence."),
  H2("3.2 Stage 2 - Generation: adjacent, wrong stage"),
  LI("Amazon Q Developer generates CloudFormation and CDK and scans the result, but only after generation."),
  LI("GitHub Copilot writes Terraform and findings arrive on the generated code."),
  LI("Gemini Code Assist and Terraform's AI features share the same shape."),
  P("These share Vector's user and problem but act downstream. They are natural integration partners rather than competitors."),
  H2("3.3 Stage 3 - Plan and artefact: the closest functional neighbours"),
  LI("Checkov, tfsec (Trivy), KICS, Terrascan, cfn-nag and Snyk IaC statically scan written infrastructure code. No prompt awareness."),
  LI("SonarQube IaC parses Terraform, ARM and CloudFormation into an AST and applies rules. Explicitly post-generation."),
  LI("HashiCorp Sentinel, OPA and Conftest, Firefly, Spacelift and env0 apply policy at plan time. Shift-left, but on the artefact, and the user must author the policy."),
  P("These are Vector's true comparison set, all seeking to secure IaC, and all working on something that already exists."),
  H2("3.4 Stage 4 - Deployed: out of scope"),
  P("AWS Config, Security Hub, GuardDuty and Prowler detect drift and misconfiguration in a running account. Vector does not replace them; it reduces what reaches them."),

  H1("4. Positioning"),
  H2("4.1 Position statement"),
  P("Vector performs security diagnosis at the natural-language infrastructure prompt stage, before any IaC is generated, identifying omitted controls against a standards-grounded taxonomy, quantifying coverage, and interactively hardening the prompt."),
  H2("4.2 Capability matrix"),
  LI("Acts before generation: only Vector, the prompt optimisers and the guardrails."),
  LI("Cloud-security semantics: Vector, the scanners and plan-time policy. Guardrails and optimisers no; Q Developer and Copilot only post-hoc."),
  LI("Standards-grounded taxonomy: Vector, the scanners and plan-time policy."),
  LI("No policy authoring required: Vector, the scanners, the optimisers and the generators. Plan-time policy requires it."),
  LI("Coverage metric for a prompt: Vector only."),
  LI("Interactive prompt hardening: Vector only."),
  LI("Works offline with no account: Vector, and the scanners."),
  LI("Deterministic and explainable: Vector, the scanners and plan-time policy."),
  H2("4.3 Where Vector does not compete"),
  LI("It does not generate infrastructure code."),
  LI("It does not replace IaC scanners. arXiv 2608.02672 concludes that prompt engineering alone is insufficient and that scanning remains necessary. Vector positions upstream and complementary."),
  LI("It does not read live cloud accounts."),
  LI("It is AWS-only; Azure and GCP prompts receive a warning rather than results."),

  H1("5. Target users"),
  LI("A developer using an LLM for Terraform: does not know which controls to state. Vector gives the omissions and a one-tap hardened prompt."),
  LI("A junior or student team: no cloud-security background. Vector gives plain-language findings with standards references."),
  LI("A platform or DevOps team: inconsistent prompts across the organisation. Vector offers org policy packs and a CLI or CI gate on prompt files."),
  LI("A security reviewer: reviews intent late and manually. Vector gives machine-readable coverage before generation."),

  H1("6. Differentiation summary"),
  LI("Intervention point: every comparable product evaluates an artefact; Vector evaluates intent."),
  LI("Prompt Security Coverage Score: a metric no adjacent tool produces, shown before and after hardening, for example risk 100 to 0 and coverage 0 to 100 percent."),
  LI("Interactive harden-to-zero: not just what you missed, but a rewritten prompt that re-analyses clean."),
  LI("Determinism and auditability: the same prompt always gives the same report, with no sampling on the rule path."),
  LI("Zero-friction distribution: offline, no account, no backend, one engine shared by the extension, CLI, mobile apps and the public web demo."),

  H1("7. Honest weaknesses against the market"),
  LI("Recall ceiling: rules miss arbitrary paraphrase. Mitigation is the optional AI deep scan, and the limitation is documented rather than hidden."),
  LI("AWS-only: no Azure or GCP. Deliberate scope, with a warning instead of misleading output."),
  LI("Not a proof of safety: it diagnoses prompts, not deployed posture. Positioned as a diagnostic aid that complements scanners."),
  LI("Large vendors could absorb the capability: IaC scanning is a feature for Snyk, Sonar and Prisma. The moat is the prompt-stage metric and workflow, plus speed."),
  LI("Evaluation is small: 112 labelled prompts, tuned during development. A frozen held-out set and an LLM downstream study are planned."),

  H1("8. References"),
  LI("Sonar, AI is writing more of your Terraform, 2026."),
  LI("Vargas, Mansilha, Kreutz, Security-First Evaluation of Text-to-Terraform, SBSeg 2026, arXiv 2608.02672."),
  LI("IaC-Eval, NeurIPS 2024 Datasets and Benchmarks Track."),
  LI("DPIaC-Eval, FSE 2026, arXiv 2506.05623."),
  LI("TerraFormer, ICSE 2026, arXiv 2601.08734."),
  LI("CIS AWS Foundations Benchmark v3.0; AWS Well-Architected Security Pillar; AWS Foundational Security Best Practices; NIST SP 800-53 Rev.5; GDPR Article 5 and 32; India DPDP Act 2023."),
  P("Full extracts and the positioning caution are stored in the references folder of the repository.")
];

// ================================================================ ROADMAP DOC
const ROADMAP = [
  T("Vector - Step-by-Step Roadmap"),
  S("Plan from build-complete to submission. v0.5.7."),

  H1("0. Status snapshot"),
  P("The system is already built and working, so this roadmap separates what is done from what remains. Remaining work is evidence and polish, not features."),
  H2("Already built"),
  LI("Rule engine: 78 AWS resources, 30 controls, 9 risky patterns, negation and paraphrase handling."),
  LI("Risk, confidence and coverage scoring; relevance tiers; context awareness; Terraform hints."),
  LI("One-tap harden to risk 0 and coverage 100 percent."),
  LI("Scope guard for non-infrastructure input and a non-AWS warning."),
  LI("Browser extension with popup, in-page button and options page; submitted to the Edge store."),
  LI("CLI with analyze, improved, verify and hook."),
  LI("React Native Expo app for iOS and Android, and a Capacitor Android app, both building."),
  LI("Public web demo on GitHub Pages."),
  LI("Optional AI deep scan with on-device and hosted tiers across three providers."),
  LI("63 unit tests, a 112-prompt evaluation harness, and the documentation set."),

  H1("Phase 1 - Freeze and measure, weeks 1 to 2"),
  H2("Week 1 - frozen evaluation set"),
  LI("Expand labelled prompts past 150, including adversarial paraphrase."),
  LI("Freeze the patterns: stop editing taxonomy.js and tag the commit."),
  LI("Write a genuinely unseen set after the freeze and never use it for tuning."),
  LI("Run the harness on every set and save the output to docs/eval-results.txt."),
  P("Why first: the current F1 of 1.000 is optimistic because all 112 prompts were seen during development. This week produces an honest number."),
  H2("Week 2 - the two studies that prove the claim"),
  LI("LLM downstream study: generate Terraform from raw versus hardened prompts and score both."),
  LI("Inter-annotator agreement: a teammate labels 30 prompts independently and we compute Cohen's kappa."),
  LI("Post-generation check on real generated code using the verify command."),

  H1("Phase 2 - Harden the deliverable, weeks 3 to 4"),
  H2("Week 3 - mobile and store"),
  LI("Run the Expo app on a real iPhone through Expo Go and on a real Android device; capture screenshots."),
  LI("Fix any UI issues found on device."),
  LI("Capture store screenshots at 640 by 480 or 1280 by 800."),
  LI("Upload the latest extension zip to the Edge store and paste the certification notes."),
  H2("Week 4 - quality and gaps"),
  LI("Fix detection gaps found by the frozen set and re-run the evaluation."),
  LI("Add unit tests for any new rule."),
  LI("Verify CI passes from a clean clone."),
  LI("Update all four documents with the final numbers."),

  H1("Phase 3 - Report and demo, weeks 5 to 6"),
  H2("Week 5 - documents and demo script"),
  LI("Finalise the four documents: market analysis, architecture, roadmap and course plan mapping."),
  LI("Write a five-minute demo script: prompt, findings, harden, copy, verify."),
  LI("Rehearse end to end."),
  LI("Prepare the viva answer set."),
  H2("Week 6 - buffer and submission"),
  LI("Polish the README and the manual."),
  LI("Final commit and tag v1.0."),
  LI("Rehearse the demo twice."),
  LI("Submit."),

  H1("Ready-made viva answers"),
  LI("Where is the NLP: normalisation and negation-aware matching, a paraphrase lexicon, intent extraction, synonym mapping and a TF-IDF information-retrieval pass. Classical rule-based NLP, chosen for determinism and auditability."),
  LI("What is novel: not the techniques, but the intervention point. Every comparable tool evaluates an artefact; Vector evaluates intent, adds a coverage metric, and closes the loop with an interactive harden-to-zero prompt."),
  LI("Would an LLM just do this: the LLM is an optional second opinion, deliberately not the core, because the core must be deterministic, offline and auditable, and because the literature shows prompt engineering alone is insufficient."),
  LI("Is it accurate: on the tuning sets F1 is 1.000, but those prompts were used during development. The frozen held-out number is reported alongside."),
  LI("What are the limits: AWS only; rule-based recall has a ceiling on arbitrary paraphrase; it diagnoses prompts, not deployed posture."),

  H1("Risk register"),
  LI("Evaluation seen as overfit - high likelihood, high impact - mitigated by a frozen held-out set and kappa."),
  LI("No Mac for iOS - medium - mitigated by Expo Go and EAS cloud builds."),
  LI("Store review delay - medium - mitigated by load-unpacked for the demo."),
  LI("Scope creep - medium - secondary features are explicitly deferrable."),
  LI("CORS blocks deep scan on the web demo - certain - the demo uses the rule engine only."),

  H1("Deliverables checklist"),
  LI("Four documents finalised and committed."),
  LI("Frozen evaluation results recorded."),
  LI("LLM downstream study run."),
  LI("Inter-annotator kappa recorded."),
  LI("Expo app verified on iOS and Android."),
  LI("Store screenshots captured and the Edge listing live at the latest version."),
  LI("Demo rehearsed and the repository tagged v1.0.")
];

// ========================================================= COURSE PLAN MAPPING
const COURSE = [
  T("Vector - Course Plan Mapping"),
  S("How the project maps onto a standard Natural Language Processing syllabus."),

  H1("1. Summary"),
  P("Vector is a classical NLP application: text normalisation, tokenisation, morphological handling, pattern-based information extraction, negation scope resolution, a curated lexical resource, and an information-retrieval pass using TF-IDF and cosine similarity. It deliberately avoids neural methods so that every result is deterministic and explainable."),

  H1("2. Module-by-module mapping"),
  P("Rename the module titles to match your official course plan; the right-hand side is what Vector actually demonstrates."),
  H2("Module 1 - Introduction to NLP and text processing"),
  LI("NLP pipeline: the architecture document describes an 18-step pipeline."),
  LI("Basic preprocessing: normalise and tokenise with a stopword list."),
  LI("Noisy text: negation-prefix fixup, punctuation stripping and whitespace collapse."),
  H2("Module 2 - Lexical semantics and lexical resources"),
  LI("Lexical resource: 19 synonym entries, 13 control paraphrase lexicons and about 40 negation cues."),
  LI("Synonymy: website maps to ec2 and load balancer; scrambled on disk maps to encryption at rest."),
  LI("Limitations of hand-built lexicons: the recall ceiling is documented, along with a negative result about TF-IDF."),
  H2("Module 3 - Morphology"),
  LI("Light suffix stripping in the semantic tokenizer."),
  LI("Trade-offs discussed in the calibration script output."),
  H2("Module 4 - Syntax and negation scope"),
  LI("Three-guard negation algorithm: before, after and notAfter."),
  LI("Clause segmentation over punctuation and discourse cues such as except, unless, rather than and instead of."),
  LI("Worked examples are in the architecture document."),
  H2("Module 5 - Information extraction"),
  LI("Entity extraction: 78 AWS resources matched by phrase and regex aliases."),
  LI("Attribute extraction: the resource to required-control mapping."),
  LI("Pattern design: 30 controls, each with several regular expressions."),
  H2("Module 6 - Text classification"),
  LI("Rule-based decision: a control is present or missing."),
  LI("Feature-based weighting: severity and tier feed the risk score."),
  LI("Evaluation: precision, recall and F1."),
  H2("Module 7 - Information retrieval and vector space models"),
  LI("TF-IDF index built over control documents."),
  LI("Cosine similarity between the prompt and each control."),
  LI("Critical interpretation: cosine is polarity-blind, measured, and therefore restricted to advisory relevance, never compliance."),
  H2("Module 8 - Evaluation of NLP systems"),
  LI("Precision, recall and F1 over 112 labelled prompts."),
  LI("Labelled dataset design across three files."),
  LI("Annotator agreement measured with Cohen's kappa."),
  LI("Limitations reported honestly: all prompts were seen during development."),
  H2("Module 9 - Applications and project work"),
  LI("End-to-end application: engine plus extension, CLI, two mobile apps and a web demo."),
  LI("Deployment: Edge Add-ons listing, GitHub Pages demo and an installable Android package."),
  LI("Ethics and privacy: fully offline core, no account and no telemetry, with opt-in AI only."),

  H1("3. Course deliverable cross-reference"),
  LI("Problem statement and motivation: market analysis section 2, with benchmarks."),
  LI("Literature and prior art: market analysis section 3, plus the references folder."),
  LI("System design: architecture sections 1 to 7."),
  LI("Methodology: architecture section 4, the 18-step pipeline, and section 5, scoring."),
  LI("Implementation: src, extension, cli, mobile-expo and mobile-native."),
  LI("Evaluation and results: the eval folder and the evidence table."),
  LI("Novelty statement: the intervention-point framing in market analysis section 6."),
  LI("Limitations and future work: architecture section 10 and the roadmap risk register."),
  LI("Report: the four Word documents in the docs folder."),

  H1("4. Evidence table"),
  LI("Labelled prompts for tuning: 98, across dataset.json with 39 and dataset2.json with 59."),
  LI("Earlier held-out prompts: 14."),
  LI("Missing-constraint F1: 1.000, indicative only, from npm run eval."),
  LI("Risky-statement F1: 1.000, indicative only."),
  LI("Negation-trap failures: 0."),
  LI("Unit tests: 63."),
  LI("Downstream demo: insecure Terraform drops from 6 issues to 0."),
  LI("Frozen held-out F1: to be run in week 1."),
  LI("LLM study raw to hardened: to be run in week 2."),
  LI("Inter-annotator kappa: to be run in week 2."),

  H1("5. What this mapping does not claim"),
  LI("No neural NLP: no embeddings and no transformer training. This is stated openly."),
  LI("No model training: the AI component uses an existing model as an optional second opinion."),
  LI("No claim of state-of-the-art accuracy: the evaluation is small and honest about it."),
  P("Being explicit about scope is itself part of the evaluation outcome. The project demonstrates understanding of the limits of the chosen NLP techniques.")
];

// ============================================================ PROGRESS REPORT
const PROGRESS = [
  T("Vector - Progress Report"),
  S("Pre-Generation Security Diagnosis of Cloud Infrastructure Prompts Using NLP"),

  H1("Team"),
  LI("Satya - bl.sc.u4cse24012"),
  LI("Roshna George - bl.sc.u4cse24043"),
  LI("Sanjeev Vakalapudi - bl.sc.u4cse24054"),
  LI("Team name: Vector - Directing intent toward optimal output."),
  LI("Report date: 17 September 2026. Current build: v0.5.7. Time remaining: about six weeks."),

  H1("1. Where we are"),
  P("The core is built, tested and running, and the extension is submitted to the Microsoft Edge Add-ons store. Vector reads a plain-English AWS prompt, finds the security controls the prompt never states, flags risky statements, and turns every omission into a clause the user can add in one click. One button rewrites the prompt into a hardened version that re-analyses to risk 0 and coverage 100 percent."),
  LI("Engine: rule-based NLP, no ML and no network. 78 AWS resources, 30 controls, 9 risky patterns, a negation and double-negation guard, and paraphrase handling for common alternative wording."),
  LI("Scoring: risk 0-100 with severity levels, confidence 0-100 with a baseline mode, and our own Prompt Security Coverage Score, which updates live as clauses are accepted (risk 100 to 0, coverage 0 to 100 percent)."),
  LI("Interactive helpers: project (live score projection), harden (one-tap hardening that neutralises risky phrasing and iterates until clean), and merge (deep-scan findings)."),
  LI("Relevance tiers: findings are grouped into Confirmed gaps, Needs clarification and Optional hardening, so the output reads as prioritised reasoning rather than a checklist."),
  LI("Context awareness: rule-based cues distinguish a development or sandbox prompt from a production one and adjust the risk score accordingly."),
  LI("Terraform hints: every control carries the concrete attribute to set, for example storage_encrypted = true."),
  LI("Scope guard: input that is not an AWS infrastructure prompt, such as a bucket of water, is rejected with a message instead of being scored."),
  LI("Shipped surfaces: a Chrome and Edge extension (Manifest V3) with a popup and an in-page button on ChatGPT, Claude and Gemini, a CLI with a CI hook and a post-generation verify command, a React Native (Expo) mobile app for iOS and Android, a Capacitor Android build, and a public browser demo on GitHub Pages."),
  LI("Evidence: 63 unit tests, an evaluation harness over 112 hand-labelled prompts reporting precision, recall, F1 and negation-trap accuracy, a downstream demo where insecure Terraform drops from 6 findings to 0, an LLM downstream study harness, and a Cohen's kappa inter-annotator agreement harness."),
  LI("Grounding: CIS AWS Foundations, AWS Well-Architected (Security), AWS Foundational Security Best Practices, NIST SP 800-53 Rev.5, GDPR Art. 5 and 32, and the India DPDP Act 2023."),
  LI("Documentation: a build manual, an architecture and pipeline document, a feature list, and this progress report, all regenerated from source."),

  H1("2. Model strategy - extend, do not train"),
  P("We are not training a model. The deterministic rule engine stays the backbone and any AI is optional and additive."),
  LI("The deep scan asks an existing model only for controls the rules may have missed, merges the answer back, and badges every finding as rule or AI."),
  LI("Tier 1 is the browser's built-in model (Gemini Nano): no API key and no network. Tier 2 is any OpenAI-compatible endpoint with the user's own key; the supported providers are Gemini, OpenAI and OpenCode Zen."),
  LI("If neither tier is available the product still works, rules only. That fallback is a design requirement, not a nice-to-have."),
  LI("When deep scan runs, the rule-based answer is hidden until the AI returns, then both are shown together, so the two results are never presented as competing answers. If the model reports nothing further, the UI says no issues found rather than showing an empty report."),
  LI("Fine-tuning or shipping our own weights is out of scope for the remaining time."),

  H1("3. Platform decisions from this review"),
  LI("PC: the Chrome extension stays the primary PC surface. It already runs in Chrome and Edge, and the CLI covers terminals and CI."),
  LI("Mobile: a single Expo (React Native) app covers both iOS and Android from one codebase, alongside the Capacitor Android build for an installable APK."),
  LI("Reason: Expo removes the duplication between the two mobile attempts, gives both platforms from one codebase, and lets us test on a real phone through Expo Go without a store release."),
  LI("The engine is reused unchanged. Every surface is a client of the same analyzer, which is why results are identical everywhere."),

  H1("4. Features - what matters and what does not"),
  H2("Core, shipped"),
  LI("Prompt analysis engine: resource detection, control detection and negation-safe matching."),
  LI("Missing-constraint detection against the standards-grounded taxonomy."),
  LI("Risky-statement detection: 0.0.0.0/0, public buckets, wildcard IAM, hard-coded secrets, and disabled logging or backups."),
  LI("Risk score, confidence score and Prompt Security Coverage Score."),
  LI("One-click clauses, the hardened prompt, and a one-tap harden that reaches risk 0 and coverage 100 percent."),
  LI("PC: Chrome and Edge extension with popup and in-page button, plus the CLI with CI exit codes and the verify command."),
  LI("Mobile: Expo app that takes a prompt, shows the tiered diagnosis, accepts clauses and shares the hardened prompt."),
  LI("Optional AI deep scan with rule and AI badges, a rules-only fallback, and a clean no-issues state."),
  LI("Evaluation harness and unit tests, so every claim has a number behind it."),

  H2("Secondary, only if the core finishes early"),
  LI("History sync across devices for the mobile app."),
  LI("Export a diagnosis report as text or PDF to share with a reviewer."),
  LI("A Firefox port of the extension."),
  LI("An organisation policy editor on mobile, matching the options page."),
  LI("A coverage trend view over past analyses."),

  H2("Not important - dropped or deferred"),
  LI("Training or fine-tuning our own model, or shipping model weights. We extend existing models."),
  LI("Generating infrastructure code. We diagnose the prompt before generation, so code generation stays the LLM's job. This keeps the pre-generation thesis clean."),
  LI("Post-deployment scanning, or reading live cloud accounts. That is precisely the problem we are replacing, although we now offer a post-generation verify command as a complement, never a replacement."),
  LI("Multi-cloud support. AWS first, and we only warn when a prompt targets Azure or GCP."),
  LI("Accounts, a backend server, analytics or telemetry. They break the offline and privacy stance that makes the tool easy to trust and easy to install."),
  LI("Multi-tenant SaaS, billing and role-based access control."),
  LI("An IDE plugin for VS Code. It is a third client, deferred past this term."),

  H1("5. Plan for the remaining six weeks"),
  LI("Week 1 - expand the evaluation sets with adversarial paraphrases, targeting 150 or more cases, and freeze the patterns before the final held-out run."),
  LI("Week 2 - run the LLM downstream study (raw versus hardened prompts) and the inter-annotator agreement study with a second labeler."),
  LI("Week 3 - capture store screenshots and finish the mobile polish; verify the Expo app end to end on a real iPhone and an Android device."),
  LI("Week 4 - fix detection gaps found on paraphrased prompts, and record the honest precision and recall numbers."),
  LI("Week 5 - prepare the demo script and the report, and rehearse the prompt to hardened prompt walkthrough."),
  LI("Week 6 - buffer: polish, final submission, and the store review turnaround for the latest version."),

  H1("6. Risks"),
  LI("The evaluation sets are small and were tuned after seeing failures, so the current F1 is optimistic. Expanding them with a frozen final set is week 1 and week 2 work."),
  LI("Rule-based recall has a ceiling on arbitrary paraphrase. The optional deep scan covers the long tail, and the limitation is documented rather than hidden."),
  LI("The on-device model is only available on some Chrome versions and machines. The rules-only fallback covers this."),
  LI("Browser pages are subject to CORS, so the hosted deep scan works in the extension and the mobile app but not on the public demo page, which uses the rule engine only."),
  LI("Store submissions add delay and review risk, so the mobile build ships as an installable APK and through Expo Go for the demo, not as a store listing."),
  LI("Mobile is the newest surface, so scope creep is the main threat. Anything in the secondary list can be dropped without weakening the core claim."),

  H1("7. Next review"),
  P("We will report expanded evaluation results with a frozen held-out set, the LLM downstream study and inter-annotator agreement numbers, the Expo app running on both platforms, a live demo from prompt to hardened prompt, and the store listing link.")
];

// ========================================================== ARCHITECTURE DOC
const ARCHITECTURE = [
  T("Vector - Architecture & Pipeline"),
  S("Detailed system design for the pre-generation security diagnosis engine (v0.5.7, AWS-only, rule-based, offline)."),

  H1("1. Executive summary"),
  P("Vector sits between a user's natural-language prompt and the LLM that turns it into infrastructure code. It detects the AWS resources being described, looks up the security controls those resources require, subtracts the controls the prompt already states, and reports the rest as missing constraints, together with any risky statements. Every finding carries a ready-to-add clause and the Terraform attribute to set. One tap rewrites the prompt into a hardened version that re-analyses to risk 0 and coverage 100 percent."),
  P("There is no machine learning, no trained model and no network on the core path. The knowledge is a curated, standards-grounded taxonomy."),

  H1("2. System architecture"),
  H2("2.1 Layers"),
  LI("Knowledge base - src/taxonomy.js: resources, controls, risky patterns, synonyms, paraphrase lexicon, tiers, Terraform hints, context cues, scope vocabularies."),
  LI("Core engine - src/analyzer.js: the analysis pipeline, scoring, harden, project and merge."),
  LI("Secondary NLP - src/semantic.js: TF-IDF index and cosine similarity, advisory only."),
  LI("Optional AI - src/llm.js: deep scan through an existing model, on-device or hosted."),
  LI("Post-generation - src/tfcheck.js: deterministic checks on generated Terraform."),
  LI("Shared utilities - src/settings.js, src/ui.js and src/ui.css."),
  LI("Surfaces - extension (manifest.json, popup, content, options), CLI (cli/vector-cli.js), mobile (mobile/, mobile-expo/), web demo (demo/)."),
  LI("Quality - test/run-tests.js, eval/, .github/workflows/ci.yml."),

  H2("2.2 Layering rule"),
  P("The engine is UI-agnostic and dependency-free. Every surface loads the same files and calls the same functions: analyze, harden, project and mergeFindings. This is why the extension, CLI, mobile apps and web demo produce identical results."),
  C("src/taxonomy.js --+"),
  C("src/semantic.js --+--> src/analyzer.js --> report --> src/ui.js"),
  C("src/settings.js --+                                --> popup.js / content.js"),
  C("                                                   --> App.js (React Native)"),
  C("                                                   --> cli/vector-cli.js"),
  C("src/llm.js --> mergeFindings --> same report"),
  C("src/tfcheck.js --> independent post-generation path"),

  H1("3. The analysis pipeline"),
  P("Entry point: VectorAnalyzer.analyze(prompt, options) in src/analyzer.js, where options is { policy, strictMode }."),

  H2("Step 0 - Input"),
  LI("prompt: the natural-language infrastructure request."),
  LI("options.policy: optional custom organisation rules (requirements and riskyPatterns)."),
  LI("options.strictMode: promotes medium severity to high in the weighting."),

  H2("Step 1 - Normalisation"),
  C('"Store data UNENCRYPTED in the S3 bucket"'),
  C('  -> lowercase, quotes removed, whitespace collapsed'),
  C('  -> "store data unencrypted in the s3 bucket"'),
  C('  -> negation prefix fixup: "unencrypted" -> "not encrypted"'),
  C('  -> "store data not encrypted in the s3 bucket"'),

  H2("Step 2 - Tokenisation"),
  P("Split on non-alphanumerics and drop a stopword list. Token count drives the confidence score."),

  H2("Step 3 - Synonym expansion"),
  P("Everyday words are mapped to canonical AWS nouns, used only for resource detection. This step is deliberately excluded from the scope guard so that a bucket of water cannot become an s3 bucket."),
  C('"website"        -> ec2, load balancer'),
  C('"object storage" -> s3'),
  C('"serverless"     -> lambda'),
  C('"relational db"  -> rds'),

  H2("Step 4 - Intent detection"),
  P("Verb groups matched: create, deploy, store, allow, restrict, secure, connect, backup, monitor. Intents are reported and count as a scope signal."),

  H2("Step 5 - Policy merge"),
  P("Custom policy requirements are appended; those marked alwaysRequired are treated as relevant regardless of detected resources. Custom risky patterns are appended to the risky list."),

  H2("Step 6 - Resource detection"),
  P("78 AWS resources, each with aliases matched either as a word-boundary phrase or as a regular expression, decided automatically by whether the alias contains regex metacharacters."),
  C('plain alias : "s3 bucket"   -> word-boundary phrase match'),
  C('regex alias : "\\\\becr\\\\b"    -> regex match'),

  H2("Step 7 - Scope guard"),
  P("Decides whether this is an infrastructure prompt at all. It is in scope if any of the following hold: a strong unambiguous term such as aws, s3, vpc, terraform, iam or rds; an infrastructure intent verb; two or more infrastructure terms; a resource matched by a non-ambiguous alias; or a risky security statement. Otherwise the function returns immediately with outOfScope true, risk 0 and no findings."),
  C('OUT  "i want a bucket full of water"   IN  "Create an S3 bucket for user documents."'),
  C('OUT  "a bucket of water"               IN  "Create a bucket for user files."'),
  C('OUT  "i need a queue for the tickets"  IN  "Deploy our application to the cloud."'),
  C('OUT  "i will kill u"                   IN  "Hard-code the database password in the application."'),

  H2("Step 8 - Context detection"),
  P("Rule-based environment cues adjust the risk weight later: dev, sandbox, test, staging and prototype give a factor of 0.75; production, live, customer data, PII and regulated give 1.10; otherwise 1.00. Non-AWS terms such as azure or gcp set a warning flag so the UI does not present AWS-specific advice."),

  H2("Step 9 - Relevant control set"),
  P("The union of the required controls of every detected resource. Resources may opt out of the shared defaults where they do not apply. If no resource is recognised, a baseline set is used. Always-required policy rules are added unconditionally."),
  C("DEFAULT_REQUIRED = encryption_at_rest, encryption_in_transit, least_privilege_iam,"),
  C("                   audit_logging, regional_restriction"),

  H2("Step 10 - Requirement detection with negation guard"),
  P("Each control has regex patterns plus a curated paraphrase lexicon. A control counts as stated only if at least one match survives three guards."),
  LI("before - the clause before the match must contain an odd number of negation words. Example: do NOT make it public means the public-access control is not stated."),
  LI("after - the next characters must not be disabled, off, not enabled or inactive. Example: logging disabled means audit logging is not stated."),
  LI("notAfter - a control may declare qualifiers that disqualify a match. Example: encryption in transit does not satisfy at-rest."),
  P("Negation words include not, no, never, without, avoid, disable, deny, cannot, except, rather than and instead of."),

  H2("Step 11 - Omission analysis"),
  C("MISSING = relevant controls - stated controls"),
  P("Each missing control carries an id, label, dimension, severity, tier, weight, a Terraform hint, a description, a ready-to-add clause, standards, applicable resources and its source."),

  H2("Step 12 - Risky-statement detection"),
  P("Nine built-in risky patterns, matched negated-aware and de-duplicated: open SSH, public bucket, wildcard IAM, unencrypted data, hard-coded secret, disabled logging, weak authentication, public database and no backup. Each pattern may define rewrite rules used by harden()."),

  H2("Step 13 - Scoring"),
  C("severityWeight : high = 3, medium = 2, low = 1"),
  C("tierMultiplier : core = 1.0, clarify = 0.6, harden = 0.3"),
  C("weight = severityWeight x tierMultiplier"),
  C("missingRatio = missingWeight / maxWeight"),
  C("base = round(100 x missingRatio^1.5 + min(55, riskyWeight x 9))"),
  C("riskScore = clamp(round(base x envFactor), 0, 100)"),
  P("Risk levels: 75 and above CRITICAL, 50 and above HIGH, 25 and above MEDIUM, 1 and above LOW, otherwise MINIMAL."),

  H2("Step 14 - Confidence"),
  C("base 34 in baseline mode, else 78"),
  C("-22 if fewer than 4 tokens, -8 if fewer than 8 tokens"),
  C("-20 if no controls matched, +6 if two or more resources"),
  C("clamp 5 to 98; high at 75, medium at 45, else low"),
  C("needsDeepScan = confidence < 50 OR coverage < 50"),

  H2("Step 15 - Tiering and coverage"),
  C("coverageScore = round(100 x mentioned / (mentioned + missing))"),
  P("Findings are grouped into core (strongly implied), clarify (context-dependent) and harden (optional)."),

  H2("Step 16 - Semantic relevance, advisory only"),
  P("src/semantic.js builds a TF-IDF index over the controls and ranks them by cosine similarity to the prompt. Measurement showed cosine similarity is polarity-blind: open all ports scores 0.49 against the restrict-ports control, while a genuine paraphrase scores 0.20. Similarity is therefore never allowed to mark a control as stated, and the negative result is documented rather than hidden."),

  H2("Step 17 - Report"),
  P("The report contains the prompt, tokens, intents, resources, mentioned controls, missing controls, risky findings, risk score and level, coverage score, tier counts, total weight, confidence, environment, non-AWS and out-of-scope flags, semantic matches, feedback, disclaimer and statistics."),

  H2("Step 18 - Rendering"),
  P("src/ui.js draws the report: warning banner, risk card with score, level and coverage, the risky section, and tier-grouped missing controls each with a clause, a Terraform hint and a one-click Add clause action."),

  H1("4. Interactive helpers"),
  H2("4.1 project - live score projection"),
  P("Recomputes risk and coverage for a hypothetical set of accepted clauses without re-analysing. A bare S3 bucket moves from risk 100 and coverage 0 percent to risk 46 at three clauses, risk 15 at six, and risk 0 at all clauses."),
  H2("4.2 harden - one-tap hardening"),
  P("Rewrites risky phrasing into safe wording, then iteratively appends every missing clause and re-analyses until no new clauses appear. The iteration is required because an appended clause can mention another service, which the analyser then also finds missing."),
  C("base = neutralizeRisky(prompt)"),
  C("if analyze(base).outOfScope: return unchanged"),
  C("repeat up to 8 times: add missing clauses, re-analyse, stop when nothing new"),
  C("returns { prompt, clauses, report }"),
  H2("4.3 mergeFindings"),
  P("Merges deep-scan output, de-duplicating by label, marking findings as AI, and recomputing statistics, tier counts, total weight and risk."),

  H1("5. Optional AI deep scan"),
  P("Off by default. Two tiers: on-device using the browser model with no key and no network, then hosted using an OpenAI-compatible chat-completions endpoint with the user's own key."),
  LI("Gemini: https://generativelanguage.googleapis.com/v1beta/openai, model gemini-2.5-flash."),
  LI("OpenAI: https://api.openai.com/v1, model gpt-4o-mini."),
  LI("OpenCode Zen: https://opencode.ai/zen/v1, model deepseek-v4-flash."),
  P("The model is asked only for controls that appear missing and for risky statements, as strict JSON. Errors surface the provider's own message. A static web page can only call providers that send CORS headers, so the demo can use Gemini but not OpenCode Zen; the extension and mobile app bypass CORS."),

  H1("6. Post-generation loop"),
  P("src/tfcheck.js and the verify command run eleven deterministic checks over generated HCL and exit with 2 for high severity, 1 for other findings, and 0 when clean. This makes the architecture honest: prompt-stage diagnosis is complementary to post-generation scanning, not a replacement."),

  H1("7. Surfaces"),
  LI("Browser extension: toolbar popup and an in-page floating button on ChatGPT, Claude and Gemini. Buttons: Analyze, Deep scan, Harden prompt, Add clause, Accept all, Copy."),
  LI("CLI: analyze, analyze-file, improved, hook and verify, with --json, --strict and --policy."),
  LI("Mobile: a Capacitor app with the Android build verified, and a React Native Expo app with both iOS and Android bundles verified. Both reuse the engine unchanged."),
  LI("Web demo: the same web app published by GitHub Pages with a version query for cache-busting."),

  H1("8. Evaluation methodology"),
  LI("Two tuning sets, 39 and 59 labelled prompts, plus a 14-prompt set written before the last round of pattern fixes."),
  LI("Metrics: missing-constraint precision, recall and F1; risky-statement precision, recall and F1; negation-trap failures."),
  LI("Cohen's kappa harness for agreement between two independent labelers."),
  LI("Downstream studies: hand-written insecure versus hardened Terraform, and a script that generates Terraform with an LLM from raw versus hardened prompts and scores both."),
  P("Honest status: all 112 prompts were seen during development, so the current F1 is indicative and not a clean held-out result. Two results that would strengthen the claim are wired but need external inputs: the LLM downstream study needs an API key, and inter-annotator agreement needs a second human labeler."),

  H1("9. Grounding"),
  P("CIS AWS Foundations Benchmark, AWS Well-Architected Framework Security Pillar, AWS Foundational Security Best Practices, NIST SP 800-53 Rev.5, GDPR Article 5 and 32, and the India DPDP Act 2023. Each control carries its standards citations, shown on the finding."),

  H1("10. Properties, limits and design decisions"),
  LI("Deterministic: the same prompt always gives the same report."),
  LI("Explainable: every finding traces to a named control and pattern."),
  LI("Offline: no network, no account and no telemetry on the core path."),
  LI("Never empty: an unrecognised but in-scope prompt still receives baseline controls."),
  LI("Limit: AWS only. Azure and GCP prompts receive a warning instead of results."),
  LI("Limit: rule-based recall has a ceiling on arbitrary paraphrase; the optional deep scan covers the long tail."),
  LI("Limit: ambiguity is inherent to keyword matching; the scope guard removes the obvious failures, not every odd sentence."),
  LI("Positioning: a diagnostic aid that complements post-generation scanning, not a guarantee."),

  H1("11. Version history"),
  LI("0.2.0 first Edge submission, AWS-only rule engine."),
  LI("0.3.0 coverage score and TF-IDF relevance."),
  LI("0.4.0 paraphrase lexicon, non-AWS guard, disclaimer, tests."),
  LI("0.4.1 default to Gemini endpoint."),
  LI("0.4.2 auto deep scan on low coverage."),
  LI("0.4.3 reworded clauses, credentials false positive fixed."),
  LI("0.4.4 relevance tiers, API Gateway fix, negation for rather than, tier-weighted risk."),
  LI("0.4.5 public-database false positive, React Native safe area, live coverage, auto AI."),
  LI("0.4.6 live risk and coverage projection, concise clauses."),
  LI("0.4.7 context-aware risk, Terraform hints, verify command, study and kappa harnesses."),
  LI("0.4.8 78 resources, scope-aware negation, CI, CIS policy pack."),
  LI("0.5.0 one-tap harden to risk 0."),
  LI("0.5.1 scope guard rejects non-infrastructure input."),
  LI("0.5.2 deep-scan 404 fix and provider error detail."),
  LI("0.5.3 List models for my key."),
  LI("0.5.4 OpenCode Zen host permission."),
  LI("0.5.5 low-confidence indicator and Deep scan guidance."),
  LI("0.5.6 scope guard tightened; risky-only prompts remain in scope; demo cache-buster."),
  LI("0.5.7 deep scan hides the rule answer then reveals the merged result at once; a clean AI result shows a no-issues state; the improved prompt is hidden for out-of-scope input.")
];

// ------------------------------------------------------------------- output
const outDir = path.join(__dirname, "..", "docs");
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const docs = [
  ["Vector-Market-Analysis.docx", MARKET],
  ["Vector-Architecture.docx", ARCHITECTURE],
  ["Vector-Roadmap.docx", ROADMAP],
  ["Vector-Course-Plan-Mapping.docx", COURSE],
  ["Vector-Features.docx", FEATURES],
  ["Vector-Pipeline.docx", PIPELINE],
  ["Vector-Progress-Report.docx", PROGRESS]
];

for (const [name, blocks] of docs) {
  const buf = buildDocx(blocks);
  fs.writeFileSync(path.join(outDir, name), buf);
  console.log("wrote docs\\" + name + " (" + blocks.length + " blocks, " + buf.length + " bytes)");
}

// The progress report is the one we share on the weekly call, so keep a copy
// in the user's Downloads folder as well.
const shareDir = path.join(os.homedir(), "Downloads");
if (fs.existsSync(shareDir)) {
  const target = path.join(shareDir, "Vector-Progress-Report.docx");
  fs.copyFileSync(path.join(outDir, "Vector-Progress-Report.docx"), target);
  console.log("copied Vector-Progress-Report.docx to " + target);
}
