// Vector - React Native (Expo) app. Reuses the shared rule engine (src/).
// UI rebuilt with React Native components; live coverage + tiered findings.
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

const SAMPLE =
  "Create an S3 bucket to store user documents and an EC2 instance running a web server " +
  "with a security group that allows SSH from 0.0.0.0/0. Give the instance an IAM role with admin access.";

const DEFAULTS = {
  apiKey: "",
  baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
  model: "gemini-2.0-flash",
};

const RISK_COLOR = {
  CRITICAL: "#b91c1c",
  HIGH: "#dc2626",
  MEDIUM: "#d97706",
  LOW: "#16a34a",
  MINIMAL: "#16a34a",
};
const SEV_COLOR = { high: "#dc2626", medium: "#d97706", low: "#16a34a" };
const TIERS = [
  { key: "core", label: "Confirmed gaps", color: "#dc2626" },
  { key: "clarify", label: "Needs clarification", color: "#d97706" },
  { key: "harden", label: "Optional hardening", color: "#0ea5e9" },
];

function buildImproved(prompt, clauses) {
  const list = (clauses || []).filter(Boolean);
  if (!list.length) return String(prompt || "").trim();
  return String(prompt || "").trim() + "\n\nSecurity requirements:\n" + list.map((c) => "- " + c).join("\n");
}

function liveCoverage(report, accepted) {
  const proj = VectorAnalyzer.project(report, accepted);
  return {
    before: report.coverageScore,
    after: proj.coverageScore,
    riskBefore: report.riskScore,
    riskAfter: proj.riskScore,
  };
}

