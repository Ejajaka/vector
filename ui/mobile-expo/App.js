// Vector - React Native (Expo) app. Reuses the shared rule engine (src/).
// Designed to stay readable: a live summary in the header, confirmed gaps shown
// first, clarification/optional behind a toggle, and a toast on "Add clause".
import React, { useState } from "react";
import {
  ScrollView,
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  Share,
  StyleSheet,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

const VectorAnalyzer = require("./src/analyzer");
const VectorLLM = require("./src/llm");

// One resource, no risky statements: a calm first impression.
const SAMPLE = "Create an S3 bucket to store user documents.";

const DEFAULTS = {
  apiKey: "",
  baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
  model: "gemini-2.5-flash",
};

const RISK_COLOR = {
  CRITICAL: "#f87171",
  HIGH: "#f87171",
  MEDIUM: "#fbbf24",
  LOW: "#4ade80",
  MINIMAL: "#4ade80",
};
const SEV_COLOR = { high: "#f87171", medium: "#fbbf24", low: "#4ade80" };

function buildImproved(prompt, clauses) {
  const list = (clauses || []).filter(Boolean);
  if (!list.length) return String(prompt || "").trim();
  return String(prompt || "").trim() + "\n\nSecurity requirements:\n" + list.map((c) => "- " + c).join("\n");
}

function project(report, accepted) {
  return VectorAnalyzer.project(report, accepted);
}

export default function App() {
  const [prompt, setPrompt] = useState("");
  const [report, setReport] = useState(null);
  const [accepted, setAccepted] = useState({});
  const [settings, setSettings] = useState(DEFAULTS);
  const [showSettings, setShowSettings] = useState(false);
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [status, setStatus] = useState("");
  const [toast, setToast] = useState("");
  const [showClarify, setShowClarify] = useState(false);
  const [showHarden, setShowHarden] = useState(false);

  function flash(msg) {
    setToast(msg);
    setTimeout(() => setToast(""), 1400);
  }

  function acceptedClauses(rep, acc) {
    const out = [];
    for (const id of Object.keys(acc)) {
      if (!acc[id]) continue;
      const m = rep.missing.find((x) => x.id === id);
      if (m) out.push(m.clause);
      const f = rep.riskyFindings.find((x) => x.id === id);
      if (f) out.push(f.fix);
    }
    return out;
  }

  function analyze(text) {
    const p = (text !== undefined ? text : prompt).trim();
    if (!p) {
      setStatus("Enter a prompt first");
      return;
    }
    const rep = VectorAnalyzer.analyze(p, { strictMode: false });
    setReport(rep);
    setAccepted({});
    setShowClarify(false);
    setShowHarden(false);
    setStatus("");
    if (rep.needsDeepScan && settings.apiKey) runDeepScan(rep);
  }

  async function runDeepScan(rep) {
    const target = rep || report;
    if (!target) return;
    if (!settings.apiKey) {
      setShowSettings(true);
      setStatus("Add an API key for deep scan");
      return;
    }
    setBusy(true);
    try {
      const result = await VectorLLM.deepScan(target.prompt, settings);
      setReport(VectorAnalyzer.mergeFindings(target, result.findings));
      setStatus("");
      flash("Deep scan merged (" + result.via + ")");
    } catch (e) {
      setStatus(e.message || "Deep scan failed");
    } finally {
      setBusy(false);
    }
  }

  function toggle(id, label) {
    setAccepted((prev) => {
      const next = Object.assign({}, prev, { [id]: !prev[id] });
      const proj = report ? project(report, next) : null;
      if (proj && next[id]) flash(label + " added · coverage " + proj.coverageScore + "%");
      return next;
    });
  }

  function hardenNow() {
    const p = (report ? report.prompt : prompt).trim();
    if (!p) {
      setStatus("Enter a prompt first");
      return;
    }
    const h = VectorAnalyzer.harden(p);
    setReport(h.report);
    setAccepted({});
    setShowClarify(false);
    setShowHarden(false);
    flash("Hardened · risk " + h.report.riskScore + " · coverage " + h.report.coverageScore + "%");
  }

  const improved = report ? buildImproved(report.prompt, acceptedClauses(report, accepted)) : "";
  const proj = report ? project(report, accepted) : null;

  const core = report ? report.missing.filter((m) => (m.tier || "clarify") === "core") : [];
  const clarify = report ? report.missing.filter((m) => (m.tier || "clarify") === "clarify") : [];
  const harden = report ? report.missing.filter((m) => (m.tier || "clarify") === "harden") : [];

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safe} edges={["top", "left", "right", "bottom"]}>
        <StatusBar style="light" />

        <View style={styles.header}>
          <View style={styles.logo}><Text style={styles.logoText}>V</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.h1}>Vector</Text>
            <Text style={styles.sub}>
              {report
                ? report.riskLevel + " " + proj.riskScore + "  ·  coverage " + proj.coverageScore + "%"
                : "AWS prompt security"}
            </Text>
          </View>
          <Pressable style={styles.iconBtn} onPress={() => setShowSettings((s) => !s)}>
            <Text style={styles.iconText}>⚙</Text>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {showSettings ? (
            <View style={styles.settings}>
              <Text style={styles.label}>Deep scan API key (optional)</Text>
              <TextInput
                style={styles.input}
                value={settings.apiKey}
                onChangeText={(t) => setSettings(Object.assign({}, settings, { apiKey: t }))}
                placeholder="AIza..."
                placeholderTextColor="#9ca3af"
                autoCapitalize="none"
                secureTextEntry
              />
              <Text style={styles.label}>Base URL</Text>
              <TextInput
                style={styles.input}
                value={settings.baseUrl}
                onChangeText={(t) => setSettings(Object.assign({}, settings, { baseUrl: t }))}
                autoCapitalize="none"
                autoCorrect={false}
                placeholderTextColor="#9ca3af"
              />
              <Text style={styles.label}>Model</Text>
              <TextInput
                style={styles.input}
                value={settings.model}
                onChangeText={(t) => setSettings(Object.assign({}, settings, { model: t }))}
                autoCapitalize="none"
                autoCorrect={false}
                placeholderTextColor="#9ca3af"
              />
            </View>
          ) : null}

          <Text style={styles.label}>AWS infrastructure prompt</Text>
          <TextInput
            style={styles.textarea}
            value={prompt}
            onChangeText={setPrompt}
            placeholder="e.g. Create an S3 bucket for user documents."
            placeholderTextColor="#9ca3af"
            multiline
          />

          <View style={styles.row}>
            <Pressable style={styles.ghostBtn} onPress={() => { setPrompt(SAMPLE); analyze(SAMPLE); }}>
              <Text style={styles.ghostText}>Sample</Text>
            </Pressable>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Pressable style={styles.ghostBtn} onPress={() => runDeepScan()} disabled={busy}>
                {busy ? <ActivityIndicator size="small" color="#818cf8" /> : <Text style={styles.ghostText}>Deep scan</Text>}
              </Pressable>
              <Pressable style={styles.primaryBtn} onPress={() => analyze()}>
                <Text style={styles.primaryText}>Analyze</Text>
              </Pressable>
            </View>
          </View>

          {status ? <Text style={styles.status}>{status}</Text> : null}

          {scanning ? (
            <View style={styles.results}>
              <View style={styles.warn}>
                <Text style={styles.warnText}>Running deep scan on this prompt…</Text>
              </View>
            </View>
          ) : report && report.outOfScope ? (
            <View style={styles.results}>
              <View style={styles.warn}>
                <Text style={styles.warnText}>{report.feedback[0]}</Text>
              </View>
            </View>
          ) : report && report.aiClean && !report.missing.length && !report.riskyFindings.length ? (
            <View style={styles.results}>
              <View style={styles.ok}>
                <Text style={styles.okText}>
                  No issues found. This prompt already covers the required AWS security controls.
                </Text>
              </View>
              <Text style={styles.disclaimer}>{report.disclaimer}</Text>
            </View>
          ) : report ? (
            <View style={styles.results}>
              {report.nonAwsLikely ? (
                <View style={styles.warn}>
                  <Text style={styles.warnText}>
                    This looks like a non-AWS cloud prompt. Vector is AWS-specific.
                  </Text>
                </View>
              ) : null}

              <View style={[styles.riskCard, { borderLeftColor: RISK_COLOR[report.riskLevel] || "#94a3b8" }]}>
                <View style={styles.riskTop}>
                  <Text style={[styles.riskScore, { color: RISK_COLOR[report.riskLevel] || "#94a3b8" }]}>{proj.riskScore}</Text>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[styles.riskLevel, { color: RISK_COLOR[report.riskLevel] || "#94a3b8" }]}>
                      {report.riskLevel} RISK
                    </Text>
                    <Text style={styles.riskMeta}>
                      started {report.riskScore} · coverage {report.coverageScore}% → {proj.coverageScore}%
                    </Text>
                  </View>
                </View>
                <View style={styles.covTrack}>
                  <View style={[styles.covFill, { width: Math.max(2, proj.coverageScore) + "%" }]} />
                </View>
                <View style={styles.tierRow}>
                  <Text style={[styles.tierChip, { color: "#f87171" }]}>{core.length} confirmed</Text>
                  <Text style={[styles.tierChip, { color: "#fbbf24" }]}>{clarify.length} clarify</Text>
                  <Text style={[styles.tierChip, { color: "#60a5fa" }]}>{harden.length} optional</Text>
                </View>
                <Pressable style={styles.acceptTop} onPress={hardenNow}>
                  <Text style={styles.acceptTopText}>Harden prompt → risk 0</Text>
                </Pressable>
                {report.needsDeepScan ? (
                  <Text style={styles.note}>
                    {settings.apiKey
                      ? "Low confidence" + (busy ? " — running Deep scan…" : " — Deep scan applied/available")
                      : "Low confidence — add an API key in ⚙ to run Deep scan automatically."}
                  </Text>
                ) : null}
              </View>

              {report.riskyFindings.length ? (
                <View>
                  <Text style={styles.h2}>Risky ({report.riskyFindings.length})</Text>
                  {report.riskyFindings.map((f) => (
                    <Card key={f.id} id={f.id} accepted={accepted} onToggle={toggle} color="#f87171"
                      badge={f.severity} title={f.label} desc={f.description} clause={"Fix: " + f.fix} />
                  ))}
                </View>
              ) : null}

              <Text style={styles.h2}>Confirmed gaps ({core.length})</Text>
              {core.length === 0 ? <Text style={styles.none}>None. ✓</Text> : null}
              {core.map((m) => (
                <Card key={m.id} id={m.id} accepted={accepted} onToggle={toggle}
                  color={SEV_COLOR[m.severity] || "#fbbf24"}
                  badge={m.severity + (m.source === "ai" ? " · AI" : "")}
                  title={m.label} desc={m.description} clause={m.clause} tf={m.tf} />
              ))}

              {clarify.length ? (
                <View>
                  <Pressable style={styles.toggle} onPress={() => setShowClarify((s) => !s)}>
                    <Text style={styles.toggleText}>
                      {showClarify ? "− Hide" : "+ Show"} clarification ({clarify.length})
                    </Text>
                  </Pressable>
                  {showClarify
                    ? clarify.map((m) => (
                        <Card key={m.id} id={m.id} accepted={accepted} onToggle={toggle}
                          color={SEV_COLOR[m.severity] || "#fbbf24"}
                          badge={m.severity + (m.source === "ai" ? " · AI" : "")}
                          title={m.label} desc={m.description} clause={m.clause} tf={m.tf} />
                      ))
                    : null}
                </View>
              ) : null}

              {harden.length ? (
                <View>
                  <Pressable style={styles.toggle} onPress={() => setShowHarden((s) => !s)}>
                    <Text style={styles.toggleText}>
                      {showHarden ? "− Hide" : "+ Show"} optional hardening ({harden.length})
                    </Text>
                  </Pressable>
                  {showHarden
                    ? harden.map((m) => (
                        <Card key={m.id} id={m.id} accepted={accepted} onToggle={toggle}
                          color={SEV_COLOR[m.severity] || "#4ade80"}
                          badge={m.severity + (m.source === "ai" ? " · AI" : "")}
                          title={m.label} desc={m.description} clause={m.clause} tf={m.tf} />
                      ))
                    : null}
                </View>
              ) : null}

              <View style={styles.rowBetween}>
                <Text style={styles.h2}>Improved prompt</Text>
                <Pressable onPress={() => Share.share({ message: improved })}>
                  <Text style={styles.link}>Share</Text>
                </Pressable>
              </View>
              <Text style={styles.improved}>{improved}</Text>
              <Text style={styles.disclaimer}>{report.disclaimer}</Text>
            </View>
          ) : null}
        </ScrollView>

        {toast ? (
          <View style={styles.toast} pointerEvents="none">
            <Text style={styles.toastText}>{toast}</Text>
          </View>
        ) : null}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

