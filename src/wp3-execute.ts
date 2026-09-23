/**
 * Attest — the WP3 runner.
 *
 * Takes the derived specs and produces one evidence record per Test ID. The
 * ordinary SQL and RPC probes go through `evidence.execute`, which already
 * separates a database refusal from a harness exception. The five composite
 * kinds need their own runners and each is here for a reason the generic path
 * cannot serve:
 *
 *   f7_mechanism   builds a scratch schema, table and TWO purpose-made roles,
 *                  demonstrates the owner exemption and BYPASSRLS separately,
 *                  then drops all of it. Arc21's own ownership is never touched.
 *   f7_roles       asserts the measured role attributes the mechanism rests on.
 *   f9             real concurrency: two connections, overlapping in time, with
 *                  the interleaving recorded so the overlap is evidenced rather
 *                  than claimed.
 *   socket         a real websocket against the local Realtime service.
 *   http           an expired JWT against PostgREST, which is the layer that
 *                  actually rejects it.
 *
 * Nothing here decides whether a control passed. The expectation comes from the
 * plan and the verdict from `judge()`.
 */
import { randomUUID } from "node:crypto";
import pg from "pg";
import type { Session } from "./db.ts";
import { adminSession, roleSession } from "./db.ts";
import { DB, LOGINS } from "./config.ts";
import type { Outcome } from "./evidence.ts";
import { execute, summarize } from "./evidence.ts";
import type { PlannedTest, Wp3Plan } from "./wp3-plan.ts";
import type { ExecSpec } from "./wp3-exec.ts";
import type { Caller } from "./wp3-exec.ts";
import { CallerPool, matches, claimsFor, runCatalogSpec } from "./wp3-exec.ts";
import type { Wp3EvidenceRecord, SystemUnderTest, HarnessVersion, ExecutedOperation } from "./wp3-evidence.ts";
import { judge } from "./wp3-evidence.ts";
import { intentFor, requiresIntent, type IntentStore } from "./author-intents.ts";
import { FIXTURES } from "../rubric/fixtures.ts";

const SCRATCH = {
  schema: "attest_wp3_scratch",
  table: "attest_wp3_scratch.demo",
  owner: "attest_wp3_scratch_owner",
  bypass: "attest_wp3_scratch_bypass",
} as const;

export interface RunContext {
  readonly runId: string;
  readonly sut: SystemUnderTest;
  readonly harness: HarnessVersion;
  readonly store: IntentStore | null;
}

