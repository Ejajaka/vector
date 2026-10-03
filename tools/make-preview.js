"use strict";

/**
 * Build a standalone, fully interactive preview of the web client.
 *
 * It inlines the real client (index.html body), the real stylesheets and the
 * real engine, so the preview behaves exactly like http://.../ui/web/index.html
 * but as a single openable file.
 *
 * Output: preview/vector-preview.html
 * Run:    node tools/make-preview.js
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const WEB = path.join(ROOT, "ui", "web");
const OUT = path.join(ROOT, "preview");

function read(p) {
  return fs.readFileSync(path.join(WEB, p), "utf8");
}

const html = read("index.html");
const clientCss = read("style.css");
const engine = ["taxonomy.js", "semantic.js", "analyzer.js", "ui.js", "llm.js", "settings.js"].map((f) =>
  read("src/" + f)
);
const appJs = read("app.js");

// Take the body of the real page (everything between <body> and </body>),
// dropping the script tags (we inline the JS below instead).
let body = html.slice(html.indexOf("<body>") + 6, html.indexOf("</body>"));
body = body.replace(/<script[\s\S]*?<\/script>/g, "");

const page = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="theme-color" content="#6366f1" />
<title>Vector - preview</title>
<style>
${clientCss}
</style>
</head>
<body>
${body}
<script>
/* ---- engine (inlined) ---- */
${engine.join("\n;\n")}

/* VectorSettings expects chrome.storage; provide a tiny shim for the browser */
if (typeof chrome === "undefined") {
  window.chrome = { storage: { local: { get: function (k, cb) { cb({}); }, set: function () {} } } };
}

/* ---- app ---- */
${appJs}

/* Pre-fill the sample and analyse it so the preview opens with a result. */
(function () {
  var ta = document.getElementById("prompt");
  var btn = document.getElementById("btn-sample");
  if (btn) {
    btn.click();
  } else if (ta) {
    ta.value = "Create an S3 bucket to store user documents and an EC2 instance running a web server with SSH open to 0.0.0.0/0.";
    var a = document.getElementById("btn-analyze");
    if (a) a.click();
  }
})();
</script>
</body>
</html>`;

fs.mkdirSync(OUT, { recursive: true });
const file = path.join(OUT, "vector-preview.html");
fs.writeFileSync(file, page);
console.log("wrote " + path.relative(ROOT, file) + "  (" + Math.round(page.length / 1024) + " KB)");
