/**
 * Attest — running WP3 probes: the assessment, and plumbing smoke.
 *
 * `executeWp3` is the one-command WP3 assessment (§27). It is reached only
 * after `preflight --for-execution` passes — which requires every AUTHOR
 * INTENT sentence to be the author's — and only with `--confirm`. It rebuilds
 * the disposable database, runs every approved Test ID with rebuild isolation,
 * writes one evidence record per Test ID, re-fingerprints Arc21, and exits
 * non-zero on any harness error or safety violation.
 *
 * `smokeWp3` runs a handful of named Test IDs through exactly the same path to
 * validate the executor's plumbing. Its output is NOT evidence: it is written
 * under `.smoke/` (gitignored), every record is stamped NOT WP3 EVIDENCE, it
 * refuses to run the whole matrix, and nothing downstream reads it. A smoke
 * probe that surfaces a candidate weakness is recorded as a candidate and
 * nothing is changed in Arc21 (D3.31).
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { RUNS_ROOT, DB, ATTEST_ROOT } from "./config.ts";
import { readSchemaVersion, shortVersion } from "./schema-version.ts";
import { readHarnessVersion } from "./harness-version.ts";
import { loadIntentStore } from "./author-intents.ts";
import type { Wp3Plan } from "./wp3-plan.ts";
import type { ExecSpec } from "./wp3-exec.ts";
import { prepareAll, runTests, type RunContext, type RunSummary } from "./wp3-execute.ts";
import type { SystemUnderTest } from "./wp3-evidence.ts";
import { captureArc21State, compareArc21State, type Arc21SourceState } from "./arc21-guard.ts";

export const SMOKE_ROOT = join(ATTEST_ROOT, ".smoke");
/** A smoke run may not stand in for the assessment. */
export const SMOKE_MAX_TEST_IDS = 60;

async function context(runId: string, arc21Pre: Arc21SourceState, expectedSchema: string, log: (s: string) => void): Promise<RunContext> {
  const sv = await readSchemaVersion();
  const sut: SystemUnderTest = {
    schemaVersion: sv.migrationSetSha256,
    migrationCount: sv.migrationCount,
    arc21: {
      commit: sv.git?.commit ?? "(unknown)",
      branch: sv.git?.branch ?? "(unknown)",
      // Recorded, not normalised: the schema hash is computed from the
      // migration files on disk, so a dirty checkout still produces a
      // reproducible hash — but a reader is entitled to know it was dirty.
      dirty: sv.git?.dirty ?? false,
      uncommittedMigrations: sv.git?.uncommittedMigrations ?? [],
      fingerprintBefore: arc21Pre.fingerprint,
    },
    instance: `${DB.host}:${DB.port}/${DB.database}`,
  };
  return { runId, sut, harness: await readHarnessVersion(), store: await loadIntentStore(), arc21Pre, expectedSchema, log };
}

function mintRunId(sv: { migrationSetSha256: string; migrationCount: number }): string {
  return `${new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z")}-${shortVersion(sv as never)}`;
}

export interface ExecuteResult {
  readonly runId: string;
  readonly summary: RunSummary;
  readonly arc21Unchanged: boolean;
  readonly path: string;
}

/** The WP3 assessment. Callers reach this only through a passed preflight and --confirm. */
export async function executeWp3(
  plan: Wp3Plan,
  specs: ReadonlyMap<string, ExecSpec>,
  arc21Pre: Arc21SourceState,
  expectedSchema: string,
  log: (s: string) => void = console.log,
): Promise<ExecuteResult> {
  const sv = await readSchemaVersion();
  const runId = mintRunId(sv);
  const ctx = await context(runId, arc21Pre, expectedSchema, log);
  const prepared = prepareAll(plan, specs);
  const ids = plan.tests.map((t) => t.testId);
  log(`  executing ${ids.length} probe(s) against ${ctx.sut.instance}, rebuilding the disposable database after every state change`);
  const summary = await runTests(ctx, prepared, ids);
  const arc21After = await captureArc21State();
  const cmp = compareArc21State(arc21Pre, arc21After);
  const dir = join(RUNS_ROOT, runId);
  await mkdir(dir, { recursive: true });
  const path = join(dir, "wp3-results.json");
  await writeFile(path, JSON.stringify({
    meta: {
      runId, kind: "WP3 assessment", sut: ctx.sut, harness: ctx.harness, probes: ids.length, recorded: summary.records.length,
      rebuilds: summary.rebuilds, rebuildSeconds: summary.rebuildSeconds, elapsedSeconds: summary.elapsedSeconds,
      aborted: summary.aborted,
    },
    ...(summary.aborted ? { ABORTED: `The run stopped before ${summary.aborted.beforeTestId}: ${summary.aborted.reason}. Only ${summary.records.length} of ${ids.length} probes were recorded; this is not a complete WP3 assessment.` } : {}),
    arc21ReadOnlyGuard: { before: arc21Pre.fingerprint, after: arc21After.fingerprint, identical: cmp.identical, differences: cmp.differences, harnessSafetyViolation: !cmp.identical },
    byVerdict: summary.byVerdict, byObservation: summary.byObservation, harnessErrors: summary.harnessErrors,
    records: summary.records,
  }, null, 2) + "\n");
  return { runId, summary, arc21Unchanged: cmp.identical, path };
}

/** Plumbing smoke on named Test IDs. Never evidence. */
export async function smokeWp3(
  plan: Wp3Plan,
  specs: ReadonlyMap<string, ExecSpec>,
  testIds: readonly string[],
  arc21Pre: Arc21SourceState,
  expectedSchema: string,
  log: (s: string) => void = console.log,
): Promise<ExecuteResult> {
  if (testIds.length === 0) throw new Error("name the Test IDs to smoke");
  if (testIds.length > SMOKE_MAX_TEST_IDS || testIds.length >= plan.tests.length) {
    throw new Error(`a smoke run is limited to ${SMOKE_MAX_TEST_IDS} Test IDs; it may not stand in for the WP3 assessment`);
  }
  const known = new Set(plan.tests.map((t) => t.testId));
  const unknown = testIds.filter((id) => !known.has(id));
  if (unknown.length) throw new Error(`not approved Test IDs: ${unknown.join(", ")}`);
  const sv = await readSchemaVersion();
  const runId = `smoke-${mintRunId(sv)}`;
  const ctx = await context(runId, arc21Pre, expectedSchema, log);
  const prepared = prepareAll(plan, specs);
  const summary = await runTests(ctx, prepared, testIds);
  const arc21After = await captureArc21State();
  const cmp = compareArc21State(arc21Pre, arc21After);
  const dir = join(SMOKE_ROOT, runId);
  await mkdir(dir, { recursive: true });
  const path = join(dir, "smoke-results.json");
  await writeFile(path, JSON.stringify({
    WARNING: "NOT WP3 EVIDENCE. A plumbing smoke run of named Test IDs, made before the suite is authorised and before its intent sentences are the author's. Nothing here is a WP3 result, a verdict or a finding.",
    meta: { runId, kind: "smoke", testIds, rebuilds: summary.rebuilds, rebuildSeconds: summary.rebuildSeconds, elapsedSeconds: summary.elapsedSeconds, aborted: summary.aborted },
    arc21ReadOnlyGuard: { before: arc21Pre.fingerprint, after: arc21After.fingerprint, identical: cmp.identical, differences: cmp.differences },
    byObservation: summary.byObservation,
    records: summary.records.map((r) => ({ NOT_WP3_EVIDENCE: true, ...r })),
  }, null, 2) + "\n");
  return { runId, summary, arc21Unchanged: cmp.identical, path };
}
