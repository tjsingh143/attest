/**
 * Attest — WP1, harness validation.
 *
 * This package exists to answer one question before any result downstream is
 * worth reading: **how do you know the tests were exercising the policy?**
 *
 * Asserting it is not an answer. So each scenario below does this:
 *
 *   1. Run a probe against the intact control and record what happened.
 *   2. Deliberately weaken that control in the disposable instance.
 *   3. Run the identical probe again. If the recorded outcome does not CHANGE,
 *      the probe was never touching the control and the run fails.
 *   4. Run the identical probe on an over-privileged connection in both states.
 *      If ITS outcome is the same in both, that connection cannot tell an
 *      intact control from a broken one -- which is the precise sense in which
 *      role scoping is load-bearing.
 *   5. Restore, re-run, and confirm the original outcome returns.
 *
 * Framing step 4 as "the admin connection does not catch the violation" is the
 * usual phrasing and it is slightly too loose. The sharp version is: the
 * over-privileged connection returns the SAME ANSWER whether the control is
 * intact or broken, so no assertion built on it can discriminate. That is
 * checkable, and it is what is checked.
 *
 * Every weakening is applied and reverted inside a try/finally, and the whole
 * package re-reads the control inventory afterwards and compares it to the
 * inventory taken before. If the instance was not left exactly as found, the
 * run says so.
 */
import type { Session } from "./db.ts";
import { adminSession, roleSession } from "./db.ts";
import {
  describeExpectation, execute, record, summarize,
  type CheckSpec, type EvidenceRecord, type Expectation, type Outcome, type RecordContext,
} from "./evidence.ts";

// Seeded identities. See seed/seed.sql.
const ALICE = "00000000-0000-4000-8000-00000000000a";
const BOB = "00000000-0000-4000-8000-00000000000b";
const CAROL = "00000000-0000-4000-8000-00000000000c";
const GAME = "e0000000-0000-4000-8000-000000000001";

// ---------------------------------------------------------------------------
// Identities
// ---------------------------------------------------------------------------

export type IdentitySpec =
  | { readonly kind: "client"; readonly role: "authenticated" | "anon"; readonly sub?: string; readonly label: string }
  | { readonly kind: "service_role"; readonly label: string }
  | { readonly kind: "admin"; readonly label: string };

const ALICE_ID: IdentitySpec = { kind: "client", role: "authenticated", sub: ALICE, label: "authenticated:alice" };
const CAROL_ID: IdentitySpec = { kind: "client", role: "authenticated", sub: CAROL, label: "authenticated:carol" };

/**
 * The two ways a harness gets this wrong. Both are ordinary mistakes rather
 * than exotic ones: `service_role` is the key a server-side integration uses,
 * and `postgres` is what the CLI and every migration connect as.
 */
const OVER_PRIVILEGED: readonly IdentitySpec[] = [
  { kind: "service_role", label: "service_role" },
  { kind: "admin", label: "admin(postgres)" },
];

export async function openIdentity(spec: IdentitySpec): Promise<Session> {
  if (spec.kind === "admin") return adminSession(spec.label);
  if (spec.kind === "service_role") {
    return roleSession({ role: "service_role", claims: null, label: spec.label, allowRlsBypass: true });
  }
  return roleSession({
    role: spec.role,
    claims: spec.sub ? { sub: spec.sub, role: spec.role } : null,
    label: spec.label,
  });
}

// ---------------------------------------------------------------------------
// Weakenings
// ---------------------------------------------------------------------------

/** A deliberate break: how to apply it, and how to put it back exactly. */
interface Weakening {
  readonly what: string;
  apply(admin: Session): Promise<void>;
  restore(admin: Session): Promise<void>;
}

/** A stage of a scenario: one weakening, and what the probe should then do. */
interface Stage {
  readonly weakening: Weakening;
  readonly expectAfter: Expectation;
  /** Why the probe should behave that way once this stage is applied. */
  readonly because: string;
}

