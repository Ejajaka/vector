"use strict";

/**
 * Downstream proof demo.
 *
 * The claim Vector makes is: "missing security constraints in the prompt
 * become insecure infrastructure". To show that, we scan two pairs of
 * Terraform that a model would produce from an insecure prompt vs from the
 * hardened prompt, using a small regex checker (same controls Vector raises).
 *
 * Run:  node eval/downstream/run-downstream.js
 */

const fs = require("fs");
const path = require("path");

// Each check returns true when the TERRAFORM FILE HAS THE PROBLEM.
const CHECKS = [
  { id: "public_acl", label: "Public S3 ACL", test: (t) => /acl\s*=\s*"public/.test(t) },
  { id: "no_public_block", label: "No S3 public access block", test: (t) => /aws_s3_bucket"/.test(t) && !/aws_s3_bucket_public_access_block/.test(t) },
  { id: "no_encryption", label: "Storage not encrypted at rest", test: (t) => /aws_s3_bucket"/.test(t) && !/server_side_encryption/.test(t) },
  { id: "open_cidr", label: "Security group open to 0.0.0.0/0", test: (t) => /0\.0\.0\.0\/0/.test(t) },
  { id: "wildcard_iam", label: "Wildcard IAM action/resource", test: (t) => /Action\s*=\s*"\*"|Resource\s*=\s*"\*"/.test(t) },
  { id: "no_logging", label: "No audit logging (CloudTrail)", test: (t) => !/aws_cloudtrail/.test(t) }
];

function scan(file) {
  const text = fs.readFileSync(path.join(__dirname, file), "utf8");
  return CHECKS.filter((c) => c.test(text));
}

const before = scan("insecure.tf");
const after = scan("secured.tf");

console.log("\nDownstream check: does the hardened prompt lead to safer Terraform?\n");
console.log("BEFORE (from the raw prompt) - " + before.length + " issue(s):");
before.forEach((c) => console.log("   FAIL  " + c.label));
if (!before.length) console.log("   (none)");

console.log("\nAFTER (from the Vector-hardened prompt) - " + after.length + " issue(s):");
after.forEach((c) => console.log("   FAIL  " + c.label));
if (!after.length) console.log("   PASS  all checked controls present");

console.log("\nSummary: " + before.length + " -> " + after.length + " issues.");
console.log("Note: a real study would generate the Terraform with a model and run");
console.log("tfsec/checkov. This demo uses hand-written examples and a small checker.\n");

process.exit(after.length < before.length ? 0 : 1);
