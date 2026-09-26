/**
 * Attest — command line. Every command is listed, with what it does, in src/commands.ts
 * (the README's command table and the usage text are generated from that list).
 *
 *   node src/cli.ts run              the one command: rebuild, re-derive, compare with the
 *                                    frozen evidence, prove the gates, regenerate every report
 *   node src/cli.ts run --confirm    all of that, then re-execute WP3 as a reproduction
 *   node src/cli.ts reports          regenerate every report from the evidence (no database)
 *   node src/cli.ts validate-reports check every report with code that did not write it
 *
 * Every command is bracketed by the Arc21 read-only guard (D3.31, D3.32).
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { DB, RUNS_ROOT } from "./config.ts";
import { adminSession, withSession } from "./db.ts";
import { bringup } from "./bringup.ts";
import { buildInventory, runProbes, type Inventory } from "./inventory.ts";
import { renderInventoryMarkdown, type RunMeta } from "./report.ts";
import { readAppliedState, readSchemaVersion, shortVersion } from "./schema-version.ts";
import { validate } from "./validate.ts";
import { readHarnessVersion } from "./harness-version.ts";
import { buildRiskInputs } from "./risk-inputs.ts";
import { renderRiskInputsMarkdown } from "./report-risk-inputs.ts";
import { formatRubricStatus, readRubricStatus } from "./rubric.ts";
import { runCp3 } from "./cp3.ts";
import { runWp3Planner, buildPlanInProcess } from "./wp3-planner-run.ts";
import { applySeedExtensions, verifySeedExtensions, FIXTURE_COMPLETENESS_NOTES } from "./seed-extensions.ts";
import { buildIntentPackage } from "./wp3-intents-run.ts";
import { preflight, renderPreflight, renderReadiness, REALTIME_HEALTH_URL } from "./wp3-preflight.ts";
import { loadApprovedManifest } from "./wp3-approved.ts";
import { findContradictions, summarizeContradictions } from "./plan-contradictions.ts";
import { runInjections, renderInjections } from "./wp3-fault-injection.ts";
import { loadIntentStore } from "./author-intents.ts";
import {
  ARC21_GUARD_EXIT_CODE,
  captureArc21State,
  compareArc21State,
  describeArc21State,
  type Arc21SourceState,
} from "./arc21-guard.ts";

/**
 * Sortable, unique, and it says what it is: when, and against which schema.
 *
 * One `run` mints exactly one of these and every artefact it produces lands in
 * that directory. The first version let the inventory and the validation each
 * make their own, a second apart, and a single command produced two run
 * directories holding half the evidence each.
 */
function makeRunId(startedAt: Date, schemaShort: string): string {
  const ts = startedAt.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  return `${ts}-${schemaShort}`;
}

async function cmdBringup(): Promise<void> {
  console.log("bringup");
  await bringup((s) => console.log(s));
  console.log("  ready");
}

async function cmdInventory(fixedRunId?: string): Promise<{ runId: string; runDir: string; inv: Inventory }> {
  const startedAt = new Date();
  const schemaVersion = await readSchemaVersion();
  const runId = fixedRunId ?? makeRunId(startedAt, shortVersion(schemaVersion));

  console.log("inventory");

  const harness = await readHarnessVersion();
  const { inv, meta } = await withSession(adminSession("inventory-reader"), async (admin) => {
    const applied = await readAppliedState(admin, schemaVersion);
    if (!applied.matches) {
      throw new Error(
        `the instance is not a build of these migration files ` +
          `(applied with no file: ${applied.appliedWithoutFile.join(", ") || "none"}; ` +
          `file not applied: ${applied.fileNotApplied.join(", ") || "none"}). Run bringup.`,
      );
    }
    const raw = await runProbes(admin);
    const inv = buildInventory(raw);
    const meta: RunMeta = {
      runId,
      startedAt: startedAt.toISOString(),
      schemaVersion,
      readAs: admin.identity,
      instance: `${DB.host}:${DB.port}/${DB.database}`,
      harness,
    };
    return { inv, meta, raw };
  });

  const runDir = join(RUNS_ROOT, runId);
  await mkdir(runDir, { recursive: true });
  await writeFile(
    join(runDir, "run.json"),
    JSON.stringify({ meta, counts: inv.counts }, null, 2) + "\n",
  );
  await writeFile(join(runDir, "inventory.json"), JSON.stringify(inv, null, 2) + "\n");
  await writeFile(join(runDir, "inventory.md"), renderInventoryMarkdown(inv, meta));

  console.log(`  ${inv.counts.resources} resources, ${inv.counts.controls} (resource, control) pairs, ${inv.counts.observations} observations`);
  console.log(`  written to evidence/runs/${runId}/`);
  return { runId, runDir, inv };
}

/** "If the harness cannot detect a deliberately broken control, nothing
 *  downstream is worth anything." So a failure here stops the run. */
function reportValidation(v: Awaited<ReturnType<typeof validate>>): void {
  for (const e of v.harnessErrors) console.error(`  !! harness error — ${e}`);
  if (!v.allDetected || !v.allRestored || !v.inventoryUnchanged || v.harnessErrors.length > 0) {
    console.error(
      `\nattest: validation FAILED — detected=${v.allDetected} restored=${v.allRestored} ` +
        `inventory unchanged=${v.inventoryUnchanged} harness errors=${v.harnessErrors.length}`,
    );
    process.exitCode = 1;
  }
}

