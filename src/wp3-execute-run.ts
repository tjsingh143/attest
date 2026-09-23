/**
 * Attest — the WP3 execution command.
 *
 * Reached only after preflight passes, which means the author has adopted all
 * 240 intent sentences and no plan contradiction is outstanding. Everything
 * this writes is the output of a real statement against the disposable
 * instance; nothing here fabricates a record.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { RUNS_ROOT, DB } from "./config.ts";
import { readSchemaVersion, shortVersion } from "./schema-version.ts";
import { readHarnessVersion } from "./harness-version.ts";
import { loadIntentStore } from "./author-intents.ts";
import type { Wp3Plan } from "./wp3-plan.ts";
import type { ExecSpec } from "./wp3-exec.ts";
import { runTests, type RunContext } from "./wp3-execute.ts";
import type { SystemUnderTest } from "./wp3-evidence.ts";
import { captureArc21State, compareArc21State, type Arc21SourceState } from "./arc21-guard.ts";

export async function executeWp3(
  plan: Wp3Plan,
  specs: ReadonlyMap<string, ExecSpec>,
  log: (s: string) => void = console.log,
  onlyTestIds?: readonly string[],
  arc21Pre?: Arc21SourceState,
): Promise<{ runId: string; records: number; byVerdict: Record<string, number>; harnessErrors: number; arc21Unchanged: boolean }> {
  const startedAt = new Date();
  // Arc21 is read-only (D3.31). The fingerprint taken before the run and the
  // one taken after both go into the results, so the evidence carries its own
  // proof that the system under assessment was not changed while it was made.
  const arc21Before = arc21Pre ?? (await captureArc21State());
  const sv = await readSchemaVersion();
  const runId = `${startedAt.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z")}-${shortVersion(sv)}`;
  const harness = await readHarnessVersion();
  const store = await loadIntentStore();

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
    },
    instance: `${DB.host}:${DB.port}/${DB.database}`,
  };

  const ctx: RunContext = { runId, sut, harness, store };
  const ids = onlyTestIds ?? plan.tests.map((t) => t.testId);
  log(`  executing ${ids.length} probe(s) against ${sut.instance}`);

  const summary = await runTests(ctx, plan, specs, ids, log);
  const arc21After = await captureArc21State();
  const arc21 = compareArc21State(arc21Before, arc21After);

  const runDir = join(RUNS_ROOT, runId);
  await mkdir(runDir, { recursive: true });
  await writeFile(
    join(runDir, "wp3-results.json"),
    JSON.stringify(
      {
        meta: { runId, startedAt: startedAt.toISOString(), sut, harness, probes: ids.length },
        arc21ReadOnlyGuard: {
          before: arc21Before.fingerprint,
          after: arc21After.fingerprint,
          identical: arc21.identical,
          differences: arc21.differences,
          // A non-identical result is a harness safety violation: the records
          // below were produced while something changed the system under test.
          harnessSafetyViolation: !arc21.identical,
        },
        byVerdict: summary.byVerdict,
        harnessErrors: summary.harnessErrors,
        records: summary.records,
      },
      null,
      2,
    ) + "\n",
  );

  log(`  verdicts: ${Object.entries(summary.byVerdict).map(([k, v]) => `${k} ${v}`).join(", ")}`);
  if (summary.harnessErrors) log(`  !! ${summary.harnessErrors} harness error(s) — these are not results and are recorded as not_measured`);
  log(`  written to evidence/runs/${runId}/wp3-results.json`);
  if (!arc21.identical) {
    log(`  !! HARNESS SAFETY VIOLATION — Arc21 changed during the run: ${arc21.differences.join("; ")}`);
  }

  return {
    runId, records: summary.records.length, byVerdict: summary.byVerdict, harnessErrors: summary.harnessErrors,
    arc21Unchanged: arc21.identical,
  };
}
