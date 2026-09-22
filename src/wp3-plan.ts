/**
 * Attest — WP3 planning: the concrete test matrix.
 *
 * Derived from the frozen WP2 tiers, the WP0 control inventory, and the ten
 * control families the brief requires. It plans; it executes nothing.
 *
 * Two rules govern the generator:
 *
 *   Depth follows the tier, not convenience. High gets every applicable
 *   meaningful branch positive and negative; Medium gets the important paths
 *   with representative coverage. No resource is Low, so that activity is
 *   unused.
 *
 *   A family that does not apply gets a stated factual reason, never an
 *   invented test. `notApplicable` rows carry the reason and no test id.
 *
 * `authorIntent` is null on every negative row. Brief §1.1 reserves that
 * sentence for the author, and the planner does not write it.
 */
import type { RiskInput } from "./risk-inputs.ts";
import type { Level } from "./scorer.ts";

export type Family =
  | "F1 read isolation"
  | "F2 write isolation"
  | "F3 WITH CHECK enforcement"
  | "F4 anonymous exposure"
  | "F5 SECURITY DEFINER escalation"
  | "F6 column-level leakage"
  | "F7 forced RLS / owner bypass"
  | "F8 realtime channel authorization"
  | "F9 wallet / concurrency integrity"
  | "F10 audit trail"
  | "B boundary cases";

export type Polarity = "positive" | "negative";
export type Plumbing = "reuse WP1" | "extend WP1" | "new";

export interface PlannedTest {
  readonly testId: string;
  readonly family: Family;
  readonly resource: string;
  readonly control: string;
  readonly tier: Level | "suite";
  readonly polarity: Polarity;
  readonly identity: string;
  readonly operation: string;
  readonly expected: string;
  /** Which policy branch or critical path this case covers, and why it exists. */
  readonly covers: string;
  readonly plumbing: Plumbing;
  /** Reserved for the author. Null on every negative test, by design. */
  readonly authorIntent: string | null;
}

export interface NotApplicable {
  readonly family: Family;
  readonly resource: string;
  readonly reason: string;
}

export interface Wp3Plan {
  readonly tests: readonly PlannedTest[];
  readonly notApplicable: readonly NotApplicable[];
}

const ALICE = "authenticated:alice";
const BOB = "authenticated:bob";
const CAROL = "authenticated:carol";
const ANON = "anon";
const OWNER = "owner(postgres)";

/** Identity linkage column to use in a statement, or null. */
function ownerCol(f: RiskInput): string | null {
  return f.directIdentityColumns[0] ?? f.inferredIdentityColumns[0]?.column ?? null;
}

const slug = (r: string) => r.replace(/[^a-z0-9]+/gi, "_");

