/**
 * Attest — command line.
 *
 *   node src/cli.ts bringup      rebuild the instance from migrations and seed it
 *   node src/cli.ts inventory    read the control inventory from the catalogs
 *   node src/cli.ts run          both, in order  (the one command)
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

/** Sortable, unique, and it says what it is: when, and against which schema. */
function makeRunId(startedAt: Date, schemaShort: string): string {
  const ts = startedAt.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  return `${ts}-${schemaShort}`;
}

async function cmdBringup(): Promise<void> {
  console.log("bringup");
  await bringup((s) => console.log(s));
  console.log("  ready");
}

async function cmdInventory(): Promise<{ runDir: string; inv: Inventory }> {
  const startedAt = new Date();
  const schemaVersion = await readSchemaVersion();
  const runId = makeRunId(startedAt, shortVersion(schemaVersion));

  console.log("inventory");

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
    };
    return { inv, meta, raw };
  });

  const runDir = join(RUNS_ROOT, runId);
  await mkdir(runDir, { recursive: true });
  await writeFile(join(runDir, "run.json"), JSON.stringify({ meta, counts: inv.counts }, null, 2) + "\n");
  await writeFile(join(runDir, "inventory.json"), JSON.stringify(inv, null, 2) + "\n");
  await writeFile(join(runDir, "inventory.md"), renderInventoryMarkdown(inv, meta));

  console.log(`  ${inv.counts.resources} resources, ${inv.counts.controls} (resource, control) pairs, ${inv.counts.observations} observations`);
  console.log(`  written to evidence/runs/${runId}/`);
  return { runDir, inv };
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
    case "run":
      await cmdBringup();
      await cmdInventory();
      break;
    default:
      console.error(`unknown command: ${cmd}\nusage: node src/cli.ts [bringup|inventory|run]`);
      process.exitCode = 2;
  }
}

main().catch((err: unknown) => {
  console.error(`\nattest: ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
});
