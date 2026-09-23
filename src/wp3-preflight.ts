/**
 * Attest — preflight for a WP3 run: the execution gate.
 *
 * Everything that must hold before the approved probes may touch the instance.
 * The checks fall into three groups and they fail for different reasons:
 *
 *   plan     the plan is exactly the approved matrix (D3.35) with no
 *            placeholder, bundled probe or identity disagreeing with its own
 *            operation (D3.33); every row derives to one probe; every claim of
 *            every approved expectation has an evaluator and every evaluator its
 *            inputs (R1, R4, R6, §17); no probe can pass on an absent target (R2);
 *            isolation is complete (R7)
 *   world    the target is a disposable local instance; the disposable database
 *            REBUILDS from Arc21's migrations and the canonical baseline VERIFIES
 *            (schema, fixtures, counts, control surface, services) — preflight
 *            does one rebuild, because "isolation is available" is only true if it
 *            has been done; every derived statement and binding read compiles;
 *            every premise holds live on its own setup (R5); positives reach their
 *            control (R3); roles are what F7 assumes; every registered contradiction
 *            still holds; Realtime and PostgREST answer; Arc21 was not touched
 *   author   every negative's intent sentence is the author's
 *
 * The author group gates only a real execution (`forExecution`); planning runs
 * pass with drafts in place, because reviewing drafts is what happens between
 * planning and execution. Preflight never repairs anything.
 */
import type { Session } from "./db.ts";
import { adminSession, roleSession } from "./db.ts";
import type { Wp3Plan } from "./wp3-plan.ts";
import { validatePlan } from "./wp3-validate-plan.ts";
import type { RiskInput } from "./risk-inputs.ts";
import { deriveAll, callerFor, claimsFor, uidOf, type ExecSpec } from "./wp3-exec.ts";
import { verifySeedExtensions, SEED_EXTENSION_IMPLS } from "./seed-extensions.ts";
import { loadIntentStore, validateIntents, requiresIntent } from "./author-intents.ts";
import {
  findContradictions, summarizeContradictions, checkIdentityConsistency, identitySubject, type IdentityCheck,
} from "./plan-contradictions.ts";
import { DB } from "./config.ts";
import { readSchemaVersion } from "./schema-version.ts";
import { loadApprovedManifest, compareToApproved, manifestReproducible, type ApprovedComparison, type ApprovedManifest } from "./wp3-approved.ts";
import {
  checkClaimCoverage, checkBindingsComplete, checkNoEffectFromState, checkVacuityPremises, checkIsolationDesign,
  checkPremisesLive, checkInsertPositives, checkContradictionsLive, checkBindingSql, type ReadinessCheck,
} from "./wp3-readiness.ts";
import { prepareAll, checkScratchRoleProperties, type PreparedProbe } from "./wp3-execute.ts";
import { rebuildBaseline, type Canonical } from "./wp3-isolation.ts";
import { REGISTERED_CONTRADICTIONS, registeredContradictionsFor } from "./wp3-contradictions.ts";
import { validateRecord, WP3_EVIDENCE_SCHEMA_VERSION, type Wp3EvidenceRecord } from "./wp3-evidence.ts";
import {
  captureArc21State, compareArc21State, describeArc21State, type Arc21SourceState, type Arc21Comparison,
} from "./arc21-guard.ts";
import { signJwt } from "./jwt.ts";

export interface Check {
  readonly group: "plan" | "world" | "author";
  readonly name: string;
  readonly passed: boolean;
  readonly detail: string;
  /** Only gates a real execution, not a planning run. */
  readonly executionOnly?: boolean;
}

export interface PreflightResult {
  readonly checks: readonly Check[];
  readonly passed: boolean;
  readonly specs: ReadonlyMap<string, ExecSpec>;
  readonly prepared: ReadonlyMap<string, PreparedProbe> | null;
  readonly blockedTestIds: readonly string[];
  readonly readiness: readonly ReadinessCheck[];
  readonly identity: readonly IdentityCheck[];
  readonly approved: ApprovedComparison | null;
  readonly contradictionTestIds: readonly string[];
  readonly arc21: { readonly pre: Arc21SourceState | null; readonly post: Arc21SourceState | null; readonly comparison: Arc21Comparison | null };
  /** True when every failing check is an author (intent) gate. */
  readonly onlyAuthorGatesFail: boolean;
}

