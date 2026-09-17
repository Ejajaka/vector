"use strict";

const assert = require("assert");
const { analyze, buildImprovedPrompt, tokenize } = require("../src/analyzer");
const { project } = require("../src/analyzer");
const { harden } = require("../src/analyzer");

let passed = 0;
let failed = 0;
const queue = [];

function test(name, fn) {
  queue.push({ name, fn });
}

console.log("\nVector core analysis tests\n");

test("tokenization removes stopwords", () => {
  const tokens = tokenize("Create an S3 bucket and the EC2 instance");
  assert.ok(tokens.includes("s3"), "expected s3 token");
  assert.ok(tokens.includes("ec2"), "expected ec2 token");
  assert.ok(!tokens.includes("the"), "stopwords should be removed");
});

test("detects S3 and EC2 resources", () => {
  const r = analyze("Create an S3 bucket and an EC2 instance running a web server.");
  const ids = r.resources.map((x) => x.id);
  assert.ok(ids.includes("s3"), "s3 not detected");
  assert.ok(ids.includes("ec2"), "ec2 not detected");
});

test("flags missing encryption for an S3 bucket", () => {
  const r = analyze("Create an S3 bucket for user documents.");
  const missing = r.missing.map((m) => m.id);
  assert.ok(missing.includes("encryption_at_rest"), "encryption_at_rest should be missing");
  assert.ok(missing.includes("public_access_block"), "public_access_block should be missing");
});

test("does not flag a constraint that is stated", () => {
  const r = analyze("Create an S3 bucket encrypted at rest with a KMS key and block all public access.");
  const missing = r.missing.map((m) => m.id);
  assert.ok(!missing.includes("encryption_at_rest"), "encryption should be considered present");
  assert.ok(!missing.includes("public_access_block"), "public access should be considered present");
});

test("flags risky 0.0.0.0/0 exposure", () => {
  const r = analyze("Create an EC2 instance with a security group allowing SSH from 0.0.0.0/0.");
  const ids = r.riskyFindings.map((f) => f.id);
  assert.ok(ids.includes("open_ssh"), "open_ssh risky pattern not detected");
});

test("flags wildcard/admin IAM", () => {
  const r = analyze("Give the instance an IAM role with admin access.");
  const ids = r.riskyFindings.map((f) => f.id);
  assert.ok(ids.includes("wildcard_iam"), "wildcard_iam not detected");
});

test("detects missing least-privilege IAM", () => {
  const r = analyze("Create a lambda function that reads from S3.");
  const missing = r.missing.map((m) => m.id);
  assert.ok(missing.includes("least_privilege_iam"), "least privilege should be missing");
});

test("risk score increases with omissions", () => {
  const safe = analyze(
    "Create a private S3 bucket encrypted at rest with KMS and TLS in transit, block all public access, enable CloudTrail audit logging, versioning and backups, scoped least privilege IAM in eu-west-1."
  );
  const risky = analyze("Create an S3 bucket and make it public.");
  assert.ok(risky.riskScore > safe.riskScore, "risky prompt should score higher");
  assert.ok(["HIGH", "CRITICAL"].includes(risky.riskLevel), "public prompt should be high/critical");
});

test("fallback assessment when no resource recognised", () => {
  const r = analyze("Build an internal tool for the team.");
  assert.strictEqual(r.resources.length, 0);
  assert.ok(r.missing.length > 0, "fallback should still produce findings");
  assert.ok(r.riskScore > 0, "fallback should have a non-zero risk score");
  assert.strictEqual(r.coverage, "baseline");
});

test("synonym expansion detects a web server as compute + endpoint", () => {
  const r = analyze("Set up a website for our customers.");
  const ids = r.resources.map((x) => x.id);
  assert.ok(ids.includes("ec2") || ids.includes("load_balancer"), "website should map to AWS resources");
});

test("negation guard ignores 'do not make it public'", () => {
  const r = analyze("Create an S3 bucket but do not make it public.");
  const risky = r.riskyFindings.map((f) => f.id);
  assert.ok(!risky.includes("public_bucket"), "negated public statement should not be flagged risky");
});

test("negation guard treats 'do not encrypt' as a missing control", () => {
  const r = analyze("Create an S3 bucket and do not encrypt it.");
  const missing = r.missing.map((m) => m.id);
  assert.ok(missing.includes("encryption_at_rest"), "negated encryption should count as missing");
});

