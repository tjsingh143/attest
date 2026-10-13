/**
 * Attest — `attest validate-reports` (D3.61): every WP7 deliverable checked by code that did
 * not write it.
 *
 * It reads the persisted evidence and re-derives every headline number with its own counting:
 * verdicts from the raw records; families from each Test ID's prefix (not the family label the
 * generators read); test depth; the inventory and WP1 from the frozen files; drift from the
 * transition lists (not the counts stored beside them); the framework support levels; each
 * finding's status from the author's recorded CP4 reply; the prove-gates totals from its rows.
 * Then it parses what each output says — the assurance report, the plain-language summary, the
 * dashboard's embedded data, the README's generated sections — and requires every one of them to
 * agree with it, and so with each other.
 *
 * It imports no number from the generators (evidence-facts.ts, the renderers, WP5/WP6 builders).
 * What it shares is deliberate and small: the claims lint (a rule set that prove-gates breaks on
 * its own), the README markers and the command registry (syntax, not numbers), and — for the one
 * check that asks whether each file is exactly what the evidence regenerates — the generators'
 * output, compared byte for byte.
 *
 * `loadReportInputs` reads; `validateReportsLoaded` is pure, so prove-gates can hand it a
 * tampered copy of any input and require the check that owns the defect to fail.
 */