/** One probe, one record. Never throws: a thrown error becomes not_measured. */
export async function runOne(
  ctx: RunContext,
  pool: CallerPool,
  t: PlannedTest,
  spec: ExecSpec,
): Promise<Wp3EvidenceRecord> {
  let outcome: Outcome;
  let executed: ExecutedOperation = { kind: spec.kind, statement: spec.statement, params: spec.params };
  let identity = null as Wp3EvidenceRecord["identity"];
  let claims: Record<string, unknown> | null = null;

  try {
    switch (spec.kind) {
      case "sql":
      case "rpc": {
        const s = await pool.get(spec.caller);
        identity = s.identity;
        claims = (s.identity.claims as Record<string, unknown> | null) ?? null;
        // Set-up statements on the same session (the realtime.topic GUC).
        // Issued separately so the probe is a single statement and can carry
        // bind parameters; a multi-statement query with parameters is rejected
        // with 42601, which used to satisfy a "no data" expectation.
        const pre: string[] = [];
        for (const ps of spec.preStatements ?? []) {
          await s.query(ps.sql, ps.params as unknown[]);
          pre.push(ps.sql);
        }
        outcome = await execute(s, spec.statement, spec.params);
        if (spec.functionCall) executed = { ...executed, functionCall: spec.functionCall };
        if (pre.length) executed = { ...executed, notes: [...(executed.notes ?? []), ...pre.map((x) => `first: ${x}`)] };
        break;
      }
      case "catalog":
      case "audit_absence": {
        const s = await pool.get({ kind: "admin", label: "catalog read (no control is exercised)" });
        identity = s.identity;
        const r = await runCatalogSpec(s, spec);
        outcome = r.outcome;
        executed = { ...executed, statement: spec.assertSql ?? spec.statement, notes: [r.detail] };
        break;
      }
      case "f7_roles": {
        const s = await pool.get({ kind: "admin", label: "catalog read (no control is exercised)" });
        identity = s.identity;
        const r = await runF7Roles(s);
        outcome = r.outcome;
        executed = { ...executed, statement: r.statement, notes: r.notes };
        break;
      }
      case "f7_mechanism": {
        const r = await runF7Mechanism(spec.variant!);
        outcome = r.outcome;
        executed = { ...executed, statement: r.statement, notes: r.notes };
        break;
      }
      case "f9": {
        const r = await runF9(spec.variant!, pool, spec.caller);
        outcome = r.outcome;
        executed = { ...executed, statement: r.statement, notes: r.notes };
        identity = r.identity ?? null;
        break;
      }
      case "socket": {
        const r = await runSocket(spec.variant!);
        outcome = r.outcome;
        executed = { ...executed, statement: r.statement, notes: r.notes };
        break;
      }
      case "http": {
        const r = await runExpiredJwt();
        outcome = r.outcome;
        executed = { ...executed, statement: r.statement, notes: r.notes };
        break;
      }
      default:
        throw new Error(`no runner for kind ${spec.kind}`);
    }
  } catch (err) {
    // A thrown harness error is never a result (D1.13, and evidence.ts).
    outcome = {
      executed: true, raised: true, rowCount: null, sqlstate: null,
      message: (err as Error).message, harnessError: true, sample: [],
    };
  }

  // A post-probe state check, where the row's expectation is about more than
  // the return value. ANDed with the probe's own assertion, so a probe that
  // returned the right thing while changing state it should not have touched
  // is not recorded as effective.
  let guard: { ok: boolean; detail: string } | null = null;
  if (spec.stateGuard && !outcome.harnessError) {
    try {
      const admin = await pool.get({ kind: "admin", label: "state guard (no control is exercised)" });
      const { rows } = await admin.query(spec.stateGuard.sql, spec.stateGuard.params as unknown[]);
      const r = rows[0] as { ok?: boolean; detail?: string } | undefined;
      guard = { ok: r?.ok === true, detail: r?.detail ?? "state guard returned no row" };
    } catch (err) {
      guard = { ok: false, detail: `state guard raised: ${(err as Error).message}` };
    }
    executed = {
      ...executed,
      notes: [...(executed.notes ?? []), `state guard — ${spec.stateGuard.describe}: ${guard.ok ? "held" : "FAILED"} (${guard.detail})`],
    };
  }

  const matched = matches(spec.expect, outcome, t) && (guard === null || guard.ok);
  const { observation, verdict, verdictReason } = judge(matched, outcome, t.verdictWhenPredicted);
  const { intent, provenance } = requiresIntent(t)
    ? intentFor(ctx.store, t.testId)
    : { intent: null, provenance: null };

  return {
    recordId: `${t.testId}@${ctx.runId}`,
    runId: ctx.runId,
    timestampUtc: new Date().toISOString(),
    testId: t.testId,
    family: t.family,
    resource: t.resource,
    controlId: t.control,
    tier: t.tier,
    polarity: t.polarity,
    operationPlanned: t.operation,
    expectedPlanned: t.expected,
    authorIntent: intent,
    intentProvenance: provenance,
    executed,
    identity,
    claims,
    expectation: spec.expect,
    actual: outcome,
    actualSummary: summarize(outcome),
    observation,
    verdict,
    verdictReason,
    sut: ctx.sut,
    harness: ctx.harness,
  };
}

// ---------------------------------------------------------------------------
// F7 — the mechanism layer
// ---------------------------------------------------------------------------

/**
 * Assert the role attributes the demonstration depends on.
 *
 * D3.15: `postgres` cannot stand in for the BYPASSRLS role, because it is
 * granted the scratch owner role with INHERIT in order to build the fixture,
 * and `check_enable_rls` counts inherited membership — so it would be treated
 * as the owner and the probe would confound the two exemptions again.
 */
