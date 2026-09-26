/**
 * Attest — the README's generated sections (D3.61).
 *
 * The README is documentation, but its numbers are evidence. Everything between a pair of
 * `attest:generated:<name>` markers is rewritten by `attest reports` — the project status,
 * the results, the command table (from the CLI's own registry), the layout and the
 * limitations — and `validate-reports` refuses a README whose sections differ from what the
 * evidence regenerates, or whose hand-written text carries an evidence count or stale state.
 */
import { join } from "node:path";
import { ATTEST_ROOT } from "./config.ts";
import { FAMILIES, type Evidence, type Facts } from "./evidence-facts.ts";
import { COMMANDS, type CommandSpec } from "./commands.ts";
import { proveGatesLine, REPORT_LIMITATIONS } from "./wp7-report.ts";

type Rec = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export const README_PATH = join(ATTEST_ROOT, "README.md");
export const README_BLOCKS = ["status", "results", "commands", "layout", "limitations"] as const;
export type ReadmeBlock = (typeof README_BLOCKS)[number];
export const blockStart = (name: string) => `<!-- attest:generated:${name}:start — rewritten by \`npm run attest reports\` from the evidence; do not edit by hand -->`;
export const blockEnd = (name: string) => `<!-- attest:generated:${name}:end -->`;

/** The repository layout the README documents. `validate-reports` requires every non-scratch path to exist. */
export const LAYOUT: readonly { readonly path: string; readonly what: string; readonly generated?: boolean; readonly scratch?: boolean }[] = [
  { path: "src/", what: "The harness: TypeScript run directly by Node (no build step). `db.ts` holds the connection identity model; `cli.ts` dispatches every command in `commands.ts`." },
  { path: "sql/inventory/", what: "The catalog probes WP0 runs, as plain SQL — readable and runnable on their own." },
  { path: "seed/seed.sql", what: "Deterministic synthetic test accounts and data, owned by Attest (never Arc21's seed)." },
  { path: "rubric/", what: "The author's inputs and the frozen records the harness reads: the ratings behind RUBRIC.md, the frozen approved WP3 matrix, the intent store, the Gate A decisions, the CP4 reply (verbatim), the audit-trail scope, the official-run selection and the pinned framework texts." },
  { path: "evidence/runs/", what: "One directory per run: inventory, validation, tiers, the WP3 results and their independent validation, WP4 drift, WP5 and WP6 copies. Never hand-edited; superseded, aborted and stopped runs are kept as they were written." },
  { path: "evidence/prove-gates/", what: "The latest `prove-gates` result, which the reports cite." },
  { path: "RUBRIC.md", what: "The risk rubric, written by the author and frozen at CP3." },
  { path: "DECISIONS.md", what: "Every judgment call, with its alternatives and what would change." },
  { path: "CHECKPOINTS.md", what: "What each checkpoint's state is and how it was reached." },
  { path: "ASSURANCE_REPORT.md", what: "WP7 (a): the control assurance report — one section per risk tier, every control, its tests and outcomes, the ranked findings.", generated: true },
  { path: "dashboard/index.html", what: "WP7 (b): the dashboard — one self-contained file; open it from disk, no server and no network.", generated: true },
  { path: "SUMMARY.md", what: "WP7 (c): the one-page plain-language summary.", generated: true },
  { path: "FINDINGS.md", what: "WP5: the ranked findings, remediation guidance and verification procedures.", generated: true },
  { path: "CP4_PACKET.md", what: "The CP4 record: what the author was shown, and the author's reply.", generated: true },
  { path: "framework-mapping.json", what: "WP6: the machine-readable framework mapping (a study exercise).", generated: true },
  { path: "FRAMEWORK_MAPPING.md", what: "WP6: the same mapping, for reading.", generated: true },
  { path: "CSA_NOTE.md", what: "WP6: the one-page note on what this output could and could not serve as under FDA's CSA guidance.", generated: true },
  { path: "CP5_RECORD.md", what: "CP5, recorded as superseded by Amendment A2 — not approved.", generated: true },
  { path: "LOCAL_DATABASE.md", what: "What the shared local database holds, what each backup in `.local-backups/` is, how they were verified, and how to restore one." },
  { path: "PROJECT_COMPLETION_PROGRESS.md", what: "The engineering work log of the completion pass (not evidence)." },
  { path: ".wp4-states/", what: "Scratch (gitignored): Arc21's earlier schema states, written with `git archive` — never Arc21 itself.", scratch: true },
  { path: ".smoke/", what: "Scratch (gitignored): plumbing smoke runs, stamped NOT WP3 EVIDENCE.", scratch: true },
];

