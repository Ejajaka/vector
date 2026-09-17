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
    history: document.getElementById("history"),
    modelsBtn: document.getElementById("btn-models"),
    modelsStatus: document.getElementById("models-status"),
    modelListField: document.getElementById("model-list-field"),
    modelList: document.getElementById("model-list")
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
      baseUrl: el.url.value.trim() || "https://generativelanguage.googleapis.com/v1beta/openai",
      model: el.model.value.trim() || "gemini-2.5-flash",
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

  // Ask the provider which models this API key can actually use, and offer them.
  el.modelsBtn.addEventListener("click", async function () {
    const key = el.key.value.trim();
    if (!key) {
      el.modelsStatus.textContent = "Enter your API key first.";
      return;
    }
    el.modelsStatus.textContent = "Checking...";
    const base = (el.url.value.trim() || "https://generativelanguage.googleapis.com/v1beta/openai").replace(/\/+$/, "");
    const root = base.replace(/\/openai$/, "");
    try {
      const res = await fetch(root + "/models?key=" + encodeURIComponent(key));
      const data = await res.json();
      const err = Array.isArray(data) ? data[0] && data[0].error : data && data.error;
      if (err) {
        el.modelsStatus.textContent = "Error: " + (err.message || err.status || res.status);
        return;
      }
      const models = (data.models || [])
        .filter((m) => (m.supportedGenerationMethods || []).includes("generateContent"))
        .map((m) => m.name.replace(/^models\//, ""));
      if (!models.length) {
        el.modelsStatus.textContent = "No usable models returned. Check the key and base URL.";
        return;
      }
      el.modelList.innerHTML = models.map((n) => '<option value="' + n + '">' + n + "</option>").join("");
      el.modelListField.classList.remove("hidden");
      el.modelsStatus.textContent = models.length + " model(s) available - pick one above.";
    } catch (e) {
      el.modelsStatus.textContent = "Failed: " + e.message;
    }
  });

  el.modelList.addEventListener("change", function () {
    if (el.modelList.value) el.model.value = el.modelList.value;
  });
})();
