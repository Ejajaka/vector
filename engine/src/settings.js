"use strict";

/**
 * Shared settings + analysis helper for the popup, options page and content script.
 * Keeps chrome.storage handling in ONE place so the UI files stay small.
 */

(function (root) {
  const DEFAULTS = {
    apiKey: "",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    model: "gemini-2.5-flash",
    autoDeepScan: false,
    strictMode: false,
    policyText: ""
  };

  function hasStorage() {
    return typeof chrome !== "undefined" && chrome.storage && chrome.storage.local;
  }

  function get() {
    return new Promise(function (resolve) {
      if (!hasStorage()) return resolve(Object.assign({}, DEFAULTS));
      chrome.storage.local.get(["vectorSettings"], function (data) {
        resolve(Object.assign({}, DEFAULTS, data.vectorSettings || {}));
      });
    });
  }

  function save(settings) {
    if (!hasStorage()) return;
    chrome.storage.local.set({ vectorSettings: settings });
  }

  function parsePolicy(text) {
    if (!text || !String(text).trim()) return null;
    try {
      return JSON.parse(text);
    } catch (e) {
      return null;
    }
  }

  // Run the rule engine with the user's policy + strict setting applied.
  function analyze(prompt, settings) {
    return VectorAnalyzer.analyze(prompt, {
      policy: parsePolicy(settings && settings.policyText),
      strictMode: !!(settings && settings.strictMode)
    });
  }

  // --- history (last 20 analyses) ---
  function getHistory() {
    return new Promise(function (resolve) {
      if (!hasStorage()) return resolve([]);
      chrome.storage.local.get(["vectorHistory"], function (data) {
        resolve(data.vectorHistory || []);
      });
    });
  }

  /**
   * Store a snapshot of a report so a later analysis can be compared to it.
   * Uses VectorAnalyzer.snapshot() when available (id lists), otherwise falls
   * back to the passed entry as-is.
   */
  function addHistory(entry) {
    if (!hasStorage()) return;
    const snap = (root.VectorAnalyzer && root.VectorAnalyzer.snapshot && entry && entry.prompt)
      ? root.VectorAnalyzer.snapshot(entry)
      : entry;
    chrome.storage.local.get(["vectorHistory"], function (data) {
      const list = data.vectorHistory || [];
      list.unshift(snap);
      chrome.storage.local.set({ vectorHistory: list.slice(0, 20) });
    });
  }

  /**
   * The most recent stored snapshot that is comparable to the given report:
   * same resource set (or a superset) and carrying id lists. Returns null when
   * there is nothing sensible to compare against.
   */
  function getComparable(report) {
    return new Promise(function (resolve) {
      if (!hasStorage() || !report || report.outOfScope) return resolve(null);
      getHistory().then(function (list) {
        const cur = new Set((report.resources || []).map(function (r) { return r.id; }));
        const hit = list.find(function (h) {
          if (!h || !Array.isArray(h.missing) || !Array.isArray(h.mentioned)) return false;
          if (h.skipped) return false;
          const prev = new Set(h.resources || []);
          if (cur.size === 0 && prev.size === 0) return true;
          // comparable when the earlier version targeted the same resources
          return prev.size === cur.size && Array.from(prev).every(function (id) { return cur.has(id); });
        });
        resolve(hit || null);
      });
    });
  }

  root.VectorSettings = {
    DEFAULTS: DEFAULTS,
    get: get,
    save: save,
    parsePolicy: parsePolicy,
    analyze: analyze,
    getHistory: getHistory,
    addHistory: addHistory,
    getComparable: getComparable
  };
  if (typeof module !== "undefined" && module.exports) module.exports = root.VectorSettings;
})(typeof globalThis !== "undefined" ? globalThis : this);
