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
import { F5_NO_TARGET, F5_SPECS } from "../rubric/f5-escalation.ts";
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

/**
 * `characterization` is a third polarity, not a flavour of negative.
 *
 * A row that records what the catalog says — RLS enabled, FORCE absent, owner
 * is postgres — asserts no control and simulates no attack, so it needs no
 * AUTHOR INTENT. Only `negative` rows do.
 */
export type Polarity = "positive" | "negative" | "characterization";
export type Plumbing = "reuse WP1" | "extend WP1" | "new";

/** The assurance verdict this test records when execution matches prediction. */
export type PlannedVerdict = "effective" | "characterized" | "gap";

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
  /**
   * What a prediction-matching execution MEANS. Declared in the plan so that
   * "the probe did what we said" can never be read as "the control holds".
   * F7 rows are `characterized`; F10 absence rows are `gap`.
   */
  readonly verdictWhenPredicted: PlannedVerdict;
  /** Reserved for the author. Null on every negative test, by design. */
  readonly authorIntent: string | null;
}

export interface NotApplicable {
  readonly family: Family;
  readonly resource: string;
  readonly reason: string;
}

/**
 * One row per policy CONSIDERED for WITH CHECK testing, whether or not a test
 * was planned for it.
 *
 * It exists because the prose reconciliation was ambiguous: five UPDATE
 * policies had their command corrected, three were found non-exercisable, and
 * four negative tests were planned. Those three numbers are all correct and
 * describe different sets, which is exactly the kind of thing a table settles
 * and a sentence does not. Two of the five were never evaluated at all — the
 * Medium-tier representative rule selected the resource's INSERT policy and
 * the UPDATE one was dropped before the exercisability check ran. That is now
 * visible rather than invisible.
 */
export interface F3Applicability {
  readonly resource: string;
  readonly policy: string;
  readonly polcmd: string;
  readonly withCheck: string;
  readonly newRowColumns: readonly string[];
  readonly clientInsertColumns: readonly string[];
  readonly clientUpdateColumns: readonly string[];
  readonly exercisable: boolean;
  readonly reasonIfNot: string;
  readonly positiveTestId: string | null;
  readonly negativeTestId: string | null;
}

