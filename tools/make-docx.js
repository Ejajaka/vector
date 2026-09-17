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

// ============================================================ PROGRESS REPORT
const PROGRESS = [
  T("Vector - Progress Report"),
  S("Pre-Generation Security Diagnosis of Cloud Infrastructure Prompts Using NLP"),

  H1("Team"),
  LI("Satya - bl.sc.u4cse24012"),
  LI("Roshna George - bl.sc.u4cse24043"),
  LI("Sanjeev Vakalapudi - bl.sc.u4cse24054"),
  LI("Team name: Vector - Directing intent toward optimal output."),
  LI("Report date: 16 September 2026. Time remaining: about six weeks."),

  H1("1. Where we are"),
  P("The core is built and running. Vector reads a plain-English AWS prompt, finds the security controls the prompt never states, flags risky statements, and turns every omission into a clause the user can add in one click."),
  LI("Engine: rule-based NLP, no ML and no network. 78 AWS resources, 30 controls, a negation and double-negation guard."),
  LI("Scoring: risk 0-100 with severity levels, confidence 0-100 with a baseline mode, and our own Prompt Security Coverage Score."),
  LI("Shipped surfaces: a Chrome extension (Manifest V3) with a popup and an in-page button on ChatGPT, Claude and Gemini, plus a CLI with a CI hook."),
  LI("Evidence: 29 unit tests, an evaluation harness over 112 hand-labelled prompts, and a downstream demo where insecure Terraform drops from 6 findings to 0."),
  LI("Grounding: CIS AWS Foundations, AWS Well-Architected (Security), AWS Foundational Security Best Practices, NIST SP 800-53 Rev.5, GDPR Art. 5 and 32, and the India DPDP Act 2023."),

  H1("2. Model strategy - extend, do not train"),
  P("We are not training a model. The deterministic rule engine stays the backbone and any AI is optional and additive."),
  LI("The deep scan asks an existing model only for controls the rules may have missed, merges the answer back, and badges every finding as rule or AI."),
  LI("Tier 1 is the browser's built-in model (Gemini Nano): no API key and no network. Tier 2 is any OpenAI-compatible endpoint with the user's own key."),
  LI("If neither tier is available the product still works, rules only. That fallback is a design requirement, not a nice-to-have."),
  LI("Fine-tuning or shipping our own weights is out of scope for the remaining time."),

  H1("3. Platform decisions from this review"),
  LI("PC: the Chrome extension stays the primary PC surface. It already runs in Chrome and Edge, and the CLI covers terminals and CI."),
  LI("Mobile: we are consolidating onto a single Expo (React Native) app that covers both iOS and Android from one codebase."),
  LI("Reason: we had two mobile attempts diverging, a Capacitor build and a standalone React Native project. Expo removes the duplication, gives both platforms from one codebase, and lets us test on a real phone through Expo Go without a store release."),
  LI("The engine is reused unchanged. Both the extension and the mobile app are clients of the same analyzer."),

  H1("4. Features - what matters and what does not"),
  H2("Core, must ship in the remaining time"),
  LI("Prompt analysis engine: resource detection, control detection and negation-safe matching."),
  LI("Missing-constraint detection against the standards-grounded taxonomy."),
  LI("Risky-statement detection: 0.0.0.0/0, public buckets, wildcard IAM, hard-coded secrets, and disabled logging or backups."),
  LI("Risk score, confidence score and Prompt Security Coverage Score."),
  LI("One-click clauses and the improved (hardened) prompt, with copy."),
  LI("PC: Chrome extension with popup and in-page button, plus the CLI with CI exit codes."),
  LI("Mobile: Expo app that takes a prompt, shows the diagnosis, accepts clauses and copies the hardened prompt."),
  LI("Optional AI deep scan with rule and AI badges, and a rules-only fallback."),
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
  LI("Post-deployment scanning, or reading live cloud accounts. That is precisely the problem we are replacing."),
  LI("Multi-cloud support. AWS first, and we only warn when a prompt targets Azure or GCP."),
  LI("Accounts, a backend server, analytics or telemetry. They break the offline and privacy stance that makes the tool easy to trust and easy to install."),
  LI("Multi-tenant SaaS, billing and role-based access control."),
  LI("An IDE plugin for VS Code. It is a third client, deferred past this term."),

  H1("5. Plan for the remaining six weeks"),
  LI("Week 1 - lock the mobile spec and the shared analysis payload, and expand the evaluation sets with adversarial paraphrases, targeting 150 or more cases."),
  LI("Week 2 - finish the Expo app: prompt input, report view, clause acceptance, copy and history."),
  LI("Week 3 - wire the app to the same engine, add offline caching and the deep-scan toggle."),
  LI("Week 4 - end-to-end testing on real Android and iOS phones, and fix detection gaps found on paraphrased prompts."),
  LI("Week 5 - re-run the evaluation, document the numbers honestly, and prepare the demo script."),
  LI("Week 6 - buffer: polish, update the README and this report, rehearse the demo, final submission."),

  H1("6. Risks"),
  LI("The evaluation sets are small and were tuned after seeing failures, so the current F1 is optimistic. Fixing that with a larger, harder set is week 1 work."),
  LI("The on-device model is only available on some Chrome versions and machines. The rules-only fallback covers this."),
  LI("Mobile is the newest surface, so scope creep is the main threat. Anything in the secondary list can be dropped without weakening the core claim."),
  LI("Store submissions add delay and review risk, so the mobile build ships as an installable APK and through Expo Go for the demo, not as a store listing."),

  H1("7. Next review"),
  P("We will report expanded evaluation results, the Expo app running on both platforms, a live demo from prompt to hardened prompt, and any detection gaps found on paraphrased prompts.")
];

// ========================================================== ARCHITECTURE DOC
const ARCHITECTURE = [
  T("Vector - Architecture & Pipeline"),
  S("Detailed system design for the pre-generation security diagnosis engine (v0.5.6, AWS-only, rule-based, offline)."),

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
  LI("Surfaces - extension (manifest.json, popup, content, options), CLI (cli/vector-cli.js), mobile (mobile/, mobile-rn/), web demo (demo/)."),
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
  LI("0.5.6 scope guard tightened; risky-only prompts remain in scope; demo cache-buster.")
];

// ------------------------------------------------------------------- output
const outDir = path.join(__dirname, "..", "docs");
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const docs = [
  ["Vector-Features.docx", FEATURES],
  ["Vector-Pipeline.docx", PIPELINE],
  ["Vector-Architecture.docx", ARCHITECTURE]
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