test("unencrypted is normalised and flagged", () => {
  const r = analyze("Store the data unencrypted in an S3 bucket.");
  assert.ok(r.riskyFindings.some((f) => f.id === "no_encryption"), "unencrypted should be risky");
});

test("mergeFindings adds external deep-scan findings without duplicates", () => {
  const base = analyze("Create an S3 bucket.");
  const merged = require("../src/analyzer").mergeFindings(base, {
    missing: [{ label: "Object Lock / WORM", severity: "low", clause: "Enable S3 Object Lock." }],
    risky: [{ label: "Cross-account access", severity: "high", fix: "Remove cross-account trust." }]
  });
  assert.ok(merged.missing.some((m) => m.source === "ai"), "ai missing finding should be merged");
  assert.ok(merged.riskyFindings.some((f) => f.source === "ai"), "ai risky finding should be merged");
  assert.ok(merged.missing.some((m) => m.label === "Encryption at rest"), "original findings preserved");
});

test("buildImprovedPrompt appends clauses", () => {
  const out = buildImprovedPrompt("Create an S3 bucket.", [
    "Encrypt data at rest.",
    "Block public access."
  ]);
  assert.ok(out.includes("Create an S3 bucket."));
  assert.ok(out.includes("Security requirements:"));
  assert.ok(out.includes("- Encrypt data at rest."));
  assert.ok(out.includes("- Block public access."));
});

test("custom policy adds an always-required rule", () => {
  const policy = {
    requirements: [
      {
        id: "org_tagging",
        label: "Mandatory tagging",
        severity: "medium",
        description: "Tag all resources.",
        clause: "Tag every resource with Owner and Environment.",
        patterns: ["tagged", "tags"]
      }
    ]
  };
  const r = analyze("Create an S3 bucket encrypted at rest.", { policy });
  const missing = r.missing.map((m) => m.id);
  assert.ok(missing.includes("org_tagging"), "custom policy requirement should be missing");
});

test("custom policy risky pattern is honoured", () => {
  const policy = {
    riskyPatterns: [
      { id: "banned_region", pattern: "us-east-1", label: "Banned region", severity: "high", fix: "Use eu-west-1." }
    ]
  };
  const r = analyze("Deploy an S3 bucket in us-east-1.", { policy });
  const ids = r.riskyFindings.map((f) => f.id);
  assert.ok(ids.includes("banned_region"), "custom risky pattern not detected");
});

test("every missing constraint carries a fillable clause", () => {
  const r = analyze("Create an RDS database and an EC2 instance.");
  for (const m of r.missing) {
    assert.ok(typeof m.clause === "string" && m.clause.length > 5, "missing clause for " + m.id);
  }
});

// ---- UI renderer tests (src/ui.js) ----
const VectorUI = require("../src/ui");

test("UI: buildImprovedPrompt appends clauses", () => {
  const out = VectorUI.buildImprovedPrompt("Create a bucket.", ["Encrypt it."]);
  assert.ok(out.includes("Security requirements:"));
  assert.ok(out.includes("- Encrypt it."));
});

test("UI: acceptedClauses reads state", () => {
  const r = analyze("Create an S3 bucket.");
  const first = r.missing[0];
  const clauses = VectorUI.acceptedClauses(r, { accepted: { [first.id]: true } });
  assert.strictEqual(clauses.length, 1);
  assert.strictEqual(clauses[0], first.clause);
});

test("UI: missingHtml renders an AI badge for deep-scan findings", () => {
  const html = VectorUI.missingHtml(
    { missing: [{ id: "x", label: "Test", severity: "low", dimension: "x", description: "d", clause: "c", standards: [], source: "ai" }] },
    {}
  );
  assert.ok(html.includes("v-tag ai"), "AI badge should appear");
});

test("UI: escapeHtml neutralises tags", () => {
  assert.strictEqual(VectorUI.escapeHtml("<b>"), "&lt;b&gt;");
});

// ---- LLM helper tests (src/llm.js) ----
const VectorLLM = require("../src/llm");

test("LLM: parseFindings normalises and caps results", () => {
  const out = VectorLLM.parseFindings('{"missing":[{"label":"X","severity":"weird"}],"risky":[]}');
  assert.strictEqual(out.missing.length, 1);
  assert.strictEqual(out.missing[0].severity, "medium");
  assert.strictEqual(out.missing[0].source, "ai");
});

test("LLM: parseFindings tolerates surrounding prose", () => {
  const out = VectorLLM.parseFindings('Here you go:\n{"missing":[],"risky":[{"label":"Y"}]}\nThanks');
  assert.strictEqual(out.risky.length, 1);
  assert.strictEqual(out.risky[0].label, "Y");
});