export interface Wp3Plan {
  readonly tests: readonly PlannedTest[];
  readonly notApplicable: readonly NotApplicable[];
  readonly f3Applicability: readonly F3Applicability[];
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
  const f3rows: F3Applicability[] = [];
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
    // PERMISSIVE policies are OR-ed, so a negative fixture that falsifies one
    // policy can still be admitted by another. Every policy in Arc21 is
    // permissive, so a negative subject has to falsify ALL applicable ones or
    // the outcome cannot be attributed to the policy under test.
    //
    // `public.profiles` is the case that forced this. It carries two permissive
    // SELECT policies, and all four seeded accounts have privacy = 'public'
    // (the column default) — so "alice selects bob's row, expect no data" would
    // have failed a working control: profiles_select_visible legitimately
    // admits bob's public profile. The subject that falsifies both is dave,
    // whom the seed has alice blocking, because profiles_select_visible
    // requires NOT viewer_has_blocked(id).
    const multiSelect = selectPolicies.length > 1;
    if (clientReadable && selectPolicies.length && isolationScope) {
      const branches = isHigh ? selectPolicies : selectPolicies.slice(0, 1);
      for (const p of branches) {
        const isProfiles = f.resource === "public.profiles";
        const negSubject = isProfiles ? "dave" : "bob";
        // The columns the POLICY compares to auth.uid(), not a generic owner
        // column. Where there is more than one they are OR-ed, so a negative
        // fixture must falsify EVERY clause: a friend_requests row with
        // sender_id = bob but receiver_id = alice is legitimately visible to
        // alice, and using it as a negative would fail a working control.
        const pcols = p.predicateColumns.length ? p.predicateColumns : oc ? [oc] : [];
        const pcol = pcols[0] ?? oc;
        const multiClause = pcols.length > 1;
        const posOp = isolationScope === "owner"
          ? `select from ${f.resource} where ${pcol} = alice`
          : `select from ${f.resource} for the seeded game session alice is seated at`;
        const negOp = isolationScope === "owner"
          ? multiClause
            ? `select from ${f.resource} for a row where NONE of ${pcols.join(", ")} is alice (a ${negSubject}↔carol row)`
            : `select from ${f.resource} where ${pcol} = ${negSubject}`
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
          plumbing: "reuse WP1", verdictWhenPredicted: "effective", authorIntent: "n/a (positive)",
        });
        tests.push({
          testId: id("F1", f.resource), family: "F1 read isolation", resource: f.resource,
          control: `${f.resource}#policy:${p.name}`, tier, polarity: "negative", identity: negIdentity,
          operation: negOp,
          expected: "no data (0 rows — RLS filters rather than raising)",
          covers:
            (isolationScope === "owner"
              ? isProfiles
                ? `USING branch of ${p.name} unsatisfied, AND the other permissive SELECT policy (profiles_select_visible) also falsified: alice has blocked dave, and that policy requires NOT viewer_has_blocked(id). Bob would NOT work as the subject — his privacy is 'public', so profiles_select_visible admits him legitimately`
                : `USING branch of ${p.name} unsatisfied: a row belonging to another account`
              : `USING branch of ${p.name} unsatisfied: carol holds no seat at that session, which is why the seed seats two of three accounts`) +
            (multiSelect && !isProfiles
              ? `. NOTE: this resource carries ${selectPolicies.length} permissive SELECT policies, so the claim is about EFFECTIVE authorization rather than this policy alone`
              : ""),
          plumbing: "reuse WP1", verdictWhenPredicted: "effective", authorIntent: null,
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
        const pcol = p.predicateColumns[0] ?? oc;
        tests.push({
          testId: id("F2", f.resource), family: "F2 write isolation", resource: f.resource,
          control: `${f.resource}#policy:${p.name}`, tier, polarity: "positive", identity: ALICE,
          operation: `${verb} ${f.resource} where ${pcol} = alice`,
          expected: "1 row affected",
          covers: `USING branch of ${p.name} (${p.command}) satisfied for the owner`,
          plumbing: "reuse WP1", verdictWhenPredicted: "effective", authorIntent: "n/a (positive)",
        });
        tests.push({
          testId: id("F2", f.resource), family: "F2 write isolation", resource: f.resource,
          control: `${f.resource}#policy:${p.name}`, tier, polarity: "negative", identity: ALICE,
          operation: `${verb} ${f.resource} where ${pcol} = bob`,
          expected: "0 rows affected — the policy filters the row out of the write",
          covers: `USING branch of ${p.name} (${p.command}) unsatisfied: another account's row`,
          plumbing: "reuse WP1", verdictWhenPredicted: "effective", authorIntent: null,
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
        plumbing: "reuse WP1", verdictWhenPredicted: "effective", authorIntent: null,
      });
    } else {
      na.push({
        family: "F2 write isolation", resource: f.resource,
        reason: `effective write exposure is ${f.effectiveWriteExposure} and the tier is ${tier}: the client-reachable critical path here is the read, covered under F1`,
      });
    }

    // ---------------------------------------------------------------- F3
    // The command comes from the POLICY, not from a template. An INSERT policy
    // is tested with INSERT; an UPDATE policy with UPDATE. They are different
    // controls: an INSERT WITH CHECK governs the row being created, an UPDATE
    // WITH CHECK governs the row as it will be AFTER the update.
    //
    // And an UPDATE WITH CHECK is only independently exercisable if the caller
    // can change a column the expression reads. In Arc21 it never can: every
    // UPDATE WITH CHECK compares the owner column, and no owner column appears
    // in any client column-level UPDATE grant. That is recorded rather than
    // faked, because a negative test that cannot be constructed must not be
    // planned as though it could.
    if (f.effectiveWriteExposure === "authenticated" && checkPolicies.length && oc) {
      const branches = isHigh ? checkPolicies : checkPolicies.slice(0, 1);
      for (const p of branches) {
        // The column the WITH CHECK actually compares to auth.uid().
        const pcol = p.predicateColumns[0] ?? oc;
        const ownerColGranted = f.columns.some(
          (c) => c.name === pcol && c.clientUpdate.length > 0,
        );
        const tableUpdateGrant = (f.reachableBy["authenticated"] ?? []).includes("UPDATE");

        if (p.command === "INSERT") {
          tests.push({
            testId: id("F3", f.resource), family: "F3 WITH CHECK enforcement", resource: f.resource,
            control: `${f.resource}#policy:${p.name}`, tier, polarity: "positive", identity: ALICE,
            operation: `INSERT into ${f.resource} with ${pcol} = alice`,
            expected: "1 row affected",
            covers: `WITH CHECK of ${p.name} (INSERT) satisfied: a row attributed to the caller`,
            plumbing: "reuse WP1", verdictWhenPredicted: "effective", authorIntent: "n/a (positive)",
          });
          tests.push({
            testId: id("F3", f.resource), family: "F3 WITH CHECK enforcement", resource: f.resource,
            control: `${f.resource}#policy:${p.name}`, tier, polarity: "negative", identity: ALICE,
            operation: `INSERT into ${f.resource} with ${pcol} = bob (no RETURNING clause)`,
            expected: "error 42501 — new row violates row-level security policy",
            covers: `WITH CHECK of ${p.name} (INSERT) unsatisfied: the policy compares \`${pcol}\`, so that is the column set to another account. No RETURNING, so the SELECT policy is not pulled in (DECISIONS D1.5)`,
            plumbing: "reuse WP1", verdictWhenPredicted: "effective", authorIntent: null,
          });
        } else if (p.command === "UPDATE") {
          tests.push({
            testId: id("F3", f.resource), family: "F3 WITH CHECK enforcement", resource: f.resource,
            control: `${f.resource}#policy:${p.name}`, tier, polarity: "positive", identity: ALICE,
            operation: `UPDATE ${f.resource} set <a client-granted column> where ${pcol} = alice`,
            expected: "1 row affected, and the row is still attributed to alice afterwards",
            covers: `WITH CHECK of ${p.name} (UPDATE) satisfied: the post-update row still belongs to the caller`,
            plumbing: "reuse WP1", verdictWhenPredicted: "effective", authorIntent: "n/a (positive)",
          });
          if (ownerColGranted || tableUpdateGrant) {
            tests.push({
              testId: id("F3", f.resource), family: "F3 WITH CHECK enforcement", resource: f.resource,
              control: `${f.resource}#policy:${p.name}`, tier, polarity: "negative", identity: ALICE,
              operation: `UPDATE ${f.resource} set ${pcol} = bob where ${pcol} = alice — satisfying USING, violating WITH CHECK`,
              expected: "error 42501 — the post-update row would violate the policy's WITH CHECK",
              covers: `WITH CHECK of ${p.name} (UPDATE) unsatisfied while USING is satisfied. This is the only shape that isolates the WITH CHECK half from the USING half on an UPDATE`,
              plumbing: "extend WP1", verdictWhenPredicted: "effective", authorIntent: null,
            });
          } else {
            na.push({
              family: "F3 WITH CHECK enforcement", resource: f.resource,
              reason: `${p.name} is an UPDATE policy whose WITH CHECK compares \`${oc}\`, and \`${oc}\` appears in no client column-level UPDATE grant (granted: ${f.columns.filter((c) => c.clientUpdate.length).map((c) => c.name).join(", ") || "none"}). A client cannot construct a row that satisfies USING and violates WITH CHECK, so that branch is not independently exercisable from a client session. It is defence in depth behind the column grant, and becomes reachable only if the grant is ever widened`,
            });
          }
        }
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
        plumbing: "reuse WP1", verdictWhenPredicted: "effective", authorIntent: "n/a (positive)",
      });
      tests.push({
        testId: id("F4", f.resource), family: "F4 anonymous exposure", resource: f.resource,
        control: `${f.resource}#policy:anon-admitted`, tier, polarity: "negative", identity: ANON,
        operation: `select from ${f.resource} where the policy predicate is false (e.g. is_active = false / status = 'cancelled')`,
        expected: "no data — the policy admits anon only for rows satisfying its predicate",
        covers: "the unsatisfied branch of the anon-admitting policy; requires a seeded inactive row",
        plumbing: "extend WP1", verdictWhenPredicted: "effective", authorIntent: null,
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
        plumbing: "reuse WP1", verdictWhenPredicted: "effective", authorIntent: null,
      });
    }

