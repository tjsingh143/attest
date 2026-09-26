/**
 * Attest — WP7 (a): the control assurance report (D3.61).
 *
 * Generated from the evidence store, never edited: one section per risk tier listing
 * every control, its rating, the assurance activity applied, the tests that name it
 * and their outcome; then the ranked findings, remediation guidance, verification,
 * drift, the framework-mapping study, limitations and how to reproduce every number.
 *
 * Every number comes from evidence-facts.ts or straight from the records. The
 * connecting prose is AI-drafted (Amendment A2) and labelled so; the author's words
 * appear only where FINDINGS.md already carries them, with their provenance.
 */
import { join } from "node:path";
import { ATTEST_ROOT } from "./config.ts";
import { controlsNamedBy, countVerdicts, familyCode, FAMILIES, TIER_ACTIVITY, type Evidence, type Facts, type VerdictCounts } from "./evidence-facts.ts";
import { WP5_ITEMS } from "./wp5-guidance.ts";
import { SUPPORT_TEXT } from "./wp6-mapping.ts";
import { COMMANDS } from "./commands.ts";

type Rec = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export const REPORT_PATH = join(ATTEST_ROOT, "ASSURANCE_REPORT.md");

const vc = (c: VerdictCounts) => [c.effective && `${c.effective} effective`, c.deficient && `${c.deficient} deficient`, c.gap && `${c.gap} gap`, c.characterized && `${c.characterized} characterized`, c.not_measured && `${c.not_measured} not measured`].filter(Boolean).join(", ") || "none";
const cell = (s: string) => s.replace(/\|/g, "\\|").replace(/\n/g, " ");
const tick = (s: string) => `\`${s}\``;
const minutes = (s: number) => `${Math.round(s / 60)} minutes`;

/** The latest recorded prove-gates result, as its rows count it — never a typed number. */
export function proveGatesLine(f: Facts): string {
  const g = f.proveGates;
  if (!g) return "prove-gates has no recorded result";
  return `${g.caught} of ${g.injected} injected defects caught and ${g.held} of ${g.controls} controls held, real state ${g.restored ? "restored" : "NOT restored"} (harness \`${g.harnessSha256.slice(0, 12)}\`)`;
}

/** The brief's WP0 "no control" patterns, as the frozen inventory classified each resource. */
export function rcList(f: Facts): string {
  const rc = f.wp0.rowControl;
  const names = (xs: readonly string[]) => (xs.length ? xs.map(tick).join(", ") : "none");
  return [
    `row-level security **off**: ${names(rc.rlsDisabled)}.`,
    `Row-level security on with **no policy** — every client is denied, and no client role holds a grant: ${names(rc.noPolicyDenyAll)}.`,
    `**Readable without an account**: ${names(rc.anonReachable)} — the catalogue tables, accepted as design intent at CP4 (B3).`,
    `**Granted to the anonymous role with no policy admitting it** (a latent grant): ${names(rc.anonLatent)} — informational (B4).`,
    `By WP4's definition of a row-level control (row-level security on, or a view that runs as its invoker), ${rc.withRowControl} of ${f.wp0.resources} resources have one${rc.without.length ? `; without: ${names(rc.without)}` : ""}.`,
  ].join(" ");
}

/** "AC-3 Access Enforcement"; a Part 11 paragraph by its own words: "21 CFR §11.10(d) Limiting system access to authorized individuals". */
export function frameworkLabel(e: Rec): string {
  if (e.framework !== "21 CFR Part 11") return `${e.id} ${cell(String(e.title).replace(/\.$/, ""))}`;
  const para = /^\([a-z]\)\s+(.*)$/.exec(String((e.statement as string[])[0] ?? ""));
  const words = para ? para[1]!.split(/;|\.(?:\s|$)/)[0]!.trim() : String(e.title).replace(/^§ ?[\d.]+ /, "").replace(/\.$/, "");
  return `21 CFR ${e.id} ${cell(words.length > 70 ? `${words.slice(0, 70).replace(/[\s,]+\S*$/, "")}…` : words)}`;
}

/** The one-line meaning of each verdict — the project's exact terms. */
export const VERDICT_MEANING: Readonly<Record<string, string>> = {
  effective: "the control was exercised and held exactly as the approved expectation predicted",
  deficient: "the control was exercised and did not hold — an approved expectation was violated",
  gap: "a control the plan asked about does not exist (the audit-trail family)",
  characterized: "a recorded fact about the configuration, not a pass or a fail",
  not_measured: "the approved probe could not measure its property on this schema (a registered contradiction the author kept unmeasured); never counted as effective",
};

