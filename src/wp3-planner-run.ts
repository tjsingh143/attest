/**
 * Attest — generate the WP3 plan. Plans only; executes no control test.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { RUNS_ROOT, APPLICATION_SCHEMAS } from "./config.ts";
import { adminSession, withSession } from "./db.ts";
import { buildRiskInputs } from "./risk-inputs.ts";
import { runProbes } from "./inventory.ts";
import { readSchemaVersion, shortVersion } from "./schema-version.ts";
import { readHarnessVersion } from "./harness-version.ts";
import { RATINGS } from "../rubric/ratings.ts";
import { deriveImpact, scoredExposure, type Level } from "./scorer.ts";
import { planWp3 } from "./wp3-plan.ts";
import { reconcile, renderWp3PlanMarkdown } from "./report-wp3-plan.ts";
import { validatePlan } from "./wp3-validate-plan.ts";
import { buildWorksheet, writeWorksheet } from "./intent-worksheet.ts";
import { loadIntentStore } from "./author-intents.ts";

/** Recompute the frozen tiers rather than reading a stale file. */
const MATRIX: Record<Level, Record<"server_only" | "authenticated" | "anonymous", Level>> = {
  Low: { server_only: "Low", authenticated: "Low", anonymous: "Medium" },
  Medium: { server_only: "Medium", authenticated: "Medium", anonymous: "High" },
  High: { server_only: "High", authenticated: "High", anonymous: "High" },
};

/**
 * Build the plan in memory, with no artefacts written.
 *
 * Every command that needs the matrix — preflight, drafting, execution — needs
 * the SAME matrix, built from the same inputs. Sharing one builder is what
 * keeps them from disagreeing, and it is why none of them reads a file: a
 * stale artefact on disk would be indistinguishable from a current one.
 */
export async function buildPlanInProcess(): Promise<{
  plan: ReturnType<typeof planWp3>;
  resources: Awaited<ReturnType<typeof buildRiskInputs>>["inputs"]["resources"];
  runId: string;
  schemaVersion: string;
}> {
  const startedAt = new Date();
  const sv = await readSchemaVersion();
  const runId = `${startedAt.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z")}-${shortVersion(sv)}`;
  const { inputs, definers } = await withSession(adminSession("wp3-plan"), async (a) => {
    const { inputs } = await buildRiskInputs(a);
    const raw = await runProbes(a);
    const highSet = new Set(
      RATINGS.filter((r) => MATRIX[deriveImpact(r).impact][scoredExposure(r.exposure)] === "High").map((r) => r.resource),
    );
    const definers = raw.routines
      .filter((f) => f.security_definer === true)
      .map((f) => {
        const body = String(f.definition ?? "");
        const touches = [...highSet].filter((h) => {
          const [schema, name] = h.split(".");
          return name ? new RegExp(`\\b${schema}\\.${name}\\b`, "i").test(body) : false;
        });
        return {
          resource: String(f.resource),
          executableBy: Array.isArray(f.executable_by) ? f.executable_by.map(String) : [],
          touches,
        };
      })
      .filter((f) => f.touches.length > 0);
    return { inputs, definers };
  });
  const tiers = new Map<string, Level>(
    RATINGS.map((r) => [r.resource, MATRIX[deriveImpact(r).impact][scoredExposure(r.exposure)]]),
  );
  return {
    plan: planWp3(inputs.resources, tiers, definers),
    resources: inputs.resources,
    runId,
    schemaVersion: sv.migrationSetSha256,
  };
}

export async function runWp3Planner(
  log: (s: string) => void = console.log,
  fixedRunId?: string,
  estimate?: number,
): Promise<{ planned: number; awaitingIntent: number; issues: ReturnType<typeof validatePlan>; worksheetValid: boolean }> {
  const startedAt = new Date();
  const sv = await readSchemaVersion();
  const runId =
    fixedRunId ??
    `${startedAt.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z")}-${shortVersion(sv)}`;
  const harness = await readHarnessVersion();

  const { inputs, definers } = await withSession(adminSession("wp3-plan"), async (a) => {
    const { inputs } = await buildRiskInputs(a);
    const raw = await runProbes(a);
    // Client-callable SECURITY DEFINER functions that name a High-tier resource.
    const highSet = new Set(
      RATINGS.filter((r) => MATRIX[deriveImpact(r).impact][scoredExposure(r.exposure)] === "High").map(
        (r) => r.resource,
      ),
    );
    const definers = raw.routines
      .filter((f) => f.security_definer === true)
      .map((f) => {
        const body = String(f.definition ?? "");
        const touches = [...highSet].filter((h) => {
          const [schema, name] = h.split(".");
          return name ? new RegExp(`\\b${schema}\\.${name}\\b`, "i").test(body) : false;
        });
        return {
          resource: String(f.resource),
          executableBy: Array.isArray(f.executable_by) ? f.executable_by.map(String) : [],
          touches,
        };
      })
      .filter((f) => f.touches.length > 0);
    return { inputs, definers };
  });

  const tiers = new Map<string, Level>(
    RATINGS.map((r) => [r.resource, MATRIX[deriveImpact(r).impact][scoredExposure(r.exposure)]]),
  );

  const plan = planWp3(inputs.resources, tiers, definers);
  const rec = reconcile(plan, estimate ?? 185);
  const planIssues = validatePlan(plan, inputs.resources);

  const runDir = join(RUNS_ROOT, runId);
  await mkdir(runDir, { recursive: true });
  await writeFile(join(runDir, "wp3-matrix.json"), JSON.stringify({ plan, reconciliation: rec, semanticValidation: planIssues }, null, 2) + "\n");
  await writeFile(
    join(runDir, "wp3-matrix.md"),
    renderWp3PlanMarkdown(plan, rec, {
      runId, schemaVersion: sv.migrationSetSha256, harness: `${harness.version} sources ${harness.sourcesSha256.slice(0, 12)}`,
    }),
  );

  log(`  ${rec.totalPlanned} tests planned — High ${rec.highPlanned}, Medium ${rec.mediumPlanned}, suite ${rec.suitePlanned}`);
  log(`  estimate was ${rec.estimate}; difference ${rec.difference >= 0 ? "+" : ""}${rec.difference}`);
  log(`  ${plan.notApplicable.length} (family, resource) pairs marked not applicable with a stated reason`);
  log(`  ${rec.negativesAwaitingIntent} negative tests awaiting AUTHOR INTENT`);
  // The AUTHOR INTENT worksheet is generated from the same plan, so it can
  // never drift from the matrix it is meant to describe.
  const worksheet = buildWorksheet(plan, await loadIntentStore());
  await writeWorksheet(worksheet, runDir, { runId, schemaVersion: sv.migrationSetSha256 });
  log(`  author-intent worksheet: ${worksheet.rows.length} rows in ${worksheet.batches.length} batches — ${worksheet.valid ? "validation passes" : "VALIDATION FAILED"}`);
  for (const v of worksheet.validation.filter((x) => !x.passed)) log(`       !! ${v.check}: ${v.detail}`);

  if (planIssues.length) {
    log(`  !! ${planIssues.length} semantic validation issue(s):`);
    const byCheck = new Map<string, number>();
    for (const i of planIssues) byCheck.set(i.check, (byCheck.get(i.check) ?? 0) + 1);
    for (const [c, n] of byCheck) log(`       ${c}: ${n}`);
  } else {
    log("  semantic validation: clean");
  }
  log(`  written to evidence/runs/${runId}/`);
  return { planned: rec.totalPlanned, awaitingIntent: rec.negativesAwaitingIntent, issues: planIssues, worksheetValid: worksheet.valid };
}