const LOOPBACK = /^(127\.0\.0\.1|::1|localhost)$/;

export const REALTIME_HEALTH_URL =
  process.env.ATTEST_REALTIME_URL ?? "http://127.0.0.1:54321/realtime/v1/api/tenants/realtime-dev/health";
export const REST_URL = process.env.ATTEST_REST_URL ?? "http://127.0.0.1:54321/rest/v1/";

/** The role properties F7 and every control test rest on. Pure, so it can be proven by inversion. */
export function rolePropertiesHold(p: { postgresBypassRls: boolean; authenticatorBypassRls: boolean; authenticatorSuperuser: boolean }): boolean {
  return p.postgresBypassRls && !p.authenticatorBypassRls && !p.authenticatorSuperuser;
}

export interface PlanCheckResult {
  readonly checks: readonly Check[];
  readonly specs: ReadonlyMap<string, ExecSpec>;
  readonly prepared: Map<string, PreparedProbe> | null;
  readonly readiness: readonly ReadinessCheck[];
  readonly identity: readonly IdentityCheck[];
  readonly approved: ApprovedComparison | null;
  readonly blockedTestIds: readonly string[];
}

/** Derived probes carrying unresolved text into an executed statement or parameter. */
export function specPlaceholders(specs: ReadonlyMap<string, ExecSpec>): string[] {
  return [...specs.values()].filter((s) =>
    ((s.kind === "sql" || s.kind === "rpc") && /fixtures\.|<[^>]{2,80}>|\.\.\./.test(s.statement)) ||
    s.params.some((v) => typeof v === "string" && (/^fixtures\./.test(v) || v === "..." || /\.\.\.$/.test(v) || /^p_[a-z_]+ [a-z ]+$/.test(v))))
    .map((s) => s.testId);
}

/**
 * Client-session probes that pg_safeupdate — preloaded for `authenticator`,
 * the login every client arrives through — refuses at parse analysis, before
 * any privilege or policy: an UPDATE or DELETE with no WHERE clause.
 */
export function specClientGuardHazards(specs: ReadonlyMap<string, ExecSpec>): string[] {
  return [...specs.values()]
    .filter((s) => (s.kind === "sql" || s.kind === "rpc") && s.caller.kind === "role")
    .filter((s) => /^\s*(update|delete)\b/i.test(s.statement) && !/\bwhere\b/i.test(s.statement))
    .map((s) => s.testId);
}

/** Derived probes issuing more than one kind of mutating command. */
export function specBundles(specs: ReadonlyMap<string, ExecSpec>): string[] {
  return [...specs.values()].filter((s) => new Set([...s.statement.matchAll(/\b(insert|update|delete|truncate)\b/gi)].map((m) => m[1]!.toLowerCase())).size > 1).map((s) => s.testId);
}

/** Every plan-stated seed requirement is implemented Attest-side with the same scope, and nothing else is. */
export function checkSeedImplementations(plan: Wp3Plan, impls: readonly { key: string; scope: string }[] = SEED_EXTENSION_IMPLS): { ok: boolean; detail: string } {
  const required = plan.seedExtensions.map((e) => e.key).sort();
  const implemented = impls.map((i) => i.key).sort();
  const missing = required.filter((k) => !implemented.includes(k));
  const extra = implemented.filter((k) => !required.includes(k));
  const scope = plan.seedExtensions.filter((e) => impls.find((i) => i.key === e.key && i.scope !== e.scope)).map((e) => e.key);
  const ok = !missing.length && !extra.length && !scope.length;
  return {
    ok,
    detail: ok
      ? `${required.length} required, ${implemented.length} implemented, sets equal (${plan.seedExtensions.filter((e) => e.scope === "baseline").length} baseline, ${plan.seedExtensions.filter((e) => e.scope === "probe").length} probe-scoped, ${plan.seedExtensions.filter((e) => e.scope === "runtime").length} runtime)`
      : `${missing.length} unimplemented (${missing.join(", ") || "none"}), ${extra.length} implemented but not required (${extra.join(", ") || "none"}), scope mismatch: ${scope.join(", ") || "none"}`,
  };
}

