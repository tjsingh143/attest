/**
 * Attest — WP3 execution: turning each approved row into one executable probe.
 *
 * ## Why derivation rather than a second hand-written suite
 *
 * The matrix is approved. An executor written beside it would be a second
 * description of the same 345 tests, free to drift from the first — and the
 * drift would be invisible, because both would look right on their own. So the
 * executable form is DERIVED from the approved row, by strict parsers over the
 * templates the planner emitted, and every derived spec is then cross-checked
 * against the catalog: the resource must exist, the column must exist, the
 * function must exist with that identity argument list, the fixture reference
 * must resolve.
 *
 * A row that does not parse, or whose derived spec does not validate, is a hard
 * failure naming the Test ID. It is never guessed at. `attest preflight-wp3`
 * surfaces it before anything runs.
 *
 * ## What the executor may not do
 *
 * It may not make a security judgment. The expectation comes from the plan's
 * `expected` text and the verdict from the plan's `verdictWhenPredicted`; the
 * executor's whole job is to issue the statement and record what came back. If
 * a row cannot be executed as approved — because its own fields contradict each
 * other — that is surfaced as a contradiction and the row is blocked, not
 * quietly reinterpreted. See `src/plan-contradictions.ts`.
 *
 * One Test ID produces exactly one probe and exactly one evidence record.
 */
import type { Session } from "./db.ts";
import { adminSession, roleSession, quoteIdent } from "./db.ts";
import type { Expectation, Outcome } from "./evidence.ts";
import { execute, summarize } from "./evidence.ts";
import type { PlannedTest, Wp3Plan } from "./wp3-plan.ts";
import { FIXTURES } from "../rubric/fixtures.ts";
import { assertCustom } from "./wp3-assertions.ts";

// ---------------------------------------------------------------------------
// identities
// ---------------------------------------------------------------------------

export type SubjectName = "alice" | "bob" | "carol" | "dave";

const UID: Record<SubjectName, string> = {
  alice: FIXTURES.alice.value,
  bob: FIXTURES.bob.value,
  carol: FIXTURES.carol.value,
  dave: FIXTURES.dave.value,
};

export function claimsFor(sub: SubjectName): Record<string, unknown> {
  return { sub: UID[sub], role: "authenticated", aud: "authenticated" };
}

/** How a probe reaches the database. */
export type Caller =
  | { readonly kind: "role"; readonly role: "anon" | "authenticated"; readonly subject: SubjectName | null; readonly label: string }
  /** The privileged connection. Only catalog reads and the server-path probes. */
  | { readonly kind: "admin"; readonly label: string }
  /**
   * The probe opens its own connection or speaks a different protocol: the F7
   * scratch roles, which are created and dropped in-run, and the expired-JWT
   * case, which never reaches PostgreSQL at all.
   */
  | { readonly kind: "external"; readonly label: string };

/**
 * The caller a row runs as: its structured `identity`, and nothing else.
 *
 * This used to read `effectiveActor(t)`, which substitutes the caller an
 * operation names when it disagrees with the identity column. While C1 was open
 * that substitution was never reachable in a real run (preflight blocked every
 * contradicted row), but it meant the executor COULD run a row as someone its
 * structured identity did not say — and the evidence record's identity field
 * would then have disagreed with the plan's. C1 is resolved in the plan
 * (D3.33), so there is nothing to substitute, and the executor now has no path
 * that re-decides who a probe runs as. A disagreement between identity and
 * operation is a plan contradiction for preflight to refuse, not something the
 * executor settles.
 */
export function callerFor(t: PlannedTest): Caller {
  const id = t.identity;
  if (/scratch|expired JWT/i.test(id)) return { kind: "external", label: id };
  if (id.startsWith("anon")) return { kind: "role", role: "anon", subject: null, label: "anon" };
  if (id.includes("server-side") || id.includes("owner(")) return { kind: "admin", label: id };
  if (id.includes("NO claims")) return { kind: "role", role: "authenticated", subject: null, label: "authenticated:(no claims)" };
  if (id.includes("deleted account")) return { kind: "role", role: "authenticated", subject: "dave", label: "authenticated:dave(deleted)" };
  for (const s of ["alice", "bob", "carol", "dave"] as SubjectName[]) {
    if (id.includes(s)) return { kind: "role", role: "authenticated", subject: s, label: `authenticated:${s}` };
  }
  throw new Error(`cannot decide a caller for identity "${t.identity}" on ${t.testId}`);
}

// ---------------------------------------------------------------------------
// fixture references
// ---------------------------------------------------------------------------