export default function App() {
  const [prompt, setPrompt] = useState("");
  const [report, setReport] = useState(null);
  const [accepted, setAccepted] = useState({});
  const [settings, setSettings] = useState(DEFAULTS);
  const [showSettings, setShowSettings] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

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
      setStatus("Deep scan merged (" + result.via + ")");
    } catch (e) {
      setStatus(e.message || "Deep scan failed");
    } finally {
      setBusy(false);
    }
  }

  function toggle(id) {
    setAccepted((prev) => Object.assign({}, prev, { [id]: !prev[id] }));
  }
  function acceptAll() {
    if (!report) return;
    const next = {};
    report.missing.forEach((m) => (next[m.id] = true));
    report.riskyFindings.forEach((f) => (next[f.id] = true));
    setAccepted(next);
  }

  const improved = report ? buildImproved(report.prompt, acceptedClauses(report, accepted)) : "";
  const cov = report ? liveCoverage(report, accepted) : null;

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safe} edges={["top", "left", "right", "bottom"]}>
        <StatusBar style="light" />
        <View style={styles.header}>
          <View style={styles.logo}><Text style={styles.logoText}>V</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.h1}>Vector</Text>
            <Text style={styles.sub}>AWS prompt security</Text>
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
              <Text style={styles.hint}>On-device models aren't available on phones, so deep scan uses your key.</Text>
            </View>
          ) : null}

          <Text style={styles.label}>AWS infrastructure prompt</Text>
          <TextInput
            style={styles.textarea}
            value={prompt}
            onChangeText={setPrompt}
            placeholder="e.g. Create an S3 bucket and an EC2 instance running a web server."
            placeholderTextColor="#9ca3af"
            multiline
          />

          <View style={styles.row}>
            <Pressable style={styles.ghostBtn} onPress={() => { setPrompt(SAMPLE); analyze(SAMPLE); }}>
              <Text style={styles.ghostText}>Sample</Text>
            </Pressable>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Pressable style={styles.ghostBtn} onPress={() => runDeepScan()} disabled={busy}>
                {busy ? <ActivityIndicator size="small" color="#6366f1" /> : <Text style={styles.ghostText}>Deep scan</Text>}
              </Pressable>
              <Pressable style={styles.primaryBtn} onPress={() => analyze()}>
                <Text style={styles.primaryText}>Analyze</Text>
              </Pressable>
            </View>
          </View>

          {status ? <Text style={styles.status}>{status}</Text> : null}

          {report ? (
            <View style={styles.results}>
              {report.nonAwsLikely ? (
                <View style={styles.warn}>
                  <Text style={styles.warnText}>
                    This looks like a non-AWS cloud prompt. Vector is AWS-specific, so treat these as generic advice.
                  </Text>
                </View>
              ) : null}

              {/* Risk + coverage card */}
              <View style={[styles.riskCard, { borderLeftColor: RISK_COLOR[report.riskLevel] || "#6b7280" }]}>
                <View style={styles.riskTop}>
                  <Text style={[styles.riskScore, { color: RISK_COLOR[report.riskLevel] }]}>{report.riskScore}</Text>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[styles.riskLevel, { color: RISK_COLOR[report.riskLevel] }]}>
                      {report.riskLevel} RISK
                    </Text>
                    <Text style={styles.riskMeta}>
                      {report.stats.resources} resource(s) · {report.stats.missing} missing · {report.stats.risky} risky
                    </Text>
                  </View>
                </View>

                <View style={styles.covRow}>
                  <Text style={styles.covLabel}>
                    Risk{" "}
                    <Text style={styles.covValue}>
                      {cov.riskBefore}
                      {cov.riskAfter < cov.riskBefore ? " → " + cov.riskAfter : ""}
                    </Text>
                    {"    "}Coverage{" "}
                    <Text style={styles.covValue}>
                      {cov.before}%{cov.after > cov.before ? " → " + cov.after + "%" : ""}
                    </Text>
                  </Text>
                </View>
                <View style={styles.covTrack}>
                  <View style={[styles.covFill, { width: Math.max(2, cov.after) + "%" }]} />
                </View>

                <View style={styles.tierRow}>
                  <Text style={[styles.tierChip, { color: "#dc2626" }]}>{report.tierCounts.core} confirmed</Text>
                  <Text style={[styles.tierChip, { color: "#d97706" }]}>{report.tierCounts.clarify} clarify</Text>
                  <Text style={[styles.tierChip, { color: "#0ea5e9" }]}>{report.tierCounts.harden} optional</Text>
                </View>
              </View>

              {report.riskyFindings.length ? (
                <View>
                  <Text style={styles.h2}>Risky statements</Text>
                  {report.riskyFindings.map((f) => (
                    <FindingCard
                      key={f.id}
                      id={f.id}
                      accepted={accepted}
                      onToggle={toggle}
                      color="#b91c1c"
                      badge={f.severity}
                      title={f.label}
                      desc={f.description}
                      clause={"Fix: " + f.fix}
                    />
                  ))}
                </View>
              ) : null}

              <View style={styles.rowBetween}>
                <Text style={styles.h2}>Missing constraints ({report.missing.length})</Text>
                <Pressable onPress={acceptAll}><Text style={styles.link}>Accept all</Text></Pressable>
              </View>

              {TIERS.map((t) => {
                const items = report.missing.filter((m) => (m.tier || "clarify") === t.key);
                if (!items.length) return null;
                return (
                  <View key={t.key}>
                    <View style={styles.groupRow}>
                      <View style={[styles.groupDot, { backgroundColor: t.color }]} />
                      <Text style={styles.group}>{t.label} ({items.length})</Text>
                    </View>
                    {items.map((m) => (
                      <FindingCard
                        key={m.id}
                        id={m.id}
                        accepted={accepted}
                        onToggle={toggle}
                        color={SEV_COLOR[m.severity] || "#d97706"}
                        badge={m.severity + (m.source === "ai" ? " · AI" : "")}
                        title={m.label}
                        desc={m.description}
                        clause={m.clause}
                      />
                    ))}
                  </View>
                );
              })}

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
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

function FindingCard({ id, accepted, onToggle, color, badge, title, desc, clause }) {
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
      <Pressable style={[styles.smallBtn, on && styles.smallBtnOn]} onPress={() => onToggle(id)}>
        <Text style={[styles.smallBtnText, on && styles.smallBtnTextOn]}>
          {on ? "Added ✓" : "+ Add clause"}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0f172a" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#111827",
    borderBottomWidth: 1,
    borderBottomColor: "#1f2937",
  },
  logo: { width: 36, height: 36, borderRadius: 10, backgroundColor: "#6366f1", alignItems: "center", justifyContent: "center", marginRight: 10 },
  logoText: { color: "#fff", fontWeight: "800", fontSize: 17 },
  h1: { fontSize: 17, fontWeight: "800", color: "#f9fafb" },
  sub: { fontSize: 11, color: "#9ca3af" },
  iconBtn: { borderWidth: 1, borderColor: "#334155", borderRadius: 9, width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  iconText: { fontSize: 19, color: "#e5e7eb" },

  body: { padding: 16, paddingBottom: 48, backgroundColor: "#0f172a" },
  settings: { borderWidth: 1, borderColor: "#1f2937", borderRadius: 12, padding: 14, marginBottom: 16, backgroundColor: "#111827" },
  label: { fontSize: 13, fontWeight: "700", marginBottom: 6, color: "#e5e7eb" },
  hint: { fontSize: 11, color: "#9ca3af", marginTop: 4 },
  input: { borderWidth: 1, borderColor: "#334155", borderRadius: 9, padding: 10, marginBottom: 10, fontSize: 14, color: "#f9fafb", backgroundColor: "#0f172a" },
  textarea: { borderWidth: 1, borderColor: "#334155", borderRadius: 12, padding: 12, minHeight: 120, fontSize: 14, color: "#f9fafb", backgroundColor: "#111827", textAlignVertical: "top" },

  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 12 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 20 },
  ghostBtn: { paddingVertical: 8, paddingHorizontal: 12, marginRight: 8 },
  ghostText: { color: "#c7d2fe", fontWeight: "700" },
  primaryBtn: { backgroundColor: "#6366f1", borderRadius: 10, paddingVertical: 11, paddingHorizontal: 18 },
  primaryText: { color: "#fff", fontWeight: "800" },
  status: { marginTop: 10, color: "#9ca3af", fontSize: 12 },
  link: { color: "#818cf8", fontWeight: "700", fontSize: 13 },

  results: { marginTop: 16 },
  warn: { backgroundColor: "#78350f", borderRadius: 10, padding: 12, marginBottom: 12 },
  warnText: { color: "#fde68a", fontSize: 12 },

  riskCard: { borderWidth: 1, borderColor: "#1f2937", borderLeftWidth: 5, borderRadius: 12, padding: 14, backgroundColor: "#111827" },
  riskTop: { flexDirection: "row", alignItems: "center" },
  riskScore: { fontSize: 40, fontWeight: "900" },
  riskLevel: { fontSize: 13, fontWeight: "800" },
  riskMeta: { fontSize: 11, color: "#9ca3af", marginTop: 2 },

  covRow: { marginTop: 12 },
  covLabel: { fontSize: 12, color: "#9ca3af" },
  covValue: { color: "#f9fafb", fontWeight: "800" },
  covTrack: { height: 8, borderRadius: 4, backgroundColor: "#1f2937", marginTop: 6, overflow: "hidden" },
  covFill: { height: 8, borderRadius: 4, backgroundColor: "#22c55e" },
  tierRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 10 },
  tierChip: { fontSize: 11, fontWeight: "700" },

  h2: { fontSize: 15, fontWeight: "800", marginTop: 20, color: "#f9fafb" },
  groupRow: { flexDirection: "row", alignItems: "center", marginTop: 16, marginBottom: 8 },
  groupDot: { width: 9, height: 9, borderRadius: 5, marginRight: 8 },
  group: { fontSize: 13, fontWeight: "800", color: "#e5e7eb" },

  card: { borderWidth: 1, borderColor: "#1f2937", borderLeftWidth: 4, borderRadius: 12, padding: 12, marginBottom: 10, backgroundColor: "#111827" },
  cardOn: { backgroundColor: "#052e16", borderColor: "#16a34a" },
  cardHead: { flexDirection: "row", alignItems: "center", flexWrap: "wrap" },
  badge: { borderWidth: 1, borderRadius: 5, paddingHorizontal: 6, paddingVertical: 1, marginRight: 8 },
  badgeText: { fontSize: 10, fontWeight: "800", textTransform: "uppercase" },
  cardTitle: { fontSize: 14, fontWeight: "700", color: "#f9fafb", flexShrink: 1 },
  cardDesc: { fontSize: 12, color: "#cbd5e1", marginTop: 6, lineHeight: 17 },
  clause: { fontFamily: "monospace", fontSize: 11.5, color: "#e2e8f0", backgroundColor: "#0b1220", padding: 9, borderRadius: 8, marginTop: 8, lineHeight: 17 },
  smallBtn: { alignSelf: "flex-start", borderWidth: 1, borderColor: "#6366f1", borderRadius: 8, paddingVertical: 7, paddingHorizontal: 12, marginTop: 10 },
  smallBtnOn: { borderColor: "#16a34a", backgroundColor: "#052e16" },
  smallBtnText: { color: "#a5b4fc", fontWeight: "700", fontSize: 12 },
  smallBtnTextOn: { color: "#4ade80" },
  improved: { fontFamily: "monospace", fontSize: 12, color: "#e2e8f0", backgroundColor: "#0b1220", padding: 12, borderRadius: 10, marginTop: 6, lineHeight: 18 },
  disclaimer: { marginTop: 18, fontSize: 11, fontStyle: "italic", color: "#94a3b8" },
});
