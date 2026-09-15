"use strict";

/**
 * Vector optional "deep scan".
 *
 * Two ways to run it, tried in this order:
 *   1. On-device  - Chrome's built-in model (Gemini Nano). No API key, no network.
 *   2. Hosted API - OpenAI-compatible endpoint. Needs an API key.
 *
 * Either way we only ASK an existing model for controls we may have missed and
 * merge the answer back in. We never train or ship our own model.
 */

(function (root) {
  // Shared instruction for both providers.
  const SYSTEM_PROMPT =
    "You are an AWS cloud security reviewer. Given an infrastructure prompt, " +
    "list security controls that are MISSING from it (do not repeat ones already stated). " +
    "Reply with STRICT JSON only: " +
    '{"missing":[{"label":"","severity":"high|medium|low","description":"","clause":""}],' +
    '"risky":[{"label":"","severity":"high|medium|low","description":"","fix":""}]}. ' +
    "At most 10 missing and 5 risky. Each clause is one imperative sentence.";

  function normSeverity(s) {
    const v = String(s || "").toLowerCase();
    return v === "high" || v === "medium" || v === "low" ? v : "medium";
  }

  // Turn the model's text output into { missing, risky } (tolerant of extra prose).
  function parseFindings(text) {
    const match = String(text || "").match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Model returned no JSON.");
    const data = JSON.parse(match[0]);

    const missing = (Array.isArray(data.missing) ? data.missing : [])
      .filter((m) => m && m.label)
      .slice(0, 10)
      .map((m) => ({
        label: String(m.label),
        severity: normSeverity(m.severity),
        description: String(m.description || "Identified by deep scan."),
        clause: String(m.clause || m.description || m.label),
        source: "ai"
      }));

    const risky = (Array.isArray(data.risky) ? data.risky : [])
      .filter((r) => r && r.label)
      .slice(0, 5)
      .map((r) => ({
        label: String(r.label),
        severity: normSeverity(r.severity),
        description: String(r.description || "Identified by deep scan."),
        fix: String(r.fix || r.description || r.label),
        source: "ai"
      }));

    return { missing: missing, risky: risky };
  }

  // --- Tier 1: on-device (Chrome built-in AI), no key and no network ---
  function localModel() {
    if (typeof self === "undefined") return null;
    return self.LanguageModel || (self.ai && self.ai.languageModel) || null;
  }

  function localAvailable() {
    return !!localModel();
  }

  async function localDeepScan(prompt) {
    const LM = localModel();
    if (!LM) throw new Error("On-device model not available.");
    if (LM.availability) {
      const state = await LM.availability();
      if (state === "unavailable") throw new Error("On-device model unavailable.");
      if (state === "downloadable" && LM.create) {
        // create() will trigger the one-time download.
      }
    }
    const session = await LM.create({ systemPrompt: SYSTEM_PROMPT });
    const text = await session.prompt("Infrastructure prompt:\n\n" + String(prompt || ""));
    if (session.destroy) session.destroy();
    return parseFindings(text);
  }

  // --- Tier 2: hosted API (OpenAI-compatible), needs a key ---
  async function hostedDeepScan(prompt, settings) {
    const apiKey = settings && settings.apiKey;
    if (!apiKey) throw new Error("No API key set.");
    const baseUrl = ((settings && settings.baseUrl) || "https://api.openai.com/v1").replace(/\/+$/, "");
    const model = (settings && settings.model) || "gpt-4o-mini";

    const res = await fetch(baseUrl + "/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + apiKey },
      body: JSON.stringify({
        model: model,
        temperature: 0,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: "Infrastructure prompt:\n\n" + String(prompt || "") }
        ],
        response_format: { type: "json_object" }
      })
    });
    if (!res.ok) throw new Error("Deep scan failed (" + res.status + ")");
    const data = await res.json();
    const text = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    return parseFindings(text);
  }

  /**
   * Run a deep scan, preferring the free on-device model.
   * Resolves to { findings, via } where via is "on-device" or "api".
   */
  async function deepScan(prompt, settings) {
    if (localAvailable()) {
      try {
        return { findings: await localDeepScan(prompt), via: "on-device" };
      } catch (e) {
        // fall through to hosted if a key exists
      }
    }
    if (settings && settings.apiKey) {
      return { findings: await hostedDeepScan(prompt, settings), via: "api" };
    }
    throw new Error("Deep scan needs the on-device model or an API key.");
  }

  root.VectorLLM = {
    deepScan: deepScan,
    localDeepScan: localDeepScan,
    localAvailable: localAvailable,
    hostedDeepScan: hostedDeepScan,
    parseFindings: parseFindings,
    normSeverity: normSeverity,
    SYSTEM_PROMPT: SYSTEM_PROMPT
  };
  if (typeof module !== "undefined" && module.exports) module.exports = root.VectorLLM;
})(typeof globalThis !== "undefined" ? globalThis : this);
