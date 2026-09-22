/**
 * Attest — WP2 application: score every resource under the authored rubric.
 *
 * Loads the ratings, checks them against the facts, runs the rubric's rules,
 * runs the single alternative exposure interpretation from Part 6, and writes
 * the CP3 report. It computes; it does not judge.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { DB, RUNS_ROOT } from "./config.ts";
import { adminSession, withSession } from "./db.ts";
import { buildRiskInputs, type RiskInput } from "./risk-inputs.ts";
import { readSchemaVersion, shortVersion } from "./schema-version.ts";
import { readHarnessVersion, type HarnessVersion } from "./harness-version.ts";
import { RATINGS } from "../rubric/ratings.ts";
import {
  ESTIMATOR, exposureIsInert, score, scoreAlternative, validate,
  type Level, type Scored, type SensitivityRow, type ValidationIssue,
} from "./scorer.ts";
import { renderCp3Markdown } from "./report-cp3.ts";

/** A machine-checked arithmetic guarantee about the estimate. */
export interface InvariantCheck {
  readonly name: string;
  readonly passed: boolean;
  readonly detail: string;
}

export interface Cp3Result {
  readonly runId: string;
  readonly startedAt: string;
  readonly schemaVersion: string;
  readonly harness: HarnessVersion;
  readonly instance: string;
  readonly scored: readonly Scored[];
  readonly distribution: Readonly<Record<Level, number>>;
  readonly sensitivity: readonly SensitivityRow[];
  /** Sum of the per-tier rows. Must equal the sum of per-resource tests. */
  readonly tierSubtotalPrimary: number;
  readonly tierSubtotalAlternative: number;
  /** Per-tier subtotal plus suite-level cases. The number to quote. */
  readonly totalTestsPrimary: number;
  readonly totalTestsAlternative: number;
  readonly invariants: readonly InvariantCheck[];
  readonly issues: readonly ValidationIssue[];
  /** Resources present in the facts but not rated, or rated but absent. */
  readonly coverageGaps: readonly string[];
  readonly estimator: typeof ESTIMATOR;
  /** How many resources' tiers were unaffected by the exposure dimension. */
  readonly exposureInertCount: number;
  /** Resources where exposure could have mattered, and what it did. */
  readonly exposureCouldHaveMattered: readonly { readonly resource: string; readonly impact: Level; readonly exposure: string; readonly tier: Level }[];
}

