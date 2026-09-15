"use strict";

/**
 * Vector shared UI renderer.
 *
 * Used by both the Chrome popup and the in-page content script so the
 * diagnosis looks identical everywhere. Pure DOM/string building, no framework.
 */

(function (root) {
  const SEV_ORDER = { high: 0, medium: 1, low: 2 };

  function escapeHtml(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function severityClass(s) {
    return "sev-" + (s || "low");
  }

  function buildImprovedPrompt(prompt, clauses) {
    const base = String(prompt || "").trim();
    const list = (clauses || []).map((c) => String(c).trim()).filter(Boolean);
    if (list.length === 0) return base;
    return base + "\n\nSecurity requirements:\n" + list.map((c) => "- " + c).join("\n");
  }

  function acceptedClauses(report, state) {
    const accepted = state.accepted || {};
    const clauses = [];
    for (const id of Object.keys(accepted)) {
      if (!accepted[id]) continue;
      const m = (report.missing || []).find((x) => x.id === id);
      if (m) clauses.push(m.clause);
      const f = (report.riskyFindings || []).find((x) => x.id === id);
      if (f) clauses.push(f.fix);
    }
    return clauses;
  }

  function chip(text, cls) {
    return '<span class="v-chip ' + (cls || "") + '">' + escapeHtml(text) + "</span>";
  }

  function riskHtml(r) {
    return (
      '<div class="v-risk">' +
      '<div class="v-risk-score" style="border-color:' + r.riskColor + ";color:" + r.riskColor + '">' +
      '<span class="v-score-num">' + r.riskScore + "</span>" +
      '<span class="v-score-max">/100</span>' +
      "</div>" +
      '<div class="v-risk-meta">' +
      '<span class="v-risk-level" style="background:' + r.riskColor + '">' + escapeHtml(r.riskLevel) + " RISK</span>" +
      '<div class="v-risk-stats">' +
      "<span>" + r.stats.resources + " resource(s)</span>" +
      "<span>" + r.stats.mentioned + " controls present</span>" +
      "<span>" + r.stats.missing + " missing</span>" +
      "<span>" + r.stats.risky + " risky</span>" +
      "</div></div></div>"
    );
  }

  function feedbackHtml(r) {
    return (
      '<div class="v-feedback">' +
      r.feedback.map((f) => '<p class="v-feedback-line">' + escapeHtml(f) + "</p>").join("") +
      "</div>"
    );
  }

  function detectedHtml(r) {
    if (!r.resources.length && !r.mentioned.length) return "";
    let html = "";
    if (r.resources.length) {
      html += '<div class="v-chip-row"><span class="v-chip-label">Resources</span>';
      html += r.resources.map((x) => chip(x.label, "res")).join("");
      html += "</div>";
    }
    if (r.mentioned.length) {
      html += '<div class="v-chip-row"><span class="v-chip-label">Security already stated</span>';
      html += r.mentioned.map((x) => chip(x.label, "ok")).join("");
      html += "</div>";
    }
    return html;
  }

  function findingsHtml(r, accepted) {
    if (!r.riskyFindings.length) return "";
    let html = '<h2>Risky statements</h2><div class="v-grid">';
    for (const f of r.riskyFindings) {
      const on = !!accepted[f.id];
      html +=
        '<div class="v-card risky ' + severityClass(f.severity) + '">' +
        '<div class="v-card-head"><span class="v-badge">' + escapeHtml(f.severity) + "</span>" +
        '<span class="v-dim">' + escapeHtml(f.label) + "</span>" +
        (f.source === "ai" ? '<span class="v-tag ai">AI</span>' : "") + "</div>" +
        '<p class="v-desc">' + escapeHtml(f.description) + "</p>" +
        '<div class="v-fix"><strong>Fix:</strong> ' + escapeHtml(f.fix) + "</div>" +
        '<div class="v-card-actions"><button class="v-btn ' + (on ? "accepted" : "primary") +
        '" data-toggle="' + escapeHtml(f.id) + '">' + (on ? "Added &#10003;" : "Add fix") + "</button></div></div>";
    }
    return html + "</div>";
  }

  function missingHtml(r, accepted) {
    if (!r.missing.length) {
      return '<h2>Missing security constraints</h2><p class="v-muted">None detected. &#10003;</p>';
    }
    let html =
      '<h2>Missing security constraints <span class="v-count">' + r.missing.length + "</span></h2>" +
      '<div class="v-header-actions v-bulk">' +
      '<button class="v-btn ghost" data-action="accept-all">Accept all</button>' +
      '<button class="v-btn ghost" data-action="clear-all">Clear</button></div>';
    html += '<div class="v-grid">';
    for (const m of r.missing) {
      const on = !!accepted[m.id];
      html +=
        '<div class="v-card missing ' + severityClass(m.severity) + (on ? " is-accepted" : "") + '">' +
        '<div class="v-card-head"><span class="v-badge">' + escapeHtml(m.severity) + "</span>" +
        '<span class="v-dim">' + escapeHtml(m.label) + "</span>" +
        (m.custom ? '<span class="v-tag">policy</span>' : "") +
        (m.source === "ai" ? '<span class="v-tag ai">AI</span>' : "") + "</div>" +
        '<p class="v-desc">' + escapeHtml(m.description) + "</p>" +
        (m.appliesTo && m.appliesTo.length
          ? '<p class="v-applies">Applies to: ' + escapeHtml(m.appliesTo.join(", ")) + "</p>"
          : "") +
        '<div class="v-clause"><code>' + escapeHtml(m.clause) + "</code></div>" +
        '<div class="v-standards">' + m.standards.map((s) => chip(s, "std")).join("") + "</div>" +
        '<div class="v-card-actions"><button class="v-btn ' + (on ? "accepted" : "primary") +
        '" data-toggle="' + escapeHtml(m.id) + '">' + (on ? "Added &#10003;" : "+ Add clause") + "</button></div></div>";
    }
    return html + "</div>";
  }

  /**
   * Render a full report into a container.
   * @param {HTMLElement} container
   * @param {object} report
   * @param {object} state  { accepted: {id:boolean} }
   * @param {object} handlers { onToggle, onAcceptAll, onClearAll }
   */
  function render(container, report, state, handlers) {
    handlers = handlers || {};
    const accepted = (state && state.accepted) || {};
    container.innerHTML =
      riskHtml(report) +
      feedbackHtml(report) +
      detectedHtml(report) +
      findingsHtml(report, accepted) +
      missingHtml(report, accepted);

    container.querySelectorAll("[data-toggle]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (handlers.onToggle) handlers.onToggle(btn.getAttribute("data-toggle"));
      });
    });
    const aa = container.querySelector('[data-action="accept-all"]');
    if (aa) aa.addEventListener("click", () => handlers.onAcceptAll && handlers.onAcceptAll());
    const ca = container.querySelector('[data-action="clear-all"]');
    if (ca) ca.addEventListener("click", () => handlers.onClearAll && handlers.onClearAll());
  }

  const VectorUI = {
    render: render,
    buildImprovedPrompt: buildImprovedPrompt,
    acceptedClauses: acceptedClauses,
    escapeHtml: escapeHtml,
    severityClass: severityClass,
    SEV_ORDER: SEV_ORDER,
    // html builders exposed for testing
    riskHtml: riskHtml,
    findingsHtml: findingsHtml,
    missingHtml: missingHtml
  };

  if (typeof module !== "undefined" && module.exports) module.exports = VectorUI;
  root.VectorUI = VectorUI;
})(typeof globalThis !== "undefined" ? globalThis : this);