async function policyExpr(
  admin: Session, relation: string, policy: string, half: "qual" | "withcheck",
): Promise<string> {
  const col = half === "qual" ? "polqual" : "polwithcheck";
  const { rows } = await admin.query<{ expr: string | null }>(
    `select pg_get_expr(${col}, polrelid) as expr
       from pg_policy where polname = $1 and polrelid = $2::regclass`,
    [policy, relation],
  );
  const expr = rows[0]?.expr;
  if (!expr) throw new Error(`policy ${policy} on ${relation} has no ${half} expression to weaken`);
  return expr;
}

/** Replace a policy's USING or WITH CHECK with `true`, and put the original back. */
function weakenPolicy(
  relation: string, policy: string, half: "qual" | "withcheck",
): Weakening {
  const clause = half === "qual" ? "using" : "with check";
  let original: string | null = null;
  return {
    what: `alter policy ${policy} on ${relation} — replace its ${clause.toUpperCase()} expression with true`,
    async apply(admin) {
      original = await policyExpr(admin, relation, policy, half);
      await admin.query(`alter policy ${policy} on ${relation} ${clause} (true)`);
    },
    async restore(admin) {
      if (original === null) return;
      await admin.query(`alter policy ${policy} on ${relation} ${clause} (${original})`);
      original = null;
    },
  };
}

function grantPrivilege(grant: string, revoke: string, what: string): Weakening {
  return {
    what,
    async apply(admin) { await admin.query(grant); },
    async restore(admin) { await admin.query(revoke); },
  };
}

function disableTrigger(relation: string, trigger: string): Weakening {
  return {
    what: `alter table ${relation} disable trigger ${trigger}`,
    async apply(admin) { await admin.query(`alter table ${relation} disable trigger ${trigger}`); },
    async restore(admin) { await admin.query(`alter table ${relation} enable trigger ${trigger}`); },
  };
}

function addPermissivePolicy(relation: string, name: string, forCmd: string, role: string): Weakening {
  return {
    what: `create policy ${name} on ${relation} for ${forCmd} to ${role} using (true)`,
    async apply(admin) {
      await admin.query(`create policy ${name} on ${relation} for ${forCmd} to ${role} using (true)`);
    },
    async restore(admin) {
      await admin.query(`drop policy if exists ${name} on ${relation}`);
    },
  };
}

// ---------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------

interface Scenario {
  readonly id: string;
  readonly family: string;
  readonly controlId: string;
  /** What the control does, mechanically. Not a risk statement. */
  readonly control: string;
  readonly probeAs: IdentitySpec;
  /** Session-level settings applied to the probing session first, e.g. a GUC. */
  readonly sessionSetup?: readonly string[];
  readonly check: CheckSpec;
  readonly stages: readonly Stage[];
  /** Run as admin after the scenario, to undo any row the probe wrote. */
  readonly cleanup?: readonly string[];
}

