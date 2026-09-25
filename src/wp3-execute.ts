/**
 * Attest — the WP3 runner.
 *
 * One approved Test ID → one probe → one evidence record, on a verified
 * baseline, with the probe's own premises checked immediately before it, its
 * state guards taken as admin around it, and every claim of its approved
 * expectation judged separately (wp3-evaluate.ts).
 *
 * Isolation (R7, wp3-isolation.ts): the disposable database is rebuilt from
 * Arc21's migrations and re-verified before the first probe and before any
 * probe that follows a state change. A probe changed state if it is statically
 * classified as writing when its control holds, if it applied a probe-scoped
 * setup, or if the whole-database digest moved. Every probe gets a fresh
 * connection, so no session setting (`realtime.topic`, claims) survives into
 * another probe.
 *
 * The composite kinds keep their own runners, each here for a reason the
 * generic path cannot serve:
 *
 *   f7_mechanism   a scratch schema, table and TWO purpose-made roles; the
 *                  owner exemption and BYPASSRLS demonstrated separately, the
 *                  role properties read back live inside the demonstration
 *   f7_roles       the measured attributes the mechanism rests on
 *   f9             real concurrency on two connections, idempotency, over-debit
 *   socket         a real websocket, an authorised observer, and a
 *                  server-originated broadcast so silence means something
 *   http           an expired JWT against PostgREST, which is the layer that
 *                  rejects it, beside a fresh-token reference request
 *
 * Nothing here decides whether a control passed. The runner observes; the
 * evaluator judges against the approved text.
 */
import { randomUUID } from "node:crypto";
import type { Session, SessionIdentity } from "./db.ts";
import { adminSession, roleSession } from "./db.ts";
import type { Outcome } from "./evidence.ts";
import { execute, summarize } from "./evidence.ts";
import type { PlannedTest, Wp3Plan } from "./wp3-plan.ts";
import type { ExecSpec, Caller } from "./wp3-exec.ts";
import { claimsFor, uidOf, type SubjectName } from "./wp3-exec.ts";
import { classify, type Mechanism } from "./wp3-outcome.ts";
import { bindingFor, type Binding, type Guard, type Snapshot } from "./wp3-bindings.ts";
import { spansFor, type Span } from "./wp3-claims.ts";
import { judgeProbe, type CheckResult, type Observed } from "./wp3-evaluate.ts";
import type { Wp3EvidenceRecord, SystemUnderTest, HarnessVersion, ExecutedOperation, GuardRecord } from "./wp3-evidence.ts";
import { WP3_EVIDENCE_SCHEMA_VERSION } from "./wp3-evidence.ts";
import { requiresIntent, type IntentStore } from "./author-intents.ts";
import { FIXTURES } from "../rubric/fixtures.ts";
import { implFor } from "./seed-extensions.ts";
import {
  rebuildBaseline, stateDigest, stateRelations, diffDigests, catalogDigest, accountRowsSnapshot, diffAccountRows,
  type BaselineEpoch, type Canonical, REST_BASE, Arc21ChangedError,
} from "./wp3-isolation.ts";
import type { Arc21SourceState } from "./arc21-guard.ts";
import { contradictionDisposition } from "./wp3-contradictions.ts";

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
  readonly arc21Pre: Arc21SourceState;
  readonly expectedSchema: string;
  readonly log: (s: string) => void;
  /** WP4 drift runs (D3.56): the baseline fixtures that apply to a historical schema. Absent: all. */
  readonly extensionFilter?: ReadonlySet<string>;
}

/** What the executor needs per Test ID, computed once. */
export interface PreparedProbe {
  readonly t: PlannedTest;
  readonly spec: ExecSpec;
  readonly binding: Binding;
  readonly spans: readonly Span[];
}

/** Bind every row; throws naming the first row that cannot be bound. */
export function prepareAll(plan: Wp3Plan, specs: ReadonlyMap<string, ExecSpec>): Map<string, PreparedProbe> {
  const stateToKey = new Map(plan.seedExtensions.map((e) => [e.state, { key: e.key, scope: e.scope }]));
  const out = new Map<string, PreparedProbe>();
  for (const t of plan.tests) {
    const spec = specs.get(t.testId);
    if (!spec) throw new Error(`${t.testId}: no derived spec`);
    const sp = spansFor(t.expected);
    if ("error" in sp) throw new Error(`${t.testId}: ${sp.error}`);
    out.set(t.testId, { t, spec, binding: bindingFor(t, spec, stateToKey), spans: sp.spans });
  }
  return out;
}

const harnessOutcome = (message: string): Outcome => ({
  executed: true, raised: true, rowCount: null, sqlstate: null, message, harnessError: true, sample: [],
});

function synth(ok: boolean, message: string, rows: Record<string, unknown>[] = []): Outcome {
  return { executed: true, raised: false, rowCount: rows.length, sqlstate: null, message, harnessError: false, sample: rows.slice(0, 3), rows, columns: rows[0] ? Object.keys(rows[0]) : [] };
}

async function one(s: Session, sql: string, params: readonly unknown[] = []): Promise<Record<string, unknown> | null> {
  const { rows } = await s.query(sql, params as unknown[]);
  return (rows[0] as Record<string, unknown>) ?? null;
}

async function runCheck(admin: Session, c: { id: string; describe: string; sql: string; params: readonly unknown[] }): Promise<CheckResult> {
  try {
    const r = await one(admin, c.sql, c.params);
    return { id: c.id, describe: c.describe, ok: r?.ok === true, detail: String(r?.detail ?? "the check returned no row") };
  } catch (err) {
    return { id: c.id, describe: c.describe, ok: false, detail: `the check raised: ${(err as Error).message}` };
  }
}

/** Every row naming any of `ids`, as sorted JSON [relation, key, row]. auth.users by id and md5 only. */
async function accountRowsJson(admin: Session, ids: readonly string[]): Promise<string> {
  const rels = await stateRelations(admin);
  const inc = ids.map((u) => `x::text like '%${u}%'`).join(" or ");
  const parts = rels.map((r) => r === "auth.users"
    ? `select '${r}' as rel, x.id::text as k, jsonb_build_object('id', x.id, 'md5', md5(x::text)) as j from ${r} x where ${inc}`
    : `select '${r}' as rel, coalesce(to_jsonb(x)->>'id', md5(x::text)) as k, to_jsonb(x) as j from ${r} x where ${inc}`);
  const { rows } = await admin.query(`select rel, k, j from (${parts.join("\nunion all\n")}) y order by rel, k`);
  return JSON.stringify(rows.map((r) => [String(r.rel), String(r.k), r.j]));
}

/**
 * Digests of the state tables the foreign-key graph does not connect to
 * auth.users: descendants are found by walking pg_constraint from auth.users
 * (a table referencing a descendant is one), and everything else is digested.
 */