async function cmdRiskInputs(fixedRunId?: string): Promise<void> {
  const startedAt = new Date();
  const sv = await readSchemaVersion();
  const runId = fixedRunId ?? makeRunId(startedAt, shortVersion(sv));
  console.log("risk inputs (WP2 scaffold)");
  const { inputs } = await withSession(adminSession("risk-inputs"), (a) => buildRiskInputs(a));
  const runDir = join(RUNS_ROOT, runId);
  await mkdir(runDir, { recursive: true });
  await writeFile(join(runDir, "risk-inputs.json"), JSON.stringify(inputs, null, 2) + "\n");
  await writeFile(
    join(runDir, "risk-inputs.md"),
    renderRiskInputsMarkdown(inputs, {
      runId, schemaVersion: sv.migrationSetSha256, startedAt: startedAt.toISOString(),
    }),
  );
  console.log(`  ${inputs.counts.resources} resources profiled, no scores assigned`);
  console.log(`  written to evidence/runs/${runId}/`);
}

/** Break every gate on purpose and require each to fire; record the result (D3.29, D3.48, D3.61). */
async function cmdProveGates(): Promise<boolean> {
  console.log("prove the gates by breaking them (deep copies, rolled-back transactions, tampered report copies and a throwaway repo; nothing real is changed)");
  const { plan, resources } = await buildPlanInProcess();
  const store = await loadIntentStore();
  if (!store) { console.error("attest: no canonical intent store."); return false; }
  const manifest = await loadApprovedManifest();
  if (!manifest) { console.error("attest: rubric/wp3-approved-matrix.json is missing."); return false; }
  const rs = await withSession(adminSession("prove-gates"), async (a) => {
    const { rows } = await a.query(
      "select rolname, rolsuper, rolbypassrls from pg_roles where rolname in ('postgres','authenticator')",
    );
    const m = new Map(rows.map((r) => [r.rolname as string, r]));
    return runInjections(plan, resources, store, {
      admin: a,
      manifest,
      liveRoleProps: {
        postgresBypassRls: m.get("postgres")?.rolbypassrls === true,
        authenticatorBypassRls: m.get("authenticator")?.rolbypassrls !== false,
        authenticatorSuperuser: m.get("authenticator")?.rolsuper !== false,
      },
      realtimeUrl: REALTIME_HEALTH_URL,
    });
  });
  console.log(renderInjections(rs));
  const controls = rs.filter((r) => r.control);
  const injected = rs.filter((r) => !r.control);
  const missed = injected.filter((r) => !r.caught);
  const falseAlarms = controls.filter((r) => !r.caught);
  console.log(
    `\n  ${injected.length - missed.length}/${injected.length} injected defects were caught; ` +
      `${controls.length - falseAlarms.length}/${controls.length} controls held; real state restored: ${rs.every((r) => r.restored)}`,
  );
  // The result is recorded, pass or fail, so the reports cite a count read from a file
  // rather than one typed into them (D3.61).
  const { recordProveGates } = await import("./wp7-run.ts");
  console.log(`  recorded: ${await recordProveGates(rs)}`);
  if (missed.length || falseAlarms.length || !rs.every((r) => r.restored)) {
    for (const r of missed) console.error(`  NOT CAUGHT: ${r.defect}`);
    for (const r of falseAlarms) console.error(`  CONTROL FAILED: ${r.defect} — ${r.firedCheck}`);
    console.error(`\nattest: ${missed.length} injected defect(s) produced no failure, ${falseAlarms.length} control(s) failed, or state was not restored — a gate that does not fire is a finding.`);
    return false;
  }
  return true;
}

function printChecks(checks: readonly { name: string; passed: boolean; detail: string }[]): void {
  for (const c of checks) console.log(`  ${c.passed ? "ok  " : "FAIL"} ${c.name}\n       ${c.detail.slice(0, 400)}`);
}

/** Regenerate every WP5, WP6 and WP7 output from the persisted evidence, then validate them (D3.61). */
async function cmdReports(): Promise<boolean> {
  console.log("reports — FINDINGS.md, the CP4 and CP5 records, the framework mapping and CSA note, the assurance report, the dashboard, the summary and the README's generated sections, from the evidence (no database)");
  const { buildReportOutputs, rel } = await import("./wp7-run.ts");
  const built = await buildReportOutputs("write");
  if (built.problems.length) {
    console.error("\nattest: REFUSED — the outputs would not match the evidence:");
    for (const p of built.problems) console.error(`  - ${p}`);
    return false;
  }
  for (const p of [...built.files.keys()].map(rel).sort()) console.log(`  written: ${p}`);
  console.log("");
  return cmdValidateReports();
}

async function cmdValidateReports(): Promise<boolean> {
  console.log("validate-reports — every number re-derived from the raw evidence by separate code, every output parsed and compared, every file compared with a fresh regeneration");
  const { validateReports, writeReportsValidation } = await import("./wp7-validate.ts");
  const v = await validateReports();
  printChecks(v.checks);
  const path = await writeReportsValidation(v, v.official);
  console.log(`\n  VALIDATION ${v.passed ? "PASSED" : "FAILED"} — ${v.checks.filter((c) => c.passed).length} of ${v.checks.length} checks; recorded in ${path.replace(/^.*evidence/, "evidence")}`);
  return v.passed;
}

const readJson = async (p: string): Promise<Record<string, any>> => JSON.parse(await (await import("node:fs/promises")).readFile(p, "utf8")); // eslint-disable-line @typescript-eslint/no-explicit-any

/**
 * The one command (brief §6; D3.61). Rebuilds the disposable database and re-derives every
 * piece of evidence that can be re-derived without re-running the 345 probes — the inventory,
 * the harness validation, the risk inputs and tiers, the fixtures, the WP3 plan — and requires
 * each to equal the frozen evidence the reports are built from; re-proves every gate on the
 * fresh baseline; regenerates and validates every report. `--confirm` then re-executes the
 * assessment as a reproduction and compares it with the official run Test ID by Test ID;
 * `--with-wp4` also repeats WP4 against that reproduction.
 */
