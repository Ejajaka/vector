"use strict";
const T = require("../src/taxonomy");
const { analyze, harden, buildImprovedPrompt } = require("../src/analyzer");
const { verifyText } = require("../src/tfcheck");

console.log("=== clauses that do NOT self-satisfy their own control ===");
for (const req of T.REQUIREMENTS) {
  const r = analyze(req.clause);
  if (r.missing.some((m) => m.id === req.id)) {
    console.log("  " + req.id + '  ->  "' + req.clause.slice(0, 70) + '"');
  }
}

const base = "Create an S3 bucket for user documents.";
const h = harden(base);
const r2 = analyze(h.prompt);
console.log("\n=== after harden ===");
console.log("clauses:", h.clauses.length, "| risk", r2.riskScore, "| coverage", r2.coverageScore + "%");
console.log("still missing:", r2.missing.map((m) => m.id).join(", ") || "none");
console.log("still risky  :", r2.riskyFindings.map((f) => f.id).join(", ") || "none");

// Which risky patterns match the hardened text?
const RE = T.RISKY_PATTERNS;
for (const rp of RE) {
  const re = new RegExp(rp.pattern, "gi");
  let m;
  while ((m = re.exec(h.prompt)) !== null) {
    console.log("risky match [" + rp.id + ']: "' + m[0] + '"');
    if (m.index === re.lastIndex) re.lastIndex++;
    break;
  }
}