export async function unrelatedTablesDigest(admin: Session): Promise<string> {
  const rels = await stateRelations(admin);
  const { rows } = await admin.query(`
    with recursive d(oid) as (
      select 'auth.users'::regclass::oid
      union
      select c.conrelid from pg_constraint c join d on c.confrelid = d.oid where c.contype = 'f'
    )
    select (quote_ident(n.nspname) || '.' || quote_ident(cl.relname)) as rel, n.nspname || '.' || cl.relname as plain
      from d join pg_class cl on cl.oid = d.oid join pg_namespace n on n.oid = cl.relnamespace`);
  const reached = new Set(rows.map((r) => String(r.plain)));
  const unrelated = rels.filter((r) => !reached.has(r));
  const digest = unrelated.length ? await stateDigest(admin, unrelated) : {};
  // Only the tables: sequences are advanced by refused writes and are not state here.
  return JSON.stringify(Object.fromEntries(Object.entries(digest).filter(([k]) => !k.startsWith("seq:")).sort()));
}

async function snapshot(admin: Session, s: Snapshot): Promise<string> {
  switch (s.kind) {
    case "sql": return String((await one(admin, s.sql, s.params))?.snap ?? "");
    case "account_rows": return accountRowsSnapshot(admin, s.include, s.exclude);
    case "account_rows_json": return accountRowsJson(admin, s.include);
    case "unrelated_tables": return unrelatedTablesDigest(admin);
    case "tables": return JSON.stringify(await stateDigest(admin, s.tables));
    case "database": return JSON.stringify(await stateDigest(admin));
    case "catalog": return catalogDigest(admin);
  }
}

function describeSnapDiff(s: Snapshot, before: string, after: string): string {
  if (before === after) return s.kind === "account_rows" ? `unchanged (${(JSON.parse(before || "[]") as unknown[]).length} row(s) compared)` : "unchanged";
  if (s.kind === "account_rows") {
    const { removed, added } = diffAccountRows(before, after);
    const byRel = (ps: [string, string][]) => [...ps.reduce((m, [r]) => m.set(r, (m.get(r) ?? 0) + 1), new Map<string, number>())].map(([r, n]) => `${r} ${n}`).join(", ");
    const show = (ps: [string, string][]) => ps.slice(0, 12).map(([r, t]) => `${r} ${t.slice(0, 220)}`).join(" ‖ ");
    return `changed — ${removed.length} row(s) gone or altered away (${byRel(removed) || "none"}), ${added.length} row(s) new or altered to (${byRel(added) || "none"}). ` +
      `BEFORE: ${show(removed) || "—"}. AFTER: ${show(added) || "—"}`;
  }
  if (s.kind === "account_rows_json") {
    const a = JSON.parse(before || "[]") as [string, string, unknown][];
    const b = JSON.parse(after || "[]") as [string, string, unknown][];
    const key = (p: [string, string, unknown]) => `${p[0]} ${p[1]}`;
    const ka = new Map(a.map((p) => [key(p), JSON.stringify(p[2])])), kb = new Map(b.map((p) => [key(p), JSON.stringify(p[2])]));
    const gone = [...ka.keys()].filter((k) => !kb.has(k)), added = [...kb.keys()].filter((k) => !ka.has(k));
    const altered = [...ka.keys()].filter((k) => kb.has(k) && kb.get(k) !== ka.get(k));
    return `changed — ${gone.length} row(s) gone, ${added.length} new, ${altered.length} altered: ${[...altered, ...gone, ...added].slice(0, 12).join(", ")}`;
  }
  if (s.kind === "database" || s.kind === "tables" || s.kind === "unrelated_tables") {
    try {
      const moved = diffDigests(JSON.parse(before), JSON.parse(after));
      return `changed: ${moved.join(", ")}`;
    } catch { /* fall through */ }
  }
  return `changed: ${before.slice(0, 80)} -> ${after.slice(0, 80)}`;
}

/** Open the probe's session: a fresh connection, exactly the structured identity. */
async function openCaller(c: Caller, claims: Record<string, unknown> | null): Promise<Session> {
  if (c.kind === "admin") return adminSession(c.label);
  if (c.kind === "external") throw new Error(`caller "${c.label}" manages its own connection`);
  return roleSession({ role: c.role, claims, label: c.label });
}

function claimsForCaller(c: Caller): Record<string, unknown> | null {
  return c.kind === "role" && c.subject ? claimsFor(c.subject) : null;
}

export interface ProbeResult {
  readonly record: Wp3EvidenceRecord;
  readonly dirtyBecause: string | null;
}