test("LLM: parseFindings throws when no JSON", () => {
  assert.throws(() => VectorLLM.parseFindings("no json here"), /JSON/);
});

test("LLM: hostedDeepScan calls the API and parses the reply", async () => {
  const realFetch = global.fetch;
  global.fetch = async () => ({
    ok: true,
    json: async () => ({ choices: [{ message: { content: '{"missing":[{"label":"Z","severity":"high"}]}' } }] })
  });
  try {
    const out = await VectorLLM.hostedDeepScan("prompt", { apiKey: "k" });
    assert.strictEqual(out.missing[0].label, "Z");
  } finally {
    global.fetch = realFetch;
  }
});

test("LLM: hostedDeepScan throws without a key", async () => {
  await assert.rejects(() => VectorLLM.hostedDeepScan("p", {}), /API key/);
});

test("LLM: localAvailable is false when there is no browser model", () => {
  assert.strictEqual(VectorLLM.localAvailable(), false);
});

test("analyzer exposes needsDeepScan for vague prompts", () => {
  const r = analyze("Build an internal tool for the team.");
  assert.strictEqual(r.needsDeepScan, true);
});

// ---- Coverage score ----
test("coverage: a bare prompt has low coverage, a detailed one high", () => {
  const low = analyze("Create an S3 bucket.");
  const high = analyze(
    "Create a private S3 bucket encrypted at rest with KMS and TLS in transit, block all public access, " +
    "enable CloudTrail audit logging, versioning, backups, least privilege IAM, data classification and " +
    "retention, and deploy only in eu-west-1."
  );
  assert.ok(low.coverageScore < high.coverageScore, "coverage should increase with detail");
  assert.ok(high.coverageScore >= 60, "detailed prompt should have solidly higher coverage");
  assert.ok(high.coverageScore - low.coverageScore >= 40, "coverage gap should be large");
});

test("coverage: UI projects before -> after as clauses are accepted", () => {
  const r = analyze("Create an S3 bucket.");
  const before = r.coverageScore;
  const accepted = {};
  accepted[r.missing[0].id] = true;
  const cov = VectorUI.coverage(r, { accepted });
  assert.strictEqual(cov.before, before);
  assert.ok(cov.after > cov.before, "accepting a clause should raise coverage");
});

// ---- TF-IDF semantic module ----
const VectorSemantic = require("../src/semantic");

test("semantic: tokenize lowercases and strips plural", () => {
  const t = VectorSemantic.tokenize("Buckets Encrypted");
  assert.ok(t.includes("bucket"), "plural should be stemmed");
  assert.ok(t.includes("encrypt"));
});

test("semantic: identical vectors have cosine ~1", () => {
  const controls = [{ id: "x", label: "Encryption at rest", description: "encrypt data", clause: "encrypt at rest" }];
  const idx = VectorSemantic.buildIndex(controls);
  const q = VectorSemantic.vectorize(VectorSemantic.tokenize("encrypt data at rest"), idx.idf);
  assert.ok(VectorSemantic.cosine(q, idx.vectors.get("x")) > 0.9);
});

test("semantic: related controls are reported for a prompt", () => {
  const r = analyze("Turn on the trail so we can see who did what");
  assert.ok(Array.isArray(r.semanticRelated));
  assert.ok(r.semanticRelated.length > 0, "should report at least one related control");
});

// ---- Paraphrase lexicon ----
test("paraphrase: 'data scrambled on disk' satisfies encryption at rest", () => {
  const r = analyze("Make sure the data is scrambled on disk");
  assert.ok(!r.missing.some((m) => m.id === "encryption_at_rest"), "should be treated as stated");
});

test("paraphrase: 'trail / who did what' satisfies audit logging", () => {
  const r = analyze("Turn on the trail so we can see who did what");
  assert.ok(!r.missing.some((m) => m.id === "audit_logging"), "should be treated as stated");
});

test("paraphrase: 'locked down' satisfies network restriction", () => {
  const r = analyze("Keep the network locked down");
  assert.ok(!r.missing.some((m) => m.id === "network_restricted"), "should be treated as stated");
});

test("paraphrase: 'second factor' satisfies MFA", () => {
  const r = analyze("Require a second factor for all users");
  assert.ok(!r.missing.some((m) => m.id === "mfa"), "should be treated as stated");
});