const SCENARIOS: readonly Scenario[] = [
  {
    id: "S1",
    family: "read isolation",
    controlId: "public.wallets#policy:wallets_select_own",
    control:
      "wallets_select_own restricts SELECT on public.wallets to rows whose user_id equals auth.uid().",
    probeAs: ALICE_ID,
    check: {
      testId: "S1.read-isolation.wallets",
      family: "read isolation",
      controlId: "public.wallets#policy:wallets_select_own",
      description: "alice selects the wallet row belonging to bob",
      statement: "select balance from public.wallets where user_id = $1",
      params: [BOB],
      expect: { kind: "no_data" },
    },
    stages: [{
      weakening: weakenPolicy("public.wallets", "wallets_select_own", "qual"),
      expectAfter: { kind: "rows", count: 1 },
      because: "with the USING expression replaced by true, the policy admits every row to every authenticated caller",
    }],
  },
  {
    id: "S2",
    family: "WITH CHECK enforcement",
    controlId: "public.push_tokens#policy:push_tokens_insert_own",
    control:
      "push_tokens_insert_own carries a WITH CHECK requiring an inserted row's user_id to equal auth.uid(). " +
      "This is the half of a policy that governs what may be WRITTEN, and it is separate from the SELECT policy.",
    probeAs: ALICE_ID,
    check: {
      testId: "S2.with-check.push_tokens",
      family: "WITH CHECK enforcement",
      controlId: "public.push_tokens#policy:push_tokens_insert_own",
      description: "alice inserts a push token attributed to bob",
      // No RETURNING clause, deliberately. PostgreSQL applies SELECT policies as
      // an additional WITH CHECK on the row an INSERT ... RETURNING hands back,
      // so writing this probe the obvious way made it test push_tokens_insert_own
      // AND push_tokens_select_own together -- and weakening only the first left
      // the second still refusing. A probe named for one control has to exercise
      // that control alone or its result means nothing.
      statement:
        "insert into public.push_tokens (user_id, token, platform) values ($1, $2, 'ios')",
      params: [BOB, "ExponentPushToken[attest-wp1-probe]"],
      expect: { kind: "error", sqlstate: "42501" },
    },
    stages: [{
      weakening: weakenPolicy("public.push_tokens", "push_tokens_insert_own", "withcheck"),
      expectAfter: { kind: "rows", count: 1 },
      because: "with WITH CHECK replaced by true, any authenticated caller may write a row attributed to anyone",
    }],
    cleanup: ["delete from public.push_tokens where token = 'ExponentPushToken[attest-wp1-probe]'"],
  },
  {
    id: "S3",
    family: "column grant + write-guard trigger",
    controlId: "public.profiles#trigger:profiles_guard_server_columns",
    control:
      "profiles.level is server-owned. Two separate controls refuse a client write to it: `authenticated` holds " +
      "no column-level UPDATE privilege on it, and profiles_guard_server_columns raises 42501 if a client role " +
      "changes it. Arc21's own documentation calls the trigger the second lock; this scenario tests whether " +
      "there really are two.",
    probeAs: ALICE_ID,
    check: {
      testId: "S3.server-column.profiles",
      family: "column grant + write-guard trigger",
      controlId: "public.profiles#trigger:profiles_guard_server_columns",
      description: "alice raises her own profile level to 99",
      statement: "update public.profiles set level = 99 where id = $1",
      params: [ALICE],
      expect: { kind: "error", sqlstate: "42501" },
    },
    stages: [
      {
        weakening: grantPrivilege(
          "grant update (level) on public.profiles to authenticated",
          "revoke update (level) on public.profiles from authenticated",
          "grant update (level) on public.profiles to authenticated — removes the first lock",
        ),
        expectAfter: { kind: "error", sqlstate: "42501" },
        because: "the privilege system now permits the write, so whether it is still refused depends entirely on the trigger",
      },
      {
        weakening: disableTrigger("public.profiles", "profiles_guard_server_columns"),
        expectAfter: { kind: "rows", count: 1 },
        because: "with both locks removed there is nothing left to refuse the write",
      },
    ],
    cleanup: ["update public.profiles set level = 1 where id = '" + ALICE + "' and level <> 1"],
  },
  {
    id: "S4",
    family: "realtime channel authorization",
    controlId: "realtime.messages#policy:arc21_only_presence_may_be_written_by_a_client",
    control:
      "Arc21 broadcasts game state over Realtime private channels. A client may publish to the shared presence " +
      "topic and to nothing else; the server publishes game state as service_role. The control is a WITH CHECK " +
      "on realtime.messages comparing realtime.topic() to 'presence:players'. `authenticated` holds INSERT on " +
      "the table, so the policy is the only thing deciding.",
    probeAs: CAROL_ID,
    sessionSetup: [`set realtime.topic = 'game:${GAME}'`],
    check: {
      testId: "S4.realtime.game-topic-write",
      family: "realtime channel authorization",
      controlId: "realtime.messages#policy:arc21_only_presence_may_be_written_by_a_client",
      description: "carol, who holds no seat at the game, publishes a state message onto that game's topic",
      // No RETURNING clause, for the reason given in S2.
      statement:
        "insert into realtime.messages (topic, extension, event, private, payload) " +
        "values ($1, 'broadcast', 'state', true, '{\"attest_wp1\":true}'::jsonb)",
      params: [`game:${GAME}`],
      expect: { kind: "error", sqlstate: "42501" },
    },
    stages: [{
      weakening: weakenPolicy("realtime.messages", "arc21_only_presence_may_be_written_by_a_client", "withcheck"),
      expectAfter: { kind: "rows", count: 1 },
      because: "with WITH CHECK replaced by true, any authenticated socket may publish to any topic",
    }],
    cleanup: [`delete from realtime.messages where topic = 'game:${GAME}'`],
  },
  {
    id: "S5",
    family: "server-only schema isolation",
    controlId: "private.game_state_private#rls_enabled",
    control:
      "private.game_state_private holds authoritative engine state including the undealt shoe and the dealer's " +
      "hole card. Two controls keep a client out: no client role holds USAGE on the `private` schema or any " +
      "privilege on the table, and row-level security is enabled with zero policies, which denies every " +
      "non-owner by default. This scenario tests that second claim empirically rather than taking it on trust.",
    probeAs: ALICE_ID,
    check: {
      testId: "S5.private-schema.game_state",
      family: "server-only schema isolation",
      controlId: "private.game_state_private#rls_enabled",
      description: "alice reads the authoritative engine state for the game she is seated at",
      statement: "select engine_state from private.game_state_private where game_session_id = $1",
      params: [GAME],
      expect: { kind: "no_data" },
    },
    stages: [
      {
        weakening: grantPrivilege(
          "grant usage on schema private to authenticated; grant select on private.game_state_private to authenticated",
          "revoke select on private.game_state_private from authenticated; revoke usage on schema private from authenticated",
          "grant USAGE on schema private and SELECT on the table to authenticated — removes the grant lock entirely",
        ),
        expectAfter: { kind: "rows", count: 0 },
        because:
          "the grant now permits the read, and the caller still gets nothing: row-level security is enabled " +
          "with no policy, and a policy set that admits no row denies every non-owner. This is the claim from " +
          "CP1 being executed rather than argued",
      },
      {
        weakening: addPermissivePolicy(
          "private.game_state_private", "attest_wp1_break_leak", "select", "authenticated",
        ),
        expectAfter: { kind: "rows", count: 1 },
        because: "with a permissive policy admitting every row, the last control is gone and the state leaks",
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Running a scenario
// ---------------------------------------------------------------------------

export interface ProbeResult {
  readonly identityLabel: string;
  readonly bypassesRls: boolean;
  readonly intact: string;
  readonly broken: string;
  /** The error text, where there was one. Two connections can be blind for
   *  different reasons and the reason matters. */
  readonly intactMessage: string | null;
  readonly brokenMessage: string | null;
  /** Whether this connection can tell an intact control from a broken one. */
  readonly discriminates: boolean;
}

export interface ScenarioResult {
  readonly id: string;
  readonly family: string;
  readonly controlId: string;
  readonly control: string;
  readonly probeIdentity: string;
  readonly statement: string;
  readonly weakenings: readonly string[];
  readonly records: readonly EvidenceRecord[];
  /** The scoped probe's outcome at each point: intact, after each stage, restored. */
  readonly timeline: readonly { readonly at: string; readonly outcome: string; readonly expected: string; readonly matched: boolean }[];
  readonly detected: boolean;
  readonly restored: boolean;
  readonly overPrivileged: readonly ProbeResult[];
}

/**
 * Run one probe and then undo anything it wrote.
 *
 * The cleanup runs after EVERY probe, not once at the end of the scenario. The
 * first version cleaned up only at the end, and it produced a false result:
 * the `admin(postgres)` probe inserted a row while the control was intact, and
 * the same probe against the broken control then failed on a duplicate key.
 * The scenario duly reported that the admin connection could tell intact from
 * broken -- which was true, and had nothing to do with the control. It was the
 * harness reading its own earlier write.
 */
async function runProbe(
  spec: Scenario, ctx: RecordContext, identity: IdentitySpec, suffix: string, admin: Session,
) {
  const session = await openIdentity(identity);
  try {
    for (const stmt of spec.sessionSetup ?? []) await session.query(stmt);
    return await record(ctx, session, spec.check, suffix);
  } finally {
    await session.close();
    for (const stmt of spec.cleanup ?? []) await admin.query(stmt).catch(() => {});
  }
}

async function runScenario(spec: Scenario, admin: Session, ctx: RecordContext): Promise<ScenarioResult> {
  const records: EvidenceRecord[] = [];
  const timeline: { at: string; outcome: string; expected: string; matched: boolean }[] = [];
  const applied: Weakening[] = [];

  const note = (at: string, r: EvidenceRecord, expect: Expectation) => {
    records.push(r);
    timeline.push({
      at, outcome: r.actual, expected: describeExpectation(expect),
      matched: r.actual === describeExpectation(expect) || r.outcome === "pass",
    });
  };

  try {
    // 1. intact
    const intact = await runProbe(spec, ctx, spec.probeAs, "intact", admin);
    note("control intact", intact, spec.check.expect);

    // over-privileged, intact
    const opIntact = new Map<string, EvidenceRecord>();
    for (const id of OVER_PRIVILEGED) {
      const r = await runProbe(spec, ctx, id, "intact", admin);
      records.push(r);
      opIntact.set(id.label, r);
    }

    // 2. weaken, stage by stage
    for (const [i, stage] of spec.stages.entries()) {
      await stage.weakening.apply(admin);
      applied.push(stage.weakening);
      const r = await runProbe(spec, ctx, spec.probeAs, `broken-${i + 1}`, admin);
      note(`after weakening ${i + 1}: ${stage.weakening.what}`, r, stage.expectAfter);
    }

    const brokenOutcome = timeline[timeline.length - 1]?.outcome ?? "";
    const intactOutcome = timeline[0]?.outcome ?? "";
    const detected = brokenOutcome !== intactOutcome;

    // 3. over-privileged, fully broken
    const overPrivileged: ProbeResult[] = [];
    for (const id of OVER_PRIVILEGED) {
      const r = await runProbe(spec, ctx, id, "broken", admin);
      records.push(r);
      const before = opIntact.get(id.label);
      overPrivileged.push({
        identityLabel: id.label,
        bypassesRls: r.identity.bypassesRls,
        intact: before?.actual ?? "?",
        broken: r.actual,
        intactMessage: before?.detail.message ?? null,
        brokenMessage: r.detail.message,
        discriminates: (before?.actual ?? "?") !== r.actual,
      });
    }

    // 4. restore, in reverse
    for (const w of [...applied].reverse()) await w.restore(admin);
    applied.length = 0;
    for (const stmt of spec.cleanup ?? []) await admin.query(stmt);

    const restoredRec = await runProbe(spec, ctx, spec.probeAs, "restored", admin);
    note("control restored", restoredRec, spec.check.expect);
    const restored = restoredRec.actual === intactOutcome;

    return {
      id: spec.id, family: spec.family, controlId: spec.controlId, control: spec.control,
      probeIdentity: spec.probeAs.label, statement: spec.check.statement,
      weakenings: spec.stages.map((s) => s.weakening.what),
      records, timeline, detected, restored, overPrivileged,
    };
  } finally {
    // A weakening left applied would contaminate every scenario after it.
    for (const w of [...applied].reverse()) {
      await w.restore(admin).catch((e) => {
        console.error(`  !! failed to restore "${w.what}": ${(e as Error).message}`);
      });
    }
    for (const stmt of spec.cleanup ?? []) await admin.query(stmt).catch(() => {});
  }
}

export { SCENARIOS, runScenario, OVER_PRIVILEGED };
export type { Scenario };