/** Run one probe on the current baseline. Never throws: a thrown error becomes a harness error. */
export async function runOne(
  ctx: RunContext,
  p: PreparedProbe,
  env: { baseline: BaselineEpoch; rebuiltBefore: boolean; triggerFns: ReadonlySet<string> },
): Promise<ProbeResult> {
  const { t, spec, binding: b, spans } = p;
  const admin = await adminSession("probe-admin");
  let outcome: Outcome = harnessOutcome("the probe did not run");
  let executed: ExecutedOperation = {
    kind: spec.kind, statement: spec.statement, params: spec.params, functionCall: spec.functionCall,
    preStatements: spec.preStatements, bindingNotes: spec.bindingNotes,
  };
  let identity: SessionIdentity | null = null;
  let claims = claimsForCaller(spec.caller);
  let setupRecord: Wp3EvidenceRecord["setup"] = null;
  const premises: CheckResult[] = [];
  const catalog: Record<string, CheckResult> = {};
  const guardRecords: GuardRecord[] = [];
  const guardResults: Record<string, CheckResult> = {};
  const results: Record<string, CheckResult> = {};
  let reference: Wp3EvidenceRecord["reference"] = null;
  let reachability: CheckResult | null = null;
  let runnerClaims: RunnerClaims | null = null;
  let anonGrant: Observed["anonGrant"] = null;
  let columnPrivilege: Observed["columnPrivilege"] = null;
  let viewColumns: string[] | undefined;
  let changed: string[] = [];
  let mechanism: Mechanism = classify(outcome, env.triggerFns);

  try {
    // --- probe-scoped setup (D3.38). The deleted-user boundary signs dave's
    // token BEFORE his account is deleted, and uses exactly its claims after.
    if (b.setupKey) {
      const impl = implFor(b.setupKey);
      if (!impl) throw new Error(`no implementation for probe-scoped setup ${b.setupKey}`);
      const statements: string[] = [];
      let before: CheckResult | null = null;
      // Admin statements first, then the client step (D3.54: a setup may have both).
      for (const sql of impl.statements) { await admin.query(sql); statements.push(sql.replace(/\s+/g, " ").trim()); }
      if (impl.asClient) {
        const { signJwt } = await import("./jwt.ts");
        const token = await signJwt(claimsFor(impl.asClient.subject));
        claims = JSON.parse(Buffer.from(token.split(".")[1]!, "base64url").toString("utf8")) as Record<string, unknown>;
        const s = await roleSession({ role: "authenticated", claims, label: `setup:${impl.asClient.subject}` });
        try {
          if (impl.asClient.before) {
            // Read AS the client while the account is live: the access the
            // later probe asks about existed, so a refusal then is the deletion's doing.
            before = await runCheck(s, { id: "setup-before", describe: impl.asClient.before.describe, sql: impl.asClient.before.sql, params: [] });
            statements.push(`as ${impl.asClient.subject}, before: ${impl.asClient.before.describe} — ${before.ok ? "holds" : "DOES NOT HOLD"}: ${before.detail}`);
          }
          if (!before || before.ok) {
            await s.query(impl.asClient.statement);
            statements.push(`as ${impl.asClient.subject} (claims of a token signed before the deletion): ${impl.asClient.statement}`);
          }
        } finally {
          await s.close();
        }
      }
      const v = await runCheck(admin, { id: "setup", describe: b.setupKey, sql: impl.verify, params: [] });
      const beforeOk = !before || before.ok;
      setupRecord = { key: b.setupKey, statements, verified: v.ok && beforeOk, detail: beforeOk ? v.detail : `${before!.describe}: ${before!.detail}; ${v.detail}` };
    }

    // --- premises, catalog facts, and everything read BEFORE the probe
    for (const c of b.premises) premises.push(await runCheck(admin, c));
    for (const [k, c] of Object.entries(b.catalog)) catalog[k] = await runCheck(admin, c);
    const guardBefore: Record<string, string> = {};
    for (const [name, g] of Object.entries(b.guards)) if (g.snap) guardBefore[name] = await snapshot(admin, g.snap);
    const resultBefore: Record<string, Record<string, unknown>[]> = {};
    for (const [name, r] of Object.entries(b.results)) {
      if (r.adminBefore) resultBefore[name] = (await admin.query(r.adminBefore.sql, r.adminBefore.params as unknown[])).rows as Record<string, unknown>[];
    }
    if (/#anon-reach$/.test(t.control) && spec.relation) {
      const r = await one(admin, `select has_table_privilege('anon', $1::regclass, 'SELECT') as h, (select count(*)::int from ${spec.relation}) as n`, [spec.relation]);
      anonGrant = { holdsSelect: r?.h === true, rows: Number(r?.n ?? 0) };
    }
    if (/#colgrant:/.test(t.control) && t.polarity === "negative" && spec.relation) {
      const priv = /colgrant:(SELECT|UPDATE)/.exec(t.control)![1]!;
      const col = priv === "UPDATE" ? /set\s+"?([a-z_]+)"?\s*=/.exec(spec.statement)?.[1] : /^select\s+([a-z_]+)\s+from/i.exec(spec.statement)?.[1];
      if (col) {
        const r = await one(admin, `select has_column_privilege('authenticated', $1::regclass, $2, $3) as h`, [spec.relation, col, priv]);
        columnPrivilege = { column: col, held: r?.h === true };
      }
    }
    if (spans.some((s) => s.eval === "result:columns_of:daily_challenges_public")) {
      viewColumns = ((await admin.query(`select attname::text as c from pg_attribute where attrelid = 'public.daily_challenges_public'::regclass and attnum > 0 and not attisdropped order by attnum`)).rows).map((r) => String(r.c));
    }
    const preDigest = await stateDigest(admin);

    // --- the probe
    switch (spec.kind) {
      case "sql":
      case "rpc": {
        const s = await openCaller(spec.caller, claims);
        identity = s.identity;
        try {
          for (const ps of spec.preStatements ?? []) await s.query(ps.sql, ps.params as unknown[]);
          outcome = await execute(s, spec.statement, spec.params);
        } finally {
          await s.close();
        }
        break;
      }
      case "catalog":
      case "audit_absence": {
        identity = admin.identity;
        outcome = await execute(admin, spec.assertSql ?? "select false as ok");
        executed = { ...executed, statement: spec.assertSql ?? spec.statement };
        break;
      }
      case "f7_roles": {
        identity = admin.identity;
        const r = await runF7Roles(admin);
        outcome = r.outcome; runnerClaims = r.claims;
        executed = { ...executed, statement: r.statement, notes: r.notes };
        break;
      }
      case "f7_mechanism": {
        const r = await runF7Mechanism(spec.variant!);
        outcome = r.outcome; runnerClaims = r.claims;
        executed = { ...executed, statement: r.statement, notes: r.notes };
        break;
      }
      case "f9": {
        const r = await runF9(spec.variant!, spec.caller, spec.statement);
        outcome = r.outcome; runnerClaims = r.claims; identity = r.identity ?? null;
        executed = { ...executed, statement: r.statement, notes: r.notes };
        break;
      }
      case "socket": {
        const r = await runSocket(spec.variant!, admin, spec.caller);
        outcome = r.outcome; runnerClaims = r.claims;
        premises.push(...r.premises);
        executed = { ...executed, statement: r.statement, notes: r.notes };
        break;
      }
      case "http": {
        const r = await runExpiredJwt();
        outcome = r.outcome; runnerClaims = r.claims;
        executed = { ...executed, statement: r.statement, notes: r.notes };
        break;
      }
    }
    mechanism = classify(outcome, env.triggerFns);

    // --- after: guards, result checks, reference, reachability
    for (const [name, g] of Object.entries(b.guards) as [string, Guard][]) {
      let ok = true;
      const parts: string[] = [];
      let before: string | null = null, after: string | null = null;
      if (g.snap) {
        before = guardBefore[name] ?? null;
        after = await snapshot(admin, g.snap);
        if (g.judge) {
          const j = g.judge(before ?? "", after);
          ok = ok && j.ok;
          parts.push(j.detail);
        } else {
          const same = before === after;
          ok = ok && same;
          parts.push(describeSnapDiff(g.snap, before ?? "", after));
        }
      }
      if (g.after) {
        const r = await runCheck(admin, { id: name, describe: g.describe, sql: g.after.sql, params: g.after.params });
        ok = ok && r.ok;
        parts.push(r.detail);
      }
      guardResults[name] = { id: name, describe: g.describe, ok, detail: `${g.describe}: ${parts.join("; ")}` };
      guardRecords.push({ name, describe: g.describe, before: before && before.length > 400 ? `${before.slice(0, 64)}… (${before.length} chars)` : before, after: after && after.length > 400 ? `${after.slice(0, 64)}… (${after.length} chars)` : after, ok, detail: guardResults[name]!.detail });
    }
    for (const [name, r] of Object.entries(b.results)) {
      const afterRows = r.admin ? ((await admin.query(r.admin.sql, r.admin.params as unknown[])).rows as Record<string, unknown>[]) : [];
      const j = r.judge(outcome, afterRows, resultBefore[name] ?? []);
      results[name] = { id: name, describe: r.describe, ok: j.ok, detail: j.detail };
    }
    if (b.reference && (spec.kind === "sql" || spec.kind === "rpc")) {
      const s = await openCaller(spec.caller, claims);
      try {
        const ro = await execute(s, b.reference.statement, b.reference.params);
        reference = { describe: b.reference.describe, statement: b.reference.statement, params: b.reference.params, outcome: ro, mechanism: classify(ro, env.triggerFns) };
      } finally {
        await s.close();
      }
    }
    if (b.reachability) reachability = await runCheck(admin, b.reachability);

    const postDigest = await stateDigest(admin);
    changed = diffDigests(preDigest, postDigest);
  } catch (err) {
    outcome = harnessOutcome((err as Error).message);
    mechanism = classify(outcome, env.triggerFns);
  } finally {
    await admin.close().catch(() => {});
  }

  // Identity premise: the session the probe ran on is the one the row names.
  // A websocket has no SQL session; its runner reads the identity back from
  // the token it presented and supplies the premise itself.
  const idPremise = spec.kind === "socket" ? null : identityPremise(spec.caller, identity);
  if (idPremise) premises.unshift(idPremise);
  if (setupRecord && !setupRecord.verified) premises.unshift({ id: "setup", describe: `probe-scoped setup ${setupRecord.key}`, ok: false, detail: setupRecord.detail });

  const contradiction = contradictionDisposition(t.testId);
  const ob: Observed = {
    outcome, mechanism, premises, catalog, guards: guardResults, results,
    reference: reference ? { outcome: reference.outcome, mechanism: reference.mechanism } : null,
    reachability, runnerClaims: runnerClaims ?? undefined, anonGrant, columnPrivilege, viewColumns,
    sessionAuthUid: identity?.authUid ?? null,
    contradiction,
  };
  const j = judgeProbe(t, spec, b, spans, ob);
  const intent = requiresIntent(t) ? ctx.store?.intents.find((e) => e.testId === t.testId) ?? null : null;

  const dirtyBecause = dirtyReason({ writesWhenControlHolds: spec.writesWhenControlHolds, setupKey: b.setupKey, changed, harnessError: outcome.harnessError });

  const record: Wp3EvidenceRecord = {
    schema: WP3_EVIDENCE_SCHEMA_VERSION,
    recordId: `${t.testId}@${ctx.runId}`,
    runId: ctx.runId,
    timestampUtc: new Date().toISOString(),
    testId: t.testId, family: t.family, resource: t.resource, controlId: t.control, tier: t.tier, polarity: t.polarity,
    identityPlanned: t.identity, operationPlanned: t.operation, expectedPlanned: t.expected, fixturePlanned: t.fixture,
    verdictWhenPredicted: t.verdictWhenPredicted,
    authorIntent: intent?.intent ?? null,
    intentProvenance: intent?.provenance ?? null,
    intentReviewStatus: intent?.reviewStatus ?? null,
    executed, identity, claims, setup: setupRecord, premises, catalogFacts: Object.values(catalog), guards: guardRecords,
    reference, actual: outcome, mechanism, actualSummary: summarize(outcome), runnerClaims,
    claimResults: j.claims, observation: j.observation, verdict: j.verdict, verdictReason: j.verdictReason,
    contradiction: ob.contradiction ?? null,
    isolation: {
      epoch: env.baseline.epoch, rebuiltBefore: env.rebuiltBefore, setupApplied: b.setupKey,
      changedRelations: changed, rebuildAfterBecause: dirtyBecause, freshSession: true,
    },
    sut: ctx.sut, harness: ctx.harness,
  };
  return { record, dirtyBecause };
}

