"use strict";
const T = require("../src/taxonomy");
const S = require("../src/semantic");
const A = require("../src/analyzer");

const idx = S.buildIndex(T.REQUIREMENTS);

function check(prompt, controlId) {
  const toks = S.tokenize(A.normalize(prompt));
  const q = S.vectorize(toks, idx.idf);
  const v = idx.vectors.get(controlId);
  const docToks = idx.tokensById.get(controlId) || [];
  console.log(
    "cos=" + S.cosine(q, v).toFixed(3) +
    " shared=" + S.sharedTerms(toks, docToks) +
    "  [" + controlId + "]  <= " + prompt
  );
}

check("Create an EC2 instance with a security group open to the internet on all ports.", "network_restricted");
check("S3 bucket for logs.", "audit_logging");
check("Open all ports on the security group to the internet.", "network_restricted");
check("Turn on the trail so we can see who did what", "audit_logging");
check("Use a customer managed key and rotate it", "key_rotation");
check("Make sure the data is scrambled on disk", "encryption_at_rest");
check("Store objects so nobody else on the internet can read them", "public_access_block");
