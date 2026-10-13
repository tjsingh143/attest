/**
 * Attest — proving the WP3 gates by breaking them.
 *
 * D3.19's lesson, twice learned: a check that reports green has not been shown
 * to work. Twice in this project a validator passed while the exact defect it
 * existed to catch was present — the keyword scan that missed `e.g.
 * is_active = false`, and the multi-command check whose "then" exemption let
 * `delete from X, then truncate it` through.
 *
 * So every gate between the author and a real run is made to fail on purpose,
 * through THE SAME FUNCTION the gate uses — never a re-implementation — and
 * the result is reported as injected defect → gate → consequence:
 *
 *   plan gates    `planChecks` (the static half of preflight) is run on a
 *                 broken deep copy; the consequence is the exit status preflight
 *                 would return (1 when any check fails that passes on the real plan)
 *   world gates   the live check (fixture verification, premises, positives,
 *                 baseline verification) is run with the defect staged inside a
 *                 transaction on the admin connection that is always rolled back
 *   evaluation    the judge (`judgeProbe`) is given a real outcome — a genuine
 *                 42601, a genuine business-rule refusal, a genuine unique
 *                 violation — with EVERY other input satisfied, so the only thing
 *                 that can stop a false verdict is the evaluator itself; the
 *                 consequence is the observation and verdict the record would carry
 *   Arc21 guard   proven on a git repository created for the purpose under the
 *                 system temp directory and deleted after. Modifying Arc21 to prove
 *                 the guard would be the violation the guard exists to catch (D3.32)
 *
 * A defect that produces no failure is itself a finding, and `prove-gates`
 * exits non-zero. D3.37 records that three of the first version's nineteen
 * "injections" were `caught: true` written as a literal, with nothing injected.
 * Every result below is computed.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, rm, writeFile, appendFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Session } from "./db.ts";
import { roleSession } from "./db.ts";
import type { Wp3Plan, PlannedTest } from "./wp3-plan.ts";
import type { RiskInput } from "./risk-inputs.ts";
import { validatePlan } from "./wp3-validate-plan.ts";
import { deriveAll, callerFor, claimsFor, type ExecSpec } from "./wp3-exec.ts";
import { checkIdentityConsistency } from "./plan-contradictions.ts";
import { validateIntents, type IntentStore } from "./author-intents.ts";
import { validateDraftQuality } from "./intent-quality.ts";
import { SEED_EXTENSION_IMPLS, verifyOne, implFor } from "./seed-extensions.ts";
import { execute, type Outcome } from "./evidence.ts";
import type { ApprovedManifest } from "./wp3-approved.ts";
import {
  planChecks, specPlaceholders, specBundles, specClientGuardHazards, rolePropertiesHold, realtimeHealthy, type Check,
} from "./wp3-preflight.ts";
import { registeredContradictionsFor, contradictionDisposition } from "./wp3-contradictions.ts";
import {
  checkBindingsComplete, checkNoEffectFromState, checkVacuityPremises, checkPremisesLive, checkInsertPositives,
  checkClaimCoverage, type ReadinessCheck,
} from "./wp3-readiness.ts";
import { prepareAll, f7RoleClaims, dirtyReason, unrelatedTablesDigest, sameDigest, F7_SCRATCH, type PreparedProbe } from "./wp3-execute.ts";
import { bindingFor, classifyAccountDeletion, type Binding } from "./wp3-bindings.ts";
import { judgeProbe, evaluatorExists, evaluatorFor, type Observed, type CheckResult, type Judgement } from "./wp3-evaluate.ts";
import { classify } from "./wp3-outcome.ts";
import { TEMPLATES, validateClaimCoverage, spansFor, type ClaimTemplate } from "./wp3-claims.ts";
import { stateDigest, diffDigests, verifyBaselineState, BaselineVerificationError, type Canonical } from "./wp3-isolation.ts";
import { validateRecord, WP3_EVIDENCE_SCHEMA_VERSION, type Wp3EvidenceRecord } from "./wp3-evidence.ts";
import { captureArc21State, compareArc21State, READ_ONLY_GIT_ENV } from "./arc21-guard.ts";
import { readAppliedState, readSchemaVersion, unbuiltInstanceReason } from "./schema-version.ts";
import { diffInventories, diffResults, type ResultPoint } from "./wp4-drift.ts";
import { loadValidationInputs, validateLoaded } from "./wp3-validate-results.ts";
import { resetFailurePhase } from "./bringup.ts";
import { buildWp5, checkAuditScope, checkCp4Record, checkGrouping, loadAuditScope, loadCp4Response, loadNarratives, verifyItem } from "./wp5-findings.ts";
import { loadOfficialRuns } from "./wp5-run.ts";
import { computeFacts, loadEvidence } from "./evidence-facts.ts";
import { buildCsaNote, buildEntries, checkCsaNote, checkMappings, loadSources } from "./wp6-mapping.ts";
import { validateWp6Loaded } from "./wp6-validate.ts";
import { lintClaims } from "./claims-lint.ts";
import { WP5_ITEMS } from "./wp5-guidance.ts";
import type { Inventory } from "./inventory.ts";
import { readdir, readFile } from "node:fs/promises";
import { ATTEST_ROOT, RUNS_ROOT } from "./config.ts";
import { FIXTURES } from "../rubric/fixtures.ts";

const run = promisify(execFile);

export interface InjectionResult {
  /** What was broken. */
  readonly defect: string;
  /** The gate expected to fire. */
  readonly gate: string;
  /** Did it fire? */
  readonly caught: boolean;
  /** What fired, with its own words. */
  readonly firedCheck: string;
  /** The consequence: the exit status, or the observation → verdict the record would carry. */
  readonly consequence: string;
  /** Was the real state (plan, store, database, Arc21) left exactly as it was? */
  readonly restored: boolean;
  /** A control: the gate must NOT fire on the real, unbroken input. */
  readonly control?: boolean;
}

export interface InjectionContext {
  /** Admin connection; every staged defect happens in a transaction on it and is rolled back. */
  readonly admin: Session;
  readonly manifest: ApprovedManifest;
  readonly liveRoleProps: { postgresBypassRls: boolean; authenticatorBypassRls: boolean; authenticatorSuperuser: boolean };
  readonly realtimeUrl: string;
}

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
const EXIT_PREFLIGHT = "preflight FAILS → exit 1; nothing executes";
const A = FIXTURES.alice.value, CAROL = FIXTURES.carol.value;

/** Break something inside a transaction, observe, and roll it back — always. */
async function inRollback<T>(admin: Session, fn: () => Promise<T>): Promise<T> {
  await admin.query("begin");
  try {
    return await fn();
  } finally {
    await admin.query("rollback");
  }
}

const harnessOutcome = (message: string): Outcome => ({
  executed: true, raised: true, rowCount: null, sqlstate: null, message, harnessError: true, sample: [],
});

/**
 * An observation in which EVERY input other than the outcome is satisfied:
 * premises hold, catalog facts hold, guards report no change, result checks
 * pass, the reference is identical, the definer behaviour ran. Handed to the
 * judge with a bad outcome, the only thing left to stop a false verdict is the
 * evaluator's own reading of the outcome — which is the point.
 */
function maximallySatisfied(p: PreparedProbe, outcome: Outcome, triggerFns: ReadonlySet<string>, over: Partial<Observed> = {}): Observed {
  const ok = (id: string, describe: string): CheckResult => ({ id, describe, ok: true, detail: `${describe}: holds (staged)` });
  const b = p.binding;
  const runner: Record<string, { ok: boolean; detail: string }> = {};
  for (const s of p.spans) if (s.eval?.startsWith("runner:")) runner[s.eval.slice(7)] = { ok: true, detail: "staged: the runner's claim holds" };
  return {
    outcome,
    mechanism: classify(outcome, triggerFns),
    premises: b.premises.map((c) => ok(c.id, c.describe)),
    catalog: Object.fromEntries(Object.entries(b.catalog).map(([k, c]) => [k, ok(k, c.describe)])),
    guards: Object.fromEntries(Object.entries(b.guards).map(([k, g]) => [k, ok(k, g.describe)])),
    results: Object.fromEntries(Object.entries(b.results).map(([k, r]) => [k, ok(k, r.describe)])),
    reference: { outcome, mechanism: classify(outcome, triggerFns) },
    reachability: b.reachability ? ok("reachability", b.reachability.describe) : null,
    runnerClaims: runner,
    anonGrant: { holdsSelect: true, rows: 5 },
    columnPrivilege: null,
    viewColumns: ["id"],
    sessionAuthUid: null,
    contradiction: null,
    ...over,
  };
}

const consequenceOf = (j: Judgement) =>
  `record: ${j.observation} → ${j.verdict}${j.observation === "harness_error" ? "; execute-wp3 exits 1 (a harness error is never a result)" : ""}`;

/** Checks that fail on the broken copy and pass on the real plan. */
function newlyFailing(broken: readonly Check[], baseline: ReadonlySet<string>): Check[] {
  return broken.filter((c) => !c.passed && !baseline.has(c.name));
}

