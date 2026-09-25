/**
 * Attest — independent validation of a WP3 results file (Phase 4).
 *
 * The executor wrote `wp3-results.json` and its own totals. This module does not
 * trust either. It reads only raw inputs — the results file, the frozen
 * manifest, the planning run's matrix, the intent store and the contradiction
 * registry — and re-derives everything it reports:
 *
 *   completeness   exactly the approved Test IDs, once each, in the approved order
 *   binding        schema, Arc21 commit and fingerprint, harness hash, run id
 *   plan           every record's planned fields equal the planning run's row
 *   intent         every negative carries the store's sentence and provenance;
 *                  nothing else carries one
 *   identity       the session identity read back is the one the row names
 *   judgement      the observation recomputed from the raw claim statuses,
 *                  premises and contradiction (the judge's precedence, written
 *                  again here), and the verdict recomputed from the observation
 *   consistency    an effective verdict has every claim met; a registered
 *                  contradiction appears only on registered Test IDs
 *   isolation      after every dirty probe the next one ran on a rebuilt,
 *                  re-verified baseline; timestamps are ordered
 *   totals         every count recomputed from the records, and compared with
 *                  the file's own
 *
 * The mapping logic is re-implemented rather than imported, so a defect in the
 * executor's judge cannot be hidden by the same defect here.
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { RUNS_ROOT } from "./config.ts";
import { APPROVED_PATH, type ApprovedManifest } from "./wp3-approved.ts";
import { INTENTS_PATH, type IntentStore } from "./author-intents.ts";
import { REGISTERED_CONTRADICTIONS } from "./wp3-contradictions.ts";
import { FIXTURES } from "../rubric/fixtures.ts";

type Rec = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export interface ValidationOutcome {
  readonly runId: string;
  readonly checks: readonly { readonly name: string; readonly passed: boolean; readonly detail: string }[];
  readonly totals: Readonly<Record<string, unknown>>;
  readonly passed: boolean;
}

const NOT_MEASURED = new Set(["harness_error", "blocked_contradiction", "precondition_failed", "control_not_reached"]);

/** The verdict an observation must carry — written again, not imported. */
export function verdictFor(observation: string, polarity: string, verdictWhenPredicted: string): string {
  if (NOT_MEASURED.has(observation)) return "not_measured";
  if (observation === "not_as_predicted") return polarity === "characterization" ? "characterized" : "deficient";
  if (observation === "as_predicted") return verdictWhenPredicted;
  return "(unknown observation)";
}

/**
 * The observation the raw evidence implies, in the judge's precedence:
 * a contradiction's predicted refusal > harness > contradiction > precondition
 * (a failed premise or a precondition claim) > not reached > unmet > as predicted.
 */
export function observationFor(r: Rec): string {
  const claims = (r.claimResults ?? []) as Rec[];
  const c = r.contradiction as Rec | null;
  const st = r.actual?.sqlstate as string | null | undefined;
  const reg = REGISTERED_CONTRADICTIONS.filter((x) => x.testIds.includes(r.testId));
  const predicted = reg.flatMap((x) => x.predictedSqlstates ?? []);
  if (c && !r.actual?.harnessError && st && predicted.includes(st)) return "blocked_contradiction";
  if (claims.some((x) => x.status === "unmeasurable" && x.cls === "harness")) return "harness_error";
  if (c) return "blocked_contradiction";
  if ((r.premises as Rec[]).some((p) => !p.ok) || claims.some((x) => x.status === "unmeasurable" && x.cls === "precondition")) return "precondition_failed";
  if (claims.some((x) => x.status === "unmeasurable" && x.cls === "not_reached")) return "control_not_reached";
  if (claims.some((x) => x.status === "unmet")) return "not_as_predicted";
  return "as_predicted";
}

const SUBJECT_IDS: Readonly<Record<string, string>> = {
  alice: FIXTURES.alice.value, bob: FIXTURES.bob.value, carol: FIXTURES.carol.value, dave: FIXTURES.dave.value,
};

