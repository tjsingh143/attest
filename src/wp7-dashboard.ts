/**
 * Attest — WP7 (b): the dashboard (D3.61).
 *
 * A small local web view: one self-contained HTML file (dashboard/index.html) with
 * the evidence summary embedded as JSON, so it opens from disk with no server, no
 * network and no build step. It answers "what is our control posture right now"
 * at the top (the verdict bar and the KPI row), then shows effectiveness by
 * family and by tier, coverage, the ranked findings, drift, the framework study,
 * and an evidence drill-down: click a control, see its tests — the statement
 * issued, the identity used, what was expected and happened, and when.
 *
 * Generated, never edited: `attest reports` rewrites it from the evidence store,
 * and `validate-reports` re-derives the numbers embedded in it.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ATTEST_ROOT } from "./config.ts";
import { FAMILIES, familyCode, VERDICTS, type Evidence, type Facts } from "./evidence-facts.ts";
import { indexEvidence } from "./wp7-report.ts";

type Rec = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export const DASHBOARD_PATH = join(ATTEST_ROOT, "dashboard", "index.html");

const clip = (s: unknown, n: number) => { const t = String(s ?? ""); return t.length > n ? `${t.slice(0, n - 1)}…` : t; };

function controlLabel(c: Rec): string {
  const d = (c.detail ?? {}) as Rec;
  switch (c.controlKind) {
    case "policy": return `${d.command} policy for ${(d.roles as string[]).join(", ")}${d.using_expr ? ` · USING ${clip(d.using_expr, 120)}` : ""}${d.with_check_expr ? ` · WITH CHECK ${clip(d.with_check_expr, 120)}` : ""}`;
    case "table_grant": return `${d.grantee}: ${(d.privileges as string[]).join(", ")}`;
    case "column_grant": return `${String(d.grantee_and_column).replace(":", " on ")}: ${(d.privileges as string[]).join(", ")}`;
    case "rls_enabled": return d.rls_enabled ? "row-level security enabled" : "row-level security disabled";
    case "rls_forced": return d.rls_forced ? "forced" : `not forced (owner ${d.owner})`;
    case "trigger": return `${d.timing} ${(d.events as string[]).join("/")} → ${d.function}${d.can_refuse ? " (can refuse)" : ""}`;
    case "security_definer_function": return `SECURITY DEFINER, owner ${d.owner}, executable by ${((d.executable_by ?? []) as string[]).join(", ") || "no client role"}`;
    case "function_execute_grant": return `EXECUTE to ${((d.executable_by ?? []) as string[]).join(", ")}${d.security_definer ? "" : " (SECURITY INVOKER)"}`;
    default: return clip(JSON.stringify(d), 120);
  }
}

/** Everything the page shows, computed from the evidence. Also what validate-reports re-derives. */
export function dashboardData(ev: Evidence, f: Facts): Rec {
  const idx = indexEvidence(ev);
  const inv = ev.inventory as Rec;
  const controls = inv.controls as Rec[];
  const namedIds = (c: Rec) => (idx.namedBy.get(String(c.controlId)) ?? []).map((r) => String(r.testId));
  const tableRes = (inv.resources as Rec[]).map((r) => String(r.resource)).sort();
  const resources = tableRes.map((name) => {
    const cs = controls.filter((c) => c.resource === name);
    const onIt = idx.recordsOn.get(name) ?? [];
    const namedSet = new Set(cs.flatMap(namedIds));
    return {
      name, tier: f.wp2.resourceTier.get(name) ?? "untiered",
      controls: cs.map((c) => ({ id: String(c.controlId), kind: String(c.controlKind), detail: controlLabel(c), tests: namedIds(c) })),
      resourceTests: onIt.map((r) => String(r.testId)).filter((t) => !namedSet.has(t)),
    };
  });
  const fnControls = controls.filter((c) => !tableRes.includes(String(c.resource)));
  const fnNames = [...new Set(fnControls.map((c) => String(c.resource)))].sort();
  const functions = fnNames.map((name) => {
    const cs = fnControls.filter((c) => c.resource === name);
    return { name, controls: cs.map((c) => controlLabel(c)), tests: [...new Set(cs.flatMap(namedIds))] };
  });
  const records: Record<string, Rec> = {};
  for (const r of ev.records) {
    records[String(r.testId)] = {
      f: familyCode(r), r: String(r.resource), c: String(r.controlId), t: String(r.tier), p: String(r.polarity), v: String(r.verdict), o: String(r.observation),
      i: String(r.identity?.label ?? r.identityPlanned),
      s: String(r.executed?.statement ?? r.operationPlanned ?? ""),
      a: Array.isArray(r.executed?.params) && r.executed.params.length ? clip(JSON.stringify(r.executed.params), 240) : "",
      e: String(r.expectedPlanned ?? ""), x: String(r.actualSummary ?? ""), ts: String(r.timestampUtc),
      n: r.authorIntent ? String(r.authorIntent) : "", vr: clip(r.verdictReason, 400),
    };
  }
  const transitions = (ev.drift.diffs as Rec[])
    .filter((d) => d.from === f.wp4.states[0]?.name && d.to === "C-current")
    .flatMap((d) => ((d.results?.transitions ?? []) as Rec[]).filter((t) => t.kind === "fail → pass").map((t) => `${t.testId} (${t.from?.summary} → ${t.to?.summary})`));
  const mapping = (ev.framework?.mappings ?? []) as Rec[];
  const openItems = f.wp5.items.filter((i) => i.status === "open");
  return {
    meta: {
      wp3: f.runs.wp3, plan: f.runs.plan, wp4: f.runs.wp4, cp3: f.runs.frozenCp3, asOf: f.wp3.lastTimestamp.slice(0, 10),
      schema: f.wp3.schemaVersion.slice(0, 12), harness: f.wp3.harnessSha256.slice(0, 12),
      arc21Fingerprint: f.wp3.arc21Fingerprint.slice(0, 16), arc21Unchanged: f.wp3.arc21Unchanged,
      cp4: f.wp5.cp4Approved ? `approved ${f.wp5.cp4Date}` : "not approved",
      validation: `${f.wp3.validationChecksPassed} of ${f.wp3.validationChecks}`,
      openFindings: openItems.map((i) => i.id),
    },
    verdicts: [...VERDICTS],
    totals: f.wp3.byVerdict,
    byFamily: FAMILIES.map((fam) => ({ code: fam.code, name: fam.name, counts: f.wp3.byFamily[fam.code] })),
    byTier: Object.entries(f.wp3.byTier).map(([tier, counts]) => ({ tier, counts })),
    coverage: {
      resources: f.wp0.resources, withControl: f.wp0.resources - f.wp0.resourcesWithoutControl.length, without: f.wp0.resourcesWithoutControl,
      controls: f.wp0.controls, named: f.coverage.controlsNamed, resourceOnly: f.coverage.controlsResourceOnly, unexercised: f.coverage.controlsUnexercised,
      observations: f.wp0.observations,
    },
    findings: f.wp5.items.map((i) => ({ id: i.id, key: i.key, title: i.title, tier: i.tier, evidence: i.evidenceClass, tests: i.testIds, status: i.status, part: i.part })),
    scope: f.wp5.scope,
    drift: { states: f.wp4.states, diffs: f.wp4.diffs, newUnprotected: f.wp4.newUnprotected, passToFail: f.wp4.diffs.reduce((m, d) => m + (d.passToFail ?? 0), 0), transitions },
    framework: mapping.map((e) => ({
      id: `${e.framework === "21 CFR Part 11" ? "21 CFR " : ""}${e.id}`, title: String(e.title).replace(/^§ ?[\d.]+ /, "").replace(/\.$/, ""),
      support: String(e.support).replace("_", " "), subject: e.subject,
      evidence: (e.evidence.testIds as string[]).length ? `${e.evidence.counts.total} records, ${e.evidence.counts.effective} effective` : ((e.evidence.artifacts as Rec[]).map((a) => a.artifact).join(", ") || "none"),
    })),
    resources, functions,
    suite: ev.records.filter((r) => String(r.tier) === "suite").map((r) => String(r.testId)),
    records,
  };
}

