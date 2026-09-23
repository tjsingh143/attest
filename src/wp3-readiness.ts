/**
 * Attest — WP3 execution readiness: would each verdict mean what it says?
 *
 * Preflight asks whether the plan is intact, its fixtures exist and the author
 * has spoken. This module asks the question those leave open. D3.36 found that
 * a full run would have recorded dozens of verdicts that meant nothing — empty
 * subject sets, positives that could not reach their control, "no effect"
 * judged by a return value, premises the fixture contradicted, state claims
 * nobody checked, probes contaminating each other. Each class is now a check,
 * and each check is either STATIC (over the plan, the derived probes, the claim
 * spans and the bindings) or LIVE (admin reads on a verified baseline, with a
 * probe-scoped setup applied only inside a transaction that is rolled back).
 *
 *   R1  every claim span of every approved expectation has an implemented evaluator
 *   R2  no vacuous target: every probe whose verdict depends on rows states a subject
 *       or relationship premise, and every premise holds live
 *   R3  every positive reaches its control: INSERT positives supply every required
 *       column and collide with no unique key, on the probe's own setup
 *   R4  every "no effect" claim is judged from a state guard, never a return value
 *   R5  every stated premise — fixture, relationship, identity — holds live
 *   R6  every state claim has a guard, and every evaluator's inputs are bound
 *   R7  isolation: every probe runs on a rebuilt, verified baseline after any state
 *       change; the strategy is available and its classification is complete
 *
 * None of it executes a probe. The live checks are the same admin reads the
 * executor makes before a probe, run in advance.
 */
import type { Session } from "./db.ts";
import type { Wp3Plan } from "./wp3-plan.ts";
import type { PreparedProbe } from "./wp3-execute.ts";
import { validateClaimCoverage } from "./wp3-claims.ts";
import { evaluatorExists } from "./wp3-evaluate.ts";
import { implFor } from "./seed-extensions.ts";
import { REGISTERED_CONTRADICTIONS, checkRegisteredContradictions } from "./wp3-contradictions.ts";
import { claimsFor } from "./wp3-exec.ts";
import { subjectExemption } from "./wp3-bindings.ts";

export interface ReadinessCheck {
  readonly id: string;
  readonly name: string;
  readonly passed: boolean;
  readonly testIds: readonly string[];
  readonly detail: string;
  readonly rows: readonly { readonly testId: string; readonly why: string }[];
}

const make = (id: string, name: string, rows: { testId: string; why: string }[], okDetail: string): ReadinessCheck => ({
  id, name, passed: rows.length === 0, testIds: [...new Set(rows.map((r) => r.testId))], rows,
  detail: rows.length ? `${rows.length} problem(s): ${[...new Set(rows.map((r) => r.testId))].slice(0, 6).join(", ")}${rows.length > 6 ? ", …" : ""}` : okDetail,
});

// ---------------------------------------------------------------------------
// static
// ---------------------------------------------------------------------------

/** R1 / §17: every approved expectation fully covered, every claim evaluable. */
export function checkClaimCoverage(plan: Wp3Plan): ReadinessCheck {
  const rows = validateClaimCoverage(plan.tests, evaluatorExists).map((i) => ({ testId: i.testId, why: i.problem }));
  return make("R1", "every claim of every approved expectation has an implemented evaluator", rows,
    `all ${plan.tests.length} expectations are covered span by span, and every span's evaluator is implemented`);
}