async function cmdRun(arc21Pre: Arc21SourceState): Promise<void> {
  const confirm = process.argv.includes("--confirm");
  const withWp4 = process.argv.includes("--with-wp4");
  const log = (m: string) => console.log(m);
  const fail = (m: string) => { console.error(`\nattest: ${m}`); process.exitCode = 1; };
  const runId = makeRunId(new Date(), shortVersion(await readSchemaVersion()));
  const { loadOfficialRuns } = await import("./wp5-run.ts");
  const R = await import("./reproduce.ts");
  const off = await loadOfficialRuns();
  const frozen = (f: string) => readJson(join(RUNS_ROOT, off.frozenCp3, f));
  const fresh = (f: string) => readJson(join(RUNS_ROOT, runId, f));
  const comparisons: import("./reproduce.ts").Comparison[] = [];

  await cmdBringup();
  await cmdInventory(runId);
  comparisons.push(R.compareInventory(await frozen("inventory.json"), await fresh("inventory.json")));
  console.log("validate (WP1)");
  const v = await validate(log, runId);
  reportValidation(v);
  comparisons.push(R.compareWp1(await frozen("wp1-validation.json"), await fresh("wp1-validation.json")));
  await cmdRiskInputs(runId);
  comparisons.push(R.compareRiskInputs(await frozen("risk-inputs.json"), await fresh("risk-inputs.json")));
  console.log("score (WP2)");
  const c = await runCp3(log, runId);
  if (c.invariants.some((i) => !i.passed) || c.coverageGaps.length || c.issues.length) fail("CP3 FAILED — the estimate is not internally consistent, or a resource is unrated.");
  comparisons.push(R.compareTiers(await frozen("cp3-tiers.json"), await fresh("cp3-tiers.json")));
  // The matrix depends on state the standing seed does not create, so the fixtures are built
  // here — before planning, and before anything reads the instance expecting them.
  console.log("seed extensions (WP3 fixtures)");
  await withSession(adminSession("seed-extensions"), async (a) => {
    await applySeedExtensions(a, log);
    const bad = (await verifySeedExtensions(a)).filter((r) => !r.ok);
    for (const r of bad) console.error(`  FAIL ${r.key}: ${r.detail}`);
    console.log(`  ${bad.length === 0 ? "all seed extensions verified" : `${bad.length} seed extension(s) NOT satisfied`}`);
    if (bad.length) process.exitCode = 1;
  });
  console.log("plan WP3 (matrix only — nothing executed)");
  const pl = await runWp3Planner(log, runId, c.totalTestsPrimary);
  if (pl.issues.length > 0 || !pl.worksheetValid) fail("WP3 PLAN FAILED validation.");
  const matrix = await fresh("wp3-matrix.json");
  const manifest = await loadApprovedManifest();
  if (!manifest) { fail("rubric/wp3-approved-matrix.json is missing."); return; }
  const officialPlan = ((await readJson(join(RUNS_ROOT, off.plan, "wp3-matrix.json"))).plan as { tests: Record<string, unknown>[] }).tests;
  comparisons.push(R.comparePlan(matrix.plan, officialPlan, manifest, (matrix.semanticValidation ?? []) as unknown[]));
  // The intents were adopted at Gate A: nothing is drafted any more; the store must hold exactly what the official run recorded.
  comparisons.push(R.compareIntentStore((await loadIntentStore()) as unknown as Record<string, unknown>, await R.loadRunRecords(off.wp3)));

  await R.writeReproduction(join(RUNS_ROOT, runId), { frozenCp3: off.frozenCp3, plan: off.plan, wp3: off.wp3 }, comparisons);
  console.log("\nreproduction — what this rebuild re-derived, against the frozen evidence");
  printChecks(comparisons.map((x) => ({ name: x.name, passed: x.identical, detail: x.detail })));
  const reproduced = comparisons.every((x) => x.identical);
  console.log(`  ${reproduced ? "REPRODUCED" : "NOT REPRODUCED"} — written to evidence/runs/${runId}/reproduction.{json,md}\n`);
  if (!reproduced) process.exitCode = 1;

  // The database is a freshly verified baseline now: prove every gate on it, then rebuild the reports.
  if (!(await cmdProveGates())) process.exitCode = 1;
  console.log("");
  if (!(await cmdReports())) process.exitCode = 1;

  if (!confirm) {
    console.log(
      `\n  run: ${process.exitCode ? "FAILED" : "complete"}. The WP3 probes were not re-executed; the official result is ${off.wp3}.\n` +
        "  To re-execute the whole assessment as a reproduction and compare it Test ID by Test ID: npm run attest run -- --confirm",
    );
    return;
  }
  if (process.exitCode) { fail("run --confirm: the steps above failed, so the assessment is not re-executed."); return; }

  console.log("\nrun --confirm — re-execute the WP3 assessment as a reproduction (never a result) and compare it with the official run");
  const { plan, resources, schemaVersion } = await buildPlanInProcess();
  const pf = await preflight(plan, resources, { forExecution: true, expectedSchemaSha: schemaVersion, arc21Pre });
  console.log(renderPreflight(pf, true));
  if (!pf.passed) { fail("REFUSED — preflight did not pass for execution; nothing was executed."); return; }
  const { executeWp3 } = await import("./wp3-execute-run.ts");
  const ex = await executeWp3(plan, pf.specs, arc21Pre, schemaVersion, log, "reproduction");
  console.log(`\n  ${ex.summary.records.length} records written to ${ex.path}`);
  if (!ex.arc21Unchanged || ex.summary.aborted?.arc21Changed) { process.exitCode = ARC21_GUARD_EXIT_CODE; return; }
  if (ex.summary.aborted || ex.summary.harnessErrors > 0) { fail(`the reproduction ${ex.summary.aborted ? `ABORTED before ${ex.summary.aborted.beforeTestId}` : `had ${ex.summary.harnessErrors} harness error(s)`}.`); return; }
  const { validateWp3Results, writeValidation } = await import("./wp3-validate-results.ts");
  const sv = await readSchemaVersion();
  const val = await validateWp3Results(ex.runId, { planRunId: runId, expectedSchema: sv.migrationSetSha256, expectedArc21Commit: sv.git.commit ?? undefined, expectedFingerprint: arc21Pre.fingerprint });
  await writeValidation(val);
  printChecks(val.checks);
  console.log(`  validate-wp3 on the reproduction: ${val.passed ? "PASSED" : "FAILED"}`);
  const cmp = R.compareWp3Runs(await R.loadRunRecords(off.wp3), await R.loadRunRecords(ex.runId));
  await R.writeReproduction(join(RUNS_ROOT, ex.runId), { official: off.wp3, planningRun: runId }, [cmp]);
  console.log(`  compared with ${off.wp3}: ${cmp.identical ? "IDENTICAL" : "DIFFERENT"} — ${cmp.detail.slice(0, 300)}`);
  if (!val.passed || !cmp.identical) process.exitCode = 1;
  if (withWp4 && !process.exitCode) {
    const { runWp4 } = await import("./wp4-orchestrate.ts");
    const r = await runWp4({ wp3RunId: ex.runId, planRunId: runId, log });
    console.log(`\n  WP4 against the reproduction ${r.ok ? "completed" : "INCOMPLETE"} — evidence/runs/${r.runId}/wp4/drift-report.md`);
    if (r.safetyViolation) process.exitCode = ARC21_GUARD_EXIT_CODE;
    else if (!r.ok) process.exitCode = 1;
  }
}