/**
 * Every static check preflight makes: the plan, its derivation, its bindings
 * and its claims. Pure over its inputs (plus the manifest reproducibility read),
 * so prove-gates runs exactly this function on a broken copy and reports the
 * exit status preflight would have produced.
 */
export async function planChecks(
  plan: Wp3Plan,
  resources: readonly RiskInput[],
  manifest: ApprovedManifest | null,
  opts: { reproducibility?: boolean; impls?: readonly { key: string; scope: string }[] } = {},
): Promise<PlanCheckResult> {
  const checks: Check[] = [];
  const add = (name: string, passed: boolean, detail: string) => checks.push({ group: "plan", name, passed, detail });

  const ids = plan.tests.map((t) => t.testId);
  const unique = new Set(ids);
  add("the plan carries 345 Test IDs", ids.length === 345, `${ids.length}`);
  add("every Test ID is unique", unique.size === ids.length, `${unique.size} unique of ${ids.length}`);
  const pol = { positive: 0, negative: 0, characterization: 0 } as Record<string, number>;
  for (const t of plan.tests) pol[t.polarity] = (pol[t.polarity] ?? 0) + 1;
  const sum = pol.positive! + pol.negative! + pol.characterization!;
  const frozen = pol.positive === 63 && pol.negative === 240 && pol.characterization === 42;
  add("polarity accounting reconciles: every Test ID is exactly one of the three supported polarities",
    sum === ids.length && frozen,
    `${pol.positive} positive + ${pol.negative} negative + ${pol.characterization} characterization = ${sum} of ${ids.length}` +
      (frozen ? " — the frozen 63/240/42" : " — DIFFERS from the frozen 63/240/42") +
      (sum !== ids.length ? `; ${ids.length - sum} row(s) carry an unsupported polarity` : ""));

  let approved: ApprovedComparison | null = null;
  if (!manifest) {
    add("the plan is the approved matrix", false, "rubric/wp3-approved-matrix.json is missing");
  } else {
    approved = compareToApproved(plan, manifest);
    const a = approved;
    const bad = a.missing.length || a.extra.length || a.duplicated.length || a.orderChanged || a.frozenDrift.length;
    add("the plan is the approved matrix: same Test IDs, same order, no frozen field changed", !bad,
      bad ? [
        a.missing.length ? `${a.missing.length} approved Test ID(s) missing: ${a.missing.slice(0, 4).join(", ")}` : "",
        a.extra.length ? `${a.extra.length} Test ID(s) not in the approved matrix: ${a.extra.slice(0, 4).join(", ")}` : "",
        a.duplicated.length ? `${a.duplicated.length} duplicated` : "",
        a.orderChanged ? "the Test IDs are the approved set in a different order" : "",
        a.frozenDrift.length ? `${a.frozenDrift.length} row(s) whose operation, expected, covers or other frozen field changed: ${a.frozenDrift.slice(0, 4).join(", ")}` : "",
      ].filter(Boolean).join("; ") : `${manifest.rows.length} approved Test IDs present in order; ${manifest.frozenFields.length} frozen fields unchanged on every row`);
    const idCorr = manifest.corrections.filter((c) => c.field === "identity").length;
    const fxCorr = manifest.corrections.filter((c) => c.field === "fixture").length;
    add("identities and fixtures differ from the approved run only by the listed corrections",
      a.identityDrift.length === 0 && a.fixtureDrift.length === 0,
      a.identityDrift.length || a.fixtureDrift.length
        ? `${a.identityDrift.length} unlisted identity change(s), ${a.fixtureDrift.length} unlisted fixture change(s): ${[...a.identityDrift, ...a.fixtureDrift].slice(0, 4).join("; ")}`
        : `every identity and fixture matches the manifest, which lists ${idCorr} identity and ${fxCorr} fixture correction(s), each with its reason`);
    if (opts.reproducibility !== false) {
      const repro = await manifestReproducible(manifest);
      add("the approved manifest is reproducible from the approved run plus its listed corrections",
        repro === null || repro.ok, repro === null ? `evidence/runs/${manifest.sourceRunId}/ is not in the tree` : repro.detail);
    }
  }

  const semantic = validatePlan(plan, resources);
  add("no placeholder, multi-probe or multi-identity row (semantic validation)", semantic.length === 0,
    semantic.length ? `${semantic.length} issue(s): ${semantic.slice(0, 3).map((i) => `${i.testId} ${i.check}`).join("; ")}` : "semantic validation clean");

  const { specs, failures } = deriveAll(plan);
  add("implemented Test IDs equal planned Test IDs", failures.length === 0 && specs.size === unique.size,
    failures.length ? `${failures.length} row(s) have no executable derivation: ${failures.slice(0, 3).map((f) => `${f.testId} (${f.reason})`).join("; ")}` : `${specs.size} of ${ids.length} derived, no extras`);
  const extra = [...specs.keys()].filter((k) => !unique.has(k));
  add("no implementation without a planned row", extra.length === 0, extra.length ? extra.join(", ") : "none");
  const multi = specBundles(specs);
  add("one derived probe issues one mutating command", multi.length === 0, multi.length ? multi.join(", ") : "none bundles two");
  const placeholders = specPlaceholders(specs);
  add("no unresolved placeholder, elision or signature text reaches an executed statement or parameter", placeholders.length === 0,
    placeholders.length ? placeholders.join(", ") : "every statement and parameter is a concrete value");

  const guarded = specClientGuardHazards(specs).filter((id) => !registeredContradictionsFor(id).some((c) => (c.predictedSqlstates ?? []).includes("21000")));
  add("no client probe is refused by the client connection's own guard before its control (pg_safeupdate: UPDATE/DELETE without WHERE), unless registered for the author",
    guarded.length === 0,
    guarded.length ? `${guarded.length} unregistered: ${guarded.slice(0, 6).join(", ")}` : `${specClientGuardHazards(specs).length} such probes, every one registered (C2-client-guard-before-grant)`);

  const contradictions = findContradictions(plan);
  add("no Test ID carries an unresolved plan contradiction (C1 class)", contradictions.length === 0,
    contradictions.length ? summarizeContradictions(contradictions).map((g) => `${g.id}: ${g.count} row(s)`).join(" | ") : "none");

  const identity = checkIdentityConsistency(plan);
  const badIdentity = identity.filter((c) => c.problems.length > 0);
  const f5 = identity.filter((c) => c.testId.startsWith("F5."));
  add("every row's identity agrees with its operation, its expected result and the executor's caller (C1, incl. every F5 row)", badIdentity.length === 0,
    badIdentity.length ? `${badIdentity.length} row(s): ${badIdentity.slice(0, 3).map((c) => `${c.testId} — ${c.problems[0]}`).join("; ")}`
      : `all ${identity.length} rows; F5: ${f5.length} rows (${f5.filter((c) => c.identity === "authenticated:alice").length} alice, ${f5.filter((c) => c.identity === "authenticated:carol").length} carol, ${f5.filter((c) => identitySubject(c.identity) === "anon").length} anon)`);

  const seeds = checkSeedImplementations(plan, opts.impls);
  add("every required seed extension has an Attest-side implementation of the same scope, and nothing else is implemented", seeds.ok, seeds.detail);

  let prepared: Map<string, PreparedProbe> | null = null;
  const readiness: ReadinessCheck[] = [];
  let bindError = "";
  try {
    prepared = failures.length ? null : prepareAll(plan, specs);
  } catch (err) {
    bindError = (err as Error).message;
  }
  add("every row binds: claims, premises, guards, references", prepared !== null,
    prepared ? `${prepared.size} rows bound` : bindError || "derivation failed, so nothing could be bound");
  const coverage = checkClaimCoverage(plan);
  readiness.push(coverage);
  add(`[${coverage.id}] ${coverage.name}`, coverage.passed, coverage.detail);
  if (prepared) {
    for (const r of [checkBindingsComplete(prepared), checkNoEffectFromState(prepared), checkVacuityPremises(prepared), checkIsolationDesign(prepared)]) {
      readiness.push(r);
      add(`[${r.id}] ${r.name}`, r.passed, r.detail);
    }
  }

  const schemaProblems = validateRecord(shapeProbeRecord());
  add(`the evidence schema (${WP3_EVIDENCE_SCHEMA_VERSION}) carries every required field and keeps observation and verdict consistent`,
    schemaProblems.length === 0, schemaProblems.length ? schemaProblems.join("; ") : "a shape-probe record validates; observation and verdict are separate fields");

  return { checks, specs, prepared, readiness, identity, approved, blockedTestIds: contradictions.map((c) => c.testId) };
}

