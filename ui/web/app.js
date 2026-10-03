"use strict";

/* Web client logic. Layout is GPTZero-style: document left, analysis right.
   All analysis is done by the shared engine in src/. */
(function () {
  const el = {
    prompt: document.getElementById("prompt"),
    analyze: document.getElementById("btn-analyze"),
    sample: document.getElementById("btn-sample"),
    deep: document.getElementById("btn-deep"),
    settingsBtn: document.getElementById("btn-settings"),
    settings: document.getElementById("settings"),
    key: document.getElementById("set-key"),
    url: document.getElementById("set-url"),
    model: document.getElementById("set-model"),
    save: document.getElementById("btn-save"),
    status: document.getElementById("set-status"),
    empty: document.getElementById("empty"),
    result: document.getElementById("result"),
    dial: document.getElementById("dial"),
    dialNum: document.getElementById("dial-num"),
    verdictLine: document.getElementById("verdict-line"),
    verdictSub: document.getElementById("verdict-sub"),
    chipRisk: document.getElementById("chip-risk"),
    chipCov: document.getElementById("chip-cov"),
    chipConf: document.getElementById("chip-conf"),
    highlight: document.getElementById("btn-highlight"),
    findings: document.getElementById("findings"),
    improvedWrap: document.getElementById("improved-wrap"),
    improved: document.getElementById("improved"),
    copy: document.getElementById("btn-copy"),
    footMeta: document.getElementById("foot-meta"),
    footChars: document.getElementById("foot-chars")
  };

  const DEFAULTS = {
    apiKey: "",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    model: "gemini-2.5-flash"
  };

  const SAMPLE =
    "Create an S3 bucket to store user documents and an EC2 instance running a web server " +
    "with a security group that allows SSH from 0.0.0.0/0. Give the instance an IAM role with admin access.";

  let settings = Object.assign({}, DEFAULTS);
  let report = null;
  let state = { accepted: {} };

  try {
    settings = Object.assign(settings, JSON.parse(localStorage.getItem("vectorSettings") || "{}"));
  } catch (e) { /* ignore */ }

  function saveSettings() {
    try { localStorage.setItem("vectorSettings", JSON.stringify(settings)); } catch (e) { /* ignore */ }
  }

  function toast(msg) {
    let t = document.querySelector(".gz-toast");
    if (!t) {
      t = document.createElement("div");
      t.className = "gz-toast";
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add("show");
    setTimeout(function () { t.classList.remove("show"); }, 1600);
  }

  function updateChars() {
    const v = el.prompt.value || "";
    el.footChars.textContent = v.length + " characters";
  }

  function renderFindings() {
    if (!report) return;
    VectorUI.renderInto(el.findings, report, state, {
      onToggle: function (id) { state.accepted[id] = !state.accepted[id]; renderFindings(); },
      onAcceptAll: function () {
        report.missing.forEach(function (m) { state.accepted[m.id] = true; });
        report.riskyFindings.forEach(function (f) { state.accepted[f.id] = true; });
        renderFindings();
      },
      onClearAll: function () { state.accepted = {}; renderFindings(); },
      onHarden: hardenNow
    }, {});
    updateImproved();
  }

  function updateImproved() {
    if (!report || report.outOfScope) { el.improvedWrap.classList.add("hidden"); return; }
    const clauses = VectorUI.acceptedClauses(report, state);
    el.improved.textContent = VectorUI.buildImprovedPrompt(report.prompt, clauses);
    el.improvedWrap.classList.remove("hidden");
  }

  function paintSummary() {
    const cov = VectorUI.coverage(report, state);
    const color = report.riskColor || "#16a34a";
    el.dial.style.borderColor = color;
    el.dialNum.style.color = color;
    el.dialNum.textContent = report.riskScore;

    if (report.outOfScope) {
      el.verdictLine.innerHTML = "Not an AWS infrastructure prompt";
      el.verdictSub.textContent = "Nothing to diagnose.";
    } else if (report.aiClean && !report.missing.length && !report.riskyFindings.length) {
      el.verdictLine.innerHTML = '<span class="ok">No issues found</span>';
      el.verdictSub.textContent = "This prompt already covers the required AWS security controls.";
    } else {
      el.verdictLine.innerHTML =
        'We found <span class="bad">' + report.missing.length + " missing control" +
        (report.missing.length === 1 ? "" : "s") + "</span>" +
        (report.riskyFindings.length ? " and " + report.riskyFindings.length + " risky statement(s)." : ".");
      el.verdictSub.textContent = "Scan the prompt before it is turned into infrastructure code.";
    }

    el.chipRisk.textContent = "risk " + report.riskLevel;
    el.chipCov.textContent = "coverage " + cov.before + "%" + (cov.after > cov.before ? " \u2192 " + cov.after + "%" : "");
    el.chipConf.textContent = "confidence " + report.confidenceScore + "%";

    const t = report.tierCounts || { core: 0, clarify: 0, harden: 0 };
    el.footMeta.textContent = report.outOfScope
      ? "Not an AWS prompt"
      : report.riskLevel + " \u00b7 " + t.core + " confirmed \u00b7 " + t.clarify + " clarify \u00b7 " + t.harden + " optional";
  }

  function showResult() {
    el.empty.classList.add("hidden");
    el.result.classList.remove("hidden");
    paintSummary();
    renderFindings();
  }

  function analyzeNow() {
    const prompt = el.prompt.value.trim();
    if (!prompt) { toast("Enter a prompt first"); return; }
    report = VectorAnalyzer.analyze(prompt, { strictMode: false });
    state.accepted = {};
    showResult();
    if (report.needsDeepScan && settings.apiKey && settings.autoDeepScan) deepScanNow();
  }

  async function deepScanNow() {
    const prompt = el.prompt.value.trim();
    if (!prompt) { toast("Enter a prompt first"); return; }
    if (!settings.apiKey) {
      el.settings.classList.remove("hidden");
      el.status.textContent = "Add an API key for deep scan.";
      return;
    }
    if (!report) report = VectorAnalyzer.analyze(prompt, { strictMode: false });
    const base = report;

    el.deep.disabled = true;
    el.deep.textContent = "Scanning...";
    paintSummary();
    try {
      const result = await VectorLLM.deepScan(prompt, settings);
      let merged = VectorAnalyzer.mergeFindings(base, result.findings);
      if (settings.reviewFindings && merged.missing.length) {
        try {
          const review = await VectorLLM.reviewFindings(prompt, merged.missing, settings);
          merged = VectorAnalyzer.mergeFindings(merged, {}, review);
        } catch (e) { /* best effort */ }
      }
      report = merged;
      showResult();
      toast(result.findings.clean ? "Deep scan: no additional issues" : "Deep scan merged (" + result.via + ")");
    } catch (err) {
      report = base;
      showResult();
      const m = String((err && err.message) || "");
      if (/failed to fetch|network|load failed/i.test(m)) {
        toast("Deep scan is blocked by the browser (CORS). Use the extension or mobile app.");
      } else {
        toast(m || "Deep scan failed");
      }
    } finally {
      el.deep.disabled = false;
      el.deep.textContent = "Deep scan";
    }
  }

  function hardenNow() {
    if (!report) return;
    const h = VectorAnalyzer.harden(report.prompt);
    report = h.report;
    state.accepted = {};
    showResult();
    toast("Hardened \u00b7 risk " + report.riskScore + " \u00b7 coverage " + report.coverageScore + "%");
  }

  function copyImproved() {
    const text = el.improved.textContent || "";
    navigator.clipboard.writeText(text).then(
      function () { toast("Copied"); },
      function () { toast("Copy failed"); }
    );
  }

  // ---- events ----
  el.analyze.addEventListener("click", analyzeNow);
  el.deep.addEventListener("click", deepScanNow);
  el.copy.addEventListener("click", copyImproved);
  el.prompt.addEventListener("input", updateChars);
  el.prompt.addEventListener("keydown", function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") analyzeNow();
  });
  if (el.sample) {
    el.sample.addEventListener("click", function () { el.prompt.value = SAMPLE; updateChars(); analyzeNow(); });
  }
  el.highlight.addEventListener("click", function () {
    const first = el.findings.querySelector("details");
    if (first) first.setAttribute("open", "");
  });
  el.settingsBtn.addEventListener("click", function () { el.settings.classList.toggle("hidden"); });
  el.save.addEventListener("click", function () {
    settings = {
      apiKey: el.key.value.trim(),
      baseUrl: el.url.value.trim() || DEFAULTS.baseUrl,
      model: el.model.value.trim() || DEFAULTS.model,
      autoDeepScan: settings.autoDeepScan,
      reviewFindings: settings.reviewFindings !== false
    };
    saveSettings();
    el.status.textContent = "Saved.";
    setTimeout(function () { el.status.textContent = ""; }, 1500);
  });

  el.key.value = settings.apiKey || "";
  el.url.value = settings.baseUrl || "";
  el.model.value = settings.model || "";
  updateChars();
})();