/**
 * Arc21 is a read-only assessment target (D3.31), so every command is
 * bracketed: the checkout is fingerprinted before the command runs and again
 * after, and any difference is a harness safety violation with its own exit
 * code. The checkout may already be dirty; what is checked is that Attest did
 * not change it. Nothing is ever reverted automatically — reverting would risk
 * destroying the author's own uncommitted work.
 */
async function main(): Promise<void> {
  const cmd = process.argv[2] ?? "run";
  let arc21Pre: Arc21SourceState;
  try {
    arc21Pre = await captureArc21State();
  } catch (err) {
    console.error(
      `attest: REFUSED — the Arc21 checkout could not be fingerprinted, so the read-only guard cannot run: ` +
        `${err instanceof Error ? err.message : String(err)}`,
    );
    process.exitCode = ARC21_GUARD_EXIT_CODE;
    return;
  }
  try {
    await dispatch(cmd, arc21Pre);
  } finally {
    await checkArc21Unchanged(arc21Pre);
  }
}

async function checkArc21Unchanged(pre: Arc21SourceState): Promise<void> {
  let post: Arc21SourceState;
  try {
    post = await captureArc21State();
  } catch (err) {
    console.error(
      `\nattest: HARNESS SAFETY CHECK FAILED — the Arc21 checkout could not be re-read after the command: ` +
        `${err instanceof Error ? err.message : String(err)}`,
    );
    process.exitCode = ARC21_GUARD_EXIT_CODE;
    return;
  }
  const cmp = compareArc21State(pre, post);
  if (cmp.identical) {
    console.log(`\n  arc21 read-only guard: source state unchanged — ${describeArc21State(post)}`);
    return;
  }
  console.error("\nattest: HARNESS SAFETY VIOLATION — the Arc21 checkout changed while this command ran:");
  for (const d of cmp.differences) console.error(`    - ${d}`);
  console.error(
    "  Arc21 is a read-only assessment target (DECISIONS D3.31). Nothing has been reverted.\n" +
      "  Investigate before trusting any output of this command.",
  );
  process.exitCode = ARC21_GUARD_EXIT_CODE;
}

