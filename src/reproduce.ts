/**
 * Attest — reproduction: does a fresh rebuild give the frozen evidence back? (D3.61)
 *
 * `attest run` rebuilds the disposable database from Arc21's migrations and re-derives
 * everything that can be re-derived without re-running the 345 probes. Each comparison below
 * takes the frozen evidence the reports are built from and what the rebuild just produced, and
 * lists every difference; `run` fails if any list is non-empty. `run --confirm` re-executes the
 * assessment itself and compares it with the official run Test ID by Test ID
 * (`compareWp3Runs`, also `attest compare-wp3`).
 *
 * The comparisons are pure, so prove-gates hands each one a perturbed copy and requires it to
 * report the perturbation.
 */
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { RUNS_ROOT } from "./config.ts";
import { diffInventories } from "./wp4-drift.ts";
import { compareToApproved, frozenHash, type ApprovedManifest } from "./wp3-approved.ts";
import type { Inventory } from "./inventory.ts";
import type { Wp3Plan, PlannedTest } from "./wp3-plan.ts";

type Rec = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export interface Comparison {
  readonly name: string;
  readonly identical: boolean;
  readonly detail: string;
  readonly differences: readonly string[];
}

const result = (name: string, differences: readonly string[], ok: string): Comparison => ({
  name, identical: differences.length === 0, differences,
  detail: differences.length ? `${differences.length} difference(s): ${differences.slice(0, 8).join(" | ")}` : ok,
});
const j = (x: unknown) => JSON.stringify(x);

/** The control inventory: every drift class empty, the same counts, roles and anonymous reach. */
export function compareInventory(frozen: Rec, fresh: Rec): Comparison {
  const d = diffInventories(frozen as Inventory, fresh as Inventory);
  const out: string[] = [];
  for (const c of d.added) out.push(`control added: ${c.controlId}`);
  for (const c of d.removed) out.push(`control removed: ${c.controlId}`);
  for (const c of d.changed) out.push(`control ${c.change} changed: ${c.controlId} (${c.fields.join(", ")})`);
  for (const r of d.newResources) out.push(`resource added: ${r.resource}`);
  for (const r of d.removedResources) out.push(`resource removed: ${r}`);
  for (const r of d.newlyExposed) out.push(`newly exposed: ${r.resource}`);
  if (j(frozen.counts) !== j(fresh.counts)) out.push(`counts: ${j(frozen.counts)} → ${j(fresh.counts)}`);
  const roles = (inv: Rec) => j(((inv.roles ?? []) as Rec[]).map((r) => [r.role_name, r.bypasses_rls, r.is_superuser ?? r.superuser ?? null]).sort());
  if (roles(frozen) !== roles(fresh)) out.push("roles or their attributes differ");
  const reach = (inv: Rec) => j(((inv.anonymousReach ?? []) as Rec[]).map((a) => j(a)).sort());
  if (reach(frozen) !== reach(fresh)) out.push("what the anonymous role can reach differs");
  return result("the control inventory (WP0) equals the frozen CP1 inventory", out, `${fresh.counts?.resources} resources, ${fresh.counts?.controls} controls — identical in every drift class, count, role and anonymous reach`);
}

/** The per-resource facts the rubric reads: every field the frozen file recorded, unchanged. */
export function compareRiskInputs(frozen: Rec, fresh: Rec): Comparison {
  const out: string[] = [];
  const now = new Map(((fresh.resources ?? []) as Rec[]).map((r) => [String(r.resource), r]));
  const was = (frozen.resources ?? []) as Rec[];
  for (const r of was) {
    const n = now.get(String(r.resource));
    if (!n) { out.push(`${r.resource} missing`); continue; }
    for (const k of Object.keys(r)) if (j(r[k]) !== j(n[k])) out.push(`${r.resource}.${k}`);
  }
  for (const k of now.keys()) if (!was.some((r) => r.resource === k)) out.push(`${k} is new`);
  return result("the risk inputs (WP2 facts) equal the frozen ones", out, `${was.length} resources, every recorded field identical`);
}

/** The tiers the frozen rubric computes: the same tier, impact, exposure and test count per resource, and the same totals. */
export function compareTiers(frozen: Rec, fresh: Rec): Comparison {
  const out: string[] = [];
  const now = new Map(((fresh.scored ?? []) as Rec[]).map((s) => [String(s.resource), s]));
  for (const s of (frozen.scored ?? []) as Rec[]) {
    const n = now.get(String(s.resource));
    if (!n) { out.push(`${s.resource} unrated`); continue; }
    for (const k of ["tier", "impact", "impactRule", "scoredExposure", "tests", "branches", "boundaryCases"]) if (j(s[k]) !== j(n[k])) out.push(`${s.resource}.${k}: ${j(s[k])} → ${j(n[k])}`);
  }
  if (now.size !== ((frozen.scored ?? []) as Rec[]).length) out.push(`${now.size} resources rated, frozen ${((frozen.scored ?? []) as Rec[]).length}`);
  for (const k of ["totalTestsPrimary", "totalTestsAlternative", "distribution"]) if (j(frozen[k]) !== j(fresh[k])) out.push(`${k}: ${j(frozen[k])} → ${j(fresh[k])}`);
  if (((fresh.invariants ?? []) as Rec[]).some((i) => i.passed !== true)) out.push("a CP3 invariant fails");
  return result("the risk tiers (WP2) equal the frozen CP3 tiers", out, `${now.size} resources, the same tier, impact, exposure and test count each; totals identical`);
}