export async function preflight(
  plan: Wp3Plan,
  resources: readonly RiskInput[],
  opts: { forExecution: boolean; expectedSchemaSha: string; arc21Pre?: Arc21SourceState; rebuild?: boolean },
): Promise<PreflightResult> {
  const checks: Check[] = [];
  const add = (group: Check["group"], name: string, passed: boolean, detail: string, executionOnly = false) =>
    checks.push({ group, name, passed, detail, executionOnly });

  let arc21Pre: Arc21SourceState | null = opts.arc21Pre ?? null;
  let arc21Error = "";
  if (!arc21Pre) {
    try { arc21Pre = await captureArc21State(); } catch (err) { arc21Error = (err as Error).message; }
  }

  // ======================================================================
  // 1. the plan is intact (static; the same function prove-gates breaks)
  // ======================================================================
  const manifest = await loadApprovedManifest();
  const pc = await planChecks(plan, resources, manifest);
  checks.push(...pc.checks);
  const { specs, prepared, identity, approved } = pc;
  const readiness: ReadinessCheck[] = [...pc.readiness];

  // ======================================================================
  // 2. the world matches it
  // ======================================================================
  add("world", "the target is a disposable local instance", LOOPBACK.test(DB.host),
    `${DB.host}:${DB.port}/${DB.database}` + (LOOPBACK.test(DB.host) ? "" : " — REFUSED: this harness attempts unauthorized reads and writes"));

  const sv = await readSchemaVersion();
  add("world", "the schema under test is the one the plan was built against", sv.migrationSetSha256 === opts.expectedSchemaSha,
    `${sv.migrationSetSha256.slice(0, 16)}… over ${sv.migrationCount} migrations`);
  const git = sv.git;
  add("world", "the system under test's git state is captured", typeof git?.commit === "string" && git.commit.length > 0,
    git ? `commit ${(git.commit ?? "(unknown)").slice(0, 12)} on ${git.branch}, dirty=${git.dirty}${git.uncommittedMigrations?.length ? `, ${git.uncommittedMigrations.length} uncommitted migration(s): ${git.uncommittedMigrations.join(", ")} — recorded on every evidence record` : ""}` : "no git metadata");

  // Isolation is only "available" if it has been done: rebuild and verify.
  const canonical: Canonical = { counts: null, catalog: null };
  let rebuilt = false;
  const isoName = "[R7] isolation is available: the disposable database rebuilds from Arc21's migrations and the canonical baseline verifies";
  if (opts.rebuild !== false && arc21Pre && LOOPBACK.test(DB.host)) {
    try {
      const b = await rebuildBaseline({ epoch: 0, expectedSchema: opts.expectedSchemaSha, canonical, arc21Pre });
      rebuilt = true;
      add("world", isoName, true,
        `rebuilt and verified in ${(b.durationMs / 1000).toFixed(1)}s — schema, every baseline fixture, per-table row counts, control-surface digest, Realtime and PostgREST, Arc21 unchanged`);
    } catch (err) {
      add("world", isoName, false, (err as Error).message);
    }
  } else {
    add("world", isoName, false,
      opts.rebuild === false ? "skipped by the caller (--no-rebuild): not verified" : "cannot rebuild: the Arc21 guard could not fingerprint the checkout, or the target is not local");
  }

  let admin: Session | null = null;
  try {
    admin = await adminSession("preflight");
    const fixtureResults = await verifySeedExtensions(admin);
    const badFixtures = fixtureResults.filter((r) => !r.ok);
    add("world", "every baseline and runtime fixture holds live", badFixtures.length === 0,
      badFixtures.length ? `${badFixtures.length} of ${fixtureResults.length} not satisfied: ${badFixtures.slice(0, 3).map((r) => `${r.key} (${r.detail})`).join("; ")}` : `all ${fixtureResults.length} verified live${rebuilt ? " on the freshly rebuilt baseline" : ""}`);

    const catalogIssues = await validateSpecsAgainstCatalog(admin, specs);
    add("world", "every derived probe names a relation, column and function that exists (compiled with PREPARE)", catalogIssues.length === 0,
      catalogIssues.length ? `${catalogIssues.length}: ${catalogIssues.slice(0, 3).join("; ")}` : `${specs.size} specs validated; every SQL and RPC statement compiles`);

    const { rows } = await admin.query(`select rolname, rolsuper, rolbypassrls from pg_roles where rolname in ('postgres','authenticator')`);
    const byRole = new Map(rows.map((r) => [r.rolname as string, r]));
    const pg = byRole.get("postgres"), authr = byRole.get("authenticator");
    add("world", "role properties match what the plan assumes", rolePropertiesHold({
      postgresBypassRls: pg?.rolbypassrls === true, authenticatorBypassRls: authr?.rolbypassrls !== false, authenticatorSuperuser: authr?.rolsuper !== false,
    }), `postgres: bypassrls=${pg?.rolbypassrls}; authenticator: superuser=${authr?.rolsuper} bypassrls=${authr?.rolbypassrls}`);

    const scratch = await checkScratchRoleProperties(admin);
    add("world", "[F7] the scratch roles can be built with exactly the properties the mechanism rests on", scratch.ok, scratch.detail);

    const idProblems = await checkCallerIdentities(plan);
    add("world", "every role-scoped caller the plan uses is genuinely unprivileged and carries exactly its identity", idProblems.problems.length === 0,
      idProblems.problems.length ? idProblems.problems.join("; ") : `${idProblems.count} distinct callers opened; each current_user and auth.uid() is the one its rows name, none bypasses RLS`);

    if (prepared) {
      for (const r of [
        await checkBindingSql(admin, prepared),
        await checkPremisesLive(admin, prepared),
        await checkInsertPositives(admin, prepared),
        await checkContradictionsLive(admin),
      ]) {
        readiness.push(r);
        add("world", `[${r.id}] ${r.name}`, r.passed, r.detail);
      }
    }
  } finally {
    await admin?.close().catch(() => {});
  }

  const h = await realtimeHealthy(REALTIME_HEALTH_URL);
  add("world", "[F8] the local Realtime service is healthy and accepts a locally signed key", h.ok, h.detail);
  const ws = typeof (globalThis as { WebSocket?: unknown }).WebSocket === "function";
  add("world", "[F8] this Node runtime has the global WebSocket the socket probes use", ws, `Node ${process.version}: global WebSocket ${ws ? "present" : "absent"}`);
  const reach = await reachable(REST_URL);
  add("world", "the local PostgREST endpoint is reachable (the expired-session boundary)", reach.ok, reach.detail);

  // ======================================================================
  // 3. the author has spoken
  // ======================================================================
  const store = await loadIntentStore();
  for (const v of validateIntents(plan, store, opts.forExecution)) add("author", v.check, v.passed, v.detail, !v.blocksPlanningToo);
  const needed = plan.tests.filter(requiresIntent).length;
  const drafts = store?.intents.filter((e) => e.provenance === "ai_draft").length ?? 0;
  add("author", "no AI draft is permitted in a real run",
    !opts.forExecution || (store !== null && drafts === 0),
    store === null ? "there is no canonical intent store" : drafts === 0 ? `none of the ${needed} intents is an ai_draft` : `${drafts} of ${needed} are still ai_draft — review them, then set provenance to user_reviewed_ai_draft or user_authored`,
    true);

  // ======================================================================
  // last: Arc21 is exactly as preflight found it (D3.32)
  // ======================================================================
  let arc21Post: Arc21SourceState | null = null;
  let arc21Cmp: Arc21Comparison | null = null;
  if (arc21Pre) {
    try { arc21Post = await captureArc21State(); arc21Cmp = compareArc21State(arc21Pre, arc21Post); } catch (err) { arc21Error = `could not re-read the checkout: ${(err as Error).message}`; }
  }
  add("world", "the Arc21 checkout is exactly as it was before preflight (read-only target)", arc21Cmp?.identical === true,
    arc21Cmp ? (arc21Cmp.identical ? `unchanged — ${describeArc21State(arc21Post!)}` : `HARNESS SAFETY VIOLATION: ${arc21Cmp.differences.join("; ")}`) : `the checkout could not be fingerprinted: ${arc21Error}`);

  const effective = checks.filter((c) => opts.forExecution || !c.executionOnly);
  const failing = effective.filter((c) => !c.passed);
  return {
    checks, passed: failing.length === 0, specs, prepared,
    blockedTestIds: pc.blockedTestIds,
    readiness, identity, approved,
    contradictionTestIds: REGISTERED_CONTRADICTIONS.flatMap((c) => c.testIds),
    arc21: { pre: arc21Pre, post: arc21Post, comparison: arc21Cmp },
    onlyAuthorGatesFail: failing.length > 0 && failing.every((c) => c.group === "author"),
  };
}