async function runF7Roles(admin: Session): Promise<{ outcome: Outcome; statement: string; notes: string[] }> {
  const statement =
    `select rolname, rolsuper, rolbypassrls from pg_roles where rolname in ('postgres', '${SCRATCH.owner}', '${SCRATCH.bypass}')`;
  await ensureScratch(admin);
  const o = await execute(admin, statement);
  const rows = o.sample as { rolname: string; rolsuper: boolean; rolbypassrls: boolean }[];
  const owner = rows.find((r) => r.rolname === SCRATCH.owner);
  const byp = rows.find((r) => r.rolname === SCRATCH.bypass);
  const pgr = rows.find((r) => r.rolname === "postgres");
  const ownerRow = await execute(admin, `select pg_get_userbyid(relowner) as owner from pg_class where oid = '${SCRATCH.table}'::regclass`);
  const member = await execute(
    admin,
    `select pg_has_role('${SCRATCH.bypass}', '${SCRATCH.owner}', 'USAGE') as is_member`,
  );
  const ok =
    owner?.rolsuper === false && owner?.rolbypassrls === false &&
    byp?.rolsuper === false && byp?.rolbypassrls === true &&
    (ownerRow.sample[0] as { owner?: string } | undefined)?.owner === SCRATCH.owner &&
    (member.sample[0] as { is_member?: boolean } | undefined)?.is_member === false;
  await dropScratch(admin);
  return {
    // A runner-computed assertion: the measured attributes either are the ones
    // the mechanism depends on, or they are not. A row count cannot say that.
    outcome: synth(
      ok,
      `scratch owner NOSUPERUSER/NOBYPASSRLS and owns the table; scratch bypass role NOSUPERUSER/BYPASSRLS, ` +
        `not the owner and not a member of the owner role: ${ok}`,
    ),
    statement,
    notes: [
      `postgres: rolsuper=${pgr?.rolsuper}, rolbypassrls=${pgr?.rolbypassrls}`,
      `${SCRATCH.owner}: rolsuper=${owner?.rolsuper}, rolbypassrls=${owner?.rolbypassrls}, owns the scratch table=${(ownerRow.sample[0] as { owner?: string } | undefined)?.owner === SCRATCH.owner}`,
      `${SCRATCH.bypass}: rolsuper=${byp?.rolsuper}, rolbypassrls=${byp?.rolbypassrls}, member of the owner role=${(member.sample[0] as { is_member?: boolean } | undefined)?.is_member}`,
    ],
  };
}

/**
 * Preflight's use of the same measurement: build the scratch fixture, assert
 * the role properties the F7 mechanism rests on, and drop it — without writing
 * an evidence record. The roles are Attest-owned and live only inside this
 * call; Arc21's permanent roles are read, never altered.
 */
export async function checkScratchRoleProperties(admin: Session): Promise<{ ok: boolean; detail: string }> {
  try {
    const r = await runF7Roles(admin);
    const s0 = r.outcome.sample[0] as { ok?: boolean } | undefined;
    return { ok: s0?.ok === true, detail: r.notes.join("; ") };
  } catch (err) {
    await dropScratch(admin);
    return { ok: false, detail: `the scratch fixture could not be built: ${(err as Error).message}` };
  }
}

/**
 * Drop the scratch roles, granting them to the current role first.
 *
 * `DROP OWNED BY` needs membership: without the grant, postgres is refused with
 * "permission denied to drop objects" on a leftover role from an earlier run —
 * which is how this was found.
 */
function dropRolesSql(): string {
  return `do $$
    declare r text;
    begin
      foreach r in array array['${SCRATCH.owner}', '${SCRATCH.bypass}'] loop
        if exists (select 1 from pg_roles where rolname = r) then
          execute format('grant %I to %I', r, current_user);
          execute format('reassign owned by %I to %I', r, current_user);
          execute format('drop owned by %I', r);
          execute format('drop role %I', r);
        end if;
      end loop;
    end $$`;
}