function Card({ id, accepted, onToggle, color, badge, title, desc, clause, tf }) {
  const on = !!accepted[id];
  return (
    <View style={[styles.card, { borderLeftColor: color }, on && styles.cardOn]}>
      <View style={styles.cardHead}>
        <View style={[styles.badge, { borderColor: color }]}>
          <Text style={[styles.badgeText, { color }]}>{badge}</Text>
        </View>
        <Text style={styles.cardTitle}>{title}</Text>
      </View>
      {desc ? <Text style={styles.cardDesc}>{desc}</Text> : null}
      {clause ? <Text style={styles.clause}>{clause}</Text> : null}
      {tf ? <Text style={styles.tf}>Terraform: {tf}</Text> : null}
      <Pressable style={[styles.smallBtn, on && styles.smallBtnOn]} onPress={() => onToggle(id, title)}>
        <Text style={[styles.smallBtnText, on && styles.smallBtnTextOn]}>
          {on ? "Added ✓" : "+ Add clause"}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0f172a" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, backgroundColor: "#111827", borderBottomWidth: 1, borderBottomColor: "#1f2937" },
  logo: { width: 36, height: 36, borderRadius: 10, backgroundColor: "#6366f1", alignItems: "center", justifyContent: "center", marginRight: 10 },
  logoText: { color: "#fff", fontWeight: "800", fontSize: 17 },
  h1: { fontSize: 17, fontWeight: "800", color: "#f9fafb" },
  sub: { fontSize: 12, color: "#a5b4fc", fontWeight: "700" },
  iconBtn: { borderWidth: 1, borderColor: "#334155", borderRadius: 9, width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  iconText: { fontSize: 19, color: "#e5e7eb" },

  body: { padding: 16, paddingBottom: 60, backgroundColor: "#0f172a" },
  settings: { borderWidth: 1, borderColor: "#1f2937", borderRadius: 12, padding: 14, marginBottom: 16, backgroundColor: "#111827" },
  label: { fontSize: 13, fontWeight: "700", marginBottom: 6, color: "#e5e7eb" },
  input: { borderWidth: 1, borderColor: "#334155", borderRadius: 9, padding: 10, marginBottom: 10, fontSize: 14, color: "#f9fafb", backgroundColor: "#0f172a" },
  textarea: { borderWidth: 1, borderColor: "#334155", borderRadius: 12, padding: 12, minHeight: 110, fontSize: 14, color: "#f9fafb", backgroundColor: "#111827", textAlignVertical: "top" },

  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 12 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 22 },
  ghostBtn: { paddingVertical: 8, paddingHorizontal: 12, marginRight: 8 },
  ghostText: { color: "#c7d2fe", fontWeight: "700" },
  primaryBtn: { backgroundColor: "#6366f1", borderRadius: 10, paddingVertical: 11, paddingHorizontal: 18 },
  primaryText: { color: "#fff", fontWeight: "800" },
  status: { marginTop: 10, color: "#9ca3af", fontSize: 12 },
  link: { color: "#818cf8", fontWeight: "700", fontSize: 13 },

  results: { marginTop: 16 },
  warn: { backgroundColor: "#78350f", borderRadius: 10, padding: 12, marginBottom: 12 },
  warnText: { color: "#fde68a", fontSize: 12 },
  ok: { backgroundColor: "#052e16", borderWidth: 1, borderColor: "#16a34a", borderRadius: 10, padding: 12, marginBottom: 12 },
  okText: { color: "#4ade80", fontSize: 12.5 },

  riskCard: { borderWidth: 1, borderColor: "#1f2937", borderLeftWidth: 5, borderRadius: 12, padding: 14, backgroundColor: "#111827" },
  riskTop: { flexDirection: "row", alignItems: "center" },
  riskScore: { fontSize: 42, fontWeight: "900" },
  riskLevel: { fontSize: 13, fontWeight: "800" },
  riskMeta: { fontSize: 11, color: "#9ca3af", marginTop: 2 },
  covTrack: { height: 8, borderRadius: 4, backgroundColor: "#1f2937", marginTop: 10, overflow: "hidden" },
  covFill: { height: 8, borderRadius: 4, backgroundColor: "#22c55e" },
  tierRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 10 },
  tierChip: { fontSize: 11, fontWeight: "700" },
  acceptTop: { marginTop: 12, borderWidth: 1, borderColor: "#6366f1", borderRadius: 9, paddingVertical: 9, alignItems: "center" },
  acceptTopText: { color: "#a5b4fc", fontWeight: "700", fontSize: 12 },
  note: { marginTop: 10, fontSize: 11, color: "#fbbf24" },

  h2: { fontSize: 15, fontWeight: "800", marginTop: 20, color: "#f9fafb" },
  none: { color: "#4ade80", fontSize: 13, marginTop: 6 },
  toggle: { marginTop: 16, borderWidth: 1, borderColor: "#334155", borderRadius: 10, paddingVertical: 10, alignItems: "center" },
  toggleText: { color: "#c7d2fe", fontWeight: "700", fontSize: 13 },

  card: { borderWidth: 1, borderColor: "#1f2937", borderLeftWidth: 4, borderRadius: 12, padding: 12, marginBottom: 10, backgroundColor: "#111827" },
  cardOn: { backgroundColor: "#052e16", borderColor: "#16a34a" },
  cardHead: { flexDirection: "row", alignItems: "center", flexWrap: "wrap" },
  badge: { borderWidth: 1, borderRadius: 5, paddingHorizontal: 6, paddingVertical: 1, marginRight: 8 },
  badgeText: { fontSize: 10, fontWeight: "800", textTransform: "uppercase" },
  cardTitle: { fontSize: 14, fontWeight: "700", color: "#f9fafb", flexShrink: 1 },
  cardDesc: { fontSize: 12, color: "#cbd5e1", marginTop: 6, lineHeight: 17 },
  clause: { fontFamily: "monospace", fontSize: 11.5, color: "#e2e8f0", backgroundColor: "#0b1220", padding: 9, borderRadius: 8, marginTop: 8, lineHeight: 17 },
  tf: { fontSize: 11, color: "#94a3b8", marginTop: 6, lineHeight: 15 },
  smallBtn: { alignSelf: "flex-start", borderWidth: 1, borderColor: "#6366f1", borderRadius: 8, paddingVertical: 7, paddingHorizontal: 12, marginTop: 10 },
  smallBtnOn: { borderColor: "#16a34a", backgroundColor: "#052e16" },
  smallBtnText: { color: "#a5b4fc", fontWeight: "700", fontSize: 12 },
  smallBtnTextOn: { color: "#4ade80" },
  improved: { fontFamily: "monospace", fontSize: 12, color: "#e2e8f0", backgroundColor: "#0b1220", padding: 12, borderRadius: 10, marginTop: 6, lineHeight: 18 },
  disclaimer: { marginTop: 18, fontSize: 11, fontStyle: "italic", color: "#94a3b8" },

  toast: { position: "absolute", left: 20, right: 20, bottom: 24, backgroundColor: "#16a34a", borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14, alignItems: "center" },
  toastText: { color: "#fff", fontWeight: "700", fontSize: 13 },
});