export async function renderDashboard(ev: Evidence, f: Facts): Promise<string> {
  const css = await readFile(join(ATTEST_ROOT, "src", "dashboard", "app.css"), "utf8");
  const js = await readFile(join(ATTEST_ROOT, "src", "dashboard", "app.js"), "utf8");
  const data = JSON.stringify(dashboardData(ev, f)).replace(/</g, "\\u003c");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="Arc21 access-control posture from Attest's evidence: verdicts, coverage, findings, drift and an evidence drill-down.">
<title>Arc21 control posture</title>
<style>
${css}</style>
</head>
<body>
<div class="wrap">
<header class="top">
  <div>
    <h1>Arc21 control posture</h1>
    <p class="sub" id="asof"></p>
    <div class="banner">
      <span class="chip">Arc21 is read-only: nothing remediated, fixed or closed</span>
      <span class="chip">Not an independent audit — the author tested their own system</span>
      <span class="chip">Framework mapping is a study exercise</span>
      <span class="chip">Generated from evidence by <code>npm run attest reports</code></span>
    </div>
  </div>
  <div class="theme" role="group" aria-label="Colour theme">
    <button type="button" data-t="system" aria-pressed="true">System</button>
    <button type="button" data-t="light" aria-pressed="false">Light</button>
    <button type="button" data-t="dark" aria-pressed="false">Dark</button>
  </div>
</header>
<main>
  <div id="hero"></div>
  <div id="effectiveness"></div>
  <div id="coverage"></div>
  <div id="findings"></div>
  <div id="drift"></div>
  <div id="framework"></div>
  <section class="card" id="drill">
    <h2>Evidence drill-down</h2>
    <p class="sub">Every control in the inventory, grouped by resource. Select one to see each test that names it: the statement issued, the identity it ran as, the expectation, the outcome and the timestamp.</p>
    <div class="filters" role="search">
      <input id="q" type="search" placeholder="Search resources, controls, Test IDs" aria-label="Search">
      <select id="f-tier" aria-label="Tier">
        <option value="all">All tiers</option><option value="High">High</option><option value="Medium">Medium</option><option value="functions">Functions</option><option value="suite">Suite-level</option>
      </select>
      <select id="f-verdict" aria-label="Verdict">
        <option value="all">Any verdict</option><option value="effective">effective</option><option value="deficient">deficient</option><option value="gap">gap</option><option value="characterized">characterized</option><option value="not_measured">not measured</option>
      </select>
    </div>
    <div class="drill"><div class="list" id="list"></div><div class="detail" id="detail" aria-live="polite"></div></div>
  </section>
</main>
<footer>Attest — access control assurance harness. Every number on this page is computed from the official evidence; see ASSURANCE_REPORT.md for the full report and README.md to reproduce it.</footer>
</div>
<div id="tip" role="tooltip"></div>
<script type="application/json" id="attest-data">${data}</script>
<script>
${js}</script>
</body>
</html>
`;
}