/** R6 + §8: every evaluator a span names has the per-row input it needs. */
export function checkBindingsComplete(prepared: ReadonlyMap<string, PreparedProbe>): ReadinessCheck {
  const rows: { testId: string; why: string }[] = [];
  const RUNNER_KINDS = new Set(["f7_mechanism", "f7_roles", "f9", "socket", "http"]);
  for (const p of prepared.values()) {
    const { t, spec, binding: b } = p;
    for (const s of p.spans) {
      const e = s.eval;
      if (!e) continue;
      const need = (ok: boolean, why: string) => { if (!ok) rows.push({ testId: t.testId, why: `"${s.text}" (${e}): ${why}` }); };
      if (e.startsWith("state:")) {
        const key = e.slice(6);
        if (key === "stale_expiry_permitted") need(b.guards.guard2?.permitsStaleExpiry === true, "no guard declares the stale-expiry permission");
        else need(!!b.guards[key], `no state guard '${key}' is bound — the state claim would go unchecked`);
      } else if (e.startsWith("catalog:")) need(!!b.catalog[e.slice(8)], `no catalog fact '${e.slice(8)}' is bound`);
      else if (e.startsWith("premise:")) need(b.premises.some((x) => x.id === e.slice(8)), `no premise '${e.slice(8)}' is bound`);
      else if (e === "reference:identical") need(!!b.reference, "no reference observation is bound");
      else if (e.startsWith("mech:trigger:")) need(!!b.namedTrigger, "the named trigger is not resolved to its function");
      else if (e.startsWith("runner:")) need(RUNNER_KINDS.has(spec.kind), `a runner claim on a ${spec.kind} probe`);
      else if (e === "result:only_own" || e === "result:own_queue_entry" || e === "result:non_friend_projection") need(!!b.results[e.slice(7)], `no result check '${e.slice(7)}' is bound`);
      else if (e === "result:trail_columns_present") need((b.trailColumns ?? []).length > 0, "no trail columns are bound");
      else if (e === "refusal") {
        // Refusal is the ONLY way to meet this claim, so a site must say which raise is it.
        need(!!b.refusalByReturn || (b.refusalSites ?? []).length > 0, "no refusal site is declared, so no raise could count as THE refusal this row examines");
      } else if (e === "refusal_or_no_effect") {
        // With no declared site every raise is judged not-reached; the claim is met only from state.
        need(!!b.guards.no_effect, "no 'no effect' guard: a no-op would be judged by its return value (R4)");
      } else if (e === "refusal_or_non_displacing") {
        need(!!b.guards.guard && !!b.guards.caller_row, "the displacement guards are not bound");
      }
    }
  }
  return make("R6", "every state claim has a guard, and every evaluator's inputs are bound", rows,
    `every span of ${prepared.size} probes has the guard, premise, catalog fact, reference or result check it names`);
}

/** R4: "no effect" is judged from state. */
export function checkNoEffectFromState(prepared: ReadonlyMap<string, PreparedProbe>): ReadinessCheck {
  const rows: { testId: string; why: string }[] = [];
  for (const p of prepared.values()) {
    const e = p.t.expected;
    if (!/\bno effect\b|refusal or no effect/i.test(e)) continue;
    const g = p.binding.guards.no_effect ?? p.binding.guards.guard;
    if (!g || (!g.snap && !g.after)) rows.push({ testId: p.t.testId, why: "a 'no effect' claim with no state guard to judge it by" });
    if (p.spans.some((s) => s.kind === "outcome" && /^returns/.test(s.eval ?? ""))) {
      rows.push({ testId: p.t.testId, why: "a 'no effect' claim judged by a returned value" });
    }
  }
  return make("R4", "every no-effect claim is judged from a state guard, never a returned value", rows,
    "every 'no effect' claim is judged by a before/after state guard");
}

/** R2 (static): a probe whose verdict depends on rows states the premise that makes them non-empty. */
export function checkVacuityPremises(prepared: ReadonlyMap<string, PreparedProbe>): ReadinessCheck {
  const rows: { testId: string; why: string }[] = [];
  for (const p of prepared.values()) {
    const { t, spec, binding: b } = p;
    if (spec.kind === "sql") {
      // Every SQL probe that acts on rows needs its subject shown non-empty,
      // unless it is exempt for a stated reason (the same rule the binding uses).
      if (!subjectExemption(t, spec) && !b.premises.some((x) => x.id === "subject")) {
        rows.push({ testId: t.testId, why: "the probe acts on rows, and no premise makes its subject non-empty" });
      }
    }
    if (spec.kind === "rpc") {
      const hasPremise = b.premises.some((x) => x.id === "relationship" || x.id.startsWith("setup:"));
      const selfContained = p.spans.some((s) => s.eval === "message") || t.identity === "anon" && /42501/.test(t.expected);
      if (!hasPremise && !selfContained) rows.push({ testId: t.testId, why: "an F5 probe with no premise that its target exists in the relationship the row describes" });
    }
  }
  return make("R2", "no probe can pass on an absent target: every row-dependent verdict states a non-empty subject", rows,
    "every row-dependent verdict carries a subject or relationship premise");
}