async function ensureScratch(admin: Session): Promise<void> {
  await admin.query(`drop schema if exists ${SCRATCH.schema} cascade`);
  await admin.query(dropRolesSql());
  await admin.query(`create role ${SCRATCH.owner} nosuperuser nobypassrls nologin`);
  await admin.query(`create role ${SCRATCH.bypass} nosuperuser bypassrls nologin`);
  // postgres must hold BOTH scratch roles in order to build the fixture and to
  // `set role` into each of them. Holding the owner role is exactly why postgres
  // cannot itself serve as the BYPASSRLS demonstrator (D3.15): check_enable_rls
  // uses has_privs_of_role, so postgres counts as the owner.
  //
  // What D3.15 requires is that the BYPASSRLS role is not a member of the OWNER
  // role, and these grants do not make it one — postgres is a member of each,
  // which does not make them members of each other. The role-properties probe
  // asserts that separation live rather than trusting this comment.
  await admin.query(`grant ${SCRATCH.owner} to current_user`);
  await admin.query(`grant ${SCRATCH.bypass} to current_user`);
  await admin.query(`create schema ${SCRATCH.schema} authorization ${SCRATCH.owner}`);
  await admin.query(`create table ${SCRATCH.table} (id int primary key, admitted boolean not null)`);
  await admin.query(`alter table ${SCRATCH.table} owner to ${SCRATCH.owner}`);
  await admin.query(`insert into ${SCRATCH.table} values (1, true), (2, false)`);
  await admin.query(`alter table ${SCRATCH.table} enable row level security`);
  await admin.query(`create policy only_admitted on ${SCRATCH.table} for select using (admitted)`);
  await admin.query(`grant usage on schema ${SCRATCH.schema} to ${SCRATCH.bypass}`);
  await admin.query(`grant select on ${SCRATCH.table} to ${SCRATCH.bypass}`);
}

async function dropScratch(admin: Session): Promise<void> {
  await admin.query(`drop schema if exists ${SCRATCH.schema} cascade`).catch(() => {});
  await admin.query(dropRolesSql()).catch(() => {});
}

/**
 * The three-step demonstration, on a table Arc21 does not own.
 *
 * Each step opens its own admin connection, builds the fixture, runs one
 * statement under `set role`, and drops everything. Doing it per step keeps
 * each Test ID a self-contained probe rather than three statements sharing
 * hidden state.
 */
