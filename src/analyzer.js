"use strict";

(function (root) {
/**
 * Vector core analysis engine.
 *
 * Pipeline (rule-based NLP):
 *   1. Normalise + tokenise the prompt
 *   2. Expand everyday synonyms to canonical cloud nouns
 *   3. Detect resources / intents            (lexicon + phrase NER)
 *   4. Detect mentioned requirements         (pattern matching + negation guard)
 *   5. Compute omissions against the taxonomy (set difference)
 *   6. Detect explicitly risky statements     (negation aware)
 *   7. Score risk, generate fillable recommendations
 *
 * Optionally merges findings from an external "deep scan" (LLM). Pure
 * Node/browser JavaScript, no dependencies.
 */

const _VectorTaxonomy =
  typeof module !== "undefined" && module.exports
    ? require("./taxonomy")
    : globalThis.VectorTaxonomy;

const _VectorSemantic =
  typeof module !== "undefined" && module.exports
    ? require("./semantic")
    : globalThis.VectorSemantic;

const {
  DIMENSIONS,
  SEVERITY_WEIGHT,
  REQUIREMENTS,
  DEFAULT_REQUIRED,
  RESOURCES,
  SYNONYMS,
  NEGATION_WORDS,
  NON_AWS_TERMS,
  CONTEXT_CUES,
  ENV_FACTOR,
  INFRA_TERMS,
  STRONG_TERMS,
  AMBIGUOUS_ALIASES,
  RISKY_PATTERNS,
  STANDARDS
} = _VectorTaxonomy;

const STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "for", "with", "to", "of", "in", "on", "at",
  "is", "are", "be", "must", "should", "will", "that", "this", "it", "as",
  "by", "we", "i", "need", "want", "please", "create", "set", "up", "using",
  "use", "my", "our", "your", "from", "into", "so", "then", "also", "can"
]);

const RISK_LEVELS = [
  { min: 75, level: "CRITICAL", color: "#b91c1c" },
  { min: 50, level: "HIGH", color: "#dc2626" },
  { min: 25, level: "MEDIUM", color: "#d97706" },
  { min: 1, level: "LOW", color: "#16a34a" },
  { min: 0, level: "MINIMAL", color: "#16a34a" }
];

// How much each relevance tier contributes to the risk score. Clarifications
// and optional hardening should not dominate the score the way confirmed
// core gaps do.
const TIER_MULT = { core: 1, clarify: 0.6, harden: 0.3 };

