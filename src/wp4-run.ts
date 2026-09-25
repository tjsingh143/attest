/**
 * Attest — one WP4 schema state: rebuild, inventory, and the approved probes
 * that the state can honestly execute (D3.56).
 *
 * Runs in its own process with `ATTEST_SUT_REPO` pointing at the state's
 * scratch directory, so `bringup`, the schema hash and every rebuild read that
 * state's migrations — while the read-only guard still fingerprints the
 * protected checkout (`ARC21_CHECKOUT`) before, during and after.
 *
 * The probes are the APPROVED WP3 probes, from the planning run of the current
 * state — not re-planned against the historical schema, because a historical
 * plan would be a different set of questions. A probe is executed in a state
 * only if the state can answer it as approved:
 *
 *   - every baseline fixture it rests on applies to this schema and verifies
 *   - its derived statement compiles here (PREPARE resolves every name)
 *   - every admin read its binding makes compiles here
 *   - its probe-scoped setup, if any, applies and verifies
 *   - every premise holds on that setup
 *
 * Anything else is recorded as INCOMPATIBLE with the reason — never as a pass
 * and never as a failure. The compatible probes then run through the same
 * executor and judge as WP3, with rebuild isolation against this state.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { DB, RUNS_ROOT } from "./config.ts";
import { adminSession, withSession, type Session } from "./db.ts";
import { bringup } from "./bringup.ts";
import { buildInventory, runProbes, type Inventory } from "./inventory.ts";
import { renderInventoryMarkdown } from "./report.ts";
import { readAppliedState, readSchemaVersion } from "./schema-version.ts";
import { readHarnessVersion } from "./harness-version.ts";
import type { Wp3Plan } from "./wp3-plan.ts";
import { deriveAll } from "./wp3-exec.ts";
import { prepareAll, runTests, type PreparedProbe, type RunContext } from "./wp3-execute.ts";
import { SEED_EXTENSION_IMPLS, verifyOne } from "./seed-extensions.ts";
import { applySetupInTxn } from "./wp3-readiness.ts";
import { loadIntentStore } from "./author-intents.ts";
import type { Arc21SourceState } from "./arc21-guard.ts";

export interface CompatibilityResult {
  readonly okExtensions: ReadonlySet<string>;
  readonly failedExtensions: readonly { readonly key: string; readonly reason: string }[];
  readonly compatible: readonly string[];
  readonly incompatible: readonly { readonly testId: string; readonly reason: string }[];
}

async function tryIn(admin: Session, fn: () => Promise<void>): Promise<string | null> {
  await admin.query("savepoint wp4_try");
  try {
    await fn();
    await admin.query("release savepoint wp4_try");
    return null;
  } catch (err) {
    await admin.query("rollback to savepoint wp4_try");
    return (err as Error).message.split("\n")[0]!;
  }
}

/** Decide, inside one never-committed transaction, which approved probes this schema can answer. */
export async function checkCompatibility(admin: Session, plan: Wp3Plan, prepared: ReadonlyMap<string, PreparedProbe>): Promise<CompatibilityResult> {
  const okExtensions = new Set<string>();
  const failedExtensions: { key: string; reason: string }[] = [];
  const incompatible: { testId: string; reason: string }[] = [];
  const compatible: string[] = [];
  await admin.query("begin");
  try {
    for (const impl of SEED_EXTENSION_IMPLS) {
      if (impl.scope !== "baseline") continue;
      const err = await tryIn(admin, async () => {
        for (const sql of impl.statements) await admin.query(sql);
        const v = await verifyOne(admin, impl);
        if (!v.ok) throw new Error(`applied but does not verify: ${v.detail}`);
      });
      if (err) failedExtensions.push({ key: impl.key, reason: err }); else okExtensions.add(impl.key);
    }
    const needs = new Map<string, string[]>();
    for (const e of plan.seedExtensions) {
      if (e.scope !== "baseline") continue;
      for (const id of e.requiredBy) needs.set(id, [...(needs.get(id) ?? []), e.key]);
    }
    for (const t of plan.tests) {
      const p = prepared.get(t.testId);
      if (!p) { incompatible.push({ testId: t.testId, reason: "no prepared probe" }); continue; }
      const missing = (needs.get(t.testId) ?? []).filter((k) => !okExtensions.has(k));
      if (missing.length) {
        incompatible.push({ testId: t.testId, reason: `baseline fixture(s) that do not apply to this schema: ${missing.map((k) => `${k} (${failedExtensions.find((f) => f.key === k)?.reason ?? "not applied"})`).join("; ")}` });
        continue;
      }
      const reasons: string[] = [];
      const compile = async (what: string, sql: string) => {
        const e = await tryIn(admin, async () => { await admin.query(`prepare attest_wp4_probe as ${sql}`); await admin.query("deallocate attest_wp4_probe"); });
        if (e) reasons.push(`${what} does not compile here: ${e}`);
      };
      if (p.spec.kind === "sql" || p.spec.kind === "rpc") {
        for (const ps of p.spec.preStatements ?? []) await compile("a pre-statement", ps.sql);
        await compile("the approved statement", p.spec.statement);
      }
      // Catalog and audit-absence probes read a relation by name: absent from this schema, they cannot be asked.
      if (p.spec.assertSql) await compile("the catalog assertion", p.spec.assertSql);
      const b = p.binding;
      for (const c of Object.values(b.catalog)) await compile(`catalog fact ${c.id}`, c.sql);
      for (const [n, g] of Object.entries(b.guards)) {
        if (g.snap?.kind === "sql") await compile(`guard ${n}`, g.snap.sql);
        if (g.after) await compile(`guard ${n}`, g.after.sql);
      }
      for (const [n, r] of Object.entries(b.results)) {
        if (r.admin) await compile(`result ${n}`, r.admin.sql);
        if (r.adminBefore) await compile(`result ${n}`, r.adminBefore.sql);
      }
      if (b.reachability) await compile("reachability", b.reachability.sql);
      if (b.reference) await compile("the reference statement", b.reference.statement);
      if (!reasons.length) {
        // Premises, on the probe's own setup, inside a savepoint that is always undone.
        const err = await tryIn(admin, async () => {
          if (b.setupKey) await applySetupInTxn(admin, b.setupKey);
          const bad: string[] = [];
          for (const c of b.premises) {
            const r = (await admin.query(c.sql, c.params as unknown[])).rows[0] as { ok?: boolean; detail?: string } | undefined;
            if (r?.ok !== true) bad.push(`${c.describe}: ${String(r?.detail ?? "no row")}`);
          }
          if (bad.length) throw new Error(`a premise does not hold in this schema state: ${bad.slice(0, 2).join("; ")}`);
          throw new Error("__rollback_ok__");
        });
        if (err && err !== "__rollback_ok__") reasons.push(err);
      }
      if (reasons.length) incompatible.push({ testId: t.testId, reason: reasons.slice(0, 3).join(" | ") });
      else compatible.push(t.testId);
    }
  } finally {
    await admin.query("rollback");
  }
  return { okExtensions, failedExtensions, compatible, incompatible };
}