/**
 * Why the next probe needs a rebuilt baseline, or null when this one provably
 * left the state as it found it. Static classification OR a setup OR a
 * measured change OR a harness error: any one is enough (R7).
 */
export function dirtyReason(p: { writesWhenControlHolds: boolean; setupKey: string | null | undefined; changed: readonly string[]; harnessError: boolean }): string | null {
  return p.writesWhenControlHolds ? "classified as writing when its control holds"
    : p.setupKey ? `probe-scoped setup ${p.setupKey}`
    : p.changed.length ? `the probe changed ${p.changed.join(", ")}`
    : p.harnessError ? "a harness error; state is not trusted"
    : null;
}

function identityPremise(c: Caller, id: SessionIdentity | null): CheckResult | null {
  if (c.kind !== "role") return null;
  if (!id) return { id: "identity", describe: "the probe's session identity", ok: false, detail: "no session identity was read back" };
  const wantUid = c.subject ? uidOf(c.subject) : null;
  const ok = id.currentUser === c.role && (id.authUid ?? null) === wantUid && !id.bypassesRls && !id.isSuperuser;
  return {
    id: "identity", describe: `the session is ${c.label}`, ok,
    detail: `current_user=${id.currentUser}, auth.uid()=${id.authUid ?? "NULL"}, bypassrls=${id.bypassesRls}, superuser=${id.isSuperuser}` +
      (ok ? "" : ` — expected ${c.role} with auth.uid() ${wantUid ?? "NULL"}`),
  };
}

// ---------------------------------------------------------------------------
// F7 — the mechanism layer
// ---------------------------------------------------------------------------

async function runF7Roles(admin: Session): Promise<{ outcome: Outcome; statement: string; notes: string[]; claims: Record<string, { ok: boolean; detail: string }> }> {
  const statement =
    `select rolname, rolsuper, rolbypassrls from pg_roles where rolname in ('postgres', '${SCRATCH.owner}', '${SCRATCH.bypass}')`;
  await ensureScratch(admin);
  try {
    const o = await execute(admin, statement);
    const rows = (o.rows ?? []) as unknown as readonly RoleRow[];
    const relOwner = String((await one(admin, `select pg_get_userbyid(relowner) as owner from pg_class where oid = '${SCRATCH.table}'::regclass`))?.owner);
    const member = (await one(admin, `select pg_has_role('${SCRATCH.bypass}', '${SCRATCH.owner}', 'USAGE') as m`))?.m === true;
    const claims = f7RoleClaims(rows, relOwner, member);
    return { outcome: o, statement, notes: Object.values(claims).map((c) => c.detail), claims };
  } finally {
    await dropScratch(admin);
  }
}

export interface RoleRow { readonly rolname: string; readonly rolsuper: boolean; readonly rolbypassrls: boolean }

/**
 * The properties F7's mechanism rests on, judged from what was read. Pure, so
 * prove-gates can hand it a wrong property and require it to refuse; the
 * runner and preflight both use exactly this.
 */
export function f7RoleClaims(rows: readonly RoleRow[], relOwner: string, bypassIsMemberOfOwner: boolean): Record<string, { ok: boolean; detail: string }> {
  const owner = rows.find((r) => r.rolname === SCRATCH.owner);
  const byp = rows.find((r) => r.rolname === SCRATCH.bypass);
  const pgr = rows.find((r) => r.rolname === "postgres");
  return {
    postgres_props: { ok: pgr?.rolsuper === false && pgr?.rolbypassrls === true, detail: `postgres: rolsuper=${pgr?.rolsuper}, rolbypassrls=${pgr?.rolbypassrls}` },
    owner_props: { ok: owner?.rolsuper === false && owner?.rolbypassrls === false, detail: `${SCRATCH.owner}: rolsuper=${owner?.rolsuper}, rolbypassrls=${owner?.rolbypassrls}` },
    owner_owns: { ok: relOwner === SCRATCH.owner, detail: `relowner of the scratch table: ${relOwner}` },
    bypass_props: { ok: byp?.rolsuper === false && byp?.rolbypassrls === true, detail: `${SCRATCH.bypass}: rolsuper=${byp?.rolsuper}, rolbypassrls=${byp?.rolbypassrls}` },
    bypass_not_owner: { ok: relOwner !== SCRATCH.bypass, detail: `relowner ${relOwner} is not ${SCRATCH.bypass}` },
    bypass_not_member: { ok: !bypassIsMemberOfOwner, detail: `${SCRATCH.bypass} member of ${SCRATCH.owner}: ${bypassIsMemberOfOwner}` },
  };
}