/** R7 (static): isolation is complete and every contradiction registration is wired. */
export function checkIsolationDesign(prepared: ReadonlyMap<string, PreparedProbe>): ReadinessCheck {
  const rows: { testId: string; why: string }[] = [];
  for (const p of prepared.values()) {
    const { t, spec, binding: b } = p;
    if (typeof spec.writesWhenControlHolds !== "boolean") rows.push({ testId: t.testId, why: "not classified for isolation" });
    if (b.setupKey && implFor(b.setupKey)?.scope !== "probe") rows.push({ testId: t.testId, why: `setup ${b.setupKey} is not a probe-scoped implementation` });
    // A positive that writes when its control holds must be classified so,
    // or its committed row would meet the next probe.
    const writesOnSuccess = t.polarity === "positive" && /^\s*(insert|update|delete)\b/i.test(spec.statement);
    if (writesOnSuccess && !spec.writesWhenControlHolds) rows.push({ testId: t.testId, why: "a positive write not classified as writing when its control holds" });
  }
  const known = new Set(prepared.keys());
  for (const c of REGISTERED_CONTRADICTIONS) for (const id of c.testIds) {
    if (!known.has(id)) rows.push({ testId: id, why: `registered contradiction ${c.id} names a Test ID the plan does not have` });
  }
  return make("R7", "isolation: rebuild after any state change, every probe classified, every setup probe-scoped", rows,
    `isolation by rebuild; ${[...prepared.values()].filter((p) => p.spec.writesWhenControlHolds).length} probes statically classified as writing, ` +
    `${[...prepared.values()].filter((p) => p.binding.setupKey).length} with a probe-scoped setup; any other state change is caught by the post-probe digest`);
}

// ---------------------------------------------------------------------------
// live, on a verified baseline
// ---------------------------------------------------------------------------

/** Apply a probe's setup inside the current transaction on `admin` (never committed). */
async function applySetupInTxn(admin: Session, key: string): Promise<void> {
  const impl = implFor(key);
  if (!impl) throw new Error(`no implementation for ${key}`);
  if (impl.asClient) {
    // As the function would run for that caller: its claims set locally, the
    // SECURITY DEFINER body reading auth.uid() from them.
    await admin.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify(claimsFor(impl.asClient.subject))]);
    await admin.query(impl.asClient.statement);
    await admin.query(`select set_config('request.jwt.claims', '', true)`);
  } else {
    for (const sql of impl.statements) await admin.query(sql);
  }
}

/**
 * Staged state for prove-gates: applied inside each probe's own rolled-back
 * transaction, after its setup, so an injected defect is seen by exactly the
 * reads a real preflight makes and is never committed.
 */
export type Stage = (admin: Session) => Promise<void>;

/** R5 (+ R2 live): every premise of every probe holds, each with its own setup, rolled back. */
export async function checkPremisesLive(
  admin: Session,
  prepared: ReadonlyMap<string, PreparedProbe>,
  opts: { stage?: Stage } = {},
): Promise<ReadinessCheck & { readonly held: number }> {
  const rows: { testId: string; why: string }[] = [];
  let held = 0;
  for (const p of prepared.values()) {
    const b = p.binding;
    if (!b.premises.length) continue;
    // A registered contradiction excuses only the premises it makes false by
    // construction (C5: the empty subject). Every other premise must hold.
    const exempt = new Set(REGISTERED_CONTRADICTIONS.filter((c) => c.testIds.includes(p.t.testId)).flatMap((c) => c.exemptPremises));
    await admin.query("begin");
    try {
      if (b.setupKey) await applySetupInTxn(admin, b.setupKey);
      if (opts.stage) await opts.stage(admin);
      for (const c of b.premises) {
        let ok = false, detail = "";
        try {
          const r = (await admin.query(c.sql, c.params as unknown[])).rows[0] as { ok?: boolean; detail?: string } | undefined;
          ok = r?.ok === true; detail = String(r?.detail ?? "no row");
        } catch (err) {
          detail = `raised: ${(err as Error).message}`;
        }
        if (ok) held++;
        else if (!exempt.has(c.id)) rows.push({ testId: p.t.testId, why: `${c.describe}: ${detail}` });
      }
    } catch (err) {
      rows.push({ testId: p.t.testId, why: `the probe-scoped setup ${b.setupKey} could not be applied: ${(err as Error).message}` });
    } finally {
      await admin.query("rollback");
    }
  }
  return { ...make("R5", "every premise — fixture, relationship, subject — holds live, on the probe's own setup", rows, `all ${held} premises hold`), held };
}

