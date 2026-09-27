"use strict";

/**
 * Convert the project's Markdown documents into Word (.docx) files.
 *
 * Used so the repository ships Word documents only. Handles the subset of
 * Markdown we actually write: headings, bullet lists, numbered lists, tables,
 * fenced code blocks, block quotes and inline bold/code.
 *
 * Run:  node tools/md-to-docx.js
 */

const fs = require("fs");
const path = require("path");
const { buildDocx } = require("./docx-lib");

const ROOT = path.join(__dirname, "..");

// [source .md, output .docx, title]
const JOBS = [
  ["docs/_sources/MARKET-ANALYSIS.md", "docs/Vector-Market-Analysis.docx", "Market & Competitive Analysis"],
  ["docs/_sources/ARCHITECTURE.md", "docs/Vector-Architecture.docx", "Architecture & Workflow"],
  ["docs/_sources/ROADMAP.md", "docs/Vector-Roadmap.docx", "Step-by-Step Roadmap"],
  ["docs/_sources/COURSE-PLAN-MAPPING.md", "docs/Vector-Course-Plan-Mapping.docx", "Course Plan Mapping"],
  ["docs/_sources/MANUAL.md", "docs/Vector-Manual.docx", "Build & Usage Manual"],
  ["docs/_sources/CODE-WALKTHROUGH.md", "docs/Vector-Code-Walkthrough.docx", "Code Walkthrough (Simple)"],
  ["docs/_sources/README.md", "docs/Vector-README.docx", "Overview (README)"],
  ["docs/_sources/references_README.md", "docs/Vector-References.docx", "References"],
  ["docs/_sources/store_edge-submission.md", "docs/Vector-Edge-Submission.docx", "Edge Submission Guide"],
  ["docs/_sources/mobile-expo_README.md", "docs/Vector-Mobile-Expo.docx", "Mobile App (React Native / Expo)"],
  ["docs/_sources/mobile-native_README.md", "docs/Vector-Mobile-Android.docx", "Mobile App (Capacitor / Android)"],
  ["docs/_sources/web_README.md", "docs/Vector-Web-Demo.docx", "Web Demo"]
];

function inline(text) {
  // strip inline markdown emphasis/backticks; keep the words
  return String(text)
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/&hellip;/g, "...")
    .replace(/&middot;/g, "·")
    .replace(/&rarr;/g, "->")
    .replace(/&amp;/g, "&")
    .replace(/\s+$/, "");
}

// Markdown heading level -> docx block type
function headingType(level) {
  if (level === 1) return "title";
  if (level === 2) return "h1";
  if (level === 3) return "h1";   // treated as a major section
  return "h2";                     // level 4+ becomes a sub-heading
}

function mdToBlocks(md) {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const blocks = [];
  let inCode = false;
  let code = [];

  const push = (type, text, level) => blocks.push({ type, text: inline(text), level });

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];

    // fenced code
    if (/^```/.test(raw.trim())) {
      if (inCode) {
        code.forEach((c) => blocks.push({ type: "code", text: c }));
        code = [];
        inCode = false;
      } else {
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      code.push(raw.replace(/\t/g, "    "));
      continue;
    }

    const line = raw.replace(/\s+$/, "");

    if (!line.trim()) {
      blocks.push({ type: "spacer", text: "" });
      continue;
    }

    // horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) continue;

    // headings
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      push(headingType(h[1].length), h[2]);
      continue;
    }

    // tables: collect the whole block
    if (/^\s*\|.*\|\s*$/.test(line)) {
      const rows = [];
      let j = i;
      while (j < lines.length && /^\s*\|.*\|\s*$/.test(lines[j])) {
        rows.push(lines[j].trim());
        j++;
      }
      i = j - 1;
      // drop the separator row (|---|---|)
      const data = rows.filter((r) => !/^\|[\s:|-]+\|$/.test(r));
      // find the number of columns from the first row
      const cols = (data[0] || "").split("|").length - 2;
      for (const r of data) {
        const cells = r.split("|").slice(1, -1).map((c) => inline(c.trim()));
        blocks.push({ type: "tablerow", text: cells.join("   |   "), cols: Math.max(2, cols) });
      }
      blocks.push({ type: "spacer", text: "" });
      continue;
    }

    // block quote
    if (/^>\s?/.test(line)) {
      push("quote", line.replace(/^>\s?/, ""));
      continue;
    }

    // bullets
    let b = line.match(/^\s*[-*+]\s+(.*)$/);
    if (b) {
      const indent = line.match(/^\s*/)[0].length;
      push("bullet", b[1], indent >= 2 ? 1 : 0);
      continue;
    }

    // numbered
    let n = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (n) {
      const indent = line.match(/^\s*/)[0].length;
      push("bullet", n[1], indent >= 3 ? 1 : 0);
      continue;
    }

    push("p", line);
  }

  // collapse 3+ consecutive spacers into one
  const out = [];
  let blanks = 0;
  for (const bl of blocks) {
    if (bl.type === "spacer") {
      blanks++;
      if (blanks > 1) continue;
    } else {
      blanks = 0;
    }
    out.push(bl);
  }
  return out;
}

let ok = 0;
for (const [src, dest, title] of JOBS) {
  const srcPath = path.join(ROOT, src);
  if (!fs.existsSync(srcPath)) {
    console.log("skip (missing): " + src);
    continue;
  }
  const md = fs.readFileSync(srcPath, "utf8");
  const blocks = mdToBlocks(md);
  // ensure a title is present
  if (!blocks.length || blocks[0].type !== "title") {
    blocks.unshift({ type: "title", text: title });
  }
  const buf = buildDocx(blocks);
  const destPath = path.join(ROOT, dest);
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.writeFileSync(destPath, buf);
  ok++;
  console.log("wrote " + dest + "  (" + blocks.length + " blocks, " + Math.round(buf.length / 1024) + " KB)");
}
console.log("\n" + ok + " Word documents written.");
