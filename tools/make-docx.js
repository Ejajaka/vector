"use strict";

/**
 * Build Word documents (.docx) for Vector: a feature list and a detailed
 * pipeline. A .docx is just a ZIP of XML parts, so we generate the parts and
 * zip them. No dependencies.
 *
 * Run:  node tools/make-docx.js
 */

const fs = require("fs");
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
  LI("Resource detection - recognises 59 AWS services (S3, EC2, RDS, Lambda, IAM, EKS, DynamoDB, CloudFront, WAF, KMS, and more), including synonyms and regex aliases."),
  LI("Security requirement detection - recognises controls already stated in the prompt."),
  LI("Missing-constraint detection - flags omitted controls such as encryption, IAM scope, public access, audit logging, data residency, backups and key rotation."),
  LI("Risky-statement detection - catches 0.0.0.0/0, public buckets, wildcard/admin IAM, hard-coded secrets, and disabled logging / backups / MFA."),
  LI("Negation handling - \"do not make it public\" is not treated as public; double negatives are handled (\"not unencrypted\" = encrypted)."),
  LI("Standards-grounded taxonomy - 30 controls mapped to CIS AWS, AWS Well-Architected, AWS Foundational Security Best Practices, NIST SP 800-53 and GDPR / DPDP."),
  LI("Risk score - 0-100 with CRITICAL / HIGH / MEDIUM / LOW."),
  LI("Confidence score - 0-100 (high / medium / low) indicating how complete the analysis is."),
  LI("Baseline mode - unrecognised prompts still receive baseline AWS controls; never returns an empty result."),
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

  H2("Step 5 - Resource detection"),
  P("Each of the 59 AWS resources has a list of aliases. An alias is matched either as a plain phrase (word-boundary aware) or as a regular expression, chosen automatically by whether it contains regex metacharacters."),
  C("plain phrase : \"s3 bucket\"       (word-boundary match)"),
  C("regex alias  : \"\\\\becr\\\\b\", \"route.?53\"  (regex match)"),
  P("This distinction matters: escaping a regex alias would make it never match (a bug the evaluation caught)."),

  H2("Step 6 - Policy merge (applyPolicy)"),
  P("Before detection, any custom organisation policy is merged into the built-in rules."),
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
  P("The shared renderer (src/ui.js) draws the report. Accepting clauses calls buildImprovedPrompt to produce the hardened prompt, which can be copied."),

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

// ------------------------------------------------------------------- output
const outDir = path.join(__dirname, "..", "docs");
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const docs = [
  ["Vector-Features.docx", FEATURES],
  ["Vector-Pipeline.docx", PIPELINE]
];

for (const [name, blocks] of docs) {
  const buf = buildDocx(blocks);
  fs.writeFileSync(path.join(outDir, name), buf);
  console.log("wrote docs\\" + name + " (" + blocks.length + " blocks, " + buf.length + " bytes)");
}