test("risky: 'world-readable' flags public storage", () => {
  const r = analyze("Make the bucket world-readable");
  assert.ok(r.riskyFindings.some((f) => f.id === "public_bucket"));
});

// ---- Non-AWS guard ----
test("non-AWS: an Azure prompt is flagged as non-AWS", () => {
  const r = analyze("Create an Azure Blob Storage account for documents");
  assert.strictEqual(r.nonAwsLikely, true);
  assert.ok(!r.resources.some((x) => x.id === "s3"), "must not be mistaken for S3");
});

test("non-AWS: an AWS prompt is not flagged", () => {
  const r = analyze("Create an S3 bucket");
  assert.strictEqual(r.nonAwsLikely, false);
});

// ---- Disclaimer ----
test("report carries an advisory disclaimer", () => {
  const r = analyze("Create an S3 bucket");
  assert.ok(/advisory/i.test(r.disclaimer));
});

// ---- Live score projection ----
test("project: accepting clauses lowers risk and raises coverage", () => {
  const r = analyze("Create an S3 bucket.");
  const before = project(r, {});
  const all = {};
  r.missing.forEach((m) => (all[m.id] = true));
  const after = project(r, all);
  assert.ok(after.riskScore < before.riskScore, "risk should fall");
  assert.ok(after.coverageScore > before.coverageScore, "coverage should rise");
});

test("project: accepting every clause reaches 100% coverage and 0 risk", () => {
  const r = analyze("Create an S3 bucket for user uploads.");
  const all = {};
  r.missing.forEach((m) => (all[m.id] = true));
  r.riskyFindings.forEach((f) => (all[f.id] = true));
  const p = project(r, all);
  assert.strictEqual(p.coverageScore, 100);
  assert.strictEqual(p.riskScore, 0);
});

test("clauses are concise (single sentence, under 160 chars)", () => {
  const r = analyze("Create an S3 bucket and an RDS database.");
  for (const m of r.missing) {
    assert.ok(m.clause.length <= 160, "clause too long for " + m.id + ": " + m.clause.length);
  }
});

test("public database is no longer a false positive", () => {
  const r = analyze(
    "Public-facing EC2 web/API, an S3 bucket, an RDS PostgreSQL database. Available over the internet and survives an instance failure."
  );
  assert.ok(!r.riskyFindings.some((f) => f.id === "public_database"), "should not flag a public DB here");
});

// ---- Context awareness ----
test("context: a dev/sandbox prompt scores lower than production", () => {
  const dev = analyze("Create a dev sandbox S3 bucket for testing.");
  const prod = analyze("Create a production S3 bucket for customer data.");
  assert.ok(dev.riskScore < prod.riskScore, "dev should be lower risk than prod");
  assert.strictEqual(dev.environment, "dev");
  assert.strictEqual(prod.environment, "prod");
});

// ---- Terraform hints ----
test("every missing control carries a Terraform hint", () => {
  const r = analyze("Create an S3 bucket and an RDS database.");
  assert.ok(r.missing.length > 0);
  for (const m of r.missing) {
    assert.ok(typeof m.tf === "string" && m.tf.length > 0, "missing tf hint for " + m.id);
  }
});

// ---- Post-generation Terraform verification ----
const { verifyText } = require("../src/tfcheck");

test("tfcheck: flags an insecure Terraform file", () => {
  const tf = [
    'resource "aws_s3_bucket" "d" { acl = "public-read" }',
    'resource "aws_db_instance" "db" { engine = "postgres" }',
    'resource "aws_security_group" "sg" { ingress { cidr_blocks = ["0.0.0.0/0"] } }',
    'resource "aws_iam_policy" "p" { policy = jsonencode({ Action = "*", Resource = "*" }) }'
  ].join("\n");
  const issues = verifyText(tf);
  const ids = issues.map((i) => i.id);
  assert.ok(ids.includes("public_acl"));
  assert.ok(ids.includes("open_cidr"));
  assert.ok(ids.includes("no_rds_encryption"));
  assert.ok(ids.includes("wildcard_iam"));
});