function controlDetail(c: Rec): string {
  const d = (c.detail ?? {}) as Rec;
  switch (c.controlKind) {
    case "policy": return `${d.command} ${d.permissive === "PERMISSIVE" ? "permissive" : "restrictive"} policy for ${(d.roles as string[]).join(", ")}${d.using_expr ? `; USING ${tick(String(d.using_expr).slice(0, 90))}` : ""}${d.with_check_expr ? `; WITH CHECK ${tick(String(d.with_check_expr).slice(0, 90))}` : ""}`;
    case "table_grant": return `${d.grantee}: ${(d.privileges as string[]).join(", ")}`;
    case "column_grant": return `${String(d.grantee_and_column).replace(":", " on ")}: ${(d.privileges as string[]).join(", ")}`;
    case "rls_enabled": return d.rls_enabled ? "row-level security enabled" : "row-level security DISABLED";
    case "rls_forced": return d.rls_forced ? "row-level security forced" : `not forced (owner ${d.owner})`;
    case "trigger": return `${d.timing} ${(d.events as string[]).join("/")} ${String(d.level).toLowerCase()} → ${d.function}${d.can_refuse ? " (can refuse a write)" : ""}`;
    case "security_definer_function": return `SECURITY DEFINER, owner ${d.owner}; executable by ${((d.executable_by ?? []) as string[]).join(", ") || "no client role"}`;
    case "function_execute_grant": return `EXECUTE granted to ${((d.executable_by ?? []) as string[]).join(", ")}${d.security_definer ? "" : " (SECURITY INVOKER: runs with the caller's own privileges)"}`;
    default: return JSON.stringify(d).slice(0, 100);
  }
}

export interface ReportIndex {
  readonly namedBy: ReadonlyMap<string, readonly Rec[]>;
  readonly recordsOn: ReadonlyMap<string, readonly Rec[]>;
}

export function indexEvidence(ev: Evidence): ReportIndex {
  const controls = (ev.inventory as Rec).controls as Rec[];
  const ids = new Set(controls.map((c) => String(c.controlId)));
  const byRes = new Map<string, string[]>();
  for (const c of controls) byRes.set(String(c.resource), [...(byRes.get(String(c.resource)) ?? []), String(c.controlId)]);
  const namedBy = new Map<string, Rec[]>();
  for (const r of ev.records) for (const c of controlsNamedBy(r, ids, byRes)) namedBy.set(c, [...(namedBy.get(c) ?? []), r]);
  const recordsOn = new Map<string, Rec[]>();
  for (const r of ev.records) recordsOn.set(String(r.resource), [...(recordsOn.get(String(r.resource)) ?? []), r]);
  return { namedBy, recordsOn };
}

const testList = (rs: readonly Rec[], max = 6) => {
  const s = rs.slice(0, max).map((r) => `${tick(r.testId)} ${r.verdict}`).join("; ");
  return rs.length > max ? `${s}; … ${rs.length - max} more` : s;
};

function findingsTouching(resource: string, ev: Evidence): string[] {
  const out: string[] = [];
  for (const item of ev.findings.items as Rec[]) {
    const spec = WP5_ITEMS.find((s) => s.key === item.key);
    const onIt = (item.testIds as string[]).some((t) => ev.records.find((r) => r.testId === t)?.resource === resource);
    if (onIt || spec?.resourcesAtRisk.includes(resource)) out.push(`${item.id} (${item.part === "limitation" ? "not measured" : String(item.author?.status ?? "pending").replace(/_/g, " ")})`);
  }
  return out;
}