/** Open every distinct role-scoped caller the plan uses and read its identity back. */
export async function checkCallerIdentities(plan: Wp3Plan): Promise<{ count: number; problems: string[] }> {
  const callers = new Map<string, ReturnType<typeof callerFor>>();
  for (const t of plan.tests) { const c = callerFor(t); if (c.kind === "role") callers.set(c.label, c); }
  const problems: string[] = [];
  for (const c of callers.values()) {
    if (c.kind !== "role") continue;
    try {
      const s = await roleSession({ role: c.role, claims: c.subject ? claimsFor(c.subject) : null, label: c.label });
      const want = c.subject ? uidOf(c.subject) : null;
      if (s.identity.currentUser !== c.role || (s.identity.authUid ?? null) !== want || s.identity.bypassesRls || s.identity.isSuperuser) {
        problems.push(`${c.label}: current_user=${s.identity.currentUser}, auth.uid()=${s.identity.authUid ?? "NULL"}`);
      }
      await s.close();
    } catch (err) {
      problems.push(`${c.label}: ${(err as Error).message}`);
    }
  }
  return { count: callers.size, problems };
}

/** A record shaped exactly as runOne builds one, to validate the schema without running a probe. Never written. */
function shapeProbeRecord(): Wp3EvidenceRecord {
  return {
    schema: WP3_EVIDENCE_SCHEMA_VERSION, recordId: "shape-probe", runId: "shape-probe", timestampUtc: new Date(0).toISOString(),
    testId: "shape-probe", family: "F1 read isolation", resource: "public.x", controlId: "public.x#policy:p", tier: "High", polarity: "negative",
    identityPlanned: "authenticated:alice", operationPlanned: "", expectedPlanned: "", fixturePlanned: "", verdictWhenPredicted: "effective",
    authorIntent: "shape probe", intentProvenance: "ai_draft", intentReviewStatus: "unreviewed",
    executed: { kind: "sql", statement: "", params: [] }, identity: null, claims: null, setup: null, premises: [], catalogFacts: [], guards: [],
    reference: null, actual: { executed: true, raised: false, rowCount: 0, sqlstate: null, message: null, harnessError: false, sample: [] },
    mechanism: { kind: "none", sqlstate: null, message: null, detail: "" }, actualSummary: "0 row(s)", runnerClaims: null,
    claimResults: [], observation: "precondition_failed", verdict: "not_measured", verdictReason: "shape probe", contradiction: null,
    isolation: { epoch: 0, rebuiltBefore: true, setupApplied: null, changedRelations: [], rebuildAfterBecause: null, freshSession: true },
    sut: { schemaVersion: "", migrationCount: 0, arc21: { commit: "", branch: "", dirty: false, uncommittedMigrations: [] }, instance: "" },
    harness: { version: "", sourcesSha256: "", fileCount: 0 },
  };
}