export const F7_SCRATCH = SCRATCH;

/** Preflight's use of the same measurement, without an evidence record. */
export async function checkScratchRoleProperties(admin: Session): Promise<{ ok: boolean; detail: string }> {
  try {
    const r = await runF7Roles(admin);
    const ok = Object.values(r.claims).every((c) => c.ok);
    return { ok, detail: r.notes.join("; ") };
  } catch (err) {
    await dropScratch(admin);
    return { ok: false, detail: `the scratch fixture could not be built: ${(err as Error).message}` };
  }
}

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
  // postgres holds both scratch roles so it can build the fixture and `set
  // role` into each; that does not make them members of each other, and the
  // role-properties probe asserts the separation live (D3.15).
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
  await admin.query(`reset role`).catch(() => {});
  await admin.query(`drop schema if exists ${SCRATCH.schema} cascade`).catch(() => {});
  await admin.query(dropRolesSql()).catch(() => {});
}

/**
 * One step of the three-step demonstration, on a table Arc21 does not own.
 * The role properties are read back INSIDE the switched role, so "the owner is
 * not subject to the policy" is observed, not inferred.
 */
async function runF7Mechanism(variant: string): Promise<{ outcome: Outcome; statement: string; notes: string[]; claims: Record<string, { ok: boolean; detail: string }> }> {
  const admin = await adminSession("f7-mechanism-setup");
  const notes: string[] = [];
  try {
    await ensureScratch(admin);
    const forced = variant === "forced_owner" || variant === "forced_bypass";
    if (forced) {
      await admin.query(`alter table ${SCRATCH.table} force row level security`);
      notes.push("FORCE ROW LEVEL SECURITY enabled on the scratch table");
    } else {
      notes.push("RLS enabled, FORCE not enabled");
    }
    const asRole = variant === "forced_bypass" ? SCRATCH.bypass : SCRATCH.owner;
    const statement = `set role ${asRole}; select * from ${SCRATCH.table}`;
    await admin.query(`set role ${asRole}`);
    const me = await one(admin, `select current_user::text as u,
                                        (select rolbypassrls from pg_roles where rolname = current_user) as byp,
                                        (select pg_get_userbyid(relowner) = current_user from pg_class where oid = '${SCRATCH.table}'::regclass) as owns,
                                        (select relforcerowsecurity from pg_class where oid = '${SCRATCH.table}'::regclass) as forced`);
    const o = await execute(admin, `select * from ${SCRATCH.table}`);
    await admin.query(`reset role`);
    const n = o.rows?.length ?? 0;
    notes.push(`as ${String(me?.u)}: bypassrls=${String(me?.byp)}, owns the table=${String(me?.owns)}, FORCE=${String(me?.forced)}; rows returned ${n} of 2 (the policy admits 1)`);
    const claims: Record<string, { ok: boolean; detail: string }> = {
      "rows=2": { ok: n === 2, detail: `${n} of 2 rows` },
      "rows=1": { ok: n === 1, detail: `${n} of 2 rows` },
      ran_as_owner_without_bypass: { ok: me?.u === SCRATCH.owner && me?.byp === false && me?.owns === true && me?.forced === false, detail: `current_user ${String(me?.u)}, bypassrls ${String(me?.byp)}, owner ${String(me?.owns)}, FORCE ${String(me?.forced)}` },
      force_applied_to_owner: { ok: me?.u === SCRATCH.owner && me?.owns === true && me?.forced === true && n === 1, detail: `FORCE ${String(me?.forced)} with the owner (${String(me?.u)}) seeing ${n} row(s)` },
      bypass_with_force: { ok: me?.u === SCRATCH.bypass && me?.byp === true && me?.owns === false && me?.forced === true && n === 2, detail: `${String(me?.u)} (bypassrls ${String(me?.byp)}, owner ${String(me?.owns)}) saw ${n} row(s) with FORCE ${String(me?.forced)}` },
    };
    return { outcome: o, statement, notes, claims };
  } finally {
    await dropScratch(admin);
    await admin.close().catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// F9 — integrity, with real concurrency
// ---------------------------------------------------------------------------

const ALICE = FIXTURES.alice.value;

async function runF9(
  variant: string,
  caller: Caller,
  approved: string,
): Promise<{ outcome: Outcome; statement: string; notes: string[]; claims: Record<string, { ok: boolean; detail: string }> | null; identity?: SessionIdentity }> {
  if (variant === "ledger_update" || variant === "ledger_truncate") {
    // Client and server probes are SEPARATE Test IDs on purpose (D3.18 #3).
    // The TRUNCATE is the approved statement verbatim: since Gate A the
    // server-side row truncates with CASCADE (C2-fk-before-truncate-trigger,
    // D3.54) and the client row does not. Anything else is refused, not run.
    if (variant === "ledger_truncate" && !/^truncate public\.wallet_ledger( cascade)?$/i.test(approved.trim())) {
      throw new Error(`unexpected approved TRUNCATE "${approved}"`);
    }
    const s = await openCaller(caller, claimsForCaller(caller));
    try {
      const sql = variant === "ledger_truncate" ? approved.trim() : `update public.wallet_ledger set delta = 1 where user_id = $1`;
      const o = await execute(s, sql, variant === "ledger_truncate" ? [] : [ALICE]);
      return { outcome: o, statement: sql, notes: [caller.kind === "admin" ? "issued on the privileged server connection" : `issued as ${caller.label}`], claims: null, identity: s.identity };
    } finally {
      await s.close();
    }
  }

  // The server-side variants run on connections opened here, and each one's
  // identity is read back like every other probe's. The first official run
  // (20260924T203033Z) recorded none for these three rows, and the independent
  // validator refused it (D3.55).
  const admin = await adminSession(caller.label);
  const call = `select * from public.apply_wallet_delta($1, $2, 'correction', $3, null, null, '{}'::jsonb)`;
  try {
    if (variant === "idempotent") {
      const key = `attest-idem-${randomUUID()}`;
      const before = await one(admin, `select balance from public.wallets where user_id = $1`, [ALICE]);
      const first = await execute(admin, call, [ALICE, 100, key]);
      const second = await execute(admin, call, [ALICE, 100, key]);
      const after = await one(admin, `select balance from public.wallets where user_id = $1`, [ALICE]);
      const ledger = await one(admin, `select count(*)::int n from public.wallet_ledger where idempotency_key = $1`, [key]);
      const moved = Number(after?.balance ?? 0) - Number(before?.balance ?? 0);
      const id1 = String(first.rows?.[0]?.id ?? ""), id2 = String(second.rows?.[0]?.id ?? "");
      const claims = {
        one_ledger_row: { ok: ledger?.n === 1, detail: `${String(ledger?.n)} ledger row(s) carry the key` },
        one_balance_movement: { ok: moved === 100, detail: `balance moved by ${moved} (one delta is 100)` },
        second_call_returned_first_row: { ok: !first.raised && !second.raised && id1 !== "" && id1 === id2, detail: `first call returned ledger row ${id1 || "(none)"}, second ${id2 || "(none)"}` },
      };
      const ok = Object.values(claims).every((c) => c.ok);
      return {
        outcome: synth(ok, Object.values(claims).map((c) => c.detail).join("; ")),
        statement: `${call}  -- issued twice with the same idempotency key ${key}`,
        notes: [`balance before ${String(before?.balance)}, after ${String(after?.balance)}`], claims, identity: admin.identity,
      };
    }

    if (variant === "overdebit") {
      const bal = await one(admin, `select balance from public.wallets where user_id = $1`, [ALICE]);
      const debit = -(Number(bal?.balance ?? 0) + 1_000_000);
      const o = await execute(admin, call, [ALICE, debit, `attest-over-${randomUUID()}`]);
      return { outcome: o, statement: call, notes: [`balance ${String(bal?.balance)}, debit attempted ${debit}`], claims: null, identity: admin.identity };
    }

    // concurrent
    const a = await adminSession(`${caller.label}: connection A`);
    const b2 = await adminSession(`${caller.label}: connection B`);
    const who = (x: Session) => `${x.identity.label} — current_user ${x.identity.currentUser}, session_user ${x.identity.sessionUser}, superuser ${String(x.identity.isSuperuser)}, bypassrls ${String(x.identity.bypassesRls)}`;
    const timeline: string[] = [];
    const mark = (s: string) => timeline.push(`${new Date().toISOString()} ${s}`);
    try {
      const before = await one(admin, `select balance from public.wallets where user_id = $1`, [ALICE]);
      await a.query("begin");
      await b2.query("begin");
      mark("both transactions open — they overlap from here");
      // Both calls in flight before either is awaited; apply_wallet_delta locks
      // the wallet row, so one blocks until the other commits. The winner is
      // whichever returns first (D3.28).
      let winner: "a" | "b" | null = null;
      const returned = { a: false, b: false };
      const pa = a.query(call, [ALICE, 250, `attest-conc-a-${randomUUID()}`]).then(() => { returned.a = true; winner ??= "a"; mark("A's call returned"); });
      const pb = b2.query(call, [ALICE, 375, `attest-conc-b-${randomUUID()}`]).then(() => { returned.b = true; winner ??= "b"; mark("B's call returned"); });
      await Promise.race([pa, pb]);
      const [first, second] = winner === "b" ? [b2, a] : [a, b2];
      const [pFirst, pSecond] = winner === "b" ? [pb, pa] : [pa, pb];
      mark(`${winner ?? "a"}'s call returned first`);
      await pFirst;
      // Measured, not assumed: was the other call still inside apply_wallet_delta
      // when the winner committed? (A wait on the wallet row lock.)
      await new Promise((r) => setTimeout(r, 300));
      const loserPendingAtCommit = !(winner === "b" ? returned.a : returned.b);
      await first.query("commit");
      mark(`winner committed; the other call was ${loserPendingAtCommit ? "still blocked" : "ALREADY returned"} at that moment`);
      await pSecond;
      await second.query("commit");
      mark("both committed");
      const after = await one(admin, `select balance from public.wallets where user_id = $1`, [ALICE]);
      const sum = await one(admin, `select coalesce(sum(delta),0)::bigint s from public.wallet_ledger where user_id = $1`, [ALICE]);
      const moved = Number(after?.balance ?? 0) - Number(before?.balance ?? 0);
      const reconciles = Number(after?.balance ?? 0) === Number(sum?.s ?? -1);
      const claims = {
        balance_is_sum: { ok: moved === 625, detail: `balance moved ${moved} (expected 625 = 250 + 375) across two overlapping transactions; the losing call ${loserPendingAtCommit ? "waited on the winner (serialised on the wallet row)" : "returned before the winner committed (no wait observed)"}` },
        reconciles: { ok: reconciles, detail: `balance ${String(after?.balance)} vs ledger sum ${String(sum?.s)}` },
      };
      return {
        outcome: synth(moved === 625 && reconciles, Object.values(claims).map((c) => c.detail).join("; ")),
        statement: `${call}  -- issued on two overlapping connections, deltas 250 and 375`,
        notes: [who(a), who(b2), ...timeline, `balance ${String(before?.balance)} -> ${String(after?.balance)}; ledger sum ${String(sum?.s)}`], claims,
        // Both connections are the same login; the record carries A's read-back
        // under the row's planned label, and the notes carry each one's.
        identity: { ...a.identity, label: caller.label },
      };
    } finally {
      await a.query("rollback").catch(() => {});
      await b2.query("rollback").catch(() => {});
      await a.close().catch(() => {});
      await b2.close().catch(() => {});
    }
  } finally {
    await admin.close().catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// F8 — the real client path
// ---------------------------------------------------------------------------

type RunnerClaims = Record<string, { ok: boolean; detail: string; cls?: "precondition" | "harness" }>;

/** Warm-up sends until `observer` receives one: Realtime starts its broadcast pipeline lazily, so the first send after a join can be lost. */
async function awaitLiveWindow(
  observer: { waitForMarker: (topic: string, marker: string, ms: number) => Promise<boolean> },
  send: (marker: string) => Promise<void>,
  topic: string,
  budgetMs = 30_000,
): Promise<{ live: boolean; attempts: number; ms: number }> {
  const t0 = Date.now();
  let attempts = 0;
  while (Date.now() - t0 < budgetMs) {
    attempts++;
    const m = `attest-warmup-${randomUUID()}`;
    await send(m);
    if (await observer.waitForMarker(topic, m, 2500)) return { live: true, attempts, ms: Date.now() - t0 };
  }
  return { live: false, attempts, ms: Date.now() - t0 };
}

async function runSocket(variant: string, admin: Session, caller: Caller): Promise<{ outcome: Outcome; statement: string; notes: string[]; claims: RunnerClaims; premises: CheckResult[] }> {
  const { signJwt } = await import("./jwt.ts");
  const { RealtimeClient } = await import("./realtime-client.ts");
  const url = process.env.ATTEST_REALTIME_WS ?? "ws://127.0.0.1:54321/realtime/v1/websocket";
  const topic = FIXTURES.gameTopic.value;
  const serverMarker = `attest-server-${randomUUID()}`;
  const carolMarker = `attest-carol-${randomUUID()}`;
  const notes: string[] = [`topic ${topic}`, "every join declares the channel private"];
  const send = async (marker: string) => {
    await admin.query(`select realtime.send(jsonb_build_object('attest_marker', $1::text), 'state', $2, true)`, [marker, topic]);
  };
  const clients: InstanceType<typeof RealtimeClient>[] = [];
  const tokens = new Map<string, string>();
  const mk = async (who: SubjectName | "service_role") => {
    const token = who === "service_role" ? await signJwt({ role: "service_role" }) : await signJwt(claimsFor(who));
    tokens.set(who, token);
    const c = new RealtimeClient(url, token, who);
    clients.push(c);
    await c.connect();
    return c;
  };
  // The probed client is the row's own structured identity; the premise is
  // read back from the token it actually presented, not assumed.
  const probed = caller.kind === "role" ? caller.subject : null;
  if (!probed) {
    return { outcome: harnessOutcome(`a socket probe needs an authenticated subject; the row's caller is ${caller.label}`), statement: `websocket ${url}`, notes, claims: {}, premises: [] };
  }
  const identityPremise = (): CheckResult => {
    const tok = tokens.get(probed);
    const payload = tok ? JSON.parse(Buffer.from(tok.split(".")[1]!, "base64url").toString("utf8")) as { sub?: string; role?: string } : {};
    const ok = payload.sub === uidOf(probed) && payload.role === "authenticated";
    return { id: "identity", describe: `the websocket authenticated as ${caller.label}`, ok, detail: `token presented: role=${payload.role ?? "none"}, sub=${payload.sub ?? "none"}${ok ? "" : ` — expected authenticated with sub ${uidOf(probed)}`}` };
  };
  // The observation window is only evidence once it is shown live: an
  // observer must receive a server-originated broadcast on the topic. A window
  // that never went live is a failed precondition, never a result either way.
  const windowPremise = (w: { live: boolean; attempts: number; ms: number }, who: string): CheckResult => ({
    id: "window_live", describe: `the observation window is live (${who} receives a server-originated broadcast on the topic)`,
    ok: w.live, detail: w.live ? `${who} received warm-up broadcast ${w.attempts} after ${w.ms}ms` : `${who} received none of ${w.attempts} warm-up broadcasts in ${w.ms}ms`,
  });
  const vacuous = (detail: string) => ({ ok: false, detail, cls: "precondition" as const });
  try {
    if (variant === "subscribe_ok") {
      // Liveness from a subscriber no row policy restricts (service_role
      // bypasses RLS): if IT sees the server's broadcast and alice does not,
      // the difference is alice's authorisation, not the pipeline.
      const live = await mk("service_role");
      const lj = await live.join(topic);
      const alice = await mk(probed);
      const j = await alice.join(topic);
      const w = lj.reply.status === "ok" ? await awaitLiveWindow(live, send, topic) : { live: false, attempts: 0, ms: 0 };
      await send(serverMarker);
      notes.push(`server broadcast 'state' via realtime.send carrying ${serverMarker}`);
      const got = j.reply.status === "ok" && w.live ? await alice.waitForMarker(topic, serverMarker, 8000) : false;
      const liveGot = w.live ? await live.waitForMarker(topic, serverMarker, 8000) : false;
      notes.push(...live.log, ...alice.log);
      const claims: RunnerClaims = {
        joined: { ok: j.reply.status === "ok", detail: `alice's private join: ${j.reply.status} ${JSON.stringify(j.reply.response ?? {}).slice(0, 120)}` },
        received_server_payload: !w.live || !liveGot
          ? vacuous("the liveness observer did not receive the server's broadcast, so alice's silence would prove nothing")
          : { ok: got, detail: got ? "alice received the server's broadcast" : "the liveness observer received the server's broadcast and alice did not" },
      };
      return {
        outcome: synth(claims.joined!.ok && got, `joined=${j.reply.status}, received=${got}`),
        statement: `websocket ${url}: service_role liveness observer + alice phx_join ${topic} (private); server realtime.send`,
        notes, claims, premises: [identityPremise(), windowPremise(w, "the service_role liveness observer")],
      };
    }
    // Both negatives use an authorised observer (alice) to prove the server's
    // broadcast actually went out; silence is only counted when it did.
    if (probed === "alice") {
      return { outcome: harnessOutcome("the negative socket probes use alice as the authorised observer, so the probed subject cannot also be alice"), statement: `websocket ${url}`, notes, claims: {}, premises: [] };
    }
    const observer = await mk("alice");
    const oj = await observer.join(topic);
    const carol = await mk(probed);
    const cj = await carol.join(topic);
    const w = oj.reply.status === "ok" ? await awaitLiveWindow(observer, send, topic) : { live: false, attempts: 0, ms: 0 };
    let carolAck: { status: string } | null = null;
    if (variant === "publish_denied") {
      carolAck = cj.reply.status === "ok"
        ? await carol.broadcast(topic, cj.joinRef, "state", { attest_marker: carolMarker })
        : { status: "not-joined" };
      notes.push(`carol's broadcast attempt: ${carolAck.status}`);
    }
    await send(serverMarker);
    notes.push(`server broadcast 'state' via realtime.send carrying ${serverMarker}`);
    const observerSawServer = w.live && oj.reply.status === "ok" ? await observer.waitForMarker(topic, serverMarker, 8000) : false;
    await new Promise((r) => setTimeout(r, 1500));
    // Every broadcast carrying an attest marker — warm-ups included — is a game payload carol must not receive.
    const carolGot = carol.received(topic).filter((m) => JSON.stringify(m.payload ?? {}).includes("attest_marker")).length;
    const observerSawCarol = observer.received(topic).some((m) => JSON.stringify(m.payload ?? {}).includes(carolMarker));
    notes.push(...observer.log, ...carol.log);
    const live = w.live && observerSawServer;
    const claims: RunnerClaims = {};
    if (variant === "subscribe_denied") {
      claims.refused_or_silent = live
        ? { ok: cj.reply.status !== "ok" || carolGot === 0, detail: `carol's join ${cj.reply.status}; broadcast payloads reaching carol: ${carolGot}` }
        : vacuous("the authorised observer did not receive the server's broadcast, so silence here proves nothing");
      claims.no_payload_received = live
        ? { ok: carolGot === 0, detail: `game payloads reaching carol: ${carolGot}, while the observer received the server's broadcast` }
        : vacuous("the observation window was not live");
    } else {
      claims.publish_not_delivered = live
        ? { ok: carolAck?.status !== "ok" && !observerSawCarol, detail: `carol's push: ${carolAck?.status}; carol's message reached the observer: ${observerSawCarol}` }
        : vacuous("the observer did not receive the server's broadcast, so its silence proves nothing");
      claims.observer_saw_no_carol_message = live
        ? { ok: !observerSawCarol, detail: `the observer received the server's broadcast and ${observerSawCarol ? "ALSO carol's" : "not carol's"}` }
        : vacuous("the observation window was not live");
    }
    const ok = Object.values(claims).every((c) => c.ok);
    return {
      outcome: synth(ok, Object.values(claims).map((c) => c.detail).join("; ")),
      statement: `websocket ${url}: observer alice + carol phx_join ${topic} (private)${variant === "publish_denied" ? "; carol broadcast 'state'" : ""}; server realtime.send`,
      notes, claims,
      premises: [identityPremise(), windowPremise({ ...w, live }, "alice, the authorised observer")],
    };
  } catch (err) {
    return { outcome: harnessOutcome(`the websocket probe itself failed: ${(err as Error).message}`), statement: `websocket ${url}`, notes, claims: {}, premises: [] };
  } finally {
    for (const c of clients) c.close();
  }
}

// ---------------------------------------------------------------------------
// boundary — the expired session, at the layer that rejects it
// ---------------------------------------------------------------------------

async function runExpiredJwt(): Promise<{ outcome: Outcome; statement: string; notes: string[]; claims: RunnerClaims }> {
  const { signJwt } = await import("./jwt.ts");
  const url = `${REST_BASE}/profiles?select=id&limit=1`;
  const expired = await signJwt({ ...claimsFor("alice"), exp: Math.floor(Date.now() / 1000) - 3600 });
  const fresh = await signJwt(claimsFor("alice"));
  const statement = `GET ${url} with an expired bearer token (reference: the same request with a fresh token)`;
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${expired}`, apikey: expired }, signal: AbortSignal.timeout(8000) });
    const body = (await res.text()).slice(0, 300);
    const ref = await fetch(url, { headers: { Authorization: `Bearer ${fresh}`, apikey: fresh }, signal: AbortSignal.timeout(8000) });
    await ref.text();
    const expiredMsg = /JWT expired|jwt expired|PGRST30/i.test(body);
    // The fresh-token reference is what makes the 401 about the token's AGE.
    // If the reference itself is not admitted, nothing can be attributed.
    const claims: RunnerClaims = {
      http_401: ref.status === 200
        ? { ok: res.status === 401, detail: `HTTP ${res.status}` }
        : { ok: false, cls: "precondition", detail: `the fresh-token reference returned HTTP ${ref.status}, not 200, so a 401 here could not be attributed to expiry` },
      rejected_at_gateway: ref.status === 200
        ? { ok: res.status === 401 && expiredMsg, detail: `the rejection body ${expiredMsg ? "names expiry" : "does NOT name expiry"} (${body.slice(0, 120)}); the same request with a fresh token signed by the same secret returned HTTP ${ref.status}, so the 401 is the token's age, not its signature` }
        : { ok: false, cls: "precondition", detail: `reference HTTP ${ref.status}` },
    };
    return {
      outcome: synth(claims.http_401!.ok && claims.rejected_at_gateway!.ok, `HTTP ${res.status}`),
      statement,
      notes: [`HTTP ${res.status}`, `body: ${body}`, `reference HTTP ${ref.status}`, "rejected at the API boundary; no RLS policy was consulted, so this is not an RLS result"],
      claims,
    };
  } catch (err) {
    return { outcome: harnessOutcome(`the HTTP probe itself failed: ${(err as Error).message}`), statement, notes: ["a harness error, not a 401"], claims: {} };
  }
}

// ---------------------------------------------------------------------------
// orchestration
// ---------------------------------------------------------------------------

export interface RunSummary {
  /**
   * Why the run stopped early, or null. A rebuild that fails, a baseline that
   * does not verify, or Arc21 changing stops the run — nothing is executed on a
   * state that could not be verified — and the records made so far are kept.
   */
  readonly aborted: { readonly reason: string; readonly beforeTestId: string; readonly arc21Changed: boolean } | null;
  readonly records: readonly Wp3EvidenceRecord[];
  readonly byVerdict: Readonly<Record<string, number>>;
  readonly byObservation: Readonly<Record<string, number>>;
  readonly harnessErrors: number;
  readonly rebuilds: number;
  readonly rebuildSeconds: number;
  readonly elapsedSeconds: number;
  /** Rebuilds whose `supabase db reset` was retried before succeeding, and why (D3.55). */
  readonly resetRetries: readonly { readonly epoch: number; readonly retries: readonly string[] }[];
}

/**
 * Run a set of Test IDs with rebuild isolation. The first probe always runs on
 * a freshly rebuilt, verified baseline. A failed rebuild or baseline check
 * stops the run: nothing is executed on a state that could not be verified.
 */
export async function runTests(
  ctx: RunContext,
  prepared: ReadonlyMap<string, PreparedProbe>,
  testIds: readonly string[],
): Promise<RunSummary> {
  const started = Date.now();
  const records: Wp3EvidenceRecord[] = [];
  const canonical: Canonical = { counts: null, catalog: null };
  let baseline: BaselineEpoch | null = null;
  let dirty: string | null = "the run starts on a fresh rebuild";
  let rebuilds = 0, rebuildMs = 0;
  const resetRetries: { epoch: number; retries: readonly string[] }[] = [];
  const triggerFns = await (async () => {
    const a = await adminSession("trigger-functions");
    try {
      const { rows } = await a.query(`select p.proname::text as f from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('public','private') and p.prorettype = 'trigger'::regtype`);
      return new Set(rows.map((r) => String(r.f)));
    } finally {
      await a.close();
    }
  })();

  let aborted: RunSummary["aborted"] = null;
  for (const id of testIds) {
    const p = prepared.get(id);
    if (!p) throw new Error(`no prepared probe for ${id}`);
    let rebuiltBefore = false;
    if (dirty !== null || !baseline) {
      try {
        baseline = await rebuildBaseline({ epoch: rebuilds + 1, expectedSchema: ctx.expectedSchema, canonical, arc21Pre: ctx.arc21Pre, log: ctx.log, only: ctx.extensionFilter });
      } catch (err) {
        aborted = { reason: (err as Error).message, beforeTestId: id, arc21Changed: err instanceof Arc21ChangedError };
        ctx.log(`  RUN ABORTED before ${id}: ${(err as Error).message}`);
        break;
      }
      rebuilds++;
      rebuildMs += baseline.durationMs;
      if (baseline.resetRetries.length) resetRetries.push({ epoch: baseline.epoch, retries: baseline.resetRetries });
      rebuiltBefore = true;
      dirty = null;
    }
    const r = await runOne(ctx, p, { baseline, rebuiltBefore, triggerFns });
    records.push(r.record);
    dirty = r.dirtyBecause;
    const rec = r.record;
    ctx.log(`  ${rec.observation.padEnd(21)} ${id.padEnd(44)} ${rec.actualSummary.padEnd(16)} -> ${rec.verdict}${dirty ? "  [rebuild next]" : ""}`);
  }
  const byVerdict: Record<string, number> = {};
  const byObservation: Record<string, number> = {};
  for (const r of records) {
    byVerdict[r.verdict] = (byVerdict[r.verdict] ?? 0) + 1;
    byObservation[r.observation] = (byObservation[r.observation] ?? 0) + 1;
  }
  return {
    aborted, records, byVerdict, byObservation,
    harnessErrors: records.filter((r) => r.observation === "harness_error").length,
    rebuilds, rebuildSeconds: rebuildMs / 1000, elapsedSeconds: (Date.now() - started) / 1000, resetRetries,
  };
}
