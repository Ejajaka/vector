"use strict";
const T = require("../src/taxonomy");
const { analyze, harden } = require("../src/analyzer");

const prompts = [
  "Create an S3 bucket to store user documents and an EC2 instance running a web server with a security group that allows SSH from 0.0.0.0/0. Give the instance an IAM role with admin access.",
  "Create an RDS PostgreSQL database for application data and an S3 bucket for uploads."
];

for (const p of prompts) {
  const h = harden(p);
  console.log("\n=== " + p.slice(0, 55) + " ===");
  console.log("risk", h.report.riskScore, "coverage", h.report.coverageScore + "%", "risky", h.report.riskyFindings.map((f) => f.id).join(",") || "none");
  const lines = h.prompt.split(/\n/);
  for (const rp of T.RISKY_PATTERNS) {
    const re = new RegExp(rp.pattern, "gi");
    for (const line of lines) {
      re.lastIndex = 0;
      const m = re.exec(line);
      if (m) {
        console.log('  [' + rp.id + '] matched "' + m[0] + '" in: ' + line.trim().slice(0, 80));
      }
    }
  }
}