const NEGATION_RE = new RegExp(
  "\\b(" + NEGATION_WORDS.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + ")\\b",
  "i"
);
const NEGATION_RE_G = new RegExp(NEGATION_RE.source, "gi");
const CLAUSE_SPLIT = /[.,;!?\n]|\b(?:and|but|or|then|so|while|however|except|unless|apart from|provided|assuming)\b/;

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalize(text) {
  return String(text || "")
    .replace(/\r\n/g, "\n")
    .toLowerCase()
    .replace(/\bunencrypted\b/g, " not encrypted")
    .replace(/\bunsecured\b/g, " not secured")
    .replace(/\bunauthorized\b/g, " unauthorized")
    .replace(/[`"'’]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text) {
  const normalized = normalize(text);
  if (!normalized) return [];
  return normalized
    .split(/[^a-z0-9.\/]/g)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

/** Append canonical nouns for everyday synonyms so detection fires. */
function expandSynonyms(text) {
  let out = text;
  for (const s of SYNONYMS) {
    if (s.test.test(text)) out += s.add;
  }
  return out;
}

function phrasePresent(haystack, phrase) {
  const re = new RegExp("(^|[^a-z0-9])" + escapeRegExp(phrase) + "([^a-z0-9]|$)", "i");
  return re.test(haystack);
}

// Some aliases are regex (e.g. "\\becr\\b", "route.?53"); plain ones are phrases.
function isRegexAlias(alias) {
  return /[\\^$.*+?()[\]{}|]/.test(alias);
}

function aliasMatches(haystack, alias) {
  if (isRegexAlias(alias)) {
    try {
      return new RegExp(alias, "i").test(haystack);
    } catch (e) {
      return false;
    }
  }
  return phrasePresent(haystack, alias);
}

function findMatches(text, patterns) {
  const matches = [];
  for (const p of patterns) {
    let re;
    try {
      re = new RegExp(p, "gi");
    } catch (e) {
      continue;
    }
    let m;
    while ((m = re.exec(text)) !== null) {
      matches.push({ index: m.index, value: m[0] });
      if (m.index === re.lastIndex) re.lastIndex++;
    }
  }
  return matches;
}

/**
 * True if the clause before the match contains an ODD number of negations
 * (so "not not encrypted" is treated as positive, and "no public access and
 * encryption" does not leak the "no" onto "encryption").
 */
function isNegatedBefore(text, index) {
  const start = Math.max(0, index - 60);
  const window = text.slice(start, index);
  const parts = window.split(CLAUSE_SPLIT);
  const clause = parts[parts.length - 1] || "";
  const hits = clause.match(NEGATION_RE_G);
  return !!(hits && hits.length % 2 === 1);
}

/** True if the match is immediately followed by a disabling word ("logging disabled"). */
function isNegatedAfter(text, index) {
  const window = text.slice(index, index + 18);
  const cut = window.search(CLAUSE_SPLIT);
  const seg = cut >= 0 ? window.slice(0, cut) : window;
  return /\b(disabled|off|turned off|not enabled|inactive)\b/.test(seg);
}

const INTENT_VERBS = [
  ["deploy", /\b(deploy|provision|spin up|launch|host)\b/i],
  ["create", /\b(create|build|set up|provision|make|add)\b/i],
  ["store", /\b(store|save|persist|upload|host)\b/i],
  ["allow", /\b(allow|permit|enable|open|expose|grant)\b/i],
  ["restrict", /\b(restrict|deny|block|limit|disable|prevent)\b/i],
  ["secure", /\b(secure|protect|encrypt|harden|comply|compliant)\b/i],
  ["connect", /\b(connect|integrate|link|route|peer)\b/i],
  ["backup", /\b(backup|snapshot|replicate|recover)\b/i],
  ["monitor", /\b(monitor|alert|log|observe|audit|track)\b/i]
];

function detectIntents(text) {
  const found = [];
  for (const [name, re] of INTENT_VERBS) {
    if (re.test(text)) found.push(name);
  }
  return found;
}

function detectResources(haystack) {
  const found = [];
  for (const res of RESOURCES) {
    const hit = res.aliases.find((a) => aliasMatches(haystack, a));
    if (hit) found.push({ id: res.id, label: res.label, matched: hit });
  }
  return found;
}

/**
 * @returns {{present:boolean, negated:boolean}} negated=true means the only
 * mentions were explicitly negated (e.g. "do not encrypt").
 */
function detectRequirement(requirement, text) {
  const matches = findMatches(text, requirement.patterns);
  if (matches.length === 0) return { present: false, negated: false };
  const positive = matches.some((m) => {
    const end = m.index + m.value.length;
    if (isNegatedBefore(text, m.index)) return false;
    if (isNegatedAfter(text, end)) return false;
    // e.g. encryption_at_rest must not be satisfied by "encryption in transit"
    if (requirement.notAfter) {
      const seg = text.slice(end, end + 20);
      if (requirement.notAfter.some((p) => new RegExp(p, "i").test(seg))) return false;
    }
    return true;
  });
  return { present: positive, negated: !positive };
}

function severityRank(s) {
  return SEVERITY_WEIGHT[s] || 1;
}

function riskLevelFromScore(score) {
  return RISK_LEVELS.find((r) => score >= r.min) || RISK_LEVELS[RISK_LEVELS.length - 1];
}

/**
 * How confident the RULE engine is that its analysis is complete for this
 * prompt. Low confidence is the trigger for the optional AI deep scan.
 */
function computeConfidence(info) {
  let score = info.baselineOnly ? 34 : 78;
  if (info.tokenCount < 4) score -= 22;
  else if (info.tokenCount < 8) score -= 8;
  if (info.mentioned + info.missing === 0) score -= 20;
  if (info.resources >= 2) score += 6;
  score = Math.max(5, Math.min(98, Math.round(score)));
  const label = score >= 75 ? "high" : score >= 45 ? "medium" : "low";
  return { score: score, label: label, needsDeepScan: score < 50 };
}

function applyPolicy(requirements, risky, policy) {
  const reqs = requirements.map((r) => Object.assign({}, r, { patterns: r.patterns.slice() }));
  const outRisky = risky.slice();

  if (!policy) return { requirements: reqs, risky: outRisky };

  if (Array.isArray(policy.requirements)) {
    for (const custom of policy.requirements) {
      if (!custom || !custom.id) continue;
      reqs.push({
        id: custom.id,
        label: custom.label || custom.id,
        dimension: custom.dimension || "governance",
        severity: custom.severity || "high",
        description: custom.description || "Custom organisation policy requirement.",
        clause: custom.clause || custom.description || custom.label,
        standards: custom.standards || ["Organisation policy"],
        patterns: custom.patterns || [],
        alwaysRequired: custom.alwaysRequired !== false,
        custom: true
      });
    }
  }

  if (Array.isArray(policy.riskyPatterns)) {
    for (const rp of policy.riskyPatterns) {
      if (!rp || !rp.pattern) continue;
      outRisky.push({
        id: rp.id || "policy_" + outRisky.length,
        pattern: rp.pattern,
        label: rp.label || "Policy violation",
        severity: rp.severity || "high",
        description: rp.description || "Violates an organisation policy rule.",
        fix: rp.fix || rp.description || "Revise the prompt to comply with policy."
      });
    }
  }

  return { requirements: reqs, risky: outRisky };
}

function dedupeRiskyFindings(text, risky) {
  const seen = new Map();
  for (const rp of risky) {
    let re;
    try {
      re = new RegExp(rp.pattern, "gi");
    } catch (e) {
      continue;
    }
    let m;
    let matched = false;
    while ((m = re.exec(text)) !== null) {
      if (m.index === re.lastIndex) re.lastIndex++;
      if (isNegatedBefore(text, m.index)) continue;
      matched = true;
      break;
    }
    if (matched && !seen.has(rp.id)) {
      seen.set(rp.id, {
        id: rp.id,
        label: rp.label,
        severity: rp.severity,
        weight: severityRank(rp.severity) * 1.5,
        description: rp.description,
        fix: rp.fix,
        source: "rule"
      });
    }
  }
  return Array.from(seen.values());
}

function computeRisk(relevantCounts, findings) {
  let missingWeight = 0;
  let maxWeight = 0;
  for (const item of relevantCounts) {
    maxWeight += item.weight;
    if (item.missing) missingWeight += item.weight;
  }
  const ratio = missingWeight / Math.max(1, maxWeight);
  let score = 100 * Math.pow(ratio, 1.5);
  let riskyWeight = 0;
  for (const f of findings) riskyWeight += severityRank(f.severity) * 1.5;
  const riskyBump = Math.min(55, riskyWeight * 9);
  return Math.min(100, Math.round(score + riskyBump));
}

/**
 * Recompute risk + coverage for a hypothetical set of accepted clauses.
 * Used by the UI to show "risk 99 -> 40" and "coverage 0% -> 60%" as the user
 * accepts recommendations, i.e. that the suggestions actually improve the score.
 * @param {object} report
 * @param {object} accepted  map of id -> boolean
 */
function project(report, accepted) {
  accepted = accepted || {};
  const on = (id) => !!accepted[id];

  let missingWeight = 0;
  for (const m of report.missing) {
    if (on(m.id)) continue;
    missingWeight += typeof m.weight === "number" ? m.weight : severityRank(m.severity);
  }
  let riskyWeight = 0;
  for (const f of report.riskyFindings) {
    if (on(f.id)) continue;
    riskyWeight += typeof f.weight === "number" ? f.weight : severityRank(f.severity) * 1.5;
  }

  const ratio = missingWeight / Math.max(1, report.totalWeight || 1);
  const base = Math.min(100, Math.round(100 * Math.pow(ratio, 1.5) + Math.min(55, riskyWeight * 9)));
  const riskScore = Math.min(100, Math.round(base * (report.envFactor || 1)));

  const total = report.stats.mentioned + report.stats.missing;
  let covered = report.stats.mentioned;
  for (const m of report.missing) if (on(m.id)) covered++;

  return {
    riskScore: riskScore,
    riskLevel: riskLevelFromScore(riskScore).level,
    coverageScore: total ? Math.round((100 * covered) / total) : 100
  };
}

function analyze(prompt, options) {
  options = options || {};
  const raw = String(prompt || "");
  const normalized = normalize(raw);
  const expanded = expandSynonyms(normalized);
  const tokens = tokenize(raw);
  const intents = detectIntents(expanded);

  const merged = applyPolicy(REQUIREMENTS, RISKY_PATTERNS, options.policy);
  const requirements = merged.requirements;
  const risky = merged.risky;

  const resources = detectResources(expanded);

  // Scope guard: decide whether this is a cloud infrastructure prompt at all.
  // An ambiguous word alone ("a bucket of water") must NOT count, and off-topic
  // text must not be scored. In scope if any of:
  //   - a strong cloud/provisioning term (aws, s3, terraform, vpc ...)
  //   - an infrastructure intent verb (create/deploy/...)
  //   - two or more infrastructure terms
  //   - a resource matched by an unambiguous alias (not "bucket", "queue" ...)
  function termMatches(terms, text) {
    return terms.filter((t) => {
      try {
        return new RegExp("(^|[^a-z0-9])" + t + "([^a-z0-9]|$)", "i").test(text);
      } catch (e) {
        return false;
      }
    }).length;
  }

  const infraHits = termMatches(INFRA_TERMS, normalized);
  const hasStrongTerm = termMatches(STRONG_TERMS, normalized) > 0;
  // Resource evidence must come from the ORIGINAL text, not the synonym-expanded
  // text (otherwise "bucket" -> "s3" would look strong).
  const strongResource = detectResources(normalized).some((r) => {
    if (/[\\^$.*+?()[\]{}|]/.test(r.matched)) return true; // regex alias is specific
    return AMBIGUOUS_ALIASES.indexOf(String(r.matched).toLowerCase()) === -1;
  });
  // A clearly security-relevant statement is in scope even without an intent verb
  // ("hard-code the password", "send data in plaintext").
  const hasRiskySignal = RISKY_PATTERNS.some((rp) => {
    try {
      return new RegExp(rp.pattern, "i").test(normalized);
    } catch (e) {
      return false;
    }
  });

  const inScope =
    hasStrongTerm || intents.length > 0 || infraHits >= 2 || strongResource || hasRiskySignal;

  if (!inScope) {
    return {
      prompt: raw,
      tokens: tokens,
      intents: intents,
      resources: [],
      mentioned: [],
      missing: [],
      riskyFindings: [],
      riskScore: 0,
      riskLevel: "MINIMAL",
      riskColor: "#16a34a",
      coverage: "out-of-scope",
      coverageScore: 0,
      totalWeight: 0,
      tierCounts: { core: 0, clarify: 0, harden: 0 },
      semanticRelated: [],
      nonAwsLikely: false,
      outOfScope: true,
      environment: "unknown",
      envFactor: 1,
      feedback: [
        "This does not look like an AWS infrastructure prompt, so there is nothing to diagnose. Describe the AWS resources you want, for example \"an S3 bucket for user documents\" or \"an RDS database for the app\"."
      ],
      disclaimer: "Diagnostic aid for AWS prompts. Findings are advisory, not a guarantee - verify before deploying.",
      confidence: "low",
      confidenceScore: 0,
      needsDeepScan: false,
      standards: STANDARDS.sources,
      dimensions: DIMENSIONS,
      stats: { resources: 0, mentioned: 0, missing: 0, risky: 0 }
    };
  }

  // Non-AWS guard: warn instead of silently applying AWS baseline to an
  // Azure/GCP prompt (which would be misleading).
  const nonAwsTerm = NON_AWS_TERMS.find((t) => new RegExp(t, "i").test(normalized)) || null;
  const nonAwsLikely = !!nonAwsTerm;

  // Environment context (rule-based cues) adjusts the risk weight: a dev
  // sandbox is lower risk than production.
  const isDev = CONTEXT_CUES.dev.some((c) => new RegExp(c, "i").test(normalized));
  const isProd = CONTEXT_CUES.prod.some((c) => new RegExp(c, "i").test(normalized));
  const environment = isProd ? "prod" : isDev ? "dev" : "unknown";
  const envFactor = ENV_FACTOR[environment] || 1;

  const relevantIds = new Set();
  const appliesTo = new Map();

  if (resources.length > 0) {
    for (const r of resources) {
      const def = RESOURCES.find((x) => x.id === r.id);
      if (!def) continue;
      for (const reqId of def.required) {
        relevantIds.add(reqId);
        if (!appliesTo.has(reqId)) appliesTo.set(reqId, []);
        appliesTo.get(reqId).push(def.label);
      }
    }
  } else {
    const baseline = DEFAULT_REQUIRED.concat([
      "network_restricted",
      "network_isolation",
      "secrets_management",
      "backup_recovery",
      "monitoring_alerting"
    ]);
    for (const id of baseline) {
      relevantIds.add(id);
      if (!appliesTo.has(id)) appliesTo.set(id, ["Baseline (no resource recognised)"]);
    }
  }

  for (const req of requirements) {
    if (req.alwaysRequired) {
      relevantIds.add(req.id);
      if (!appliesTo.has(req.id)) appliesTo.set(req.id, ["Organisation policy"]);
    }
  }

  const mentioned = [];
  let missing = [];
  const relevantCounts = [];

  for (const req of requirements) {
    if (!relevantIds.has(req.id)) continue;
    const tier = req.tier || "clarify";
    const baseSeverity = options.strictMode && req.severity === "medium" ? "high" : req.severity;
    const weight = severityRank(baseSeverity) * (TIER_MULT[tier] || 1);
    const res = detectRequirement(req, normalized);
    relevantCounts.push({ id: req.id, weight: weight, missing: !res.present });

    if (res.present) {
      mentioned.push({
        id: req.id,
        label: req.label,
        dimension: DIMENSIONS[req.dimension] || req.dimension,
        severity: req.severity,
        tier: tier,
        tf: req.tf,
        description: req.description,
        standards: req.standards
      });
    } else {
      missing.push({
        id: req.id,
        label: req.label,
        dimension: DIMENSIONS[req.dimension] || req.dimension,
        severity: req.severity,
        tier: tier,
        weight: weight,
        tf: req.tf,
        description: req.description,
        clause: req.clause,
        standards: req.standards,
        appliesTo: appliesTo.get(req.id) || [],
        explicitlyNegated: res.negated,
        custom: !!req.custom,
        source: "rule"
      });
    }
  }

  // ---- Second pass: TF-IDF semantic similarity (classic NLP / IR) ----
  // Each control is a "document". We rank controls by cosine similarity to the
  // prompt and report the top matches as TOPICALLY RELATED.
  //
  // Measurement (tools/calibrate.js) shows cosine is polarity-blind: "open all
  // ports" scores 0.49 against the "restrict ports" control, while a genuine
  // paraphrase ("scrambled on disk") scores only 0.20. So it must NOT decide
  // whether a control is already stated, and it must NOT override the rules.
  // It is reported as related-topic information only, and the control stays
  // flagged by the rule engine.
  const semIndex = _VectorSemantic.buildIndex(requirements);
  const queryTokens = _VectorSemantic.tokenize(normalized);
  const queryVec = _VectorSemantic.vectorize(queryTokens, semIndex.idf);
  const semanticRelated = requirements
    .map((req) => ({
      id: req.id,
      label: req.label,
      similarity: Number(_VectorSemantic.cosine(queryVec, semIndex.vectors.get(req.id)).toFixed(2))
    }))
    .filter((x) => x.similarity >= 0.2)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 3);

  missing.sort((a, b) => severityRank(b.severity) - severityRank(a.severity));
  const riskyFindings = dedupeRiskyFindings(normalized, risky);
  riskyFindings.sort((a, b) => severityRank(b.severity) - severityRank(a.severity));

  let riskScore = computeRisk(relevantCounts, riskyFindings);
  riskScore = Math.min(100, Math.round(riskScore * envFactor));
  const riskMeta = riskLevelFromScore(riskScore);

  const baselineOnly = resources.length === 0;
  const confidence = computeConfidence({
    baselineOnly: baselineOnly,
    tokenCount: tokens.length,
    mentioned: mentioned.length,
    missing: missing.length,
    resources: resources.length
  });
  const totalControls = mentioned.length + missing.length;
  const coverageScore = totalControls ? Math.round((100 * mentioned.length) / totalControls) : 100;
  const totalWeight = relevantCounts.reduce(function (a, r) { return a + r.weight; }, 0);

  const tierCounts = { core: 0, clarify: 0, harden: 0 };
  for (const m of missing) tierCounts[m.tier || "clarify"]++;

  const feedback = [];
  if (nonAwsLikely) {
    feedback.push(
      'This prompt appears to target a non-AWS cloud ("' + nonAwsTerm + '"). Vector is AWS-specific, so the findings below are generic security advice, not AWS guidance.'
    );
  }
  if (baselineOnly) {
    feedback.push(
      "No specific cloud resource was recognised, so Vector applied baseline AWS controls. Name the resources (for example S3, EC2, RDS, Lambda) for targeted analysis."
    );
  } else {
    feedback.push("Detected resources: " + resources.map((r) => r.label).join(", ") + ".");
  }
  if (riskyFindings.length) {
    feedback.push(riskyFindings.length + " risky statement(s) found — correct these before generation.");
  }
  if (missing.length) {
    feedback.push(missing.length + " security constraint(s) missing — add them so the generator does not have to guess.");
  }
  if (!missing.length && !riskyFindings.length) {
    feedback.push("No missing security constraints detected for the recognised resources. Review organisation-specific rules.");
  }
  if (environment === "dev") {
    feedback.push("This looks like a development/sandbox prompt, so the risk score is reduced. Harden before production.");
  } else if (environment === "prod") {
    feedback.push("This looks like a production prompt, so the risk score is weighted higher.");
  }
  if (confidence.needsDeepScan) {
    feedback.push("Low confidence on this prompt, so some constraints may be unstated - the optional Deep scan can fill the gaps.");
  }

  return {
    prompt: raw,
    tokens,
    intents,
    resources,
    mentioned,
    missing,
    riskyFindings,
    riskScore,
    riskLevel: riskMeta.level,
    riskColor: riskMeta.color,
    feedback,
    baselineOnly,
    coverage: baselineOnly ? "baseline" : "targeted",
    coverageScore: coverageScore,
    totalWeight: totalWeight,
    tierCounts: tierCounts,
    semanticRelated: semanticRelated,
    nonAwsLikely: nonAwsLikely,
    environment: environment,
    envFactor: envFactor,
    disclaimer: "Diagnostic aid for AWS prompts. Findings are advisory, not a guarantee - verify before deploying.",
    confidence: confidence.label,
    confidenceScore: confidence.score,
    // Deep scan is suggested when the rule engine is unsure (low confidence)
    // OR when the prompt leaves a large part of the security surface unstated
    // (coverage < 50%). The second condition also covers the case where a
    // resource IS recognised but a control is paraphrased and missed.
    needsDeepScan: confidence.needsDeepScan || coverageScore < 50,
    standards: STANDARDS.sources,
    dimensions: DIMENSIONS,
    stats: {
      resources: resources.length,
      mentioned: mentioned.length,
      missing: missing.length,
      risky: riskyFindings.length
    }
  };
}

/**
 * Merge external (e.g. LLM deep-scan) findings into a report.
 * @param {object} report
 * @param {{missing?:Array, risky?:Array}} external
 */
function mergeFindings(report, external) {
  if (!external) return report;
  const missing = report.missing.slice();
  const riskyFindings = report.riskyFindings.slice();
  const seenMissing = new Set(missing.map((m) => (m.label || "").toLowerCase()));
  const seenRisky = new Set(riskyFindings.map((r) => (r.label || "").toLowerCase()));

  for (const m of external.missing || []) {
    if (!m || !m.label) continue;
    if (seenMissing.has(m.label.toLowerCase())) continue;
    seenMissing.add(m.label.toLowerCase());
    missing.push({
      id: m.id || "ai_" + missing.length,
      label: m.label,
      dimension: m.dimension || "governance",
      severity: m.severity || "medium",
      tier: m.tier || "clarify",
      weight: severityRank(m.severity || "medium") * (TIER_MULT[m.tier || "clarify"] || 1),
      tf: "",
      description: m.description || "Identified by deep scan.",
      clause: m.clause || m.description || m.label,
      standards: m.standards || ["Deep scan"],
      appliesTo: ["Deep scan"],
      source: "ai"
    });
  }

  for (const r of external.risky || []) {
    if (!r || !r.label) continue;
    if (seenRisky.has(r.label.toLowerCase())) continue;
    seenRisky.add(r.label.toLowerCase());
    riskyFindings.push({
      id: r.id || "ai_risky_" + riskyFindings.length,
      label: r.label,
      severity: r.severity || "high",
      weight: severityRank(r.severity || "high") * 1.5,
      description: r.description || "Identified by deep scan.",
      fix: r.fix || r.description || r.label,
      source: "ai"
    });
  }

  missing.sort((a, b) => severityRank(b.severity) - severityRank(a.severity));
  riskyFindings.sort((a, b) => severityRank(b.severity) - severityRank(a.severity));

  const merged = Object.assign({}, report, { missing, riskyFindings });
  merged.stats = {
    resources: report.stats.resources,
    mentioned: report.stats.mentioned,
    missing: missing.length,
    risky: riskyFindings.length
  };
  const tierCounts = { core: 0, clarify: 0, harden: 0 };
  for (const m of missing) tierCounts[m.tier || "clarify"]++;
  merged.tierCounts = tierCounts;
  merged.totalWeight = report.totalWeight + missing
    .filter((m) => m.source === "ai")
    .reduce((a, m) => a + (m.weight || 0), 0);
  let extra = 0;
  for (const m of missing) if (m.source === "ai") extra += severityRank(m.severity);
  for (const r of riskyFindings) if (r.source === "ai") extra += severityRank(r.severity) * 1.5;
  merged.riskScore = Math.min(100, report.riskScore + Math.round(extra * 3));
  const meta = riskLevelFromScore(merged.riskScore);
  merged.riskLevel = meta.level;
  merged.riskColor = meta.color;
  merged.feedback = report.feedback.concat(
    extra > 0 ? ["Deep scan added " + (missing.filter((m) => m.source === "ai").length + riskyFindings.filter((r) => r.source === "ai").length) + " additional finding(s)."] : []
  );
  return merged;
}

function buildImprovedPrompt(prompt, clauses) {
  const base = String(prompt || "").trim();
  const list = (clauses || []).map((c) => String(c).trim()).filter(Boolean);
  if (list.length === 0) return base;
  return base + "\n\nSecurity requirements:\n" + list.map((c) => "- " + c).join("\n");
}

/**
 * Rewrite the risky phrases in a prompt into safe wording (e.g. "0.0.0.0/0"
 * -> "a restricted trusted CIDR range"). Deterministic, template based.
 */
function neutralizeRisky(text) {
  let out = String(text || "");
  for (const rp of RISKY_PATTERNS) {
    if (!rp.neutralize) continue;
    for (const pair of rp.neutralize) {
      out = out.replace(pair[0], pair[1]);
    }
  }
  return out;
}

/**
 * Iteratively harden a prompt until re-analysis is clean (risk 0 / coverage 100%).
 *
 * Two things happen:
 *   1. risky phrases in the base prompt are neutralised into safe wording
 *   2. missing-control clauses are appended, re-analysed and topped up until
 *      nothing new appears (a clause can mention another service, which the
 *      analyzer then also wants covered)
 */
function harden(prompt, maxIterations) {
  const limit = maxIterations || 8;
  const base = neutralizeRisky(String(prompt || "").trim());

  // Nothing to harden if it is not an infrastructure prompt.
  const first = analyze(base);
  if (first.outOfScope) {
    return { prompt: base, clauses: [], report: first };
  }

  const clauses = [];
  let current = base;

  for (let i = 0; i < limit; i++) {
    const r = analyze(current);
    const found = r.missing
      .map((m) => m.clause)
      .concat(r.riskyFindings.map((f) => f.fix));
    let added = 0;
    for (const c of found) {
      if (c && clauses.indexOf(c) === -1) {
        clauses.push(c);
        added++;
      }
    }
    if (added === 0) break;
    current = buildImprovedPrompt(base, clauses);
  }

  return { prompt: current, clauses: clauses, report: analyze(current) };
}

const VectorAnalyzer = {
  analyze,
  mergeFindings,
  project,
  harden,
  buildImprovedPrompt,
  normalize,
  tokenize,
  expandSynonyms,
  detectResources,
  detectIntents,
  isNegatedBefore,
  applyPolicy,
  DIMENSIONS,
  STANDARDS
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = VectorAnalyzer;
}
root.VectorAnalyzer = VectorAnalyzer;
})(typeof globalThis !== "undefined" ? globalThis : this);
