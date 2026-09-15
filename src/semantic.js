"use strict";

/**
 * Vector semantic matcher (classic NLP, fully offline).
 *
 * A second detection pass on top of the regex rules. Each security control is
 * treated as a "document" (its label + description + clause). We weight terms
 * with TF-IDF, then compare the prompt to every control with cosine similarity.
 *
 * If the rules did not match a control but the prompt is lexically/semantically
 * close to it, the control is treated as already stated. This catches paraphrase
 * that pattern lists miss ("nobody else can read it" ~ restrict public access).
 *
 * No model, no network, no dependencies.
 */

(function (root) {
  const STOP = new Set([
    "a", "an", "the", "and", "or", "for", "with", "to", "of", "in", "on", "at",
    "is", "are", "be", "must", "should", "will", "that", "this", "it", "as",
    "by", "we", "i", "need", "want", "please", "create", "set", "up", "using",
    "use", "my", "our", "your", "from", "into", "so", "then", "also", "can",
    "all", "any", "each", "not", "no", "its", "their", "they"
  ]);

  function tokenize(text) {
    return String(text || "")
      .toLowerCase()
      .split(/[^a-z0-9]+/g)
      .filter((t) => t.length > 1 && !STOP.has(t))
      .map((t) => t.replace(/(ing|ed|s)$/, ""));
  }

  function termCounts(tokens) {
    const map = new Map();
    for (const t of tokens) map.set(t, (map.get(t) || 0) + 1);
    return map;
  }

  // Build the TF-IDF index from the control list.
  function buildIndex(controls) {
    const docs = controls.map((c) => {
      const text = [c.label, c.description, c.clause].filter(Boolean).join(" ");
      return { id: c.id, tokens: tokenize(text) };
    });

    const N = docs.length || 1;
    const df = new Map();
    for (const d of docs) {
      for (const t of new Set(d.tokens)) df.set(t, (df.get(t) || 0) + 1);
    }

    const idf = new Map();
    for (const [t, n] of df) idf.set(t, Math.log((N + 1) / (n + 1)) + 1);

    const vectors = new Map();
    const tokensById = new Map();
    for (const d of docs) {
      const counts = termCounts(d.tokens);
      const vec = new Map();
      for (const [t, c] of counts) {
        const w = (1 + Math.log(c)) * (idf.get(t) || 1);
        vec.set(t, w);
      }
      vectors.set(d.id, vec);
      tokensById.set(d.id, d.tokens);
    }
    return { idf, vectors, tokensById };
  }

  function vectorize(tokens, idf) {
    const counts = termCounts(tokens);
    const vec = new Map();
    for (const [t, c] of counts) {
      if (!idf.has(t)) continue; // ignore terms not in the control vocabulary
      vec.set(t, (1 + Math.log(c)) * idf.get(t));
    }
    return vec;
  }

  function cosine(a, b) {
    if (a.size === 0 || b.size === 0) return 0;
    let dot = 0;
    const [small, big] = a.size <= b.size ? [a, b] : [b, a];
    for (const [t, w] of small) {
      const bw = big.get(t);
      if (bw) dot += w * bw;
    }
    if (dot === 0) return 0;
    let na = 0;
    for (const w of a.values()) na += w * w;
    let nb = 0;
    for (const w of b.values()) nb += w * w;
    return dot / (Math.sqrt(na) * Math.sqrt(nb));
  }

  // Shared content terms between the query and a control's tokens.
  function sharedTerms(queryTokens, controlTokens) {
    const q = new Set(queryTokens);
    const set = new Set();
    for (const t of controlTokens) if (q.has(t)) set.add(t);
    return set.size;
  }

  const VectorSemantic = {
    tokenize: tokenize,
    buildIndex: buildIndex,
    vectorize: vectorize,
    cosine: cosine,
    sharedTerms: sharedTerms
  };

  if (typeof module !== "undefined" && module.exports) module.exports = VectorSemantic;
  root.VectorSemantic = VectorSemantic;
})(typeof globalThis !== "undefined" ? globalThis : this);
