/**
 * Attest — proving the WP3 gates by breaking them.
 *
 * D3.19's lesson, twice learned: a check that reports green has not been shown
 * to work. Twice in this project a validator passed while the exact defect it
 * existed to catch was present — the keyword scan that missed `e.g.
 * is_active = false`, and the multi-command check whose "then" exemption let
 * `delete from X, then truncate it` through.
 *
 * So every gate that stands between the author and a real run is made to fail
 * on purpose here, and the real state is shown to be intact afterwards. A
 * defect that produces no failure is itself a finding.
 *
 * Three kinds of injection, and none of them touches anything real:
 *
 *   in memory      the plan, the intent store and the executor's derivation are
 *                  deep-copied and the copy is broken
 *   in a rolled-back transaction
 *                  fixture defects are made on the admin connection inside
 *                  BEGIN … ROLLBACK, the verification is run on that same
 *                  connection, and nothing is ever committed
 *   in a throwaway git repository
 *                  the Arc21 guard is proven on a repository created for the
 *                  purpose under the system temp directory and deleted after.
 *                  Modifying Arc21 to prove the guard would be the violation
 *                  the guard exists to catch (D3.32)
 *
 * D3.37 records that three of the first version's nineteen "injections" were
 * `caught: true` written as a literal, with nothing injected. They are real
 * injections now.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, rm, writeFile, appendFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Session } from "./db.ts";
import type { Wp3Plan, PlannedTest } from "./wp3-plan.ts";
import type { RiskInput } from "./risk-inputs.ts";
import { validatePlan } from "./wp3-validate-plan.ts";
import { deriveAll, callerFor, matches, expectationFor, MALFORMED_PROBE } from "./wp3-exec.ts";
import { findContradictions, checkIdentityConsistency } from "./plan-contradictions.ts";
import { validateIntents, type IntentStore } from "./author-intents.ts";
import { validateDraftQuality } from "./intent-quality.ts";
import { IMPLEMENTED_KEYS, SEED_EXTENSION_IMPLS } from "./seed-extensions.ts";
import { assertCustom } from "./wp3-assertions.ts";
import { judge } from "./wp3-evidence.ts";
import type { Outcome } from "./evidence.ts";
import { compareToApproved, type ApprovedManifest } from "./wp3-approved.ts";
import { checkAssertionCoverage, checkSubjects, checkPremises } from "./wp3-readiness.ts";
import { captureArc21State, compareArc21State, READ_ONLY_GIT_ENV } from "./arc21-guard.ts";
import { rolePropertiesHold, realtimeHealthy } from "./wp3-preflight.ts";
import { FIXTURES } from "../rubric/fixtures.ts";

const run = promisify(execFile);

export interface InjectionResult {
  readonly defect: string;
  readonly gate: string;
  /** Did a check fire? */
  readonly caught: boolean;
  readonly firedCheck: string;
  readonly restored: boolean;
}

export interface InjectionContext {
  /** Admin connection; every fixture injection happens in a transaction on it and is rolled back. */
  readonly admin: Session;
  readonly manifest: ApprovedManifest;
  readonly liveRoleProps: { postgresBypassRls: boolean; authenticatorBypassRls: boolean; authenticatorSuperuser: boolean };
  readonly realtimeUrl: string;
}

const clonePlan = (p: Wp3Plan): Wp3Plan => JSON.parse(JSON.stringify(p)) as Wp3Plan;
const cloneStore = (s: IntentStore): IntentStore => JSON.parse(JSON.stringify(s)) as IntentStore;

/** Run the verification SQL of one seed extension, on this connection. */
async function verifyOne(admin: Session, key: string): Promise<{ ok: boolean; detail: string }> {
  const impl = SEED_EXTENSION_IMPLS.find((i) => i.key === key);
  if (!impl) return { ok: false, detail: `no implementation for ${key}` };
  const { rows } = await admin.query(impl.verify);
  const r = rows[0] as { ok?: boolean; detail?: string } | undefined;
  return { ok: r?.ok === true, detail: r?.detail ?? "no row" };
}