/** WP1: the same scenarios, each detected and restored, the over-privileged connections blind exactly as before. */
export function compareWp1(frozen: Rec, fresh: Rec): Comparison {
  const out: string[] = [];
  const now = new Map(((fresh.scenarios ?? []) as Rec[]).map((s) => [String(s.id), s]));
  for (const s of (frozen.scenarios ?? []) as Rec[]) {
    const n = now.get(String(s.id));
    if (!n) { out.push(`scenario ${s.id} missing`); continue; }
    for (const k of ["family", "controlId", "detected", "restored"]) if (j(s[k]) !== j(n[k])) out.push(`${s.id}.${k}: ${j(s[k])} → ${j(n[k])}`);
    const op = (x: Rec) => j(((x.overPrivileged ?? []) as Rec[]).map((o) => [o.identityLabel, o.intact, o.broken, o.discriminates]));
    if (op(s) !== op(n)) out.push(`${s.id}: the over-privileged connections answered differently`);
  }
  if (now.size !== ((frozen.scenarios ?? []) as Rec[]).length) out.push(`${now.size} scenarios, frozen ${((frozen.scenarios ?? []) as Rec[]).length}`);
  const steps = (x: Rec) => j(((x.forceRls?.steps ?? []) as Rec[]).map((s) => [s.state, s.outcome]));
  if (steps(frozen) !== steps(fresh)) out.push("the FORCE ROW LEVEL SECURITY demonstration answered differently");
  if (fresh.allDetected !== true || fresh.allRestored !== true || fresh.inventoryUnchanged !== true) out.push("a break went undetected, a control was not restored, or the inventory moved");
  if (((fresh.harnessErrors ?? []) as unknown[]).length) out.push(`${(fresh.harnessErrors as unknown[]).length} harness error(s)`);
  return result("the harness validation (WP1) reproduces the frozen one", out, `${now.size} scenarios detected and restored; the over-privileged connections blind as before`);
}

/** WP3's plan: the approved manifest's contract, and every frozen field of the plan the official run executed. */
export function comparePlan(fresh: Wp3Plan, officialPlanTests: readonly Rec[], manifest: ApprovedManifest, semanticIssues: readonly unknown[]): Comparison {
  const out: string[] = [];
  const a = compareToApproved(fresh, manifest);
  if (!a.identical) out.push(`differs from the approved matrix: ${[...a.missing.map((x) => `missing ${x}`), ...a.extra.map((x) => `extra ${x}`), ...a.frozenDrift.map((x) => `frozen fields of ${x}`), ...a.identityDrift, ...a.fixtureDrift.map((x) => `fixture of ${x}`), ...(a.orderChanged ? ["order"] : [])].slice(0, 6).join(", ")}`);
  const off = new Map(officialPlanTests.map((t) => [String(t.testId), t]));
  if (fresh.tests.length !== officialPlanTests.length) out.push(`${fresh.tests.length} Test IDs; the official run's plan had ${officialPlanTests.length}`);
  fresh.tests.forEach((t, i) => {
    const o = off.get(t.testId);
    if (!o) { out.push(`${t.testId} is not in the official run's plan`); return; }
    if (String(officialPlanTests[i]?.testId) !== t.testId) out.push(`${t.testId} is out of order`);
    if (frozenHash(t) !== frozenHash(o as PlannedTest)) out.push(`${t.testId}: a frozen field differs from the plan the official run executed`);
    if (t.identity !== o.identity) out.push(`${t.testId}: identity`);
  });
  if (semanticIssues.length) out.push(`${semanticIssues.length} semantic validation issue(s)`);
  return result("the WP3 plan equals the approved matrix and the plan the official run executed", out, `${fresh.tests.length} Test IDs, the approved manifest's contract holds, every frozen field identical`);
}