function resourceSection(res: Rec, ev: Evidence, idx: ReportIndex): string[] {
  const L: string[] = [];
  const p = (s = "") => L.push(s);
  const name = String(res.resource);
  const s = (ev.tiers.scored as Rec[]).find((x) => x.resource === name)!;
  const rt = s.rating as Rec;
  const recs = idx.recordsOn.get(name) ?? [];
  const byPol = recs.reduce<Record<string, number>>((m, r) => ({ ...m, [r.polarity]: (m[r.polarity] ?? 0) + 1 }), {});
  p(`#### ${tick(name)} — ${s.tier}`);
  p();
  p(`- **Rating (frozen, CP3):** data ${rt.data?.level}/${rt.data?.evidence}, blast radius ${rt.blast?.level}/${rt.blast?.evidence}, integrity ${rt.integrity?.level}/${rt.integrity?.evidence}, reversibility ${rt.reversibility?.level}/${rt.reversibility?.evidence}; impact ${s.impact} (${s.impactRule}); exposure read ${rt.exposure?.readExposure}, write ${rt.exposure?.writeExposure} → tier **${s.tier}**.`);
  p(`- **Assurance activity:** ${TIER_ACTIVITY[String(s.tier)]}. Applied: ${recs.length} Test IDs on this resource (${Object.entries(byPol).map(([k, n]) => `${n} ${k}`).join(", ")}) — ${vc(countVerdicts(recs))}.`);
  const fams = FAMILIES.map((f) => ({ f, rs: recs.filter((r) => familyCode(r) === f.code) })).filter((x) => x.rs.length);
  p(`- **Tests by family:** ${fams.map((x) => `${x.f.code} ${x.rs.length} (${vc(countVerdicts(x.rs))})`).join("; ")}.`);
  const touching = findingsTouching(name, ev);
  if (touching.length) p(`- **WP5 items touching it:** ${touching.join(", ")} — see FINDINGS.md.`);
  p();
  const controls = ((ev.inventory as Rec).controls as Rec[]).filter((c) => c.resource === name);
  p("| Control | Kind | What it is | Test IDs that name it (outcome) |");
  p("|---|---|---|---|");
  for (const c of controls) {
    const named = idx.namedBy.get(String(c.controlId)) ?? [];
    p(`| ${tick(String(c.controlId).split("#")[1] ?? c.controlId)} | ${c.controlKind} | ${cell(controlDetail(c))} | ${named.length ? cell(testList(named)) : "— (exercised only through the resource's other tests)"} |`);
  }
  const resourceLevel = recs.filter((r) => !((ev.inventory as Rec).controls as Rec[]).some((c) => (idx.namedBy.get(String(c.controlId)) ?? []).includes(r)));
  if (resourceLevel.length) p(`| *(the resource as a whole)* | anonymous reach, audit trail, boundary, integrity | tests of the resource rather than of one control | ${cell(testList(resourceLevel, 8))} |`);
  p();
  return L;
}