const BY_REF = new Map(Object.values(FIXTURES).map((f) => [f.ref, f.value]));

/** Resolve every `fixtures.x.y` in a string to its declared literal. */
export function resolveRefs(text: string): { value: string; refs: string[] } {
  const refs: string[] = [];
  const value = text.replace(/fixtures\.[A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)?/g, (m) => {
    const v = BY_REF.get(m);
    if (v === undefined) throw new Error(`unknown fixture reference ${m}`);
    refs.push(m);
    return v;
  });
  return { value, refs };
}

function refValue(ref: string): string {
  const v = BY_REF.get(ref);
  if (v === undefined) throw new Error(`unknown fixture reference ${ref}`);
  return v;
}

// ---------------------------------------------------------------------------
// the executable spec
// ---------------------------------------------------------------------------

export type ExecKind =
  | "sql"
  | "rpc"
  | "catalog"
  | "audit_absence"
  | "f7_mechanism"
  | "f7_roles"
  | "f9"
  | "socket"
  | "http";

export interface ExecSpec {
  readonly testId: string;
  readonly kind: ExecKind;
  readonly caller: Caller;
  /** The statement or call to issue. Empty for kinds that build their own. */
  readonly statement: string;
  readonly params: readonly unknown[];
  readonly expect: Expectation | { readonly kind: "custom"; readonly describe: string };
  /** For rpc: the identity-qualified function. */
  readonly functionCall?: string;
  /** Sub-probe selector for the composite kinds. */
  readonly variant?: string;
  /** Catalog assertions return one row of `ok boolean, detail text`. */
  readonly assertSql?: string;
  /**
   * Statements to issue on the same session BEFORE the probe.
   *
   * `realtime.messages` policies read `realtime.topic()`, which is a GUC, so
   * the topic has to be set first. Packing both into one statement string sent
   * them as a multi-statement query with a bind parameter, which PostgreSQL
   * rejects with 42601 — and 42601 satisfied the row's "no data" expectation,
   * so a malformed probe read as a working control. See MALFORMED_PROBE.
   */
  readonly preStatements?: readonly { sql: string; params: readonly unknown[] }[];
  /**
   * A post-probe check on state the probe must NOT have changed, run as admin.
   * Returns one row of `ok boolean, detail text`, and is ANDed with the
   * probe's own assertion.
   */
  readonly stateGuard?: { readonly sql: string; readonly params: readonly unknown[]; readonly describe: string };
}

/**
 * SQLSTATEs that mean the PROBE is malformed, not that the database refused.
 *
 * 42601 syntax_error and friends are defects in the harness's own SQL. Treating
 * them as refusals is how a broken probe passes: `no_data` accepts any raise,
 * so a syntax error scored as a control holding. 42501 is deliberately absent —
 * insufficient_privilege is a real refusal and is the expected outcome of most
 * of this suite.
 */
export const MALFORMED_PROBE = new Set(["42601", "42703", "42P01", "42883", "42P02", "42P18", "42804"]);

/** The membership column a participation policy keys on, per resource. */
const MEMBERSHIP_FK: Readonly<Record<string, string>> = {
  "public.game_events": "game_session_id",
  "public.game_session_seats": "game_session_id",
  "public.game_sessions": "id",
  "public.hand_players": "game_session_id",
  "public.hand_records": "game_session_id",
  "public.room_members": "room_id",
  "public.rooms": "id",
  "public.tournament_entries": "tournament_id",
  "public.tournament_matches": "tournament_id",
};

/** The owner column each resource links identity through, for the boundary rows. */
const OWNER_COL: Readonly<Record<string, string>> = {
  "private.game_commands": "actor_user_id",
  "public.blocks": "blocker_id",
  "public.friend_requests": "sender_id",
  "public.friendships": "user_id_a",
  "public.game_events": "recipient_user_id",
  "public.game_session_seats": "user_id",
  "public.game_sessions": "host_user_id",
  "public.profiles": "id",
  "public.rate_limit_events": "user_id",
  "public.room_members": "user_id",
  "public.rooms": "host_user_id",
  "public.tournament_entries": "user_id",
  "public.wallet_ledger": "user_id",
  "public.wallets": "user_id",
};

const NO_DATA: Expectation = { kind: "no_data" };
const ROWS = (n: number): Expectation => ({ kind: "rows", count: n });
const ERR = (sqlstate?: string): Expectation => ({ kind: "error", sqlstate });

