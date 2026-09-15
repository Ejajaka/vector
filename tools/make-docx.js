"use strict";

/**
 * Build a Word document (.docx) describing the Vector analysis pipeline.
 * A .docx is just a ZIP of XML parts, so we generate the parts and zip them.
 * No dependencies.
 *
 * Run:  node tools/make-docx.js
 */

const fs = require("fs");
const path = require("path");

// ---- minimal ZIP writer (store method, forward-slash names) ----
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function zip(files) {
  const local = [];
  const central = [];
  let offset = 0;
  for (const f of files) {
    const name = Buffer.from(f.name, "utf8");
    const data = Buffer.from(f.data, "utf8");
    const crc = crc32(data);

    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0);
    lh.writeUInt16LE(20, 4);
    lh.writeUInt16LE(0, 6);
    lh.writeUInt16LE(0, 8);
    lh.writeUInt16LE(0, 10);
    lh.writeUInt16LE(0, 12);
    lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(data.length, 18);
    lh.writeUInt32LE(data.length, 22);
    lh.writeUInt16LE(name.length, 26);
    lh.writeUInt16LE(0, 28);
    local.push(lh, name, data);

    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0);
    ch.writeUInt16LE(20, 4);
    ch.writeUInt16LE(20, 6);
    ch.writeUInt16LE(0, 8);
    ch.writeUInt16LE(0, 10);
    ch.writeUInt16LE(0, 12);
    ch.writeUInt16LE(0, 14);
    ch.writeUInt32LE(crc, 16);
    ch.writeUInt32LE(data.length, 20);
    ch.writeUInt32LE(data.length, 24);
    ch.writeUInt16LE(name.length, 28);
    ch.writeUInt16LE(0, 30);
    ch.writeUInt16LE(0, 32);
    ch.writeUInt16LE(0, 34);
    ch.writeUInt16LE(0, 36);
    ch.writeUInt32LE(0, 38);
    ch.writeUInt32LE(offset, 42);
    central.push(ch, name);

    offset += 30 + name.length + data.length;
  }
  const cd = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(cd.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([Buffer.concat(local), cd, end]);
}

// ---- document content ----
function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function para(block) {
  const spacing = '<w:spacing w:before="%d" w:after="%d"/>';
  let rpr = "";
  let before = 0;
  let after = 100;
  let text = block.text;

  if (block.type === "title") {
    rpr = '<w:rPr><w:b/><w:sz w:val="40"/><w:szCs w:val="40"/></w:rPr>';
    after = 180;
  } else if (block.type === "h1") {
    rpr = '<w:rPr><w:b/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr>';
    before = 220;
    after = 100;
  } else if (block.type === "h2") {
    rpr = '<w:rPr><w:b/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr>';
    before = 160;
    after = 80;
  } else if (block.type === "code") {
    rpr = '<w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr>';
    after = 0;
  } else {
    rpr = '<w:rPr><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr>';
  }

  return (
    "<w:p><w:pPr>" + spacing.replace("%d", before).replace("%d", after) + "</w:pPr>" +
    "<w:r>" + rpr + '<w:t xml:space="preserve">' + esc(text) + "</w:t></w:r></w:p>"
  );
}

const B = (type, text) => ({ type, text });

const blocks = [
  B("title", "Vector - Pre-Generation Security Diagnosis"),
  B("h1", "Analysis Pipeline"),

  B("h2", "Overall flow"),
  B("code", "user types prompt"),
  B("code", "        |"),
  B("code", "        v"),
  B("code", "   VECTOR (pre-generation)"),
  B("code", "        |  diagnosis + fillable clauses"),
  B("code", "        v"),
  B("code", "   improved prompt  --->  LLM generates Terraform / CloudFormation"),
  B("p", ""),

  B("h2", "Engine pipeline (src/analyzer.js)"),
  B("p", "1. NORMALISE - lowercase, unify negations (\"unencrypted\" -> \"not encrypted\"), collapse spaces."),
  B("p", "2. TOKENISE - split on non-alphanumerics, drop stopwords."),
  B("p", "3. SYNONYM EXPANSION - \"website\" -> ec2 / load balancer; \"object storage\" -> s3."),
  B("p", "4. INTENT DETECTION - create / deploy / allow / restrict / secure / backup / monitor."),
  B("p", "5. RESOURCE DETECTION - match 59 AWS resources via phrase and regex aliases."),
  B("p", "6. RELEVANT CONTROLS - union of each detected resource's required controls plus defaults; baseline controls if none detected."),
  B("p", "7. REQUIREMENT DETECTION - regex per control, with a negation guard:"),
  B("code", "     - before: odd count of negations (\"not\")"),
  B("code", "     - after:  \"logging disabled\""),
  B("code", "     - notAfter: \"encryption in transit\" is not treated as at-rest"),
  B("p", "8. OMISSION ANALYSIS - relevant controls minus mentioned controls = MISSING."),
  B("p", "9. RISKY DETECTION - 0.0.0.0/0, public bucket, wildcard IAM, hard-coded secret, disabled logging / backups / MFA (negation-aware, de-duplicated)."),
  B("p", "10. SCORING - risk 0-100 = (missing ratio ^ 1.5) + risky bump; confidence from resource clarity and prompt length."),
  B("p", "11. RECOMMENDATIONS - each finding becomes a clause (missing) or a fix (risky)."),
  B("p", "12. OPTIONAL DEEP SCAN - on-device model or hosted API; AI findings merged and de-duplicated."),
  B("code", "            |"),
  B("code", "            v"),
  B("code", "   REPORT { resources, mentioned, missing, riskyFindings, riskScore, confidence, feedback }"),
  B("code", "            |"),
  B("code", "            v"),
  B("code", "   UI: render cards -> one-click \"Add clause\" -> build improved prompt"),
  B("p", ""),

  B("h2", "One-line summary"),
  B("p", "Normalise -> synonym-expand -> detect resources -> find relevant controls -> check which are stated (negation-aware) -> the rest are missing -> add risky findings -> score -> turn each into a clause."),

  B("h2", "Grounding"),
  B("p", "Control definitions live in src/taxonomy.js and map to CIS AWS Foundations Benchmark, AWS Well-Architected Framework (Security Pillar), AWS Foundational Security Best Practices, NIST SP 800-53 Rev.5, and GDPR Article 5/32 / India DPDP Act 2023.")
];

const documentXml =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
  "<w:body>" +
  blocks.map(para).join("") +
  '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>' +
  '<w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr>' +
  "</w:body></w:document>";

const contentTypes =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
  '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
  '<Default Extension="xml" ContentType="application/xml"/>' +
  '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
  "</Types>";

const rels =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
  "</Relationships>";

const out = zip([
  { name: "[Content_Types].xml", data: contentTypes },
  { name: "_rels/.rels", data: rels },
  { name: "word/document.xml", data: documentXml }
]);

const outDir = path.join(__dirname, "..", "docs");
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, "Vector-Pipeline.docx");
fs.writeFileSync(outFile, out);
console.log("wrote " + path.relative(path.join(__dirname, ".."), outFile) + " (" + out.length + " bytes)");
