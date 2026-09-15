#!/usr/bin/env node
"use strict";

/**
 * Vector CLI - pre-generation security diagnosis for cloud prompts.
 *
 * Usage:
 *   vector analyze "Create an S3 bucket and an EC2 instance"
 *   vector analyze --json "prompt text"
 *   vector analyze-file prompt.txt
 *   echo "prompt" | vector analyze
 *   vector improved "prompt"            # prints prompt + all missing clauses
 *   vector hook                          # stdin: exits 2 if CRITICAL, 1 if HIGH
 *
 * Options:
 *   --policy <file>   path to a policy JSON file
 *   --strict          treat medium severity as high
 *   --json            machine-readable output
 */

const fs = require("fs");
const path = require("path");
const { analyze, buildImprovedPrompt } = require("../src/analyzer");

function parseArgs(argv) {
  const args = { command: null, positional: [], flags: {} };
  const raw = argv.slice(2);
  for (let i = 0; i < raw.length; i++) {
    const a = raw[i];
    if (a === "--json") args.flags.json = true;
    else if (a === "--strict") args.flags.strict = true;
    else if (a === "--policy") args.flags.policy = raw[++i];
    else if (!args.command) args.command = a;
    else args.positional.push(a);
  }
  return args;
}

function readStdin() {
  try {
    return fs.readFileSync(0, "utf8");
  } catch (e) {
    return "";
  }
}

function loadPolicy(policyPath) {
  if (!policyPath) {
    const local = path.join(process.cwd(), ".vector", "policy.json");
    if (fs.existsSync(local)) policyPath = local;
  }
  if (!policyPath || !fs.existsSync(policyPath)) return null;
  return JSON.parse(fs.readFileSync(policyPath, "utf8"));
}

function getPrompt(args) {
  if (args.command === "analyze-file") {
    const file = args.positional[0];
    return file ? fs.readFileSync(file, "utf8") : "";
  }
  if (args.positional.length) return args.positional.join(" ");
  return readStdin();
}

const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  green: "\x1b[32m",
  cyan: "\x1b[36m"
};

function sevColor(s) {
  if (s === "high") return C.red;
  if (s === "medium") return C.yellow;
  return C.green;
}

function printReport(report) {
  const r = report;
  console.log("");
  console.log(
    C.bold + "Vector security diagnosis" + C.reset +
      C.dim + "  (pre-generation prompt analysis)" + C.reset
  );
  console.log(
    "Risk: " +
      C.bold + r.riskLevel + C.reset +
      " (" + r.riskScore + "/100)   " +
      C.dim +
      r.stats.resources + " resource(s), " +
      r.stats.mentioned + " present, " +
      r.stats.missing + " missing, " +
      r.stats.risky + " risky" +
      C.reset
  );
  const total = r.stats.mentioned + r.stats.missing;
  console.log(
    "Coverage: " + C.bold + r.coverageScore + "%" + C.reset +
      C.dim + " (" + r.stats.mentioned + "/" + total + " controls stated)" + C.reset
  );
  console.log("");

  if (r.resources.length) {
    console.log(C.cyan + "Detected resources:" + C.reset + " " + r.resources.map((x) => x.label).join(", "));
  }
  if (r.mentioned.length) {
    console.log(C.green + "Security already stated:" + C.reset + " " + r.mentioned.map((x) => x.label).join(", "));
  }

  if (r.riskyFindings.length) {
    console.log("");
    console.log(C.bold + "Risky statements:" + C.reset);
    for (const f of r.riskyFindings) {
      console.log("  " + sevColor(f.severity) + "[" + f.severity.toUpperCase() + "]" + C.reset + " " + f.label);
      console.log("    " + C.dim + f.description + C.reset);
      console.log("    Fix: " + f.fix);
    }
  }

  if (r.missing.length) {
    console.log("");
    console.log(C.bold + "Missing security constraints:" + C.reset);
    for (const m of r.missing) {
      console.log("  " + sevColor(m.severity) + "[" + m.severity.toUpperCase() + "]" + C.reset + " " + m.label + C.dim + " (" + m.dimension + ")" + C.reset);
      console.log("    add: " + m.clause);
      if (m.standards && m.standards.length) {
        console.log("    " + C.dim + m.standards.join(" | ") + C.reset);
      }
    }
  } else if (!r.riskyFindings.length) {
    console.log("");
    console.log(C.green + "No missing security constraints detected. \u2713" + C.reset);
  }

  console.log("");
  console.log(C.dim + "Grounded in: " + r.standards.join("; ") + C.reset);
  console.log("");
}

function main() {
  const args = parseArgs(process.argv);
  const policy = loadPolicy(args.flags.policy);

  if (!args.command || args.command === "help" || args.command === "--help") {
    console.log("Usage: vector analyze|analyze-file|improved|hook [prompt] [--json] [--strict] [--policy FILE]");
    process.exit(0);
  }

  const prompt = getPrompt(args).trim();
  if (!prompt) {
    console.error("No prompt provided.");
    process.exit(1);
  }

  const report = analyze(prompt, { policy, strictMode: !!args.flags.strict });

  if (args.command === "improved") {
    const clauses = report.missing.map((m) => m.clause).concat(report.riskyFindings.map((f) => f.fix));
    console.log(buildImprovedPrompt(prompt, clauses));
    process.exit(0);
  }

  if (args.flags.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printReport(report);
  }

  if (args.command === "hook") {
    if (report.riskLevel === "CRITICAL") process.exit(2);
    if (report.riskLevel === "HIGH") process.exit(1);
  }
  process.exit(0);
}

main();