const tick = (s: string) => `\`${s}\``;

/** Each work package's state, derived from its evidence — "complete" only when its condition holds. */
export function projectStatus(ev: Evidence, f: Facts): { rows: { wp: string; complete: boolean; evidence: string }[]; complete: boolean } {
  const bv = f.wp3.byVerdict;
  const allExit0 = f.wp4.states.length >= 3 && f.wp4.states.every((s) => s.exit === 0);
  const wp3Complete = f.wp3.total === (ev.planTests.length || f.wp3.total) && f.wp3.validationPassed && ev.results.meta?.aborted == null;
  const rows = [
    { wp: "WP0 control inventory", complete: f.wp0.resources > 0 && f.wp0.controls > 0, evidence: `${f.wp0.resources} resources, ${f.wp0.controls} (resource, control) pairs read from the live catalogs; frozen at CP1 (run ${tick(f.runs.frozenCp3)})` },
    { wp: "WP1 harness validation", complete: f.wp1.scenarios > 0 && f.wp1.detected === f.wp1.scenarios && f.wp1.restored === f.wp1.scenarios && f.wp1.inventoryUnchanged, evidence: `${f.wp1.detected} of ${f.wp1.scenarios} deliberately broken controls detected by the role-scoped probe and restored; the same statements on over-privileged connections told intact from broken in ${f.wp1.overPrivilegedDiscriminated} of ${f.wp1.overPrivilegedChecks} checks — the role scoping is what detects` },
    { wp: "WP2 risk rubric and tiers", complete: f.wp2.resources === f.wp0.resources, evidence: `the author's rubric; ${Object.entries(f.wp2.byTier).map(([t, n]) => `${n} ${t}`).join(", ")}; frozen at CP3` },
    { wp: "WP3 control testing", complete: wp3Complete, evidence: `official run ${tick(f.runs.wp3)}: ${f.wp3.total} Test IDs — ${bv.effective} effective, ${bv.gap} gap, ${bv.characterized} characterized, ${bv.deficient} deficient, ${bv.not_measured} not measured; \`validate-wp3\` ${f.wp3.validationChecksPassed} of ${f.wp3.validationChecks}` },
    { wp: "WP4 drift detection", complete: allExit0, evidence: `run ${tick(f.runs.wp4)}: ${f.wp4.states.length} schema states, every state exit ${allExit0 ? "0" : "NOT 0"}` },
    { wp: "WP5 findings and remediation guidance", complete: f.wp5.cp4Approved && f.wp5.items.length > 0, evidence: `${f.wp5.items.filter((i) => i.part === "finding").length} findings, ${f.wp5.items.filter((i) => i.part === "informational").length} informational items, ${f.wp5.items.filter((i) => i.part === "limitation").length} limitations; CP4 ${f.wp5.cp4Approved ? `approved by the author ${f.wp5.cp4Date}` : "NOT approved"}; nothing remediated` },
    { wp: "WP6 framework mapping (a study exercise)", complete: f.wp6 !== null && f.wp6.validationPassed, evidence: f.wp6 ? `${f.wp6.entries} entries; \`validate-wp6\` ${f.wp6.validationChecksPassed} of ${f.wp6.validationChecks}; CP5 superseded by Amendment A2 — not approved` : "not generated" },
    { wp: "WP7 reporting", complete: f.proveGates !== null && f.proveGates.passed, evidence: `assurance report, dashboard and plain-language summary, regenerated from the evidence and re-derived by \`validate-reports\`; \`prove-gates\`: ${proveGatesLine(f)}` },
  ];
  return { rows, complete: rows.every((r) => r.complete) };
}