    // ---------------------------------------------------------------- F6
    // The privilege TYPE decides the statement. A column-level SELECT grant is
    // a confidentiality boundary and is tested by reading; a column-level
    // UPDATE grant is an integrity boundary and is tested by writing.
    //
    // Collapsing the two is what produced the previous plan's invalid case:
    // public.daily_challenges grants column-level SELECT on 14 columns and
    // excludes seed_secret, and the collapsed facts made that look like 14
    // writable columns, so the planner proposed UPDATEs against a read boundary.
    const selGranted = f.columns.filter((c) => c.clientSelect.length > 0);
    const updGranted = f.columns.filter((c) => c.clientUpdate.length > 0);
    const selExcluded = f.columns.filter((c) => c.clientSelect.length === 0);
    const updExcluded = f.columns.filter((c) => c.clientUpdate.length === 0);

    if (selGranted.length > 0 && selExcluded.length > 0) {
      tests.push({
        testId: id("F6", f.resource), family: "F6 column-level leakage", resource: f.resource,
        control: `${f.resource}#colgrant:SELECT`, tier, polarity: "positive", identity: ALICE,
        operation: `SELECT ${selGranted.slice(0, 3).map((c) => c.name).join(", ")} from ${f.resource}`,
        expected: `rows returned — ${selGranted.length} of ${f.columnCount} columns carry a client SELECT grant`,
        covers: `the granted half of the READ column surface: the caller may see the intended exposed columns`,
        plumbing: "reuse WP1", verdictWhenPredicted: "effective", authorIntent: "n/a (positive)",
      });
      tests.push({
        testId: id("F6", f.resource), family: "F6 column-level leakage", resource: f.resource,
        control: `${f.resource}#colgrant:SELECT`, tier, polarity: "negative", identity: ALICE,
        operation: `SELECT ${selExcluded[0]!.name} from ${f.resource}`,
        expected: "error 42501 — no column-level SELECT privilege on that column",
        covers: `the confidentiality boundary INSIDE a readable row: ${selExcluded.map((c) => c.name).join(", ")} ${selExcluded.length === 1 ? "is" : "are"} excluded from every client SELECT grant. A row-level check cannot see this, and a table-level one cannot either`,
        plumbing: "reuse WP1", verdictWhenPredicted: "effective", authorIntent: null,
      });
    }