/** Relations, columns and functions a derived probe names must exist; every SQL and RPC statement must compile. */
async function validateSpecsAgainstCatalog(admin: Session, specs: ReadonlyMap<string, ExecSpec>): Promise<string[]> {
  const issues: string[] = [];
  const fns = new Map<string, string>();
  for (const s of specs.values()) if (s.functionCall) fns.set(s.functionCall, s.testId);
  if (fns.size) {
    const { rows } = await admin.query(
      `select n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as sig
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('public','private')`);
    const sigs = new Set(rows.map((r) => r.sig as string));
    for (const [sig, testId] of fns) if (!sigs.has(sig)) issues.push(`${testId}: no function ${sig}`);
  }
  for (const s of specs.values()) {
    if (s.kind !== "sql" && s.kind !== "rpc") continue;
    if (/^\s*truncate\b/i.test(s.statement)) {
      const rel = /^\s*truncate\s+(\S+)/i.exec(s.statement)![1]!;
      const ok = (await admin.query(`select to_regclass($1) is not null as ok`, [rel])).rows[0]!.ok;
      if (!ok) issues.push(`${s.testId}: no relation ${rel}`);
      continue;
    }
    try {
      await admin.query(`prepare attest_preflight_probe as ${s.statement}`);
    } catch (err) {
      const e = err as { code?: string; message?: string };
      // A registered contradiction that predicts exactly this SQLSTATE IS the
      // compile failure (an approved literal the column cannot hold); the probe
      // records blocked_contradiction. Anything else is a harness defect.
      const excused = registeredContradictionsFor(s.testId).some((c) => (c.predictedSqlstates ?? []).includes(e.code ?? ""));
      if (!excused) issues.push(`${s.testId}: the derived statement does not compile (${e.code ?? "?"} ${e.message ?? String(err)})`);
    } finally {
      await admin.query(`deallocate all`).catch(() => {});
    }
  }
  return issues;
}

