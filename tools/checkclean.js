"use strict";
const L = require("../src/llm");

const empty = L.parseFindings('{"missing":[],"risky":[]}');
console.log("empty  -> clean:", empty.clean, "missing:", empty.missing.length, "risky:", empty.risky.length);

const some = L.parseFindings('{"missing":[{"label":"X"}],"risky":[]}');
console.log("findings -> clean:", some.clean);

const M = require("../src/analyzer");
const base = M.analyze("Create an S3 bucket with a secret scrambling method.");
const mergedClean = M.mergeFindings(
  Object.assign({}, base, { missing: [], riskyFindings: [] }),
  empty
);
console.log("merged clean -> aiClean:", mergedClean.aiClean);

const merged = M.mergeFindings(base, some);
console.log("merged with AI finding -> source ai:", merged.missing.some((m) => m.source === "ai"));