export function renderReport(ev: Evidence, f: Facts): string {
  const L: string[] = [];
  const p = (s = "") => L.push(s);
  const idx = indexEvidence(ev);
  const inv = ev.inventory as Rec;
  const resources = (inv.resources as Rec[]).map((r) => r);
  const tierOf = (r: Rec) => f.wp2.resourceTier.get(String(r.resource)) ?? "untiered";
  const bv = f.wp3.byVerdict;
  const items = f.wp5.items;
  const open = items.filter((i) => i.status === "open");

  p("# Control assurance report — Arc21 data-layer access controls");
  p();
  p("> Generated by `npm run attest reports` from the evidence store; never edited by hand. Every number below is computed from");
  p("> the official runs the author selected at CP4 (`rubric/official-runs.json`); `npm run attest validate-reports` re-derives the");
  p("> headline numbers independently. Connecting prose is AI-drafted (Amendment A2); the author's decisions appear as recorded.");
  p(">");
  p("> **Arc21 is a read-only assessment target:** nothing here was remediated, fixed or closed, and no remediation was");
  p("> independently verified. **The assessment is not independent:** the author wrote Arc21, the harness and the expectations.");
  p("> Arc21 is a personal application, not a regulated system; the framework section is a study exercise.");
  p();
  p("## 1. The posture in one table");
  p();
  p("| | |");
  p("|---|---|");
  const rc = f.wp0.rowControl;
  p(`| Resources in scope (WP0) | ${f.wp0.resources}; **${rc.withRowControl} of ${f.wp0.resources} have a row-level control** (row-level security on every table; the one view runs as its invoker)${rc.without.length ? ` — without one: ${rc.without.join(", ")}` : ""} |`);
  p(`| The brief's "no control" patterns (WP0) | row-level security off: ${rc.rlsDisabled.length}; on with no policy (every client denied, no client grant): ${rc.noPolicyDenyAll.length}; readable without an account: ${rc.anonReachable.length} (item B3); an anonymous grant no policy admits: ${rc.anonLatent.length} (item B4) |`);
  p(`| Controls inventoried from the live catalogs | ${f.wp0.controls} (resource, control) pairs; ${f.wp0.policies} policies; row-level security enabled on ${f.wp0.rlsEnabled} of ${f.wp0.tables} tables, **forced on ${f.wp0.rlsForced}** |`);
  p(`| Risk tiers (WP2, frozen at CP3) | ${Object.entries(f.wp2.byTier).map(([t, n]) => `${n} ${t}`).join(", ")}; no resource rated Low |`);
  p(`| Tests executed (WP3) | ${f.wp3.total} Test IDs under role-scoped sessions — **${bv.effective} effective, ${bv.deficient} deficient, ${bv.gap} gap, ${bv.characterized} characterized, ${bv.not_measured} not measured** |`);
  p(`| Independent validation of the results | ${f.wp3.validationChecksPassed} of ${f.wp3.validationChecks} checks passed (\`validate-wp3\`) |`);
  p(`| Findings (WP5, after CP4) | ${items.filter((i) => i.part === "finding").length} findings (${open.length} open: ${open.map((i) => i.id).join(", ")}), ${items.filter((i) => i.part === "informational").length} informational items, ${items.filter((i) => i.part === "limitation").length} limitations — CP4 ${f.wp5.cp4Approved ? `approved by the author ${f.wp5.cp4Date}` : "not approved"}; nothing remediated |`);
  p(`| Drift (WP4) | ${f.wp4.states.length} schema states; ${f.wp4.diffs.reduce((m, d) => m + (d.passToFail ?? 0), 0)} pass → fail; ${f.wp4.diffs.find((d) => d.from === f.wp4.states[0]?.name && d.to === "C-current")?.failToPass ?? 0} fail → pass from the oldest state to today; the unprotected table added in an Attest-only scratch state was caught: ${f.wp4.newUnprotected.map((u) => tick(u.resource)).join(", ") || "none"} |`);
  p(`| Framework mapping (WP6, a study exercise) | ${f.wp6 ? `${f.wp6.entries} entries: ${f.wp6.evidenced} evidenced (tested paths only), ${f.wp6.partial} partial, ${f.wp6.notMapped} not mapped; \`validate-wp6\` ${f.wp6.validationChecksPassed} of ${f.wp6.validationChecks}; CP5 superseded by Amendment A2 (not approved)` : "not generated"} |`);
  p(`| Harness self-checks | WP1: ${f.wp1.detected} of ${f.wp1.scenarios} deliberately broken controls detected by the role-scoped probe, while the same statements on over-privileged connections told intact from broken in ${f.wp1.overPrivilegedDiscriminated} of ${f.wp1.overPrivilegedChecks} checks; ${proveGatesLine(f)} |`);
  p(`| Arc21 modified by Attest | no — fingerprint ${tick(f.wp3.arc21Fingerprint.slice(0, 16) + "…")} identical before and after the official run |`);
  p();
  p("**What the verdicts mean** (the project's exact terms):");
  p();
  for (const [k, m] of Object.entries(VERDICT_MEANING)) p(`- \`${k}\` — ${m}.`);
  p();

  p("## 2. How the assessment was done *(AI-drafted summary of the method; details in DECISIONS.md)*");
  p();
  p(`1. **Inventory (WP0).** A disposable local copy of Arc21 is rebuilt from its ${f.wp3.migrationCount} migrations (schema version ${tick(f.wp3.schemaVersion.slice(0, 12))}, a content hash of the migration set), and every access control is read from PostgreSQL's own catalogs: row-level security enabled and forced, policies with their USING and WITH CHECK expressions, table and column grants, roles, SECURITY DEFINER functions, triggers, anonymous reach.`);
  p(`2. **Harness validation (WP1).** Before any result counts, ${f.wp1.scenarios} controls across different mechanisms are broken on purpose; the role-scoped probe must notice each break, and the same statement run on over-privileged connections is shown unable to tell intact from broken — so the role scoping is load-bearing.`);
  p("3. **Risk rating (WP2).** The author's rubric (RUBRIC.md) rates every resource on data criticality, blast radius, integrity impact, reversibility and exposure, and maps the tier to an assurance activity. The tiers were frozen at CP3, before any test ran.");
  p(`4. **Testing (WP3).** A matrix of ${f.wp3.total} Test IDs (${f.wp3.byPolarity.positive ?? 0} positive, ${f.wp3.byPolarity.negative ?? 0} negative, ${f.wp3.byPolarity.characterization ?? 0} characterization) was generated from the frozen tiers and approved. Each negative test names the attack it simulates. Tests run under genuine role-scoped sessions carrying a user's identity (never a superuser or a role that bypasses row-level security, read back from the database each time); after any probe that changed state the database is rebuilt and re-verified (${f.wp3.rebuilds} rebuilds in the official run). Each record carries the statement, the identity, the expectation, the outcome, a timestamp and the schema version.`);
  p(`5. **Independent validation.** \`validate-wp3\` re-derives every verdict and total from the raw records with its own code (${f.wp3.validationChecksPassed} of ${f.wp3.validationChecks} checks passed). Every gate in the harness — preflight, the evaluators, the isolation guards, the validators, the report checks — is proven by breaking it on purpose (\`prove-gates\`: ${proveGatesLine(f)}).`);
  p(`6. **Drift (WP4).** The same approved questions are asked of Arc21's earlier schemas, rebuilt from its own git history without touching the checkout, and every difference is classified.`);
  p("7. **Findings (WP5)** are ranked mechanically from the frozen tiers and the evidence; the author set each status at CP4. **Framework mapping (WP6)** is a study exercise.");
  p();

  p("## 3. Control inventory (WP0)");
  p();
  p(`Read from the live catalogs of the frozen CP1/CP3 build (run ${tick(f.runs.frozenCp3)}), and re-read identically by WP4 (${f.wp4.currentVsFrozenDifferences} differences).`);
  p();
  p("| Control kind | Count | Named by at least one Test ID |");
  p("|---|---:|---:|");
  for (const [k, v] of Object.entries(f.coverage.byKind)) p(`| ${k} | ${v.total} | ${v.named} |`);
  p(`| **total** | **${f.wp0.controls}** | **${f.coverage.controlsNamed}** |`);
  p();
  p(`**Test coverage of the inventory.** ${f.coverage.controlsNamed} of the ${f.wp0.controls} controls are named by at least one Test ID (its control id, a mechanism it asserts, or a function its statement calls). ${f.coverage.controlsResourceOnly} are named by none but sit on a resource that other tests exercise — row-level security being enabled, for example, is what every read-isolation test on that table relies on, though no test names the flag alone. ${f.coverage.controlsUnexercised} are on functions no test calls: ${f.coverage.unexercisedDefinerServerOnly} SECURITY DEFINER functions that no client role can execute, and ${f.coverage.unexercisedInvokerGrant} execute grants on SECURITY INVOKER helpers, which run with the caller's own privileges${f.coverage.unexercisedOther.length ? `; and ${f.coverage.unexercisedOther.length} other: ${f.coverage.unexercisedOther.join(", ")}` : ""}.`);
  p();
  p(`**Resources without a control** (the brief's WP0 list, read from the frozen inventory): ${rcList(f)}`);
  p();
  p(`**Structural observations:** ${Object.entries(f.wp0.observations).map(([k, n]) => `${n} × ${tick(k)}`).join(", ")}. ${f.wp0.roles} roles exist; ${f.wp0.rolesBypassRls.length} hold BYPASSRLS (${f.wp0.rolesBypassRls.join(", ")}). The anonymous role reaches ${f.wp0.anonReach} objects instance-wide, ${f.wp0.anonReachApplication} of them in the application schemas.`);
  p();

  p("## 4. Risk rating and test depth (WP2)");
  p();
  p("| Tier | Resources | Assurance activity (RUBRIC.md Part 5, the author's) |");
  p("|---|---:|---|");
  for (const t of ["High", "Medium", "Low"]) p(`| ${t} | ${f.wp2.byTier[t] ?? 0} | ${TIER_ACTIVITY[t]} |`);
  p();
  const sens = (ev.tiers.sensitivity as Rec[]).filter((x) => x.changed);
  p(`**Sensitivity (RUBRIC Part 6).** Under the alternative exposure rule — a latent anonymous grant counts as anonymous exposure — ${sens.length} resources would move up (${sens.map((x) => `${tick(x.resource)} ${x.primaryTier} → ${x.alternativeTier}`).join(", ")}), raising CP3's test-count estimate from ${ev.tiers.totalTestsPrimary} to ${ev.tiers.totalTestsAlternative}. The assessment used the primary rule; no tier was changed after results.`);
  p();

  p("## 5. Results (WP3)");
  p();
  p(`Official run ${tick(f.runs.wp3)}: ${f.wp3.total} records from ${f.wp3.firstTimestamp} to ${f.wp3.lastTimestamp} (${minutes(f.wp3.elapsedSeconds)}, ${f.wp3.rebuilds} rebuilds), harness ${tick(f.wp3.harnessSha256.slice(0, 12))} (${f.wp3.harnessFiles} files), ${f.wp3.identities} distinct identities.`);
  p();
  p("| Family | Records | effective | deficient | gap | characterized | not measured |");
  p("|---|---:|---:|---:|---:|---:|---:|");
  for (const fam of FAMILIES) { const c = f.wp3.byFamily[fam.code]!; p(`| ${fam.code} ${fam.name} | ${c.total} | ${c.effective} | ${c.deficient} | ${c.gap} | ${c.characterized} | ${c.not_measured} |`); }
  p(`| **Total** | **${bv.total}** | **${bv.effective}** | **${bv.deficient}** | **${bv.gap}** | **${bv.characterized}** | **${bv.not_measured}** |`);
  p();
  p("| Test depth (the row's tier) | Records | effective | deficient | gap | characterized | not measured |");
  p("|---|---:|---:|---:|---:|---:|---:|");
  for (const [t, c] of Object.entries(f.wp3.byTier)) p(`| ${t === "suite" ? "suite-level (no single resource)" : t} | ${c.total} | ${c.effective} | ${c.deficient} | ${c.gap} | ${c.characterized} | ${c.not_measured} |`);
  p();
  p("Every SECURITY DEFINER function test runs at High depth by the planning rule, whatever the tier of the table it touches — a depth rule, not a rating.");
  p();
  p("Earlier WP3 and WP4 runs are kept, unedited, as engineering history and are **not** results:");
  p();
  for (const n of ev.official.notResults as Rec[]) p(`- ${tick(n.runId)} (${n.kind}, ${n.disposition}) — ${n.why}`);
  p();

  const tiersInOrder = ["High", "Medium", "Low"];
  let sectionNo = 6;
  for (const t of tiersInOrder) {
    const inTier = resources.filter((r) => tierOf(r) === t).sort((a, b) => String(a.resource).localeCompare(String(b.resource)));
    const recs = inTier.flatMap((r) => idx.recordsOn.get(String(r.resource)) ?? []);
    p(`## ${sectionNo++}. ${t} tier — ${inTier.length} resource${inTier.length === 1 ? "" : "s"}`);
    p();
    if (!inTier.length) {
      p(`No resource was rated ${t}: under the author's rubric every resource had at least one Medium or High consequence dimension (RUBRIC Part 3). The ${t}-tier activity (${TIER_ACTIVITY[t]}) was therefore not applied to any resource.`);
      p();
      continue;
    }
    p(`**Assurance activity:** ${TIER_ACTIVITY[t]}. **Tests on these resources:** ${recs.length} — ${vc(countVerdicts(recs))}.`);
    p();
    for (const r of inTier) L.push(...resourceSection(r, ev, idx));
  }

  // SECURITY DEFINER and invoker functions
  const fnControls = ((inv.controls as Rec[])).filter((c) => c.controlKind === "security_definer_function" || c.controlKind === "function_execute_grant");
  const fnNames = [...new Set(fnControls.map((c) => String(c.resource)))].sort();
  const fnRecs = ev.records.filter((r) => familyCode(r) === "F5");
  p(`## ${sectionNo++}. Functions — ${fnNames.length} with a SECURITY DEFINER or execute-grant control (${fnControls.length} controls)`);
  p();
  p(`Functions are not rated in WP2; the definer-function family (F5) tests every function a client role can execute at High depth. **F5:** ${fnRecs.length} Test IDs — ${vc(countVerdicts(fnRecs))}. Functions no client can execute are not tested (${f.coverage.controlsUnexercised} controls).`);
  p();
  p("| Function | Controls | Test IDs that name it (outcome) |");
  p("|---|---|---|");
  for (const fn of fnNames) {
    const cs = fnControls.filter((c) => c.resource === fn);
    const named = [...new Set(cs.flatMap((c) => idx.namedBy.get(String(c.controlId)) ?? []))];
    p(`| ${tick(fn.replace(/\(.*$/, "()"))} | ${cs.map((c) => cell(controlDetail(c))).join("; ")} | ${named.length ? cell(testList(named, 4)) : "— not called by any test"} |`);
  }
  p();
  const suite = ev.records.filter((r) => String(r.tier) === "suite");
  p(`## ${sectionNo++}. Suite-level tests — ${suite.length}`);
  p();
  p("Tests of a mechanism or boundary rather than of one Arc21 resource: the FORCE / BYPASSRLS mechanism on an Attest scratch table, the role attributes, and an expired session at the API boundary.");
  p();
  for (const r of suite) p(`- ${tick(r.testId)} — ${r.verdict}: ${cell(String(r.operationPlanned).slice(0, 150))}`);
  p();

  // Findings
  p(`## ${sectionNo++}. Ranked findings, remediation guidance and verification (WP5)`);
  p();
  p(`Full detail, evidence, remediation options with tradeoffs and exact verification procedures: FINDINGS.md. Ranking rule D3.57, accepted by the author at CP4 (J13). CP4 ${f.wp5.cp4Approved ? `approved by the author ${f.wp5.cp4Date}` : "not approved"}; the approval does not mean anything was remediated, fixed, closed or verified.`);
  p();
  p("| # | Item | Tier | Evidence | Test IDs | The author's status |");
  p("|---|---|---|---|---:|---|");
  for (const i of items) p(`| ${i.id} | ${cell(i.title)} | ${i.tier} | ${i.evidenceClass === "none" ? "WP0" : i.evidenceClass} | ${i.testIds.length} | ${i.status.replace(/_/g, " ")} |`);
  p();
  if (f.wp5.scope) p(`A2's scope under the author's J3/J4 rule: ${f.wp5.scope.trailRequired} of ${f.wp5.scope.total} resources require a trail and have none (open), ${f.wp5.scope.excluded} excluded as transient live state, ${f.wp5.scope.conditional} conditional on J4.`);
  p();
  p("**Verification of a future fix** is by command, never by editing results: `npm run attest verify-finding <item> --official=<run> --candidate=<new run>` confirms a fix only if the candidate run passed validation, every Test ID of the item reached the stated verdict, and nothing that was effective regressed. Nothing has been verified this way, because nothing was remediated.");
  p();
  for (const i of (ev.findings.items as Rec[]).filter((x) => x.part !== "limitation")) {
    p(`- **${i.id} ${cell(String(i.title))}** — ${String(i.author?.status ?? "pending").replace(/_/g, " ")}. Remediation options (AI-drafted, not implemented): ${(i.remediation as Rec[]).map((r, n) => `(${n + 1}) ${cell(String(r.option)).replace(/\.$/, "")}`).join("; ")}.`);
  }
  p();

  // Drift
  p(`## ${sectionNo++}. Drift across Arc21's own history (WP4)`);
  p();
  p(`WP4 run ${tick(f.runs.wp4)}. Historical results are today's approved questions asked of an earlier schema — not findings about Arc21 today.`);
  p();
  p("| State | Migrations | Exit |");
  p("|---|---:|---:|");
  for (const s of f.wp4.states) p(`| ${tick(s.name)} — ${cell(s.label)} | ${s.migrationCount} | ${s.exit} |`);
  p();
  p("| Compared | added | removed | definition changed | attributes changed | new, no control | newly exposed | pass → fail | fail → pass |");
  p("|---|---:|---:|---:|---:|---:|---:|---:|---:|");
  for (const d of f.wp4.diffs) p(`| ${d.from} → ${d.to} | ${d.added} | ${d.removed} | ${d.definitionChanged} | ${d.attributesChanged} | ${d.newUnprotected} | ${d.newlyExposed} | ${d.passToFail ?? "—"} | ${d.failToPass ?? "—"} |`);
  p();
  p(`The unprotected table added in the Attest-only scratch state (${f.wp4.newUnprotected.map((u) => `${tick(u.resource)}, ${u.clientReachable ? "reachable by a client role" : "not reachable by a client role — one GRANT from exposed"}`).join("; ")}) was reported on the run that added it, without anyone looking for it.`);
  p();

  // Framework
  const fm = ev.framework;
  p(`## ${sectionNo++}. Framework mapping — a study exercise (WP6)`);
  p();
  p("Not compliance, not validation, not certification, not an independent audit; Arc21 is not a regulated system. Rationale AI-drafted (Amendment A2). Full text: FRAMEWORK_MAPPING.md and CSA_NOTE.md.");
  p();
  if (fm) {
    p("| Identifier | Support | Evidence |");
    p("|---|---|---|");
    for (const e of fm.mappings as Rec[]) p(`| ${frameworkLabel(e)} | ${SUPPORT_TEXT[e.support as keyof typeof SUPPORT_TEXT] ?? e.support}${e.subject === "attest" ? " (Attest's activity, not Arc21's control)" : ""} | ${(e.evidence.testIds as string[]).length ? `${e.evidence.counts.total} records (${vc(e.evidence.counts)})` : (e.evidence.artifacts as Rec[]).map((a) => a.artifact).join(", ") || "none"} |`);
    p();
  }

  // Limitations
  p(`## ${sectionNo++}. Limitations`);
  p();
  for (const l of REPORT_LIMITATIONS(f)) p(`- ${l}`);
  p();

  // Reproduce
  p(`## ${sectionNo++}. Reproducing every number`);
  p();
  p("| Command | What it does | Database |");
  p("|---|---|---|");
  for (const c of COMMANDS.filter((x) => x.group === "reproduce" || x.group === "reports")) p(`| \`npm run attest ${c.usage ?? c.name}\` | ${cell(c.does)} | ${c.db === "none" ? "not used" : c.db}${c.network ? "; uses the network" : ""} |`);
  p();
  p("What is and is not re-executed: `reports` and `validate-reports` need no database — every number here is recomputed from the persisted evidence. `run` rebuilds the disposable database and re-derives everything that can be re-derived without re-running the 345 probes — the inventory, the harness validation, the tiers, the fixtures and the plan — and requires each to equal the frozen evidence. Re-executing the assessment itself is `run -- --confirm`, which records a reproduction run (never a new result) and compares it with the official run Test ID by Test ID.");
  p();
  p(`Evidence identifiers: WP3 ${tick(f.runs.wp3)} · plan ${tick(f.runs.plan)} · WP4 ${tick(f.runs.wp4)} · frozen CP1/CP3 ${tick(f.runs.frozenCp3)} · schema ${tick(f.wp3.schemaVersion.slice(0, 12))} · harness ${tick(f.wp3.harnessSha256.slice(0, 12))} · Arc21 commit ${tick(f.wp3.arc21Commit.slice(0, 12))} (checkout dirty with the author's own work; fingerprint ${tick(f.wp3.arc21Fingerprint.slice(0, 16) + "…")}).`);
  p();
  return L.join("\n") + "\n";
}

