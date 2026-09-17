"use strict";

/**
 * Inter-annotator agreement (Cohen's kappa).
 *
 * Takes two independently produced label files and reports agreement over
 * (case, control) decisions. Used to show the benchmark is not one person's
 * opinion.
 *
 * Label file format (JSON):
 *   { "case-id": ["encryption_at_rest", "audit_logging", ...], ... }
 * The arrays list the controls the annotator says are MISSING for that case.
 *
 * Usage:
 *   node eval/kappa.js eval/labels/annotator-a.json eval/labels/annotator-b.json
 */

const fs = require("fs");

function load(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function kappa(a, b) {
  const cases = Object.keys(a).filter((k) => Object.prototype.hasOwnProperty.call(b, k));
  let n11 = 0, n10 = 0, n01 = 0, n00 = 0;
  for (const c of cases) {
    const setA = new Set(a[c] || []);
    const setB = new Set(b[c] || []);
    const union = new Set([...setA, ...setB]);
    for (const id of union) {
      const inA = setA.has(id);
      const inB = setB.has(id);
      if (inA && inB) n11++;
      else if (inA && !inB) n10++;
      else if (!inA && inB) n01++;
      else n00++;
    }
  }
  const n = n11 + n10 + n01 + n00;
  if (n === 0) return null;
  const po = (n11 + n00) / n;
  const pA1 = (n11 + n10) / n;
  const pB1 = (n11 + n01) / n;
  const pe = pA1 * pB1 + (1 - pA1) * (1 - pB1);
  const k = pe === 1 ? 1 : (po - pe) / (1 - pe);
  return { cases: cases.length, decisions: n, observed: po, expected: pe, kappa: k };
}

const [fileA, fileB] = process.argv.slice(2);
if (!fileA || !fileB) {
  console.error("Usage: node eval/kappa.js <annotator-a.json> <annotator-b.json>");
  process.exit(1);
}

const r = kappa(load(fileA), load(fileB));
if (!r) {
  console.error("No overlapping cases.");
  process.exit(1);
}

console.log("\nInter-annotator agreement");
console.log("  cases            : " + r.cases);
console.log("  decisions        : " + r.decisions);
console.log("  observed agreement: " + (100 * r.observed).toFixed(1) + "%");
console.log("  Cohen's kappa    : " + r.kappa.toFixed(3));
console.log("  (0.61-0.80 substantial, 0.81+ almost perfect)\n");
