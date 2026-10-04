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

  function coverage(report, state) {
    const total = report.stats.mentioned + report.stats.missing;
    const accepted = (state && state.accepted) || {};
    let coveredNow = report.stats.mentioned;
    for (const m of report.missing) if (accepted[m.id]) coveredNow++;
    const out = {
      before: typeof report.coverageScore === "number" ? report.coverageScore : 0,
      after: total ? Math.round((100 * coveredNow) / total) : 100,
      total: total,
      riskBefore: report.riskScore,
      riskAfter: report.riskScore
    };
    // Projected risk + coverage after the accepted clauses are applied.
    if (typeof VectorAnalyzer !== "undefined" && VectorAnalyzer.project) {
      const proj = VectorAnalyzer.project(report, accepted);
      out.after = proj.coverageScore;
      out.riskAfter = proj.riskScore;
    }
    return out;
  }

  function riskHtml(r, cov) {
    const covText =
      cov && cov.after > cov.before
        ? "coverage " + cov.before + "% &rarr; " + cov.after + "%"
        : "coverage " + ((cov && cov.before) || 0) + "%";
    const riskText =
      cov && cov.riskAfter < cov.riskBefore
        ? '<span>projected risk <strong>' + cov.riskBefore + " &rarr; " + cov.riskAfter + "</strong></span>"
        : "";
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
      (r.tierCounts
        ? "<span>" + r.tierCounts.core + " confirmed &middot; " + r.tierCounts.clarify +
          " clarify &middot; " + r.tierCounts.harden + " optional</span>"
        : "") +
      riskText +
      "<span><strong>" + covText + "</strong></span>" +
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

  // TF-IDF topical relevance - informational only (never used to satisfy a control).
  function relatedHtml(r) {
    if (!r.semanticRelated || !r.semanticRelated.length) return "";
    return (
      '<p class="v-related">Topically related controls (TF-IDF): ' +
      r.semanticRelated
        .map((x) => escapeHtml(x.label) + " <span class=\"v-muted\">" + x.similarity + "</span>")
        .join(" &middot; ") +
      "</p>"
    );
  }

  // Non-AWS warning (the engine targets AWS only).
  function bannerHtml(r) {
    if (!r.nonAwsLikely) return "";
    return (
      '<div class="v-banner warn">This looks like a non-AWS cloud prompt. ' +
      "Vector is AWS-specific, so treat these findings as generic security advice, not AWS guidance.</div>"
    );
  }

  // Advisory footer: findings are not a guarantee.
  function disclaimerHtml(r) {
    if (!r.disclaimer) return "";
    return '<p class="v-disclaimer">' + escapeHtml(r.disclaimer) + "</p>";
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

  function missingCard(m, accepted) {
    const on = !!accepted[m.id];
    return (
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
      (m.tf ? '<div class="v-tf"><strong>Terraform:</strong> <code>' + escapeHtml(m.tf) + "</code></div>" : "") +
      '<div class="v-standards">' + m.standards.map((s) => chip(s, "std")).join("") + "</div>" +
      '<div class="v-card-actions"><button class="v-btn ' + (on ? "accepted" : "primary") +
      '" data-toggle="' + escapeHtml(m.id) + '">' + (on ? "Added &#10003;" : "+ Add clause") + "</button></div></div>"
    );
  }

  function missingHtml(r, accepted) {
    if (!r.missing.length) {
      return '<h2>Missing security constraints</h2><p class="v-muted">None detected. &#10003;</p>';
    }
    let html =
      '<h2>Missing security constraints <span class="v-count">' + r.missing.length + "</span></h2>" +
      '<div class="v-header-actions v-bulk">' +
      '<button class="v-btn primary" data-action="harden">Harden prompt</button>' +
      '<button class="v-btn ghost" data-action="accept-all">Accept all</button>' +
      '<button class="v-btn ghost" data-action="clear-all">Clear</button></div>';

    const groups = [
      { key: "core", label: "Confirmed gaps" },
      { key: "clarify", label: "Needs clarification" },
      { key: "harden", label: "Optional hardening" }
    ];
    for (const g of groups) {
      const items = r.missing.filter((m) => (m.tier || "clarify") === g.key);
      if (!items.length) continue;
      html +=
        '<h3 class="v-group">' + g.label + ' <span class="v-count">' + items.length + "</span></h3>" +
        '<div class="v-grid">' + items.map((m) => missingCard(m, accepted)).join("") + "</div>";
    }
    return html;
  }

  /**
   * Security Delta panel: what changed since the previous version of this
   * prompt. Renders as a collapsible section above the risk card.
   * @param {object} delta  result of VectorAnalyzer.computeDelta
   * @param {object} prev   the previous stored snapshot (for wording)
   */
  function deltaHtml(delta, prev) {
    if (!delta) return "";
    const chip = (cls, txt) => '<span class="v-chip ' + cls + '">' + escapeHtml(txt) + "</span>";
    const line = (items, cls, emptyText) => {
      if (!items.length) return '<p class="v-delta-line v-muted">' + escapeHtml(emptyText) + "</p>";
      return (
        '<div class="v-delta-chips">' +
        items.map((m) => chip(cls, "\u2022 " + (m.label || m.id))).join("") +
        "</div>"
      );
    };

    const verdictCls = delta.verdict === "improved" ? "ok"
      : delta.verdict === "regressed" ? "bad"
      : delta.verdict === "unchanged" ? "same" : "mixed";
    const verdictText = delta.verdict.charAt(0).toUpperCase() + delta.verdict.slice(1);

    const arrow = (d) =>
      d === "down" ? "\u25BC" : d === "up" ? "\u25B2" : "\u2013";

    let when = "";
    if (prev && prev.ts) {
      const mins = Math.max(0, Math.round((Date.now() - prev.ts) / 60000));
      when = mins < 1 ? "moments ago" : mins === 1 ? "1 minute ago" : mins + " minutes ago";
    }

    // A one-line plain-language headline that names what actually changed.
    let headline;
    if (delta.verdict === "unchanged") {
      headline = "No change since the previous version.";
    } else {
      const bits = [];
      if (delta.added.length) bits.push("+" + delta.added.length + " control" + (delta.added.length === 1 ? "" : "s") + " added");
      if (delta.newRisks.length) bits.push("+" + delta.newRisks.length + " new risk" + (delta.newRisks.length === 1 ? "" : "s"));
      if (delta.newlyMissing.length) bits.push(delta.newlyMissing.length + " control" + (delta.newlyMissing.length === 1 ? "" : "s") + " regressed");
      if (delta.risk.delta) bits.push("risk " + (delta.risk.delta < 0 ? "down" : "up") + " " + Math.abs(delta.risk.delta));
      headline = bits.join(" \u00b7 ") || "Scores changed.";
    }

    let html =
      '<details class="v-section v-delta" open>' +
      '<summary class="v-group"><span class="v-group-label">What changed' +
      (when ? ' <span class="v-muted">(vs ' + escapeHtml(when) + ")</span>" : "") +
      '</span><span class="v-delta-verdict ' + verdictCls + '">' + escapeHtml(verdictText) + "</span></summary>" +
      '<div class="v-delta-body">' +
      '<p class="v-delta-headline">' + escapeHtml(headline) + "</p>";

    // Improvements first - what the user achieved.
    html +=
      '<div class="v-delta-block good">' +
      '<div class="v-delta-block-title"><span class="v-delta-ico">\u2713</span> Added / now stated</div>' +
      line(delta.added, "ok", "Nothing new was added.") +
      "</div>";

    if (delta.fixedRisks.length) {
      html +=
        '<div class="v-delta-block good">' +
        '<div class="v-delta-block-title"><span class="v-delta-ico">\u2713</span> Risks fixed</div>' +
        line(delta.fixedRisks, "ok", "") +
        "</div>";
    }

    // Regressions next - the most important negative signal.
    html +=
      '<div class="v-delta-block bad">' +
      '<div class="v-delta-block-title"><span class="v-delta-ico">!</span> New risks introduced</div>' +
      line(delta.newRisks, "bad", "None - no new risks appeared.") +
      "</div>";

    html +=
      '<div class="v-delta-block bad">' +
      '<div class="v-delta-block-title"><span class="v-delta-ico">!</span> Controls regressed (were stated, now missing)</div>' +
      line(delta.newlyMissing, "bad", "None - nothing was lost.") +
      "</div>";

    // What still needs attention.
    html +=
      '<div class="v-delta-block warn">' +
      '<div class="v-delta-block-title"><span class="v-delta-ico">\u26A0</span> Still missing (' + delta.stillMissing.length + ")</div>" +
      line(delta.stillMissing, "warn", "Nothing - all required controls are stated.") +
      "</div>";

    // Scores last, compact.
    html +=
      '<div class="v-delta-scores">' +
      '<div class="v-delta-score"><span class="v-muted">Risk</span> ' +
      delta.risk.from + " \u2192 " + delta.risk.to + " " +
      '<span class="' + (delta.risk.direction === "down" ? "ok" : delta.risk.direction === "up" ? "bad" : "") + '">' +
      arrow(delta.risk.direction) + " " + Math.abs(delta.risk.delta) + "</span></div>" +
      '<div class="v-delta-score"><span class="v-muted">Coverage</span> ' +
      delta.coverage.from + "% \u2192 " + delta.coverage.to + "% " +
      '<span class="' + (delta.coverage.direction === "up" ? "ok" : delta.coverage.direction === "down" ? "bad" : "") + '">' +
      arrow(delta.coverage.direction) + " " + Math.abs(delta.coverage.delta) + "%</span></div>" +
      "</div>";

    if (delta.resources.changed) {
      html +=
        '<p class="v-delta-warn">The resource set changed between versions (' +
        delta.resources.from + " \u2192 " + delta.resources.to +
        "), so the scores are not directly comparable.</p>";
    }

    html += "</div></details>";
    return html;
  }

  /** Shown when there is no comparable previous version. */
  function deltaEmptyHtml(hadHistory) {
    return (
      '<details class="v-section v-delta">' +
      '<summary class="v-group"><span class="v-group-label">Security Delta</span>' +
      '<span class="v-count">new</span></summary>' +
      '<div class="v-delta-body"><p class="v-muted">' +
      (hadHistory
        ? "No earlier version of this resource set to compare against."
        : "First analysis of this prompt - run it again after editing to see what changed.") +
      "</p></div></details>"
    );
  }

  /**
   * Render a full report into a container.
   * @param {HTMLElement} container
   * @param {object} report
   * @param {object} state  { accepted: {id:boolean} }
   * @param {object} handlers { onToggle, onAcceptAll, onClearAll, onHarden }
   * @param {object} [opts]  { delta, prevReport, hadHistory }
   */
  function render(container, report, state, handlers, opts) {
    handlers = handlers || {};
    opts = opts || {};
    const accepted = (state && state.accepted) || {};

    // Out of scope: not an infrastructure prompt, so nothing to diagnose.
    if (report && report.outOfScope) {
      container.innerHTML =
        '<div class="v-banner warn">' +
        escapeHtml((report.feedback && report.feedback[0]) || "Not an AWS infrastructure prompt.") +
        "</div>";
      return;
    }

    // Deep scan reported nothing further to flag, and no risky statements.
    if (report && report.aiClean && !report.missing.length && !report.riskyFindings.length) {
      container.innerHTML =
        '<div class="v-banner ok">No issues found. This prompt already covers the required AWS security controls for the recognised resources.</div>' +
        deltaHtml(opts.delta, opts.prevReport) +
        disclaimerHtml(report);
      return;
    }

    const deltaSection = opts.delta
      ? deltaHtml(opts.delta, opts.prevReport)
      : (opts.hadHistory ? deltaEmptyHtml(true) : "");

    container.innerHTML =
      bannerHtml(report) +
      deltaSection +
      riskHtml(report, coverage(report, state)) +
      feedbackHtml(report) +
      relatedHtml(report) +
      detectedHtml(report) +
      findingsHtml(report, accepted) +
      missingHtml(report, accepted) +
      disclaimerHtml(report);

    container.querySelectorAll("[data-toggle]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (handlers.onToggle) handlers.onToggle(btn.getAttribute("data-toggle"));
      });
    });
    const aa = container.querySelector('[data-action="accept-all"]');
    if (aa) aa.addEventListener("click", () => handlers.onAcceptAll && handlers.onAcceptAll());
    const ca = container.querySelector('[data-action="clear-all"]');
    if (ca) ca.addEventListener("click", () => handlers.onClearAll && handlers.onClearAll());
    const hb = container.querySelector('[data-action="harden"]');
    if (hb) hb.addEventListener("click", () => handlers.onHarden && handlers.onHarden());
  }

  const VectorUI = {
    render: render,
    deltaHtml: deltaHtml,
    buildImprovedPrompt: buildImprovedPrompt,
    acceptedClauses: acceptedClauses,
    escapeHtml: escapeHtml,
    severityClass: severityClass,
    SEV_ORDER: SEV_ORDER,
    coverage: coverage,
    // html builders exposed for testing
    riskHtml: riskHtml,
    findingsHtml: findingsHtml,
    missingHtml: missingHtml
  };

  if (typeof module !== "undefined" && module.exports) module.exports = VectorUI;
  root.VectorUI = VectorUI;
})(typeof globalThis !== "undefined" ? globalThis : this);