function statusBlock(ev: Evidence, f: Facts): string[] {
  const st = projectStatus(ev, f);
  const L: string[] = [];
  L.push(st.complete
    ? "**Status: complete.** Every work package is done, and every output is regenerated from the evidence and checked by code that did not write it. Nothing in Arc21 was changed or remediated."
    : `**Status: NOT complete** — ${st.rows.filter((r) => !r.complete).map((r) => r.wp).join(", ")}.`);
  L.push("");
  L.push("| Work package | State | Evidence |");
  L.push("|---|---|---|");
  for (const r of st.rows) L.push(`| ${r.wp} | ${r.complete ? "complete" : "**INCOMPLETE**"} | ${r.evidence} |`);
  L.push("");
  L.push(`Checkpoints: CP1, CP2 and CP3 approved (reaffirmed by the author 2026-09-22); Gate A answered by the author 2026-09-24; CP4 ${f.wp5.cp4Approved ? `approved by the author ${f.wp5.cp4Date}` : "not approved"}; CP5 **superseded by Amendment A2** — its separate interaction was waived prospectively by the author, so it is recorded as superseded, never as approved (\`CHECKPOINTS.md\`).`);
  return L;
}

function resultsBlock(ev: Evidence, f: Facts): string[] {
  const bv = f.wp3.byVerdict;
  const items = f.wp5.items;
  const rc = f.wp0.rowControl;
  const own = f.wp0.ownership;
  const L: string[] = [];
  const p = (s = "") => L.push(s);
  p(`**Evidence:** WP3 run ${tick(f.runs.wp3)} (validated ${f.wp3.validationChecksPassed}/${f.wp3.validationChecks}) · WP4 run ${tick(f.runs.wp4)} · frozen CP1/CP3 run ${tick(f.runs.frozenCp3)} · schema ${tick(f.wp3.schemaVersion.slice(0, 12))} (${f.wp3.migrationCount} migrations) · the author's selection of these runs: \`rubric/official-runs.json\`.`);
  p();
  p("| Inventory (WP0), read from the live catalogs | |");
  p("|---|---:|");
  p(`| Resources in scope | ${f.wp0.resources} |`);
  p(`| (resource, control) pairs | ${f.wp0.controls} |`);
  p(`| Row-level security policies | ${f.wp0.policies} |`);
  p(`| \`SECURITY DEFINER\` functions | ${f.wp0.definerFunctions} (${f.wp0.definerClientCallable} callable by a client role) |`);
  p(`| Triggers (${f.wp0.triggersThatCanRefuse} of which can refuse a write) | ${f.wp0.triggers} |`);
  p(`| Column-level grants | ${f.wp0.columnGrants} |`);
  p(`| Tables with row-level security **enabled** | ${f.wp0.rlsEnabled} of ${f.wp0.tables} |`);
  p(`| Tables with row-level security **forced** | **${f.wp0.rlsForced} of ${f.wp0.tables}** |`);
  p(`| Resources with a row-level control (WP4's definition) | ${rc.withRowControl} of ${f.wp0.resources} |`);
  p();
  p(`The brief's "no control" patterns, as the frozen inventory classified them: row-level security off — ${rc.rlsDisabled.length}; on with no policy, so every client is denied — ${rc.noPolicyDenyAll.length}; readable without an account — ${rc.anonReachable.length} (catalogue tables, accepted as design intent); granted to the anonymous role with no policy admitting it — ${rc.anonLatent.length} (informational). The enabled-versus-forced split is the one to read twice: row-level security that is enabled but not forced does not apply to a table's owner, and ${own.appTablesOwnedByBypass === own.appTables ? `all ${own.appTables}` : `${own.appTablesOwnedByBypass} of the ${own.appTables}`} of Arc21's own tables are owned by ${own.appOwners.map((o) => tick(o)).join(", ")}, which also holds \`BYPASSRLS\`${own.otherTables.length ? ` (${own.otherTables.map((t) => `${tick(t.resource)} is owned by ${tick(t.owner)}, which ${t.bypasses ? "also holds" : "does not hold"} it`).join("; ")})` : ""} — item B1, informational by the author's decision.`);
  p();
  p(`**WP3, the assessment** — ${f.wp3.total} Test IDs (${f.wp3.byPolarity.positive ?? 0} positive, ${f.wp3.byPolarity.negative ?? 0} negative, ${f.wp3.byPolarity.characterization ?? 0} characterization), each run under a role-scoped session and recorded with its statement, identity, expectation, outcome, timestamp and schema version:`);
  p();
  p("| Verdict | Tests | Meaning |");
  p("|---|---:|---|");
  p(`| effective | ${bv.effective} | the control held exactly as the approved row predicted |`);
  p(`| gap | ${bv.gap} | a control the plan asked about does not exist — the audit-trail family |`);
  p(`| characterized | ${bv.characterized} | a recorded fact rather than a pass or fail — chiefly row-level security not forced, and its mechanism |`);
  p(`| deficient | ${bv.deficient} | the control was exercised and did not hold |`);
  p(`| not measured | ${bv.not_measured} | approved rows the schema makes unmeasurable, kept that way by the author at Gate A — never counted as effective |`);
  p();
  p("| Family | Tests | effective | not effective |");
  p("|---|---:|---:|---|");
  for (const fam of FAMILIES) {
    const c = f.wp3.byFamily[fam.code]!;
    const rest = [c.deficient && `${c.deficient} deficient`, c.gap && `${c.gap} gap`, c.characterized && `${c.characterized} characterized`, c.not_measured && `${c.not_measured} not measured`].filter(Boolean).join(", ");
    p(`| ${fam.code} ${fam.name} | ${c.total} | ${c.effective} | ${rest || "—"} |`);
  }
  p();
  p(`**WP5, the findings** — CP4 ${f.wp5.cp4Approved ? `approved by the author ${f.wp5.cp4Date}` : "not approved"}. Every status is the author's decision; nothing was remediated, fixed or closed. Each finding carries remediation options with their tradeoffs and a verification procedure by Test ID — or says plainly where the frozen tests could not confirm a fix (\`FINDINGS.md\`).`);
  p();
  p("| # | Item | Tier | Evidence | The author's status |");
  p("|---|---|---|---|---|");
  for (const i of items) p(`| ${i.id} | ${i.title} | ${i.tier} | ${i.evidenceClass === "none" ? "WP0 observation" : `${i.testIds.length} ${i.evidenceClass.replace(/_/g, " ")}`} | ${i.status.replace(/_/g, " ")} |`);
  p();
  if (f.wp5.scope) p(`A2's scope under the author's J3/J4 rule: ${f.wp5.scope.trailRequired} of ${f.wp5.scope.total} resources require a trail and have none (open); ${f.wp5.scope.excluded} excluded as transient live state; ${f.wp5.scope.conditional} conditional on the wallet ledger (not established).`);
  p();
  const h1c = f.wp4.diffs.find((d) => d.from === f.wp4.states[0]?.name && d.to === "C-current");
  p(`**WP4, drift** — the same approved questions asked of Arc21 as it was in ${f.wp4.states.filter((s) => /^H\d/.test(s.name)).length} earlier states rebuilt from its own git history (\`.wp4-states/\`, never the checkout), and of an Attest-only scratch copy with one unprotected table added: ${f.wp4.diffs.reduce((m, d) => m + (d.passToFail ?? 0), 0)} went from pass to fail; ${h1c?.failToPass ?? 0} went from fail to pass between the oldest state and today; the unprotected table (${f.wp4.newUnprotected.map((u) => tick(u.resource)).join(", ")}) was reported on the run that added it${f.wp4.newUnprotected.some((u) => !u.clientReachable) ? ", and as unreachable by any client role today — one grant from exposed" : ""}. Today's inventory re-read by WP4 differs from the frozen one in ${f.wp4.currentVsFrozenDifferences} places.`);
  p();
  if (f.wp6) p(`**WP6, framework mapping — a study exercise, not compliance, validation or audit.** ${f.wp6.entries} entries against NIST SP 800-53 Rev. 5 and 21 CFR Part 11 (${f.wp6.briefMinimum} from the brief's list, ${f.wp6.added} added where the evidence bears directly): ${f.wp6.evidenced} evidenced on tested paths only, ${f.wp6.partial} partial, ${f.wp6.notMapped} not mapped. Every rationale is AI-drafted and labelled so; every quoted text is verbatim from the primary source; \`validate-wp6\` re-derived every citation (${f.wp6.validationChecksPassed} of ${f.wp6.validationChecks} checks). Arc21 is not a regulated system (\`FRAMEWORK_MAPPING.md\`, \`CSA_NOTE.md\`).`);
  p();
  p(`**The harness, checked:** WP1 detected ${f.wp1.detected} of ${f.wp1.scenarios} deliberately broken controls; \`validate-wp3\` passed ${f.wp3.validationChecksPassed} of ${f.wp3.validationChecks}; \`validate-wp6\` ${f.wp6 ? `${f.wp6.validationChecksPassed} of ${f.wp6.validationChecks}` : "not run"}; \`prove-gates\`: ${proveGatesLine(f)}.`);
  return L;
}