/** The intent store: every sentence adopted, none labelled the author's own, and each one the official run recorded. */
export function compareIntentStore(store: Rec, officialRecords: readonly Rec[]): Comparison {
  const out: string[] = [];
  const intents = (store.intents ?? []) as Rec[];
  const byId = new Map(intents.map((e) => [String(e.testId), e]));
  const notAdopted = intents.filter((e) => e.provenance === "ai_draft" || e.reviewStatus !== "approved");
  if (notAdopted.length) out.push(`${notAdopted.length} sentence(s) not adopted`);
  const authored = intents.filter((e) => e.provenance === "user_authored");
  if (authored.length) out.push(`${authored.length} labelled user_authored, but Gate A adopted none as the author's own writing`);
  for (const r of officialRecords) {
    if (!r.authorIntent) continue;
    const e = byId.get(String(r.testId));
    if (!e) out.push(`${r.testId}: no store entry`);
    else if (e.intent !== r.authorIntent || e.provenance !== r.intentProvenance) out.push(`${r.testId}: the store no longer holds the sentence the official run recorded`);
  }
  const withIntent = officialRecords.filter((r) => r.authorIntent).length;
  if (withIntent !== intents.length) out.push(`${intents.length} store entries; the official run recorded ${withIntent} intents`);
  return result("the AUTHOR INTENT store holds exactly the adopted sentences the official run recorded", out, `${intents.length} sentences, all adopted, each the one the official run recorded`);
}

/** Two WP3 runs, Test ID by Test ID: the same probes in the same order, the same verdict, observation, outcome and identity. */
export function compareWp3Runs(official: readonly Rec[], candidate: readonly Rec[]): Comparison & { readonly byField: Readonly<Record<string, number>> } {
  const out: string[] = [];
  const byField: Record<string, number> = { missing: 0, extra: 0, order: 0, verdict: 0, observation: 0, actualSummary: 0, identity: 0 };
  const cand = new Map(candidate.map((r) => [String(r.testId), r]));
  const offIds = new Set(official.map((r) => String(r.testId)));
  official.forEach((o, i) => {
    const c = cand.get(String(o.testId));
    if (!c) { byField.missing!++; out.push(`${o.testId} missing`); return; }
    if (String(candidate[i]?.testId) !== String(o.testId)) byField.order!++;
    if (o.verdict !== c.verdict) { byField.verdict!++; out.push(`${o.testId}: verdict ${o.verdict} → ${c.verdict}`); }
    if (o.observation !== c.observation) { byField.observation!++; out.push(`${o.testId}: observation ${o.observation} → ${c.observation}`); }
    if (String(o.actualSummary) !== String(c.actualSummary)) { byField.actualSummary!++; out.push(`${o.testId}: outcome "${o.actualSummary}" → "${c.actualSummary}"`); }
    const id = (r: Rec) => (r.identity ? j([r.identity.label, r.identity.currentUser, r.identity.authUid ?? null, r.identity.bypassesRls]) : "none");
    if (id(o) !== id(c)) { byField.identity!++; out.push(`${o.testId}: identity ${id(o)} → ${id(c)}`); }
  });
  for (const c of candidate) if (!offIds.has(String(c.testId))) { byField.extra!++; out.push(`${c.testId} is not in the official run`); }
  if (byField.order) out.push(`${byField.order} Test ID(s) out of order`);
  return { ...result("the candidate WP3 run reproduces the official run Test ID by Test ID", out, `${official.length} Test IDs: every verdict, observation, recorded outcome and identity identical`), byField };
}

export async function loadRunRecords(runId: string): Promise<Rec[]> {
  return ((JSON.parse(await readFile(join(RUNS_ROOT, runId, "wp3-results.json"), "utf8")) as Rec).records ?? []) as Rec[];
}

/** Written beside a reproduction's other evidence; no timestamp beyond the run id itself. */
export async function writeReproduction(runDir: string, against: Rec, comparisons: readonly Comparison[]): Promise<void> {
  const passed = comparisons.every((c) => c.identical);
  await writeFile(join(runDir, "reproduction.json"), JSON.stringify({
    WARNING: "A reproduction check, not a result: what a fresh rebuild re-derived, compared with the frozen evidence the reports are built from. The official runs are the author's selection (rubric/official-runs.json); nothing here replaces them.",
    against, passed, comparisons,
  }, null, 2) + "\n");
  const md = [
    "# Reproduction check",
    "",
    "> Not a result. What a fresh rebuild re-derived, compared with the frozen evidence the reports are built from (`rubric/official-runs.json`).",
    "",
    `Against: ${Object.entries(against).map(([k, v]) => `${k} \`${v}\``).join(" · ")}`,
    "",
    "| Comparison | Identical | Detail |",
    "|---|:---:|---|",
    ...comparisons.map((c) => `| ${c.name} | ${c.identical ? "yes" : "**NO**"} | ${c.detail.replace(/\|/g, "\\|")} |`),
    "",
    `**${passed ? "REPRODUCED" : "NOT REPRODUCED"}** — ${comparisons.filter((c) => c.identical).length} of ${comparisons.length} comparisons identical.`,
    "",
  ].join("\n");
  await writeFile(join(runDir, "reproduction.md"), md);
}