/** Break something inside a transaction, observe, and roll it back — always. */
async function inRollback<T>(admin: Session, fn: () => Promise<T>): Promise<T> {
  await admin.query("begin");
  try {
    return await fn();
  } finally {
    await admin.query("rollback");
  }
}

/** Run every injection. The real plan, store, instance and Arc21 are never mutated. */
export async function runInjections(
  plan: Wp3Plan,
  resources: readonly RiskInput[],
  store: IntentStore,
  ctx: InjectionContext,
): Promise<InjectionResult[]> {
  const out: InjectionResult[] = [];
  const baselinePlanIssues = validatePlan(plan, resources).length;
  const baselineContradictions = findContradictions(plan).length;
  const baselineStore = JSON.stringify(store);

  const record = (defect: string, gate: string, caught: boolean, firedCheck: string, restored = true) =>
    out.push({ defect, gate, caught, firedCheck, restored });

  // --- plan shape ---------------------------------------------------------
  {
    const p = clonePlan(plan);
    (p.tests as PlannedTest[]).splice(10, 1);
    const cmp = compareToApproved(p, ctx.manifest);
    record(
      "a Test ID is missing from the plan",
      "preflight: the plan is the approved matrix (and: the plan carries 345 Test IDs)",
      cmp.missing.length === 1 && p.tests.length !== 345,
      `approved-manifest comparison: ${cmp.missing.length} missing (${cmp.missing.join(", ")}); count ${p.tests.length} of 345`,
    );
  }
  {
    const p = clonePlan(plan);
    const extra = { ...p.tests[0]!, testId: "F1.injected_extra.999" };
    (p.tests as PlannedTest[]).push(extra);
    const cmp = compareToApproved(p, ctx.manifest);
    const { specs } = deriveAll(p);
    record(
      "an extra Test ID appears in the plan (and so in the derived implementation)",
      "preflight: the plan is the approved matrix",
      cmp.extra.includes("F1.injected_extra.999"),
      `approved-manifest comparison: ${cmp.extra.length} extra (${cmp.extra.join(", ")}); ${specs.size} specs derived for ${p.tests.length} rows`,
    );
  }
  {
    // The case a count cannot see: one approved row replaced by a stranger.
    const p = clonePlan(plan);
    (p.tests as PlannedTest[])[20] = { ...p.tests[20]!, testId: "F1.substituted.998" };
    const cmp = compareToApproved(p, ctx.manifest);
    record(
      "an approved Test ID is substituted, leaving the count at 345",
      "preflight: the plan is the approved matrix",
      p.tests.length === 345 && cmp.missing.length === 1 && cmp.extra.length === 1,
      `count still ${p.tests.length}; manifest: missing ${cmp.missing.join(", ")}, extra ${cmp.extra.join(", ")}`,
    );
  }
  {
    // Frozen semantics: an approved operation quietly edited.
    const p = clonePlan(plan);
    const i = p.tests.findIndex((t) => t.testId.startsWith("F5.caller_is_room_member"));
    (p.tests as PlannedTest[])[i] = { ...p.tests[i]!, expected: "returns TRUE" };
    const cmp = compareToApproved(p, ctx.manifest);
    record(
      "an approved row's expected result is edited",
      "preflight: the plan is the approved matrix (no frozen field changed)",
      cmp.frozenDrift.length === 1,
      `frozen-field drift on ${cmp.frozenDrift.join(", ") || "nothing"}`,
    );
  }
  {
    const p = clonePlan(plan);
    (p.tests as PlannedTest[])[5] = { ...p.tests[5]!, testId: p.tests[4]!.testId };
    const issues = validatePlan(p, resources);
    const fired = issues.filter((i) => i.check === "one Test ID = one probe");
    record("two rows share a Test ID", "semantic validator: one Test ID = one probe", fired.length > 0, fired[0]?.problem ?? "nothing fired");
  }
  {
    const p = clonePlan(plan);
    (p.tests as PlannedTest[])[3] = { ...p.tests[3]!, polarity: "informational" as PlannedTest["polarity"] };
    const issues = validatePlan(p, resources);
    const fired = issues.filter((i) => i.check === "polarity totals balance" || i.check === "intent only for negatives");
    record("a row carries a fourth, unsupported polarity", "semantic validator: polarity totals balance", fired.length > 0, fired.map((f) => f.check).join(", ") || "nothing fired");
  }
  {
    const p = clonePlan(plan);
    (p.tests as PlannedTest[])[0] = { ...p.tests[0]!, operation: "delete from public.wallets, then truncate public.wallet_ledger" };
    const issues = validatePlan(p, resources);
    const fired = issues.filter((i) => i.check === "one probe per row");
    record("one Test ID bundles two mutating commands", "semantic validator: one probe per row", fired.length > 0, fired[0]?.problem ?? "nothing fired");
  }
  {
    const p = clonePlan(plan);
    (p.tests as PlannedTest[])[0] = { ...p.tests[0]!, operation: "delete from public.wallets where id = <value>" };
    const issues = validatePlan(p, resources);
    const fired = issues.filter((i) => i.check === "no placeholders");
    record("an unresolved placeholder parameter survives into a row", "semantic validator: no placeholders", fired.length > 0, fired[0]?.problem ?? "nothing fired");
  }
  {
    // A fixture reference that does not resolve must break derivation loudly
    // rather than reaching the database as literal text.
    const p = clonePlan(plan);
    const victim = p.tests.find((t) => t.operation.includes("fixtures.bob.id"))!;
    (p.tests as PlannedTest[])[p.tests.indexOf(victim)] = {
      ...victim, operation: victim.operation.replace("fixtures.bob.id", "fixtures.nosuchfixture.id"),
    };
    const { failures } = deriveAll(p);
    record(
      "a row names a fixture that does not exist",
      "exec derivation: every fixture reference resolves",
      failures.length > 0,
      failures[0]?.reason ?? "nothing fired",
    );
  }

  // --- C1: the wrong F5 execution identity ---------------------------------
  {
    // The defect C1 was: the structured identity reverted to alice on a row
    // whose operation and expectation name carol.
    const p = clonePlan(plan);
    const i = p.tests.findIndex((t) => t.testId.startsWith("F5.get_room_state"));
    (p.tests as PlannedTest[])[i] = { ...p.tests[i]!, identity: "authenticated:alice" };
    const idc = checkIdentityConsistency(p).filter((c) => c.problems.length > 0);
    const contra = findContradictions(p).length;
    const cmp = compareToApproved(p, ctx.manifest);
    record(
      "an F5 row's identity reverts to alice while its operation and expectation name carol",
      "preflight: identity agrees with operation / expected / executor; no plan contradiction; identities match the approved manifest",
      idc.length === 1 && contra === baselineContradictions + 1 && cmp.identityDrift.length === 1,
      `identity-consistency: ${idc.map((c) => `${c.testId} — ${c.problems.join("; ")}`).join(" | ")}; ` +
        `contradictions ${contra} (baseline ${baselineContradictions}); manifest identity drift: ${cmp.identityDrift.join(", ")}`,
    );
  }
  {
    // The anon row: the one C1 row whose caller has no identity at all.
    const p = clonePlan(plan);
    const i = p.tests.findIndex((t) => t.identity === "anon" && t.family.startsWith("F5") && t.resource.includes("anon reachability"));
    (p.tests as PlannedTest[])[i] = { ...p.tests[i]!, identity: "authenticated:alice" };
    const idc = checkIdentityConsistency(p).filter((c) => c.problems.length > 0);
    record(
      "the anon-reachability F5 row runs as alice",
      "preflight: identity agrees with operation / expected / executor",
      idc.length === 1,
      idc.map((c) => `${c.testId} — ${c.problems.join("; ")}`).join(" | ") || "nothing fired",
    );
  }
  {
    // Executor wiring that substitutes a caller — the shape callerFor had
    // before D3.33. Injected as a derivation that ignores the identity.
    const wrongWiring = (t: PlannedTest) => callerFor({ ...t, identity: "authenticated:alice" });
    const idc = checkIdentityConsistency(plan, wrongWiring).filter((c) => c.problems.some((x) => x.includes("executor derives")));
    record(
      "the executor derives a caller other than the structured identity",
      "preflight: identity agrees with the executor's caller",
      idc.length > 0,
      `${idc.length} row(s) flagged, e.g. ${idc.slice(0, 2).map((c) => `${c.testId}: ${c.problems.find((x) => x.includes("executor"))}`).join("; ")}`,
    );
  }

  // --- seed extensions ----------------------------------------------------
  {
    const required = plan.seedExtensions.map((e) => e.key);
    const implemented = IMPLEMENTED_KEYS.filter((k) => k !== "tournament_alice_bob_match");
    const missing = required.filter((k) => !implemented.includes(k));
    record(
      "the tournament-match fixture has no implementation",
      "preflight: every required seed extension has an implementation",
      missing.includes("tournament_alice_bob_match"),
      `${missing.length} unimplemented: ${missing.join(", ")}`,
    );
  }
  {
    // Real: the match row is deleted inside a transaction that is rolled back.
    const r = await inRollback(ctx.admin, async () => {
      await ctx.admin.query(`delete from public.tournament_matches where id = $1`, [FIXTURES.tournamentAliceBobMatch.value]);
      return verifyOne(ctx.admin, "tournament_alice_bob_match");
    });
    record("the tournament-match fixture is absent", "preflight: every required fixture exists (tournament_alice_bob_match)", !r.ok, r.detail);
  }
  {
    const r = await inRollback(ctx.admin, async () => {
      await ctx.admin.query(`update public.tournament_matches set tournament_id = $2 where id = $1`,
        [FIXTURES.tournamentAliceBobMatch.value, FIXTURES.cancelledTournament.value]);
      return verifyOne(ctx.admin, "tournament_alice_bob_match");
    });
    record("the tournament match sits in the wrong tournament", "preflight: every required fixture exists (tournament_alice_bob_match)", !r.ok, r.detail);
  }
  {
    const r = await inRollback(ctx.admin, async () => {
      await ctx.admin.query(`update public.tournament_matches set entry_b_id = null where id = $1`, [FIXTURES.tournamentAliceBobMatch.value]);
      return verifyOne(ctx.admin, "tournament_alice_bob_match");
    });
    record("the tournament match has the wrong participants (bob's slot emptied)", "preflight: every required fixture exists (tournament_alice_bob_match)", !r.ok, r.detail);
  }
  {
    const r = await inRollback(ctx.admin, async () => {
      await ctx.admin.query(
        `update public.tournament_matches set status = 'completed', winner_entry_id = entry_a_id where id = $1`,
        [FIXTURES.tournamentAliceBobMatch.value],
      );
      return verifyOne(ctx.admin, "tournament_alice_bob_match");
    });
    record("the tournament match is in the wrong state (completed, with a winner)", "preflight: every required fixture exists (tournament_alice_bob_match)", !r.ok, r.detail);
  }
  {
    // And the one the old list only asserted: a fixture present with the wrong value.
    const r = await inRollback(ctx.admin, async () => {
      await ctx.admin.query(`update public.cosmetics set is_active = true where id = $1`, [FIXTURES.inactiveCosmetic.value]);
      return verifyOne(ctx.admin, "anon_falsifying_row:public.cosmetics");
    });
    record("a fixture exists but carries the wrong value (the falsifying cosmetic made active)", "preflight: every required fixture exists", !r.ok, r.detail);
  }
  {
    const after = await verifyOne(ctx.admin, "tournament_alice_bob_match");
    record("(control) after every rollback, the real tournament match still verifies", "preflight: every required fixture exists", after.ok, after.detail, after.ok);
  }

  // --- readiness: the checks respond to state, they are not constants ----
  {
    const cov = checkAssertionCoverage(plan, deriveAll(plan).specs);
    const p = clonePlan(plan);
    for (const id of cov.testIds) {
      const i = p.tests.findIndex((t) => t.testId === id);
      (p.tests as PlannedTest[])[i] = { ...p.tests[i]!, expected: "returns FALSE" };
    }
    const cleared = checkAssertionCoverage(p, deriveAll(p).specs);
    record(
      "R1 is a real check: it fails on the real plan and clears when the expectation is one it can assert",
      "preflight: [R1] every custom expectation has an implemented assertion",
      !cov.passed && cleared.passed,
      `real plan: ${cov.testIds.length} unasserted; with those expectations replaced in a copy: ${cleared.testIds.length}`,
    );
  }
  {
    const { specs } = deriveAll(plan);
    const one: Wp3Plan = { ...clonePlan(plan), tests: plan.tests.filter((t) => t.testId.startsWith("F1.public_career_attempts")) };
    const before = await checkSubjects(ctx.admin, one, specs);
    const after = await inRollback(ctx.admin, async () => {
      // Give alice and bob one career attempt each, the way a seed extension would.
      await ctx.admin.query(
        `insert into public.career_attempts (user_id, career_node_id, format, starting_chips)
         select u, (select id from public.career_nodes where is_active order by code limit 1), 'drill', 1000
           from unnest($1::uuid[]) u`,
        [[FIXTURES.alice.value, FIXTURES.bob.value]],
      ).catch((err: Error) => { throw new Error(`could not stage career_attempts rows: ${err.message}`); });
      return checkSubjects(ctx.admin, one, specs);
    }).catch((err: Error) => ({
      id: "R2", name: "(staging failed)", passed: false, testIds: [], rows: [], detail: err.message,
    }));
    record(
      "R2 is a real check: an empty subject is flagged, and a staged row clears it",
      "preflight: [R2] every probe's subject rows exist",
      !before.passed && after.passed,
      `career_attempts rows as seeded: flagged ${before.testIds.join(", ") || "nothing"}; with one row each staged in a rolled-back transaction: ${after.passed ? "clear" : after.detail}`,
    );
  }
  {
    const one: Wp3Plan = { ...clonePlan(plan), tests: plan.tests.filter((t) => t.testId.startsWith("F5.viewer_is_friend_of")) };
    const before = await checkPremises(ctx.admin, one);
    const after = await inRollback(ctx.admin, async () => {
      await ctx.admin.query(
        `delete from public.friendships where (user_id_a, user_id_b) in (($1::uuid, $2::uuid), ($2::uuid, $1::uuid))`,
        [FIXTURES.bob.value, FIXTURES.carol.value],
      );
      return checkPremises(ctx.admin, one);
    });
    record(
      "R5 is a real check: the bob↔carol friendship breaks F5.viewer_is_friend_of's premise, and removing it clears it",
      "preflight: [R5] every row's stated premise holds",
      !before.passed && after.passed,
      `as seeded: ${before.detail}; with the bob↔carol friendship removed in a rolled-back transaction: ${after.detail}`,
    );
  }

  // --- author intents -----------------------------------------------------
  {
    const s = cloneStore(store);
    (s.intents as IntentStore["intents"][number][]).splice(0, 1);
    const fired = validateIntents(plan, s, true).filter((v) => !v.passed);
    record("an intent entry is missing for a required Test ID", "intent validation: every matrix negative has a canonical entry", fired.some((f) => f.check.includes("every matrix negative")), fired.map((f) => f.check).join("; ") || "nothing fired");
  }
  {
    const s = cloneStore(store);
    const arr = s.intents as IntentStore["intents"][number][];
    arr[0] = { ...arr[0]!, intent: "   ", provenance: "user_authored", reviewStatus: "approved" };
    const fired = validateIntents(plan, s, true).filter((v) => !v.passed);
    record("an intent is blank", "intent validation: no entry carries a blank sentence", fired.some((f) => f.check.includes("blank")), fired.map((f) => f.check).join("; ") || "nothing fired");
  }
  {
    const s = cloneStore(store);
    const arr = s.intents as IntentStore["intents"][number][];
    arr.push({ testId: "F1.not.a.real.test", intent: "x", provenance: "user_authored", reviewStatus: "approved" });
    const fired = validateIntents(plan, s, true).filter((v) => !v.passed);
    record("the store carries an entry the matrix does not require", "intent validation: no entry that the matrix does not require", fired.some((f) => f.check.includes("does not require")), fired.map((f) => f.check).join("; ") || "nothing fired");
  }
  {
    // The gate that matters: drafts must not satisfy a real run.
    const s = cloneStore(store);
    const fired = validateIntents(plan, s, true).filter((v) => !v.passed);
    record(
      "every required intent is still an unreviewed AI draft",
      "intent validation: every required intent is authored or reviewed by the author",
      fired.some((f) => f.check.includes("authored or reviewed")),
      fired.map((f) => f.check).join("; ") || "nothing fired",
    );
  }
  {
    // An ai_draft flipped to approved without changing provenance is the exact
    // mislabel the store exists to prevent.
    const s = cloneStore(store);
    const arr = s.intents as IntentStore["intents"][number][];
    arr[0] = { ...arr[0]!, reviewStatus: "approved" };
    const fired = validateIntents(plan, s, true).filter((v) => !v.passed);
    record("an ai_draft is marked approved without changing its provenance", "intent validation: no ai_draft is marked approved", fired.some((f) => f.check.includes("no ai_draft is marked approved")), fired.map((f) => f.check).join("; ") || "nothing fired");
  }
  {
    const drafts = new Map(store.intents.map((e) => [e.testId, e.intent]));
    const victim = [...drafts.keys()].find((k) => k.startsWith("F1."))!;
    drafts.set(victim, "Verify that the policy returns zero rows for SQLSTATE 42501.");
    const fired = validateDraftQuality(plan, drafts);
    record(
      "a draft describes the test rather than the attack",
      "draft quality: names the attack, not the test",
      fired.some((f) => f.testId === victim),
      fired.filter((f) => f.testId === victim).map((f) => f.check).join("; ") || "nothing fired",
    );
  }
  {
    const drafts = new Map(store.intents.map((e) => [e.testId, e.intent]));
    const a = [...drafts.keys()].find((k) => k.startsWith("F1."))!;
    const b = [...drafts.keys()].filter((k) => k.startsWith("F2."))[0]!;
    drafts.set(b, drafts.get(a)!);
    const fired = validateDraftQuality(plan, drafts);
    record("two probes are given the same sentence", "draft quality: no two probes share a sentence", fired.some((f) => f.check.includes("share a sentence")), fired.filter((f) => f.check.includes("share a sentence")).map((f) => f.problem).join("; ") || "nothing fired");
  }

  // --- world --------------------------------------------------------------
  {
    const live = rolePropertiesHold(ctx.liveRoleProps);
    const inversions = [
      { ...ctx.liveRoleProps, postgresBypassRls: !ctx.liveRoleProps.postgresBypassRls },
      { ...ctx.liveRoleProps, authenticatorBypassRls: !ctx.liveRoleProps.authenticatorBypassRls },
      { ...ctx.liveRoleProps, authenticatorSuperuser: !ctx.liveRoleProps.authenticatorSuperuser },
    ].map(rolePropertiesHold);
    record(
      "a role property F7 or the control tests depend on is inverted",
      "preflight: role properties match what the plan assumes",
      live && inversions.every((x) => x === false),
      `live properties hold: ${live}; each of the three inverted: ${inversions.map((x) => (x ? "PASSED (not caught)" : "refused")).join(", ")}`,
    );
  }
  {
    const down = await realtimeHealthy("http://127.0.0.1:9/realtime/v1/api/tenants/realtime-dev/health");
    const live = await realtimeHealthy(ctx.realtimeUrl);
    record(
      "the Realtime service is unreachable while F8 socket probes are planned",
      "preflight: the local Realtime service is healthy",
      !down.ok,
      `pointed at a closed port: ${down.detail}; the live service: ${live.ok ? "healthy" : live.detail}`,
    );
  }

  // --- the harness must never pass off its own exception as a refusal ------
  {
    const harnessError: Outcome = {
      executed: true, raised: true, rowCount: null, sqlstate: null,
      message: "TypeError: cannot read property 'rows' of undefined",
      harnessError: true, sample: [],
    };
    const refusalRows = plan.tests.filter((t) => /^error 42501|^no data/i.test(t.expected));
    const structured = refusalRows.filter((t) => matches(expectationFor(t), harnessError, t));
    const custom = plan.tests.find((t) => /^refusal/i.test(t.expected))!;
    const viaCustom = assertCustom(custom, harnessError).satisfied;
    const j = judge(false, harnessError, "effective");
    const malformed: Outcome = { ...harnessError, harnessError: false, sqlstate: "42601", message: "syntax error" };
    const malformedSatisfied = refusalRows.filter((t) => matches(expectationFor(t), malformed, t));
    record(
      "a harness exception (or a malformed probe's 42601) is presented as a database refusal",
      "evidence: a harness error is never a result",
      structured.length === 0 && !viaCustom && j.verdict === "not_measured" && malformedSatisfied.length === 0 && MALFORMED_PROBE.has("42601"),
      `harness error against ${refusalRows.length} refusal expectations: satisfied ${structured.length}; custom "refusal" path: ${viaCustom ? "SATISFIED" : "unsatisfied"}; ` +
        `judged ${j.observation}/${j.verdict}; a 42601 against the same ${refusalRows.length}: satisfied ${malformedSatisfied.length}`,
    );
  }

  // --- the Arc21 read-only guard, proven on a throwaway repository --------
  out.push(...(await proveArc21Guard()));

  // Nothing above mutated the real plan or store; the fixture injections were
  // rolled back (the control injection above re-verifies the match).
  const afterPlanIssues = validatePlan(plan, resources).length;
  const afterContradictions = findContradictions(plan).length;
  const intact =
    afterPlanIssues === baselinePlanIssues &&
    afterContradictions === baselineContradictions &&
    JSON.stringify(store) === baselineStore;
  for (const r of out) (r as { restored: boolean }).restored = r.restored && intact;

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
      restored: true,
    });

    const cases: readonly [string, () => Promise<unknown>, () => Promise<unknown>][] = [
      ["a tracked file's content changes", () => appendFile(join(dir, "tracked.sql"), "-- attest wrote this\n"),
        async () => { await writeFile(join(dir, "tracked.sql"), "select 1;\n-- the author's own uncommitted edit\n"); }],
      ["a new untracked file appears", () => writeFile(join(dir, "stray.sql"), "x\n"),
        () => rm(join(dir, "stray.sql"))],
      ["an existing untracked file (like the uncommitted migration) is edited", () => appendFile(join(dir, "untracked.sql"), "-- edited\n"),
        () => writeFile(join(dir, "untracked.sql"), "select 2;\n")],
      ["a change is staged", () => git("add", "tracked.sql"),
        () => git("reset", "-q", "tracked.sql")],
      ["a credential file is written into an ignored path", () => writeFile(join(dir, "jwt.secret"), "eyJ...\n"),
        () => rm(join(dir, "jwt.secret"))],
    ];
    for (const [defect, inject, restore] of cases) {
      await inject();
      const hit = compareArc21State(base, await captureArc21State(dir));
      await restore();
      const back = compareArc21State(base, await captureArc21State(dir));
      out.push({
        defect: `Arc21 source-state change: ${defect}`,
        gate: "arc21 guard: pre == post (HARNESS SAFETY VIOLATION, exit 3)",
        caught: !hit.identical,
        firedCheck: hit.identical ? "NOT CAUGHT" : hit.differences.join("; "),
        restored: back.identical,
      });
    }
    {
      // A commit moves HEAD; restore by resetting the scratch branch back.
      const head = base.head;
      await git("commit", "-q", "--allow-empty", "-m", "attest must never do this");
      const hit = compareArc21State(base, await captureArc21State(dir));
      await git("reset", "-q", "--soft", head);
      const back = compareArc21State(base, await captureArc21State(dir));
      out.push({
        defect: "Arc21 source-state change: a commit is made",
        gate: "arc21 guard: pre == post (HARNESS SAFETY VIOLATION, exit 3)",
        caught: !hit.identical,
        firedCheck: hit.identical ? "NOT CAUGHT" : hit.differences.join("; "),
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
  L.push("| Injected defect | Gate | Caught | What fired |");
  L.push("|---|---|:---:|---|");
  for (const r of rs) {
    L.push(`| ${r.defect} | \`${r.gate}\` | ${r.caught ? "**yes**" : "**NO**"} | ${r.firedCheck.replace(/\|/g, "\\|").slice(0, 220)} |`);
  }
  return L.join("\n");
}