export function planWp3(
  resources: readonly RiskInput[],
  tiers: ReadonlyMap<string, Level>,
  definerFunctions: readonly { resource: string; executableBy: readonly string[]; touches: readonly string[] }[],
): Wp3Plan {
  const tests: PlannedTest[] = [];
  const na: NotApplicable[] = [];
  let seq = 0;
  const id = (fam: string, res: string) => `${fam}.${slug(res)}.${String(++seq).padStart(3, "0")}`;

  for (const f of resources) {
    const tier = tiers.get(f.resource) ?? "Medium";
    const isHigh = tier === "High";
    const oc = ownerCol(f);
    const selectPolicies = f.policies.filter((p) => p.command === "SELECT" || p.command === "ALL");
    const writePolicies = f.policies.filter(
      (p) => (p.command === "UPDATE" || p.command === "DELETE" || p.command === "ALL") && p.hasUsing,
    );
    const checkPolicies = f.policies.filter((p) => p.hasWithCheck);

    // ---------------------------------------------------------------- F1
    // Isolation is by row ownership OR by session participation. Arc21 uses
    // both, and a planner that looked only for an owner column would skip the
    // participation-scoped resources entirely.
    const clientReadable = f.effectiveReadExposure !== "server_only";
    const isolationScope: "owner" | "participant" | null = oc
      ? "owner"
      : f.anyPolicyReferencesParticipation
        ? "participant"
        : null;
    if (clientReadable && selectPolicies.length && isolationScope) {
      const branches = isHigh ? selectPolicies : selectPolicies.slice(0, 1);
      for (const p of branches) {
        const posOp = isolationScope === "owner"
          ? `select from ${f.resource} where ${oc} = alice`
          : `select from ${f.resource} for the seeded game session alice is seated at`;
        const negOp = isolationScope === "owner"
          ? `select from ${f.resource} where ${oc} = bob`
          : `select from ${f.resource} for that same game session`;
        const negIdentity = isolationScope === "owner" ? ALICE : CAROL;
        tests.push({
          testId: id("F1", f.resource), family: "F1 read isolation", resource: f.resource,
          control: `${f.resource}#policy:${p.name}`, tier, polarity: "positive", identity: ALICE,
          operation: posOp,
          expected: "at least 1 row",
          covers: isolationScope === "owner"
            ? `USING branch of ${p.name} satisfied: the caller's own row`
            : `USING branch of ${p.name} satisfied: a participant of that session`,
          plumbing: "reuse WP1", authorIntent: "n/a (positive)",
        });
        tests.push({
          testId: id("F1", f.resource), family: "F1 read isolation", resource: f.resource,
          control: `${f.resource}#policy:${p.name}`, tier, polarity: "negative", identity: negIdentity,
          operation: negOp,
          expected: "no data (0 rows — RLS filters rather than raising)",
          covers: isolationScope === "owner"
            ? `USING branch of ${p.name} unsatisfied: a row belonging to another account`
            : `USING branch of ${p.name} unsatisfied: carol holds no seat at that session, which is why the seed seats two of three accounts`,
          plumbing: "reuse WP1", authorIntent: null,
        });
      }
    } else {
      na.push({
        family: "F1 read isolation", resource: f.resource,
        reason: !selectPolicies.length
          ? "no SELECT policy exists; reads are refused by the grant surface or by deny-by-default, covered under F4"
          : !clientReadable
            ? "effective read exposure is server-only: no client read path exists to isolate"
            : "the resource neither records an owner nor scopes by session participation, so there is no per-caller subset to isolate — it is a global catalogue readable in full by design",
      });
    }

    // ---------------------------------------------------------------- F2
    if (f.effectiveWriteExposure === "authenticated" && writePolicies.length && oc) {
      const branches = isHigh ? writePolicies : writePolicies.slice(0, 1);
      for (const p of branches) {
        const verb = p.command === "DELETE" ? "delete from" : "update";
        tests.push({
          testId: id("F2", f.resource), family: "F2 write isolation", resource: f.resource,
          control: `${f.resource}#policy:${p.name}`, tier, polarity: "positive", identity: ALICE,
          operation: `${verb} ${f.resource} where ${oc} = alice`,
          expected: "1 row affected",
          covers: `USING branch of ${p.name} (${p.command}) satisfied for the owner`,
          plumbing: "reuse WP1", authorIntent: "n/a (positive)",
        });
        tests.push({
          testId: id("F2", f.resource), family: "F2 write isolation", resource: f.resource,
          control: `${f.resource}#policy:${p.name}`, tier, polarity: "negative", identity: ALICE,
          operation: `${verb} ${f.resource} where ${oc} = bob`,
          expected: "0 rows affected — the policy filters the row out of the write",
          covers: `USING branch of ${p.name} (${p.command}) unsatisfied: another account's row`,
          plumbing: "reuse WP1", authorIntent: null,
        });
      }
    } else if (isHigh) {
      tests.push({
        testId: id("F2", f.resource), family: "F2 write isolation", resource: f.resource,
        control: `${f.resource}#grant:authenticated`, tier, polarity: "negative", identity: ALICE,
        operation: `insert into / update ${f.resource}`,
        expected: "error 42501 — refused before any policy is consulted",
        covers:
          "the grant surface itself: no client role holds a write privilege here, so the control is the absence of the grant (and, where present, a write-guard trigger behind it)",
        plumbing: "reuse WP1", authorIntent: null,
      });
    } else {
      na.push({
        family: "F2 write isolation", resource: f.resource,
        reason: `effective write exposure is ${f.effectiveWriteExposure} and the tier is ${tier}: the client-reachable critical path here is the read, covered under F1`,
      });
    }

    // ---------------------------------------------------------------- F3
    if (f.effectiveWriteExposure === "authenticated" && checkPolicies.length && oc) {
      const branches = isHigh ? checkPolicies : checkPolicies.slice(0, 1);
      for (const p of branches) {
        tests.push({
          testId: id("F3", f.resource), family: "F3 WITH CHECK enforcement", resource: f.resource,
          control: `${f.resource}#policy:${p.name}`, tier, polarity: "positive", identity: ALICE,
          operation: `insert into ${f.resource} with ${oc} = alice`,
          expected: "1 row affected",
          covers: `WITH CHECK branch of ${p.name} satisfied: a row attributed to the caller`,
          plumbing: "reuse WP1", authorIntent: "n/a (positive)",
        });
        tests.push({
          testId: id("F3", f.resource), family: "F3 WITH CHECK enforcement", resource: f.resource,
          control: `${f.resource}#policy:${p.name}`, tier, polarity: "negative", identity: ALICE,
          operation: `insert into ${f.resource} with ${oc} = bob`,
          expected: "error 42501 — new row violates row-level security policy",
          covers: `WITH CHECK branch of ${p.name} unsatisfied: a row attributed to another account. Tested WITHOUT a RETURNING clause so the SELECT policy is not pulled into the result (see DECISIONS D1.5)`,
          plumbing: "reuse WP1", authorIntent: null,
        });
      }
    } else {
      na.push({
        family: "F3 WITH CHECK enforcement", resource: f.resource,
        reason: !checkPolicies.length
          ? "no policy on this resource carries a WITH CHECK expression, so there is no write branch to enforce"
          : `effective write exposure is ${f.effectiveWriteExposure}: no client can reach a write, so no WITH CHECK branch is exercisable`,
      });
    }

    // ---------------------------------------------------------------- F4
    if (f.anonymousPolicyPermits) {
      tests.push({
        testId: id("F4", f.resource), family: "F4 anonymous exposure", resource: f.resource,
        control: `${f.resource}#policy:anon-admitted`, tier, polarity: "positive", identity: ANON,
        operation: `select from ${f.resource}`,
        expected: "at least 1 row — this resource is deliberately readable without an account",
        covers: "the intended anonymous read path; confirms the catalogue is reachable as designed",
        plumbing: "reuse WP1", authorIntent: "n/a (positive)",
      });
      tests.push({
        testId: id("F4", f.resource), family: "F4 anonymous exposure", resource: f.resource,
        control: `${f.resource}#policy:anon-admitted`, tier, polarity: "negative", identity: ANON,
        operation: `select from ${f.resource} where the policy predicate is false (e.g. is_active = false / status = 'cancelled')`,
        expected: "no data — the policy admits anon only for rows satisfying its predicate",
        covers: "the unsatisfied branch of the anon-admitting policy; requires a seeded inactive row",
        plumbing: "extend WP1", authorIntent: null,
      });
    } else {
      tests.push({
        testId: id("F4", f.resource), family: "F4 anonymous exposure", resource: f.resource,
        control: `${f.resource}#anon-reach`, tier, polarity: "negative", identity: ANON,
        operation: `select from ${f.resource}`,
        expected: f.anonymousGrantExists
          ? "no data — a grant exists but no policy admits anon, so row security refuses every row"
          : "no data or error 42501 — no anon grant, or no policy admits anon",
        covers: f.anonymousGrantExists
          ? "the latent anonymous grant recorded in WP2: this test is what demonstrates the policy set is the only thing denying it"
          : "the anonymous reach surface: confirms a signed-out caller obtains nothing here",
        plumbing: "reuse WP1", authorIntent: null,
      });
    }

    // ---------------------------------------------------------------- F6
    const grantedCols = f.columns.filter((c) => c.clientWritable.length > 0);
    const excludedCols = f.columns.filter((c) => c.clientWritable.length === 0);
    if (grantedCols.length > 0 && excludedCols.length > 0) {
      tests.push({
        testId: id("F6", f.resource), family: "F6 column-level leakage", resource: f.resource,
        control: `${f.resource}#colgrant`, tier, polarity: "positive", identity: ALICE,
        operation: `update ${f.resource} set ${grantedCols[0]!.name} = <value> where ${oc ?? "id"} = alice`,
        expected: "1 row affected — a granted column on the caller's own row",
        covers: `the granted half of the column surface (${grantedCols.length} of ${f.columnCount} columns are client-writable)`,
        plumbing: "reuse WP1", authorIntent: "n/a (positive)",
      });
      tests.push({
        testId: id("F6", f.resource), family: "F6 column-level leakage", resource: f.resource,
        control: `${f.resource}#colgrant`, tier, polarity: "negative", identity: ALICE,
        operation: `update ${f.resource} set ${excludedCols[0]!.name} = <value> where ${oc ?? "id"} = alice`,
        expected: "error 42501 — no column-level privilege on that column",
        covers: `a column deliberately excluded from the client grant (${excludedCols.map((c) => c.name).slice(0, 4).join(", ")}${excludedCols.length > 4 ? ", …" : ""}). A table-level check cannot see this`,
        plumbing: "reuse WP1", authorIntent: null,
      });
    } else if (f.resource === "public.daily_challenges") {
      // Read-side column exclusion rather than write-side.
      tests.push({
        testId: id("F6", f.resource), family: "F6 column-level leakage", resource: f.resource,
        control: `${f.resource}#colgrant:seed_secret`, tier, polarity: "negative", identity: ALICE,
        operation: `select seed_secret from ${f.resource}`,
        expected: "error 42501 — seed_secret is excluded from all 14 client column grants",
        covers:
          "the read-side column exclusion: the row is readable and one column is not. This is the control that keeps the day's shoe secret while the challenge metadata stays public",
        plumbing: "reuse WP1", authorIntent: null,
      });
    } else {
      na.push({
        family: "F6 column-level leakage", resource: f.resource,
        reason:
          grantedCols.length === 0
            ? "no client role holds a column-level privilege here, so there is no column surface to leak through"
            : "every column is client-granted, so no column is excluded to test against",
      });
    }

    // ---------------------------------------------------------------- F7
    if (isHigh && f.anyPolicyReferencesAuthUid && selectPolicies.length) {
      tests.push({
        testId: id("F7", f.resource), family: "F7 forced RLS / owner bypass", resource: f.resource,
        control: `${f.resource}#rls_forced`, tier, polarity: "negative", identity: OWNER,
        operation: `select from ${f.resource} (as the table owner, with no identity claims set)`,
        expected:
          "all rows returned — row-level security is enabled but NOT forced, so policies are not applied to the table owner",
        covers:
          "the enabled-versus-forced distinction on a High-tier resource whose policy would otherwise exclude these rows. Characterisation: the expected outcome documents the absence of FORCE rather than asserting a control holds",
        plumbing: "reuse WP1", authorIntent: null,
      });
    } else if (isHigh) {
      na.push({
        family: "F7 forced RLS / owner bypass", resource: f.resource,
        reason:
          "no identity-scoped SELECT policy here, so there are no rows a policy would exclude from the owner; the catalog fact (relforcerowsecurity = false) is recorded for all 39 tables in the WP0 inventory",
      });
    } else {
      na.push({
        family: "F7 forced RLS / owner bypass", resource: f.resource,
        reason: `tier is ${tier}; the owner-bypass demonstration is scoped to High-tier resources, and the catalog fact is inventoried for all 39 tables in WP0`,
      });
    }

    // ---------------------------------------------------------------- F10
    const auditTrails: Record<string, string> = {
      "public.wallet_ledger": "itself — user_id, delta, reason, created_at, seq, idempotency_key, guarded append-only",
      "public.game_events": "itself — seq-ordered, created_at, recipient_user_id, deny_client_write",
      "private.game_commands": "itself — user_id, command_type, created_at, applied_version",
      "public.rate_limit_events": "itself — user_id, action, occurred_at (allowed attempts only; refusals are deliberately not recorded)",
    };
    if (isHigh && auditTrails[f.resource]) {
      tests.push({
        testId: id("F10", f.resource), family: "F10 audit trail", resource: f.resource,
        control: `${f.resource}#audit`, tier, polarity: "positive", identity: ALICE,
        operation: `select the who/what/when columns from ${f.resource} for alice's own activity`,
        expected: "at least 1 row, each carrying an actor, an action and a timestamp",
        covers: `a who-did-what-when record exists and is timestamped: ${auditTrails[f.resource]}`,
        plumbing: "new", authorIntent: "n/a (positive)",
      });
      tests.push({
        testId: id("F10", f.resource), family: "F10 audit trail", resource: f.resource,
        control: `${f.resource}#audit-immutable`, tier, polarity: "negative", identity: ALICE,
        operation: `update, delete and truncate ${f.resource}`,
        expected: "error 42501 on each — the trail is not client-modifiable",
        covers:
          "immutability of the trail. TRUNCATE is included deliberately: row-level security does not apply to TRUNCATE at all, so only a trigger can refuse it",
        plumbing: "extend WP1", authorIntent: null,
      });
    } else if (isHigh) {
      tests.push({
        testId: id("F10", f.resource), family: "F10 audit trail", resource: f.resource,
        control: `${f.resource}#audit`, tier, polarity: "negative", identity: OWNER,
        operation:
          "search the catalogs for any history, versioning or audit relation recording changes to this resource, and for a soft-delete column or delete trigger that would retain a record",
        expected:
          "NONE FOUND — recorded as a factual absence. This is a finding candidate for WP5 and no trail is created to make the family pass",
        covers:
          "the brief's family 10 question for a High-tier resource: does a who-did-what-when record exist? Zero history/versioning/audit relations exist in public or private",
        plumbing: "new", authorIntent: null,
      });
    } else {
      na.push({
        family: "F10 audit trail", resource: f.resource,
        reason: `tier is ${tier}; the brief scopes the audit-trail question to high-tier resources`,
      });
    }
  }

  // =======================================================================
  // Families that are not per-resource
  // =======================================================================

  // ------------------------------------------------------------------- F5
  // A SECURITY DEFINER function executes with its owner's privileges, so the
  // caller's policies stop applying inside it. The control is therefore the
  // function's own argument handling, and the test is whether one can be used
  // to reach data the caller's policies forbid.
  const escalationCandidates = definerFunctions.filter(
    (fn) => fn.executableBy.includes("authenticated") || fn.executableBy.includes("anon"),
  );
  for (const fn of escalationCandidates) {
    tests.push({
      testId: id("F5", fn.resource), family: "F5 SECURITY DEFINER escalation", resource: fn.resource,
      control: `${fn.resource}#security_definer`, tier: "High", polarity: "negative", identity: ALICE,
      operation:
        "call the function as alice with an argument naming a resource or row belonging to bob",
      expected:
        "refusal or no data — the function must not return or alter what alice's own policies forbid",
      covers: `escalation through a client-callable SECURITY DEFINER function that touches a High-tier resource (${fn.touches.slice(0, 3).join(", ")}${fn.touches.length > 3 ? ", …" : ""}). Argument mapping must be derived per function before implementation`,
      plumbing: "new", authorIntent: null,
    });
  }
  if (escalationCandidates.length === 0) {
    na.push({
      family: "F5 SECURITY DEFINER escalation", resource: "(application schemas)",
      reason: "no SECURITY DEFINER function touching a High-tier resource is executable by a client role",
    });
  }

  // ------------------------------------------------------------------- F8
  // Realtime authorization is RLS on realtime.messages keyed on
  // realtime.topic(), which reads a GUC — so all three branches are testable
  // in-database without the Realtime server running.
  const RT = "realtime.messages";
  const rtCases: readonly [string, Polarity, string, string, string, string][] = [
    ["arc21_game_topic_is_for_its_seated_players", "positive", ALICE,
     "set realtime.topic to the seeded game topic, then select from realtime.messages",
     "at least 1 row — alice holds a live seat at that game",
     "the EXISTS branch satisfied: a seated player reads her own game's topic"],
    ["arc21_game_topic_is_for_its_seated_players", "negative", CAROL,
     "set realtime.topic to the same game topic, then select from realtime.messages",
     "no data — carol holds no seat at that game",
     "the EXISTS branch unsatisfied: the seeded non-participant. This is why the seed seats two of three accounts"],
    ["arc21_presence_roster_needs_an_account", "positive", ALICE,
     "set realtime.topic to 'presence:players', then select from realtime.messages",
     "at least 1 row — the shared roster requires only an account",
     "the presence read branch satisfied"],
    ["arc21_presence_roster_needs_an_account", "negative", ANON,
     "set realtime.topic to 'presence:players', then select from realtime.messages",
     "no data — no policy on realtime.messages names anon",
     "the presence read branch for a signed-out socket; also exercises the latent anon grant"],
    ["arc21_only_presence_may_be_written_by_a_client", "positive", ALICE,
     "set realtime.topic to 'presence:players', then insert into realtime.messages",
     "1 row affected — a client may publish its own presence",
     "the WITH CHECK branch satisfied: the one topic a client may write"],
    ["arc21_only_presence_may_be_written_by_a_client", "negative", CAROL,
     "set realtime.topic to the game topic, then insert into realtime.messages",
     "error 42501 — no insert policy admits a game topic",
     "the WITH CHECK branch unsatisfied: the fabricated-state injection Arc21 measured against a running stack before these policies existed"],
  ];
  for (const [policy, polarity, identity, operation, expected, covers] of rtCases) {
    tests.push({
      testId: id("F8", RT), family: "F8 realtime channel authorization", resource: RT,
      control: `${RT}#policy:${policy}`, tier: tiers.get(RT) ?? "Medium", polarity, identity,
      operation, expected, covers,
      plumbing: polarity === "negative" && policy.includes("only_presence") ? "reuse WP1" : "extend WP1",
      authorIntent: polarity === "negative" ? null : "n/a (positive)",
    });
  }

  // ------------------------------------------------------------------- F9
  // Arc21 already has transactional wallet logic. This tests whether it holds.
  const W = "public.wallets";
  const f9: readonly [Polarity, string, string, string, string, Plumbing][] = [
    ["positive",
     "two concurrent sessions each call apply_wallet_delta on alice's wallet, interleaved",
     "final balance equals the sum of both deltas, and reconciles with the ledger",
     "the concurrency control on the balance: Arc21's stated invariant is that balance and ledger must reconcile. Requires two simultaneous connections",
     "server-side (apply_wallet_delta under two concurrent sessions)", "new"],
    ["negative",
     "call apply_wallet_delta twice with the SAME idempotency key",
     "exactly one ledger row and one balance movement — the second call is a no-op, not a second credit",
     "the retry path: Arc21's invariant is that retries cannot debit or credit twice. This is the control private.game_commands and the ledger's unique idempotency key exist to provide",
     "server-side (apply_wallet_delta, same key twice)", "new"],
    ["negative",
     "call apply_wallet_delta with a debit larger than the balance",
     "refusal — balances stay non-negative (a CHECK constraint violation, SQLSTATE 23514)",
     "the non-negative-balance invariant, which is enforced as a database constraint rather than in application code",
     "server-side (apply_wallet_delta over-debit)", "new"],
    ["negative",
     "update an existing wallet_ledger row",
     "error — UPDATE is rejected for all roles by wallet_ledger_append_only",
     "append-only enforcement on the economy history. The ledger is the authoritative source wallets.balance is recomputed from, which is why WP2 rated its reversibility High",
     "server-side and as alice (both must be refused)", "extend WP1"],
    ["negative",
     "truncate public.wallet_ledger",
     "error — refused by wallet_ledger_deny_truncate",
     "TRUNCATE is not reachable through a row policy at all, so a trigger is the only thing that can refuse it",
     "server-side and as alice", "extend WP1"],
  ];
  for (const [polarity, operation, expected, covers, identity, plumbing] of f9) {
    tests.push({
      testId: id("F9", W), family: "F9 wallet / concurrency integrity", resource: W,
      control: `${W}#integrity`, tier: "High", polarity, identity, operation, expected, covers,
      plumbing, authorIntent: polarity === "negative" ? null : "n/a (positive)",
    });
  }

  // ------------------------------------------------- boundary cases
  for (const f of resources) {
    const tier = tiers.get(f.resource) ?? "Medium";
    if (tier !== "High") continue;
    if (f.anyPolicyReferencesAuthUid) {
      tests.push({
        testId: id("B", f.resource), family: "B boundary cases", resource: f.resource,
        control: `${f.resource}#boundary:null-identity`, tier, polarity: "negative",
        identity: "authenticated with NO claims set (auth.uid() is null)",
        operation: `select from ${f.resource}`,
        expected: "no data — a policy comparing to a null auth.uid() matches nothing",
        covers:
          "the brief's null/absent-identity boundary, applicable here because a policy on this resource reads auth.uid()",
        plumbing: "reuse WP1", authorIntent: null,
      });
    }
    if (f.hasIdentityLinkage) {
      tests.push({
        testId: id("B", f.resource), family: "B boundary cases", resource: f.resource,
        control: `${f.resource}#boundary:deleted-user`, tier, polarity: "negative",
        identity: "authenticated with claims for a deleted account (seeded dave, then removed)",
        operation: `select from ${f.resource} where the owner column names the deleted account`,
        expected:
          "no data — and no error. A token outliving its account must not become a key to whatever the cascade left behind",
        covers:
          "the brief's deleted-user boundary, applicable here because this resource records an owner. The seed provisions a fourth account for exactly this",
        plumbing: "extend WP1", authorIntent: null,
      });
    }
  }

  // Suite-level: expired session. Deliberately NOT a PostgreSQL test.
  tests.push({
    testId: "B.suite.expired-session", family: "B boundary cases", resource: "(API boundary)",
    control: "PostgREST / GoTrue JWT verification", tier: "suite", polarity: "negative",
    identity: "an expired JWT presented over HTTP",
    operation: "issue an authenticated request to the local PostgREST endpoint with an expired token",
    expected: "HTTP 401 — rejected at the API boundary before any statement reaches PostgreSQL",
    covers:
      "the brief's expired-session boundary. Counted once for the suite rather than per resource, because an expired JWT never arrives at the database: PostgREST verifies and rejects it first, so there is no per-resource control to exercise and pretending otherwise would claim PostgreSQL enforced something it never saw",
    plumbing: "new", authorIntent: null,
  });

  return { tests, notApplicable: na };
}
