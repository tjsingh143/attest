/**
 * Attest — the approved WP3 matrix, frozen.
 *
 * Preflight used to check that the plan carried 345 Test IDs. That is a count,
 * and a count cannot tell "the approved 345" from "344 of them plus one
 * substitute". It also cannot tell whether an approved row's operation,
 * expectation or rationale drifted when the planner was edited — and the
 * planner is edited: C1's resolution (D3.33) is a planner change.
 *
 * So the approved matrix is frozen here as a manifest: every Test ID, in
 * order, with a hash of the fields that define the security question the row
 * asks, its identity, and a hash of its fixture. Preflight compares the plan it
 * is about to execute against this, field by field. A difference is a change to
 * an approved row, and a change to an approved row is the author's decision,
 * made explicitly, never something a regeneration does quietly.
 *
 * ## Corrections are listed, not absorbed
 *
 * The manifest was built from the approved planning run with a list of
 * corrections applied, and the list is kept inside it. Each correction names
 * the Test ID, the field, the approved value, the corrected value, why the
 * approved value was internally contradictory, and the DECISIONS entry. The
 * builder refuses a correction whose `from` does not match the approved run,
 * so the list cannot describe a change that was not made.
 *
 * The frozen fields exclude `identity` and `fixture` on purpose: those two are
 * the metadata this pass corrects, and they are pinned separately, so the
 * manifest can show that nothing else moved.
 */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ATTEST_ROOT, RUNS_ROOT } from "./config.ts";
import type { PlannedTest, Wp3Plan } from "./wp3-plan.ts";

export const APPROVED_PATH = join(ATTEST_ROOT, "rubric", "wp3-approved-matrix.json");

/** The fields that define the question a row asks. Any change here is a change to an approved test. */
export const FROZEN_FIELDS = [
  "testId", "family", "resource", "control", "tier", "polarity",
  "operation", "expected", "covers", "plumbing", "verdictWhenPredicted", "authorIntent",
] as const;

export interface ApprovedRow {
  readonly testId: string;
  readonly family: string;
  readonly polarity: string;
  readonly tier: string;
  /** The approved identity, after any correction listed in the manifest. */
  readonly identity: string;
  readonly frozenSha256: string;
  readonly fixtureSha256: string;
}

export interface ApprovedCorrection {
  readonly testId: string;
  /**
   * `identity` and `fixture` are metadata corrections (D3.33, D3.34, D3.38).
   * `operation`, `expected` and `covers` are frozen fields: each such correction
   * exists only because the author decided it at Gate A (D3.54) and names that
   * decision; `apply-gate-a` refuses one no decision authorises.
   */
  readonly field: "identity" | "fixture" | "operation" | "expected" | "covers";
  readonly from: string;
  readonly to: string;
  readonly reason: string;
  readonly decision: string;
}

export interface ApprovedManifest {
  readonly WARNING: string;
  /** The planning run the author approved. */
  readonly sourceRunId: string;
  /** sha256 of that run's wp3-matrix.json, as committed. */
  readonly sourceMatrixSha256: string;
  readonly frozenFields: readonly string[];
  readonly counts: { readonly total: number; readonly positive: number; readonly negative: number; readonly characterization: number };
  readonly corrections: readonly ApprovedCorrection[];
  readonly rows: readonly ApprovedRow[];
}

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export function frozenHash(t: PlannedTest): string {
  const rec = t as unknown as Record<string, unknown>;
  return sha256(JSON.stringify(FROZEN_FIELDS.map((f) => rec[f] ?? null)));
}

export function fixtureHash(t: PlannedTest): string {
  return sha256(t.fixture);
}

const WARNING =
  "FROZEN INPUT. The approved WP3 matrix: every Test ID, its frozen fields, its identity and its fixture. " +
  "Nothing regenerates this file. A change to an approved row is the author's decision and needs a new " +
  "correction entry here and a DECISIONS entry. Preflight refuses a plan that differs from it.";

/**
 * Build the manifest from the approved run's rows plus a list of corrections.
 *
 * Throws if a correction's `from` does not match the approved value, or names a
 * Test ID the approved run does not have.
 */
