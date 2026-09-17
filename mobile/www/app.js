"use strict";

// Vector mobile app logic. Reuses the shared engine (analyzer/ui/semantic/llm).
(function () {
  const el = {
    prompt: document.getElementById("prompt"),
    analyze: document.getElementById("btn-analyze"),
    deep: document.getElementById("btn-deep"),
    settingsBtn: document.getElementById("btn-settings"),
    settings: document.getElementById("settings"),
    key: document.getElementById("set-key"),
    url: document.getElementById("set-url"),
    model: document.getElementById("set-model"),
    save: document.getElementById("btn-save"),
    status: document.getElementById("set-status"),
    hint: document.getElementById("hint"),
    results: document.getElementById("results"),
    improvedWrap: document.getElementById("improved-wrap"),
    improved: document.getElementById("improved"),
    copy: document.getElementById("btn-copy")
  };

  const DEFAULTS = {
    apiKey: "",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    model: "gemini-2.5-flash"
  };

  let settings = DEFAULTS;
  let report = null;
  let state = { accepted: {} };

  function loadSettings() {
    try {
      settings = Object.assign({}, DEFAULTS, JSON.parse(localStorage.getItem("vectorSettings") || "{}"));
    } catch (e) {
      settings = Object.assign({}, DEFAULTS);
    }
  }
  function saveSettings() {
    try { localStorage.setItem("vectorSettings", JSON.stringify(settings)); } catch (e) {}
  }

  function toast(msg) {
    let t = document.querySelector(".m-toast");
    if (!t) {
      t = document.createElement("div");
      t.className = "vp-toast m-toast";
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add("show");
    setTimeout(function () { t.classList.remove("show"); }, 1500);
  }

  function updateImproved() {
    if (!report) return;
    const clauses = VectorUI.acceptedClauses(report, state);
    el.improved.textContent = VectorUI.buildImprovedPrompt(report.prompt, clauses);
    el.improvedWrap.classList.remove("hidden");
  }

  function render() {
    VectorUI.render(el.results, report, state, {
      onToggle: function (id) { state.accepted[id] = !state.accepted[id]; render(); },
      onAcceptAll: function () {
        report.missing.forEach(function (m) { state.accepted[m.id] = true; });
        report.riskyFindings.forEach(function (f) { state.accepted[f.id] = true; });
        render();
      },
      onClearAll: function () { state.accepted = {}; render(); }
    });
    updateImproved();
  }

  function setHint() {
    const t = report.tierCounts || { core: 0, clarify: 0, harden: 0 };
    el.hint.textContent =
      report.riskLevel + " " + report.riskScore + "/100 · coverage " + report.coverageScore +
      "% · " + t.core + " confirmed";
  }

  function analyzeNow() {
    const prompt = el.prompt.value.trim();
    if (!prompt) { el.hint.textContent = "Enter a prompt first"; return; }
    report = VectorAnalyzer.analyze(prompt, { strictMode: false });
    state.accepted = {};
    el.results.classList.remove("hidden");
    render();
    setHint();
    if (report.needsDeepScan && settings.apiKey) deepScanNow();
  }

  async function deepScanNow() {
    const prompt = el.prompt.value.trim();
    if (!prompt) return;
    if (!settings.apiKey) {
      el.settings.classList.remove("hidden");
      el.status.textContent = "Add an API key for deep scan.";
      return;
    }
    el.deep.disabled = true;
    el.deep.textContent = "Scanning...";
    try {
      const result = await VectorLLM.deepScan(prompt, settings);
      if (!report) report = VectorAnalyzer.analyze(prompt, { strictMode: false });
      report = VectorAnalyzer.mergeFindings(report, result.findings);
      render();
      setHint();
      toast("Deep scan merged (" + result.via + ")");
    } catch (err) {
      toast(err.message || "Deep scan failed");
    } finally {
      el.deep.disabled = false;
      el.deep.textContent = "Deep scan";
    }
  }

  function copyImproved() {
    const text = el.improved.textContent || "";
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { toast("Copied"); }, function () { toast("Copy failed"); });
    } else {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); toast("Copied"); } catch (e) { toast("Copy failed"); }
      document.body.removeChild(ta);
    }
  }

  el.analyze.addEventListener("click", analyzeNow);
  el.deep.addEventListener("click", deepScanNow);
  el.copy.addEventListener("click", copyImproved);
  el.settingsBtn.addEventListener("click", function () { el.settings.classList.toggle("hidden"); });
  el.save.addEventListener("click", function () {
    settings = {
      apiKey: el.key.value.trim(),
      baseUrl: el.url.value.trim() || DEFAULTS.baseUrl,
      model: el.model.value.trim() || DEFAULTS.model
    };
    saveSettings();
    el.status.textContent = "Saved.";
    setTimeout(function () { el.status.textContent = ""; }, 1500);
  });

  loadSettings();
  el.key.value = settings.apiKey || "";
  el.url.value = settings.baseUrl || "";
  el.model.value = settings.model || "";
})();