function commandRow(c: CommandSpec): string {
  const db = c.db === "none" ? "not used" : c.db;
  return `| \`npm run attest ${c.usage ?? c.name}\` | ${c.does.replace(/\|/g, "\\|")} | ${db}${c.network ? "; network" : ""} |`;
}

function commandsBlock(): string[] {
  const L: string[] = [];
  const groups: [CommandSpec["group"], string][] = [
    ["reproduce", "Reproduce"],
    ["reports", "Reports and findings (no database)"],
    ["assessment", "The assessment, step by step"],
    ["history", "Gate history (kept for the record; nothing pending)"],
  ];
  for (const [g, title] of groups) {
    L.push(`**${title}**`);
    L.push("");
    L.push("| Command | Does | Database |");
    L.push("|---|---|---|");
    for (const c of COMMANDS.filter((x) => x.group === g)) L.push(commandRow(c));
    L.push("");
  }
  L.pop();
  return L;
}

function layoutBlock(): string[] {
  const L = ["| Path | Contents |", "|---|---|"];
  for (const e of LAYOUT) L.push(`| \`${e.path}\` | ${e.generated ? "*Generated by `reports`; never hand-edited.* " : ""}${e.what} |`);
  return L;
}

function limitationsBlock(f: Facts): string[] {
  const n = f.provenance.narratives, i = f.provenance.intents;
  const fmt = (m: Readonly<Record<string, number>>) => Object.entries(m).map(([k, v]) => `${v} ${k}`).join(", ") || "none";
  return [
    ...REPORT_LIMITATIONS(f).map((l) => `- ${l}`),
    "",
    `**Provenance (Amendment A2, 2026-09-25).** The risk rubric is the author's own writing. The ${Object.values(i).reduce((a, b) => a + b, 0)} attack-intent sentences were AI-drafted and adopted by the author at Gate A (${fmt(i)}). The findings narratives are AI-assisted wording the author reviewed and adopted at CP4 (${fmt(n)}); every status and judgment is the author's decision. The framework-mapping rationale, the CSA note, the remediation options and every report's connecting prose are AI-drafted and labelled so. No AI-worded text is presented as the author's independent composition.`,
  ];
}

