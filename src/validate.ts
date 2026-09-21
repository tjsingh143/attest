/**
 * Attest — WP1 runner.
 *
 * Validates the harness before any of its results are used. Three claims are
 * checked, and the run fails if any of them does not hold:
 *
 *   detection    Every scenario's probe produces a DIFFERENT recorded outcome
 *                once its control is weakened. A probe whose answer does not
 *                change was never touching the control.
 *   restoration  Every weakening is reverted, and the control inventory read
 *                afterwards is byte-identical to the one read before.
 *   scoping      The over-privileged connections are checked for whether they
 *                can tell intact from broken. Where they cannot, that is the
 *                demonstration. Where one can, it is reported rather than
 *                hidden -- see the note in the report.
 *
 * "If the harness cannot detect a deliberately broken control, nothing
 * downstream is worth anything." So a detection failure exits non-zero and
 * says which scenario.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { DB, RUNS_ROOT } from "./config.ts";
import { adminSession, withSession } from "./db.ts";
import { buildInventory, runProbes } from "./inventory.ts";
import { readAppliedState, readSchemaVersion, shortVersion } from "./schema-version.ts";
import { SCENARIOS, runScenario, type ScenarioResult } from "./wp1.ts";
import { demonstrateForceRls, proveIdentities, type ForceRlsEvidence, type IdentityEvidence } from "./wp1-mechanisms.ts";
import { renderValidationMarkdown } from "./report-wp1.ts";
import type { EvidenceRecord } from "./evidence.ts";
import { readHarnessVersion, type HarnessVersion } from "./harness-version.ts";

export interface ValidationResult {
  readonly runId: string;
  readonly startedAt: string;
  readonly schemaVersion: string;
  readonly harness: HarnessVersion;
  readonly instance: string;
  readonly identities: IdentityEvidence;
  readonly forceRls: ForceRlsEvidence;
  readonly scenarios: readonly ScenarioResult[];
  readonly records: readonly EvidenceRecord[];
  readonly inventoryUnchanged: boolean;
  readonly inventoryDiff: string | null;
  readonly allDetected: boolean;
  readonly allRestored: boolean;
  /**
   * Records where the harness threw rather than the database answering. These
   * are not results; any run producing one has measured less than it claims.
   */
  readonly harnessErrors: readonly string[];
}

export async function validate(
  log: (s: string) => void = console.log,
  fixedRunId?: string,
): Promise<ValidationResult> {
  const startedAt = new Date();
  const schemaVersion = await readSchemaVersion();
  const runId =
    fixedRunId ??
    `${startedAt.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z")}-${shortVersion(schemaVersion)}`;
  const ctx = { runId, schemaVersion: schemaVersion.migrationSetSha256 };
  const harness = await readHarnessVersion();

  const result = await withSession(adminSession("wp1-orchestrator"), async (admin) => {
    const applied = await readAppliedState(admin, schemaVersion);
    if (!applied.matches) {
      throw new Error("the instance is not a build of these migration files. Run bringup.");
    }

    // The instance must be left exactly as found. Comparing the whole
    // inventory, rather than only the controls touched, catches a restore that
    // put something back in a subtly different shape.
    const before = JSON.stringify(buildInventory(await runProbes(admin)));

    log("  identities");
    const identities = await proveIdentities();
    for (const i of identities.identities) {
      log(`    ${i.label.padEnd(22)} current_user=${i.currentUser.padEnd(14)} bypasses_rls=${i.bypassesRls}`);
    }

    log("  force row level security");
    const forceRls = await demonstrateForceRls(admin);
    for (const s of forceRls.steps) log(`    ${s.state.padEnd(28)} → ${s.outcome}`);

    log("  deliberate-break scenarios");
    const scenarios: ScenarioResult[] = [];
    for (const spec of SCENARIOS) {
      const r = await runScenario(spec, admin, ctx);
      scenarios.push(r);
      const blind = r.overPrivileged.filter((o) => !o.discriminates).map((o) => o.identityLabel);
      log(
        `    ${r.id} ${r.family.padEnd(34)} detected=${r.detected ? "yes" : "NO"}  ` +
          `restored=${r.restored ? "yes" : "NO"}  blind: ${blind.join(", ") || "none"}`,
      );
    }

    const after = JSON.stringify(buildInventory(await runProbes(admin)));
    const inventoryUnchanged = before === after;

    return {
      runId,
      startedAt: startedAt.toISOString(),
      schemaVersion: schemaVersion.migrationSetSha256,
      harness,
      instance: `${DB.host}:${DB.port}/${DB.database}`,
      identities,
      forceRls,
      scenarios,
      records: scenarios.flatMap((s) => s.records),
      inventoryUnchanged,
      inventoryDiff: inventoryUnchanged ? null : "control inventory differs before and after the run",
      allDetected: scenarios.every((s) => s.detected),
      allRestored: scenarios.every((s) => s.restored),
      harnessErrors: [
        ...scenarios.flatMap((s) =>
          s.records.filter((r) => r.detail.harnessError).map((r) => `${r.recordId}: ${r.detail.message}`),
        ),
        ...identities.escalation
          .filter((e) => e.harnessError)
          .map((e) => `escalation probe "${e.statement}": ${e.outcome}`),
      ],
    } satisfies ValidationResult;
  });

  const runDir = join(RUNS_ROOT, result.runId);
  await mkdir(runDir, { recursive: true });
  await writeFile(join(runDir, "wp1-validation.json"), JSON.stringify(result, null, 2) + "\n");
  await writeFile(join(runDir, "wp1-validation.md"), renderValidationMarkdown(result));
  await writeFile(
    join(runDir, "evidence.json"),
    JSON.stringify(result.records, null, 2) + "\n",
  );

  log(`  ${result.records.length} evidence records written to evidence/runs/${result.runId}/`);
  return result;
}
