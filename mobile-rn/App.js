// Vector - React Native (Expo) app. Reuses the shared rule engine.
// UI is rebuilt with React Native components (the DOM ui.js cannot apply here).
import React, { useState } from "react";
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  Share,
  StyleSheet,
} from "react-native";

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

function buildImprovedPrompt(prompt, clauses) {
  const list = (clauses || []).filter(Boolean);
  if (!list.length) return String(prompt || "").trim();
  return String(prompt || "").trim() + "\n\nSecurity requirements:\n" + list.map((c) => "- " + c).join("\n");
}

const TIER_LABELS = {
  core: "Confirmed gaps",
  clarify: "Needs clarification",
  harden: "Optional hardening",
};

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

  const improved = report ? buildImprovedPrompt(report.prompt, acceptedClauses(report, accepted)) : "";

  function analyze(text) {
    const p = (text !== undefined ? text : prompt).trim();
    if (!p) {
      setStatus("Enter a prompt first");
      return;
    }
    const rep = VectorAnalyzer.analyze(p, { strictMode: false });
    setReport(rep);
    setAccepted({});
    setStatus(rep.riskLevel + " " + rep.riskScore + "/100 · coverage " + rep.coverageScore + "%");
  }

  async function deepScan() {
    if (!report) {
      analyze();
      return;
    }
    if (!settings.apiKey) {
      setShowSettings(true);
      setStatus("Add an API key for deep scan");
      return;
    }
    setBusy(true);
    try {
      const result = await VectorLLM.deepScan(report.prompt, settings);
      setReport(VectorAnalyzer.mergeFindings(report, result.findings));
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

  function Card(props) {
    const on = !!accepted[props.id];
    return (
      <View style={[styles.card, on && styles.cardOn]}>
        <Text style={styles.cardTitle}>{props.title}</Text>
        {props.desc ? <Text style={styles.cardDesc}>{props.desc}</Text> : null}
        {props.clause ? <Text style={styles.clause}>{props.clause}</Text> : null}
        <Pressable style={[styles.smallBtn, on && styles.smallBtnOn]} onPress={() => toggle(props.id)}>
          <Text style={[styles.smallBtnText, on && styles.smallBtnTextOn]}>
            {on ? "Added ✓" : "+ Add clause"}
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
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

      <ScrollView contentContainerStyle={styles.body}>
        {showSettings ? (
          <View style={styles.settings}>
            <Text style={styles.label}>Deep scan API key (optional)</Text>
            <TextInput
              style={styles.input}
              value={settings.apiKey}
              onChangeText={(t) => setSettings(Object.assign({}, settings, { apiKey: t }))}
              placeholder="AIza..."
              autoCapitalize="none"
              secureTextEntry
            />
            <Text style={styles.label}>Base URL</Text>
            <TextInput
              style={styles.input}
              value={settings.baseUrl}
              onChangeText={(t) => setSettings(Object.assign({}, settings, { baseUrl: t }))}
              autoCapitalize="none"
            />
            <Text style={styles.label}>Model</Text>
            <TextInput
              style={styles.input}
              value={settings.model}
              onChangeText={(t) => setSettings(Object.assign({}, settings, { model: t }))}
              autoCapitalize="none"
            />
          </View>
        ) : null}

        <Text style={styles.label}>AWS infrastructure prompt</Text>
        <TextInput
          style={styles.textarea}
          value={prompt}
          onChangeText={setPrompt}
          placeholder="e.g. Create an S3 bucket and an EC2 instance running a web server."
          multiline
        />

        <View style={styles.row}>
          <Pressable style={styles.ghostBtn} onPress={() => { setPrompt(SAMPLE); analyze(SAMPLE); }}>
            <Text style={styles.ghostText}>Sample</Text>
          </Pressable>
          <View style={{ flexDirection: "row" }}>
            <Pressable style={styles.ghostBtn} onPress={deepScan} disabled={busy}>
              <Text style={styles.ghostText}>{busy ? "..." : "Deep scan"}</Text>
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
                  This looks like a non-AWS cloud prompt. Vector is AWS-specific.
                </Text>
              </View>
            ) : null}

            <View style={styles.riskRow}>
              <Text style={styles.riskScore}>{report.riskScore}</Text>
              <Text style={styles.riskLabel}>{report.riskLevel} RISK</Text>
              <Text style={styles.riskMeta}>
                coverage {report.coverageScore}% · {report.tierCounts.core} confirmed ·{" "}
                {report.tierCounts.clarify} clarify · {report.tierCounts.harden} optional
              </Text>
            </View>

            {report.riskyFindings.length ? (
              <View>
                <Text style={styles.h2}>Risky statements</Text>
                {report.riskyFindings.map((f) => (
                  <Card key={f.id} id={f.id} title={f.label} desc={f.description} clause={"Fix: " + f.fix} />
                ))}
              </View>
            ) : null}

            <View style={styles.rowBetween}>
              <Text style={styles.h2}>Missing constraints ({report.missing.length})</Text>
              <Pressable onPress={acceptAll}><Text style={styles.link}>Accept all</Text></Pressable>
            </View>

            {["core", "clarify", "harden"].map((tier) => {
              const items = report.missing.filter((m) => (m.tier || "clarify") === tier);
              if (!items.length) return null;
              return (
                <View key={tier}>
                  <Text style={styles.group}>{TIER_LABELS[tier]} ({items.length})</Text>
                  {items.map((m) => (
                    <Card
                      key={m.id}
                      id={m.id}
                      title={m.label + "  ·  " + m.severity + (m.source === "ai" ? "  ·  AI" : "")}
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
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#ffffff" },
  header: { flexDirection: "row", alignItems: "center", padding: 14, borderBottomWidth: 1, borderBottomColor: "#e5e7eb" },
  logo: { width: 34, height: 34, borderRadius: 9, backgroundColor: "#6366f1", alignItems: "center", justifyContent: "center", marginRight: 10 },
  logoText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  h1: { fontSize: 16, fontWeight: "700" },
  sub: { fontSize: 11, color: "#6b7280" },
  iconBtn: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8, width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  iconText: { fontSize: 18 },
  body: { padding: 16, paddingBottom: 40 },
  settings: { borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 10, padding: 12, marginBottom: 16, backgroundColor: "#f9fafb" },
  label: { fontSize: 13, fontWeight: "600", marginBottom: 6 },
  input: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8, padding: 10, marginBottom: 10, fontSize: 14 },
  textarea: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 10, padding: 12, minHeight: 120, fontSize: 14, textAlignVertical: "top" },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 10 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 18 },
  ghostBtn: { paddingVertical: 8, paddingHorizontal: 12, marginRight: 8 },
  ghostText: { color: "#374151", fontWeight: "600" },
  primaryBtn: { backgroundColor: "#6366f1", borderRadius: 8, paddingVertical: 10, paddingHorizontal: 16 },
  primaryText: { color: "#fff", fontWeight: "700" },
  status: { marginTop: 10, color: "#6b7280", fontSize: 12 },
  results: { marginTop: 16 },
  warn: { backgroundColor: "#fef3c7", borderWidth: 1, borderColor: "#d97706", borderRadius: 8, padding: 10, marginBottom: 12 },
  warnText: { color: "#92400e", fontSize: 12 },
  riskRow: { borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 10, padding: 12, backgroundColor: "#f9fafb" },
  riskScore: { fontSize: 26, fontWeight: "800" },
  riskLabel: { fontSize: 12, fontWeight: "700", color: "#dc2626" },
  riskMeta: { fontSize: 11, color: "#6b7280", marginTop: 4 },
  h2: { fontSize: 14, fontWeight: "700", marginTop: 16 },
  group: { fontSize: 13, fontWeight: "700", marginTop: 14, marginBottom: 6 },
  card: { borderWidth: 1, borderColor: "#e5e7eb", borderLeftWidth: 4, borderLeftColor: "#dc2626", borderRadius: 8, padding: 10, marginBottom: 8, backgroundColor: "#fff" },
  cardOn: { borderLeftColor: "#16a34a" },
  cardTitle: { fontWeight: "700", fontSize: 13 },
  cardDesc: { fontSize: 12, color: "#374151", marginTop: 4 },
  clause: { fontFamily: "monospace", fontSize: 11, backgroundColor: "#f3f4f6", padding: 8, borderRadius: 6, marginTop: 6 },
  smallBtn: { alignSelf: "flex-start", borderWidth: 1, borderColor: "#6366f1", borderRadius: 6, paddingVertical: 6, paddingHorizontal: 10, marginTop: 8 },
  smallBtnOn: { borderColor: "#16a34a", backgroundColor: "#ecfdf5" },
  smallBtnText: { color: "#6366f1", fontWeight: "600", fontSize: 12 },
  smallBtnTextOn: { color: "#16a34a" },
  improved: { fontFamily: "monospace", fontSize: 12, backgroundColor: "#f3f4f6", padding: 10, borderRadius: 8, marginTop: 6 },
  link: { color: "#6366f1", fontWeight: "600", fontSize: 13 },
  disclaimer: { marginTop: 16, fontSize: 11, fontStyle: "italic", color: "#6b7280" },
});