async function runF7Mechanism(variant: string): Promise<{ outcome: Outcome; statement: string; notes: string[] }> {
  const admin = await adminSession("f7-mechanism-setup");
  const notes: string[] = [];
  try {
    await ensureScratch(admin);
    let statement = `set role ${SCRATCH.owner}; select * from ${SCRATCH.table}`;
    if (variant === "forced_owner" || variant === "forced_bypass") {
      await admin.query(`alter table ${SCRATCH.table} force row level security`);
      notes.push("FORCE ROW LEVEL SECURITY enabled on the scratch table");
    } else {
      notes.push("RLS enabled, FORCE not enabled");
    }
    const asRole = variant === "forced_bypass" ? SCRATCH.bypass : SCRATCH.owner;
    statement = `set role ${asRole}; select * from ${SCRATCH.table}`;
    notes.push(`statement issued as ${asRole}`);

    await admin.query(`set role ${asRole}`);
    const o = await execute(admin, `select * from ${SCRATCH.table}`);
    await admin.query(`reset role`);
    notes.push(`rows returned: ${o.rowCount ?? 0} of 2 (the policy admits 1)`);
    // The plan's expectation for these rows is "2 rows" / "1 row"; `expect`
    // already carries it, so nothing is judged here.
    return { outcome: o, statement, notes };
  } finally {
    await admin.query(`reset role`).catch(() => {});
    await dropScratch(admin);
    await admin.close().catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// F9 — integrity, with real concurrency
// ---------------------------------------------------------------------------

const ALICE = FIXTURES.alice.value;

/**
 * Two genuinely concurrent connections.
 *
 * Both open, both begin, both call `apply_wallet_delta` on the same wallet, and
 * the timestamps of each phase are recorded so that "they overlapped" is
 * evidenced rather than asserted. Sequential statements on one connection would
 * test nothing about concurrency.
 */
async function runF9(
  variant: string,
  pool: CallerPool,
  caller: Caller,
): Promise<{ outcome: Outcome; statement: string; notes: string[]; identity?: Wp3EvidenceRecord["identity"] }> {
  if (variant === "ledger_update" || variant === "ledger_truncate") {
    // The client and server probes are SEPARATE Test IDs on purpose (D3.18 #3):
    // the client one shows an ordinary account is refused, the server one shows
    // the guard applies to the privileged path too, which is what makes the
    // ledger authoritative rather than merely client-protected. Forcing the
    // admin connection here collapsed that distinction and made both of them
    // the server probe.
    const s = await pool.get(caller);
    const sql = variant === "ledger_truncate"
      ? `truncate public.wallet_ledger`
      : `update public.wallet_ledger set delta = 1 where user_id = $1`;
    const o = await execute(s, sql, variant === "ledger_truncate" ? [] : [ALICE]);
    return {
      outcome: o, statement: sql,
      notes: [caller.kind === "admin" ? "issued on the privileged server connection" : `issued as ${caller.label}`],
      identity: s.identity,
    };
  }

  const admin = await adminSession("f9");
  try {
    if (variant === "idempotent") {
      const key = `attest-idem-${randomUUID()}`;
      const before = await one(admin, `select balance from public.wallets where user_id = $1`, [ALICE]);
      const call = `select public.apply_wallet_delta($1, $2, 'correction', $3, null, null, '{}'::jsonb)`;
      await execute(admin, call, [ALICE, 100, key]);
      await execute(admin, call, [ALICE, 100, key]);
      const after = await one(admin, `select balance from public.wallets where user_id = $1`, [ALICE]);
      const ledger = await one(admin, `select count(*)::int n from public.wallet_ledger where idempotency_key = $1`, [key]);
      const moved = Number(after?.balance ?? 0) - Number(before?.balance ?? 0);
      const ok = ledger?.n === 1 && moved === 100;
      return {
        outcome: synth(ok, `${ledger?.n} ledger row(s), balance moved by ${moved}`),
        statement: `${call}  -- issued twice with the same idempotency key ${key}`,
        notes: [
          `balance before ${before?.balance}, after ${after?.balance} (moved ${moved}, one delta is 100)`,
          `ledger rows carrying that idempotency key: ${ledger?.n} (a second credit would make this 2)`,
        ],
      };
    }

    if (variant === "overdebit") {
      const bal = await one(admin, `select balance from public.wallets where user_id = $1`, [ALICE]);
      const debit = -(Number(bal?.balance ?? 0) + 1_000_000);
      const call = `select public.apply_wallet_delta($1, $2, 'correction', $3, null, null, '{}'::jsonb)`;
      const o = await execute(admin, call, [ALICE, debit, `attest-over-${randomUUID()}`]);
      return {
        outcome: o,
        statement: call,
        notes: [`balance ${bal?.balance}, debit attempted ${debit}`, "the non-negative balance is a CHECK constraint, not application logic"],
      };
    }

    // concurrent
    const a = new pg.Client({ ...DB, ...LOGINS.admin });
    const b = new pg.Client({ ...DB, ...LOGINS.admin });
    await a.connect();
    await b.connect();
    const timeline: string[] = [];
    const mark = (s: string) => timeline.push(`${new Date().toISOString()} ${s}`);
    try {
      const before = await one(admin, `select balance from public.wallets where user_id = $1`, [ALICE]);
      const call = `select public.apply_wallet_delta($1, $2, 'correction', $3, null, null, '{}'::jsonb)`;

      await a.query("begin");
      await b.query("begin");
      mark("both transactions open — they overlap from here");

      // Both calls go in flight before either is awaited, so they genuinely
      // contend. apply_wallet_delta takes `select … for update` on the wallet
      // first, so exactly one wins the lock and the other BLOCKS inside the
      // function until the winner commits.
      //
      // The winner must therefore be committed while the loser is still
      // waiting. An earlier version awaited both calls before committing
      // either, which deadlocked: B could not return until A committed, and A
      // could not commit until B returned. The deadlock is the proof that the
      // lock is real, and the fix is to release it in the right order rather
      // than to serialise the two calls and stop testing concurrency.
      //
      // WHICH connection wins the lock is not ours to choose, and assuming it
      // was A hung the probe: B had won, so awaiting A first waited forever on
      // a lock B would not release until it was committed. The winner is
      // whichever call returns first.
      let winner: "a" | "b" | null = null;
      const pa = a.query(call, [ALICE, 250, `attest-conc-a-${randomUUID()}`]).then(() => { winner ??= "a"; mark("A's call returned"); });
      const pb = b.query(call, [ALICE, 375, `attest-conc-b-${randomUUID()}`]).then(() => { winner ??= "b"; mark("B's call returned"); });

      await Promise.race([pa, pb]);
      const [first, second] = winner === "b" ? [b, a] : [a, b];
      const [pFirst, pSecond] = winner === "b" ? [pb, pa] : [pa, pb];
      mark(`${winner ?? "a"} won the wallet lock; the other is still blocked inside apply_wallet_delta`);
      await pFirst;
      await first.query("commit");
      mark("winner committed — the blocked call can now proceed");
      await pSecond;
      await second.query("commit");
      mark("both committed");

      const after = await one(admin, `select balance from public.wallets where user_id = $1`, [ALICE]);
      const sum = await one(admin, `select coalesce(sum(delta),0)::bigint s from public.wallet_ledger where user_id = $1`, [ALICE]);
      const moved = Number(after?.balance ?? 0) - Number(before?.balance ?? 0);
      const reconciles = Number(after?.balance ?? 0) === Number(sum?.s ?? -1);
      const ok = moved === 625 && reconciles;
      return {
        outcome: synth(ok, `balance moved ${moved} (expected 625 = 250 + 375), reconciles with the ledger sum: ${reconciles}`),
        statement: `${call}  -- issued on two overlapping connections, deltas 250 and 375`,
        notes: [...timeline, `balance ${before?.balance} -> ${after?.balance}; ledger sum ${sum?.s}`],
      };
    } finally {
      await a.query("rollback").catch(() => {});
      await b.query("rollback").catch(() => {});
      await a.end().catch(() => {});
      await b.end().catch(() => {});
    }
  } finally {
    await admin.close().catch(() => {});
  }
}

async function one(s: Session, sql: string, params: unknown[] = []): Promise<Record<string, unknown> | null> {
  const { rows } = await s.query(sql, params);
  return (rows[0] as Record<string, unknown>) ?? null;
}

/** An outcome for a probe whose result is a computed assertion, not a raw statement. */
function synth(ok: boolean, message: string): Outcome {
  return { executed: true, raised: false, rowCount: ok ? 1 : 0, sqlstate: null, message, harnessError: false, sample: [{ ok, message }] };
}

// ---------------------------------------------------------------------------
// F8 — the real client path
// ---------------------------------------------------------------------------

/**
 * A real websocket against the local Realtime service.
 *
 * D3.7: the SQL tests prove the policies behave; only this proves the client
 * path reaches them. A client that subscribed non-privately would bypass the
 * policies entirely while every SQL test still passed, so the channel is
 * declared private here on purpose.
 */
async function runSocket(variant: string): Promise<{ outcome: Outcome; statement: string; notes: string[] }> {
  const { signJwt } = await import("./jwt.ts");
  const url = process.env.ATTEST_REALTIME_WS ?? "ws://127.0.0.1:54321/realtime/v1/websocket";
  const who = variant === "subscribe_ok" ? "alice" : "carol";
  const token = await signJwt(claimsFor(who as "alice" | "carol"));
  const topic = FIXTURES.gameTopic.value;
  const notes: string[] = [`topic ${topic}`, `as ${who}`, `private channel`];
  const statement =
    variant === "publish_denied"
      ? `websocket ${url} -> phx_join ${topic} (private) then broadcast 'state'`
      : `websocket ${url} -> phx_join ${topic} (private)`;

  try {
    const { joinRealtime } = await import("./realtime-client.ts");
    const r = await joinRealtime({ url, token, topic, publish: variant === "publish_denied" });
    notes.push(...r.notes);
    // "Refused, or accepted and delivers nothing" is the plan's expectation for
    // the two negatives; both are recorded as zero payloads reaching the client.
    const delivered = r.payloadsReceived;
    const ok = variant === "subscribe_ok" ? r.joined : !r.joined || delivered === 0;
    return { outcome: synth(ok, `joined=${r.joined}, payloads delivered=${delivered}`), statement, notes };
  } catch (err) {
    return {
      outcome: {
        executed: true, raised: true, rowCount: null, sqlstate: null,
        message: (err as Error).message, harnessError: true, sample: [],
      },
      statement,
      notes: [...notes, "the websocket probe itself failed; this is a harness error, not a refusal"],
    };
  }
}

// ---------------------------------------------------------------------------
// boundary — the expired session, at the layer that rejects it
// ---------------------------------------------------------------------------

async function runExpiredJwt(): Promise<{ outcome: Outcome; statement: string; notes: string[] }> {
  const { signJwt } = await import("./jwt.ts");
  const base = process.env.ATTEST_REST_URL ?? "http://127.0.0.1:54321/rest/v1";
  const token = await signJwt({ ...claimsFor("alice"), exp: Math.floor(Date.now() / 1000) - 3600 });
  const url = `${base}/profiles?select=id&limit=1`;
  const statement = `GET ${url} with an expired bearer token`;
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, apikey: token },
      signal: AbortSignal.timeout(8000),
    });
    const body = (await res.text()).slice(0, 200);
    return {
      outcome: synth(res.status === 401, `HTTP ${res.status}`),
      statement,
      notes: [
        `HTTP ${res.status}`,
        `body: ${body}`,
        "rejected at the API boundary; no statement reached PostgreSQL, so this is not an RLS result",
      ],
    };
  } catch (err) {
    return {
      outcome: {
        executed: true, raised: true, rowCount: null, sqlstate: null,
        message: (err as Error).message, harnessError: true, sample: [],
      },
      statement,
      notes: ["the HTTP probe itself failed; this is a harness error, not a 401"],
    };
  }
}