    if (updGranted.length > 0 && updExcluded.length > 0) {
      tests.push({
        testId: id("F6", f.resource), family: "F6 column-level leakage", resource: f.resource,
        control: `${f.resource}#colgrant:UPDATE`, tier, polarity: "positive", identity: ALICE,
        operation: `UPDATE ${f.resource} set ${updGranted[0]!.name} = <value> where ${oc ?? "id"} = alice`,
        expected: "1 row affected — a granted column on the caller's own row",
        covers: `the granted half of the WRITE column surface (${updGranted.map((c) => c.name).join(", ")})`,
        plumbing: "reuse WP1", verdictWhenPredicted: "effective", authorIntent: "n/a (positive)",
      });
      tests.push({
        testId: id("F6", f.resource), family: "F6 column-level leakage", resource: f.resource,
        control: `${f.resource}#colgrant:UPDATE`, tier, polarity: "negative", identity: ALICE,
        operation: `UPDATE ${f.resource} set ${updExcluded[0]!.name} = <value> where ${oc ?? "id"} = alice`,
        expected: "error 42501 — no column-level UPDATE privilege on that column",
        covers: `a column deliberately excluded from the client UPDATE grant (${updExcluded.map((c) => c.name).slice(0, 4).join(", ")}${updExcluded.length > 4 ? ", …" : ""})`,
        plumbing: "reuse WP1", verdictWhenPredicted: "effective", authorIntent: null,
      });
    }

    if (selGranted.length === 0 && updGranted.length === 0) {
      na.push({
        family: "F6 column-level leakage", resource: f.resource,
        reason: "no client role holds a column-level privilege of any type here, so there is no column surface to leak through — access is decided at the table level",
      });
    }

