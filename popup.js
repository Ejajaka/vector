"use strict";

// Popup UI: type a prompt, analyze it, accept clauses, copy the improved prompt.
(function () {
  const el = {
    prompt: document.getElementById("prompt"),
    analyze: document.getElementById("btn-analyze"),
    deep: document.getElementById("btn-deep"),
    sample: document.getElementById("btn-sample"),
    settings: document.getElementById("btn-settings"),
    results: document.getElementById("results"),
    improvedWrap: document.getElementById("improved-wrap"),
    improved: document.getElementById("improved"),
    copy: document.getElementById("btn-copy"),
    hint: document.getElementById("hint")
  };

  const SAMPLE =
    "Create an S3 bucket to store user documents and an EC2 instance running a web server " +
    "with a security group that allows SSH from 0.0.0.0/0. Give the instance an IAM role with admin access.";

  let settings = Object.assign({}, VectorSettings.DEFAULTS);
  let report = null;
  let state = { accepted: {} };

  function toast(msg) {
    let t = document.querySelector(".vp-toast");
    if (!t) {
      t = document.createElement("div");
      t.className = "vp-toast";
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
    el.hint.innerHTML =
      report.riskLevel + " risk &middot; " + report.stats.missing + " missing &middot; confidence " +
      report.confidenceScore + "% (" + report.confidence + ")" +
      (report.baselineOnly ? " &middot; baseline" : "");
  }

  function analyzeNow() {
    const prompt = el.prompt.value.trim();
    if (!prompt) { el.hint.textContent = "Enter a prompt first"; return; }
    report = VectorSettings.analyze(prompt, settings);
    state.accepted = {};
    el.results.classList.remove("hidden");
    render();
    setHint();
    VectorSettings.addHistory({
      ts: Date.now(), prompt: prompt, riskLevel: report.riskLevel,
      riskScore: report.riskScore, missing: report.stats.missing
    });
    if (report.needsDeepScan && settings.autoDeepScan) deepScanNow();
  }

  async function deepScanNow() {
    const prompt = el.prompt.value.trim();
    if (!prompt) { el.hint.textContent = "Enter a prompt first"; return; }
    if (!VectorLLM.localAvailable() && !settings.apiKey) {
      el.hint.innerHTML = "Deep scan needs the on-device model or an API key (see Settings).";
      return;
    }
    el.deep.disabled = true;
    el.deep.textContent = "Scanning...";
    try {
      const result = await VectorLLM.deepScan(prompt, settings);
      if (!report) report = VectorSettings.analyze(prompt, settings);
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

  el.analyze.addEventListener("click", analyzeNow);
  el.deep.addEventListener("click", deepScanNow);
  el.sample.addEventListener("click", function () { el.prompt.value = SAMPLE; analyzeNow(); });
  el.settings.addEventListener("click", function () {
    if (chrome.runtime.openOptionsPage) chrome.runtime.openOptionsPage();
  });
  el.prompt.addEventListener("keydown", function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") analyzeNow();
  });
  el.copy.addEventListener("click", function () {
    navigator.clipboard.writeText(el.improved.textContent).then(
      function () { toast("Copied improved prompt"); },
      function () { toast("Copy failed"); }
    );
  });

  VectorSettings.get().then(function (s) { settings = s; });
})();
