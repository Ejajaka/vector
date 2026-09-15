"use strict";

/**
 * Shared settings + analysis helper for the popup, options page and content script.
 * Keeps chrome.storage handling in ONE place so the UI files stay small.
 */

(function (root) {
  const DEFAULTS = {
    apiKey: "",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
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

  function addHistory(entry) {
    if (!hasStorage()) return;
    chrome.storage.local.get(["vectorHistory"], function (data) {
      const list = data.vectorHistory || [];
      list.unshift(entry);
      chrome.storage.local.set({ vectorHistory: list.slice(0, 20) });
    });
  }

  root.VectorSettings = {
    DEFAULTS: DEFAULTS,
    get: get,
    save: save,
    parsePolicy: parsePolicy,
    analyze: analyze,
    getHistory: getHistory,
    addHistory: addHistory
  };
  if (typeof module !== "undefined" && module.exports) module.exports = root.VectorSettings;
})(typeof globalThis !== "undefined" ? globalThis : this);