export async function runCp3(
  log: (s: string) => void = console.log,
  fixedRunId?: string,
): Promise<Cp3Result> {
  const startedAt = new Date();
  const sv = await readSchemaVersion();
  const runId =
    fixedRunId ??
    `${startedAt.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z")}-${shortVersion(sv)}`;
  const harness = await readHarnessVersion();

  const { inputs } = await withSession(adminSession("cp3"), (a) => buildRiskInputs(a));
  const facts = new Map<string, RiskInput>(inputs.resources.map((r) => [r.resource, r]));

  // Coverage: a rubric that silently skipped a resource would understate the
  // surface, which is the failure this harness has already had once.
  const rated = new Set(RATINGS.map((r) => r.resource));
  const coverageGaps = [
    ...inputs.resources.filter((r) => !rated.has(r.resource)).map((r) => `${r.resource}: in the inventory, not rated`),
    ...RATINGS.filter((r) => !facts.has(r.resource)).map((r) => `${r.resource}: rated, not in the inventory`),
  ];

  const issues: ValidationIssue[] = [];
  const scored: Scored[] = [];
  const sensitivity: SensitivityRow[] = [];

  for (const rating of RATINGS) {
    const f = facts.get(rating.resource);
    if (!f) continue;
    issues.push(...validate(rating));

    const primary = score(rating, f);
    const alternative = scoreAlternative(rating, f);
    scored.push(primary);
    sensitivity.push({
      resource: rating.resource,
      primaryTier: primary.tier,
      alternativeTier: alternative.tier,
      primaryTests: primary.tests,
      alternativeTests: alternative.tests,
      changed: primary.tier !== alternative.tier,
    });
  }

  const distribution: Record<Level, number> = { High: 0, Medium: 0, Low: 0 };
  for (const s of scored) distribution[s.tier]++;

  // --- estimator consistency, checked rather than asserted -----------------
  const perTierPrimary: Record<Level, number> = { High: 0, Medium: 0, Low: 0 };
  for (const s of scored) perTierPrimary[s.tier] += s.tests;
  const tierSubtotalPrimary = perTierPrimary.High + perTierPrimary.Medium + perTierPrimary.Low;
  const perResourcePrimary = scored.reduce((a, s) => a + s.tests, 0);

  const altByTier: Record<Level, number> = { High: 0, Medium: 0, Low: 0 };
  for (const row of sensitivity) altByTier[row.alternativeTier] += row.alternativeTests;
  const tierSubtotalAlternative = altByTier.High + altByTier.Medium + altByTier.Low;
  const perResourceAlternative = sensitivity.reduce((a, r) => a + r.alternativeTests, 0);

  const totalTestsPrimary = tierSubtotalPrimary + ESTIMATOR.suiteLevelCases;
  const totalTestsAlternative = tierSubtotalAlternative + ESTIMATOR.suiteLevelCases;

  const invariants: InvariantCheck[] = [
    {
      name: "Primary: sum of per-tier tests equals sum of per-resource tests",
      passed: tierSubtotalPrimary === perResourcePrimary,
      detail: `per-tier ${tierSubtotalPrimary} vs per-resource ${perResourcePrimary}`,
    },
    {
      name: "Primary: total equals per-tier subtotal plus suite-level cases",
      passed: totalTestsPrimary === tierSubtotalPrimary + ESTIMATOR.suiteLevelCases,
      detail: `${tierSubtotalPrimary} + ${ESTIMATOR.suiteLevelCases} = ${totalTestsPrimary}`,
    },
    {
      name: "Alternative: sum of per-tier tests equals sum of per-resource tests",
      passed: tierSubtotalAlternative === perResourceAlternative,
      detail: `per-tier ${tierSubtotalAlternative} vs per-resource ${perResourceAlternative}`,
    },
    {
      name: "Alternative: total equals per-tier subtotal plus suite-level cases",
      passed: totalTestsAlternative === tierSubtotalAlternative + ESTIMATOR.suiteLevelCases,
      detail: `${tierSubtotalAlternative} + ${ESTIMATOR.suiteLevelCases} = ${totalTestsAlternative}`,
    },
    {
      name: "No tier subtotal exceeds the plan total",
      passed: ([perTierPrimary.High, perTierPrimary.Medium, perTierPrimary.Low] as const).every((n) => n <= totalTestsPrimary),
      detail: `High ${perTierPrimary.High}, Medium ${perTierPrimary.Medium}, Low ${perTierPrimary.Low}, total ${totalTestsPrimary}`,
    },
  ];

  const result: Cp3Result = {
    runId,
    startedAt: startedAt.toISOString(),
    schemaVersion: sv.migrationSetSha256,
    harness,
    instance: `${DB.host}:${DB.port}/${DB.database}`,
    scored: scored.sort((a, b) => {
      const order: Record<Level, number> = { High: 0, Medium: 1, Low: 2 };
      return order[a.tier] - order[b.tier] || a.resource.localeCompare(b.resource);
    }),
    distribution,
    sensitivity,
    tierSubtotalPrimary,
    tierSubtotalAlternative,
    totalTestsPrimary,
    totalTestsAlternative,
    invariants,
    issues,
    coverageGaps,
    estimator: ESTIMATOR,
    exposureInertCount: RATINGS.filter((r) => facts.has(r.resource) && exposureIsInert(r)).length,
    exposureCouldHaveMattered: scored
      .filter((s) => !exposureIsInert(s.rating))
      .map((s) => ({ resource: s.resource, impact: s.impact, exposure: s.scoredExposure, tier: s.tier })),
  };

  const runDir = join(RUNS_ROOT, runId);
  await mkdir(runDir, { recursive: true });
  await writeFile(join(runDir, "cp3-tiers.json"), JSON.stringify(result, null, 2) + "\n");
  await writeFile(join(runDir, "cp3-tiers.md"), renderCp3Markdown(result));

  log(`  ${scored.length} resources scored — High ${distribution.High}, Medium ${distribution.Medium}, Low ${distribution.Low}`);
  log(`  estimated tests: ${result.totalTestsPrimary} primary, ${result.totalTestsAlternative} under the sensitivity alternative`);
  const failed = invariants.filter((i) => !i.passed);
  for (const f of failed) log(`  !! ESTIMATOR INVARIANT FAILED — ${f.name}: ${f.detail}`);
  if (coverageGaps.length) for (const g of coverageGaps) log(`  !! coverage gap — ${g}`);
  if (issues.length) for (const i of issues) log(`  !! ${i.resource}: ${i.problem}`);
  log(`  written to evidence/runs/${runId}/`);
  return result;
}
