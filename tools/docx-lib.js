"use strict";

/**
 * Minimal .docx writer (OOXML in a ZIP). Shared by make-docx.js and
 * md-to-docx.js. No dependencies - the ZIP is assembled by hand.
 */

const zlib = require("zlib");

// ------------------------------------------------------------------ ZIP writer
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
    lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(data.length, 18);
    lh.writeUInt32LE(data.length, 22);
    lh.writeUInt16LE(name.length, 26);
    local.push(lh, name, data);

    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0);
    ch.writeUInt16LE(20, 4);
    ch.writeUInt16LE(20, 6);
    ch.writeUInt32LE(crc, 16);
    ch.writeUInt32LE(data.length, 20);
    ch.writeUInt32LE(data.length, 24);
    ch.writeUInt16LE(name.length, 28);
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

// ------------------------------------------------------------ OOXML paragraphs
function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function para(b) {
  let before = 0;
  let after = 100;
  let rpr = "";
  let ind = "";
  let text = b.text || "";

  switch (b.type) {
    case "title":
      rpr = '<w:rPr><w:b/><w:sz w:val="40"/><w:szCs w:val="40"/></w:rPr>';
      after = 200;
      break;
    case "sub":
      rpr = '<w:rPr><w:i/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr>';
      after = 220;
      break;
    case "h1":
      rpr = '<w:rPr><w:b/><w:sz w:val="30"/><w:szCs w:val="30"/><w:color w:val="1F3864"/></w:rPr>';
      before = 260;
      after = 120;
      break;
    case "h2":
      rpr = '<w:rPr><w:b/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr>';
      before = 180;
      after = 80;
      break;
    case "code":
      rpr = '<w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/><w:sz w:val="18"/><w:szCs w:val="18"/><w:color w:val="333333"/></w:rPr>';
      after = 0;
      break;
    case "tablerow":
      rpr = '<w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr>';
      after = 0;
      break;
    case "quote":
      rpr = '<w:rPr><w:i/><w:color w:val="555555"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr>';
      ind = '<w:ind w:left="360"/>';
      after = 80;
      break;
    case "bullet":
      rpr = '<w:rPr><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr>';
      ind = '<w:ind w:left="' + (360 + (b.level || 0) * 360) + '" w:hanging="360"/>';
      text = (b.level ? "\u2013 " : "\u2022 ") + text;
      after = 60;
      break;
    case "spacer":
      return '<w:p><w:pPr><w:spacing w:before="0" w:after="60"/></w:pPr></w:p>';
    default:
      rpr = '<w:rPr><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr>';
  }

  return (
    "<w:p><w:pPr>" +
    '<w:spacing w:before="' + before + '" w:after="' + after + '"/>' +
    ind +
    "</w:pPr>" +
    "<w:r>" + rpr + '<w:t xml:space="preserve">' + esc(text) + "</w:t></w:r></w:p>"
  );
}

/**
 * @param {Array<{type:string,text:string,level?:number}>} blocks
 * @returns {Buffer} a complete .docx file
 */
function buildDocx(blocks) {
  const documentXml =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' +
    (blocks || []).map(para).join("") +
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

  return zip([
    { name: "[Content_Types].xml", data: contentTypes },
    { name: "_rels/.rels", data: rels },
    { name: "word/document.xml", data: documentXml }
  ]);
}

module.exports = { buildDocx, esc, para };