export function buildManifest(
  approvedTests: readonly PlannedTest[],
  source: { runId: string; matrixSha256: string },
  corrections: readonly ApprovedCorrection[],
): ApprovedManifest {
  const byId = new Map(approvedTests.map((t) => [t.testId, { ...t }]));
  for (const c of corrections) {
    const t = byId.get(c.testId);
    if (!t) throw new Error(`correction names ${c.testId}, which the approved run does not contain`);
    if (t[c.field] !== c.from) {
      throw new Error(`correction for ${c.testId}.${c.field} says the approved value was "${c.from.slice(0, 60)}…", but it was "${String(t[c.field]).slice(0, 60)}…"`);
    }
    (t as Record<string, unknown>)[c.field] = c.to;
  }
  const rows = approvedTests.map((orig) => {
    const t = byId.get(orig.testId)!;
    return {
      testId: t.testId, family: t.family, polarity: t.polarity, tier: String(t.tier),
      identity: t.identity, frozenSha256: frozenHash(t), fixtureSha256: fixtureHash(t),
    };
  });
  const count = (p: string) => rows.filter((r) => r.polarity === p).length;
  return {
    WARNING,
    sourceRunId: source.runId,
    sourceMatrixSha256: source.matrixSha256,
    frozenFields: [...FROZEN_FIELDS],
    counts: { total: rows.length, positive: count("positive"), negative: count("negative"), characterization: count("characterization") },
    corrections,
    rows,
  };
}

export async function loadApprovedManifest(): Promise<ApprovedManifest | null> {
  try {
    return JSON.parse(await readFile(APPROVED_PATH, "utf8")) as ApprovedManifest;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw new Error(`${APPROVED_PATH} is present but unreadable: ${(err as Error).message}`);
  }
}

export interface ApprovedComparison {
  readonly missing: readonly string[];
  readonly extra: readonly string[];
  readonly duplicated: readonly string[];
  readonly orderChanged: boolean;
  /** A frozen field — the question the row asks — differs from the approved row. */
  readonly frozenDrift: readonly string[];
  readonly identityDrift: readonly string[];
  readonly fixtureDrift: readonly string[];
  readonly identical: boolean;
}

/** Compare the plan about to be executed against the approved manifest. */
export function compareToApproved(plan: Wp3Plan, m: ApprovedManifest): ApprovedComparison {
  const approved = new Map(m.rows.map((r) => [r.testId, r]));
  const ids = plan.tests.map((t) => t.testId);
  const seen = new Set<string>();
  const duplicated = ids.filter((id) => (seen.has(id) ? true : (seen.add(id), false)));
  const missing = m.rows.map((r) => r.testId).filter((id) => !seen.has(id));
  const extra = [...seen].filter((id) => !approved.has(id));
  const orderChanged =
    missing.length === 0 && extra.length === 0 && duplicated.length === 0 &&
    ids.some((id, i) => m.rows[i]?.testId !== id);
  const frozenDrift: string[] = [];
  const identityDrift: string[] = [];
  const fixtureDrift: string[] = [];
  for (const t of plan.tests) {
    const a = approved.get(t.testId);
    if (!a) continue;
    if (frozenHash(t) !== a.frozenSha256) frozenDrift.push(t.testId);
    if (t.identity !== a.identity) identityDrift.push(`${t.testId}: "${a.identity}" -> "${t.identity}"`);
    if (fixtureHash(t) !== a.fixtureSha256) fixtureDrift.push(t.testId);
  }
  return {
    missing, extra, duplicated, orderChanged, frozenDrift, identityDrift, fixtureDrift,
    identical:
      !missing.length && !extra.length && !duplicated.length && !orderChanged &&
      !frozenDrift.length && !identityDrift.length && !fixtureDrift.length,
  };
}

/**
 * Is the manifest itself reproducible from the approved run it names?
 *
 * Rebuilds it from `evidence/runs/<sourceRunId>/wp3-matrix.json` and the listed
 * corrections, and compares. Returns null when that run is no longer in the
 * tree — it is in git history, and the manifest records its hash.
 */
export async function manifestReproducible(m: ApprovedManifest): Promise<{ ok: boolean; detail: string } | null> {
  let raw: string;
  try {
    raw = await readFile(join(RUNS_ROOT, m.sourceRunId, "wp3-matrix.json"), "utf8");
  } catch {
    return null;
  }
  const sha = sha256(raw);
  if (sha !== m.sourceMatrixSha256) {
    return { ok: false, detail: `the approved run's wp3-matrix.json hashes to ${sha.slice(0, 16)}…, not the recorded ${m.sourceMatrixSha256.slice(0, 16)}…` };
  }
  let rebuilt: ApprovedManifest;
  try {
    rebuilt = buildManifest((JSON.parse(raw) as { plan: Wp3Plan }).plan.tests, { runId: m.sourceRunId, matrixSha256: sha }, m.corrections);
  } catch (err) {
    return { ok: false, detail: `rebuilding from the approved run failed: ${(err as Error).message}` };
  }
  const same = JSON.stringify(rebuilt.rows) === JSON.stringify(m.rows) && JSON.stringify(rebuilt.counts) === JSON.stringify(m.counts);
  return {
    ok: same,
    detail: same
      ? `rebuilt from ${m.sourceRunId} plus ${m.corrections.length} listed correction(s): identical`
      : `rebuilding from ${m.sourceRunId} plus the listed corrections does NOT reproduce the manifest`,
  };
}