/** What the read-back identity must be for a planned identity; null when the probe has no SQL session to read. */
function identityProblem(r: Rec): string | null {
  const planned = String(r.identityPlanned);
  const id = r.identity as Rec | null;
  const kind = String(r.executed?.kind ?? "");
  if (kind === "f7_mechanism" || kind === "http" || kind === "socket") return null; // own connection or protocol; runner claims carry the identity
  if (!id) return `no identity read back for "${planned}"`;
  if (id.isSuperuser === true) return "the session was a superuser";
  if (/^authenticated:(alice|bob|carol|dave)$/.test(planned)) {
    const who = planned.split(":")[1]!;
    if (id.currentUser !== "authenticated") return `current_user ${id.currentUser}, authenticated planned`;
    if (id.authUid !== SUBJECT_IDS[who]) return `auth.uid() ${id.authUid}, ${who} planned`;
    if (id.bypassesRls !== false) return "the role-scoped session bypasses RLS";
    return null;
  }
  if (planned === "anon") {
    if (id.currentUser !== "anon") return `current_user ${id.currentUser}, anon planned`;
    if (id.authUid !== null) return `auth.uid() ${id.authUid} on an anonymous session`;
    return id.bypassesRls !== false ? "the anonymous session bypasses RLS" : null;
  }
  if (/NO claims/.test(planned)) return id.currentUser === "authenticated" && id.authUid === null && id.bypassesRls === false ? null : `null-identity session read back as ${id.currentUser} / ${id.authUid}`;
  if (/deleted account/.test(planned)) return id.currentUser === "authenticated" && id.authUid === SUBJECT_IDS.dave && id.bypassesRls === false ? null : `deleted-account session read back as ${id.currentUser} / ${id.authUid}`;
  if (/server-side|owner\(/.test(planned)) return id.bypassesRls === true ? null : "a server-side probe whose identity does not self-label as bypassing RLS";
  if (/scratch/.test(planned)) return null;
  return `no identity rule for "${planned}"`;
}

async function latestPlanningRun(): Promise<string | null> {
  const dirs = (await readdir(RUNS_ROOT)).sort().reverse();
  for (const d of dirs) {
    try { await readFile(join(RUNS_ROOT, d, "wp3-matrix.json")); return d; } catch { /* next */ }
  }
  return null;
}

const tally = (rs: readonly Rec[], key: (r: Rec) => string) => {
  const out: Record<string, number> = {};
  for (const r of rs) { const k = key(r); out[k] = (out[k] ?? 0) + 1; }
  return Object.fromEntries(Object.entries(out).sort());
};
const cross = (rs: readonly Rec[], row: (r: Rec) => string) => {
  const out: Record<string, Record<string, number>> = {};
  for (const r of rs) { const k = row(r); (out[k] ??= {})[r.verdict] = (out[k]![r.verdict] ?? 0) + 1; }
  return Object.fromEntries(Object.entries(out).sort());
};

export interface ValidationOptions { planRunId?: string; expectedSchema?: string; expectedArc21Commit?: string; expectedFingerprint?: string }

/** Everything the validator reads, loaded once — so `prove-gates` can hand it a deliberately broken copy (D3.55). */
export interface ValidationInputs {
  readonly file: Rec;
  readonly manifest: ApprovedManifest;
  readonly store: IntentStore;
  readonly planRun: string | null;
  readonly planRows: readonly Rec[];
}

export async function loadValidationInputs(runId: string, planRunId?: string): Promise<ValidationInputs> {
  const file = JSON.parse(await readFile(join(RUNS_ROOT, runId, "wp3-results.json"), "utf8")) as Rec;
  const manifest = JSON.parse(await readFile(APPROVED_PATH, "utf8")) as ApprovedManifest;
  const store = JSON.parse(await readFile(INTENTS_PATH, "utf8")) as IntentStore;
  const planRun = planRunId ?? (await latestPlanningRun());
  const planRows = planRun ? ((JSON.parse(await readFile(join(RUNS_ROOT, planRun, "wp3-matrix.json"), "utf8")) as Rec).plan.tests as Rec[]) : [];
  return { file, manifest, store, planRun, planRows };
}

export async function validateWp3Results(runId: string, opts: ValidationOptions = {}): Promise<ValidationOutcome> {
  return validateLoaded(runId, await loadValidationInputs(runId, opts.planRunId), opts);
}

export function validateLoaded(runId: string, inputs: ValidationInputs, opts: ValidationOptions = {}): ValidationOutcome {
  const checks: { name: string; passed: boolean; detail: string }[] = [];
  const add = (name: string, bad: readonly string[], ok: string) => checks.push({ name, passed: bad.length === 0, detail: bad.length ? `${bad.length}: ${bad.slice(0, 6).join(" | ")}` : ok });

  const { file, manifest, store, planRun, planRows } = inputs;
  const recs = (file.records ?? []) as Rec[];
  const planById = new Map(planRows.map((t) => [t.testId as string, t]));

  // --- completeness ----------------------------------------------------------
  const ids = recs.map((r) => String(r.testId));
  const approved = manifest.rows.map((r) => r.testId);
  const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
  const missing = approved.filter((id) => !ids.includes(id));
  const extra = ids.filter((id) => !approved.includes(id));
  add("exactly one record per approved Test ID", [...dup.map((d) => `duplicate ${d}`), ...missing.map((m) => `missing ${m}`), ...extra.map((e) => `not approved ${e}`)], `${recs.length} records, ${new Set(ids).size} unique, equal to the ${approved.length} approved Test IDs`);
  add("records are in the approved order", ids.length === approved.length && ids.every((id, i) => id === approved[i]) ? [] : ["order differs"], "same order as the frozen manifest");
  add("the run is complete (not aborted)", file.meta?.aborted ? [`aborted before ${file.meta.aborted.beforeTestId}: ${file.meta.aborted.reason}`] : [], "no ABORTED marker");
  add("no smoke record is in the assessment", recs.filter((r) => "NOT_WP3_EVIDENCE" in r).map((r) => r.testId), "no record is stamped NOT_WP3_EVIDENCE");

  // --- binding ---------------------------------------------------------------
  const schema = new Set(recs.map((r) => r.sut?.schemaVersion));
  const commit = new Set(recs.map((r) => r.sut?.arc21?.commit));
  const fp = new Set(recs.map((r) => r.sut?.arc21?.fingerprintBefore));
  const harness = new Set(recs.map((r) => r.harness?.sourcesSha256));
  const runIds = new Set(recs.map((r) => r.runId));
  add("every record carries the same schema version, as expected", [...(schema.size !== 1 ? [`${schema.size} schema versions`] : []), ...(opts.expectedSchema && !schema.has(opts.expectedSchema) ? ["not the expected schema"] : [])], `schema ${[...schema][0]}`);
  add("every record carries the same Arc21 commit and pre-run fingerprint", [...(commit.size !== 1 ? ["commits differ"] : []), ...(fp.size !== 1 ? ["fingerprints differ"] : []), ...(opts.expectedArc21Commit && !commit.has(opts.expectedArc21Commit) ? ["unexpected commit"] : []), ...(opts.expectedFingerprint && !fp.has(opts.expectedFingerprint) ? ["unexpected fingerprint"] : [])], `commit ${String([...commit][0]).slice(0, 12)}, fingerprint ${String([...fp][0]).slice(0, 16)}…`);
  add("every record carries the same harness hash and run id", [...(harness.size !== 1 ? ["harness hashes differ"] : []), ...(runIds.size !== 1 || !runIds.has(file.meta?.runId) ? ["run ids differ"] : [])], `harness ${String([...harness][0]).slice(0, 16)}…, run ${file.meta?.runId}`);
  add("every record's schema is wp3-evidence/2 and its recordId is testId@runId", recs.filter((r) => r.schema !== "wp3-evidence/2" || r.recordId !== `${r.testId}@${r.runId}`).map((r) => r.testId), "all");
  add("Arc21 was unchanged by the run (the file's own guard)", file.arc21ReadOnlyGuard?.identical === true && file.arc21ReadOnlyGuard?.before === file.arc21ReadOnlyGuard?.after ? [] : [`before ${file.arc21ReadOnlyGuard?.before} after ${file.arc21ReadOnlyGuard?.after}`], `fingerprint ${String(file.arc21ReadOnlyGuard?.before).slice(0, 16)}… before and after`);

  // --- plan correspondence ---------------------------------------------------
  const planBad: string[] = [];
  if (!planRows.length) planBad.push("no planning run found to compare with");
  for (const r of recs) {
    const t = planById.get(r.testId);
    if (!t) { planBad.push(`${r.testId}: not in planning run ${planRun}`); continue; }
    for (const [recF, planF] of [["family", "family"], ["resource", "resource"], ["controlId", "control"], ["tier", "tier"], ["polarity", "polarity"], ["identityPlanned", "identity"], ["operationPlanned", "operation"], ["expectedPlanned", "expected"], ["fixturePlanned", "fixture"], ["verdictWhenPredicted", "verdictWhenPredicted"]] as const) {
      if (String(r[recF]) !== String(t[planF])) planBad.push(`${r.testId}.${recF} differs from the plan`);
    }
    const mrow = manifest.rows.find((m) => m.testId === r.testId);
    if (mrow && mrow.identity !== r.identityPlanned) planBad.push(`${r.testId}: identity differs from the manifest`);
  }
  add("every record's planned fields are the planning run's row", planBad, `all ${recs.length} match planning run ${planRun} and the manifest's identities`);

  // --- intents ---------------------------------------------------------------
  const intentById = new Map(store.intents.map((e) => [e.testId, e]));
  const intentBad: string[] = [];
  for (const r of recs) {
    if (r.polarity === "negative") {
      const e = intentById.get(r.testId);
      if (!e) intentBad.push(`${r.testId}: no store entry`);
      else if (r.authorIntent !== e.intent || r.intentProvenance !== e.provenance || r.intentReviewStatus !== e.reviewStatus) intentBad.push(`${r.testId}: record intent differs from the store`);
      else if (e.provenance === "ai_draft" || e.reviewStatus !== "approved") intentBad.push(`${r.testId}: an unadopted intent reached the evidence`);
    } else if (r.authorIntent !== null || r.intentProvenance !== null) intentBad.push(`${r.testId}: a ${r.polarity} record carries an intent`);
  }
  add("every negative carries the store's adopted intent and provenance; nothing else carries one", intentBad,
    `${recs.filter((r) => r.polarity === "negative").length} negatives: ${JSON.stringify(tally(recs.filter((r) => r.polarity === "negative"), (r) => `${r.intentProvenance}/${r.intentReviewStatus}`))}`);

  // --- identity ----------------------------------------------------------------
  const idBad = recs.map((r) => { const p = identityProblem(r); return p ? `${r.testId}: ${p}` : null; }).filter((x): x is string => !!x);
  add("every session identity read back is the one the row names (never a superuser; a role-scoped session never bypasses RLS)", idBad, "all");

  // --- judgement, recomputed ---------------------------------------------------
  const obsBad: string[] = [], verBad: string[] = [], consBad: string[] = [];
  const registered = new Set(REGISTERED_CONTRADICTIONS.flatMap((c) => c.testIds));
  for (const r of recs) {
    const o = observationFor(r);
    if (o !== r.observation) obsBad.push(`${r.testId}: recorded ${r.observation}, the raw claims imply ${o}`);
    const v = verdictFor(r.observation, r.polarity, r.verdictWhenPredicted);
    if (v !== r.verdict) verBad.push(`${r.testId}: ${r.observation} → recorded ${r.verdict}, must be ${v}`);
    if (r.verdict === "effective" && (r.claimResults as Rec[]).some((c) => c.status !== "met")) consBad.push(`${r.testId}: effective with a claim not met`);
    if (r.verdict === "effective" && (r.guards as Rec[]).some((g) => !g.ok)) consBad.push(`${r.testId}: effective with a guard failing`);
    if (r.verdict === "not_measured" && !String(r.verdictReason ?? "").trim()) consBad.push(`${r.testId}: not_measured with no reason`);
    if (r.contradiction && !registered.has(r.testId)) consBad.push(`${r.testId}: carries a contradiction but is not registered`);
    if (!r.contradiction && registered.has(r.testId)) consBad.push(`${r.testId}: registered but carries no contradiction`);
    if (r.verdict === "effective" && r.polarity === "characterization") consBad.push(`${r.testId}: a characterization claims effective`);
    if (!Array.isArray(r.claimResults) || (r.claimResults as Rec[]).length === 0) consBad.push(`${r.testId}: no claim was judged`);
  }
  add("each observation is what the raw claim statuses, premises and contradiction imply (the judge's precedence, recomputed)", obsBad, "all");
  add("each verdict is what its observation maps to", verBad, "all");
  add("effective means every claim met and every guard held; not_measured always carries its reason; contradictions only on registered rows", consBad, "all");

  // --- isolation and time ------------------------------------------------------
  const isoBad: string[] = [];
  let lastT = 0;
  recs.forEach((r, i) => {
    const t = Date.parse(r.timestampUtc);
    if (!Number.isFinite(t)) isoBad.push(`${r.testId}: timestamp unreadable`);
    if (t < lastT) isoBad.push(`${r.testId}: timestamp earlier than the previous record`);
    lastT = t;
    const iso = r.isolation as Rec;
    if (iso.freshSession !== true) isoBad.push(`${r.testId}: no fresh session`);
    if (i === 0) {
      if (iso.rebuiltBefore !== true || iso.epoch !== 1) isoBad.push(`${r.testId}: the first probe did not run on the first rebuild`);
      return;
    }
    const prev = recs[i - 1]!.isolation as Rec;
    const dirty = prev.rebuildAfterBecause !== null;
    if (dirty && (iso.rebuiltBefore !== true || iso.epoch !== prev.epoch + 1)) isoBad.push(`${r.testId}: the previous probe was dirty (${prev.rebuildAfterBecause}) but this one did not run on a new rebuild`);
    if (!dirty && (iso.rebuiltBefore !== false || iso.epoch !== prev.epoch)) isoBad.push(`${r.testId}: an unexplained rebuild or epoch change`);
    if ((iso.changedRelations as unknown[]).length > 0 && iso.rebuildAfterBecause === null) isoBad.push(`${r.testId}: state changed but no rebuild was scheduled`);
  });
  const epochs = recs.length ? (recs[recs.length - 1]!.isolation as Rec).epoch : 0;
  add("isolation: after every dirty probe the next ran on a rebuilt, re-verified baseline; timestamps are ordered", isoBad, `${epochs} baseline epochs; rebuilds recorded by the run: ${file.meta?.rebuilds}`);
  add("the run's own rebuild count equals the epochs the records carry", Number(file.meta?.rebuilds) === epochs ? [] : [`meta says ${file.meta?.rebuilds}, the records reach epoch ${epochs}`], `${epochs}`);

  // --- totals, recomputed ------------------------------------------------------
  const byVerdict = tally(recs, (r) => r.verdict);
  const byObservation = tally(recs, (r) => r.observation);
  const eq = (a: Record<string, number>, b: Record<string, number>) => JSON.stringify(Object.entries(a).sort()) === JSON.stringify(Object.entries(b ?? {}).sort());
  add("the file's own byVerdict and byObservation equal the totals recomputed from its records", [...(eq(byVerdict, file.byVerdict) ? [] : [`byVerdict ${JSON.stringify(file.byVerdict)} vs ${JSON.stringify(byVerdict)}`]), ...(eq(byObservation, file.byObservation) ? [] : [`byObservation ${JSON.stringify(file.byObservation)} vs ${JSON.stringify(byObservation)}`])], "equal");
  add("harness errors: none", recs.filter((r) => r.observation === "harness_error").map((r) => r.testId), "0 harness errors");

  const totals = {
    records: recs.length,
    byVerdict, byObservation,
    byPolarity: cross(recs, (r) => r.polarity),
    byFamily: cross(recs, (r) => String(r.family).split(" ")[0]!),
    byTier: cross(recs, (r) => String(r.tier)),
    notMeasuredReasons: tally(recs.filter((r) => r.verdict === "not_measured"), (r) => r.observation),
    deficient: recs.filter((r) => r.verdict === "deficient").map((r) => ({ testId: r.testId, reason: r.verdictReason })),
    registeredNotMeasured: recs.filter((r) => r.contradiction).map((r) => ({ testId: r.testId, contradiction: r.contradiction.id })),
    elapsedSeconds: file.meta?.elapsedSeconds, rebuilds: file.meta?.rebuilds, rebuildSeconds: file.meta?.rebuildSeconds,
    planningRun: planRun,
  };
  return { runId, checks, totals, passed: checks.every((c) => c.passed) };
}

export function renderValidationMarkdown(v: ValidationOutcome): string {
  const L: string[] = [];
  L.push(`# WP3 results — independent validation of run \`${v.runId}\``);
  L.push("");
  L.push("> Generated by `npm run attest validate-wp3`. Reads only the raw results file, the frozen manifest, the planning");
  L.push("> run's matrix, the intent store and the contradiction registry; every mapping and total is recomputed here.");
  L.push("");
  L.push(`**${v.passed ? "PASSED" : "FAILED"}** — ${v.checks.filter((c) => c.passed).length} of ${v.checks.length} checks.`);
  L.push("");
  L.push("| Check | Result | Detail |");
  L.push("|---|---|---|");
  for (const c of v.checks) L.push(`| ${c.name} | ${c.passed ? "pass" : "**FAIL**"} | ${c.detail.replace(/\|/g, "\\|")} |`);
  L.push("");
  const t = v.totals as Rec;
  L.push("## Totals, recomputed from the records");
  L.push("");
  L.push("| Verdict | Records |");
  L.push("|---|---:|");
  for (const [k, n] of Object.entries(t.byVerdict as Record<string, number>)) L.push(`| ${k} | ${n} |`);
  L.push(`| **total** | **${t.records}** |`);
  L.push("");
  L.push("| Observation | Records |");
  L.push("|---|---:|");
  for (const [k, n] of Object.entries(t.byObservation as Record<string, number>)) L.push(`| ${k} | ${n} |`);
  L.push("");
  for (const [title, key] of [["By polarity", "byPolarity"], ["By family", "byFamily"], ["By tier", "byTier"]] as const) {
    const m = t[key] as Record<string, Record<string, number>>;
    const verdicts = ["effective", "deficient", "characterized", "gap", "not_measured"];
    L.push(`### ${title}`);
    L.push("");
    L.push(`| | ${verdicts.join(" | ")} | total |`);
    L.push(`|---|${verdicts.map(() => "---:").join("|")}|---:|`);
    for (const [k, row] of Object.entries(m)) L.push(`| ${k} | ${verdicts.map((x) => row[x] ?? 0).join(" | ")} | ${Object.values(row).reduce((a, b) => a + b, 0)} |`);
    L.push("");
  }
  L.push("## Deficient records (finding candidates for WP5 — not findings until reviewed)");
  L.push("");
  for (const d of t.deficient as { testId: string; reason: string }[]) L.push(`- \`${d.testId}\` — ${d.reason.slice(0, 400)}`);
  if (!(t.deficient as unknown[]).length) L.push("- none");
  L.push("");
  return L.join("\n") + "\n";
}

export async function writeValidation(v: ValidationOutcome): Promise<void> {
  await writeFile(join(RUNS_ROOT, v.runId, "wp3-validation.json"), JSON.stringify(v, null, 2) + "\n");
  await writeFile(join(RUNS_ROOT, v.runId, "wp3-validation.md"), renderValidationMarkdown(v));
}
