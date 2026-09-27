"use strict";

/**
 * Rewrite folder paths in the document sources after the 3-folder restructure.
 *
 *   src/            -> engine/src/          cli/      -> engine/cli/
 *   eval/           -> engine/eval/         test/     -> engine/test/
 *   extension/      -> ui/extension/        mobile-expo/   -> ui/mobile-expo/
 *   mobile-native/  -> ui/mobile-native/    mobile/        -> ui/mobile-native/
 *   web/            -> ui/web/              demo/          -> ui/web/
 *   media/          -> ui/media/            store/         -> ui/store/
 *   references/     -> docs/references/     examples/      -> docs/examples/
 *
 * A path is only rewritten when it is a free-standing path, i.e. NOT already
 * preceded by engine/, ui/ or docs/. Run:  node tools/fix-doc-paths.js
 */

const fs = require("fs");
const path = require("path");

const SOURCES = path.join(__dirname, "..", "docs", "_sources");

const MAP = [
  ["mobile-native/", "ui/mobile-native/"],
  ["mobile-expo/", "ui/mobile-expo/"],
  ["extension/", "ui/extension/"],
  ["references/", "docs/references/"],
  ["examples/", "docs/examples/"],
  ["store/", "ui/store/"],
  ["media/", "ui/media/"],
  ["mobile/", "ui/mobile-native/"],
  ["demo/", "ui/web/"],
  ["web/", "ui/web/"],
  ["src/", "engine/src/"],
  ["cli/", "engine/cli/"],
  ["eval/", "engine/eval/"],
  ["test/", "engine/test/"]
];

function escape(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// A boundary before the path: start, space, backtick, quote, (, [, |, /
function fixLine(line) {
  let out = line;
  for (const [from, to] of MAP) {
    const re = new RegExp("(^|[\\s`\"'\\[(|/])" + escape(from), "g");
    out = out.replace(re, (m, pre) => {
      // avoid re-prefixing something already migrated
      if (/engine\/$|ui\/$|docs\/references\/$|docs\/examples\/$/.test(pre)) return m;
      return pre + to;
    });
  }
  return out;
}

let changed = 0;
for (const f of fs.readdirSync(SOURCES)) {
  if (!f.endsWith(".md")) continue;
  const p = path.join(SOURCES, f);
  const lines = fs.readFileSync(p, "utf8").split("\n");
  let touched = 0;
  const out = lines.map((l) => {
    const n = fixLine(l);
    if (n !== l) touched++;
    return n;
  });
  if (touched) {
    fs.writeFileSync(p, out.join("\n"));
    console.log(f + ": " + touched + " lines updated");
    changed += touched;
  }
}
console.log("\n" + changed + " lines updated.");
