"use strict";
const fs = require("fs");
const path = require("path");

const gen = fs.readFileSync("tools/md-to-docx.js", "utf8");

function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name === ".git" || e.name === ".expo") continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.toLowerCase().endsWith(".md")) out.push(p.replace(/\\/g, "/"));
  }
  return out;
}

const files = walk(".", []);
console.log("file".padEnd(46) + "role");
for (const f of files) {
  const rel = f.replace(/^\.\//, "");
  const used = gen.indexOf(rel) !== -1;
  console.log(rel.padEnd(46) + (used ? "SOURCE (keep)" : "doc only"));
}