import { readdir, readFile, stat, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { ATTEST_ROOT, RUNS_ROOT } from "./config.ts";
import { lintClaims, sentences, wordCount } from "./claims-lint.ts";
import { COMMANDS, DISPATCHED } from "./commands.ts";
import { readHarnessVersion } from "./harness-version.ts";
import { blockEnd, blockStart, handWritten, LAYOUT, README_BLOCKS } from "./wp7-readme.ts";
import { presentationIssues } from "./presentation.ts";

type Rec = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export interface Check { readonly name: string; readonly passed: boolean; readonly detail: string }
export interface ReportsValidation { readonly passed: boolean; readonly checks: readonly Check[] }

/** The one check prove-gates' control cannot pass mid-run: its own record is rewritten at the end of the run. */
export const PROVE_GATES_CURRENCY_CHECK = "the prove-gates record is for the harness as it is now";

/** Relative paths of the documents parsed below. */
export const DOCS = {
  report: "ASSURANCE_REPORT.md",
  summary: "SUMMARY.md",
  dashboard: "dashboard/index.html",
  readme: "README.md",
  findings: "FINDINGS.md",
  cp4: "CP4_PACKET.md",
  cp5: "CP5_RECORD.md",
  csa: "CSA_NOTE.md",
  mappingMd: "FRAMEWORK_MAPPING.md",
} as const;
export type DocKey = keyof typeof DOCS;

export interface ReportInputs {
  readonly official: Rec;
  readonly results: Rec;
  readonly wp3Validation: Rec;
  readonly planTests: readonly Rec[];
  readonly inventory: Rec;
  readonly cp3: Rec;
  readonly wp1: Rec;
  readonly drift: Rec;
  readonly cp4: Rec;
  readonly narratives: Rec;
  readonly intents: Rec;
  readonly findings: Rec;
  readonly auditScope: Rec;
  readonly mapping: Rec | null;
  readonly wp6Validation: Rec | null;
  readonly proveGates: Rec | null;
  readonly harnessNow: string;
  readonly cliSource: string;
  readonly runDirs: readonly string[];
  /** Layout path → exists on disk. */
  readonly layoutExists: Readonly<Record<string, boolean>>;
  readonly docs: Readonly<Record<DocKey, string>>;
  /** Relative path → what the generators produce now (null: not built). */
  readonly regenerated: ReadonlyMap<string, string> | null;
  /** Relative path → what is on disk, for the same paths. */
  readonly onDisk: ReadonlyMap<string, string>;
}

// ---------------------------------------------------------------- this validator's own counting

const V = ["effective", "deficient", "gap", "characterized", "not_measured"] as const;
type Counts = Record<(typeof V)[number] | "total", number>;
/** From the Test ID ("F7m.mechanism.303" → F7), never from the record's family label. */
const famOf = (testId: string): string => testId.split(".")[0]!.replace(/[a-z]+$/, "");
const FAMILY_CODES = ["F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "F10", "B"];

function countOf(recs: readonly Rec[]): Counts {
  const c: Counts = { effective: 0, deficient: 0, gap: 0, characterized: 0, not_measured: 0, total: recs.length };
  for (const r of recs) if ((V as readonly string[]).includes(String(r.verdict))) c[r.verdict as (typeof V)[number]]++;
  return c;
}
const sameCounts = (a: Partial<Counts> | null | undefined, b: Counts): boolean => !!a && V.every((k) => Number(a[k] ?? 0) === b[k]) && (a.total === undefined || Number(a.total) === b.total);
const showCounts = (c: Partial<Counts>) => V.map((k) => `${k} ${c[k] ?? 0}`).join(", ") + (c.total !== undefined ? `, total ${c.total}` : "");
const j = (x: unknown) => JSON.stringify(x);
const norm = (s: string) => s.replace(/[*`]/g, "").replace(/[_\s]+/g, " ").trim().toLowerCase();
const numIn = (s: string | undefined): number => Number(String(s ?? "").replace(/[*`,\s]/g, ""));

/** Split a markdown table row into cells (escaped pipes stay inside a cell). */
function cells(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  const body = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  for (let i = 0; i < body.length; i++) {
    if (body[i] === "\\" && body[i + 1] === "|") { cur += "|"; i++; continue; }
    if (body[i] === "|") { out.push(cur.trim()); cur = ""; continue; }
    cur += body[i];
  }
  out.push(cur.trim());
  return out;
}

/** The body rows of the first table whose header row matches. */
function table(md: string, header: RegExp): string[][] {
  const lines = md.split("\n");
  const at = lines.findIndex((l) => l.trim().startsWith("|") && header.test(l));
  if (at < 0) return [];
  const rows: string[][] = [];
  for (let i = at + 2; i < lines.length && lines[i]!.trim().startsWith("|"); i++) rows.push(cells(lines[i]!));
  return rows;
}

function lineWith(md: string, re: RegExp): string | null {
  return md.split("\n").find((l) => re.test(l)) ?? null;
}

function readmeBlock(readme: string, name: string): string | null {
  const a = readme.indexOf(blockStart(name)), b = readme.indexOf(blockEnd(name));
  return a >= 0 && b > a ? readme.slice(a, b) : null;
}

/** Visible text of the dashboard: the page with scripts, styles and tags removed. */
function dashboardText(html: string): string {
  // Every tag becomes a paragraph break, so each piece of visible text is judged on its own.
  return html.replace(/<script[\s\S]*?<\/script>/gi, "\n\n").replace(/<style[\s\S]*?<\/style>/gi, "\n\n").replace(/<[^>]+>/g, "\n\n").replace(/&[a-z]+;/g, " ");
}

function dashboardData(html: string): Rec | null {
  const m = /<script type="application\/json" id="attest-data">([\s\S]*?)<\/script>/.exec(html);
  if (!m) return null;
  try { return JSON.parse(m[1]!) as Rec; } catch { return null; }
}

// ---------------------------------------------------------------- the provenance and state lints

const NEG = /\b(not|no|never|nor|none|neither|without|cannot|nothing|nobody|isn't|aren't|wasn't|weren't|won't|doesn't|don't|didn't|n't)\b/i;
/** Negation, with the verdict name "not measured" taken out first — it would otherwise negate itself. */
const negated = (s: string) => NEG.test(s.replace(/not[ _]measured/gi, "unmeasured"));

const PROVENANCE_RULES: readonly { readonly re: RegExp; readonly why: string; readonly unlessAi?: boolean }[] = [
  { re: /\b(Arc21|the game|the application)\b[^.]{0,60}\b(is|was|has been|were|now)\s+(fixed|remediated|patched|secured)\b/i, why: "claims Arc21 was fixed" },
  { re: /\b(findings?|gaps?|weakness(es)?|deficienc(y|ies)|items? A\d|A[1-4]|B[1-4])\b[^.]{0,50}\b(is|are|was|were|has been|have been)\s+(now\s+)?(fixed|remediated|closed|resolved)\b/i, why: "claims a finding was fixed, remediated or closed" },
  { re: /\bremediation\b[^.]{0,40}\b(is|was|has been|were|have been)\s+(now\s+)?(implemented|complete|completed|done|applied|verified)\b/i, why: "claims remediation was implemented or verified" },
  { re: /\b(verified|confirmed)\s+(the\s+)?(closure|fix)\b|\bclosure\b[^.]{0,20}\b(verified|confirmed)\b/i, why: "claims closure was verified" },
  { re: /\b(written|authored|composed)\s+by\s+the\s+author\b|\bthe author wrote\b|\bthe author'?s own (words|writing|composition|prose)\b|\bin the author'?s own words\b/i, why: "labels AI-worded text as the author's own writing", unlessAi: true },
  { re: /\bCP5\b[^.]{0,60}\bapproved\b/i, why: "calls CP5 approved (it was superseded by Amendment A2)" },
  { re: /not[ _]measured[^.]{0,60}\b(count(ed|s)?|treated|reported|shown|included|recorded)\b[^.]{0,20}\b(as|among|with)\b[^.]{0,20}\b(pass(es|ing)?|effective|held|successes?)\b|\b(pass(es|ed)?|effective|held)\b[^.]{0,30}\b(including|includes|plus)\b[^.]{0,30}\bnot[ _]measured\b|\bnot[ _]measured\b[^.]{0,20}\b(passed|held|succeeded)\b/i, why: "presents not-measured results as passing" },
];
/** An authorship claim is refused only about AI-worded material; the rubric really is the author's. */
const AI_WORDED = /\b(narratives?|rationales?|summary|report|prose|mapping|remediation options|CSA note|explanations?)\b/i;

/**
 * The units a lint reads. Markdown is hard-wrapped, so a sentence split at line ends could part
 * a claim from its negation — or hide a claim from the lint. So wrapped lines are joined into
 * their paragraph or list item first; a list item is read with the line that introduces it
 * ("This approval does NOT mean:" / "- findings were fixed;"); a table row is skipped (labels and
 * counts, which the numeric checks own); a blockquote is read as prose.
 */
export function lintUnits(text: string): { readonly text: string; readonly context: string }[] {
  const blocks: { kind: "para" | "item" | "heading"; text: string }[] = [];
  let cur: { kind: "para" | "item" | "heading"; text: string } | null = null;
  for (const raw of text.split("\n")) {
    const l = raw.replace(/^\s*>\s?/, "");
    const t = l.trim();
    if (!t) { cur = null; continue; }
    if (t.startsWith("|")) { cur = null; continue; }
    if (/^#{1,6}\s/.test(t)) { cur = { kind: "heading", text: t }; blocks.push(cur); cur = null; continue; }
    if (/^([-*+]|\d+\.)\s+/.test(t)) { cur = { kind: "item", text: t.replace(/^([-*+]|\d+\.)\s+/, "") }; blocks.push(cur); continue; }
    if (cur && (cur.kind === "para" || (cur.kind === "item" && /^\s/.test(l)))) { cur.text += ` ${t}`; continue; }
    cur = { kind: "para", text: t };
    blocks.push(cur);
  }
  const out: { text: string; context: string }[] = [];
  let lead = "";
  for (const b of blocks) {
    const masked = b.text.replace(/`[^`]*`/g, (m) => m.replace(/[.!?]/g, " "));
    for (const s of masked.split(/(?<=[.!?])\s+/).map((x) => x.trim()).filter(Boolean)) out.push({ text: s, context: b.kind === "item" ? `${lead} ${s}` : s });
    if (b.kind !== "item") lead = b.text;
  }
  return out;
}

export function provenanceLint(text: string, where: string): string[] {
  const out: string[] = [];
  for (const u of lintUnits(text)) {
    for (const r of PROVENANCE_RULES) {
      if (!r.re.test(u.text) || negated(u.context)) continue;
      if (r.unlessAi && (/\bAI\b/.test(u.context) || !AI_WORDED.test(u.text))) continue;
      out.push(`${where}: ${r.why}: "${u.text.slice(0, 160)}"`);
    }
  }
  return out;
}

/** The claims lint, over the same units (a list item is judged with the line that introduces it). */
export function claimsLint(text: string, where: string): string[] {
  const out: string[] = [];
  for (const u of lintUnits(text)) {
    const own = lintClaims(u.text, where);
    if (own.length && lintClaims(u.context, where).length) out.push(...own.map((l) => `${l.where}: ${l.sentence.slice(0, 140)}`));
  }
  return out;
}

const STALE: readonly { readonly re: RegExp; readonly why: string }[] = [
  { re: /\bWP3\b[^.]{0,60}\b(is planned|planned and implemented|not (yet )?(been )?(executed|run))\b/i, why: "says WP3 has not run" },
  { re: /\bNOT executed\b|\bhas not (yet )?been (executed|run)\b|\bno WP3 counts exist\b/, why: "says the assessment has not run" },
  { re: /\bWP[4-7]\b[^.]{0,40}\b(has not begun|not started|not yet (done|started)|in progress|awaiting)\b/i, why: "says a work package is unfinished" },
  { re: /\bCP[45]\b[^.]{0,50}\b(pending|awaiting|is presented|not yet (approved|answered))\b/i, why: "says a checkpoint is pending" },
  { re: /\bawaiting the author\b|\bstopped at checkpoint\b|\bStatus: work in progress\b|^#+\s*Not yet done\b/im, why: "describes the project as unfinished" },
];

export function staleLint(text: string, where: string): string[] {
  const out: string[] = [];
  for (const u of lintUnits(text)) for (const r of STALE) if (r.re.test(u.text)) out.push(`${where}: ${r.why}: "${u.text.slice(0, 160)}"`);
  return out;
}

/** Evidence counts that must live only inside the README's generated sections. */
const COUNT_PHRASES: readonly RegExp[] = [
  /\b\d+\s*\/\s*\d+\b/,
  /\b\d+ (of|out of) \d+\b/i,
  /\b\d+ (effective|deficient|gaps?|characteri[sz]ed|not measured|injected defects?|controls? held|Test IDs|tests|records|findings|resources|controls|policies|probes|checks|attempts)\b/i,
];

const SUMMARY_JARGON: readonly RegExp[] = [
  /\bSQL\b/, /\bPostgre(SQL|s)\b/i, /\bRLS\b/, /row[- ]level/i, /SECURITY DEFINER/i, /BYPASSRLS/i, /\bJWT\b/, /\bschemas?\b/i, /\bmigrations?\b/i,
  /\bcatalogs?\b/i, /\btriggers?\b/i, /\bSupabase\b/i, /\bAPIs?\b/, /\bHTTPS?\b/, /\banon\b/i, /\bauthenticated\b/i, /\bgrants?\b/i, /\bpolic(y|ies)\b/i,
  /\bselect\b/i, /\binsert\b/i, /\bTest IDs?\b/i, /\bWP\d\b/, /\bF\d+\b/, /\bRealtime\b/i, /\btokens?\b/i, /\bidempoten/i, /\bSECURITY\b/, /\bservice[_ ]role\b/i,
  /\bverdicts?\b/i, /\bcharacteri[sz]ed\b/i, /\bdeficient\b/i, /\bNIST\b/, /\bCFR\b/, /\bGxP\b/, /\bCSA\b/, /\bharness\b/i, /\bfixtures?\b/i, /\bprobes?\b/i,
];
export const SUMMARY_WORD_LIMIT = 650;
const SUMMARY_EXEMPT = /^\*For readers of the technical report:/;

// ---------------------------------------------------------------- the checks

export function validateReportsLoaded(x: ReportInputs): ReportsValidation {
  const checks: Check[] = [];
  const add = (name: string, bad: readonly string[], ok: string) => checks.push({ name, passed: bad.length === 0, detail: bad.length ? `${bad.length}: ${bad.slice(0, 8).join(" | ")}` : ok });
  const d = x.docs;
  const recs = (x.results.records ?? []) as Rec[];
  const byId = new Map(recs.map((r) => [String(r.testId), r]));
  const raw = countOf(recs);
  const off = x.official;
  const dash = dashboardData(d.dashboard);

  // 1. the official runs ---------------------------------------------------------------------
  {
    const bad: string[] = [];
    for (const k of ["wp3", "plan", "wp4", "frozenCp3"]) if (!x.runDirs.includes(String(off[k]))) bad.push(`official ${k} run ${off[k]} is not in evidence/runs/`);
    if (!/CP4/.test(String(off.decidedBy))) bad.push("official-runs.json does not record the author's CP4 decision");
    if (x.results.meta?.runId !== off.wp3) bad.push(`the WP3 results file is run ${x.results.meta?.runId}, not the official ${off.wp3}`);
    if (x.results.meta?.aborted != null) bad.push("the official WP3 run is aborted");
    if (recs.length !== x.planTests.length) bad.push(`${recs.length} records for ${x.planTests.length} planned Test IDs`);
    if (new Set(recs.map((r) => r.testId)).size !== recs.length) bad.push("a Test ID is recorded twice");
    const planned = new Set(x.planTests.map((t) => String(t.testId)));
    const unplanned = recs.filter((r) => !planned.has(String(r.testId))).map((r) => r.testId);
    if (unplanned.length) bad.push(`records not in the plan: ${unplanned.slice(0, 3).join(", ")}`);
    if (x.results.arc21ReadOnlyGuard?.identical !== true) bad.push("the official run's own Arc21 guard did not report the checkout unchanged");
    if (x.wp3Validation.runId !== off.wp3 || x.wp3Validation.passed !== true || ((x.wp3Validation.checks ?? []) as Rec[]).some((c) => c.passed !== true)) bad.push("the official run's independent validation (validate-wp3) did not pass");
    if (x.drift.runId !== off.wp4 || x.drift.wp3RunId !== off.wp3) bad.push(`the drift file is run ${x.drift.runId} over WP3 ${x.drift.wp3RunId}`);
    const states = (x.drift.states ?? []) as Rec[];
    if (states.length < 3 || states.some((s) => Number(s.exit) !== 0)) bad.push(`WP4 states: ${states.map((s) => `${s.name} exit ${s.exit}`).join(", ")}`);
    const officialIds = new Set([off.wp3, off.plan, off.wp4, off.frozenCp3].map(String));
    for (const n of (off.notResults ?? []) as Rec[]) if (officialIds.has(String(n.runId))) bad.push(`${n.runId} is both official and not a result`);
    add("the official runs are the author's selection, and each is complete and validated", bad,
      `WP3 ${off.wp3} (${recs.length} records, validate-wp3 ${((x.wp3Validation.checks ?? []) as Rec[]).length}/${((x.wp3Validation.checks ?? []) as Rec[]).length}), WP4 ${off.wp4} (${states.length} states, all exit 0)`);
  }

  // 2. the WP3 counts, three ways ---------------------------------------------------------------
  {
    const bad: string[] = [];
    if (!sameCounts({ ...x.results.byVerdict, total: recs.length }, raw)) bad.push(`the results file's own byVerdict (${showCounts(x.results.byVerdict ?? {})}) is not the records' (${showCounts(raw)})`);
    if (!sameCounts({ ...x.wp3Validation.totals?.byVerdict, total: Number(x.wp3Validation.totals?.records) }, raw)) bad.push("the validation file's totals are not the records'");
    for (const r of recs) if (!(V as readonly string[]).includes(String(r.verdict))) bad.push(`${r.testId}: unknown verdict ${r.verdict}`);
    add("the WP3 counts re-derived from the raw records agree with the results file and its validation", bad, showCounts(raw));
  }

  // expected family / depth / polarity breakdowns, this validator's own
  const byFam = new Map(FAMILY_CODES.map((c) => [c, countOf(recs.filter((r) => famOf(String(r.testId)) === c))]));
  const byDepth = new Map([...new Set(recs.map((r) => String(r.tier)))].map((t) => [t, countOf(recs.filter((r) => String(r.tier) === t))]));
  const byPol = recs.reduce<Record<string, number>>((m, r) => ({ ...m, [String(r.polarity)]: (m[String(r.polarity)] ?? 0) + 1 }), {});
  const famTotal = [...byFam.values()].reduce((m, c) => m + c.total, 0);

  // WP0 / WP1 from the frozen files, own counting
  const inv = x.inventory;
  const ctl = (inv.controls ?? []) as Rec[];
  const kind = (k: string) => ctl.filter((c) => c.controlKind === k);
  const resources = (inv.resources ?? []) as Rec[];
  const wp0 = {
    resources: resources.length, controls: ctl.length, policies: kind("policy").length,
    definers: kind("security_definer_function").length,
    definersClient: kind("security_definer_function").filter((c) => ((c.detail?.executable_by ?? []) as string[]).some((g) => g === "anon" || g === "authenticated")).length,
    triggers: kind("trigger").length, triggersRefuse: kind("trigger").filter((c) => c.detail?.can_refuse === true).length,
    columnGrants: kind("column_grant").length,
    tables: kind("rls_enabled").length, rlsEnabled: kind("rls_enabled").filter((c) => c.detail?.rls_enabled === true).length,
    rlsForced: kind("rls_forced").filter((c) => c.detail?.rls_forced === true).length,
    rowControl: resources.filter((r) => (r.kind === "view" || r.kind === "materialized_view") ? r.viewSecurityInvoker === true : r.rlsEnabled === true).length,
  };
  const scen = (x.wp1.scenarios ?? []) as Rec[];
  const over = scen.flatMap((s) => (s.overPrivileged ?? []) as Rec[]);
  const wp1 = { scenarios: scen.length, detected: scen.filter((s) => s.detected === true).length, over: over.length, discriminated: over.filter((o) => o.discriminates === true).length };

  // WP4 from the transition lists
  const diffs = (x.drift.diffs ?? []) as Rec[];
  const trans = (dd: Rec, kindName: string) => ((dd.results?.transitions ?? []) as Rec[]).filter((t) => t.kind === kindName);
  const passToFailIds = [...new Set(diffs.flatMap((dd) => trans(dd, "pass → fail").map((t) => String(t.testId))))];
  const oldest = String(((x.drift.states ?? []) as Rec[])[0]?.name ?? "");
  const h1c = diffs.find((dd) => dd.from === oldest && dd.to === "C-current");
  const failToPassOldest = h1c ? trans(h1c, "fail → pass").length : 0;
  const newUnprotected = diffs.flatMap((dd) => ((dd.inventory?.newResources ?? []) as Rec[]).filter((r) => r.unprotected === true).map((r) => String(r.resource)));

  // WP5: the author's statuses
  const cp4Status = new Map(((x.cp4.items ?? []) as Rec[]).map((i) => [String(i.key), String(i.status)]));
  const items = ((x.findings.items ?? []) as Rec[]).map((i) => ({
    id: String(i.id), key: String(i.key), part: String(i.part), tier: String(i.tier), testIds: (i.testIds ?? []) as string[],
    status: i.part === "limitation" ? "not_measured" : (cp4Status.get(String(i.key)) ?? "MISSING FROM THE CP4 REPLY"),
  }));
  const evClass = (ids: readonly string[]) => { const vs = [...new Set(ids.map((t) => String(byId.get(t)?.verdict)))]; return ids.length === 0 ? "none" : vs.length === 1 ? vs[0]! : `mixed(${vs.join("/")})`; };
  const openIds = items.filter((i) => i.status === "open").map((i) => i.id);

  // WP6
  const maps = (x.mapping?.mappings ?? []) as Rec[];
  const support = { evidenced: maps.filter((e) => e.support === "evidenced").length, partial: maps.filter((e) => e.support === "partial").length, notMapped: maps.filter((e) => e.support === "not_mapped").length };
  const wv = x.wp6Validation;
  const wvChecks = (wv?.checks ?? []) as Rec[];

  // prove-gates, from its rows
  const pgRows = (x.proveGates?.rows ?? []) as Rec[];
  const pg = {
    injected: pgRows.filter((r) => r.control !== true).length, caught: pgRows.filter((r) => r.control !== true && r.caught === true).length,
    controls: pgRows.filter((r) => r.control === true).length, held: pgRows.filter((r) => r.control === true && r.caught === true).length,
    restored: pgRows.length > 0 && pgRows.every((r) => r.restored === true),
  };

  // 3. the assurance report states them -------------------------------------------------------
  {
    const bad: string[] = [];
    const R = d.report;
    const tested = lineWith(R, /^\| Tests executed \(WP3\) \|/);
    const m = tested ? /(\d+) Test IDs[^*]*\*\*(\d+) effective, (\d+) deficient, (\d+) gap, (\d+) characterized, (\d+) not measured\*\*/.exec(tested) : null;
    if (!m) bad.push("the posture table has no parsable WP3 line");
    else if (!sameCounts({ total: numIn(m[1]), effective: numIn(m[2]), deficient: numIn(m[3]), gap: numIn(m[4]), characterized: numIn(m[5]), not_measured: numIn(m[6]) }, raw)) bad.push(`posture table says ${m.slice(1).join("/")}; the records give ${showCounts(raw)}`);
    const fam = table(R, /^\|\s*Family\s*\|\s*Records\s*\|/);
    if (fam.length !== FAMILY_CODES.length + 1) bad.push(`the family table has ${fam.length} rows`);
    for (const row of fam) {
      const code = row[0]!.startsWith("**Total") ? "total" : row[0]!.split(" ")[0]!;
      const want = code === "total" ? raw : byFam.get(code);
      if (!want) { bad.push(`family table row "${row[0]}" is no family`); continue; }
      const got = { total: numIn(row[1]), effective: numIn(row[2]), deficient: numIn(row[3]), gap: numIn(row[4]), characterized: numIn(row[5]), not_measured: numIn(row[6]) };
      if (!sameCounts(got, want)) bad.push(`family ${code}: report ${showCounts(got)}; records ${showCounts(want)}`);
    }
    for (const row of table(R, /^\|\s*Test depth/)) {
      const t = /^suite/.test(row[0]!) ? "suite" : row[0]!;
      const want = byDepth.get(t);
      const got = { total: numIn(row[1]), effective: numIn(row[2]), deficient: numIn(row[3]), gap: numIn(row[4]), characterized: numIn(row[5]), not_measured: numIn(row[6]) };
      if (!want || !sameCounts(got, want)) bad.push(`depth ${t}: report ${showCounts(got)}`);
    }
    const run = /Official run `([^`]+)`: (\d+) records/.exec(R);
    if (!run || run[1] !== off.wp3 || numIn(run[2]) !== recs.length) bad.push(`the results section cites ${run?.[1] ?? "no run"} with ${run?.[2] ?? "?"} records`);
    const val = lineWith(R, /^\| Independent validation of the results \|/);
    const vm = val ? /(\d+) of (\d+) checks passed/.exec(val) : null;
    const vc = ((x.wp3Validation.checks ?? []) as Rec[]);
    if (!vm || numIn(vm[1]) !== vc.filter((c) => c.passed === true).length || numIn(vm[2]) !== vc.length) bad.push(`validation line says ${vm?.[1]}/${vm?.[2]}`);
    add("the assurance report states the WP3 counts re-derived from the raw records (headline, families, depth, run, validation)", bad, `${fam.length} family rows and the headline agree`);
  }

  // 4. the plain-language summary states them -----------------------------------------------
  {
    const bad: string[] = [];
    const S = d.summary;
    const want: [RegExp, number[], string][] = [
      [/made (\d+) attempts/, [raw.total], "attempts"],
      [/in (\d+) of (\d+) deliberate tests/, [wp1.detected, wp1.scenarios], "WP1"],
      [/\*\*(\d+) of the (\d+) attempts behaved exactly as intended/, [raw.effective, raw.total], "effective"],
      [/\*\*(\d+) attempts showed a rule not holding/, [raw.deficient], "deficient"],
      [/\*\*(\d+) checks found no complete record/, [raw.gap], "gap"],
      [/\*\*(\d+) results are facts/, [raw.characterized], "characterized"],
      [/\*\*(\d+) could not be measured\*\*/, [raw.not_measured], "not measured"],
      [/Those (\d+) are not counted as passes/, [raw.not_measured], "not measured, restated"],
      [/these are the (\d+) effective, (\d+) deficient, (\d+) gap, (\d+) characterized and (\d+) not measured results of run (\S+?)\.?\*/, [raw.effective, raw.deficient, raw.gap, raw.characterized, raw.not_measured], "cross-reference"],
    ];
    for (const [re, nums, what] of want) {
      const m = re.exec(S);
      if (!m) { bad.push(`no ${what} statement`); continue; }
      const got = nums.map((_, i) => numIn(m[i + 1]));
      if (got.some((g, i) => g !== nums[i])) bad.push(`${what}: says ${got.join("/")}, the evidence gives ${nums.join("/")}`);
    }
    const xr = /results of run (\S+?)\.?\*/.exec(S);
    if (xr?.[1]?.replace(/\.$/, "") !== off.wp3) bad.push(`the summary cites run ${xr?.[1]} as the result`);
    // the deficient split, by the author's statuses
    const defOpen = items.filter((i) => evClass(i.testIds) === "deficient" && i.status === "open").reduce((n, i) => n + i.testIds.length, 0);
    const defAccepted = items.filter((i) => evClass(i.testIds) === "deficient" && i.status === "accepted_design_intent").reduce((n, i) => n + i.testIds.length, 0);
    const openPhrase = /showed a rule not holding\.\*\* (One is still open|(\d+) are still open)/.exec(S);
    const openSaid = openPhrase ? (openPhrase[1] === "One is still open" ? 1 : numIn(openPhrase[2])) : -1;
    if (openSaid !== defOpen) bad.push(`says ${openSaid} deficient still open; the author's statuses give ${defOpen}`);
    const other = /The other (\d+) show/.exec(S);
    if (!other || numIn(other[1]) !== defAccepted) bad.push(`says ${other?.[1]} accepted; the author's statuses give ${defAccepted}`);
    const absentItem = items.find((i) => i.key === "audit-trail-absent"), partialItem = items.find((i) => i.key === "audit-trail-partial");
    const gapSplit = /none at all for (\d+) kinds[^,]*, and only part of one for (\d+) more/.exec(S);
    if (!gapSplit || numIn(gapSplit[1]) !== (absentItem?.testIds.length ?? -1) || numIn(gapSplit[2]) !== (partialItem?.testIds.length ?? -1)) bad.push(`the no-record split says ${gapSplit?.[1]}/${gapSplit?.[2]}`);
    const scope = ((x.auditScope.resources ?? []) as Rec[]);
    const req = /Under the recorded scope rule, (\d+) of the (\d+)/.exec(S);
    if (!req || numIn(req[1]) !== scope.filter((r) => r.disposition === "trail_required").length || numIn(req[2]) !== scope.length) bad.push(`the trail scope says ${req?.[1]} of ${req?.[2]}; the scope file gives ${scope.filter((r) => r.disposition === "trail_required").length} of ${scope.length}`);
    // the claims behind "every direct attempt was stopped" and "the balance stayed correct"
    for (const c of ["F1", "F2", "F3", "F4", "F6", "F8"]) { const fc = byFam.get(c)!; if (fc.deficient || fc.gap) bad.push(`"every direct attempt was stopped" but ${c} has ${fc.deficient} deficient / ${fc.gap} gap`); }
    const f9 = byFam.get("F9")!;
    if (f9.deficient || f9.gap) bad.push(`"the chip balance stayed correct" but F9 has ${f9.deficient} deficient`);
    add("the plain-language summary states the numbers the evidence gives, and its plain claims hold", bad, "every number and claim agrees");
  }

  // 5. the dashboard's embedded data ---------------------------------------------------------
  {
    const bad: string[] = [];
    if (!dash) bad.push("no parsable embedded data");
    else {
      if (!sameCounts(dash.totals, raw)) bad.push(`totals ${showCounts(dash.totals ?? {})}`);
      for (const f of (dash.byFamily ?? []) as Rec[]) if (!byFam.has(String(f.code)) || !sameCounts(f.counts, byFam.get(String(f.code))!)) bad.push(`family ${f.code}`);
      if (((dash.byFamily ?? []) as Rec[]).length !== FAMILY_CODES.length) bad.push("family list incomplete");
      for (const t of (dash.byTier ?? []) as Rec[]) if (!byDepth.has(String(t.tier)) || !sameCounts(t.counts, byDepth.get(String(t.tier))!)) bad.push(`depth ${t.tier}`);
      const drec = (dash.records ?? {}) as Record<string, Rec>;
      if (Object.keys(drec).length !== recs.length) bad.push(`${Object.keys(drec).length} records embedded, ${recs.length} in the run`);
      for (const r of recs) {
        const e = drec[String(r.testId)];
        if (!e) { bad.push(`${r.testId} missing`); continue; }
        if (e.v !== r.verdict) bad.push(`${r.testId}: verdict ${e.v}, recorded ${r.verdict}`);
        if (e.i !== String(r.identity?.label ?? r.identityPlanned)) bad.push(`${r.testId}: identity ${e.i}`);
        if (e.ts !== String(r.timestampUtc)) bad.push(`${r.testId}: timestamp ${e.ts}`);
        if (e.s !== String(r.executed?.statement ?? r.operationPlanned ?? "")) bad.push(`${r.testId}: statement differs`);
        if (e.x !== String(r.actualSummary ?? "")) bad.push(`${r.testId}: outcome differs`);
      }
      const m = dash.meta ?? {};
      if (m.wp3 !== off.wp3 || m.wp4 !== off.wp4 || m.plan !== off.plan || m.cp3 !== off.frozenCp3) bad.push("run ids in meta are not the official runs");
      const vc = ((x.wp3Validation.checks ?? []) as Rec[]);
      if (m.validation !== `${vc.filter((c) => c.passed === true).length} of ${vc.length}`) bad.push(`validation ${m.validation}`);
      if (JSON.stringify(m.openFindings) !== JSON.stringify(openIds)) bad.push(`open findings ${JSON.stringify(m.openFindings)}; the author's statuses give ${JSON.stringify(openIds)}`);
      for (const f of (dash.findings ?? []) as Rec[]) {
        const it = items.find((i) => i.id === f.id);
        if (!it) { bad.push(`finding ${f.id} is not a WP5 item`); continue; }
        if (f.status !== it.status) bad.push(`${f.id}: status ${f.status}; the author's is ${it.status}`);
        if (JSON.stringify(f.tests) !== JSON.stringify(it.testIds)) bad.push(`${f.id}: Test IDs differ`);
        if (f.evidence !== evClass(it.testIds)) bad.push(`${f.id}: evidence ${f.evidence}; the records give ${evClass(it.testIds)}`);
      }
      if (((dash.findings ?? []) as Rec[]).length !== items.length) bad.push("findings list incomplete");
      const dd = dash.drift ?? {};
      if (Number(dd.passToFail) !== passToFailIds.length) bad.push(`pass → fail ${dd.passToFail}; the transitions give ${passToFailIds.length}`);
      for (const df of (dd.diffs ?? []) as Rec[]) {
        const src = diffs.find((z) => z.from === df.from && z.to === df.to);
        if (!src) { bad.push(`drift ${df.from} → ${df.to} not in the drift file`); continue; }
        if (src.results && (Number(df.passToFail) !== trans(src, "pass → fail").length || Number(df.failToPass) !== trans(src, "fail → pass").length)) bad.push(`drift ${df.from} → ${df.to}: transitions differ`);
      }
      const cov = dash.coverage ?? {};
      if (Number(cov.resources) !== wp0.resources || Number(cov.withRowControl) !== wp0.rowControl || Number(cov.controls) !== wp0.controls) bad.push("coverage totals");
      const obs = (k: string) => j(((inv.observations ?? []) as Rec[]).filter((o) => o.kind === k).map((o) => String(o.resource)).sort());
      const wantPatterns = [j(resources.filter((r) => r.kind !== "view" && r.kind !== "materialized_view" && r.rlsEnabled === false).map((r) => String(r.resource))), obs("deny_by_default"), obs("anon_reachable"), obs("anon_granted_but_no_policy_admits_it")];
      const gotPatterns = ((cov.patterns ?? []) as Rec[]).map((pp) => j([...((pp.resources ?? []) as string[])].sort()));
      if (j(gotPatterns) !== j(wantPatterns)) bad.push("the brief's no-control patterns are not the frozen inventory's");
      if (Number(cov.notForced) !== ((inv.observations ?? []) as Rec[]).filter((o) => o.kind === "rls_enabled_not_forced").length || Number(cov.tables) !== wp0.tables) bad.push("enabled-not-forced count");
      if (Number(cov.named) + Number(cov.resourceOnly) + Number(cov.unexercised) !== wp0.controls) bad.push("coverage parts do not add up to the inventory");
      const drillNamed = new Set<string>();
      for (const r of (dash.resources ?? []) as Rec[]) for (const c of (r.controls ?? []) as Rec[]) {
        if (((c.tests ?? []) as string[]).length) drillNamed.add(String(c.id));
        for (const t of (c.tests ?? []) as string[]) if (!byId.has(t)) bad.push(`drill-down cites ${t}, not in the run`);
      }
      const fnNamed = ((dash.functions ?? []) as Rec[]).filter((fn) => ((fn.tests ?? []) as string[]).length);
      for (const fn of (dash.functions ?? []) as Rec[]) for (const t of (fn.tests ?? []) as string[]) if (!byId.has(t)) bad.push(`drill-down cites ${t}, not in the run`);
      const fnControlsNamed = fnNamed.reduce((n, fn) => n + ((fn.controlIds ?? fn.controls ?? []) as unknown[]).length, 0);
      if (drillNamed.size + fnControlsNamed !== Number(cov.named)) bad.push(`coverage says ${cov.named} named; the drill-down names ${drillNamed.size} resource controls and ${fnControlsNamed} function controls`);
      for (const e of (dash.framework ?? []) as Rec[]) {
        const src = maps.find((mm) => String(e.id).endsWith(String(mm.id)) && (mm.framework === "21 CFR Part 11") === String(e.id).startsWith("21 CFR"));
        if (!src) { bad.push(`framework ${e.id} not in the mapping`); continue; }
        const want = src.support === "evidenced" ? /^evidenced \(tested paths only\)$/ : src.support === "partial" ? /^partial$/ : /^not mapped$/;
        if (!want.test(String(e.support))) bad.push(`framework ${e.id}: support "${e.support}"; the mapping says ${src.support}`);
      }
      if (x.proveGates && m.proveGates && (m.proveGates.caught !== pg.caught || m.proveGates.injected !== pg.injected || m.proveGates.held !== pg.held || m.proveGates.controls !== pg.controls)) bad.push("prove-gates counts differ from its rows");
      if (m.wp1 && (m.wp1.detected !== wp1.detected || m.wp1.scenarios !== wp1.scenarios || m.wp1.overPrivilegedDiscriminated !== wp1.discriminated)) bad.push("WP1 counts differ");
    }
    add("the dashboard's embedded data is the evidence: counts, every record, statuses, drift, coverage, framework support", bad, dash ? `${Object.keys(dash.records ?? {}).length} records and every summary agree` : "");
  }

  // 6. the README's generated sections state them ---------------------------------------------
  {
    const bad: string[] = [];
    const res = readmeBlock(d.readme, "results") ?? "";
    const vt = table(res, /^\|\s*Verdict\s*\|\s*Tests\s*\|/);
    const vmap = new Map(vt.map((r) => [norm(r[0]!), numIn(r[1])]));
    for (const k of V) if (vmap.get(norm(k)) !== raw[k]) bad.push(`verdict ${k}: README ${vmap.get(norm(k))}, records ${raw[k]}`);
    const ft = table(res, /^\|\s*Family\s*\|\s*Tests\s*\|/);
    if (ft.length !== FAMILY_CODES.length) bad.push(`family table has ${ft.length} rows`);
    for (const row of ft) { const c = byFam.get(row[0]!.split(" ")[0]!); if (!c || numIn(row[1]) !== c.total || numIn(row[2]) !== c.effective) bad.push(`family ${row[0]}: ${row[1]}/${row[2]}`); }
    const it = table(res, /^\|\s*Inventory \(WP0\)/);
    const inv2 = new Map(it.map((r) => [r[0]!.replace(/\(\d+ of which can refuse a write\)/, "").replace(/[*`]/g, "").trim(), r[1]!]));
    const expectInv: [string, string][] = [
      ["Resources in scope", `${wp0.resources}`], ["(resource, control) pairs", `${wp0.controls}`], ["Row-level security policies", `${wp0.policies}`],
      ["SECURITY DEFINER functions", `${wp0.definers} (${wp0.definersClient} callable by a client role)`], ["Triggers", `${wp0.triggers}`],
      ["Column-level grants", `${wp0.columnGrants}`], ["Tables with row-level security enabled", `${wp0.rlsEnabled} of ${wp0.tables}`],
      ["Tables with row-level security forced", `${wp0.rlsForced} of ${wp0.tables}`], ["Resources with a row-level control (WP4's definition)", `${wp0.rowControl} of ${wp0.resources}`],
    ];
    for (const [k, v] of expectInv) if ((inv2.get(k) ?? "").replace(/[*`]/g, "") !== v) bad.push(`inventory "${k}": README "${inv2.get(k)}", evidence "${v}"`);
    const trig = /Triggers \((\d+) of which can refuse a write\)/.exec(res);
    if (!trig || numIn(trig[1]) !== wp0.triggersRefuse) bad.push(`refusing triggers: ${trig?.[1]}`);
    const pol = /\((\d+) positive, (\d+) negative, (\d+) characterization\)/.exec(res);
    if (!pol || numIn(pol[1]) !== (byPol.positive ?? 0) || numIn(pol[2]) !== (byPol.negative ?? 0) || numIn(pol[3]) !== (byPol.characterization ?? 0)) bad.push("polarity split");
    const findT = table(res, /^\|\s*#\s*\|\s*Item\s*\|\s*Tier\s*\|\s*Evidence\s*\|\s*Recorded status\s*\|/);
    if (findT.length !== items.length) bad.push(`findings table has ${findT.length} rows, WP5 has ${items.length}`);
    for (const row of findT) {
      const i = items.find((z) => z.id === row[0]);
      if (!i) { bad.push(`README finding ${row[0]} is not a WP5 item`); continue; }
      if (norm(row[4]!) !== norm(i.status)) bad.push(`${i.id}: README status "${row[4]}", the author's "${i.status}"`);
      const cls = evClass(i.testIds);
      const want = cls === "none" ? "wp0 observation" : norm(`${i.testIds.length} ${cls}`);
      if (norm(row[3]!) !== want) bad.push(`${i.id}: README evidence "${row[3]}", the records "${want}"`);
    }
    const ev = /\*\*Evidence:\*\* WP3 run `([^`]+)` \(validated (\d+)\/(\d+)\) · WP4 run `([^`]+)` · frozen CP1\/CP3 run `([^`]+)`/.exec(res);
    if (!ev || ev[1] !== off.wp3 || ev[4] !== off.wp4 || ev[5] !== off.frozenCp3) bad.push("the evidence line does not cite the official runs");
    const drift = /(\d+) went from pass to fail; (\d+) went from fail to pass/.exec(res);
    if (!drift || numIn(drift[1]) !== passToFailIds.length || numIn(drift[2]) !== failToPassOldest) bad.push(`drift line says ${drift?.[1]}/${drift?.[2]}; transitions give ${passToFailIds.length}/${failToPassOldest}`);
    for (const u of newUnprotected) if (!res.includes(u)) bad.push(`the caught unprotected table ${u} is not named`);
    const w6 = /(\d+) entries against [^:]*: (\d+) evidenced on tested paths only, (\d+) partial, (\d+) not mapped/.exec(res);
    if (x.mapping && (!w6 || numIn(w6[1]) !== maps.length || numIn(w6[2]) !== support.evidenced || numIn(w6[3]) !== support.partial || numIn(w6[4]) !== support.notMapped)) bad.push(`WP6 line says ${w6?.slice(1).join("/")}`);
    const st = readmeBlock(d.readme, "status") ?? "";
    const stRows = table(st, /^\|\s*Work package\s*\|\s*State\s*\|/);
    if (stRows.length !== 8) bad.push(`status table has ${stRows.length} rows`);
    const wp3Row = stRows.find((r) => /^WP3/.test(r[0]!));
    const w3 = wp3Row ? /official run `([^`]+)`: (\d+) Test IDs — (\d+) effective, (\d+) gap, (\d+) characterized, (\d+) deficient, (\d+) not measured/.exec(wp3Row[2]!) : null;
    if (!w3 || w3[1] !== off.wp3 || !sameCounts({ total: numIn(w3[2]), effective: numIn(w3[3]), gap: numIn(w3[4]), characterized: numIn(w3[5]), deficient: numIn(w3[6]), not_measured: numIn(w3[7]) }, raw)) bad.push("the status table's WP3 row");
    if (!/CP5 \*\*superseded by Amendment A2\*\*[^\n]*never as approved/.test(st) || /\bCP5\b[^;\n]{0,40}\bapproved by the author\b/.test(st)) bad.push("the status block does not record CP5 as superseded by Amendment A2, never approved");
    if (!/CP4 approved at review \d{4}-\d{2}-\d{2}/.test(st) !== !/^approved\b/.test(String(x.cp4.approval?.CP4 ?? ""))) bad.push("the status block's CP4 state is not the recorded approval");
    const claimsComplete = /^\*\*Status: recorded assessment complete\.\*\*/m.test(st);
    const conditions = [
      x.wp3Validation.passed === true, ((x.drift.states ?? []) as Rec[]).every((s) => Number(s.exit) === 0),
      /^approved\b/.test(String(x.cp4.approval?.CP4 ?? "")), wv?.passed === true, pg.injected > 0 && pg.caught === pg.injected && pg.held === pg.controls && pg.restored,
      wp1.detected === wp1.scenarios && wp1.scenarios > 0,
    ];
    if (claimsComplete && conditions.some((c) => !c)) bad.push(`the README says complete, but ${conditions.map((c, i) => (c ? null : ["validate-wp3", "WP4 exits", "CP4 approval", "validate-wp6", "prove-gates", "WP1"][i])).filter(Boolean).join(", ")} does not hold`);
    if (!claimsComplete && conditions.every(Boolean)) bad.push("every condition holds but the README does not say complete");
    add("the README's generated sections state the evidence: verdicts, families, inventory, findings and statuses, drift, WP6, project status", bad, `${vt.length + ft.length + it.length + findT.length + stRows.length} rows agree`);
  }

  // 7. WP0, WP1 and WP4 in the report ---------------------------------------------------------
  {
    const bad: string[] = [];
    const R = d.report;
    const invLine = lineWith(R, /^\| Controls inventoried from the live catalogs \|/) ?? "";
    const im = /(\d+) \(resource, control\) pairs; (\d+) policies; row-level security enabled on (\d+) of (\d+) tables, \*\*forced on (\d+)\*\*/.exec(invLine);
    if (!im || numIn(im[1]) !== wp0.controls || numIn(im[2]) !== wp0.policies || numIn(im[3]) !== wp0.rlsEnabled || numIn(im[4]) !== wp0.tables || numIn(im[5]) !== wp0.rlsForced) bad.push(`inventory line: ${im?.slice(1).join("/")}`);
    const resLine = lineWith(R, /^\| Resources in scope \(WP0\) \|/) ?? "";
    const rm = /(\d+); \*\*(\d+) of (\d+) have a row-level control\*\*/.exec(resLine);
    if (!rm || numIn(rm[1]) !== wp0.resources || numIn(rm[2]) !== wp0.rowControl) bad.push(`resources line: ${rm?.slice(1).join("/")}`);
    const kinds = table(R, /^\|\s*Control kind\s*\|\s*Count\s*\|/);
    for (const row of kinds) {
      if (row[0]!.includes("total")) { if (numIn(row[1]) !== wp0.controls) bad.push(`kind total ${row[1]}`); continue; }
      if (numIn(row[1]) !== kind(row[0]!).length) bad.push(`kind ${row[0]}: ${row[1]}, inventory ${kind(row[0]!).length}`);
    }
    const hs = lineWith(R, /^\| Harness self-checks \|/) ?? "";
    const hm = /WP1: (\d+) of (\d+) deliberately broken controls detected[^;]*told intact from broken in (\d+) of (\d+) checks/.exec(hs);
    if (!hm || numIn(hm[1]) !== wp1.detected || numIn(hm[2]) !== wp1.scenarios || numIn(hm[3]) !== wp1.discriminated || numIn(hm[4]) !== wp1.over) bad.push(`WP1 line: ${hm?.slice(1).join("/")}`);
    const dr = table(R, /^\|\s*Compared\s*\|\s*added\s*\|/);
    if (dr.length !== diffs.length) bad.push(`drift table has ${dr.length} rows; the drift file ${diffs.length}`);
    for (const row of dr) {
      const [from, to] = row[0]!.split(" → ");
      const src = diffs.find((z) => z.from === from && z.to === to);
      if (!src) { bad.push(`drift row ${row[0]}`); continue; }
      const c = src.inventory?.counts ?? {};
      const want = [c.added, c.removed, c.definitionChanged, c.attributesChanged, c.newUnprotectedResources, c.newlyExposed].map(Number);
      if (want.some((w, i) => numIn(row[i + 1]) !== w)) bad.push(`drift ${row[0]} inventory columns`);
      if (src.results && (numIn(row[7]) !== trans(src, "pass → fail").length || numIn(row[8]) !== trans(src, "fail → pass").length)) bad.push(`drift ${row[0]} result transitions`);
    }
    const post = lineWith(R, /^\| Drift \(WP4\) \|/) ?? "";
    const pm = /(\d+) schema states; (\d+) pass → fail; (\d+) fail → pass/.exec(post);
    if (!pm || numIn(pm[1]) !== ((x.drift.states ?? []) as Rec[]).length || numIn(pm[2]) !== passToFailIds.length || numIn(pm[3]) !== failToPassOldest) bad.push(`posture drift line: ${pm?.slice(1).join("/")}`);
    add("WP0, WP1 and WP4 numbers in the report are re-derived from the frozen inventory, the WP1 record and the drift transitions", bad, `inventory ${wp0.resources}/${wp0.controls}, WP1 ${wp1.detected}/${wp1.scenarios}, drift ${dr.length} comparisons`);
  }

  // 8. WP5: statuses, Test IDs and evidence classes -------------------------------------------
  {
    const bad: string[] = [];
    for (const i of items) {
      if (i.status === "MISSING FROM THE CP4 REPLY") bad.push(`${i.id} has no status in the author's reply`);
      for (const t of i.testIds) if (!byId.has(t)) bad.push(`${i.id} cites ${t}, not in the run`);
      if (/^mixed/.test(evClass(i.testIds))) bad.push(`${i.id}: its records have mixed verdicts ${evClass(i.testIds)}`);
    }
    const nonEffective = recs.filter((r) => r.verdict !== "effective").map((r) => String(r.testId));
    const owners = new Map<string, string[]>();
    for (const i of items) for (const t of i.testIds) owners.set(t, [...(owners.get(t) ?? []), i.id]);
    for (const t of nonEffective) if ((owners.get(t) ?? []).length !== 1) bad.push(`${t} (not effective) belongs to ${(owners.get(t) ?? []).length} items`);
    for (const e of (x.narratives.entries ?? []) as Rec[]) {
      if (e.provenance === "user_authored") bad.push(`narrative ${e.key} labelled user_authored — the reply records AI-assisted wording`);
      const reply = ((x.cp4.items ?? []) as Rec[]).find((z) => z.key === e.key);
      if (!reply || reply.narrative !== e.narrative || reply.status !== e.status) bad.push(`narrative ${e.key} is not the author's recorded reply, verbatim`);
    }
    if (!/user_reviewed_ai_draft/.test(String(x.cp4.provenance?.wording ?? ""))) bad.push("the CP4 reply's wording is not recorded as user_reviewed_ai_draft");
    const ft = table(d.report, /^\|\s*#\s*\|\s*Item\s*\|\s*Tier\s*\|\s*Evidence\s*\|\s*Test IDs\s*\|/);
    if (ft.length !== items.length) bad.push(`report findings table has ${ft.length} rows`);
    for (const row of ft) {
      const i = items.find((z) => z.id === row[0]);
      if (!i) { bad.push(`report finding ${row[0]}`); continue; }
      if (norm(row[5]!) !== norm(i.status)) bad.push(`${i.id}: report status "${row[5]}", the author's "${i.status}"`);
      if (numIn(row[4]) !== i.testIds.length) bad.push(`${i.id}: report ${row[4]} Test IDs, WP5 ${i.testIds.length}`);
      const cls = evClass(i.testIds);
      if (norm(row[3]!) !== (cls === "none" ? "wp0" : norm(cls))) bad.push(`${i.id}: report evidence "${row[3]}", records "${cls}"`);
      if (row[2] !== i.tier) bad.push(`${i.id}: tier ${row[2]} vs ${i.tier}`);
    }
    const posture = lineWith(d.report, /^\| Findings \(WP5, after CP4\) \|/) ?? "";
    const pm = /(\d+) findings \((\d+) open: ([^)]*)\), (\d+) informational items, (\d+) limitations — CP4 approved at review (\d{4}-\d{2}-\d{2})/.exec(posture);
    if (!pm || numIn(pm[1]) !== items.filter((i) => i.part === "finding").length || numIn(pm[2]) !== openIds.length || pm[3] !== openIds.join(", ") || numIn(pm[4]) !== items.filter((i) => i.part === "informational").length || numIn(pm[5]) !== items.filter((i) => i.part === "limitation").length) bad.push(`posture findings line: ${pm?.slice(1).join("/")}`);
    add("each finding's status is the author's recorded CP4 decision, and its Test IDs and evidence class are the records'", bad, `${items.length} items; ${openIds.length} open (${openIds.join(", ")}); every non-effective record in exactly one`);
  }

  // 9. WP6 ---------------------------------------------------------------------------------------
  {
    const bad: string[] = [];
    if (!x.mapping) bad.push("framework-mapping.json is missing");
    else {
      if (!/study/i.test(String(x.mapping.exercise)) || !/^ai_drafted\b/.test(String(x.mapping.provenance))) bad.push("the mapping is not labelled a study with AI-drafted rationale");
      if (x.mapping.evidence?.wp3Run !== off.wp3) bad.push(`the mapping was built from ${x.mapping.evidence?.wp3Run}`);
      if (!wv || wv.passed !== true || wvChecks.some((c) => c.passed !== true)) bad.push("validate-wp6 did not pass");
      for (const e of maps) if (e.support === "evidenced" && (String(e.key).startsWith("P11:") || e.subject === "attest")) bad.push(`${e.key} evidenced beyond its cap`);
      const fr = table(d.report, /^\|\s*Identifier\s*\|\s*Support\s*\|\s*Evidence\s*\|/);
      if (fr.length !== maps.length) bad.push(`the report's framework table has ${fr.length} rows; the mapping ${maps.length}`);
      for (const row of fr) {
        const src = maps.find((m) => row[0]!.split(" ").includes(String(m.id)));
        if (!src) { bad.push(`report framework row "${row[0]}"`); continue; }
        const s = row[1]!;
        if (src.support === "evidenced" ? !/^evidenced \(tested paths only\)/.test(s) : src.support === "partial" ? !/^partial/.test(s) : !/^not mapped/.test(s)) bad.push(`${src.id}: report support "${s}", mapping ${src.support}`);
        if (/^evidenced/.test(s) && src.support !== "evidenced") bad.push(`${src.id} overclaimed as evidenced`);
      }
      const post = lineWith(d.report, /^\| Framework mapping \(WP6, a study exercise\) \|/) ?? "";
      const pm = /(\d+) entries: (\d+) evidenced \(tested paths only\), (\d+) partial, (\d+) not mapped; `validate-wp6` (\d+) of (\d+); CP5 superseded by Amendment A2 \(not approved\)/.exec(post);
      if (!pm || numIn(pm[1]) !== maps.length || numIn(pm[2]) !== support.evidenced || numIn(pm[3]) !== support.partial || numIn(pm[4]) !== support.notMapped || numIn(pm[5]) !== wvChecks.filter((c) => c.passed === true).length || numIn(pm[6]) !== wvChecks.length) bad.push(`posture WP6 line: ${pm?.slice(1).join("/")}`);
    }
    add("the framework mapping is a validated study exercise, and every report states its support levels as the mapping does", bad, `${maps.length} entries: ${support.evidenced} evidenced (tested paths only), ${support.partial} partial, ${support.notMapped} not mapped; validate-wp6 ${wvChecks.filter((c) => c.passed === true).length}/${wvChecks.length}`);
  }

  // 10. prove-gates ------------------------------------------------------------------------------
  {
    const bad: string[] = [];
    if (!x.proveGates) bad.push("no prove-gates record");
    else {
      const s = x.proveGates.summary ?? {};
      if (s.injected !== pg.injected || s.caught !== pg.caught || s.controls !== pg.controls || s.held !== pg.held || s.restored !== pg.restored) bad.push(`the record's summary (${JSON.stringify(s)}) is not its rows' (${JSON.stringify(pg)})`);
      if (pg.caught !== pg.injected || pg.held !== pg.controls || !pg.restored || pg.injected === 0) bad.push(`the recorded run did not pass: ${pg.caught}/${pg.injected} caught, ${pg.held}/${pg.controls} held, restored ${pg.restored}`);
      const cited: [string, string][] = [
        ["report", lineWith(d.report, /^\| Harness self-checks \|/) ?? ""],
        ["README", (readmeBlock(d.readme, "results") ?? "").split("\n").find((l) => l.startsWith("**The harness, checked:**")) ?? ""],
      ];
      for (const [where, line] of cited) {
        const m = /(\d+) of (\d+) injected defects caught and (\d+) of (\d+) controls held/.exec(line);
        if (!m || numIn(m[1]) !== pg.caught || numIn(m[2]) !== pg.injected || numIn(m[3]) !== pg.held || numIn(m[4]) !== pg.controls) bad.push(`${where} cites ${m?.slice(1).join("/") ?? "no prove-gates count"}; the record's rows give ${pg.caught}/${pg.injected}/${pg.held}/${pg.controls}`);
      }
    }
    add("prove-gates: the recorded result is recounted from its rows, it passed, and every report cites it", bad, `${pg.caught}/${pg.injected} injected defects caught, ${pg.held}/${pg.controls} controls held, restored ${pg.restored}`);
    add(PROVE_GATES_CURRENCY_CHECK, x.proveGates && String(x.proveGates.harness?.sourcesSha256) === x.harnessNow ? [] : [`recorded for harness ${String(x.proveGates?.harness?.sourcesSha256 ?? "none").slice(0, 12)}, the harness is now ${x.harnessNow.slice(0, 12)} — run prove-gates`], `harness ${x.harnessNow.slice(0, 12)}`);
  }

  // 11. run identifiers ---------------------------------------------------------------------------
  {
    const bad: string[] = [];
    const notResults = new Map(((off.notResults ?? []) as Rec[]).map((n) => [String(n.runId), String(n.disposition)]));
    const known = new Set([off.wp3, off.plan, off.wp4, off.frozenCp3, ...notResults.keys(), ...((off.planningAndWorksheetRuns ?? []) as Rec[]).map((p) => String(p.runId))].map(String));
    const RUN = /\b\d{8}T\d{6}Z-(?:[0-9a-f]{12}|wp4)\b/g;
    for (const k of ["report", "summary", "readme", "dashboard"] as const) {
      const text = k === "dashboard" ? JSON.stringify(dash?.meta ?? {}) + dashboardText(d.dashboard) : d[k];
      for (const line of text.split("\n")) for (const m of line.matchAll(RUN)) {
        const id = m[0];
        if (!known.has(id)) bad.push(`${DOCS[k]} cites ${id}, which is no official, listed or planning run`);
        const disp = notResults.get(id);
        if (disp && (k !== "report" || !line.toLowerCase().includes(disp.toLowerCase().split(" ")[0]!))) bad.push(`${DOCS[k]} cites the ${disp} run ${id} outside its "not results" entry`);
      }
    }
    add("every run a report cites is official or listed as not a result, and only the official WP3 run is presented as the result", bad, `official WP3 ${off.wp3}; ${notResults.size} earlier runs cited only as not results`);
  }

  // 12. claims, provenance and state lints -------------------------------------------------------
  {
    const texts: [string, string][] = [
      [DOCS.report, d.report], [DOCS.summary, d.summary], [DOCS.readme, d.readme], [DOCS.dashboard, dashboardText(d.dashboard)],
      [DOCS.findings, d.findings], [DOCS.cp4, d.cp4], [DOCS.cp5, d.cp5], [DOCS.csa, d.csa], [DOCS.mappingMd, d.mappingMd],
    ];
    // The mapping quotes its framework texts verbatim (one `> ` line per statement); a quotation is not a claim.
    const quoted = new Set(maps.flatMap((e) => ((e.statement ?? []) as string[]).map((q) => `> ${q}`)));
    const unquoted = (t: string) => t.split("\n").filter((l) => !quoted.has(l)).join("\n");
    const claims = texts.flatMap(([w, t]) => claimsLint(w === DOCS.mappingMd ? unquoted(t) : t, w));
    add("no generated document claims compliance, validation, certification, independence or regulated status", claims, `${texts.length} documents clean`);
    const prov = texts.flatMap(([w, t]) => provenanceLint(t, w));
    add("no generated document claims remediation, closure or a fixed Arc21, calls CP5 approved, labels AI-worded text as the author's, or counts not measured as a pass", prov, `${texts.length} documents clean`);
    const current: [string, string][] = [[DOCS.report, d.report], [DOCS.summary, d.summary], [DOCS.readme, d.readme], [DOCS.dashboard, dashboardText(d.dashboard)]];
    const stale = current.flatMap(([w, t]) => staleLint(t, w));
    add("the current-state documents carry no stale project state (WP3 unrun, a checkpoint pending, a package unfinished)", stale, "clean");
    const prove: string[] = [];
    for (const [w, t] of texts) prove.push(...presentationIssues(t, w));
    if (!/original (?:review |wording )?provenance|original provenance/i.test(d.readme)) prove.push("README.md: no link between the current reading view and its original provenance record");
    if (!/CP5[^|\n]*superseded by Amendment A2/.test(d.readme) || !/superseded by Amendment A2/.test(d.cp5)) prove.push("CP5 is not recorded as superseded by Amendment A2");
    for (const [w, t] of [[DOCS.report, d.report], [DOCS.dashboard, d.dashboard], [DOCS.readme, d.readme]] as const) if (!/not an independent audit|The assessment is not independent|Not independent\./i.test(t)) prove.push(`${w}: does not state the assessment is not independent`);
    add("current reading views are neutral, retain the original provenance record and state the assessment is not independent", prove, "neutral presentation; original provenance retained");
  }

  // 13. the summary is plain and one page ----------------------------------------------------------
  {
    const bad: string[] = [];
    const body = d.summary.split("\n").filter((l) => !SUMMARY_EXEMPT.test(l)).join("\n");
    for (const re of SUMMARY_JARGON) { const m = re.exec(body); if (m) bad.push(`jargon "${m[0]}"`); }
    if (/```|\bselect \*|\bwhere\b.*=/i.test(body)) bad.push("contains code");
    const words = wordCount(d.summary);
    if (words > SUMMARY_WORD_LIMIT) bad.push(`${words} words, more than one page (${SUMMARY_WORD_LIMIT})`);
    const long = sentences(body).filter((s) => wordCount(s) > 50);
    if (long.length) bad.push(`${long.length} sentence(s) over 50 words: "${long[0]!.slice(0, 80)}…"`);
    for (const h of ["What was checked", "How", "What was found", "What it means", "What this is not"]) if (!new RegExp(`\\*\\*${h}\\.?\\*\\*`).test(d.summary)) bad.push(`no "${h}" section`);
    if (!/Nothing was fixed/.test(d.summary)) bad.push("does not say nothing was fixed");
    add(`the plain-language summary has no jargon, reads as plain sentences, and fits one page (≤ ${SUMMARY_WORD_LIMIT} words)`, bad, `${words} words, jargon-free outside the one cross-reference line`);
  }

  // 14. the README's hand-written text, its commands and its layout --------------------------------
  {
    const bad: string[] = [];
    for (const name of README_BLOCKS) {
      const s = blockStart(name), e = blockEnd(name);
      const n1 = d.readme.split(s).length - 1, n2 = d.readme.split(e).length - 1;
      if (n1 !== 1 || n2 !== 1 || d.readme.indexOf(e) < d.readme.indexOf(s)) bad.push(`the "${name}" section markers are missing, repeated or out of order`);
    }
    const hand = handWritten(d.readme).replace(/```[\s\S]*?```/g, " ");
    for (const s of sentences(hand)) for (const re of COUNT_PHRASES) if (re.test(s)) { bad.push(`hand-written text carries an evidence count: "${s.slice(0, 120)}"`); break; }
    add("the README's evidence numbers live only in its generated sections", bad, `${README_BLOCKS.length} sections, hand-written text count-free`);
    const cmdBad: string[] = [];
    const cases = new Set([...x.cliSource.matchAll(/case "([a-z0-9-]+)":/g)].map((m) => m[1]!));
    for (const c of DISPATCHED) if (!cases.has(c)) cmdBad.push(`documented "${c}" has no case in src/cli.ts`);
    for (const c of cases) if (!DISPATCHED.includes(c)) cmdBad.push(`src/cli.ts dispatches "${c}", which the README does not document`);
    const cmdBlock = readmeBlock(d.readme, "commands") ?? "";
    for (const c of COMMANDS) if (!cmdBlock.includes(`npm run attest ${c.usage ?? c.name}`)) cmdBad.push(`the README's command table lacks ${c.name}`);
    add("every command the README documents is one the CLI dispatches, and every command the CLI dispatches is documented", cmdBad, `${DISPATCHED.length} commands`);
    const layBad = LAYOUT.filter((l) => !l.scratch && !x.layoutExists[l.path]).map((l) => `${l.path} does not exist`);
    const layBlock = readmeBlock(d.readme, "layout") ?? "";
    for (const l of LAYOUT) if (!layBlock.includes(`\`${l.path}\``)) layBad.push(`the layout table lacks ${l.path}`);
    add("every path the README's layout lists exists", layBad, `${LAYOUT.filter((l) => !l.scratch).length} paths present`);
  }

  // 15. the dashboard opens from disk ---------------------------------------------------------------
  {
    const h = d.dashboard;
    const bad: string[] = [];
    if (/<script[^>]*\bsrc\s*=/i.test(h)) bad.push("loads an external script");
    if (/<link[^>]*\bhref\s*=/i.test(h)) bad.push("loads an external stylesheet or font");
    if (/@import|url\(\s*['"]?https?:/i.test(h)) bad.push("imports a remote resource from CSS");
    if (/\bfetch\s*\(|XMLHttpRequest|new\s+WebSocket|navigator\.sendBeacon/.test(h)) bad.push("makes a network request");
    if (!dash) bad.push("the embedded evidence data does not parse");
    for (const chip of ["nothing remediated, fixed or closed", "Not an independent audit", "Framework mapping is a study exercise"]) if (!h.includes(chip)) bad.push(`banner "${chip}" missing`);
    add("the dashboard is one self-contained file that opens from disk with no network, and carries its banners", bad, `${(h.length / 1024).toFixed(0)} KB, no external resource`);
  }

  // 16. byte-identical regeneration --------------------------------------------------------------------
  {
    const bad: string[] = [];
    if (!x.regenerated) bad.push("the outputs could not be regenerated");
    else {
      for (const [p, content] of x.regenerated) {
        const disk = x.onDisk.get(p);
        if (disk === undefined) bad.push(`${p} is missing`);
        else if (disk !== content) {
          const a = disk.split("\n"), b = content.split("\n");
          const at = a.findIndex((l, i) => l !== b[i]);
          bad.push(`${p} differs from what the evidence regenerates (first at line ${at + 1}: "${String(a[at] ?? "").slice(0, 60)}")`);
        }
      }
    }
    add("every generated file is byte-identical to what the evidence regenerates (nothing hand-edited, nothing stale)", bad, `${x.regenerated?.size ?? 0} files identical`);
  }

  void famTotal;
  return { passed: checks.every((c) => c.passed), checks };
}

// ---------------------------------------------------------------- loading

const json = async (p: string): Promise<Rec> => JSON.parse(await readFile(p, "utf8")) as Rec;
const exists = async (p: string) => { try { await stat(p); return true; } catch { return false; } };

export async function loadReportInputs(regenerated: ReadonlyMap<string, string> | null): Promise<ReportInputs> {
  const official = await json(join(ATTEST_ROOT, "rubric", "official-runs.json"));
  const run = (id: string, ...p: string[]) => join(RUNS_ROOT, id, ...p);
  const docs = {} as Record<DocKey, string>;
  for (const [k, rel] of Object.entries(DOCS) as [DocKey, string][]) docs[k] = await readFile(join(ATTEST_ROOT, rel), "utf8").catch(() => "");
  const onDisk = new Map<string, string>();
  if (regenerated) for (const p of regenerated.keys()) { const c = await readFile(join(ATTEST_ROOT, p), "utf8").catch(() => undefined); if (c !== undefined) onDisk.set(p, c); }
  const layoutExists: Record<string, boolean> = {};
  for (const l of LAYOUT) layoutExists[l.path] = await exists(join(ATTEST_ROOT, l.path));
  return {
    official,
    results: await json(run(String(official.wp3), "wp3-results.json")),
    wp3Validation: await json(run(String(official.wp3), "wp3-validation.json")),
    planTests: ((await json(run(String(official.plan), "wp3-matrix.json"))).plan as Rec).tests as Rec[],
    inventory: await json(run(String(official.frozenCp3), "inventory.json")),
    cp3: await json(run(String(official.frozenCp3), "cp3-tiers.json")),
    wp1: await json(run(String(official.frozenCp3), "wp1-validation.json")),
    drift: await json(run(String(official.wp4), "wp4", "drift.json")),
    cp4: await json(join(ATTEST_ROOT, "rubric", "cp4-author-response.json")),
    narratives: await json(join(ATTEST_ROOT, "rubric", "wp5-author-narratives.json")),
    intents: await json(join(ATTEST_ROOT, "rubric", "author-intents.json")),
    findings: await json(run(String(official.wp3), "wp5", "findings.json")),
    auditScope: await json(join(ATTEST_ROOT, "rubric", "wp5-audit-scope.json")),
    mapping: await json(join(ATTEST_ROOT, "framework-mapping.json")).catch(() => null),
    wp6Validation: await json(run(String(official.wp3), "wp6", "wp6-validation.json")).catch(() => null),
    proveGates: await json(join(ATTEST_ROOT, "evidence", "prove-gates", "prove-gates.json")).catch(() => null),
    harnessNow: (await readHarnessVersion()).sourcesSha256,
    cliSource: await readFile(join(ATTEST_ROOT, "src", "cli.ts"), "utf8"),
    runDirs: (await readdir(RUNS_ROOT)).sort(),
    layoutExists,
    docs,
    regenerated,
    onDisk,
  };
}

/** Validate what is on disk: regenerate every output in memory (writing nothing) and compare. */
export async function validateReports(): Promise<ReportsValidation & { official: string }> {
  const { buildReportOutputs, rel } = await import("./wp7-run.ts");
  const built = await buildReportOutputs("compare");
  const regenerated = built.problems.length ? null : new Map([...built.files].map(([p, c]) => [rel(p), c]));
  const inputs = await loadReportInputs(regenerated);
  const v = validateReportsLoaded(inputs);
  const checks = built.problems.length ? [{ name: "the generators ran", passed: false, detail: built.problems.slice(0, 6).join(" | ") }, ...v.checks] : v.checks;
  return { passed: checks.every((c) => c.passed), checks, official: String(inputs.official.wp3) };
}

/** Deterministic record of a validation (no timestamp), beside the official run's other checks. */
export async function writeReportsValidation(v: ReportsValidation, wp3RunId: string): Promise<string> {
  const dir = join(RUNS_ROOT, wp3RunId, "wp7");
  await mkdir(dir, { recursive: true });
  const path = join(dir, "reports-validation.json");
  await writeFile(path, JSON.stringify({ wp3RunId, passed: v.passed, checks: v.checks }, null, 2) + "\n");
  return path;
}