// ---------------------------------------------------------------------------
// orchestration
// ---------------------------------------------------------------------------

export interface RunSummary {
  readonly records: readonly Wp3EvidenceRecord[];
  readonly byVerdict: Readonly<Record<string, number>>;
  readonly harnessErrors: number;
}

/** Run a set of Test IDs. Callers pass the full 345 only after preflight passes. */
export async function runTests(
  ctx: RunContext,
  plan: Wp3Plan,
  specs: ReadonlyMap<string, ExecSpec>,
  testIds: readonly string[],
  log: (s: string) => void = () => {},
): Promise<RunSummary> {
  const byId = new Map(plan.tests.map((t) => [t.testId, t]));
  const pool = new CallerPool();
  const records: Wp3EvidenceRecord[] = [];
  try {
    for (const id of testIds) {
      const t = byId.get(id);
      const spec = specs.get(id);
      if (!t || !spec) throw new Error(`no plan row or spec for ${id}`);
      const rec = await runOne(ctx, pool, t, spec);
      records.push(rec);
      log(`  ${rec.observation === "as_predicted" ? "ok  " : rec.observation === "harness_error" ? "ERR " : "DIFF"} ${id.padEnd(42)} ${rec.actualSummary} -> ${rec.verdict}`);
    }
  } finally {
    await pool.closeAll();
  }
  const byVerdict: Record<string, number> = {};
  for (const r of records) byVerdict[r.verdict] = (byVerdict[r.verdict] ?? 0) + 1;
  return { records, byVerdict, harnessErrors: records.filter((r) => r.observation === "harness_error").length };
}