/** Run every injection. The real plan, store, instance and Arc21 are never mutated. */
export async function runInjections(
  plan: Wp3Plan,
  resources: readonly RiskInput[],
  store: IntentStore,
  ctx: InjectionContext,
): Promise<InjectionResult[]> {
  const out: InjectionResult[] = [];
  // Every world gate below is proven against a verified baseline. Some fixtures are
  // date-bound (today's daily challenge), so a baseline seeded on an earlier UTC day
  // stops verifying at midnight, and an injection judged against it would read as
  // "not caught" when the gate is fine and the state is stale (seen 2026-09-26).
  // Refuse up front and name the cause instead of reporting a false miss.
  try {
    await verifyBaselineState(ctx.admin, { counts: null, catalog: null });
  } catch (err) {
    throw new Error(
      `prove-gates needs the disposable database at a freshly verified baseline, and it is not one: ${(err as Error).message}. ` +
        "Run `npm run attest bringup`, then `npm run attest seed-extensions` (a date-bound fixture stops holding after a UTC date change), then prove-gates again.",
    );
  }
  const snapshotPlan = JSON.stringify(plan);
  const snapshotStore = JSON.stringify(store);
  const liveDigestBefore = await stateDigest(ctx.admin);

  const push = (r: Omit<InjectionResult, "restored"> & { restored?: boolean }) => out.push({ restored: true, ...r });

  // ------------------------------------------------------------------
  // The real plan: the baseline every plan injection is compared with.
  // ------------------------------------------------------------------
  const real = await planChecks(plan, resources, ctx.manifest, { reproducibility: false });
  const baselineFailing = new Set(real.checks.filter((c) => !c.passed).map((c) => c.name));
  push({
    defect: "(control) the real, unbroken plan",
    gate: "planChecks — the static half of preflight",
    caught: baselineFailing.size === 0,
    firedCheck: baselineFailing.size === 0 ? `all ${real.checks.length} static checks pass` : `FAILING ON THE REAL PLAN: ${[...baselineFailing].join("; ")}`,
    consequence: baselineFailing.size === 0 ? "no static check fails (exit 0 as far as the plan is concerned)" : "the real plan fails; every plan injection below is judged only on checks that pass here",
    control: true,
  });
  const prepared = real.prepared!;
  const stateToKey = new Map(plan.seedExtensions.map((e) => [e.state, { key: e.key, scope: e.scope }]));
  const triggerFns = await (async () => {
    const { rows } = await ctx.admin.query(`select p.proname::text as f from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('public','private') and p.prorettype = 'trigger'::regtype`);
    return new Set(rows.map((r) => String(r.f)));
  })();
  const P = (id: string): PreparedProbe => {
    const p = prepared.get(id);
    if (!p) throw new Error(`prove-gates: no prepared probe ${id}`);
    return p;
  };
  const findP = (pred: (p: PreparedProbe) => boolean, what: string): PreparedProbe => {
    const p = [...prepared.values()].find(pred);
    if (!p) throw new Error(`prove-gates: no prepared probe that is ${what}`);
    return p;
  };

  const planGate = async (defect: string, gate: string, expectCheck: RegExp, mutate: (p: Wp3Plan) => void, impls?: readonly { key: string; scope: string }[]) => {
    const p = clone(plan);
    mutate(p);
    const r = await planChecks(p, resources, ctx.manifest, { reproducibility: false, impls });
    const fired = newlyFailing(r.checks, baselineFailing);
    const hit = fired.filter((c) => expectCheck.test(c.name));
    push({
      defect, gate,
      caught: hit.length > 0,
      firedCheck: fired.length ? fired.map((c) => `${c.name}: ${c.detail}`).join(" | ").slice(0, 600) : "nothing fired",
      consequence: fired.length ? EXIT_PREFLIGHT : "preflight would PASS (exit 0) — NOT CAUGHT",
    });
  };
  const tests = (p: Wp3Plan) => p.tests as PlannedTest[];
  const idx = (p: Wp3Plan, pred: (t: PlannedTest) => boolean) => {
    const i = p.tests.findIndex(pred);
    if (i < 0) throw new Error("prove-gates: no row matches the injection's target");
    return i;
  };

  // ------------------------------------------------------------------
  // 1. plan shape and identity
  // ------------------------------------------------------------------
  await planGate("a Test ID is missing from the plan", "preflight: 345 Test IDs; the plan is the approved matrix",
    /345 Test IDs|approved matrix/, (p) => { tests(p).splice(10, 1); });
  await planGate("an extra Test ID appears (a probe with no approved row)", "preflight: the plan is the approved matrix; no implementation without a planned row",
    /approved matrix|345 Test IDs/, (p) => { tests(p).push({ ...p.tests[0]!, testId: "F1.injected_extra.999" }); });
  await planGate("an approved Test ID is substituted, leaving the count at 345", "preflight: the plan is the approved matrix",
    /approved matrix/, (p) => { tests(p)[20] = { ...p.tests[20]!, testId: "F1.substituted.998" }; });
  await planGate("a duplicate Test ID (two rows, one ID)", "preflight: every Test ID is unique; semantic: one Test ID = one probe",
    /unique|semantic/, (p) => { tests(p)[5] = { ...p.tests[5]!, testId: p.tests[4]!.testId }; });
  await planGate("a row carries a fourth, unsupported polarity", "preflight: polarity accounting reconciles",
    /polarity accounting/, (p) => { tests(p)[3] = { ...p.tests[3]!, polarity: "informational" as PlannedTest["polarity"] }; });
  await planGate("an approved row's expected result is edited", "preflight: no frozen field changed",
    /approved matrix/, (p) => { const i = idx(p, (t) => t.testId.startsWith("F5.caller_is_room_member")); tests(p)[i] = { ...p.tests[i]!, expected: "returns TRUE" }; });
  await planGate("an unresolved placeholder survives into an operation", "semantic validator: no placeholders",
    /semantic/, (p) => { tests(p)[0] = { ...p.tests[0]!, operation: "delete from public.wallets where id = <value>" }; });
  await planGate("one Test ID bundles two probes (delete, then truncate)", "semantic validator: one probe per row",
    /semantic/, (p) => { tests(p)[0] = { ...p.tests[0]!, operation: "delete from public.wallets, then truncate public.wallet_ledger" }; });
  await planGate("one Test ID names two execution identities", "semantic validator: one identity per row; identity consistency",
    /semantic|identity agrees/, (p) => { const i = idx(p, (t) => t.identity === "authenticated:carol" && t.family.startsWith("F1 ")); tests(p)[i] = { ...p.tests[i]!, identity: "authenticated:carol and as authenticated:bob" }; });
  await planGate("an F5 row's caller metadata reverts to alice while its operation names carol (the C1 defect)", "preflight: identity agrees with operation / expected / executor (C1); identities match the manifest",
    /identity agrees|C1|identities and fixtures/, (p) => { const i = idx(p, (t) => t.testId.startsWith("F5.get_room_state")); tests(p)[i] = { ...p.tests[i]!, identity: "authenticated:alice" }; });
  await planGate("a row names a fixture that does not exist", "preflight: implemented Test IDs equal planned Test IDs (derivation)",
    /implemented Test IDs|binds/, (p) => {
      const i = idx(p, (t) => t.operation.includes("fixtures.bob.id"));
      tests(p)[i] = { ...p.tests[i]!, operation: p.tests[i]!.operation.replace("fixtures.bob.id", "fixtures.nosuchfixture.id") };
    });
  await planGate("an approved expectation no claim template covers (an unknown custom expectation)", "preflight: [R1] every claim has an evaluator; every row binds",
    /\[R1\]|binds/, (p) => { const i = idx(p, (t) => t.polarity === "negative" && t.family.startsWith("F1 ")); tests(p)[i] = { ...p.tests[i]!, expected: "the attacker is politely discouraged" }; });
  await planGate("a required fixture has no implementation (tournament_alice_bob_match removed)", "preflight: every required seed extension has an implementation",
    /seed extension/, () => {}, SEED_EXTENSION_IMPLS.filter((i) => i.key !== "tournament_alice_bob_match"));
  await planGate("a required fixture is implemented with the wrong scope (a probe-scoped setup made baseline)", "preflight: every required seed extension has an implementation of the same scope",
    /seed extension/, () => {}, SEED_EXTENSION_IMPLS.map((i) => (i.key === "probe:dave_deleted" ? { ...i, scope: "baseline" as const } : i)));
  {
    // The executor's wiring, not the plan: a derivation that substitutes a caller.
    const wrong = (t: PlannedTest) => callerFor({ ...t, identity: "authenticated:alice" });
    const flagged = checkIdentityConsistency(plan, wrong).filter((c) => c.problems.some((x) => x.includes("executor")));
    push({
      defect: "the executor derives a caller other than the row's structured identity",
      gate: "preflight: identity agrees with the executor's caller",
      caught: flagged.length > 0,
      firedCheck: `${flagged.length} row(s) flagged, e.g. ${flagged.slice(0, 2).map((c) => `${c.testId}: ${c.problems.find((x) => x.includes("executor"))}`).join("; ")}`,
      consequence: flagged.length ? EXIT_PREFLIGHT : "NOT CAUGHT",
    });
  }

  // ------------------------------------------------------------------
  // 2. derived probes: the executed statement itself
  // ------------------------------------------------------------------
  {
    const specs = new Map(real.specs);
    const victim = [...specs.values()].find((s) => s.kind === "rpc" && s.params.length > 0)!;
    specs.set(victim.testId, { ...victim, params: ["p_action text", ...victim.params.slice(1)] });
    const signature = specPlaceholders(specs);
    specs.set(victim.testId, { ...victim, params: ["...", ...victim.params.slice(1)] });
    const elision = specPlaceholders(specs);
    specs.set(victim.testId, { ...victim, params: ["fixtures.bob.id", ...victim.params.slice(1)] });
    const unresolved = specPlaceholders(specs);
    const baseline = specPlaceholders(real.specs);
    push({
      defect: "a derived probe binds signature text, an elision or an unresolved fixture reference as its argument",
      gate: "preflight: no unresolved placeholder, elision or signature text reaches an executed statement or parameter",
      caught: baseline.length === 0 && [signature, elision, unresolved].every((x) => x.includes(victim.testId)),
      firedCheck: `real specs: ${baseline.length} flagged; with 'p_action text': ${signature.join(", ") || "none"}; with '...': ${elision.join(", ") || "none"}; with 'fixtures.bob.id': ${unresolved.join(", ") || "none"}`,
      consequence: EXIT_PREFLIGHT,
    });
  }
  {
    const specs = new Map(real.specs);
    const victim = [...specs.values()].find((s) => s.kind === "sql" && /^\s*delete\b/i.test(s.statement))!;
    specs.set(victim.testId, { ...victim, statement: `${victim.statement}; truncate public.blocks` });
    const fired = specBundles(specs);
    push({
      defect: "a derived probe issues two mutating commands (one Test ID, two probes)",
      gate: "preflight: one derived probe issues one mutating command",
      caught: specBundles(real.specs).length === 0 && fired.includes(victim.testId),
      firedCheck: `real specs: ${specBundles(real.specs).length} bundled; injected: ${fired.join(", ") || "none"}`,
      consequence: EXIT_PREFLIGHT,
    });
  }

  {
    // A client probe the connection's own guard refuses first (pg_safeupdate),
    // introduced on a row nobody registered for the author.
    const specs = new Map(real.specs);
    const victim = [...specs.values()].find((s) => s.caller.kind === "role" && /^\s*update\b/i.test(s.statement) && /\bwhere\b/i.test(s.statement) && !s.testId.startsWith("F2."))!;
    specs.set(victim.testId, { ...victim, statement: victim.statement.replace(/\s+where\s+[\s\S]*$/i, "") });
    const hazards = specClientGuardHazards(specs);
    const unregistered = hazards.filter((id) => !registeredContradictionsFor(id).some((c) => (c.predictedSqlstates ?? []).includes("21000")));
    push({
      defect: `${victim.testId}: a client UPDATE loses its WHERE clause — pg_safeupdate would refuse it before the policy under test`,
      gate: "preflight: no client probe is refused by the connection's own guard before its control, unless registered",
      caught: unregistered.includes(victim.testId) && specClientGuardHazards(real.specs).every((id) => registeredContradictionsFor(id).length > 0),
      // Since Gate A (D3.54) the real plan has no hazard at all: every client
      // UPDATE/DELETE carries a WHERE, so the guard can only fire on the injection.
      firedCheck: `unregistered hazards: ${unregistered.join(", ") || "none"}; the real plan carries ${specClientGuardHazards(real.specs).length} such probe(s)`,
      consequence: EXIT_PREFLIGHT,
    });
  }

  // ------------------------------------------------------------------
  // 3. claims, guards and bindings (static readiness)
  // ------------------------------------------------------------------
  {
    // The second claim of a compound expectation, dropped three ways.
    const tpl = TEMPLATES.find((t) => t.id === "update_still_attributed")!;
    const rows = plan.tests.filter((t) => "template" in (spansFor(t.expected) as object) && (spansFor(t.expected) as { template: ClaimTemplate }).template.id === tpl.id);
    const variants: [string, ClaimTemplate][] = [
      ["the second span deleted", { id: tpl.id, spans: tpl.spans.slice(0, 1) }],
      ["the second span relabelled a connective", { id: tpl.id, spans: [tpl.spans[0]!, tpl.spans[1]!, { ...tpl.spans[2]!, kind: "connective", eval: undefined }] }],
      ["the second span relabelled a rationale with no reason", { id: tpl.id, spans: [tpl.spans[0]!, tpl.spans[1]!, { ...tpl.spans[2]!, kind: "rationale", eval: undefined, why: "" }] }],
    ];
    const results = variants.map(([what, v]) => {
      const set = TEMPLATES.map((t) => (t.id === tpl.id ? v : t));
      const issues = validateClaimCoverage(rows, evaluatorExists, set);
      return { what, n: issues.length, first: issues[0]?.problem ?? "" };
    });
    const real1 = validateClaimCoverage(rows, evaluatorExists);
    push({
      defect: `the second assertion of a compound expectation is dropped ("1 row affected, and the row is still attributed to alice afterwards", ${rows.length} rows)`,
      gate: "preflight: [R1] every claim of every approved expectation has an evaluator (compound coverage)",
      caught: real1.length === 0 && results.every((r) => r.n >= rows.length),
      firedCheck: results.map((r) => `${r.what}: ${r.n} issue(s) — ${r.first.slice(0, 110)}`).join(" | "),
      consequence: EXIT_PREFLIGHT,
    });
    // And at judgement: the first claim met, the second not.
    const p = P(rows[0]!.testId);
    const o: Outcome = { executed: true, raised: false, rowCount: 1, sqlstate: null, message: null, harnessError: false, sample: [], rows: [], columns: [] };
    const ob = maximallySatisfied(p, o, triggerFns);
    const guardName = Object.keys(p.binding.guards).find((k) => k === "still_attributed")!;
    const j = judgeProbe(p.t, p.spec, p.binding, p.spans, { ...ob, guards: { ...ob.guards, [guardName]: { id: guardName, describe: "the row is still attributed to alice", ok: false, detail: "staged: user_id changed to bob" } } });
    push({
      defect: `${p.t.testId}: the write succeeds (1 row) but the row is re-attributed — only the SECOND claim fails`,
      gate: "judge: every claim is judged; one unmet claim cannot be outvoted by a met one",
      caught: j.verdict !== "effective" && j.observation === "not_as_predicted",
      firedCheck: j.claims.map((c) => `${c.evaluator}=${c.status}`).join(", "),
      consequence: consequenceOf(j),
    });
  }
  {
    const p = P([...prepared.values()].find((x) => x.spans.some((s) => s.eval === "state:still_attributed"))!.t.testId);
    const broken = new Map(prepared);
    const guards = { ...p.binding.guards };
    delete (guards as Record<string, unknown>).still_attributed;
    broken.set(p.t.testId, { ...p, binding: { ...p.binding, guards } });
    const before = checkBindingsComplete(prepared), after = checkBindingsComplete(broken);
    const j = judgeProbe(p.t, p.spec, p.binding, p.spans, maximallySatisfied(p, { executed: true, raised: false, rowCount: 1, sqlstate: null, message: null, harnessError: false, sample: [], rows: [], columns: [] }, triggerFns, { guards: {} }));
    push({
      defect: `${p.t.testId}: a state claim with its guard removed`,
      gate: "preflight: [R6] every state claim has a guard",
      caught: before.passed && after.testIds.includes(p.t.testId),
      firedCheck: `real bindings: ${before.passed ? "clear" : before.detail}; broken: ${after.rows.filter((r) => r.testId === p.t.testId).map((r) => r.why).join("; ")}; and if it ran anyway: ${j.observation}`,
      consequence: `${EXIT_PREFLIGHT}; even unguarded at run time the claim is ${consequenceOf(j)}`,
    });
  }
  {
    // "No effect" judged from a NULL/void return.
    const p = findP((x) => x.spans.some((s) => s.eval === "refusal_or_no_effect") && !!x.binding.guards.no_effect, "a 'refusal or no effect' row with a no_effect guard");
    const broken = new Map(prepared);
    const guards = { ...p.binding.guards };
    delete (guards as Record<string, unknown>).no_effect;
    broken.set(p.t.testId, { ...p, binding: { ...p.binding, guards } });
    const r4 = checkNoEffectFromState(broken), r6 = checkBindingsComplete(broken);
    const voidReturn: Outcome = { executed: true, raised: false, rowCount: 1, sqlstate: null, message: null, harnessError: false, sample: [{ [p.spec.calledFunction ?? "f"]: null }], rows: [{ [p.spec.calledFunction ?? "f"]: null }], columns: [p.spec.calledFunction ?? "f"] };
    const ob = maximallySatisfied(p, voidReturn, triggerFns);
    const changed = judgeProbe(p.t, p.spec, p.binding, p.spans, { ...ob, guards: { ...ob.guards, no_effect: { id: "no_effect", describe: "state unchanged", ok: false, detail: "staged: carol's room_members row appeared" } } });
    const unguarded = judgeProbe(p.t, p.spec, { ...p.binding, guards }, p.spans, { ...ob, guards: Object.fromEntries(Object.entries(ob.guards).filter(([k]) => k !== "no_effect")) });
    push({
      defect: `${p.t.testId}: the call returns NULL (void) — "no effect" inferred from the return value`,
      gate: "preflight: [R4] no-effect is judged from a state guard; judge: a return value is never 'no effect'",
      caught: (!r4.passed || !r6.passed) && changed.verdict === "deficient" && unguarded.verdict === "not_measured",
      firedCheck: `guard removed → R4 ${r4.passed ? "clear" : "FAILS"}, R6 ${r6.passed ? "clear" : "FAILS"}; NULL return + state changed → ${changed.observation}/${changed.verdict}; NULL return + no guard → ${unguarded.observation}/${unguarded.verdict}`,
      consequence: `${EXIT_PREFLIGHT}; at run time a NULL return with changed state is ${changed.verdict}, and with no guard is ${unguarded.verdict}`,
    });
  }
  {
    // Vacuity, statically: a row-dependent verdict with its subject premise removed.
    const p = findP((x) => x.spec.kind === "sql" && x.t.polarity === "negative" && x.binding.premises.some((c) => c.id === "subject"), "an SQL negative with a subject premise");
    const broken = new Map(prepared);
    broken.set(p.t.testId, { ...p, binding: { ...p.binding, premises: p.binding.premises.filter((c) => c.id !== "subject") } });
    const r = checkVacuityPremises(broken);
    push({
      defect: `${p.t.testId}: a negative whose verdict depends on rows loses the premise that its subject is non-empty`,
      gate: "preflight: [R2] no probe can pass on an absent target",
      caught: checkVacuityPremises(prepared).passed && r.testIds.includes(p.t.testId),
      firedCheck: r.rows.filter((x) => x.testId === p.t.testId).map((x) => x.why).join("; ") || "nothing fired",
      consequence: EXIT_PREFLIGHT,
    });
  }

  // ------------------------------------------------------------------
  // 4. the live world, staged in rolled-back transactions
  // ------------------------------------------------------------------
  const liveGate = async (defect: string, gate: string, subset: PreparedProbe[], stage: (a: Session) => Promise<void>, check: "premises" | "positives") => {
    const m = new Map(subset.map((p) => [p.t.testId, p]));
    const fn = check === "premises" ? checkPremisesLive : checkInsertPositives;
    const clean: ReadinessCheck = await fn(ctx.admin, m);
    const broken: ReadinessCheck = await fn(ctx.admin, m, { stage });
    push({
      defect, gate,
      caught: clean.passed && !broken.passed,
      firedCheck: `unbroken: ${clean.passed ? "holds" : clean.detail}; staged: ${broken.rows.map((r) => `${r.testId} — ${r.why}`).join(" | ").slice(0, 400) || "nothing fired"}`,
      consequence: clean.passed && !broken.passed ? EXIT_PREFLIGHT : "NOT CAUGHT",
    });
  };
  {
    const p = findP((x) => x.spec.kind === "sql" && x.t.polarity === "negative" && x.t.family.startsWith("F1 ") && x.binding.premises.some((c) => c.id === "subject") && /career_attempts/.test(x.t.resource), "an F1 career_attempts negative");
    const sub = p.binding.premises.find((c) => c.id === "subject")!;
    await liveGate(`${p.t.testId}: the rows the negative probes are absent (a vacuous "no data")`, "preflight: [R5/R2 live] every subject premise holds", [p],
      async (a) => { await a.query(`delete from public.career_attempts where user_id <> $1`, [A]); void sub; }, "premises");
  }
  {
    const p = findP((x) => x.t.family.startsWith("F1 ") && x.t.polarity === "positive" && x.binding.premises.some((c) => /alice's live seat/.test(c.describe)), "an F1 positive resting on alice's live seat");
    await liveGate(`${p.t.testId}: a positive's prerequisite is invalid (alice's seat has been left)`, "preflight: [R5] every positive's premise holds", [p],
      async (a) => { await a.query(`update public.game_session_seats set status = 'left' where user_id = $1 and game_session_id = $2`, [A, FIXTURES.session.value]); }, "premises");
  }
  {
    const p = findP((x) => x.t.testId.startsWith("F3.public_blocks") && x.t.polarity === "positive" && /^\s*insert/i.test(x.spec.statement), "the F3 blocks INSERT positive");
    await liveGate(`${p.t.testId}: a row with the positive's unique key already exists (a duplicate key would refuse before WITH CHECK)`, "preflight: [R3] every positive reaches its control", [p],
      async (a) => { await a.query(`insert into public.blocks (blocker_id, blocked_id) values ($1, $2)`, [A, CAROL]); }, "positives");
    // And the genuine 23505, judged: never "WITH CHECK refused", never "the write was admitted".
    const s = await roleSession({ role: "authenticated", claims: claimsFor("alice"), label: "prove-gates:alice" });
    let o: Outcome;
    try {
      await s.query("begin");
      await s.query(p.spec.statement, p.spec.params as unknown[]);
      o = await execute(s, p.spec.statement, p.spec.params);
    } finally {
      await s.query("rollback").catch(() => {});
      await s.close();
    }
    const j = judgeProbe(p.t, p.spec, p.binding, p.spans, maximallySatisfied(p, o, triggerFns));
    push({
      defect: `${p.t.testId}: the positive INSERT hits a genuine unique violation (${o.sqlstate})`,
      gate: "judge: a constraint that fires is not the policy under test",
      caught: j.verdict === "not_measured" && j.observation === "precondition_failed",
      firedCheck: `${o.sqlstate} ${o.message}; claims: ${j.claims.map((c) => `${c.evaluator}=${c.status}${c.cls ? `/${c.cls}` : ""}`).join(", ")}`,
      consequence: consequenceOf(j),
    });
  }
  {
    // The deleted-user boundary with dave still alive.
    const p = findP((x) => x.t.control.endsWith("#boundary:deleted-user") && x.binding.setupKey === "probe:dave_deleted", "a deleted-user boundary row");
    const live = { ...p, binding: { ...p.binding, setupKey: null } as Binding };
    const clean = await checkPremisesLive(ctx.admin, new Map([[p.t.testId, p]]));
    const broken = await checkPremisesLive(ctx.admin, new Map([[p.t.testId, live]]));
    push({
      defect: `${p.t.testId}: the deleted-user probe runs with dave's account still live (the setup that deletes it skipped)`,
      gate: "preflight: [R5] the deleted-user premise holds (C5 excuses only the empty subject, never 'dave is deleted')",
      caught: clean.passed && !broken.passed,
      firedCheck: `with the deletion: ${clean.passed ? "holds" : clean.detail}; without: ${broken.rows.map((r) => r.why).join(" | ").slice(0, 300) || "nothing fired"}`,
      consequence: clean.passed && !broken.passed ? EXIT_PREFLIGHT : "NOT CAUGHT",
    });
  }
  {
    // The wrong F8 topic — the old parser's trailing comma.
    const p = findP((x) => x.t.family.startsWith("F8") && x.t.resource === "realtime.messages" && x.spec.kind === "sql" && /^select/i.test(x.spec.statement) && x.t.polarity === "negative" && typeof x.spec.params[0] === "string", "an F8 SQL negative reading a topic");
    const topic = String(p.spec.params[0]);
    const wrong: ExecSpec = { ...p.spec, params: [`${topic},`], preStatements: [{ sql: `select set_config('realtime.topic', $1, false)`, params: [`${topic},`] }] };
    const rebound = { ...p, spec: wrong, binding: bindingFor(p.t, wrong, stateToKey) };
    const clean = await checkPremisesLive(ctx.admin, new Map([[p.t.testId, p]]));
    const broken = await checkPremisesLive(ctx.admin, new Map([[p.t.testId, rebound]]));
    // And the parser itself: the approved operation yields exactly the fixture topic.
    const parsed = deriveAll({ ...plan, tests: [p.t] }).specs.get(p.t.testId)!;
    push({
      defect: `${p.t.testId}: the probe reads topic "${topic}," (the old parser kept the comma)`,
      gate: "preflight: [R5/R2 live] the topic's subject rows exist; derivation: the topic is exactly the fixture's",
      caught: clean.passed && !broken.passed && parsed.params[0] === FIXTURES.gameTopic.value,
      firedCheck: `exact topic: ${clean.passed ? "subject holds" : clean.detail}; with the comma: ${broken.rows.map((r) => r.why).join(" | ").slice(0, 240) || "nothing fired"}; the current parser yields "${String(parsed.params[0])}"`,
      consequence: clean.passed && !broken.passed ? EXIT_PREFLIGHT : "NOT CAUGHT",
    });
  }
  {
    // Fixture state: present but wrong, absent, in the wrong tournament, wrong participants.
    const cases: [string, string, (a: Session) => Promise<unknown>][] = [
      ["the tournament-match fixture is absent", "tournament_alice_bob_match", (a) => a.query(`delete from public.tournament_matches where id = $1`, [FIXTURES.tournamentAliceBobMatch.value])],
      ["the tournament match sits in the wrong tournament", "tournament_alice_bob_match", (a) => a.query(`update public.tournament_matches set tournament_id = $2 where id = $1`, [FIXTURES.tournamentAliceBobMatch.value, FIXTURES.cancelledTournament.value])],
      ["the tournament match has the wrong participants (bob's slot emptied)", "tournament_alice_bob_match", (a) => a.query(`update public.tournament_matches set entry_b_id = null where id = $1`, [FIXTURES.tournamentAliceBobMatch.value])],
      ["the tournament match is in the wrong state (completed, with a winner)", "tournament_alice_bob_match", (a) => a.query(`update public.tournament_matches set status = 'completed', winner_entry_id = entry_a_id where id = $1`, [FIXTURES.tournamentAliceBobMatch.value])],
      ["a fixture exists with the wrong value (the falsifying inactive cosmetic made active)", "anon_falsifying_row:public.cosmetics", (a) => a.query(`update public.cosmetics set is_active = true where id = $1`, [FIXTURES.inactiveCosmetic.value])],
      ["erin, the private-privacy subject of the leaderboard claims, is made public", "account:erin", (a) => a.query(`update public.profiles set privacy = 'public' where id = $1`, [FIXTURES.erin.value])],
    ];
    for (const [defect, key, stage] of cases) {
      const impl = implFor(key)!;
      const clean = await verifyOne(ctx.admin, impl);
      const r = await inRollback(ctx.admin, async () => { await stage(ctx.admin); return verifyOne(ctx.admin, impl); });
      push({
        defect, gate: `preflight: every baseline and runtime fixture holds live (${key})`,
        caught: clean.ok && !r.ok, firedCheck: `unbroken: ${clean.detail}; staged: ${r.detail}`,
        consequence: clean.ok && !r.ok ? EXIT_PREFLIGHT : "NOT CAUGHT",
      });
    }
  }
  {
    // Cross-probe contamination: a probe that is not classified as writing,
    // applied no setup, raised nothing — and left a row behind.
    const canonical: Canonical = { counts: null, catalog: null };
    let establish = "";
    try { await verifyBaselineState(ctx.admin, canonical); } catch (err) { establish = (err as Error).message; }
    const res = await inRollback(ctx.admin, async () => {
      const before = await stateDigest(ctx.admin);
      await ctx.admin.query(`insert into public.blocks (blocker_id, blocked_id) values ($1, $2)`, [CAROL, FIXTURES.erin.value]);
      const after = await stateDigest(ctx.admin);
      const changed = diffDigests(before, after);
      const reason = dirtyReason({ writesWhenControlHolds: false, setupKey: null, changed, harnessError: false });
      let verify = "the contaminated state VERIFIED as the baseline";
      try { await verifyBaselineState(ctx.admin, canonical); } catch (err) { verify = err instanceof BaselineVerificationError ? `refused: ${err.message}` : `raised: ${(err as Error).message}`; }
      return { changed, reason, verify };
    });
    const cleanReason = dirtyReason({ writesWhenControlHolds: false, setupKey: null, changed: [], harnessError: false });
    let after = "verifies";
    try { await verifyBaselineState(ctx.admin, canonical); } catch (err) { after = (err as Error).message; }
    push({
      defect: "a probe classified as read-only leaves a row behind (carol→erin block) — the next probe would inherit it",
      gate: "isolation: the post-probe digest forces a rebuild; baseline verification refuses contaminated state",
      caught: establish === "" && res.changed.length > 0 && res.reason !== null && cleanReason === null && res.verify.startsWith("refused") && after === "verifies",
      firedCheck: `digest moved: ${res.changed.join(", ")}; dirtyReason → ${res.reason ?? "null (NOT CAUGHT)"}; baseline verification ${res.verify.slice(0, 200)}; unchanged state → ${cleanReason ?? "no rebuild"}; after rollback the baseline ${after}`,
      consequence: "the next probe runs on a rebuilt, re-verified baseline; a baseline that does not verify stops the run (exit 1)",
    });
  }

  // ------------------------------------------------------------------
  // 5. judgement: bad outcomes with every other input satisfied
  // ------------------------------------------------------------------
  {
    // A harness exception, against all 345 rows.
    const o = harnessOutcome("TypeError: cannot read properties of undefined (reading 'rows')");
    const bad: string[] = [];
    for (const p of prepared.values()) {
      const j = judgeProbe(p.t, p.spec, p.binding, p.spans, maximallySatisfied(p, o, triggerFns));
      if (j.observation !== "harness_error" || j.verdict !== "not_measured") bad.push(`${p.t.testId}: ${j.observation}/${j.verdict}`);
    }
    push({
      defect: "a harness exception is presented as the database's answer (all 345 rows, every other input satisfied)",
      gate: "judge: a harness error is never a refusal, never a pass",
      caught: bad.length === 0,
      firedCheck: bad.length ? `${bad.length} row(s) produced a verdict: ${bad.slice(0, 4).join("; ")}` : `all ${prepared.size} rows → harness_error / not_measured`,
      consequence: "record: harness_error → not_measured; execute-wp3 exits 1",
    });
  }
  {
    // A genuine syntax error from the database, against every negative.
    const s = await roleSession({ role: "authenticated", claims: claimsFor("alice"), label: "prove-gates:alice" });
    let o: Outcome;
    try { o = await execute(s, "selec * from public.profiles"); } finally { await s.close(); }
    const bad: string[] = [];
    let n = 0;
    for (const p of prepared.values()) {
      if (p.t.polarity !== "negative") continue;
      n++;
      const j = judgeProbe(p.t, p.spec, p.binding, p.spans, maximallySatisfied(p, o, triggerFns));
      if (j.verdict !== "not_measured") bad.push(`${p.t.testId}: ${j.observation}/${j.verdict}`);
    }
    push({
      defect: `a malformed probe's genuine ${o.sqlstate} ("${o.message}") meets every refusal expectation`,
      gate: "judge: a malformed statement is the harness's fault, not a refusal",
      caught: o.sqlstate === "42601" && bad.length === 0,
      firedCheck: bad.length ? `${bad.length} negative(s) accepted it: ${bad.slice(0, 4).join("; ")}` : `all ${n} negatives → harness_error / not_measured (mechanism '${classify(o, triggerFns).kind}')`,
      consequence: "record: harness_error → not_measured; execute-wp3 exits 1",
    });
  }
  {
    // An unrelated business prerequisite: delete_own_account refuses alice
    // because she holds a live seat — the rule D3.41 says must not satisfy .283.
    const p = P("F5.delete_own_account.283");
    const s = await roleSession({ role: "authenticated", claims: claimsFor("alice"), label: "prove-gates:alice" });
    let o: Outcome;
    try {
      await s.query("begin");
      o = await execute(s, p.spec.statement, p.spec.params);
    } finally {
      await s.query("rollback").catch(() => {});
      await s.close();
    }
    const j = judgeProbe(p.t, p.spec, p.binding, p.spans, maximallySatisfied(p, o, triggerFns));
    push({
      defect: `F5.delete_own_account.283 on the baseline, where alice holds a live seat: the call is refused by the active-seat rule (${o.sqlstate} '${o.error?.message ?? o.message}')`,
      gate: "judge: a business prerequisite is not the security property (D3.41); .283's own setup stands alice up first",
      caught: o.raised && j.verdict === "not_measured" && j.observation === "control_not_reached",
      firedCheck: j.claims.map((c) => `${c.evaluator}=${c.status}${c.cls ? `/${c.cls}` : ""}`).join(", "),
      consequence: consequenceOf(j),
    });
  }
  {
    // The genuine pg_safeupdate refusal, judged as if nobody had registered it:
    // an earlier layer than the grant, so never "the privilege check passed".
    const s = await roleSession({ role: "authenticated", claims: claimsFor("alice"), label: "prove-gates:alice" });
    let o: Outcome;
    try { await s.query("begin"); o = await execute(s, "update public.game_sessions set tier = tier"); } finally { await s.query("rollback").catch(() => {}); await s.close(); }
    const bad: string[] = [];
    let n = 0;
    for (const p of prepared.values()) {
      if (!/#grant:/.test(p.t.control) || p.t.polarity !== "negative") continue;
      n++;
      const j = judgeProbe(p.t, p.spec, p.binding, p.spans, maximallySatisfied(p, o, triggerFns));
      if (j.verdict !== "not_measured" || j.observation !== "control_not_reached") bad.push(`${p.t.testId}: ${j.observation}/${j.verdict}`);
    }
    // Since Gate A (C2-client-guard-before-grant, D3.54) no grant row is
    // registered, and every real grant-surface UPDATE/DELETE ends in `where
    // true`, so a real run can no longer meet this refusal — which the gate
    // also checks, rather than assuming.
    const grantRows = [...prepared.values()].filter((p) => /#grant:authenticated:(UPDATE|DELETE)$/.test(p.t.control));
    const withoutWhere = grantRows.filter((p) => !/\swhere true$/.test(p.spec.statement)).map((p) => p.t.testId);
    const stillRegistered = grantRows.filter((p) => contradictionDisposition(p.t.testId) !== null).map((p) => p.t.testId);
    push({
      defect: `a client guard's genuine ${o.sqlstate} ('${o.error?.message ?? o.message}') is read as the grant surface's answer`,
      gate: "judge: pg_safeupdate refuses BEFORE the privilege check, so the privilege claim was not reached (never 'passed', never 'deficient'); and no real grant statement can meet it",
      caught: o.sqlstate === "21000" && bad.length === 0 && withoutWhere.length === 0 && stillRegistered.length === 0 && grantRows.length === 34,
      firedCheck: bad.length ? `${bad.length} grant negative(s) mis-read it: ${bad.slice(0, 3).join("; ")}` :
        `all ${n} grant-surface negatives → control_not_reached / not_measured; the real plan's ${grantRows.length} UPDATE/DELETE grant statements: ${withoutWhere.length} without a WHERE, ${stillRegistered.length} still registered`,
      consequence: `record: control_not_reached → not_measured, never effective and never deficient`,
    });
  }
  {
    // Gate A, D-283 (D3.54): delete_own_account's invariant must tell the
    // documented cleanup (B) from any other change to another account (C). The
    // classifier is handed synthetic before/after states: the documented
    // handover must pass; each forbidden change must fail on its own.
    const Al = FIXTURES.alice.value, Bo = FIXTURES.bob.value, Ca = CAROL, others = [Bo, Ca];
    const room = { id: "r1", host_user_id: Al, status: "lobby", code: "ATSTAB" };
    const mAl = { id: "m1", room_id: "r1", user_id: Al, status: "joined", joined_at: "2026-09-24T00:00:00Z" };
    const mBo = { id: "m2", room_id: "r1", user_id: Bo, status: "joined", joined_at: "2026-09-24T00:01:00Z" };
    const mCa = { id: "m3", room_id: "r1", user_id: Ca, status: "joined", joined_at: "2026-09-24T00:02:00Z" };
    const wallet = { id: "w1", user_id: Bo, balance: 25000 };
    const friendsBC = { id: "f1", user_id_a: Bo, user_id_b: Ca };
    const friendsAB = { id: "f2", user_id_a: Al, user_id_b: Bo };
    const before = [
      ["public.friendships", "f1", friendsBC], ["public.friendships", "f2", friendsAB],
      ["public.room_members", "m1", mAl], ["public.room_members", "m2", mBo], ["public.room_members", "m3", mCa],
      ["public.rooms", "r1", room], ["public.wallets", "w1", wallet],
    ];
    // The documented deletion: alice's membership and friendship cascade away,
    // the lobby passes to bob (the earliest joined remaining member).
    const documented = [
      ["public.friendships", "f1", friendsBC], ["public.room_members", "m2", mBo], ["public.room_members", "m3", mCa],
      ["public.rooms", "r1", { ...room, host_user_id: Bo }], ["public.wallets", "w1", wallet],
    ];
    const swap = (rows: unknown[][], rel: string, id: string, row: unknown | null) => {
      const out = rows.filter((r) => !(r[0] === rel && r[1] === id));
      return row === null ? out : [...out, [rel, id, row]];
    };
    const cases: [string, unknown[][], boolean][] = [
      ["the documented handover to the longest-joined member, with alice's rows cascaded", documented, true],
      ["the lobby handed to carol, who joined after bob", swap(documented, "public.rooms", "r1", { ...room, host_user_id: Ca }), false],
      ["bob's wallet balance altered", swap(documented, "public.wallets", "w1", { ...wallet, balance: 0 }), false],
      ["the bob<->carol friendship, which does not involve alice, removed", swap(documented, "public.friendships", "f1", null), false],
      ["a new row naming bob appears", [...documented, ["public.notifications", "n9", { id: "n9", user_id: Bo }]], false],
      ["carol's membership row altered", swap(documented, "public.room_members", "m3", { ...mCa, status: "left" }), false],
    ];
    const got = cases.map(([what, after, want]) => {
      const r = classifyAccountDeletion(JSON.stringify(before), JSON.stringify(after), Al, others);
      return { what, ok: r.ok === want, detail: `${r.ok ? "permitted" : "refused"}` };
    });
    // The unrelated-tables digest sees a change to a table no account reaches.
    const u0 = await unrelatedTablesDigest(ctx.admin);
    const u1 = await inRollback(ctx.admin, async () => {
      await ctx.admin.query(`update public.rulesets set description = coalesce(description, '') || ' (prove-gates)' where id = (select id from public.rulesets order by id limit 1)`);
      return unrelatedTablesDigest(ctx.admin);
    });
    push({
      defect: "delete_own_account's invariant: a lobby handed to the wrong member, another account's wallet altered, an unrelated friendship removed, a new row naming another account, another member's row altered — and a global table changed",
      gate: "guard: documented_effects_only permits exactly the documented deletion effects (B) and refuses any other cross-account change (C); no_unrelated_change sees a table no account reaches",
      caught: got.every((g) => g.ok) && u0 !== u1,
      firedCheck: `${got.map((g) => `${g.what}: ${g.detail}${g.ok ? "" : " (WRONG)"}`).join("; ")}; rulesets changed → unrelated digest ${u0 !== u1 ? "moved" : "DID NOT MOVE"}`,
      consequence: "record: not_as_predicted → deficient for a category-C change; as_predicted only when every change is documented",
    });
  }
  {
    // Unknown evaluator names: the judge must not pass what it cannot read.
    const p = P(plan.tests.find((t) => t.polarity === "negative")!.testId);
    const spans = p.spans.map((s) => (s.kind === "outcome" ? { ...s, eval: "custom:attacker_discouraged" } : s));
    const ok: Outcome = { executed: true, raised: false, rowCount: 0, sqlstate: null, message: null, harnessError: false, sample: [], rows: [], columns: [] };
    const j = judgeProbe(p.t, p.spec, p.binding, spans, maximallySatisfied(p, ok, triggerFns));
    push({
      defect: `${p.t.testId}: a claim names an evaluator nobody implements ("custom:attacker_discouraged")`,
      gate: "preflight: [R1] every evaluator is implemented; judge: an unknown expectation is a harness error, never met",
      caught: evaluatorFor("custom:attacker_discouraged") === null && j.observation === "harness_error" && j.verdict === "not_measured",
      firedCheck: j.claims.filter((c) => c.evaluator.startsWith("custom:")).map((c) => `${c.evaluator}=${c.status}/${c.cls}: ${c.detail}`).join("; "),
      consequence: consequenceOf(j),
    });
  }
  {
    // A vacuous leaderboard: "no private-privacy identity" true of zero rows.
    const p = findP((x) => x.spans.some((s) => s.eval === "result:no_private_identity" || s.eval === "result:public_safe"), "a leaderboard privacy row");
    const empty: Outcome = { executed: true, raised: false, rowCount: 0, sqlstate: null, message: null, harnessError: false, sample: [], rows: [], columns: ["rank", "display_name", "avatar_asset_key", "value", "detail", "is_you"] };
    const j = judgeProbe(p.t, p.spec, p.binding, p.spans, maximallySatisfied(p, empty, triggerFns));
    push({
      defect: `${p.t.testId}: the leaderboard returns no rows, so "no private-privacy identity appears" would be true of nothing`,
      gate: "judge: an empty result cannot satisfy a claim about what the result contains (R2)",
      caught: j.verdict === "not_measured",
      firedCheck: j.claims.map((c) => `${c.evaluator}=${c.status}${c.cls ? `/${c.cls}` : ""}`).join(", "),
      consequence: consequenceOf(j),
    });
  }

  // ------------------------------------------------------------------
  // 6. roles, Realtime, evidence schema
  // ------------------------------------------------------------------
  {
    const live = rolePropertiesHold(ctx.liveRoleProps);
    const inversions = [
      { ...ctx.liveRoleProps, postgresBypassRls: !ctx.liveRoleProps.postgresBypassRls },
      { ...ctx.liveRoleProps, authenticatorBypassRls: !ctx.liveRoleProps.authenticatorBypassRls },
      { ...ctx.liveRoleProps, authenticatorSuperuser: !ctx.liveRoleProps.authenticatorSuperuser },
    ].map(rolePropertiesHold);
    push({
      defect: "a role property the control tests rest on is inverted (postgres, authenticator)",
      gate: "preflight: role properties match what the plan assumes",
      caught: live && inversions.every((x) => x === false),
      firedCheck: `live: ${live ? "hold" : "DO NOT HOLD"}; each of three inverted: ${inversions.map((x) => (x ? "PASSED (not caught)" : "refused")).join(", ")}`,
      consequence: EXIT_PREFLIGHT,
    });
    const good = [
      { rolname: "postgres", rolsuper: false, rolbypassrls: true },
      { rolname: F7_SCRATCH.owner, rolsuper: false, rolbypassrls: false },
      { rolname: F7_SCRATCH.bypass, rolsuper: false, rolbypassrls: true },
    ];
    const allOk = (c: Record<string, { ok: boolean }>) => Object.values(c).every((x) => x.ok);
    const wrongs: [string, boolean][] = [
      ["the bypass role lacks BYPASSRLS", allOk(f7RoleClaims(good.map((r) => (r.rolname === F7_SCRATCH.bypass ? { ...r, rolbypassrls: false } : r)), F7_SCRATCH.owner, false))],
      ["the owner role holds BYPASSRLS", allOk(f7RoleClaims(good.map((r) => (r.rolname === F7_SCRATCH.owner ? { ...r, rolbypassrls: true } : r)), F7_SCRATCH.owner, false))],
      ["the bypass role owns the table", allOk(f7RoleClaims(good, F7_SCRATCH.bypass, false))],
      ["the bypass role is a member of the owner role", allOk(f7RoleClaims(good, F7_SCRATCH.owner, true))],
      ["a scratch role is a superuser", allOk(f7RoleClaims(good.map((r) => (r.rolname === F7_SCRATCH.owner ? { ...r, rolsuper: true } : r)), F7_SCRATCH.owner, false))],
    ];
    push({
      defect: "the F7 scratch roles are built with the wrong properties",
      gate: "preflight: [F7] the scratch roles carry exactly the properties the mechanism rests on",
      caught: allOk(f7RoleClaims(good, F7_SCRATCH.owner, false)) && wrongs.every(([, ok]) => !ok),
      firedCheck: `correct properties: ${allOk(f7RoleClaims(good, F7_SCRATCH.owner, false)) ? "accepted" : "REFUSED"}; ${wrongs.map(([w, ok]) => `${w}: ${ok ? "ACCEPTED (not caught)" : "refused"}`).join("; ")}`,
      consequence: EXIT_PREFLIGHT,
    });
  }
  {
    // D3.50: the plan is read from the live catalogs, so an instance that is
    // not a build of the migration files must be refused before anything is
    // planned from it. Staged exactly as found on 2026-09-24 — a migration
    // applied from the author's other checkout — and as its mirror image, a
    // file never applied; each inside a rolled-back transaction, read back
    // through the same two functions the planner uses.
    const sv = await readSchemaVersion();
    const live = unbuiltInstanceReason(await readAppliedState(ctx.admin, sv));
    const extra = await inRollback(ctx.admin, async () => {
      await ctx.admin.query(`insert into supabase_migrations.schema_migrations (version, name) values ('20260915120000', 'pseudonymous_players')`);
      return unbuiltInstanceReason(await readAppliedState(ctx.admin, sv));
    });
    const lastFile = sv.migrations[sv.migrations.length - 1]!.version;
    const missing = await inRollback(ctx.admin, async () => {
      await ctx.admin.query(`delete from supabase_migrations.schema_migrations where version = $1`, [lastFile]);
      return unbuiltInstanceReason(await readAppliedState(ctx.admin, sv));
    });
    push({
      defect: "the shared local instance is not a build of the migration files (a migration applied from another checkout; a file not applied)",
      gate: "planner: refuse to read a plan from an instance that is not a build of these files (every WP3 command plans first)",
      caught: live === null && extra !== null && missing !== null,
      firedCheck: `live instance: ${live === null ? "accepted" : `REFUSED: ${live}`}; migration with no file: ${extra ? "refused" : "ACCEPTED (not caught)"}; file not applied (${lastFile}): ${missing ? "refused" : "ACCEPTED (not caught)"}`,
      consequence: "the command throws before planning → exit 1; nothing executes",
    });
  }
  {
    const down = await realtimeHealthy("http://127.0.0.1:9/realtime/v1/api/tenants/realtime-dev/health");
    const live = await realtimeHealthy(ctx.realtimeUrl);
    push({
      defect: "the Realtime service is unreachable while F8 socket probes are planned",
      gate: "preflight: [F8] the local Realtime service is healthy",
      caught: !down.ok && live.ok,
      firedCheck: `pointed at a closed port: ${down.detail}; the live service: ${live.detail}`,
      consequence: EXIT_PREFLIGHT,
    });
    // And if it drops mid-run: the observation window never goes live.
    const bad: string[] = [];
    for (const p of prepared.values()) {
      if (p.spec.kind !== "socket") continue;
      const claims: Record<string, { ok: boolean; detail: string; cls: "precondition" }> = {};
      for (const s of p.spans) if (s.eval?.startsWith("runner:")) claims[s.eval.slice(7)] = { ok: false, detail: "staged: the window never went live", cls: "precondition" };
      const ob = maximallySatisfied(p, { executed: true, raised: false, rowCount: 0, sqlstate: null, message: "", harnessError: false, sample: [], rows: [], columns: [] }, triggerFns, { runnerClaims: claims });
      const j = judgeProbe(p.t, p.spec, p.binding, p.spans, { ...ob, premises: [...ob.premises, { id: "window_live", describe: "the observation window is live", ok: false, detail: "staged: no warm-up broadcast arrived" }] });
      if (j.verdict !== "not_measured") bad.push(`${p.t.testId}: ${j.observation}/${j.verdict}`);
    }
    push({
      defect: "Realtime stops delivering mid-run: no subscriber — authorised or not — receives anything (silence everywhere)",
      gate: "socket runner: silence counts only inside a window an observer proved live",
      caught: bad.length === 0,
      firedCheck: bad.length ? `${bad.join("; ")}` : "every socket row → precondition_failed / not_measured (neither 'refused' nor 'did not receive')",
      consequence: "record: precondition_failed → not_measured",
    });
  }
  {
    // A websocket that authenticated as someone other than the row names.
    const bad: string[] = [];
    for (const p of prepared.values()) {
      if (p.spec.kind !== "socket") continue;
      const ob = maximallySatisfied(p, { executed: true, raised: false, rowCount: 0, sqlstate: null, message: "", harnessError: false, sample: [], rows: [], columns: [] }, triggerFns);
      const j = judgeProbe(p.t, p.spec, p.binding, p.spans, { ...ob, premises: [...ob.premises, { id: "identity", describe: `the websocket authenticated as ${p.t.identity}`, ok: false, detail: "staged: token presented sub=<bob>" }] });
      if (j.verdict !== "not_measured") bad.push(`${p.t.testId}: ${j.observation}/${j.verdict}`);
    }
    push({
      defect: "a socket probe presents a token for a different subject than the row's identity",
      gate: "socket runner: the identity premise is read back from the token presented",
      caught: bad.length === 0,
      firedCheck: bad.length ? bad.join("; ") : "every socket row → precondition_failed / not_measured",
      consequence: "record: precondition_failed → not_measured",
    });
  }
  {
    const base: Partial<Wp3EvidenceRecord> = { schema: WP3_EVIDENCE_SCHEMA_VERSION };
    const missing = validateRecord({ ...base, observation: "as_predicted", verdict: "effective" });
    const inconsistent = validateRecord({ ...base, observation: "harness_error", verdict: "effective", polarity: "positive", authorIntent: null });
    const unmetEffective = validateRecord({ ...base, observation: "as_predicted", verdict: "effective", polarity: "positive", authorIntent: null, claimResults: [{ text: "x", kind: "outcome", evaluator: "rows_affected=1", status: "unmet", detail: "" }] });
    push({
      defect: "an evidence record missing required fields, a harness error carrying a verdict, an 'effective' with an unmet claim",
      gate: "evidence schema: validateRecord",
      caught: missing.length > 0 && inconsistent.some((x) => /must carry verdict not_measured/.test(x)) && unmetEffective.some((x) => /claim not met/.test(x)),
      firedCheck: `missing: ${missing.length} problem(s) (${missing.slice(0, 2).join("; ")}); harness+effective: ${inconsistent.filter((x) => /not_measured|as_predicted/.test(x)).join("; ")}; unmet+effective: ${unmetEffective.filter((x) => /claim/.test(x)).join("; ")}`,
      consequence: EXIT_PREFLIGHT,
    });
  }

  // ------------------------------------------------------------------
  // 7. author intents
  // ------------------------------------------------------------------
  const intentGate = (defect: string, gate: string, expect: RegExp, mutate: (s: IntentStore) => void, forExecution = true) => {
    const s = clone(store);
    mutate(s);
    const fired = validateIntents(plan, s, forExecution).filter((v) => !v.passed);
    const hit = fired.filter((v) => expect.test(v.check));
    push({
      defect, gate, caught: hit.length > 0,
      firedCheck: fired.map((v) => `${v.check}: ${v.detail}`).join(" | ").slice(0, 400) || "nothing fired",
      consequence: hit.length ? `preflight --for-execution FAILS → execute-wp3 exits 1; nothing executes` : "NOT CAUGHT",
    });
  };
  const intents = (s: IntentStore) => s.intents as IntentStore["intents"][number][];
  intentGate("an intent entry is missing for a required Test ID", "intent validation: every matrix negative has a canonical entry", /every matrix negative/, (s) => { intents(s).splice(0, 1); }, false);
  intentGate("the store carries an entry the matrix does not require", "intent validation: no entry that the matrix does not require", /does not require/, (s) => { intents(s).push({ testId: "F1.not.a.real.test", intent: "x", provenance: "user_authored", reviewStatus: "approved" }); }, false);
  intentGate("an intent is blank", "intent validation: no entry carries a blank sentence", /blank/, (s) => { intents(s)[0] = { ...intents(s)[0]!, intent: "   " }; }, false);
  intentGate("a Test ID appears twice in the store", "intent validation: no duplicate Test ID", /duplicate/, (s) => { intents(s).push({ ...intents(s)[0]! }); }, false);
  // Both used to rely on the real store BEING all AI drafts — which stopped
  // being true when the author adopted every sentence at Gate A (D3.54), and
  // both then "passed" by catching nothing. They inject the state now.
  intentGate("every required intent is still an unreviewed AI draft, and a real run is requested", "intent validation: every required intent is authored or reviewed by the author", /authored or reviewed/, (s) => {
    for (const e of intents(s)) Object.assign(e, { provenance: "ai_draft", reviewStatus: "unreviewed" });
  });
  intentGate("an ai_draft is marked approved without changing its provenance", "intent validation: no ai_draft is marked approved", /no ai_draft is marked approved/, (s) => { intents(s)[0] = { ...intents(s)[0]!, provenance: "ai_draft", reviewStatus: "approved" }; }, false);
  intentGate("a draft relabelled user_reviewed_ai_draft but left unreviewed", "intent validation: every required intent is authored or reviewed by the author", /authored or reviewed/, (s) => {
    for (const e of intents(s)) Object.assign(e, { provenance: "user_reviewed_ai_draft", reviewStatus: "approved" });
    intents(s)[0] = { ...intents(s)[0]!, reviewStatus: "unreviewed" };
  });
  {
    const drafts = new Map(store.intents.map((e) => [e.testId, e.intent]));
    const victim = [...drafts.keys()].find((k) => k.startsWith("F1."))!;
    drafts.set(victim, "Verify that the policy returns zero rows for SQLSTATE 42501.");
    const fired = validateDraftQuality(plan, drafts).filter((f) => f.testId === victim);
    push({
      defect: "a draft describes the test rather than the attack",
      gate: "draft quality: names the attack, not the test",
      caught: fired.length > 0, firedCheck: fired.map((f) => f.check).join("; ") || "nothing fired",
      consequence: fired.length ? "draft-intents refuses the package (exit 1)" : "NOT CAUGHT",
    });
  }
  {
    const drafts = new Map(store.intents.map((e) => [e.testId, e.intent]));
    const victim = [...drafts.keys()].find((k) => k.startsWith("F5."))!;
    drafts.set(victim, "An attacker, as a other party, calls the function to read what is not theirs.");
    const fired = validateDraftQuality(plan, drafts).filter((f) => f.testId === victim);
    push({
      defect: "a draft carries a grammatical defect ('a other party')",
      gate: "draft quality: article agreement",
      caught: fired.some((f) => /article|grammar/i.test(f.check)), firedCheck: fired.map((f) => `${f.check}: ${f.problem}`).join("; ") || "nothing fired",
      consequence: fired.length ? "draft-intents refuses the package (exit 1)" : "NOT CAUGHT",
    });
  }
  {
    // The five defect classes the 2026-09-24 audit found by reading, each
    // re-injected as the exact sentence the store carried before the audit,
    // on its own row. Each must fire its own check, not merely some check.
    const cases: [string, string, RegExp][] = [
      ["F1.public_profiles.148", "A signed-in player reads the profile of someone who has blocked them, defeating the block that is supposed to make that profile invisible to exactly this viewer.", /block's direction/],
      ["B.public_wallets.344", "A token that outlived the account it was issued for is replayed, so a deleted user's credentials still reach another player's chip balance.", /deleted-user target/],
      ["F1.public_game_events.073", "A signed-in player holding no seat at that table reads the live event stream at that table.", /dangling reference/],
      ["F4.public_daily_entries.052", "Without ever signing in or holding an account, someone reads another player's daily-challenge attempt and score before or after their own.", /anonymous actor/],
      ["F5.latest_verifiable_daily_challenge.278", "A signed-out visitor calls latest_verifiable_daily_challenge(), whose housekeeping legitimately touches other accounts' rows, and gets it to go further than that: returning a seed for a challenge that has NOT been revealed — the body's `where revealed_seed is not null` is the entire control.", /shared effect/],
    ];
    const results = cases.map(([id, sentence, want]) => {
      const drafts = new Map(store.intents.map((e) => [e.testId, e.intent]));
      if (!drafts.has(id)) return { id, ok: false, fired: "no such required Test ID" };
      drafts.set(id, sentence);
      const fired = validateDraftQuality(plan, drafts).filter((f) => f.testId === id);
      return { id, ok: fired.some((f) => want.test(f.check)), fired: fired.map((f) => f.check).join("; ") || "nothing fired" };
    });
    push({
      defect: "five sentences the pre-audit store carried: a reversed block direction, a deleted-user row aimed at another account, a dangling 'that table', an anonymous actor with 'their own' score, and housekeeping claimed for a function that has none",
      gate: "draft quality: the five checks added by the 2026-09-24 audit, each on its own row",
      caught: results.every((r) => r.ok),
      firedCheck: results.map((r) => `${r.id}: ${r.ok ? "" : "NOT CAUGHT — "}${r.fired}`).join(" | "),
      consequence: results.every((r) => r.ok) ? "draft-intents refuses the package (exit 1)" : "NOT CAUGHT",
    });
  }
  {
    const drafts = new Map(store.intents.map((e) => [e.testId, e.intent]));
    const a = [...drafts.keys()].find((k) => k.startsWith("F1."))!;
    const b = [...drafts.keys()].filter((k) => k.startsWith("F2."))[0]!;
    drafts.set(b, drafts.get(a)!);
    const fired = validateDraftQuality(plan, drafts).filter((f) => /share a sentence/.test(f.check));
    push({
      defect: "two probes are given the same sentence",
      gate: "draft quality: no two probes share a sentence",
      caught: fired.length > 0, firedCheck: fired.map((f) => f.problem).join("; ").slice(0, 240) || "nothing fired",
      consequence: fired.length ? "draft-intents refuses the package (exit 1)" : "NOT CAUGHT",
    });
  }

  // ------------------------------------------------------------------
  // 7a. the F10 absence probe (D3.55): a guard that refuses a delete is not a
  //     trail; a trigger that writes a record is. Staged on a resource whose
  //     real result is an absence, inside rolled-back transactions.
  // ------------------------------------------------------------------
  {
    const absence = findP((p) => p.spec.kind === "audit_absence" && p.t.resource === "public.friendships", "the F10 absence probe on public.friendships");
    const sql = absence.spec.assertSql!;
    const read = async () => (await ctx.admin.query(sql)).rows[0] as { no_trail: boolean; detail: string };
    const real = await read();
    const guard = await inRollback(ctx.admin, async () => {
      await ctx.admin.query(`create function public.attest_pg_refuse_delete() returns trigger language plpgsql as $f$ begin raise exception 'attest: refused'; end $f$`);
      await ctx.admin.query(`create trigger attest_pg_refuse_delete before delete on public.friendships for each row execute function public.attest_pg_refuse_delete()`);
      return read();
    });
    const archive = await inRollback(ctx.admin, async () => {
      await ctx.admin.query(`create table public.attest_pg_friendships_archive (row_text text, archived_at timestamptz default now())`);
      await ctx.admin.query(`create function public.attest_pg_archive_delete() returns trigger language plpgsql as $f$ begin insert into public.attest_pg_friendships_archive (row_text) values (old::text); return old; end $f$`);
      await ctx.admin.query(`create trigger attest_pg_archive_delete before delete on public.friendships for each row execute function public.attest_pg_archive_delete()`);
      return read();
    });
    push({
      defect: "the F10 absence probe meets (1) a DELETE trigger that only refuses, and (2) a DELETE trigger that writes an archive row",
      gate: "F10 absence (D3.55): only a trigger that writes a record counts as a trail; a refusing guard is reported separately",
      caught: real.no_trail === true && guard.no_trail === true && archive.no_trail === false,
      firedCheck: `real: no_trail ${real.no_trail}; with a refusing guard: no_trail ${guard.no_trail} (${guard.detail}); with an archiving trigger: no_trail ${archive.no_trail}`,
      consequence: "a write guard never turns an audit gap into a 'trail found'; an archive does",
    });
  }

  // ------------------------------------------------------------------
  // 7b. the WP4 drift detector (D3.56), on a real committed inventory
  // ------------------------------------------------------------------
  {
    const base = JSON.parse(await readFile(join(RUNS_ROOT, "20260922T234324Z-5695a4c3df2d", "inventory.json"), "utf8")) as Inventory;
    const same = diffInventories(base, clone(base));
    const quiet = same.added.length + same.removed.length + same.changed.length + same.newResources.length + same.newlyExposed.length === 0;
    push({
      defect: "(control) the WP4 detector compares an inventory with an unchanged copy of itself",
      gate: "wp4 drift: no drift is reported where nothing changed",
      caught: quiet, firedCheck: quiet ? "no drift of any class" : `REPORTED DRIFT: ${JSON.stringify(same.counts)}`,
      consequence: "drift report: nothing", control: true,
    });
    type Mut = (inv: { resources: Record<string, unknown>[]; controls: Record<string, unknown>[]; observations: Record<string, unknown>[] }) => void;
    const mutations: [string, Mut, (d: ReturnType<typeof diffInventories>) => boolean][] = [
      ["a table added with row-level security off and reachable by anon", (inv) => {
        inv.resources.push({ resource: "public.attest_injected", schema: "public", name: "attest_injected", kind: "table", owner: "postgres", rlsEnabled: false, rlsForced: false, policyCount: 0, reachableBy: { anon: ["SELECT"] }, columnReachableBy: {}, writeGuards: [] });
        inv.controls.push({ resource: "public.attest_injected", resourceKind: "table", controlKind: "rls_enabled", controlId: "public.attest_injected#rls_enabled", present: false, detail: { rls_enabled: false }, declaredIntent: null });
        inv.observations.push({ resource: "public.attest_injected", kind: "rls_disabled_and_reachable", detail: "injected" });
      }, (d) => d.counts.newUnprotectedResources === 1 && d.counts.newUnprotectedReachable === 1 && d.newResources[0]?.resource === "public.attest_injected"],
      ["a table added with row-level security off and NO client grant (Arc21's default privileges since 2026-09-04)", (inv) => {
        inv.resources.push({ resource: "public.attest_injected_ungranted", schema: "public", name: "attest_injected_ungranted", kind: "table", owner: "postgres", rlsEnabled: false, rlsForced: false, policyCount: 0, viewSecurityInvoker: null, reachableBy: {}, columnReachableBy: {}, writeGuards: [] });
      }, (d) => d.counts.newUnprotectedResources === 1 && d.counts.newUnprotectedReachable === 0 && d.newResources[0]?.clientReachable === false],
      ["an existing table's row-level security switched off", (inv) => {
        const r = inv.resources.find((x) => x.kind === "table" && x.rlsEnabled === true)!;
        r.rlsEnabled = false;
      }, (d) => d.newlyExposed.length === 1 && d.newlyExposed[0]!.lostRowControl === true],
      ["a policy's USING expression replaced with true", (inv) => {
        const c = inv.controls.find((x) => x.controlKind === "policy")!;
        c.detail = { ...(c.detail as Record<string, unknown>), using_expr: "true" };
      }, (d) => d.counts.definitionChanged === 1 && d.counts.changed === 1],
      ["a policy removed", (inv) => {
        const i = inv.controls.findIndex((x) => x.controlKind === "policy");
        inv.controls.splice(i, 1);
      }, (d) => d.counts.removed === 1 && d.counts["removed.policy"] === 1],
      ["a table grant widened (DELETE granted)", (inv) => {
        const c = inv.controls.find((x) => x.controlKind === "table_grant")!;
        const det = c.detail as { privileges: string[] };
        c.detail = { ...det, privileges: [...det.privileges.filter((x) => x !== "DELETE"), "DELETE", "TRUNCATE"] };
      }, (d) => d.counts.attributesChanged === 1 && d.counts.definitionChanged === 0],
    ];
    const got = mutations.map(([what, mutate, ok]) => {
      const b = clone(base) as unknown as Parameters<Mut>[0];
      mutate(b);
      const d = diffInventories(base, b as unknown as Inventory);
      return { what, ok: ok(d), counts: d.counts };
    });
    const pts = (xs: [string, string][]) => new Map<string, ResultPoint>(xs.map(([id, v]) => [id, { verdict: v, observation: v === "not_measured" ? "precondition_failed" : v === "effective" ? "as_predicted" : "not_as_predicted" }]));
    const tr = diffResults(pts([["T.1", "effective"], ["T.2", "deficient"], ["T.3", "effective"], ["T.4", "effective"]]), pts([["T.1", "deficient"], ["T.2", "effective"], ["T.3", "effective"], ["T.5", "effective"]]));
    const trOk = tr.counts["pass → fail"] === 1 && tr.counts["fail → pass"] === 1 && tr.counts["unchanged"] === 1 && tr.counts["only in the earlier run"] === 1 && tr.counts["only in the later run"] === 1;
    push({
      defect: "WP4: a table added with no control (reachable, and unreachable), an existing table's RLS switched off, a policy's USING replaced with true, a policy removed, a grant widened — and one pass→fail, one fail→pass, and a probe incompatible with one state",
      gate: "wp4 drift: each change lands in exactly its class; a probe a state could not run is never a pass or a failure",
      caught: got.every((g) => g.ok) && trOk,
      firedCheck: `${got.map((g) => `${g.what}: ${g.ok ? "classified" : `MISCLASSIFIED ${JSON.stringify(g.counts)}`}`).join("; ")}; transitions ${JSON.stringify(tr.counts)}`,
      consequence: "the drift report names the change in its class",
    });
  }

  // ------------------------------------------------------------------
  // 7c. the independent WP3 validator (D3.55), on the newest complete results file
  //
  // Each case breaks one thing in an in-memory copy of a real, committed
  // results file and requires the check that owns it to fail and to name the
  // record. Nothing is written anywhere. An aborted run is skipped: it lacks
  // most of the kinds of record the cases break.
  // ------------------------------------------------------------------
  {
    // The author's official run (J14), never merely the newest: a `run --confirm` reproduction is newer.
    let resultsRun: string | null = null;
    for (const d of [(await loadOfficialRuns()).wp3, ...(await readdir(RUNS_ROOT)).sort().reverse()]) {
      try {
        const f = JSON.parse(await readFile(join(RUNS_ROOT, d, "wp3-results.json"), "utf8")) as { meta?: { aborted?: unknown }; records?: unknown[] };
        if (!f.meta?.aborted && (f.records?.length ?? 0) === ctx.manifest.rows.length) { resultsRun = d; break; }
      } catch { /* next */ }
    }
    if (!resultsRun) {
      push({ defect: "the independent WP3 validator", gate: "validate-wp3", caught: false, firedCheck: "NO WP3 RESULTS FILE EXISTS TO BREAK", consequence: "unproven" });
    } else {
      type Rec = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
      const off7 = await loadOfficialRuns();
      const inputs = await loadValidationInputs(resultsRun, resultsRun === off7.wp3 ? off7.plan : undefined);
      const base = validateLoaded(resultsRun, inputs);
      const again = validateLoaded(resultsRun, inputs);
      const deterministic = JSON.stringify(base) === JSON.stringify(again);
      push({
        defect: `(control) the real results file of run ${resultsRun}, validated twice`,
        gate: "validate-wp3 is deterministic: the same file gives the same checks",
        caught: deterministic,
        firedCheck: deterministic ? `identical; that run itself ${base.passed ? "PASSES" : `FAILS ${base.checks.filter((c) => !c.passed).map((c) => c.name).join("; ")}`}` : "THE SAME FILE VALIDATED DIFFERENTLY",
        consequence: "a stable verdict on the real evidence", control: true,
      });
      const recs = inputs.file.records as Rec[];
      const pick = (f: (r: Rec, i: number) => boolean) => recs.findIndex(f);
      const iServer = pick((r) => /server-side/.test(String(r.identityPlanned)) && r.identity !== null);
      const iAlice = pick((r) => r.identityPlanned === "authenticated:alice" && r.identity !== null);
      const iDeficient = pick((r) => r.verdict === "deficient");
      const iNegative = pick((r) => r.polarity === "negative");
      const iAfterDirty = pick((r, i) => i > 0 && (recs[i - 1]!.isolation as Rec).rebuildAfterBecause !== null);
      const cases: { what: string; check: string; index: number; mutate: (f: Rec, r: Rec) => void; namesRecord: boolean }[] = [
        { what: "a record dropped from the file", check: "exactly one record per approved Test ID", index: 10, mutate: (f) => { (f.records as Rec[]).splice(10, 1); }, namesRecord: true },
        { what: "a server-side record's read-back identity removed", check: "every session identity read back", index: iServer, mutate: (_f, r) => { r.identity = null; }, namesRecord: true },
        { what: "a role-scoped session read back as bypassing RLS", check: "every session identity read back", index: iAlice, mutate: (_f, r) => { r.identity = { ...r.identity, bypassesRls: true }; }, namesRecord: true },
        { what: "a deficient verdict rewritten as effective", check: "each verdict is what its observation maps to", index: iDeficient, mutate: (_f, r) => { r.verdict = "effective"; }, namesRecord: true },
        { what: "an unmet claim's observation rewritten as as_predicted", check: "each observation is what the raw claim statuses", index: iDeficient, mutate: (_f, r) => { r.observation = "as_predicted"; }, namesRecord: true },
        { what: "an unadopted AI draft in a negative record", check: "every negative carries the store's adopted intent", index: iNegative, mutate: (_f, r) => { r.intentProvenance = "ai_draft"; }, namesRecord: true },
        { what: "a planned expectation edited inside the evidence", check: "every record's planned fields are the planning run's row", index: iNegative, mutate: (_f, r) => { r.expectedPlanned = `${String(r.expectedPlanned)} (edited)`; }, namesRecord: true },
        { what: "one record's harness hash altered", check: "every record carries the same harness hash", index: 0, mutate: (_f, r) => { r.harness = { ...r.harness, sourcesSha256: "0".repeat(64) }; }, namesRecord: false },
        { what: "a probe after a dirty one recorded as running without a rebuild", check: "isolation:", index: iAfterDirty, mutate: (_f, r) => { r.isolation = { ...r.isolation, rebuiltBefore: false }; }, namesRecord: true },
        { what: "the file's own totals altered", check: "the file's own byVerdict and byObservation", index: 0, mutate: (f) => { f.byVerdict = { ...f.byVerdict, effective: Number(f.byVerdict?.effective ?? 0) + 1 }; }, namesRecord: false },
      ];
      const got = cases.map((c) => {
        if (c.index < 0) return { what: c.what, ok: false, why: "no record of the needed kind in this file" };
        const f = clone(inputs.file) as Rec;
        const target = (f.records as Rec[])[c.index]!;
        const id = String((recs[c.index] as Rec).testId);
        c.mutate(f, target);
        const v = validateLoaded(resultsRun!, { ...inputs, file: f });
        const now = v.checks.find((x) => x.name.startsWith(c.check));
        const was = base.checks.find((x) => x.name.startsWith(c.check));
        const fired = !!now && !now.passed && (c.namesRecord ? now.detail.includes(id) && !(was?.detail ?? "").includes(id) : !!was?.passed);
        return { what: c.what, ok: fired, why: now ? `${now.passed ? "passed" : "FAILED"}: ${now.detail.slice(0, 120)}` : `no check "${c.check}"` };
      });
      push({
        defect: `the WP3 evidence broken ten ways in memory: ${cases.map((c) => c.what).join("; ")}`,
        gate: "validate-wp3: each break fails the check that owns it, naming the record",
        caught: got.every((g) => g.ok),
        firedCheck: got.map((g) => `${g.what}: ${g.ok ? "refused" : `NOT REFUSED (${g.why})`}`).join("; "),
        consequence: "VALIDATION FAILED → exit 1; the run is not accepted as evidence",
      });
    }
  }

  // ------------------------------------------------------------------
  // 7d. the rebuild retry (D3.55): only a failure after every migration
  //     applied — the CLI restarting containers — is retried
  // ------------------------------------------------------------------
  {
    const migrating = "Resetting local database...\nApplying migration 20260813120000_foundation.sql...\nERROR: relation \"public.x\" does not exist (SQLSTATE 42P01)";
    const restarting = "Applying migration 20260909120000_career_attempt_counts.sql...\nSeeding data from supabase/seed.sql...\nRestarting containers...\nsupabase_storage_arc21 container logs:\n{\"level\":30,\"msg\":\"[Server] Started Successfully\"}";
    const initialising = "Resetting local database...\nRecreating database...\nInitialising schema...\n";
    const a = resetFailurePhase(migrating), b = resetFailurePhase(restarting), c = resetFailurePhase(initialising);
    push({
      defect: "a reset that fails with a migration's SQL error; one that fails while the CLI restarts containers; one that fails while it initialises the schema",
      gate: "bringup (D3.55, D3.56): a migration's SQL error is never retried; an infrastructure failure is, and the rebuilt state is then verified as always",
      caught: !a.retryable && b.retryable && c.retryable,
      firedCheck: `SQL error → ${a.retryable ? "RETRIED" : "not retried"} (${a.phase}); restart failure → ${b.retryable ? "retried" : "NOT RETRIED"} (${b.phase}); initialisation failure → ${c.retryable ? "retried" : "NOT RETRIED"} (${c.phase})`,
      consequence: "a broken migration stops the run at once; an overloaded host is retried at most three times (30 s, 60 s, 120 s)",
    });
  }

  // ------------------------------------------------------------------
  // 7e. WP5 (D3.57): the AI-drafted items are held to the evidence, and a
  //     future fix is confirmed only by the right verdicts with no regression
  // ------------------------------------------------------------------
  {
    let official: Record<string, any>[] | null = null; // eslint-disable-line @typescript-eslint/no-explicit-any
    let officialRun = "";
    for (const d of [(await loadOfficialRuns()).wp3, ...(await readdir(RUNS_ROOT)).sort().reverse()]) {
      try {
        const f = JSON.parse(await readFile(join(RUNS_ROOT, d, "wp3-results.json"), "utf8")) as { meta?: { aborted?: unknown }; records?: Record<string, unknown>[] };
        if (!f.meta?.aborted && (f.records?.length ?? 0) === ctx.manifest.rows.length) { official = f.records as Record<string, any>[]; officialRun = d; break; } // eslint-disable-line @typescript-eslint/no-explicit-any
      } catch { /* next */ }
    }
    const inv = JSON.parse(await readFile(join(RUNS_ROOT, "20260922T234324Z-5695a4c3df2d", "inventory.json"), "utf8")) as { observations: Record<string, unknown>[] };
    if (!official) {
      push({ defect: "WP5 grouping and verify-finding", gate: "wp5", caught: false, firedCheck: "NO COMPLETE WP3 RUN TO TEST AGAINST", consequence: "unproven" });
    } else {
      const base = new Set(checkGrouping(WP5_ITEMS, official, inv.observations));
      const fresh = (recs: Record<string, unknown>[]) => checkGrouping(WP5_ITEMS, recs, inv.observations).filter((x) => !base.has(x));
      const lb = official.findIndex((r) => r.testId === "F5.leaderboard_weekly_xp.271");
      const eff = official.findIndex((r) => r.verdict === "effective" && String(r.testId).startsWith("F1."));
      const cases: [string, (rs: Record<string, any>[]) => void][] = [ // eslint-disable-line @typescript-eslint/no-explicit-any
        ["an effective record turned deficient, belonging to no item", (rs) => { rs[eff] = { ...rs[eff], verdict: "deficient", observation: "not_as_predicted" }; }],
        ["a leaderboard record the item calls deficient turned effective", (rs) => { rs[lb] = { ...rs[lb], verdict: "effective", observation: "as_predicted" }; }],
        ["a supporting record (anonymous leaderboard call) turned deficient", (rs) => { const i = rs.findIndex((r) => r.testId === "F5.leaderboard_weekly_xp.272"); rs[i] = { ...rs[i], verdict: "deficient" }; }],
      ];
      const got = cases.map(([what, mutate]) => { const rs = clone(official!); mutate(rs); const f = fresh(rs); return { what, ok: f.length > 0, f }; });
      push({
        defect: `WP5 over the official run (${officialRun}), broken three ways: ${cases.map((c) => c[0]).join("; ")}`,
        gate: "wp5: every non-effective record belongs to exactly one item, with the verdict its prose assumes, and the records it calls holding hold",
        caught: got.every((g) => g.ok),
        firedCheck: got.map((g) => `${g.what}: ${g.ok ? `refused (${g.f[0]!.slice(0, 90)})` : "NOT REFUSED"}`).join("; "),
        consequence: "WP5 REFUSED → exit 1; FINDINGS.md is not written",
      });
      const spec = WP5_ITEMS.find((s) => s.key === "leaderboards-private-identity")!;
      const same = verifyItem(spec, official, official, true);
      const fixed = clone(official).map((r) => (spec.select({ testId: String(r.testId), family: String(r.family), resource: String(r.resource), controlId: String(r.controlId), polarity: String(r.polarity), verdict: String(r.verdict), observation: String(r.observation) }) ? { ...r, verdict: "effective" } : r));
      const good = verifyItem(spec, official, fixed, true);
      const regressed = clone(fixed); regressed[eff] = { ...regressed[eff], verdict: "deficient" };
      const bad = verifyItem(spec, official, regressed, true);
      const unvalidated = verifyItem(spec, official, fixed, false);
      const partial = verifyItem(WP5_ITEMS.find((s) => s.key === "audit-trail-partial")!, official, official, true);
      const ok = !same.verified && good.verified && !bad.verified && !unvalidated.verified && !partial.verified;
      push({
        defect: "verify-finding given: the official run itself; a candidate with the leaderboard rows effective; the same with one regression; the same unvalidated; and an item its frozen rows cannot confirm",
        gate: "verify-finding: a fix is confirmed only by the stated verdicts, on a validated run, with no regression",
        caught: ok,
        firedCheck: `unchanged → ${same.verified ? "CONFIRMED" : "not confirmed"}; fixed → ${good.verified ? "confirmed" : "NOT CONFIRMED"}; fixed + regression → ${bad.verified ? "CONFIRMED" : "refused"}; unvalidated → ${unvalidated.verified ? "CONFIRMED" : "refused"}; partial-trail item → ${partial.verified ? "CONFIRMED" : "refused (frozen rows cannot confirm)"}`,
        consequence: "a future fix is confirmed only by evidence",
      });

      // 7e-bis. After CP4 (D3.59): the narrative store must carry the author's
      // recorded reply byte for byte, with truthful provenance (Amendment A2),
      // and the J3/J4 scope must cover exactly the audit-absence records.
      const off = await loadOfficialRuns();
      const built = await buildWp5({ wp3RunId: off.wp3, planRunId: off.plan, wp4RunId: off.wp4 });
      const ranked = built.items.map((i) => ({ id: i.id, key: i.key, part: i.part, spec: i.spec }));
      const store = await loadNarratives();
      const resp = await loadCp4Response();
      const scope = await loadAuditScope();
      if (!resp || !scope) {
        push({ defect: "CP4 record and audit scope", gate: "wp5 (CP4)", caught: false, firedCheck: "NO RECORDED CP4 REPLY OR SCOPE TO TEST AGAINST", consequence: "unproven" });
      } else {
        const real = checkCp4Record(ranked, store, resp);
        push({
          defect: "(control) the real narrative store against the recorded CP4 reply",
          gate: "wp5 (CP4): the store carries the reply verbatim, with its provenance",
          caught: real.length === 0,
          firedCheck: real.length === 0 ? "no problem" : `FALSE ALARM: ${real[0]}`,
          consequence: real.length === 0 ? "FINDINGS.md is written" : "a false alarm would block WP5",
          control: true,
        });
        type Store = typeof store;
        type Resp = typeof resp;
        const w = (f: (s2: { entries: Record<string, unknown>[] }, r2: Record<string, any>) => void): string[] => { // eslint-disable-line @typescript-eslint/no-explicit-any
          const s2 = clone(store) as unknown as { entries: Record<string, unknown>[] };
          const r2 = clone(resp) as unknown as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
          f(s2, r2);
          return checkCp4Record(ranked, s2 as unknown as Store, r2 as unknown as Resp);
        };
        const cases: [string, string[]][] = [
          ["one word of A1's narrative changed in the store", w((s2) => { const e = s2.entries.find((x) => x.key === "leaderboards-private-identity")!; e.narrative = String(e.narrative).replace("intended", "intentional"); })],
          ["A2's AI-assisted narrative relabelled user_authored", w((s2) => { s2.entries.find((x) => x.key === "audit-trail-absent")!.provenance = "user_authored"; })],
          ["A4's status changed from open to accepted_design_intent", w((s2) => { s2.entries.find((x) => x.key === "push-token-reassignment")!.status = "accepted_design_intent"; })],
          ["J1 and J3 swapped between the A1 and A2 answers", w((_s2, r2) => {
            const a = (r2.items as { key: string; judgments: string[] }[]).find((x) => x.key === "leaderboards-private-identity")!;
            const b = (r2.items as { key: string; judgments: string[] }[]).find((x) => x.key === "audit-trail-absent")!;
            a.judgments = ["J3", "J2"];
            b.judgments = ["J1", "J4"];
          })],
          ["the recorded approval changed to not approved", w((_s2, r2) => { r2.approval.CP4 = "not approved — change the ranking"; })],
          ["a narrative present with no recorded reply at all", checkCp4Record(ranked, store, null)],
        ];
        push({
          defect: `the CP4 record broken six ways: ${cases.map((c) => c[0]).join("; ")}`,
          gate: "wp5 (CP4): verbatim narratives, truthful provenance, the author's statuses, answers attached to the questions asked, a real approval",
          caught: cases.every(([, f]) => f.length > 0),
          firedCheck: cases.map(([what, f]) => `${what}: ${f.length ? `refused (${f[0]!.slice(0, 80)})` : "NOT REFUSED"}`).join("; "),
          consequence: "WP5 REFUSED → exit 1; FINDINGS.md is not written",
        });
        const sReal = checkAuditScope(scope, official);
        const sw = (f: (x: { resources: Record<string, unknown>[] }) => void): string[] => {
          const s2 = clone(scope) as unknown as { resources: Record<string, unknown>[] };
          f(s2);
          return checkAuditScope(s2 as unknown as typeof scope, official!);
        };
        const sCases: [string, string[]][] = [
          ["one resource dropped from the scope", sw((x) => { x.resources.pop(); })],
          ["an exclusion with its residual risk removed", sw((x) => { delete x.resources.find((r) => r.disposition === "excluded_transient")!.residualRisk; })],
          ["a resource citing the wrong Test ID", sw((x) => { x.resources[0]!.testId = "F10.public_blocks.030"; })],
          ["a resource whose absence record is not in the run", sw((x) => { x.resources.push({ resource: "public.cosmetics", testId: "F10.public_cosmetics.999", disposition: "trail_required", clause: "x", reason: "x" }); })],
        ];
        push({
          defect: `the J3/J4 audit scope: control (the real scope), then broken four ways: ${sCases.map((c) => c[0]).join("; ")}`,
          gate: "wp5 (CP4): the scope covers exactly the audit-absence records, each exclusion with a reason and a residual risk",
          caught: sReal.length === 0 && sCases.every(([, f]) => f.length > 0),
          firedCheck: `real scope: ${sReal.length ? `FALSE ALARM (${sReal[0]})` : "no problem"}; ` + sCases.map(([what, f]) => `${what}: ${f.length ? "refused" : "NOT REFUSED"}`).join("; "),
          consequence: "WP5 REFUSED → exit 1; FINDINGS.md is not written",
        });
      }
    }
  }

  // ------------------------------------------------------------------
  // 7e-ter. WP6 (D3.60): the framework mapping is held to the evidence, the
  //     pinned source texts and the overclaiming rules — by the generator's
  //     checks and, separately, by the independent validator
  // ------------------------------------------------------------------
  {
    const ev6 = await loadEvidence();
    const f6 = computeFacts(ev6);
    const src6 = await loadSources();
    const entries = buildEntries(ev6, f6, src6);
    const real = checkMappings(entries, ev6.records, src6);
    push({
      defect: "(control) the real framework mapping against the official evidence and the pinned sources",
      gate: "wp6: every mapping is borne out by its evidence",
      caught: real.length === 0,
      firedCheck: real.length === 0 ? "no problem" : `FALSE ALARM: ${real[0]}`,
      consequence: real.length === 0 ? "the mapping is written" : "a false alarm would block WP6",
      control: true,
    });
    type E = (typeof entries)[number];
    const w = (key: string, f: (e: Record<string, any>) => void): string[] => { // eslint-disable-line @typescript-eslint/no-explicit-any
      const copy = clone(entries) as unknown as Record<string, any>[]; // eslint-disable-line @typescript-eslint/no-explicit-any
      f(copy.find((e) => e.key === key)!);
      return checkMappings(copy as unknown as E[], ev6.records, src6);
    };
    const cases: [string, string[]][] = [
      ["AC-3 cites a Test ID that is not in the run", w("NIST:AC-3", (e) => { e.evidence.testIds = [...e.evidence.testIds, "F1.public_blocks.999"]; })],
      ["AC-6, which cites 5 deficient records, raised to evidenced", w("NIST:AC-6", (e) => { e.support = "evidenced"; })],
      ["a Part 11 provision raised to evidenced", w("P11:11.10(d)", (e) => { e.support = "evidenced"; })],
      ["§11.300 (not mapped) given evidence", w("P11:11.300", (e) => { e.evidence.artifacts = [{ artifact: "wp1-validation", summary: "x" }]; })],
      ["one word of AC-3's quoted control statement changed", w("NIST:AC-3", (e) => { e.statement = [String(e.statement[0]).replace("Enforce", "Encourage")]; })],
      ["AC-3's verdict counts altered by one", w("NIST:AC-3", (e) => { e.evidence.counts = { ...e.evidence.counts, effective: e.evidence.counts.effective + 1 }; })],
      ["\"Arc21 is compliant with AC-3.\" added to AC-3's rationale", w("NIST:AC-3", (e) => { e.demonstrates = [...e.demonstrates, "Arc21 is compliant with AC-3."]; })],
      ["a rationale relabelled as the author's", w("NIST:AU-2", (e) => { e.provenance = "user_authored"; })],
    ];
    push({
      defect: `the WP6 mapping broken eight ways: ${cases.map((c) => c[0]).join("; ")}`,
      gate: "wp6: citations exist, counts are the records', support follows the rules, quotes are verbatim, no overclaiming, rationale labelled AI-drafted",
      caught: cases.every(([, f]) => f.length > 0),
      firedCheck: cases.map(([what, f]) => `${what}: ${f.length ? `refused (${f[0]!.slice(0, 70)})` : "NOT REFUSED"}`).join("; "),
      consequence: "WP6 REFUSED → exit 1; nothing is written",
    });
    const note = buildCsaNote(f6, src6);
    const shortened = { ...note, limitations: note.limitations.split("\n").slice(0, 2).join("\n") };
    const noteReal = checkCsaNote(note), noteBad = checkCsaNote({ ...shortened, markdown: note.markdown.replace(note.limitations, shortened.limitations) });
    push({
      defect: "the CSA note with its limitations cut to two items (shorter than its claims, gaps unnamed); control: the real note",
      gate: "wp6: the CSA note is one page, names the four gaps, and its limitations are longer than its claims",
      caught: noteReal.length === 0 && noteBad.length > 0,
      firedCheck: `real note: ${noteReal.length ? `FALSE ALARM (${noteReal[0]})` : "no problem"}; shortened: ${noteBad.length ? `refused (${noteBad[0]!.slice(0, 90)})` : "NOT REFUSED"}`,
      consequence: "WP6 REFUSED → exit 1",
    });

    // The independent validator, on the written files and on tampered copies of them.
    let mapping: Record<string, any> | null = null; // eslint-disable-line @typescript-eslint/no-explicit-any
    let noteMd = "";
    try {
      mapping = JSON.parse(await readFile(join(ATTEST_ROOT, "framework-mapping.json"), "utf8"));
      noteMd = await readFile(join(ATTEST_ROOT, "CSA_NOTE.md"), "utf8");
    } catch { /* not generated yet */ }
    const srcRaw = JSON.parse(await readFile(join(ATTEST_ROOT, "rubric", "framework-sources.json"), "utf8"));
    if (!mapping) {
      push({ defect: "validate-wp6 on the written mapping", gate: "validate-wp6", caught: false, firedCheck: "NO WRITTEN MAPPING TO TEST — run attest wp6 first", consequence: "unproven" });
    } else {
      const vReal = validateWp6Loaded(mapping, noteMd, srcRaw, ev6.records);
      const tam = (f: (m: Record<string, any>) => void, n = noteMd) => { const m2 = clone(mapping!); f(m2); return validateWp6Loaded(m2, n, srcRaw, ev6.records); }; // eslint-disable-line @typescript-eslint/no-explicit-any
      const at = (m: Record<string, any>, key: string) => (m.mappings as Record<string, any>[]).find((e) => e.key === key)!; // eslint-disable-line @typescript-eslint/no-explicit-any
      const vCases: [string, { passed: boolean; checks: readonly { passed: boolean; name: string }[] }][] = [
        ["a selector's Test ID list padded with a record of another family", tam((m) => { at(m, "NIST:AU-3").evidence.selectors[0].testIds.push("F1.public_blocks.022"); })],
        ["AC-24 counts one deficient record fewer", tam((m) => { const e = at(m, "NIST:AC-24"); e.evidence.counts.deficient -= 1; e.evidence.counts.effective += 1; })],
        ["SI-7 raised to evidenced", tam((m) => { at(m, "NIST:SI-7").support = "evidenced"; at(m, "NIST:SI-7").evidence.counts.not_measured = 0; })],
        ["a quoted Part 11 paragraph reworded", tam((m) => { at(m, "P11:11.10(e)").statement = ["(e) Use of audit trails."]; })],
        ["AU-9 says \"the harness is a validated tool\"", tam((m) => { at(m, "NIST:AU-9").limitations.push("The harness is a validated tool."); })],
        ["the CSA note's limitations reduced to one line", tam(() => undefined, noteMd.replace(/## What it would not cover[\s\S]*$/, "## What it would not cover\n\n1. Scope.\n"))],
      ];
      push({
        defect: `validate-wp6: control (the written files), then tampered six ways: ${vCases.map((c) => c[0]).join("; ")}`,
        gate: "validate-wp6 re-derives every citation and count from the raw records, and checks quotes, support rules, claims and the CSA note itself",
        caught: vReal.passed && vCases.every(([, v]) => !v.passed),
        firedCheck: `written files: ${vReal.passed ? "passed" : `FALSE ALARM (${vReal.checks.find((c) => !c.passed)?.name})`}; ` + vCases.map(([what, v]) => `${what}: ${v.passed ? "NOT REFUSED" : `refused by "${v.checks.find((c) => !c.passed)!.name.slice(0, 60)}"`}`).join("; "),
        consequence: "validate-wp6 exits 1; CP5 is recorded as NOT validated",
      });
    }

    // The overclaiming lint itself.
    const refuse = ["Arc21 is Part 11 compliant.", "The harness is a validated tool.", "This was an independent audit of Arc21.", "The author has GxP experience.", "Arc21 meets AC-3 in full."];
    const allow = ["This is not regulatory compliance.", "It is not an independent audit.", "validate-wp3 passed 19 of 19 checks.", "No statement here claims that Arc21 meets any control.", "Harness validation (WP1) detected 5 of 5 breaks."];
    const refused = refuse.filter((x) => lintClaims(x, "probe").length > 0).length;
    const allowed = allow.filter((x) => lintClaims(x, "probe").length === 0).length;
    push({
      defect: `the overclaiming lint given ${refuse.length} claims it must refuse and ${allow.length} honest sentences it must let through`,
      gate: "claims lint (brief §7): a compliance, validation, certification or independence claim needs a negation in the same sentence",
      caught: refused === refuse.length && allowed === allow.length,
      firedCheck: `refused ${refused} of ${refuse.length}; let through ${allowed} of ${allow.length}`,
      consequence: "an overclaiming sentence stops WP6 and WP7",
    });
  }

  // ------------------------------------------------------------------
  // 7g. WP7 (D3.61): validate-reports refuses every report defect, each by
  //     the check that owns it. A numeric defect is written into the on-disk
  //     copy AND the regenerated one — a generator bug, which the byte
  //     comparison cannot see — so only the independent re-derivation can
  //     catch it; a hand edit is written into the on-disk copy only.
  // ------------------------------------------------------------------
  out.push(...(await proveReportGates()));
  out.push(...(await proveReproduction(ctx.manifest)));

  // ------------------------------------------------------------------
  // 7f. digest snapshots compare by content (D3.56): the same state written in
  //     another key order is unchanged; one changed value is a change
  // ------------------------------------------------------------------
  {
    const real = await stateDigest(ctx.admin);
    const keys = Object.keys(real);
    const sorted = keys.every((k, i) => i === 0 || keys[i - 1]! < k);
    const reordered = JSON.stringify(Object.fromEntries(Object.entries(real).reverse()));
    const canonical = JSON.stringify(real);
    const k0 = keys.find((k) => !k.startsWith("seq:"))!;
    const moved = JSON.stringify({ ...real, [k0]: "0".repeat(32) + ":0" });
    const snap = { kind: "database" as const };
    const sameOk = sameDigest(snap, canonical, reordered);
    const diffOk = !sameDigest(snap, canonical, moved);
    push({
      defect: "the same database digest serialized in reverse key order, and a digest with one relation's value changed",
      gate: "state guards (D3.56): a digest snapshot is unchanged when its content is, whatever its order; stateDigest writes keys in a fixed order",
      caught: sorted && sameOk && diffOk && canonical !== reordered,
      firedCheck: `stateDigest keys sorted: ${sorted}; reordered copy judged ${sameOk ? "unchanged" : "CHANGED"}; one value changed judged ${diffOk ? "changed" : "UNCHANGED"}`,
      consequence: "no false 'the database changed' from row order; a real change still fails the guard",
    });
  }

  // ------------------------------------------------------------------
  // 8. the Arc21 read-only guard, proven on a throwaway repository
  // ------------------------------------------------------------------
  out.push(...(await proveArc21Guard()));

  // ------------------------------------------------------------------
  // Nothing real moved: the plan and store copies were deep, every staged
  // defect was rolled back, and the database content digests as it did.
  // ------------------------------------------------------------------
  const liveDigestAfter = await stateDigest(ctx.admin);
  const moved = diffDigests(liveDigestBefore, liveDigestAfter);
  const intact = JSON.stringify(plan) === snapshotPlan && JSON.stringify(store) === snapshotStore && moved.length === 0;
  push({
    defect: "(control) the real plan, intent store and database after every injection",
    gate: "prove-gates restores everything it breaks",
    caught: intact,
    firedCheck: intact ? "plan and store byte-identical; every table and sequence digests as before" : `CHANGED: ${moved.join(", ") || "plan or store"}`,
    consequence: intact ? "nothing real was changed" : "STATE WAS NOT RESTORED",
    control: true,
  });
  for (const r of out) (r as { restored: boolean }).restored = r.restored && intact;
  void checkClaimCoverage;
  return out;
}

type Rec7 = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

/**
 * WP7's gates, broken one defect at a time on copies of the real outputs (D3.61). Each
 * injection names the check that must refuse it; it counts as caught only if that check
 * passes on the real outputs and fails on the tampered copy. A tamper that matches nothing is
 * reported as not applied — never as caught (D3.37).
 */
export async function proveReportGates(): Promise<InjectionResult[]> {
  const out: InjectionResult[] = [];
  const { buildReportOutputs, rel } = await import("./wp7-run.ts");
  const V = await import("./wp7-validate.ts");
  const built = await buildReportOutputs("compare");
  if (built.problems.length) {
    return [{ defect: "WP7 report validation", gate: "validate-reports", caught: false, firedCheck: `THE REPORTS DO NOT BUILD: ${built.problems[0]}`, consequence: "unproven", restored: true }];
  }
  const regenerated = new Map([...built.files].map(([p, c]) => [rel(p), c]));
  // prove-gates proves the validator, so its baseline is what `reports` would write now — the
  // disk may predate the record the previous prove-gates run wrote. `validate-reports` is what
  // judges the disk.
  const loaded = await V.loadReportInputs(regenerated);
  const docs = Object.fromEntries((Object.entries(V.DOCS) as [keyof typeof V.DOCS, string][]).map(([k, p]) => [k, regenerated.get(p) ?? loaded.docs[k]])) as Record<keyof typeof V.DOCS, string>;
  const real = { ...loaded, docs, onDisk: new Map(regenerated) };
  const base = V.validateReportsLoaded(real);
  const again = V.validateReportsLoaded(real);
  const failingOnReal = base.checks.filter((c) => !c.passed).map((c) => c.name);
  // The currency check waits for this run's own record; the record-derived checks cannot pass
  // while the last record is missing or failing (the injections below prove them on a record
  // built for the purpose). Everything else must pass.
  const pgRows = (real.proveGates?.rows ?? []) as Rec7[];
  const recordPasses = pgRows.length > 0 && pgRows.every((r) => r.caught === true && r.restored === true);
  const named = (prefix: string) => base.checks.find((c) => c.name.startsWith(prefix))?.name ?? "";
  const pending = new Set([
    V.PROVE_GATES_CURRENCY_CHECK,
    ...(recordPasses ? [] : [named("prove-gates:")]),
    ...(real.layoutExists["evidence/prove-gates/"] ? [] : [named("every path the README's layout")]),
  ]);
  const realOk = failingOnReal.every((n) => pending.has(n)) && JSON.stringify(base) === JSON.stringify(again);
  out.push({
    defect: "(control) the real report, summary, dashboard and README, validated twice",
    gate: "validate-reports: every check passes on the real outputs, deterministically",
    caught: realOk,
    firedCheck: realOk ? `${base.checks.length - failingOnReal.length} of ${base.checks.length} checks pass; identical twice${failingOnReal.length ? `; waiting for this run's record: ${failingOnReal.length}` : ""}` : `FALSE ALARM: ${failingOnReal.filter((n) => !pending.has(n)).join("; ")}`,
    consequence: realOk ? "the reports are accepted" : "a false alarm would block every report",
    restored: true, control: true,
  });

  type Real = typeof real;
  type Mut = { -readonly [K in keyof Omit<Real, "docs" | "onDisk" | "regenerated">]: Real[K] } & { docs: Record<keyof typeof V.DOCS, string>; onDisk: Map<string, string>; regenerated: Map<string, string> | null };
  const copy = (): Mut => structuredClone(real) as unknown as Mut;
  const check = (x: Mut) => V.validateReportsLoaded(x as unknown as Real);
  const edit = (x: Mut, k: keyof typeof V.DOCS, f: (t: string) => string, generatorBug: boolean) => {
    const path = V.DOCS[k];
    const next = f(x.docs[k]);
    if (next === x.docs[k]) throw new Error(`the tamper matched nothing in ${path}`);
    x.docs[k] = next;
    if (x.onDisk.has(path)) x.onDisk.set(path, next);
    if (generatorBug && x.regenerated?.has(path)) x.regenerated.set(path, next);
  };
  const inject = (defect: string, expect: readonly string[], mutate: (x: Mut) => void) => {
    let why = "";
    let caught = false;
    try {
      const x = copy();
      mutate(x);
      const v = check(x);
      const results = expect.map((e) => ({ e, now: v.checks.find((c) => c.name.startsWith(e)), was: base.checks.find((c) => c.name.startsWith(e)) }));
      caught = results.every((r) => r.now && !r.now.passed && r.was?.passed);
      why = results.map((r) => (!r.now ? `no check "${r.e.slice(0, 40)}"` : !r.was?.passed ? `"${r.e.slice(0, 40)}" already fails on the real outputs` : r.now.passed ? `NOT REFUSED by "${r.e.slice(0, 50)}"` : `refused by "${r.e.slice(0, 50)}…": ${r.now.detail.slice(0, 110)}`)).join("; ");
    } catch (err) {
      why = `INJECTION NOT APPLIED: ${(err as Error).message}`;
    }
    out.push({ defect, gate: `validate-reports: ${expect.map((e) => e.split(/[:,(]/)[0]!.trim()).join(" + ")}`, caught, firedCheck: why, consequence: caught ? "validate-reports FAILS → `reports` and `run` exit 1; nothing is accepted" : "NOT CAUGHT", restored: true });
  };
  const off = real.official as Rec7;
  const run1 = String(((off.notResults ?? []) as Rec7[]).find((n) => n.disposition === "superseded")?.runId ?? "");
  const C = {
    report: "the assurance report states the WP3 counts",
    summary: "the plain-language summary states the numbers",
    dash: "the dashboard's embedded data is the evidence",
    readme: "the README's generated sections state the evidence",
    wp014: "WP0, WP1 and WP4 numbers in the report",
    wp5: "each finding's status is the author's recorded CP4 decision",
    wp6: "the framework mapping is a validated study exercise",
    pg: "prove-gates: the recorded result",
    runs: "every run a report cites is official",
    claims: "no generated document claims compliance",
    prov: "no generated document claims remediation",
    stale: "the current-state documents carry no stale project state",
    labels: "current reading views are neutral",
    plain: "the plain-language summary has no jargon",
    hand: "the README's evidence numbers live only in its generated sections",
    cmds: "every command the README documents",
    offline: "the dashboard is one self-contained file",
    bytes: "every generated file is byte-identical",
  };
  const n = (re: RegExp, to: (m: RegExpExecArray) => string) => (t: string) => { const m = re.exec(t); return m ? t.slice(0, m.index) + to(m) + t.slice(m.index + m[0].length) : t; };

  inject("the report's WP3 total off by one (346 Test IDs), written by the generator itself", [C.report], (x) => edit(x, "report", n(/\| Tests executed \(WP3\) \| (\d+) Test IDs/, (m) => `| Tests executed (WP3) | ${Number(m[1]) + 1} Test IDs`), true));
  inject("a verdict count moved: one F5 record from deficient to effective in the report's family table", [C.report], (x) => edit(x, "report", n(/\| F5 ([^|]+)\| (\d+) \| (\d+) \| (\d+) \|/, (m) => `| F5 ${m[1]}| ${m[2]} | ${Number(m[3]) + 1} | ${Number(m[4]) - 1} |`), true));
  inject(`the superseded run 1 (${run1.slice(0, 16)}…) cited as the WP3 result in the summary`, [C.runs, C.summary], (x) => edit(x, "summary", (t) => t.replace(`results of run ${off.wp3}`, `results of run ${run1}`), true));
  inject("a finding's status altered: A4 shown as accepted design intent although the author left it open", [C.wp5], (x) => edit(x, "report", n(/(\| A4 \|[^\n]*\| )open( \|)/, (m) => `${m[1]}accepted design intent${m[2]}`), true));
  inject("not measured counted as effective: the dashboard reports 296 effective and 0 not measured", [C.dash], (x) => edit(x, "dashboard", (t) => t.replace(/"totals":\{"effective":(\d+),"deficient":(\d+),"gap":(\d+),"characterized":(\d+),"not_measured":(\d+)/, (_m, e, d, g, c, nm) => `"totals":{"effective":${Number(e) + Number(nm)},"deficient":${d},"gap":${g},"characterized":${c},"not_measured":0`), true));
  inject("not measured presented as passing in prose: \"The 13 not measured tests are counted as effective.\"", [C.prov], (x) => edit(x, "report", (t) => t.replace("## 14. Limitations\n", "## 14. Limitations\n\nThe 13 not measured tests are counted as effective.\n"), true));
  inject("stale state in the README: \"WP3 is planned and implemented but NOT executed.\"", [C.stale], (x) => edit(x, "readme", (t) => t.replace("## The question\n", "## The question\n\nWP3 is planned and implemented but NOT executed.\n"), true));
  inject("stale state in the report: \"CP4 is presented, awaiting the author.\"", [C.stale], (x) => edit(x, "report", (t) => t.replace("## 14. Limitations\n", "## 14. Limitations\n\nCP4 is presented, awaiting the author.\n"), true));
  inject("a creator byline added to the neutral summary: \"Created by ChatGPT.\"", [C.labels], (x) => edit(x, "summary", (t) => `${t}\nCreated by ChatGPT.\n`, true));
  inject("AI-assisted narrative claimed as the author's own: \"The findings narrative was written by the author.\"", [C.prov], (x) => edit(x, "report", (t) => t.replace("## 14. Limitations\n", "## 14. Limitations\n\nThe findings narrative was written by the author.\n"), true));
  inject("remediation claimed complete: \"Remediation of A4 was completed and verified.\"", [C.prov], (x) => edit(x, "report", (t) => t.replace("## 14. Limitations\n", "## 14. Limitations\n\nRemediation of A4 was completed and verified.\n"), true));
  inject("Arc21 described as fixed on the dashboard: \"Arc21 has been fixed.\"", [C.prov], (x) => edit(x, "dashboard", (t) => t.replace("<footer>", "<footer>Arc21 has been fixed. "), true));
  inject("findings described as closed in the README: \"A2 and A4 are now closed.\"", [C.prov], (x) => edit(x, "readme", (t) => t.replace("## Prior art\n", "## Prior art\n\nA2 and A4 are now closed.\n"), true));
  inject("CP5 called approved in the README status", [C.prov, C.readme], (x) => edit(x, "readme", n(/CP5 \*\*superseded by Amendment A2\*\*[^\n]*/, () => "CP5 approved by the author 2026-09-25."), true));
  inject("a hand-edited number inside the README's generated section (the effective count)", [C.readme, C.bytes], (x) => edit(x, "readme", n(/\| effective \| (\d+) \|/, (m) => `| effective | ${Number(m[1]) + 7} |`), false));
  inject("an evidence count typed into the README's hand-written text (\"The gates were proven 80/80.\")", [C.hand], (x) => edit(x, "readme", (t) => t.replace("## Prior art\n", "## Prior art\n\nThe gates were proven 80/80.\n"), true));
  inject("the dashboard's embedded data tampered: one record's verdict (F5.register_push_token.269) made effective", [C.dash], (x) => edit(x, "dashboard", (t) => t.replace(/("F5\.register_push_token\.269":\{[^}]*?"v":)"deficient"/, '$1"effective"'), true));
  inject("the summary given jargon (row-level security policies, the service_role key)", [C.plain], (x) => edit(x, "summary", (t) => t.replace("**What it means.**", "**What it means.** The row-level security policies deny the anon role unless the service_role key is used."), true));
  inject(`the summary padded past one page (${V.SUMMARY_WORD_LIMIT}+ words)`, [C.plain], (x) => edit(x, "summary", (t) => t.replace("**What it means.**", `**What it means.** ${"Every player's records stayed their own. ".repeat(60)}`), true));
  inject("a generated file modified after regeneration (a sentence appended to FINDINGS.md)", [C.bytes], (x) => edit(x, "findings", (t) => `${t}\nThis line was added by hand after generation.\n`, false));
  inject("framework overclaim: AC-6 (which cites deficient records) shown as evidenced in the report", [C.wp6], (x) => edit(x, "report", n(/(\| AC-6 [^|]*\| )partial( \|)/, (m) => `${m[1]}evidenced (tested paths only)${m[2]}`), true));
  inject("framework overclaim: \"Arc21 complies with NIST SP 800-53 AC-3 and is Part 11 compliant.\"", [C.claims], (x) => edit(x, "report", (t) => t.replace("## 14. Limitations\n", "## 14. Limitations\n\nArc21 complies with NIST SP 800-53 AC-3 and is Part 11 compliant.\n"), true));
  inject("the report's drift table shows one pass → fail that the transitions do not contain", [C.wp014], (x) => edit(x, "report", n(/(\| H1-[^|]+→ C-current \|(?: \d+ \|){6}) 0 \|/, (m) => `${m[1]} 1 |`), true));
  inject("the report's WP1 line says 4 of 5 breaks detected", [C.wp014], (x) => edit(x, "report", n(/WP1: (\d+) of (\d+) deliberately/, (m) => `WP1: ${Number(m[1]) - 1} of ${m[2]} deliberately`), true));
  {
    // The premise is built, not assumed: a passing prove-gates record and a README that says
    // complete — then the one condition changed. Accepted before the change, refused after.
    const passing = { harness: { sourcesSha256: real.harnessNow }, summary: { injected: 1, caught: 1, controls: 1, held: 1, restored: true }, rows: [{ n: 1, control: false, caught: true, restored: true }, { n: 2, control: true, caught: true, restored: true }] };
    const premise = (cp4: string) => {
      const x = copy();
      x.proveGates = passing;
      x.docs.readme = x.docs.readme.replace(/^\*\*Status: [^\n]*/m, "**Status: recorded assessment complete.** Every work package is done.");
      (x.cp4 as Rec7).approval = { ...(x.cp4 as Rec7).approval, CP4: cp4 };
      return check(x).checks.find((c) => c.name.startsWith(C.readme));
    };
    const ok = premise("approved."), bad = premise("not approved");
    out.push({
      defect: "the README says complete while the recorded CP4 approval is changed to not approved (every other condition made to hold)",
      gate: "validate-reports: the README's generated sections state the evidence (status)",
      caught: !!ok?.passed && !!bad && !bad.passed,
      firedCheck: `CP4 approved: ${ok?.passed ? "accepted" : `FALSE ALARM (${ok?.detail.slice(0, 80)})`}; CP4 not approved: ${bad && !bad.passed ? `refused (${bad.detail.slice(0, 110)})` : "NOT REFUSED"}`,
      consequence: "validate-reports FAILS → exit 1", restored: true,
    });
  }
  inject("the CLI gains a command the README does not document", [C.cmds], (x) => { x.cliSource = `${x.cliSource}\n    case "undocumented-command": break;\n`; });
  inject("the dashboard made to load a script from the network", [C.offline], (x) => edit(x, "dashboard", (t) => t.replace("</head>", '<script src="https://cdn.example.com/x.js"></script></head>'), true));

  // prove-gates' own citation: a synthetic record the reports agree with, then a report that cites one fewer.
  {
    const rows = [...Array.from({ length: 3 }, (_, i) => ({ n: i + 1, control: false, caught: true, restored: true })), { n: 4, control: true, caught: true, restored: true }];
    const record = { harness: { sourcesSha256: real.harnessNow }, summary: { injected: 3, caught: 3, controls: 1, held: 1, restored: true }, rows };
    const cite = (t: string, k: number) => t.replace(/\d+ of \d+ injected defects caught and \d+ of \d+ controls held|prove-gates has no recorded result/g, `${k} of 3 injected defects caught and 1 of 1 controls held`);
    const withRecord = (k: number) => { const x = copy(); x.proveGates = record; x.docs.report = cite(x.docs.report, k); x.docs.readme = cite(x.docs.readme, k); return check(x); };
    const ok = withRecord(3).checks.find((c) => c.name.startsWith(C.pg));
    const bad = withRecord(2).checks.find((c) => c.name.startsWith(C.pg));
    const failed = { ...record, rows: rows.map((r, i) => (i === 0 ? { ...r, caught: false } : r)) };
    const x2 = copy(); x2.proveGates = failed; x2.docs.report = cite(x2.docs.report, 3); x2.docs.readme = cite(x2.docs.readme, 3);
    const failedV = check(x2).checks.find((c) => c.name.startsWith(C.pg));
    const caught = !!ok?.passed && !!bad && !bad.passed && !!failedV && !failedV.passed;
    out.push({
      defect: "the prove-gates count a report cites differs from the record's rows; and a record whose rows show a miss while the reports cite a pass",
      gate: "validate-reports: prove-gates — recounted from its rows, it passed, and every report cites it",
      caught, firedCheck: `consistent citation: ${ok?.passed ? "accepted" : "FALSE ALARM"}; one fewer cited: ${bad && !bad.passed ? "refused" : "NOT REFUSED"}; a failed row: ${failedV && !failedV.passed ? "refused" : "NOT REFUSED"}`,
      consequence: "validate-reports FAILS → exit 1", restored: true,
    });
  }
  return out;
}

/** The reproduction comparisons (`attest run`), each given the real frozen evidence and a perturbed copy (D3.61). */
async function proveReproduction(manifest: ApprovedManifest): Promise<InjectionResult[]> {
  const R = await import("./reproduce.ts");
  const off = await loadOfficialRuns();
  const j = async (...p: string[]) => JSON.parse(await readFile(join(RUNS_ROOT, ...p), "utf8")) as Rec7;
  const inv = await j(off.frozenCp3, "inventory.json");
  const ri = await j(off.frozenCp3, "risk-inputs.json");
  const cp3 = await j(off.frozenCp3, "cp3-tiers.json");
  const wp1 = await j(off.frozenCp3, "wp1-validation.json");
  const planTests = ((await j(off.plan, "wp3-matrix.json")).plan as Rec7).tests as Rec7[];
  const official = await R.loadRunRecords(off.wp3);
  const store = JSON.parse(await readFile(join(ATTEST_ROOT, "rubric", "author-intents.json"), "utf8")) as Rec7;
  const sc = <T>(x: T): T => structuredClone(x);
  const plan = { tests: planTests } as unknown as Wp3Plan;
  const out: InjectionResult[] = [];
  const same = [
    R.compareInventory(inv, sc(inv)), R.compareRiskInputs(ri, sc(ri)), R.compareTiers(cp3, sc(cp3)), R.compareWp1(wp1, sc(wp1)),
    R.comparePlan(sc(plan), planTests, manifest, []), R.compareIntentStore(store, official), R.compareWp3Runs(official, sc(official)),
  ];
  // The known answer (D3.55): run 1 against the official run differs exactly in the eleven F10
  // verdicts its heuristic defect mis-judged and the three F9 identities it failed to record,
  // with every one of the recorded outcomes identical.
  const run1 = ((await loadOfficialRuns()).notResults.find((n) => n.disposition === "superseded")?.runId) ?? "";
  const known = R.compareWp3Runs(official, await R.loadRunRecords(run1));
  const knownOk = known.byField.verdict === 11 && known.byField.actualSummary === 0 && known.byField.identity === 3 && known.byField.missing === 0 && known.byField.extra === 0;
  out.push({
    defect: "(control) the frozen evidence compared with itself by every reproduction comparison; and run 1 compared with the official run",
    gate: "run: the comparisons report no difference where there is none, and the known one exactly",
    caught: same.every((c) => c.identical) && knownOk,
    firedCheck: `${same.filter((c) => c.identical).length} of ${same.length} self-comparisons identical${same.some((c) => !c.identical) ? ` — FALSE ALARM: ${same.find((c) => !c.identical)!.detail.slice(0, 120)}` : ""}; run 1 vs official: ${JSON.stringify(known.byField)} (D3.55: 11 verdicts, 3 identities, 0 outcomes)`,
    consequence: "a faithful rebuild is accepted", restored: true, control: true,
  });
  const cases: [string, () => import("./reproduce.ts").Comparison][] = [
    ["inventory: one policy's USING expression replaced with true", () => { const b = sc(inv); const p = (b.controls as Rec7[]).find((c) => c.controlKind === "policy" && c.detail?.using_expr)!; p.detail.using_expr = "true"; return R.compareInventory(inv, b); }],
    ["inventory: one control missing", () => { const b = sc(inv); (b.controls as Rec7[]).splice(3, 1); return R.compareInventory(inv, b); }],
    ["risk inputs: one resource's effective write exposure changed", () => { const b = sc(ri); (b.resources as Rec7[])[0]!.effectiveWriteExposure = "anonymous"; return R.compareRiskInputs(ri, b); }],
    ["tiers: one resource re-tiered Medium → High", () => { const b = sc(cp3); const s = (b.scored as Rec7[]).find((x) => x.tier === "Medium")!; s.tier = "High"; return R.compareTiers(cp3, b); }],
    ["WP1: one deliberate break goes undetected", () => { const b = sc(wp1); (b.scenarios as Rec7[])[0]!.detected = false; b.allDetected = false; return R.compareWp1(wp1, b); }],
    ["plan: one approved row's expectation reworded", () => { const b = sc(planTests); b[5]!.expected = `${String(b[5]!.expected)} (reworded)`; return R.comparePlan({ tests: b } as unknown as Wp3Plan, planTests, manifest, []); }],
    ["intent store: one adopted sentence edited, and one relabelled user_authored", () => { const b = sc(store); (b.intents as Rec7[])[0]!.intent = `${String((b.intents as Rec7[])[0]!.intent)} (edited)`; (b.intents as Rec7[])[1]!.provenance = "user_authored"; return R.compareIntentStore(b, official); }],
    ["a reproduction with one verdict, one recorded outcome and one record different", () => { const b = sc(official); b[0]!.verdict = "deficient"; b[1]!.actualSummary = "error 42501"; b.splice(2, 1); return R.compareWp3Runs(official, b); }],
  ];
  for (const [what, f] of cases) {
    let c: import("./reproduce.ts").Comparison | null = null;
    let err = "";
    try { c = f(); } catch (e) { err = (e as Error).message; }
    out.push({
      defect: `reproduction — ${what}`,
      gate: `run: ${c?.name ?? "the reproduction comparison"}`,
      caught: !!c && !c.identical,
      firedCheck: err ? `INJECTION NOT APPLIED: ${err}` : c!.identical ? "NOT REPORTED" : c!.detail.slice(0, 180),
      consequence: "run reports NOT REPRODUCED → exit 1", restored: true,
    });
  }
  return out;
}

/**
 * The guard is only worth trusting if it fires. Each case below changes a
 * scratch repository in one way the guard claims to see, and requires the
 * comparison to fail; then puts it back and requires it to pass again.
 */
async function proveArc21Guard(): Promise<InjectionResult[]> {
  const out: InjectionResult[] = [];
  const dir = await mkdtemp(join(tmpdir(), "attest-arc21-guard-"));
  const git = (...args: string[]) =>
    run("git", ["-C", dir, "-c", "user.email=attest@localhost", "-c", "user.name=attest-prove-gates", ...args], { env: READ_ONLY_GIT_ENV });
  const EXIT3 = "HARNESS SAFETY VIOLATION → exit 3 (nothing is reverted automatically)";
  try {
    await git("init", "-q", "-b", "main");
    await writeFile(join(dir, ".gitignore"), "*.secret\nignored-dir/\n");
    await writeFile(join(dir, "tracked.sql"), "select 1;\n");
    await git("add", ".gitignore", "tracked.sql");
    await git("commit", "-q", "-m", "fixture");
    // Start dirty on purpose: the guard must accept pre-existing changes.
    await appendFile(join(dir, "tracked.sql"), "-- the author's own uncommitted edit\n");
    await writeFile(join(dir, "untracked.sql"), "select 2;\n");

    const base = await captureArc21State(dir);
    const same = compareArc21State(base, await captureArc21State(dir));
    out.push({
      defect: "(control) a dirty checkout, unchanged between two fingerprints",
      gate: "arc21 guard: pre == post",
      caught: same.identical,
      firedCheck: same.identical ? "identical, although the checkout is dirty — pre-existing changes are accepted, not reverted" : `FALSE ALARM: ${same.differences.join("; ")}`,
      consequence: same.identical ? "exit unaffected" : "a false alarm would block every command",
      restored: true, control: true,
    });

    const cases: readonly [string, () => Promise<unknown>, () => Promise<unknown>][] = [
      ["a tracked source file's content changes (e.g. a migration or RLS policy edited)", () => appendFile(join(dir, "tracked.sql"), "-- attest wrote this\n"),
        async () => { await writeFile(join(dir, "tracked.sql"), "select 1;\n-- the author's own uncommitted edit\n"); }],
      ["a new untracked file appears", () => writeFile(join(dir, "stray.sql"), "x\n"),
        () => rm(join(dir, "stray.sql"))],
      ["an existing untracked file (like the uncommitted migration) is edited", () => appendFile(join(dir, "untracked.sql"), "-- edited\n"),
        () => writeFile(join(dir, "untracked.sql"), "select 2;\n")],
      ["a change is staged", () => git("add", "tracked.sql"),
        () => git("reset", "-q", "tracked.sql")],
      ["a credential file is written into an ignored path", () => writeFile(join(dir, "jwt.secret"), "not-a-real-token\n"),
        () => rm(join(dir, "jwt.secret"))],
    ];
    for (const [defect, inject, restore] of cases) {
      await inject();
      const hit = compareArc21State(base, await captureArc21State(dir));
      await restore();
      const back = compareArc21State(base, await captureArc21State(dir));
      out.push({
        defect: `Arc21 source mutation: ${defect}`,
        gate: "arc21 guard: pre == post",
        caught: !hit.identical,
        firedCheck: hit.identical ? "NOT CAUGHT" : hit.differences.join("; "),
        consequence: hit.identical ? "NOT CAUGHT" : EXIT3,
        restored: back.identical,
      });
    }
    {
      const head = base.head;
      await git("commit", "-q", "--allow-empty", "-m", "attest must never do this");
      const hit = compareArc21State(base, await captureArc21State(dir));
      await git("reset", "-q", "--soft", head);
      const back = compareArc21State(base, await captureArc21State(dir));
      out.push({
        defect: "Arc21 source mutation: a commit is made",
        gate: "arc21 guard: pre == post",
        caught: !hit.identical,
        firedCheck: hit.identical ? "NOT CAUGHT" : hit.differences.join("; "),
        consequence: hit.identical ? "NOT CAUGHT" : EXIT3,
        restored: back.identical,
      });
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
  return out;
}

export function renderInjections(rs: readonly InjectionResult[]): string {
  const L: string[] = [];
  L.push("| # | Injected defect | Gate | Caught | Consequence | What fired |");
  L.push("|---:|---|---|:---:|---|---|");
  rs.forEach((r, i) => {
    const esc = (s: string) => s.replace(/\|/g, "\\|").replace(/\n/g, " ");
    L.push(`| ${i + 1} | ${esc(r.defect)} | ${esc(r.gate)} | ${r.caught ? "**yes**" : "**NO**"} | ${esc(r.consequence)} | ${esc(r.firedCheck).slice(0, 260)} |`);
  });
  return L.join("\n");
}
