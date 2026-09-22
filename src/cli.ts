/**
 * Attest — command line.
 *
 *   node src/cli.ts bringup      rebuild the instance from migrations and seed it
 *   node src/cli.ts inventory    read the control inventory from the catalogs
 *   node src/cli.ts validate     WP1: deliberate-break validation of the harness
 *   node src/cli.ts run          all of the above, in order  (the one command)
 *
 * The brief's standard is that one command reproduces every number in the
 * report from a fresh database. `run` is that command. As work packages land it
 * grows; today it brings up the instance and inventories it.
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
import { runWp3Planner } from "./wp3-planner-run.ts";

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

async function main(): Promise<void> {
  const cmd = process.argv[2] ?? "run";
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
    case "plan-wp3": {
      console.log("plan WP3 (matrix only — nothing executed)");
      await runWp3Planner((s) => console.log(s));
      break;
    }
    case "validate": {
      console.log("validate (WP1)");
      const v = await validate((s) => console.log(s));
      reportValidation(v);
      break;
    }
    case "run": {
      // One run id for the whole command, so the inventory and the validation
      // it was performed against land in the same directory.
      const runId = makeRunId(new Date(), shortVersion(await readSchemaVersion()));
      await cmdBringup();
      await cmdInventory(runId);
      console.log("validate (WP1)");
      const v = await validate((s) => console.log(s), runId);
      await cmdRiskInputs(runId);
      reportValidation(v);
      console.log("score (WP2)");
      const c = await runCp3((s) => console.log(s), runId);
      if (c.invariants.some((i) => !i.passed) || c.coverageGaps.length || c.issues.length) {
        console.error("\nattest: CP3 FAILED — the estimate is not internally consistent, or a resource is unrated.");
        process.exitCode = 1;
      }
      console.log("plan WP3 (matrix only — nothing executed)");
      await runWp3Planner((s) => console.log(s), runId, c.totalTestsPrimary);
      break;
    }
    default:
      console.error(`unknown command: ${cmd}\nusage: node src/cli.ts [bringup|inventory|validate|risk-inputs|rubric|score|plan-wp3|run]`);
      process.exitCode = 2;
  }
}

main().catch((err: unknown) => {
  console.error(`\nattest: ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
});