test("tfcheck: a hardened Terraform file passes the built-in checks", () => {
  const tf = [
    'resource "aws_s3_bucket" "d" { bucket = "d" }',
    'resource "aws_s3_bucket_public_access_block" "d" { bucket = aws_s3_bucket.d.id block_public_acls = true }',
    'resource "aws_s3_bucket_server_side_encryption_configuration" "d" { bucket = aws_s3_bucket.d.id }',
    'resource "aws_s3_bucket_versioning" "d" { bucket = aws_s3_bucket.d.id }',
    'resource "aws_db_instance" "db" { storage_encrypted = true backup_retention_period = 7 }',
    'resource "aws_security_group" "sg" { ingress { cidr_blocks = ["10.0.0.0/8"] } }',
    'resource "aws_cloudtrail" "t" { name = "t" }'
  ].join("\n");
  const issues = verifyText(tf);
  assert.strictEqual(issues.length, 0, "expected no issues, got: " + issues.map((i) => i.id).join(","));
});

// ---- Harden (iterative) ----
test("harden: a plain prompt becomes a zero-risk prompt", () => {
  const h = harden("Create an S3 bucket for user documents.");
  assert.strictEqual(h.report.riskScore, 0, "risk should be 0");
  assert.strictEqual(h.report.coverageScore, 100, "coverage should be 100%");
});

test("harden: risky phrases are neutralised to zero", () => {
  const h = harden(
    "Create an S3 bucket and an EC2 instance with a security group that allows SSH from 0.0.0.0/0. Give the instance an IAM role with admin access."
  );
  assert.strictEqual(h.report.riskScore, 0, "risk should be 0");
  assert.strictEqual(h.report.riskyFindings.length, 0, "no risky findings should remain");
  assert.ok(!/0\.0\.0\.0\/0/.test(h.prompt), "0.0.0.0/0 should be neutralised");
});

test("harden: an RDS prompt reaches zero as well", () => {
  const h = harden("Create an RDS PostgreSQL database for application data and an S3 bucket for uploads.");
  assert.strictEqual(h.report.riskScore, 0);
  assert.strictEqual(h.report.coverageScore, 100);
});

test("harden: every clause is self-satisfying (no residual misses)", () => {
  const h = harden("Create an S3 bucket for user documents.");
  assert.strictEqual(h.report.missing.length, 0, "still missing: " + h.report.missing.map((m) => m.id).join(","));
});

// ---- Scope guard ----
test("scope: off-topic input is rejected with no findings", () => {
  for (const t of ["i will kill u", "hello world", "what is 2+2", "tell me a joke"]) {
    const r = analyze(t);
    assert.strictEqual(r.outOfScope, true, "should be out of scope: " + t);
    assert.strictEqual(r.missing.length, 0);
    assert.strictEqual(r.riskyFindings.length, 0);
    assert.strictEqual(r.riskScore, 0);
  }
});

test("scope: a vague but infrastructure prompt is still analysed", () => {
  const r = analyze("Build an internal tool for the team.");
  assert.ok(!r.outOfScope, "should remain in scope");
  assert.ok(r.missing.length > 0);
});

test("scope: harden leaves an off-topic prompt unchanged", () => {
  const h = harden("i will kill u");
  assert.strictEqual(h.clauses.length, 0);
  assert.strictEqual(h.prompt, "i will kill u");
});

test("scope: an ambiguous word alone is not infrastructure", () => {
  for (const t of ["i want a bucket full of water", "a bucket of water", "i need a queue for the tickets"]) {
    const r = analyze(t);
    assert.strictEqual(r.outOfScope, true, "should be out of scope: " + t);
    assert.strictEqual(r.stats.missing, 0);
  }
});

test("scope: real infrastructure prompts stay in scope", () => {
  for (const t of [
    "Create an S3 bucket for user documents.",
    "Create a bucket for user files.",
    "Build an internal tool for the team.",
    "Deploy our application to the cloud."
  ]) {
    assert.ok(!analyze(t).outOfScope, "should be in scope: " + t);
  }
});

test("scope: a risky statement alone is still in scope", () => {
  const a = analyze("Hard-code the database password in the application.");
  assert.ok(!a.outOfScope);
  assert.ok(a.riskyFindings.some((f) => f.id === "hardcoded_secret"));
  const b = analyze("Send data in plaintext over the network.");
  assert.ok(!b.outOfScope);
  assert.ok(b.riskyFindings.some((f) => f.id === "no_encryption"));
});

(async function run() {
  for (const t of queue) {
    try {
      await t.fn();
      passed++;
      console.log("  PASS  " + t.name);
    } catch (err) {
      failed++;
      console.log("  FAIL  " + t.name);
      console.log("        " + err.message);
    }
  }
  console.log("\n" + passed + " passed, " + failed + " failed\n");
  process.exit(failed === 0 ? 0 : 1);
})();