export async function reachable(url: string): Promise<{ ok: boolean; detail: string }> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    await res.text();
    return { ok: true, detail: `${url} -> HTTP ${res.status}` };
  } catch (err) {
    return { ok: false, detail: `${url} unreachable: ${(err as Error).message}` };
  }
}

/** Realtime is healthy, and a key signed here is accepted in front of it (D3.37). */
export async function realtimeHealthy(url: string): Promise<{ ok: boolean; detail: string }> {
  try {
    const key = await signJwt({ role: "anon" });
    const res = await fetch(url, { headers: { apikey: key, Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(5000) });
    const body = await res.text();
    let healthy = false;
    try { healthy = (JSON.parse(body) as { data?: { healthy?: boolean } }).data?.healthy === true; } catch { /* not JSON */ }
    return { ok: res.status === 200 && healthy, detail: `${url} -> HTTP ${res.status}${healthy ? ", healthy: true" : `, not reporting healthy: ${body.slice(0, 80)}`}` };
  } catch (err) {
    return { ok: false, detail: `${url} unreachable: ${(err as Error).message}` };
  }
}

export function renderPreflight(r: PreflightResult, forExecution: boolean): string {
  const L: string[] = [];
  for (const g of ["plan", "world", "author"] as const) {
    const rows = r.checks.filter((c) => c.group === g);
    if (!rows.length) continue;
    L.push(`  ${g}:`);
    for (const c of rows) {
      const gating = !forExecution && c.executionOnly;
      L.push(`    ${c.passed ? "ok  " : gating ? "note" : "FAIL"} ${c.name}${gating ? " (execution-only)" : ""}`);
      L.push(`         ${c.detail}`);
    }
  }
  return L.join("\n");
}

/** Every structural blocker, one line per Test ID. */
export function renderReadiness(r: PreflightResult): string {
  const L: string[] = [];
  for (const c of r.readiness.filter((x) => !x.passed)) {
    L.push(`    ${c.id} — ${c.name}: ${c.testIds.length} row(s)`);
    for (const row of c.rows.slice(0, 80)) L.push(`      ${row.testId.padEnd(42)} ${row.why}`);
  }
  return L.join("\n");
}