/** Derive the expectation from the plan's own `expected` text. */
export function expectationFor(t: PlannedTest): Expectation | { kind: "custom"; describe: string } {
  const e = t.expected;
  if (/^no data/i.test(e)) return NO_DATA;
  if (/^at least 1 row/i.test(e)) return { kind: "custom", describe: "at least 1 row" };
  const m = /^error (\d{5})/i.exec(e);
  if (m) return ERR(m[1]);
  if (/^error/i.test(e)) return ERR();
  if (/^(\d+) rows? affected/i.test(e)) {
    const n = Number(/^(\d+)/.exec(e)![1]);
    return ROWS(n);
  }
  return { kind: "custom", describe: e };
}

/**
 * Did the outcome match?
 *
 * A `custom` expectation is delegated to `assertCustom`, which keys on the
 * plan's own `expected` text. That is why this takes the planned row: the
 * assertion for "only alice's own rows are returned" is not derivable from a
 * row count.
 */
export function matches(
  expect: Expectation | { kind: "custom"; describe: string },
  o: Outcome,
  t?: PlannedTest,
): boolean {
  if (o.harnessError) return false; // never evidence that a control worked
  // A malformed probe is a harness defect wearing a SQLSTATE. It must not be
  // able to satisfy an expected refusal.
  if (o.raised && o.sqlstate && MALFORMED_PROBE.has(o.sqlstate)) return false;
  if (expect.kind === "custom") {
    if (!t) return expect.describe === "at least 1 row" && !o.raised && (o.rowCount ?? 0) >= 1;
    return assertCustom(t, o).satisfied;
  }
  if (expect.kind === "rows") return !o.raised && o.rowCount === expect.count;
  if (expect.kind === "no_data") return o.raised || o.rowCount === 0;
  if (!o.raised) return false;
  return expect.sqlstate === undefined || o.sqlstate === expect.sqlstate;
}

// ---------------------------------------------------------------------------
// derivation
// ---------------------------------------------------------------------------

