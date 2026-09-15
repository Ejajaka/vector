"use strict";

/**
 * Vector evaluation harness.
 *
 * Reports precision / recall / F1 for:
 *   - missing-constraint detection
 *   - risky-statement detection
 *   - negation traps
 * over the tuning set (dataset.json) AND a held-out set (heldout.json) that
 * was labelled without adapting the engine afterwards.
 *
 * Run:  node eval/run-eval.js            (both sets)
 *       node eval/run-eval.js dataset.json
 */

const path = require("path");
const fs = require("fs");
const { analyze } = require("../src/analyzer");

function pct(n, d) {
  return d === 0 ? "-" : ((100 * n) / d).toFixed(1) + "%";
}
function ratio(n, d) {
  return d === 0 ? 0 : n / d;
}

function evaluate(file) {
  const data = JSON.parse(fs.readFileSync(path.join(__dirname, file), "utf8"));
  const t = {
    flagTP: 0, flagFP: 0, flagFN: 0,
    riskyTP: 0, riskyFP: 0, riskyFN: 0,
    negChecks: 0, negFails: 0
  };
  const problems = [];
  const byCategory = {};

  for (const c of data.cases) {
    const r = analyze(c.prompt);
    const predMissing = new Set(r.missing.map((m) => m.id));
    const predRisky = new Set(r.riskyFindings.map((f) => f.id));

    const mustFlag = c.mustFlag || [];
    const mustNotFlag = c.mustNotFlag || [];
    const risky = c.risky || [];
    const notRisky = c.notRisky || [];

    const missed = mustFlag.filter((id) => !predMissing.has(id));
    const overflagged = mustNotFlag.filter((id) => predMissing.has(id));
    const missedRisky = risky.filter((id) => !predRisky.has(id));
    const wrongRisky = Array.from(predRisky).filter((id) => !risky.includes(id));
    const negFails = notRisky.filter((id) => predRisky.has(id));

    t.flagTP += mustFlag.length - missed.length;
    t.flagFN += missed.length;
    t.flagFP += overflagged.length;
    t.riskyTP += risky.length - missedRisky.length;
    t.riskyFN += missedRisky.length;
    t.riskyFP += wrongRisky.length;
    t.negChecks += notRisky.length;
    t.negFails += negFails.length;

    const cat = (byCategory[c.category] = byCategory[c.category] || { tp: 0, fp: 0, fn: 0, cases: 0 });
    cat.tp += mustFlag.length - missed.length;
    cat.fn += missed.length;
    cat.fp += overflagged.length;
    cat.cases += 1;

    if (missed.length || overflagged.length || missedRisky.length || wrongRisky.length || negFails.length) {
      problems.push({ id: c.id, missed, overflagged, missedRisky, wrongRisky, negFails });
    }
  }

  const flagP = ratio(t.flagTP, t.flagTP + t.flagFP);
  const flagR = ratio(t.flagTP, t.flagTP + t.flagFN);
  const flagF1 = flagP + flagR === 0 ? 0 : (2 * flagP * flagR) / (flagP + flagR);
  const riskyP = ratio(t.riskyTP, t.riskyTP + t.riskyFP);
  const riskyR = ratio(t.riskyTP, t.riskyTP + t.riskyFN);
  const riskyF1 = riskyP + riskyR === 0 ? 0 : (2 * riskyP * riskyR) / (riskyP + riskyR);

  const line = "=".repeat(66);
  console.log("\n" + line);
  console.log("Set: " + file + "  (" + data.cases.length + " cases)");
  console.log(line);
  console.log("Missing-constraint  P " + pct(t.flagTP, t.flagTP + t.flagFP) +
    "  R " + pct(t.flagTP, t.flagTP + t.flagFN) + "  F1 " + flagF1.toFixed(3) +
    "   (TP " + t.flagTP + ", FP " + t.flagFP + ", FN " + t.flagFN + ")");
  console.log("Risky-statement     P " + pct(t.riskyTP, t.riskyTP + t.riskyFP) +
    "  R " + pct(t.riskyTP, t.riskyTP + t.riskyFN) + "  F1 " + riskyF1.toFixed(3) +
    "   (TP " + t.riskyTP + ", FP " + t.riskyFP + ", FN " + t.riskyFN + ")");
  console.log("Negation traps      " + t.negChecks + " checks, " + t.negFails + " failures" +
    " (" + pct(t.negFails, t.negChecks) + ")");

  if (problems.length) {
    console.log("\nDeviations:");
    for (const p of problems) {
      const bits = [];
      if (p.missed.length) bits.push("missed=" + p.missed.join(","));
      if (p.overflagged.length) bits.push("overflagged=" + p.overflagged.join(","));
      if (p.missedRisky.length) bits.push("missedRisky=" + p.missedRisky.join(","));
      if (p.wrongRisky.length) bits.push("wrongRisky=" + p.wrongRisky.join(","));
      if (p.negFails.length) bits.push("negFails=" + p.negFails.join(","));
      console.log("  - " + p.id.padEnd(22) + bits.join("  "));
    }
  }

  return { flagF1, flagR, riskyR, negFails: t.negFails, cases: data.cases.length };
}

const files = process.argv.slice(2);
const toRun = files.length ? files : ["dataset.json", "dataset2.json", "heldout.json"];
const results = toRun.map(evaluate);

const worstF1 = Math.min.apply(null, results.map((r) => r.flagF1));
const totalNegFails = results.reduce((a, r) => a + r.negFails, 0);

console.log("\n" + "=".repeat(66));
console.log("Overall worst F1 across sets: " + worstF1.toFixed(3) +
  " | total negation failures: " + totalNegFails);
console.log("=".repeat(66) + "\n");

process.exit(worstF1 >= 0.6 && totalNegFails <= 2 ? 0 : 1);