/** R3: INSERT positives supply every required column and collide with no unique key. */
export async function checkInsertPositives(
  admin: Session,
  prepared: ReadonlyMap<string, PreparedProbe>,
  opts: { stage?: Stage } = {},
): Promise<ReadinessCheck> {
  const rows: { testId: string; why: string }[] = [];
  for (const p of prepared.values()) {
    const { t, spec, binding: b } = p;
    if (spec.kind !== "sql" || t.polarity !== "positive") continue;
    const m = /^insert into\s+((?:public|private|realtime)\.[a-z_0-9]+)\s*\(([^)]*)\)\s*values\s*\(([\s\S]*)\)\s*$/i.exec(spec.statement.trim());
    if (!m) continue;
    const rel = m[1]!;
    const cols = m[2]!.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
    await admin.query("begin");
    try {
      if (b.setupKey) await applySetupInTxn(admin, b.setupKey);
      if (opts.stage) await opts.stage(admin);
      const { rows: req } = await admin.query(
        `select a.attname::text as col from pg_attribute a
          where a.attrelid = $1::regclass and a.attnum > 0 and not a.attisdropped
            and a.attnotnull and not a.atthasdef and a.attidentity = '' and a.attgenerated = ''`, [rel]);
      const missing = req.map((r) => (r as { col: string }).col).filter((c) => !cols.includes(c));
      if (missing.length) rows.push({ testId: t.testId, why: `omits NOT NULL column(s) with no default: ${missing.join(", ")}` });
      // Every unique index whose columns the probe binds, checked against the row it would insert.
      const { rows: uniq } = await admin.query(
        `select array_agg(a.attname::text order by k.ord) as cols, pg_get_expr(i.indpred, i.indrelid) as pred
           from pg_index i cross join lateral unnest(i.indkey) with ordinality k(attnum, ord)
           join pg_attribute a on a.attrelid = i.indrelid and a.attnum = k.attnum
          where i.indrelid = $1::regclass and i.indisunique group by i.indexrelid, i.indpred, i.indrelid`, [rel]);
      for (const u of uniq as { cols: string[]; pred: string | null }[]) {
        if (!u.cols.every((c) => cols.includes(c))) continue;
        const where = u.cols.map((c, k) => `"${c}" = $${k + 1}`).join(" and ") + (u.pred ? ` and (${u.pred})` : "");
        const vals = u.cols.map((c) => spec.params[cols.indexOf(c)]);
        const hit = Number((await admin.query(`select count(*)::int n from ${rel} where ${where}`, vals)).rows[0]!.n);
        if (hit > 0) rows.push({ testId: t.testId, why: `a row with (${u.cols.join(", ")}) = (${vals.join(", ")}) already exists; the positive would hit a unique key, not WITH CHECK` });
      }
    } finally {
      await admin.query("rollback");
    }
  }
  return make("R3", "every positive reaches its control: required columns supplied, no unique collision, on its own setup", rows,
    "every INSERT positive supplies its required columns and collides with no unique key");
}

/** Every registered approved-row contradiction still holds; a stale one fails. */
export async function checkContradictionsLive(admin: Session): Promise<ReadinessCheck & { readonly checks: Awaited<ReturnType<typeof checkRegisteredContradictions>> }> {
  const checks = await checkRegisteredContradictions(admin);
  const rows = checks.filter((c) => !c.holds).map((c) => ({ testId: c.testIds[0]!, why: `${c.id} no longer holds (stale registration): ${c.detail}` }));
  return {
    ...make("C", "every registered approved-row contradiction still holds (a stale one fails)", rows,
      `${checks.length} registered, all holding live; ${new Set(checks.flatMap((c) => c.testIds)).size} distinct Test IDs will record not_measured until the author decides`),
    checks,
  };
}

/** Every admin read a binding will make compiles and runs, on the verified baseline. */
export async function checkBindingSql(admin: Session, prepared: ReadonlyMap<string, PreparedProbe>): Promise<ReadinessCheck> {
  const rows: { testId: string; why: string }[] = [];
  const tryPrepare = async (testId: string, what: string, sql: string) => {
    try {
      await admin.query(`prepare attest_binding_probe as ${sql}`);
    } catch (err) {
      rows.push({ testId, why: `${what} does not compile: ${(err as Error).message}` });
    } finally {
      await admin.query("deallocate all").catch(() => {});
    }
  };
  for (const p of prepared.values()) {
    const b = p.binding;
    for (const c of Object.values(b.catalog)) await tryPrepare(p.t.testId, `catalog fact ${c.id}`, c.sql);
    for (const [n, g] of Object.entries(b.guards)) {
      if (g.snap?.kind === "sql") await tryPrepare(p.t.testId, `guard ${n} snapshot`, g.snap.sql);
      if (g.after) await tryPrepare(p.t.testId, `guard ${n} check`, g.after.sql);
    }
    for (const [n, r] of Object.entries(b.results)) {
      if (r.admin) await tryPrepare(p.t.testId, `result ${n}`, r.admin.sql);
      if (r.adminBefore) await tryPrepare(p.t.testId, `result ${n} (before)`, r.adminBefore.sql);
    }
    if (b.reachability) await tryPrepare(p.t.testId, "reachability", b.reachability.sql);
    if (b.reference) await tryPrepare(p.t.testId, "reference statement", b.reference.statement);
  }
  return make("B", "every guard, catalog fact, result check and reference a probe will make compiles", rows,
    "every binding statement compiles against the rebuilt schema");
}