    // ---------------------------------------------------------------- F7
    // TWO LAYERS, kept apart because conflating them was a logical error.
    //
    // The previous plan ran these probes as owner(postgres) and claimed they
    // demonstrated the owner exemption. They cannot. WP1 established that
    // `postgres` holds BYPASSRLS, so it would see every row even with FORCE
    // enabled — the probe cannot distinguish "not forced" from "bypasses
    // anyway". The observation is real; the attribution was wrong.
    //
    // Layer 1, here: per-resource CHARACTERIZATION of the catalog state. It
    // records relrowsecurity, relforcerowsecurity and the owner. It asserts no
    // control, simulates no attack, and therefore needs no AUTHOR INTENT.
    //
    // Layer 2, below: the mechanism demonstration, on a scratch table owned by
    // a role holding no BYPASSRLS, where the variable CAN be isolated. Arc21's
    // ownership model is not mutated to manufacture a per-resource test.
    if (isHigh) {
      tests.push({
        testId: id("F7", f.resource), family: "F7 forced RLS / owner bypass", resource: f.resource,
        control: `${f.resource}#rls_forced`, tier, polarity: "characterization",
        identity: "server-side catalog read (no control is exercised)",
        operation: `read relrowsecurity, relforcerowsecurity and the owner for ${f.resource} from pg_class`,
        expected: `rls_enabled = true, rls_forced = FALSE, owner = ${f.owner}`,
        covers:
          "records the enabled-versus-forced state for a High-tier resource. A characterization fact: no statement is issued against the table and no control is asserted, so this row carries no AUTHOR INTENT. What the absence of FORCE would MEAN is demonstrated separately on a scratch owner that does not hold BYPASSRLS",
        plumbing: "reuse WP1", verdictWhenPredicted: "characterized", authorIntent: "n/a (characterization)",
      });
    } else {
      na.push({
        family: "F7 forced RLS / owner bypass", resource: f.resource,
        reason: `tier is ${tier}; per-resource characterization is scoped to High-tier resources, and the catalog fact is inventoried for all 39 tables in WP0`,
      });
    }

    // ---------------------------------------------------------------- F10
    // Two corrections over the first draft.
    //
    // IDENTITY. The existence check must run as a role that can legitimately
    // read the trail. The first draft used alice for all four, including
    // private.game_commands and public.rate_limit_events — which F1 had
    // correctly marked as having no client read path at all. Those existence
    // checks run server-side; only the tamper attempt runs as a client.
    //
    // SEMANTICS. "Who did what when" needs an ACTOR, an ACTION and a TIME. A
    // recipient or affected-user column is not an actor. Where a table is
    // missing one of the three it is recorded as a PARTIAL trail and kept as a
    // finding candidate, not relabelled as a complete one.
    interface TrailSpec {
      readonly inspectAs: string;
      readonly actor: string | null;
      readonly action: string | null;
      readonly time: string | null;
      readonly completeness: "complete" | "partial";
      readonly note: string;
    }
    const TRAILS: Record<string, TrailSpec> = {
      "public.wallet_ledger": {
        inspectAs: ALICE,
        actor: "user_id (the account whose balance moved)",
        action: "reason (a ledger_reason enum) plus delta and reference_type/reference_id",
        time: "created_at, plus seq for a total order",
        completeness: "complete",
        note: "the only structure in Arc21 carrying all three of actor, action and time, guarded append-only with a truncate guard. Readable by its owner, so alice can inspect her own",
      },
      "public.game_events": {
        inspectAs: ALICE,
        actor: null,
        action: "type plus a sanitised payload",
        time: "created_at, plus seq for a total order",
        completeness: "partial",
        note: "PARTIAL. recipient_user_id names who a seat-scoped event is FOR, not who caused it. There is no actor column, so this answers what-happened-when for a session but not who-did-it. Finding candidate",
      },
      "private.game_commands": {
        inspectAs: "server-side (admin) — no client role holds USAGE on the private schema",
        actor: "user_id, derived from the verified JWT rather than from a payload",
        action: "command_type plus applied_version and the committed response",
        time: "created_at",
        completeness: "complete",
        note: "carries all three, and its comment records that user_id comes from the verified JWT so a replay under another account is rejected. Not client-readable at all, so the existence check is server-side",
      },
      "public.rate_limit_events": {
        inspectAs: "server-side (admin) — RLS is enabled with no policy and no client grant exists",
        actor: "user_id",
        action: "action (the rate-limited operation)",
        time: "occurred_at",
        completeness: "partial",
        note: "PARTIAL for security purposes. It records ALLOWED attempts only — refusals are deliberately not recorded — and it is pruned on every consume, so it holds at most one window. It cannot answer 'who was refused, when'. Finding candidate",
      },
    };