async function dispatch(cmd: string, arc21Pre: Arc21SourceState): Promise<void> {
  switch (cmd) {
    case "bringup":
      await cmdBringup();
      break;
    case "inventory":
      await cmdInventory();
      break;
    case "risk-inputs":
      await cmdRiskInputs();
      break;
    case "rubric": {
      console.log("rubric (WP2)");
      const st = await readRubricStatus();
      console.log(formatRubricStatus(st));
      if (!st.authored) process.exitCode = 2;
      break;
    }
    case "score": {
      console.log("score (WP2)");
      const c = await runCp3((s) => console.log(s));
      if (c.invariants.some((i) => !i.passed) || c.coverageGaps.length || c.issues.length) {
        console.error("\nattest: CP3 FAILED — the estimate is not internally consistent, or a resource is unrated.");
        process.exitCode = 1;
      }
      break;
    }
    case "seed-extensions": {
      console.log("seed extensions (WP3 fixtures)");
      await withSession(adminSession("seed-extensions"), async (a) => {
        await applySeedExtensions(a, (m) => console.log(m));
        const res = await verifySeedExtensions(a);
        const bad = res.filter((r) => !r.ok);
        for (const r of res) console.log(`  ${r.ok ? "ok  " : "FAIL"} ${r.key.padEnd(44)} ${r.detail}`);
        console.log(`\n  ${res.length - bad.length}/${res.length} verified`);
        for (const n of FIXTURE_COMPLETENESS_NOTES) console.log(`\n  note on ${n.key}: ${n.note}`);
        if (bad.length) process.exitCode = 1;
      });
      break;
    }
    case "freeze-fixture-corrections": {
      // Deliberate, never part of `run`: lists fixture-metadata corrections in
      // the frozen manifest (D3.38). Refuses unless every difference from the
      // approved matrix is a fixture statement with a written reason.
      console.log("list fixture corrections in the approved manifest (metadata only)");
      const { planFixtureCorrections, writeCorrectedManifest } = await import("./wp3-manifest-corrections.ts");
      const { plan } = await buildPlanInProcess();
      const manifest = await loadApprovedManifest();
      if (!manifest) { console.error("attest: rubric/wp3-approved-matrix.json is missing."); process.exitCode = 1; break; }
      const cp = await planFixtureCorrections(plan, manifest);
      if (cp.refusals.length) {
        for (const r of cp.refusals) console.error(`  REFUSED ${r}`);
        process.exitCode = 1;
        break;
      }
      const added = cp.corrections.length - manifest.corrections.length;
      const rebuilt = await writeCorrectedManifest(manifest, cp.corrections);
      console.log(`  ${added} fixture correction(s) listed; the manifest now lists ${rebuilt.corrections.length} in total`);
      break;
    }
    case "draft-intents": {
      console.log("draft AUTHOR INTENT sentences (drafts only — the author adopts them)");
      const { plan, runId, schemaVersion } = await buildPlanInProcess();
      const r = await buildIntentPackage(plan, runId, schemaVersion, (m) => console.log(m));
      if (r.qualityIssues.length > 0 || !r.worksheetValid) {
        console.error("\nattest: the draft package did not validate.");
        process.exitCode = 1;
      } else {
        console.log(`\n  ${r.aiDraft} sentence(s) await the author. Nothing may execute until that is 0.`);
      }
      break;
    }
    case "apply-gate-a": {
      // Deliberate, never part of `run`: applies the author's Gate A decisions as
      // recorded in rubric/wp3-gate-a-decisions.json (D3.54). Refuses — and
      // writes nothing — unless every frozen-field difference is authorised by
      // a decision and every intent approval matches the exact Gate A text.
      console.log("apply the author's Gate A decisions (frozen-manifest corrections and intent approvals)");
      const ga = await import("./gate-a-apply.ts");
      const { writeCorrectedManifest } = await import("./wp3-manifest-corrections.ts");
      const { writeIntentStore } = await import("./author-intents.ts");
      const d = await ga.loadDecisions();
      if (!d.recordedFrom) { console.error("attest: REFUSED — the decisions file records no source (recordedFrom)."); process.exitCode = 1; break; }
      const { plan } = await buildPlanInProcess();
      const manifest = await loadApprovedManifest();
      const store = await loadIntentStore();
      if (!manifest || !store) { console.error("attest: the approved manifest or the intent store is missing."); process.exitCode = 1; break; }
      const reviewArg = process.argv.find((a) => a.startsWith("--review="));
      const reviewPath = reviewArg ? reviewArg.split("=")[1]! : "evidence/runs/20260924T175203Z-5695a4c3df2d/gate-a-intent-review.json";
      const cp = await ga.planGateACorrections(plan, manifest, d);
      const ip = await ga.applyGateAIntents(plan, store, d, reviewPath);
      for (const r of [...cp.refusals, ...ip.refusals]) console.error(`  REFUSED ${r}`);
      if (cp.refusals.length || ip.refusals.length) { console.error("\nattest: nothing written."); process.exitCode = 1; break; }
      const rebuilt = await writeCorrectedManifest(manifest, cp.corrections);
      await writeIntentStore(ip.store);
      const byField: Record<string, number> = {};
      for (const c of cp.added) byField[c.field] = (byField[c.field] ?? 0) + 1;
      const approved = ip.store.intents.filter((e) => e.provenance !== "ai_draft" && e.reviewStatus === "approved").length;
      await ga.recordApplied({
        at: new Date().toISOString(),
        manifestCorrectionsAdded: cp.added.length, byField, manifestCorrectionsTotal: rebuilt.corrections.length,
        intentsApprovedAsWritten: ip.approvedAsWritten, intentsAdoptedFromGivenWording: ip.adoptedGiven,
        intentsApprovedTotal: approved, intentsRequired: ip.store.intents.length,
        userAuthored: ip.store.intents.filter((e) => e.provenance === "user_authored").length,
      });
      console.log(`  ${cp.added.length} frozen-manifest correction(s) listed (${JSON.stringify(byField)}); the manifest now lists ${rebuilt.corrections.length}`);
      console.log(`  intents: ${ip.approvedAsWritten} approved as written, ${ip.adoptedGiven} adopted from the author's given wording; ${approved} of ${ip.store.intents.length} approved; 0 user_authored`);
      break;
    }
    case "validate-wp3": {
      // Phase 4: independent validation of a WP3 results file. Reads only raw
      // inputs and recomputes every mapping and total (src/wp3-validate-results.ts).
      const runArg = process.argv.slice(3).find((a) => !a.startsWith("--"));
      if (!runArg) { console.error("usage: attest validate-wp3 <runId> [--plan-run=<runId>]"); process.exitCode = 2; break; }
      const planArg = process.argv.find((a) => a.startsWith("--plan-run="));
      const { validateWp3Results, writeValidation } = await import("./wp3-validate-results.ts");
      const sv = await readSchemaVersion();
      // The official run is validated against the plan it executed (J14), not merely the newest planning run.
      const offRuns = await (await import("./wp5-run.ts")).loadOfficialRuns();
      const planDefault = runArg === offRuns.wp3 ? offRuns.plan : undefined;
      const v = await validateWp3Results(runArg, { planRunId: planArg?.split("=")[1] ?? planDefault, expectedSchema: sv.migrationSetSha256, expectedArc21Commit: sv.git.commit ?? undefined, expectedFingerprint: arc21Pre.fingerprint });
      await writeValidation(v);
      for (const c of v.checks) console.log(`  ${c.passed ? "ok  " : "FAIL"} ${c.name}\n       ${c.detail.slice(0, 300)}`);
      console.log(`\n  by verdict: ${JSON.stringify((v.totals as Record<string, unknown>).byVerdict)}`);
      console.log(`  VALIDATION ${v.passed ? "PASSED" : "FAILED"} — written to evidence/runs/${runArg}/wp3-validation.{json,md}`);
      if (!v.passed) process.exitCode = 1;
      break;
    }
    case "wp4-state": {
      // One WP4 schema state, run in its own process by `attest wp4` with
      // ATTEST_SUT_REPO pointing at the state's scratch directory (D3.56).
      const [runId, state] = process.argv.slice(3).filter((a) => !a.startsWith("--"));
      const planRun = process.argv.find((a) => a.startsWith("--plan-run="))?.split("=")[1];
      if (!runId || !state || !planRun) { console.error("usage: attest wp4-state <runId> <state> --plan-run=<runId> [--probes]"); process.exitCode = 2; break; }
      const { runState } = await import("./wp4-run.ts");
      const metaPath = join(RUNS_ROOT, runId, "wp4", state, "state-meta.json");
      const stateMeta = JSON.parse(await (await import("node:fs/promises")).readFile(metaPath, "utf8")) as Record<string, unknown>;
      await runState({ runId, state, stateMeta, planRunId: planRun, runProbes: process.argv.includes("--probes"), arc21Pre, log: (m) => console.log(m) });
      break;
    }
    case "wp4": {
      // WP4: every schema state, then the drift between them (D3.56).
      const wp3 = process.argv.find((a) => a.startsWith("--wp3-run="))?.split("=")[1];
      const planRun = process.argv.find((a) => a.startsWith("--plan-run="))?.split("=")[1];
      if (!wp3 || !planRun) { console.error("usage: attest wp4 --wp3-run=<runId> --plan-run=<runId> [--inventories-only]"); process.exitCode = 2; break; }
      const { runWp4 } = await import("./wp4-orchestrate.ts");
      const r = await runWp4({ wp3RunId: wp3, planRunId: planRun, log: (m) => console.log(m), inventoriesOnly: process.argv.includes("--inventories-only") });
      console.log(`\n  WP4 ${r.ok ? "completed" : "INCOMPLETE"} — evidence/runs/${r.runId}/wp4/drift-report.md`);
      if (r.safetyViolation) process.exitCode = ARC21_GUARD_EXIT_CODE;
      else if (!r.ok) process.exitCode = 1;
      break;
    }
    case "wp4-report": {
      // Regenerate a WP4 run's drift.json and drift-report.md from what its states persisted (D3.56).
      const runId = process.argv.slice(3).find((a) => !a.startsWith("--"));
      const wp3 = process.argv.find((a) => a.startsWith("--wp3-run="))?.split("=")[1];
      const planRun = process.argv.find((a) => a.startsWith("--plan-run="))?.split("=")[1];
      if (!runId || !wp3 || !planRun) { console.error("usage: attest wp4-report <wp4 runId> --wp3-run=<runId> --plan-run=<runId>"); process.exitCode = 2; break; }
      const { writeDrift } = await import("./wp4-orchestrate.ts");
      if (!(await writeDrift({ runId, wp3RunId: wp3, planRunId: planRun, log: (m) => console.log(m) }))) process.exitCode = 1;
      break;
    }
    case "wp5": {
      // WP5 (Amendment A1): findings, risk prioritisation and remediation
      // guidance, and the CP4 packet (D3.57). Writes only Attest files.
      // With no run arguments it builds from the official runs the author selected at CP4 (J14; rubric/official-runs.json).
      const arg = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split("=")[1];
      const { writeWp5, loadOfficialRuns } = await import("./wp5-run.ts");
      const off = await loadOfficialRuns();
      const wp3 = arg("wp3-run") ?? off.wp3, planRun = arg("plan-run") ?? off.plan, wp4 = arg("wp4-run") ?? off.wp4;
      const r = await writeWp5({ wp3RunId: wp3, planRunId: planRun, wp4RunId: wp4, log: (m) => console.log(m) });
      if (!r.ok) process.exitCode = 1;
      break;
    }
    case "wp6": {
      // WP6: the framework mapping (a study exercise), the CSA note and the CP5 record (D3.60).
      console.log("WP6 — framework mapping, a study / control-mapping exercise (not compliance, validation or audit)");
      const { runWp6 } = await import("./wp6-run.ts");
      if (!(await runWp6((m) => console.log(m))).ok) process.exitCode = 1;
      break;
    }
    case "validate-wp6": {
      const { validateWp6 } = await import("./wp6-validate.ts");
      const { loadOfficialRuns } = await import("./wp5-run.ts");
      const v = await validateWp6((await loadOfficialRuns()).wp3);
      for (const c of v.checks) console.log(`  ${c.passed ? "ok  " : "FAIL"} ${c.name}\n       ${c.detail.slice(0, 300)}`);
      console.log(`\n  VALIDATION ${v.passed ? "PASSED" : "FAILED"} — ${v.checks.filter((c) => c.passed).length} of ${v.checks.length}`);
      if (!v.passed) process.exitCode = 1;
      break;
    }
    case "reports": {
      // WP5, WP6 and WP7 outputs from the persisted evidence, then their independent validation (D3.61).
      if (!(await cmdReports())) process.exitCode = 1;
      break;
    }
    case "validate-reports": {
      // Every generated output checked by code that did not write it, and against a regeneration (D3.61).
      if (!(await cmdValidateReports())) process.exitCode = 1;
      break;
    }
    case "compare-wp3": {
      // Two WP3 runs, Test ID by Test ID (D3.61). Reads evidence only.
      const cand = process.argv.slice(3).find((a) => !a.startsWith("--"));
      const offArg = process.argv.find((a) => a.startsWith("--official="))?.split("=")[1];
      if (!cand) { console.error("usage: attest compare-wp3 <candidate run id> [--official=<run id>]"); process.exitCode = 2; break; }
      const { loadOfficialRuns } = await import("./wp5-run.ts");
      const official = offArg ?? (await loadOfficialRuns()).wp3;
      const { compareWp3Runs, loadRunRecords } = await import("./reproduce.ts");
      const c = compareWp3Runs(await loadRunRecords(official), await loadRunRecords(cand));
      console.log(`compare WP3 run ${cand} with ${official}`);
      console.log(`  differences by field: ${JSON.stringify(c.byField)}`);
      for (const d of c.differences.slice(0, 40)) console.log(`    ${d}`);
      if (c.differences.length > 40) console.log(`    … ${c.differences.length - 40} more`);
      console.log(`\n  ${c.identical ? "IDENTICAL" : "DIFFERENT"} — ${c.detail.slice(0, 200)}`);
      if (!c.identical) process.exitCode = 1;
      break;
    }
    case "framework-sources": {
      // WP6's quoted framework texts, fetched from NIST's OSCAL catalog and the eCFR (D3.60).
      console.log("framework sources (network: NIST, eCFR, FDA) → rubric/framework-sources.json");
      const { writeFrameworkSources } = await import("./framework-sources.ts");
      await writeFrameworkSources((m) => console.log(m));
      break;
    }
    case "verify-finding": {
      // The mechanical re-verification of one WP5 item against a future run (D3.57).
      const key = process.argv.slice(3).find((a) => !a.startsWith("--"));
      const arg = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split("=")[1];
      const official = arg("official"), candidate = arg("candidate");
      if (!key || !official || !candidate) { console.error("usage: attest verify-finding <item key> --official=<runId> --candidate=<runId>"); process.exitCode = 2; break; }
      const { verifyFindingCommand } = await import("./wp5-run.ts");
      const v = await verifyFindingCommand(key, official, candidate);
      for (const l of v.lines) console.log(`  ${l}`);
      console.log(`\n  ${v.item}: ${v.verified ? "FIX CONFIRMED by the candidate run" : "NOT CONFIRMED"}`);
      if (!v.verified) process.exitCode = 1;
      break;
    }
    case "gate-a-package": {
      // The Gate A review table and decision template (D3.53). Reads and writes
      // only Attest files; never approves anything.
      console.log("Gate A package: the AUTHOR INTENT review table and the decision template (nothing is approved)");
      const baseArg = process.argv.find((a) => a.startsWith("--baseline-commit="));
      const baselineCommit = baseArg ? baseArg.split("=")[1]! : "a8d8cfc";
      const { plan, runId, schemaVersion } = await buildPlanInProcess();
      const store = await loadIntentStore();
      if (!store) { console.error("attest: no canonical intent store; run draft-intents first."); process.exitCode = 1; break; }
      const { writeGateAPackage } = await import("./gate-a-package.ts");
      const r = await writeGateAPackage(plan, store, { runId, schemaVersion, baselineCommit });
      const n = (c: string) => r.rows.filter((x) => x.category === c).length;
      console.log(`  ${r.rows.length} rows: A ${n("A")}, B ${n("B")}, C ${n("C")}; ${r.rows.filter((x) => x.changedSinceBaseline).length} changed since ${baselineCommit}${r.baselineFound ? "" : " (baseline store NOT found — no change log)"}`);
      console.log(`  written to ${r.dir.replace(/^.*evidence/, "evidence")}/gate-a-intent-review.{md,tsv,json}`);
      console.log(`  decision template: ${r.templateWritten ? "written (every decision pending)" : "already present — left untouched"}`);
      break;
    }
    case "prove-gates": {
      if (!(await cmdProveGates())) process.exitCode = 1;
      break;
    }
    case "preflight-wp3": {
      const forExecution = process.argv.includes("--for-execution");
      console.log(`preflight WP3${forExecution ? " (for execution)" : " (planning)"}`);
      const { plan, resources, schemaVersion } = await buildPlanInProcess();
      const r = await preflight(plan, resources, { forExecution, expectedSchemaSha: schemaVersion, arc21Pre });
      console.log(renderPreflight(r, forExecution));
      if (r.readiness.some((c) => !c.passed)) {
        console.log("\n  STRUCTURAL BLOCKERS — a probe below could not produce a verdict that means what it says (D3.36):");
        console.log(renderReadiness(r));
      }
      const cs = findContradictions(plan);
      if (cs.length) {
        console.log("\n  UNRESOLVED PLAN CONTRADICTIONS — these Test IDs are blocked:");
        for (const g of summarizeContradictions(cs)) {
          console.log(`    ${g.id}: ${g.count} row(s)`);
          console.log(`      ${g.testIds.join(", ")}`);
          console.log(`      proposed resolution: ${g.proposedResolution}`);
        }
      }
      const failing = r.checks.filter((c) => !c.passed && (forExecution || !c.executionOnly));
      console.log(`\n  PREFLIGHT ${r.passed ? "PASSED" : "FAILED"}${!r.passed && r.onlyAuthorGatesFail ? " — ONLY the AUTHOR INTENT gate is closed; every structural gate passed" : ""}`);
      if (!r.passed) console.log(`  failing: ${failing.map((c) => c.name).join(" | ")}`);
      if (!r.passed) process.exitCode = 1;
      break;
    }
    case "execute-wp3": {
      // The one command for the WP3 assessment (§27). Refused unless preflight
      // passes FOR EXECUTION — which requires every AUTHOR INTENT sentence to
      // be the author's — and unless --confirm is given.
      console.log("execute WP3");
      const { plan, resources, schemaVersion } = await buildPlanInProcess();
      const r = await preflight(plan, resources, { forExecution: true, expectedSchemaSha: schemaVersion, arc21Pre });
      console.log(renderPreflight(r, true));
      if (r.readiness.some((c) => !c.passed)) {
        console.log("\n  STRUCTURAL BLOCKERS (D3.36):");
        console.log(renderReadiness(r));
      }
      if (!r.passed) {
        const why = r.onlyAuthorGatesFail
          ? "the AUTHOR INTENT gate is closed: every structural gate passed, and the only failing checks are that the intent sentences are not yet the author's"
          : "preflight did not pass";
        console.error(
          `\nattest: REFUSED — ${why}, so the WP3 suite was not run.\n` +
            "         Nothing was executed and no evidence was written.",
        );
        process.exitCode = 1;
        break;
      }
      if (!process.argv.includes("--confirm")) {
        console.error(
          "\nattest: preflight passed, but execution is gated behind an explicit flag.\n" +
            "         Re-run with --confirm once you intend the full 345-probe assessment.",
        );
        process.exitCode = 2;
        break;
      }
      const { executeWp3 } = await import("./wp3-execute-run.ts");
      const ex = await executeWp3(plan, r.specs, arc21Pre, schemaVersion, (m: string) => console.log(m));
      console.log(`\n  ${ex.summary.records.length} records written to ${ex.path}`);
      console.log(`  by observation: ${JSON.stringify(ex.summary.byObservation)}`);
      console.log(`  by verdict: ${JSON.stringify(ex.summary.byVerdict)}`);
      console.log(`  ${ex.summary.rebuilds} rebuild(s), ${ex.summary.rebuildSeconds.toFixed(0)}s rebuilding, ${ex.summary.elapsedSeconds.toFixed(0)}s in total`);
      if (!ex.arc21Unchanged || ex.summary.aborted?.arc21Changed) process.exitCode = ARC21_GUARD_EXIT_CODE;
      else if (ex.summary.aborted) {
        console.error(`\nattest: the run was ABORTED before ${ex.summary.aborted.beforeTestId} (${ex.summary.aborted.reason}); ${ex.summary.records.length} of 345 recorded. Not a complete assessment. Exit 1.`);
        process.exitCode = 1;
      } else if (ex.summary.harnessErrors > 0) {
        console.error(`\nattest: ${ex.summary.harnessErrors} probe(s) ended in a harness error; those records carry no verdict. Exit 1.`);
        process.exitCode = 1;
      }
      break;
    }
    case "smoke-wp3": {
      // Plumbing smoke on named Test IDs (§25). NOT evidence: written under
      // .smoke/ (gitignored), every record stamped NOT WP3 EVIDENCE, at most
      // SMOKE_MAX_TEST_IDS, and it runs only when every static gate passes.
      const ids = process.argv.slice(3).filter((a) => !a.startsWith("--"));
      console.log(`smoke WP3 plumbing on ${ids.length} named Test ID(s) — NOT evidence, NOT the assessment`);
      const { plan, resources, schemaVersion } = await buildPlanInProcess();
      const { planChecks } = await import("./wp3-preflight.ts");
      const pc = await planChecks(plan, resources, await loadApprovedManifest(), { reproducibility: false });
      const bad = pc.checks.filter((c) => !c.passed);
      if (bad.length) {
        for (const c of bad) console.error(`  FAIL ${c.name}: ${c.detail}`);
        console.error("\nattest: REFUSED — a static gate fails, so even a smoke run would not mean anything.");
        process.exitCode = 1;
        break;
      }
      const { smokeWp3 } = await import("./wp3-execute-run.ts");
      const ex = await smokeWp3(plan, pc.specs, ids, arc21Pre, schemaVersion, (m: string) => console.log(m));
      console.log(`\n  smoke records (NOT evidence) written to ${ex.path}`);
      console.log(`  by observation: ${JSON.stringify(ex.summary.byObservation)}`);
      console.log(`  ${ex.summary.rebuilds} rebuild(s), ${ex.summary.rebuildSeconds.toFixed(0)}s rebuilding, ${ex.summary.elapsedSeconds.toFixed(0)}s in total`);
      if (!ex.arc21Unchanged || ex.summary.aborted?.arc21Changed) process.exitCode = ARC21_GUARD_EXIT_CODE;
      else if (ex.summary.aborted || ex.summary.harnessErrors > 0) process.exitCode = 1;
      break;
    }
    case "plan-wp3": {
      console.log("plan WP3 (matrix only — nothing executed)");
      const pl = await runWp3Planner((s) => console.log(s));
      if (pl.issues.length > 0 || !pl.worksheetValid) {
        console.error("\nattest: WP3 PLAN FAILED validation — the matrix or the intent worksheet is not ready.");
        process.exitCode = 1;
      }
      break;
    }
    case "validate": {
      console.log("validate (WP1)");
      const v = await validate((s) => console.log(s));
      reportValidation(v);
      break;
    }
    case "run": {
      await cmdRun(arc21Pre);
      break;
    }
    default: {
      const { usageText } = await import("./commands.ts");
      console.error(`unknown command: ${cmd}\n${usageText()}`);
      process.exitCode = 2;
    }
  }
}

main().catch((err: unknown) => {
  console.error(`\nattest: ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
});
