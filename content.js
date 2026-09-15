"use strict";

// Content script: adds a floating "V" button on AI chat sites, reads the prompt
// you are about to send, diagnoses it, and lets you copy a hardened version.
(function () {
  if (window.__vectorInjected) return;
  window.__vectorInjected = true;

  let panel = null;
  let resultsEl = null;
  let improvedEl = null;
  let report = null;
  let state = { accepted: {} };
  let settings = Object.assign({}, VectorSettings.DEFAULTS);

  function visible(el) {
    const r = el.getBoundingClientRect();
    return r.width > 40 && r.height > 20 && r.bottom > 0;
  }

  // Read the prompt from the focused/first big editable box.
  function readPrompt() {
    const active = document.activeElement;
    if (active && (active.tagName === "TEXTAREA" || active.getAttribute("contenteditable") === "true")) {
      return active.tagName === "TEXTAREA" ? active.value : active.innerText;
    }
    const boxes = Array.prototype.slice
      .call(document.querySelectorAll("textarea, [contenteditable='true']"))
      .filter(visible)
      .sort(function (a, b) {
        const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
        return rb.width * rb.height - ra.width * ra.height;
      });
    if (!boxes[0]) return "";
    return boxes[0].tagName === "TEXTAREA" ? boxes[0].value : boxes[0].innerText;
  }

  function buildPanel() {
    const p = document.createElement("div");
    p.id = "vector-panel";
    p.innerHTML =
      '<div class="v-panel-head">' +
      '<div class="v-panel-title"><span class="v-panel-logo">V</span> Vector</div>' +
      '<button class="v-btn ghost" id="vector-close" type="button">Close</button></div>' +
      '<div class="v-panel-body">' +
      '<div id="vector-empty" class="v-muted">Type your prompt in the chat box, then Analyze.</div>' +
      '<div id="vector-results"></div>' +
      '<div id="vector-improved-wrap" class="v-improved hidden">' +
      '<div class="v-improved-head"><label>Improved prompt</label>' +
      '<button class="v-btn" id="vector-copy" type="button">Copy</button></div>' +
      '<pre id="vector-improved" class="v-improved-body"></pre></div>' +
      '<div class="v-panel-actions">' +
      '<button class="v-btn" id="vector-deep" type="button">Deep scan</button>' +
      '<button class="v-btn primary" id="vector-analyze" type="button">Analyze composer text</button>' +
      "</div></div>";
    document.body.appendChild(p);
    resultsEl = p.querySelector("#vector-results");
    improvedEl = p.querySelector("#vector-improved");
    p.querySelector("#vector-close").addEventListener("click", function () { p.classList.remove("open"); });
    p.querySelector("#vector-analyze").addEventListener("click", analyze);
    p.querySelector("#vector-deep").addEventListener("click", deepScan);
    p.querySelector("#vector-copy").addEventListener("click", copyImproved);
    return p;
  }

  function updateImproved() {
    const clauses = VectorUI.acceptedClauses(report, state);
    improvedEl.textContent = VectorUI.buildImprovedPrompt(report.prompt, clauses);
    panel.querySelector("#vector-improved-wrap").classList.remove("hidden");
  }

  function render() {
    VectorUI.render(resultsEl, report, state, {
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

  function analyze() {
    const text = readPrompt().trim();
    if (!text) {
      panel.querySelector("#vector-empty").textContent =
        "Could not read the composer. Type your prompt there first.";
      return;
    }
    panel.querySelector("#vector-empty").classList.add("hidden");
    report = VectorSettings.analyze(text, settings);
    state.accepted = {};
    render();
  }

  async function deepScan() {
    if (!report) { analyze(); if (!report) return; }
    if (!VectorLLM.localAvailable() && !settings.apiKey) return;
    const btn = panel.querySelector("#vector-deep");
    btn.disabled = true;
    btn.textContent = "Scanning...";
    try {
      const result = await VectorLLM.deepScan(report.prompt, settings);
      report = VectorAnalyzer.mergeFindings(report, result.findings);
      render();
    } catch (e) {
      // keep rule results
    } finally {
      btn.disabled = false;
      btn.textContent = "Deep scan";
    }
  }

  function copyImproved() {
    navigator.clipboard.writeText(improvedEl.textContent);
    const btn = panel.querySelector("#vector-copy");
    btn.textContent = "Copied";
    setTimeout(function () { btn.textContent = "Copy"; }, 1200);
  }

  const fab = document.createElement("button");
  fab.id = "vector-fab";
  fab.type = "button";
  fab.textContent = "V";
  fab.title = "Vector: diagnose prompt security";
  fab.addEventListener("click", function () {
    if (!panel) panel = buildPanel();
    panel.classList.add("open");
  });
  document.body.appendChild(fab);

  VectorSettings.get().then(function (s) { settings = s; });
})();