/** The limitations every WP7 output carries — AI-drafted, from the project record. */
export function REPORT_LIMITATIONS(f: Facts): string[] {
  return [
    "**Not independent.** The author wrote Arc21, the harness, the rubric and the expectations, and approved the findings. Nothing here is a third-party assessment. The one mitigating fact: the inventory is read from the system catalogs rather than from anyone's memory, so it would read the same for someone who never saw the code.",
    "**Not a regulated system, and no compliance claim.** Arc21 is a personal application used as a test subject — not a GxP or Part 11 system, and not compliant with anything. The framework mapping is a study exercise; nothing here is compliance, validation, certification or audit, and nothing implies the author has experience of any of those.",
    "**Not a product.** The harness is one person's tool for one system: it has not been validated or qualified as a testing tool, and nobody else uses it.",
    "**Nothing was remediated (Amendment A1).** Arc21 is a read-only assessment target. Findings end as recommendations with verification procedures; none is fixed, closed or independently verified.",
    `**Not measured is not a pass.** ${f.wp3.byVerdict.not_measured} tests could not measure their property on this schema and are reported as such; they are never counted as effective.`,
    "**Data layer only.** No network, host, container, infrastructure, HTTP-layer or user-interface testing, and no password or authentication testing: the identity provider is assumed to work, and what is tested is what happens given an identity. Nothing here claims every attack surface was tested.",
    `**One point in time, one instance.** One schema version (${f.wp3.migrationCount} migrations), a disposable local database, synthetic accounts. Historical states are today's questions asked of yesterday's schema.`,
    "**The tests detect the breaks they were written for.** Each negative test simulates the attack its approved row names. WP1 shows the harness notices deliberately obvious breaks — an expression replaced with true, a trigger disabled — not every possible weakening, and says nothing about a control no test touches. A control counted as named by a test is exercised on that test's path, not proven in every respect.",
    "**The refusal to test as a role that bypasses row-level security is code, not a database property.** The testing login can switch into service_role, which holds BYPASSRLS; the harness refuses to.",
    "**Platform-owned surface is reported, not assessed.** Supabase's own schemas and defaults appear in the inventory and are flagged as platform-owned, with no finding raised against them.",
    "**The read-only guard sees git-visible state.** It fingerprints Arc21's tracked files, index, refs, untracked files (with their contents) and the names of ignored paths; it does not hash the contents of already-ignored directories such as node_modules/ or the Supabase CLI's supabase/.temp/.",
    "**Realtime's message partitions are created by the service at runtime,** so immediately after a rebuild the realtime publication is empty; broadcast authorization is enforced by the row policies on realtime.messages, which are inventoried and tested.",
    "**The harness has been wrong before.** Each defect is written up in DECISIONS.md, and every run a defect affected is kept as it was written — the superseded and aborted WP3 runs and the two stopped WP4 runs among them. That bears on how much weight any single run deserves.",
    "**Provenance.** Titles, explanations, remediation options, the framework rationale and every report's connecting prose are AI-drafted; the findings narratives are AI-assisted wording the author reviewed and adopted at CP4 (Amendment A2).",
  ];
}