export interface StateRunOutput {
  readonly dir: string;
  readonly schemaHash: string;
  readonly inventory: Inventory;
  readonly compatibility: CompatibilityResult | null;
  readonly results: { readonly recorded: number; readonly byVerdict: Record<string, number>; readonly aborted: unknown } | null;
}

/** Rebuild this state, read its inventory and, when asked, execute its compatible approved probes. */
export async function runState(opts: {
  runId: string;
  state: string;
  stateMeta: Record<string, unknown>;
  planRunId: string;
  runProbes: boolean;
  arc21Pre: Arc21SourceState;
  log: (s: string) => void;
}): Promise<StateRunOutput> {
  const dir = join(RUNS_ROOT, opts.runId, "wp4", opts.state);
  await mkdir(dir, { recursive: true });
  const sv = await readSchemaVersion();
  opts.log(`  state ${opts.state}: ${sv.migrationCount} migrations, schema ${sv.migrationSetSha256.slice(0, 12)}…`);
  const b = await bringup((s) => opts.log(s));
  opts.log(`  rebuilt in ${b.resetSeconds.toFixed(1)}s and seeded`);
  const harness = await readHarnessVersion();

  const inventory = await withSession(adminSession("wp4-inventory"), async (a) => {
    const applied = await readAppliedState(a, sv);
    if (!applied.matches) throw new Error(`the instance is not a build of this state's migrations`);
    const inv = buildInventory(await runProbes(a));
    const meta = { runId: `${opts.runId}/${opts.state}`, startedAt: new Date().toISOString(), schemaVersion: sv, readAs: a.identity, instance: `${DB.host}:${DB.port}/${DB.database}`, harness };
    await writeFile(join(dir, "inventory.json"), JSON.stringify(inv, null, 2) + "\n");
    await writeFile(join(dir, "inventory.md"), renderInventoryMarkdown(inv, meta));
    return inv;
  });
  opts.log(`  inventory: ${inventory.counts.resources} resources, ${inventory.counts.controls} controls`);

  const stateJson = {
    WARNING: "WP4 drift run of ONE schema state. Not the WP3 assessment of the current state; a historical state's results say what that state's schema did, not what Arc21 does today.",
    runId: opts.runId, state: opts.state, ...opts.stateMeta,
    schemaVersion: sv.migrationSetSha256, migrationCount: sv.migrationCount,
    migrations: sv.migrations.map((m) => ({ filename: m.filename, sha256: m.sha256 })),
    harness, inventoryCounts: inventory.counts, recordedAt: new Date().toISOString(),
  };
  if (!opts.runProbes) {
    await writeFile(join(dir, "state.json"), JSON.stringify({ ...stateJson, probes: "not executed in this state" }, null, 2) + "\n");
    return { dir, schemaHash: sv.migrationSetSha256, inventory, compatibility: null, results: null };
  }

  const plan = (JSON.parse(await readFile(join(RUNS_ROOT, opts.planRunId, "wp3-matrix.json"), "utf8")) as { plan: Wp3Plan }).plan;
  const { specs, failures } = deriveAll(plan);
  if (failures.length) throw new Error(`the approved plan does not derive: ${failures.slice(0, 2).map((f) => f.testId).join(", ")}`);
  const prepared = prepareAll(plan, specs);
  const compat = await withSession(adminSession("wp4-compatibility"), (a) => checkCompatibility(a, plan, prepared));
  opts.log(`  compatible: ${compat.compatible.length} of ${plan.tests.length}; baseline fixtures applying: ${compat.okExtensions.size}, not applying: ${compat.failedExtensions.length}`);

  const ctx: RunContext = {
    runId: `${opts.runId}/${opts.state}`,
    sut: {
      schemaVersion: sv.migrationSetSha256, migrationCount: sv.migrationCount,
      arc21: { commit: String(opts.stateMeta.commit ?? "(working tree copy)"), branch: "(wp4 scratch state)", dirty: false, uncommittedMigrations: [], fingerprintBefore: opts.arc21Pre.fingerprint },
      instance: `${DB.host}:${DB.port}/${DB.database}`,
    },
    harness, store: await loadIntentStore(), arc21Pre: opts.arc21Pre, expectedSchema: sv.migrationSetSha256, log: opts.log,
    extensionFilter: compat.okExtensions,
  };
  const ids = plan.tests.map((t) => t.testId).filter((id) => compat.compatible.includes(id));
  const summary = await runTests(ctx, prepared, ids);
  await writeFile(join(dir, "results.json"), JSON.stringify({
    ...stateJson,
    probes: { approved: plan.tests.length, compatible: compat.compatible.length, incompatible: compat.incompatible.length, recorded: summary.records.length },
    baselineFixtures: { applying: [...compat.okExtensions], notApplying: compat.failedExtensions },
    incompatible: compat.incompatible,
    byVerdict: summary.byVerdict, byObservation: summary.byObservation, harnessErrors: summary.harnessErrors,
    rebuilds: summary.rebuilds, rebuildSeconds: summary.rebuildSeconds, elapsedSeconds: summary.elapsedSeconds, aborted: summary.aborted,
    records: summary.records,
  }, null, 2) + "\n");
  opts.log(`  recorded ${summary.records.length}: ${JSON.stringify(summary.byVerdict)}${summary.aborted ? ` — ABORTED: ${JSON.stringify(summary.aborted)}` : ""}`);
  return { dir, schemaHash: sv.migrationSetSha256, inventory, compatibility: compat, results: { recorded: summary.records.length, byVerdict: summary.byVerdict, aborted: summary.aborted } };
}
