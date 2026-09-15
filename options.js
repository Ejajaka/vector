"use strict";

(function () {
  const el = {
    strict: document.getElementById("strict"),
    policy: document.getElementById("policy"),
    auto: document.getElementById("auto"),
    key: document.getElementById("key"),
    url: document.getElementById("url"),
    model: document.getElementById("model"),
    save: document.getElementById("save"),
    status: document.getElementById("status"),
    localStatus: document.getElementById("local-status"),
    history: document.getElementById("history")
  };

  function showLocalStatus() {
    if (VectorLLM.localAvailable()) {
      el.localStatus.textContent = "On-device model available - deep scan needs no API key.";
    } else {
      el.localStatus.textContent =
        "On-device model not available in this browser. Add an API key to use deep scan, or ignore it.";
    }
  }

  function fill(s) {
    el.strict.checked = !!s.strictMode;
    el.auto.checked = !!s.autoDeepScan;
    el.key.value = s.apiKey || "";
    el.url.value = s.baseUrl || "";
    el.model.value = s.model || "";
    el.policy.value = s.policyText || "";
  }

  function current() {
    return {
      strictMode: el.strict.checked,
      autoDeepScan: el.auto.checked,
      apiKey: el.key.value.trim(),
      baseUrl: el.url.value.trim() || "https://api.openai.com/v1",
      model: el.model.value.trim() || "gpt-4o-mini",
      policyText: el.policy.value
    };
  }

  function renderHistory(list) {
    if (!list.length) {
      el.history.innerHTML = '<p class="sub">No analyses yet.</p>';
      return;
    }
    el.history.innerHTML = list
      .map(function (h) {
        const when = new Date(h.ts).toLocaleString();
        return (
          '<div class="hist"><div class="p">' + escapeHtml(h.prompt) + "</div>" +
          '<div class="meta">' + escapeHtml(h.riskLevel) + " " + h.riskScore + "/100<br>" + when + "</div></div>"
        );
      })
      .join("");
  }

  function escapeHtml(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  el.save.addEventListener("click", function () {
    const s = current();
    if (s.policyText.trim() && !VectorSettings.parsePolicy(s.policyText)) {
      el.status.textContent = "Policy JSON is invalid - not saved.";
      return;
    }
    VectorSettings.save(s);
    el.status.textContent = "Saved.";
    setTimeout(function () { el.status.textContent = ""; }, 1500);
  });

  showLocalStatus();
  VectorSettings.get().then(fill);
  VectorSettings.getHistory().then(renderHistory);
})();