const ctrlSuffix = (t: PlannedTest) => (t.control.includes("#") ? t.control.replace(/^[^#]*#/, "") : t.control);

/** Strip the disambiguating tag the D3.14 splits added, e.g. `f(a uuid [tag])`. */
export function functionIdentity(resource: string): { schema: string; name: string; args: string } {
  const m = /^([a-z_]+)\.([a-z_0-9]+)\(([\s\S]*)\)$/.exec(resource.trim());
  if (!m) throw new Error(`cannot parse a function identity from "${resource}"`);
  // Strip a disambiguating tag — " [non-friend projection]", " (profiles join)" —
  // without touching an array type. The whitespace before "[" is what tells the
  // two apart: `p_ids uuid[]` has none, so it survives. Without that the
  // argument list became `p_ids uuid` and preflight could not find the function.
  const args = m[3]!.replace(/\s+\[[^\]]+\]\s*$/, "").replace(/\s+\([^()]*\)\s*$/, "").trim();
  return { schema: m[1]!, name: m[2]!, args };
}

/**
 * One executable spec per approved row.
 *
 * Throws, naming the Test ID, rather than returning something approximate.
 */
export function specFor(t: PlannedTest): ExecSpec {
  const caller = callerFor(t);
  const suffix = ctrlSuffix(t);
  const res = t.resource;
  const expect = expectationFor(t);
  const base = { testId: t.testId, caller, params: [] as unknown[], expect };

  // --- F2 grant surface: the control is the ABSENCE of the privilege --------
  let m = /^grant:authenticated:(INSERT|UPDATE|DELETE)$/.exec(suffix);
  if (m) {
    const cmd = m[1]!;
    if (cmd === "INSERT") return { ...base, kind: "sql", statement: `insert into ${res} default values` };
    if (cmd === "DELETE") return { ...base, kind: "sql", statement: `delete from ${res}` };
    const col = /set\s+([a-z_]+)\s*=/.exec(t.operation)?.[1];
    if (!col) throw new Error(`${t.testId}: no SET column in "${t.operation}"`);
    // `where false` so that, if the privilege check ever stopped firing, this
    // still could not modify a row. The probe is about the privilege.
    return { ...base, kind: "sql", statement: `update ${res} set ${quoteIdent(col)} = ${quoteIdent(col)} where false` };
  }

  // --- F6 column grants ----------------------------------------------------
  if (suffix === "colgrant:SELECT") {
    const cols = /^SELECT\s+([a-z_, ]+?)\s+from\s/i.exec(t.operation)?.[1];
    if (!cols) throw new Error(`${t.testId}: no column list in "${t.operation}"`);
    return { ...base, kind: "sql", statement: `select ${cols} from ${res}` };
  }
  if (suffix === "colgrant:UPDATE") {
    const mm = /^UPDATE\s+\S+\s+set\s+([a-z_]+)\s*=\s*(.+?)(?:\s+where\s+([a-z_]+)\s*=\s*(\S+))?$/i.exec(t.operation);
    if (!mm) throw new Error(`${t.testId}: cannot parse "${t.operation}"`);
    const [, col, rawVal, whereCol, whereRef] = mm;
    const value = resolveRefs(rawVal!.trim()).value;
    if (whereCol && whereRef) {
      return {
        ...base, kind: "sql",
        statement: `update ${res} set ${quoteIdent(col!)} = ${value} where ${quoteIdent(whereCol)} = $1`,
        params: [resolveRefs(whereRef).value],
      };
    }
    return { ...base, kind: "sql", statement: `update ${res} set ${quoteIdent(col!)} = ${value}` };
  }

  // --- F4 anon reach: no policy admits the caller --------------------------
  if (suffix === "anon-reach") {
    return { ...base, kind: "sql", statement: `select * from ${res}`, expect: NO_DATA };
  }

  // --- F7 per-resource characterization ------------------------------------
  if (suffix === "rls_forced") {
    return {
      ...base, kind: "catalog", statement: `pg_class read for ${res}`,
      assertSql:
        `select (c.relrowsecurity and not c.relforcerowsecurity) as ok,
                'rls_enabled = ' || c.relrowsecurity::text ||
                ', rls_forced = ' || c.relforcerowsecurity::text ||
                ', owner = ' || pg_get_userbyid(c.relowner)  as detail
         from pg_class c where c.oid = '${res}'::regclass`,
    };
  }
  if (suffix === "pg_roles: rolsuper / rolbypassrls / relowner") return { ...base, kind: "f7_roles", statement: "pg_roles / pg_class read" };
  if (suffix === "FORCE ROW LEVEL SECURITY vs BYPASSRLS") {
    const step = /NOT forced/i.test(t.operation) ? "unforced_owner" : /enable FORCE/i.test(t.operation) ? "forced_owner" : "forced_bypass";
    return { ...base, kind: "f7_mechanism", statement: `scratch-table demonstration: ${step}`, variant: step };
  }

  // --- F10 audit trail ------------------------------------------------------
  if (suffix === "audit:absent") {
    return {
      ...base, kind: "audit_absence", statement: `catalog search for a history/versioning/audit relation covering ${res}`,
      assertSql: auditAbsenceSql(res),
    };
  }
  m = /^audit:immutable:(UPDATE|DELETE|TRUNCATE)$/.exec(suffix);
  if (m) {
    const cmd = m[1]!;
    if (cmd === "TRUNCATE") return { ...base, kind: "sql", statement: `truncate ${res}` };
    if (cmd === "DELETE") return { ...base, kind: "sql", statement: `delete from ${res} where true` };
    const col = auditTouchColumn(res);
    return { ...base, kind: "sql", statement: `update ${res} set ${quoteIdent(col)} = ${quoteIdent(col)} where true` };
  }
  if (/^audit:/.test(suffix)) {
    // The existence check: does a who/what/when record exist at all.
    const cols = auditColumns(res);
    return { ...base, kind: "sql", statement: `select ${cols.join(", ")} from ${res} limit 5`, expect: { kind: "custom", describe: "at least 1 row" } };
  }

  // --- F5 SECURITY DEFINER --------------------------------------------------
  if (suffix === "security_definer") {
    const { schema, name, args } = functionIdentity(res);
    const call = parseCall(t);
    return {
      ...base, kind: "rpc",
      statement: call.sql, params: call.params,
      functionCall: `${schema}.${name}(${args})`,
      expect: expectationFor(t),
      stateGuard: STATE_GUARDS[t.testId],
    };
  }

  // --- F9 wallet integrity --------------------------------------------------
  if (suffix === "integrity") {
    const op = t.operation;
    const variant =
      /two concurrent sessions/i.test(op) ? "concurrent"
      : /SAME idempotency key/i.test(op) ? "idempotent"
      : /debit larger than the balance/i.test(op) ? "overdebit"
      : /truncate/i.test(op) ? "ledger_truncate"
      : "ledger_update";
    return { ...base, kind: "f9", statement: op, variant };
  }

  // --- F8 realtime ----------------------------------------------------------
  if (suffix === "realtime-socket") {
    const variant = /publish/i.test(t.operation) ? "publish_denied" : t.polarity === "positive" ? "subscribe_ok" : "subscribe_denied";
    return { ...base, kind: "socket", statement: t.operation, variant };
  }

  // --- boundary -------------------------------------------------------------
  if (suffix === "PostgREST / GoTrue JWT verification") return { ...base, kind: "http", statement: "GET /rest/v1/profiles with an expired bearer token", variant: "expired_jwt" };
  if (/^boundary:null-identity$/.test(suffix)) return { ...base, kind: "sql", statement: `select * from ${res}`, expect: NO_DATA };
  if (/^boundary:deleted-user$/.test(suffix)) {
    const col = OWNER_COL[res];
    if (!col) throw new Error(`${t.testId}: no owner column known for ${res}`);
    return { ...base, kind: "sql", statement: `select * from ${res} where ${quoteIdent(col)} = $1`, params: [refValue("fixtures.dave.id")], expect: NO_DATA };
  }

  // --- policy probes (F1, F2 policy, F3, F4 predicate, F8 SQL) --------------
  if (/^policy:/.test(suffix)) return policySpec(t, base);

  throw new Error(`${t.testId}: no executor derivation for control "${t.control}"`);
}

/** F1/F2/F3/F4/F8 rows, all of which name a policy. */
function policySpec(
  t: PlannedTest,
  base: { testId: string; caller: Caller; params: unknown[]; expect: Expectation | { kind: "custom"; describe: string } },
): ExecSpec {
  const res = t.resource;
  const op = t.operation;

  // realtime.messages: the topic GUC is what the policies read.
  if (res === "realtime.messages") {
    const topicRef = /set realtime\.topic to (\S+)/.exec(op)?.[1];
    const topic = topicRef === "the" ? refValue("fixtures.session.topic") : topicRef ? resolveRefs(topicRef).value : refValue("fixtures.session.topic");
    const setTopic = [{ sql: `select set_config('realtime.topic', $1, false)`, params: [topic] }];
    if (/insert into/i.test(op)) {
      return {
        ...base, kind: "sql",
        preStatements: setTopic,
        statement:
          `insert into realtime.messages (topic, extension, payload, event, private) ` +
          `values ($1, 'broadcast', '{"attest":true}'::jsonb, 'state', true)`,
        params: [topic],
      };
    }
    return {
      ...base, kind: "sql",
      preStatements: setTopic,
      statement: `select * from realtime.messages where topic = $1`,
      params: [topic],
    };
  }

  // INSERT probes (F3, and the F2 insert policies).
  let m = /^INSERT into \S+ with ([a-z_]+) = (fixtures\.\w+\.\w+)/i.exec(op);
  if (m) {
    const col = m[1]!, value = resolveRefs(m[2]!).value;
    return { ...base, kind: "sql", statement: `insert into ${res} (${quoteIdent(col)}) values ($1)`, params: [value] };
  }

  // UPDATE / DELETE probes keyed on a predicate column.
  m = /^(update|delete)\s+(?:from\s+)?\S+\s+(?:set\s+([a-z_]+)\s*=\s*(\S+)\s+)?where\s+([a-z_]+)\s*=\s*(fixtures\.\w+\.\w+)/i.exec(op);
  if (m) {
    const [, verb, setCol, setVal, whereCol, whereRef] = m;
    const value = resolveRefs(whereRef!).value;
    if (verb!.toLowerCase() === "delete") {
      return { ...base, kind: "sql", statement: `delete from ${res} where ${quoteIdent(whereCol!)} = $1`, params: [value] };
    }
    // The plan's UPDATE template sometimes omits SET; use a granted column that
    // does not move the predicate, so the probe tests the policy and not a
    // column grant.
    const col = setCol ?? updateTouchColumn(res);
    const rhs = setVal ? resolveRefs(setVal).value : quoteIdent(col);
    return { ...base, kind: "sql", statement: `update ${res} set ${quoteIdent(col)} = ${rhs} where ${quoteIdent(whereCol!)} = $1`, params: [value] };
  }

  // SELECT keyed on an ownership column.
  m = /^select from \S+ where ([a-z_]+) = (fixtures\.\w+\.\w+)/i.exec(op);
  if (m) {
    return { ...base, kind: "sql", statement: `select * from ${res} where ${quoteIdent(m[1]!)} = $1`, params: [resolveRefs(m[2]!).value] };
  }

  // SELECT over a multi-clause OR predicate: the fixture row names neither party.
  m = /^select from \S+ for a row where NONE of ([a-z_, ]+) is /i.exec(op);
  if (m) {
    const cols = m[1]!.split(",").map((c) => c.trim()).filter(Boolean);
    const conj = cols.map((c) => `${quoteIdent(c)} <> $1`).join(" and ");
    return { ...base, kind: "sql", statement: `select * from ${res} where ${conj}`, params: [refValue("fixtures.alice.id")] };
  }

  // SELECT gated by membership rather than ownership.
  m = /^select from \S+ for (?:that same )?(?:game session|room|tournament)?\s*(fixtures\.\w+\.\w+)/i.exec(op);
  if (m) {
    const fk = MEMBERSHIP_FK[res];
    if (!fk) throw new Error(`${t.testId}: no membership column known for ${res}`);
    const extra = /visibility = 'public'/.test(op) ? ` and visibility = 'public'` : "";
    return { ...base, kind: "sql", statement: `select * from ${res} where ${quoteIdent(fk)} = $1${extra}`, params: [resolveRefs(m[1]!).value] };
  }

  // F4's falsifying-predicate rows.
  m = /^select from \S+ for (?:the seeded row where|a row satisfying) (.+)$/i.exec(op);
  if (m) {
    return { ...base, kind: "sql", statement: `select * from ${res} where ${m[1]!.trim()}` };
  }

  throw new Error(`${t.testId}: cannot derive a policy probe from "${op}"`);
}

/** Parse `as <who>, call f(args…)` into a callable statement. */
function parseCall(t: PlannedTest): { sql: string; params: unknown[] } {
  const { schema, name } = functionIdentity(t.resource);
  const op = t.operation;
  // `call it …` refers back to the row's own function.
  const argText = /\bcall\s+(?:it|[a-z_0-9]+)\s*\(([\s\S]*?)\)(?:\s|$|,|—|—)/.exec(op)?.[1];
  if (argText === undefined) {
    // No parenthesised argument list: a zero-argument call.
    return { sql: `select * from ${schema}.${name}()`, params: [] };
  }
  const raw = argText.trim();
  if (raw === "") return { sql: `select * from ${schema}.${name}()`, params: [] };
  const parts = splitArgs(raw);
  const params: unknown[] = [];
  const placeholders = parts.map((p) => {
    const lit = literalArg(p, params);
    return lit;
  });
  return { sql: `select * from ${schema}.${name}(${placeholders.join(", ")})`, params };
}

/** Split an argument list on commas that are not inside brackets or quotes. */
function splitArgs(s: string): string[] {
  const out: string[] = [];
  let depth = 0, quoted = false, cur = "";
  for (const ch of s) {
    if (ch === "'" ) quoted = !quoted;
    if (!quoted && (ch === "(" || ch === "[")) depth++;
    if (!quoted && (ch === ")" || ch === "]")) depth--;
    if (ch === "," && depth === 0 && !quoted) { out.push(cur); cur = ""; continue; }
    cur += ch;
  }
  if (cur.trim()) out.push(cur);
  return out.map((x) => x.trim()).filter(Boolean);
}

/** Turn one planned argument into a placeholder plus its bound value. */
function literalArg(arg: string, params: unknown[]): string {
  const a = arg.trim();
  const arrayMatch = /^ARRAY\[(.+)\]$/i.exec(a);
  if (arrayMatch) {
    const inner = splitArgs(arrayMatch[1]!).map((x) => resolveRefs(x.replace(/^'|'$/g, "")).value);
    params.push(inner);
    return `$${params.length}::uuid[]`;
  }
  if (/^fixtures\./.test(a)) { params.push(resolveRefs(a).value); return `$${params.length}`; }
  if (/^'.*'$/.test(a)) { params.push(resolveRefs(a.slice(1, -1)).value); return `$${params.length}`; }
  if (/^-?\d+$/.test(a)) { params.push(Number(a)); return `$${params.length}`; }
  if (/^(true|false)$/i.test(a)) { params.push(a.toLowerCase() === "true"); return `$${params.length}`; }
  params.push(resolveRefs(a).value);
  return `$${params.length}`;
}

/**
 * Post-probe state checks, for the twelve rows whose expectation is not only
 * about the return value.
 *
 * "returns 0 AND bob's notification read_at stays null" is two claims. Checking
 * only the first would let a probe pass while the definer privilege had in fact
 * reached another account's row — which is the exact escalation F5 exists to
 * detect. Each guard is written from the row's own `expected` text.
 */
const F = FIXTURES;
const STATE_GUARDS: Readonly<Record<string, { sql: string; params: readonly unknown[]; describe: string }>> = {
  "F5.remove_room_member.245": {
    describe: "bob's membership of the bob-hosted room is unchanged",
    sql: `select count(*) = 1 as ok, 'bob joined-membership rows: ' || count(*)::text as detail
          from public.room_members where room_id = $1 and user_id = $2 and status = 'joined'`,
    params: [F.roomBobHosts.value, F.bob.value],
  },
  "F5.set_room_ready.247": {
    describe: "carol is still not a member of the alice/bob room",
    sql: `select count(*) = 0 as ok, 'carol membership rows: ' || count(*)::text as detail
          from public.room_members where room_id = $1 and user_id = $2`,
    params: [F.roomAliceBob.value, F.carol.value],
  },
  "F5.invite_friend_to_room.248": {
    describe: "no room_members row was created for bob in the alice/bob room by this call",
    sql: `select count(*) = 1 as ok, 'bob membership rows: ' || count(*)::text || ' (the seeded one only)' as detail
          from public.room_members where room_id = $1 and user_id = $2`,
    params: [F.roomAliceBob.value, F.bob.value],
  },
  "F5.leave_room.249": {
    describe: "no other member's row was altered",
    sql: `select count(*) = 2 as ok, 'joined members still in the room: ' || count(*)::text || ' of 2' as detail
          from public.room_members where room_id = $1 and status = 'joined'`,
    params: [F.roomAliceBob.value],
  },
  "F5.mark_notifications_read.251": {
    describe: "bob's notification read_at is still null",
    sql: `select (read_at is null) as ok, 'bob notification read_at = ' || coalesce(read_at::text, 'null') as detail
          from public.notifications where id = $1`,
    params: [F.bobNotification.value],
  },
  "F5.decline_friend_request.258": {
    describe: "the bob->carol request is untouched",
    sql: `select (status = 'pending') as ok, 'request status = ' || status::text as detail
          from public.friend_requests where id = $1`,
    params: [F.bobNotSentRequest.value],
  },
  "F5.block_player.260": {
    describe: "the new block is attributed to alice, and no row appears with blocker_id = bob",
    sql: `select (mine >= 1 and theirs = 0) as ok,
                 'blocks by alice on bob: ' || mine::text || ', blocks by bob on bob: ' || theirs::text as detail
          from (select
                  (select count(*) from public.blocks where blocker_id = $1 and blocked_id = $2) mine,
                  (select count(*) from public.blocks where blocker_id = $2 and blocked_id = $2) theirs) x`,
    params: [F.alice.value, F.bob.value],
  },
  "F5.unblock_player.261": {
    describe: "the seeded alice->dave block survives",
    sql: `select count(*) = 1 as ok, 'alice->dave block rows: ' || count(*)::text as detail
          from public.blocks where blocker_id = $1 and blocked_id = $2`,
    params: [F.alice.value, F.dave.value],
  },
  "F5.remove_friend.262": {
    describe: "the seeded alice<->bob friendship survives",
    sql: `select count(*) = 1 as ok, 'alice<->bob friendship rows: ' || count(*)::text as detail
          from public.friendships where (user_id_a, user_id_b) in (($1,$2),($2,$1))`,
    params: [F.alice.value, F.bob.value],
  },
  "F5.retire_push_token.268": {
    describe: "bob's push token row is still active",
    sql: `select (is_active) as ok, 'bob token is_active = ' || is_active::text as detail
          from public.push_tokens where token = $1`,
    params: [F.bobPushToken.value],
  },
  "F5.register_push_token.269": {
    describe: "bob's token row still exists and is still attributed to bob",
    sql: `select count(*) = 1 as ok, 'rows for that token still owned by bob: ' || count(*)::text as detail
          from public.push_tokens where token = $1 and user_id = $2`,
    params: [F.bobPushToken.value, F.bob.value],
  },
  "F5.create_private_room.281": {
    describe: "no rooms row was created by the out-of-range call",
    sql: `select count(*) = 0 as ok, 'rooms with max_seats outside 2..5: ' || count(*)::text as detail
          from public.rooms where max_seats < 2 or max_seats > 5`,
    params: [],
  },
};

/** A column safe to no-op update when testing an immutability trigger. */
function auditTouchColumn(res: string): string {
  const byRes: Record<string, string> = {
    "private.game_commands": "command_id",
    "public.game_events": "type",
    "public.rate_limit_events": "action",
    "public.wallet_ledger": "reason",
  };
  return byRes[res] ?? "id";
}

/** A granted, non-predicate column to move in an UPDATE policy probe. */
function updateTouchColumn(res: string): string {
  const byRes: Record<string, string> = {
    "public.friend_requests": "status",
    "public.loadouts": "avatar_cosmetic_id",
    "public.notifications": "read_at",
    "public.profiles": "bio",
    "public.push_tokens": "is_active",
  };
  return byRes[res] ?? "id";
}

/** The actor/action/time columns an audit-existence probe reads. */
function auditColumns(res: string): string[] {
  const byRes: Record<string, string[]> = {
    "private.game_commands": ["actor_user_id", "command_type", "created_at"],
    "public.game_events": ["type", "created_at"],
    "public.rate_limit_events": ["user_id", "action", "occurred_at"],
    "public.wallet_ledger": ["user_id", "reason", "created_at"],
  };
  const cols = byRes[res];
  if (!cols) throw new Error(`no audit columns known for ${res}`);
  return cols;
}

/** Search the catalogs for any trail covering a resource. */
function auditAbsenceSql(res: string): string {
  const [, name] = res.split(".");
  return `select (hist = 0 and softdel = 0 and deltrig = 0) as ok,
                 'history/versioning/audit relations naming ' || '${name}' || ': ' || hist::text ||
                 ', soft-delete columns: ' || softdel::text ||
                 ', delete triggers retaining a record: ' || deltrig::text as detail
          from (select
                  (select count(*) from pg_class c
                    where c.relkind in ('r','p')
                      and c.relnamespace::regnamespace::text in ('public','private')
                      and (c.relname like '%' || '${name}' || '%history%'
                        or c.relname like '%' || '${name}' || '%audit%'
                        or c.relname like '%' || '${name}' || '%version%'
                        or c.relname like '%' || '${name}' || '_log')) hist,
                  (select count(*) from pg_attribute a
                    where a.attrelid = '${res}'::regclass and a.attnum > 0 and not a.attisdropped
                      and a.attname in ('deleted_at','removed_at','archived_at','is_deleted')) softdel,
                  (select count(*) from pg_trigger tg
                    where tg.tgrelid = '${res}'::regclass and not tg.tgisinternal
                      and (tg.tgtype & 8) <> 0) deltrig
               ) x`;
}

// ---------------------------------------------------------------------------
// derivation over the whole plan
// ---------------------------------------------------------------------------

export interface DerivationResult {
  readonly specs: ReadonlyMap<string, ExecSpec>;
  readonly failures: readonly { testId: string; reason: string }[];
}

/** Derive a spec for every planned row. Never throws; collects failures. */
export function deriveAll(plan: Wp3Plan): DerivationResult {
  const specs = new Map<string, ExecSpec>();
  const failures: { testId: string; reason: string }[] = [];
  for (const t of plan.tests) {
    try {
      specs.set(t.testId, specFor(t));
    } catch (err) {
      failures.push({ testId: t.testId, reason: (err as Error).message });
    }
  }
  return { specs, failures };
}

// ---------------------------------------------------------------------------
// session pooling
// ---------------------------------------------------------------------------

/** Opens each distinct caller once and reuses it. */
export class CallerPool {
  private readonly sessions = new Map<string, Session>();
  private admin: Session | null = null;

  async get(c: Caller): Promise<Session> {
    if (c.kind === "external") {
      throw new Error(`caller "${c.label}" manages its own connection; the pool must not be asked for it`);
    }
    if (c.kind === "admin") {
      this.admin ??= await adminSession(c.label);
      return this.admin;
    }
    const key = c.label;
    const existing = this.sessions.get(key);
    if (existing) return existing;
    const s = await roleSession({
      role: c.role,
      claims: c.subject ? claimsFor(c.subject) : null,
      label: c.label,
    });
    this.sessions.set(key, s);
    return s;
  }

  async closeAll(): Promise<void> {
    for (const s of this.sessions.values()) await s.close().catch(() => {});
    if (this.admin) await this.admin.close().catch(() => {});
    this.sessions.clear();
    this.admin = null;
  }
}

/** Run one plain SQL or RPC spec and capture the outcome. */
export async function runSqlSpec(session: Session, spec: ExecSpec): Promise<Outcome> {
  return execute(session, spec.statement, spec.params);
}

/** Run a catalog assertion, turning `ok/detail` into an outcome. */
export async function runCatalogSpec(admin: Session, spec: ExecSpec): Promise<{ outcome: Outcome; detail: string }> {
  const o = await execute(admin, spec.assertSql ?? "select true as ok, '' as detail");
  if (o.harnessError || o.raised) return { outcome: o, detail: o.message ?? "catalog read failed" };
  const row = (o.sample[0] ?? {}) as { ok?: boolean; detail?: string };
  return {
    outcome: { ...o, rowCount: row.ok === true ? 1 : 0 },
    detail: row.detail ?? "",
  };
}

export { summarize };