    const trail = TRAILS[f.resource];
    if (isHigh && trail) {
      tests.push({
        testId: id("F10", f.resource), family: "F10 audit trail", resource: f.resource,
        control: `${f.resource}#audit:exists`, tier, polarity: "positive", identity: trail.inspectAs,
        operation: `select the actor / action / time columns from ${f.resource}`,
        expected: `rows returned carrying ${[trail.actor && "an actor", trail.action && "an action", trail.time && "a timestamp"].filter(Boolean).join(", ")}`,
        covers: `does a who-did-what-when record exist, and is it timestamped. ${trail.note}`,
        plumbing: "new",
        verdictWhenPredicted: trail.completeness === "complete" ? "effective" : "gap",
        authorIntent: "n/a (positive)",
      });
      tests.push({
        testId: id("F10", f.resource), family: "F10 audit trail", resource: f.resource,
        control: `${f.resource}#audit:immutable`, tier, polarity: "negative", identity: ALICE,
        operation: `as an ordinary client, attempt UPDATE, DELETE and TRUNCATE on ${f.resource}`,
        expected: "error 42501 on each — the trail is not client-modifiable",
        covers:
          "can a user modify or delete the record. TRUNCATE is included deliberately: row-level security does not apply to TRUNCATE at all, so only a trigger can refuse it",
        plumbing: "extend WP1", verdictWhenPredicted: "effective", authorIntent: null,
      });
    } else if (isHigh) {
      tests.push({
        testId: id("F10", f.resource), family: "F10 audit trail", resource: f.resource,
        control: `${f.resource}#audit:absent`, tier, polarity: "negative", identity: OWNER,
        operation:
          "search the catalogs for any history, versioning or audit relation recording changes to this resource, and for a soft-delete column or delete trigger that would retain a record",
        expected:
          "NONE FOUND — recorded as a factual absence, and no trail is created to make the family pass",
        covers:
          "the brief's family 10 question for a High-tier resource. Zero history, versioning or audit relations exist in public or private, and blocks / friendships / friend_requests carry no soft-delete column and no delete trigger — so removing a block, which feeds profiles_select_visible and therefore an authorization decision, leaves no trace",
        plumbing: "new", verdictWhenPredicted: "gap", authorIntent: null,
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
  // One case per function, from rubric/f5-escalation.ts, where each carries its
  // own purpose, identity source, privileged reach, escalation shape, concrete
  // attempt and exact safe result. The generic "pass Bob's resource" template
  // is gone: it faked a target argument on functions that have none, and it
  // expected "no data" from functions that are cross-user by design.
  for (const spec of F5_SPECS) {
    // A spec whose predicted safe result is itself a recorded fact rather than
    // a refusal is a characterization, and carries no AUTHOR INTENT.
    const isCharacterization = spec.expectedSafe.includes("CHARACTERIZATION");
    tests.push({
      testId: id("F5", spec.fn), family: "F5 SECURITY DEFINER escalation",
      resource: `public.${spec.fn}(${spec.args})`,
      control: `public.${spec.fn}#security_definer`, tier: "High",
      polarity: isCharacterization ? "characterization" : "negative",
      identity: ALICE,
      operation: spec.attempt,
      expected: spec.expectedSafe,
      covers: `[${spec.klass}] ${spec.purpose}. Identity: ${spec.identitySource}. Reaches: ${spec.privilegedReach}. Escalation would be: ${spec.escalationWouldBe}`,
      plumbing: "new",
      verdictWhenPredicted: isCharacterization ? "characterized" : "effective",
      authorIntent: isCharacterization ? "n/a (characterization)" : null,
    });
  }
  // Functions with no user-controlled target: one case each, asking the only
  // escalation question that applies to them.
  for (const fn of F5_NO_TARGET) {
    tests.push({
      testId: id("F5", fn.split("(")[0] ?? fn), family: "F5 SECURITY DEFINER escalation",
      resource: `public.${fn}`,
      control: `public.${fn.split("(")[0]}#security_definer`, tier: "High", polarity: "negative",
      identity: ALICE,
      operation: `call ${fn} as alice while bob's and carol's rows are present in every table it reads`,
      expected: "only alice's own data is returned or altered; no row belonging to bob or carol appears or changes",
      covers:
        "[no_target] this function takes no argument naming another account or resource — its identity derives solely from auth.uid(). There is no target to abuse, so the applicable escalation question is whether the definer privilege leaks past the caller's own data",
      plumbing: "new", verdictWhenPredicted: "effective", authorIntent: null,
    });
  }

  // ------------------------------------------------- F7 mechanism demonstration
  // The only place the owner exemption can actually be isolated: a scratch
  // table owned by a purpose-made role holding NO BYPASSRLS, created and
  // dropped inside the run. This is WP1 §2's experiment, re-executed to produce
  // WP3 evidence rather than cited from WP1.
  const F7M = "(scratch table, owner without BYPASSRLS)";
  const f7Mech: readonly [Polarity, string, string, string, string][] = [
    ["characterization", "scratch owner (owns the table, no BYPASSRLS, not a superuser)",
     "with RLS enabled and NOT forced, select from the scratch table whose policy admits 1 of its 2 rows",
     "2 rows — the owner is not subject to the policy",
     "isolates the OWNER exemption. The role holds no BYPASSRLS, so this outcome can only be ownership, which is the inference the Arc21 probes could not support"],
    ["positive", "the same scratch owner, same statement",
     "enable FORCE ROW LEVEL SECURITY on the scratch table and repeat the select",
     "1 row — FORCE removes the owner's exemption and the policy now applies",
     "demonstrates what FORCE changes, with ownership as the only variable moved"],
    ["characterization", "postgres (holds BYPASSRLS, NOT the owner of the scratch table)",
     "with FORCE still enabled, select from the scratch table",
     "2 rows — BYPASSRLS is a separate exemption that FORCE does not touch",
     "keeps the two exemptions explicitly apart. This is why the Arc21 per-resource rows are characterization only: their owner holds both exemptions at once"],
  ];
  for (const [polarity, identity, operation, expected, covers] of f7Mech) {
    tests.push({
      testId: id("F7m", "mechanism"), family: "F7 forced RLS / owner bypass", resource: F7M,
      control: "FORCE ROW LEVEL SECURITY vs BYPASSRLS", tier: "suite", polarity, identity,
      operation, expected, covers,
      plumbing: "reuse WP1", verdictWhenPredicted: polarity === "positive" ? "effective" : "characterized",
      authorIntent: polarity === "negative" ? null : "n/a (mechanism demonstration)",
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
      verdictWhenPredicted: "effective",
      authorIntent: polarity === "negative" ? null : "n/a (positive)",
    });
  }

  // The SQL policy tests above prove the POLICIES behave. They do not prove the
  // real client path reaches them. Realtime only consults these policies when a
  // channel is declared private, so a client that subscribed non-privately
  // would bypass them entirely while every SQL test still passed. These cases
  // drive the actual local Supabase Realtime socket.
  const rtIntegration: readonly [Polarity, string, string, string, string][] = [
    ["positive", ALICE,
     "subscribe to the private channel `game:<seeded session>` over the local Realtime websocket using alice's JWT, then have the server broadcast a state message",
     "the subscription is accepted and alice's client receives the payload",
     "end-to-end: confirms the real client path declares the channel private and therefore reaches arc21_game_topic_is_for_its_seated_players at all. An SQL-only suite cannot detect a client that subscribed non-privately"],
    ["negative", CAROL,
     "subscribe to that same private channel `game:<seeded session>` using carol's JWT, who holds no seat",
     "the subscription is refused, or is accepted and delivers nothing; carol's client must receive no game payload",
     "the brief's family 8 question in its literal form — can a client subscribe to another user's channel — exercised through the socket rather than through SQL"],
    ["negative", CAROL,
     "publish a `state` broadcast to `game:<seeded session>` over the websocket as carol",
     "refused; no other subscriber receives a carol-originated state message",
     "the fabricated-state injection Arc21 measured against a running stack before these policies existed, retested at the layer where it actually happened"],
  ];
  for (const [polarity, identity, operation, expected, covers] of rtIntegration) {
    tests.push({
      testId: id("F8i", RT), family: "F8 realtime channel authorization", resource: RT,
      control: `${RT}#realtime-socket`, tier: tiers.get(RT) ?? "Medium", polarity, identity,
      operation, expected, covers,
      plumbing: "new", verdictWhenPredicted: "effective",
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
      plumbing, verdictWhenPredicted: "effective", authorIntent: polarity === "negative" ? null : "n/a (positive)",
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
        plumbing: "reuse WP1", verdictWhenPredicted: "effective", authorIntent: null,
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
        plumbing: "extend WP1", verdictWhenPredicted: "effective", authorIntent: null,
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
    plumbing: "new", verdictWhenPredicted: "effective", authorIntent: null,
  });

  // ---------------------------------------------------- F3 applicability table
  // Evaluated for EVERY policy carrying a WITH CHECK, independently of whether
  // the tier's representative rule selected it for a test.
  for (const f of resources) {
    for (const p of f.policies.filter((x) => x.hasWithCheck)) {
      const pcol = p.predicateColumns[0] ?? ownerCol(f);
      const newRowCols = p.predicateColumns.length ? [...p.predicateColumns] : pcol ? [pcol] : [];
      const insCols = (f.reachableBy["authenticated"] ?? []).includes("INSERT")
        ? ["(table-level INSERT: all columns)"]
        : [];
      const updCols = f.columns.filter((c) => c.clientUpdate.length > 0).map((c) => c.name);
      const tableUpd = (f.reachableBy["authenticated"] ?? []).includes("UPDATE");
      const pos = tests.find(
        (t) => t.family === "F3 WITH CHECK enforcement" && t.control.endsWith(`#policy:${p.name}`) && t.polarity === "positive",
      );
      const neg = tests.find(
        (t) => t.family === "F3 WITH CHECK enforcement" && t.control.endsWith(`#policy:${p.name}`) && t.polarity === "negative",
      );

      let exercisable: boolean;
      let reason = "";
      if (f.effectiveWriteExposure !== "authenticated") {
        exercisable = false;
        reason = `effective write exposure is ${f.effectiveWriteExposure}: no client can reach a write on this resource at all`;
      } else if (p.command === "INSERT") {
        exercisable = insCols.length > 0;
        reason = exercisable ? "" : "no client INSERT grant, so the new-row check cannot be reached";
      } else {
        // UPDATE: the WITH CHECK is only independently exercisable if the
        // caller can change a column the check reads.
        const canChange = newRowCols.some((c) => updCols.includes(c)) || tableUpd;
        exercisable = canChange;
        reason = canChange
          ? ""
          : `UPDATE policy whose new-row check reads ${newRowCols.join(", ")}; the client's column-level UPDATE grant covers only ${updCols.join(", ") || "nothing"}, so no client statement can satisfy USING while violating WITH CHECK. Defence in depth behind the column grant; reachable only if that grant is widened`;
      }

      f3rows.push({
        resource: f.resource, policy: p.name, polcmd: p.command,
        withCheck: "present (explicit)",
        newRowColumns: newRowCols,
        clientInsertColumns: insCols,
        clientUpdateColumns: updCols,
        exercisable,
        reasonIfNot: exercisable
          ? neg
            ? ""
            : f.resource === "realtime.messages"
              ? "exercisable, and tested under F8 realtime channel authorization rather than F3, so the three realtime policies stay documented in one place"
              : "exercisable, but the tier's representative rule selected another WITH CHECK policy on this resource for the negative case"
          : reason,
        positiveTestId: pos?.testId ?? null,
        negativeTestId: neg?.testId ?? null,
      });
    }
  }

  return { tests, notApplicable: na, f3Applicability: f3rows };
}