export function renderReadmeBlocks(ev: Evidence, f: Facts): Record<ReadmeBlock, string> {
  const wrap = (name: ReadmeBlock, lines: string[]) => [blockStart(name), "", ...lines, "", blockEnd(name)].join("\n");
  return {
    status: wrap("status", statusBlock(ev, f)),
    results: wrap("results", resultsBlock(ev, f)),
    commands: wrap("commands", commandsBlock()),
    layout: wrap("layout", layoutBlock()),
    limitations: wrap("limitations", limitationsBlock(f)),
  };
}

/** Replace every generated section; refuse if a marker is missing, duplicated or out of order. */
export function spliceReadme(readme: string, blocks: Readonly<Record<string, string>>): string {
  let out = readme;
  for (const [name, block] of Object.entries(blocks)) {
    const s = blockStart(name), e = blockEnd(name);
    const a = out.indexOf(s), b = out.indexOf(e);
    if (a < 0 || b < 0 || b < a) throw new Error(`README.md has no generated "${name}" section (its markers are missing)`);
    if (out.indexOf(s, a + 1) >= 0 || out.indexOf(e, b + 1) >= 0) throw new Error(`README.md has the "${name}" markers twice`);
    out = out.slice(0, a) + block + out.slice(b + e.length);
  }
  return out;
}

/** The README with every generated section removed: what is left is hand-written. */
export function handWritten(readme: string): string {
  let out = readme;
  for (const name of README_BLOCKS) {
    const a = out.indexOf(blockStart(name)), b = out.indexOf(blockEnd(name));
    if (a >= 0 && b > a) out = out.slice(0, a) + out.slice(b + blockEnd(name).length);
  }
  return out;
}

export type { Rec };
