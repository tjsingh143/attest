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
 * must resolve. Preflight compiles every derived statement with PREPARE.
 *
 * A row that does not parse is a hard failure naming the Test ID. It is never
 * guessed at.
 *
 * ## What the executor may not do
 *
 * It may not make a security judgment and it may not change what a row asks.
 * The claims come from the approved `expected` text (wp3-claims.ts); the
 * verdict from the plan's `verdictWhenPredicted` and the evaluator. Where an
 * approved operation leaves something unstated that a statement needs — the
 * receiver of a friend request whose row is "with sender_id = alice", the value
 * a function's signature names but the operation does not give — the executor
 * binds a deterministic value, says so in `bindingNotes`, and the evidence
 * record carries the note. It never substitutes a value the approved text DOES
 * give (D3.39).
 *
 * One Test ID produces exactly one probe statement. Setup, premises, guards
 * and reference observations are separate, labelled parts of the evidence
 * (wp3-bindings.ts), never folded into the probe.
 */
import { quoteIdent } from "./db.ts";
import type { PlannedTest, Wp3Plan } from "./wp3-plan.ts";
import { FIXTURES } from "../rubric/fixtures.ts";
import { AUX } from "./seed-extensions.ts";
import { MALFORMED_SQLSTATES } from "./wp3-outcome.ts";

// ---------------------------------------------------------------------------
// identities
// ---------------------------------------------------------------------------

export type SubjectName = "alice" | "bob" | "carol" | "dave" | "erin";

const UID: Record<SubjectName, string> = {
  alice: FIXTURES.alice.value,
  bob: FIXTURES.bob.value,
  carol: FIXTURES.carol.value,
  dave: FIXTURES.dave.value,
  erin: FIXTURES.erin.value,
};

export function uidOf(sub: SubjectName): string {
  return UID[sub];
}

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
 * The caller a row runs as: its structured `identity`, and nothing else
 * (D3.33). A disagreement between identity and operation is a plan
 * contradiction for preflight to refuse, not something the executor settles.
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
  /** The statement or call to issue. For the composite kinds, a description; the runner records the real one. */
  readonly statement: string;
  readonly params: readonly unknown[];
  /** For rpc: the identity-qualified function. */
  readonly functionCall?: string;
  /** For rpc: the bare function name, which a function-body refusal must be raised inside. */
  readonly calledFunction?: string;
  /** Sub-probe selector for the composite kinds. */
  readonly variant?: string;
  /** Catalog assertions return one row of named booleans plus `detail`. */
  readonly assertSql?: string;
  /**
   * Statements to issue on the same session BEFORE the probe. `realtime.messages`
   * policies read `realtime.topic()`, a GUC, so the topic is set first — as its
   * own statement, because a multi-statement query carrying a bind parameter is
   * rejected with 42601 (D3.30).
   */
  readonly preStatements?: readonly { sql: string; params: readonly unknown[] }[];
  /** The relation a SQL probe acts on. */
  readonly relation?: string;
  /** What the executor had to bind that the approved operation leaves unstated (D3.39). */
  readonly bindingNotes?: readonly string[];
  /**
   * Static classification for isolation (R7): this probe commits a change when
   * its control HOLDS — a positive write, a VOLATILE function the approved row
   * expects to run, a composite runner that writes. A probe that is refused
   * when the control holds is not classified here; if it changes state anyway
   * the post-probe digest says so and the executor rebuilds.
   */
  readonly writesWhenControlHolds: boolean;
}

export const MALFORMED_PROBE = MALFORMED_SQLSTATES;

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

/**
 * The owner column each resource links identity through, for the deleted-user
 * boundary rows. `private.game_commands` names its caller `user_id`; the
 * previous map said `actor_user_id`, a column that does not exist (D3.36).
 */
const OWNER_COL: Readonly<Record<string, string>> = {
  "private.game_commands": "user_id",
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

/**
 * The one row an F10 immutability UPDATE or DELETE names ("UPDATE one row of
 * X"): a fixture row the probe can point at by a deterministic key, so the
 * statement is about one row, as approved, rather than `where true`.
 */
const TRAIL_ROW: Readonly<Record<string, { col: string; where: string; params: readonly unknown[]; touch: string }>> = {
  "private.game_commands": { col: "id", where: `"id" = $1`, params: [AUX.commandAlice], touch: "command_type" },
  "public.game_events": { col: "id", where: `"id" = $1`, params: [FIXTURES.publicGameEvent.value], touch: "type" },
  "public.rate_limit_events": { col: "id", where: `"id" = $1`, params: [AUX.rateBobFresh], touch: "action" },
  "public.wallet_ledger": { col: "idempotency_key", where: `"idempotency_key" = $1`, params: [`initial_grant:${FIXTURES.alice.value}`], touch: "reason" },
};

/** The actor/action/time columns an audit-existence probe reads (D3.6 #5, #6). */
const AUDIT_COLUMNS: Readonly<Record<string, readonly string[]>> = {
  "private.game_commands": ["user_id", "command_type", "created_at"],
  "public.game_events": ["type", "created_at"],
  "public.rate_limit_events": ["user_id", "action", "occurred_at"],
  "public.wallet_ledger": ["user_id", "reason", "created_at"],
};

/**
 * The rest of a WITH CHECK row. The approved F3 operation names only the
 * column the policy compares ("INSERT into public.blocks with blocker_id = …");
 * a statement also needs every NOT NULL column without a default, and a value
 * that collides with no unique key, or the positive never reaches WITH CHECK
 * (R3). The negative inserts the SAME row with only the compared column
 * changed, so the one variable between the pair is the one the policy reads.
 */
const INSERT_COMPLETION: Readonly<Record<string, { cols: readonly string[]; values: readonly unknown[]; note: string }>> = {
  "public.blocks": {
    cols: ["blocked_id"], values: [FIXTURES.carol.value],
    note: "blocked_id bound to carol: an account the row's blocker has not blocked, so no unique key or self-block CHECK intervenes",
  },
  "public.friend_requests": {
    cols: ["receiver_id"], values: [FIXTURES.carol.value],
    note: "receiver_id bound to carol: not the sender, not blocked either way, not already a friend, and (after the probe-scoped setup where needed) no pending request on the pair; status takes its default 'pending'",
  },
  "public.loadouts": {
    cols: [], values: [],
    note: "no further column is required; the unique key on user_id is cleared by the probe-scoped setup",
  },
  "public.push_tokens": {
    cols: ["token", "platform"], values: ["ExponentPushToken[attest-probe-f3]", "ios"],
    note: "token bound to a fresh string no row carries (push_tokens_token_key), platform to 'ios'",
  },
};

/**
 * The value each caller-scoped function's signature names but the approved
 * operation does not give ("call enforce_rate_limit(p_action text) as alice
 * …"). The previous derivation bound the SIGNATURE TEXT itself — the string
 * "p_limit integer" as an integer (22P02), "p_action text" as an action
 * (22023 'no rate limit policy is configured'), so each would have raised for
 * the harness's reason and been recorded against Arc21 (D3.39).
 */
const SIGNATURE_BINDINGS: Readonly<Record<string, { args: readonly unknown[]; sql: string; note: string }>> = {
  enforce_rate_limit: {
    args: ["player_search"], sql: "$1",
    note: "p_action bound to 'player_search': a configured action, and the one bob's and carol's rate-limit history is seeded under",
  },
  my_leaderboard_position: {
    args: ["weekly_xp"], sql: "$1",
    note: "p_category bound to 'weekly_xp': a category the body recognises, over a board bob, carol's peers and alice all appear on",
  },
  my_notifications: {
    args: [50], sql: "$1",
    note: "p_limit bound to 50, the function's own default",
  },
};

const ctrlSuffix = (t: PlannedTest) => (t.control.includes("#") ? t.control.replace(/^[^#]*#/, "") : t.control);

/** Strip the disambiguating tag the D3.14 splits added, e.g. `f(a uuid [tag])`. */
export function functionIdentity(resource: string): { schema: string; name: string; args: string } {
  const m = /^([a-z_]+)\.([a-z_0-9]+)\(([\s\S]*)\)$/.exec(resource.trim());
  if (!m) throw new Error(`cannot parse a function identity from "${resource}"`);
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
  const base = { testId: t.testId, caller, params: [] as unknown[] };
  const pos = t.polarity === "positive";

  // --- F2 grant surface: the approved statement, verbatim ------------------
  // The control is the ABSENCE of the privilege. The previous derivation
  // issued `set c = c where false` instead of the approved statement; with a
  // rebuild after any probe that changes state (R7) there is no reason to
  // deviate, and the evidence now records the statement that was approved.
  let m = /^grant:authenticated:(INSERT|UPDATE|DELETE)$/.exec(suffix);
  if (m) {
    const cmd = m[1]!;
    if (cmd === "INSERT") {
      return {
        ...base, kind: "sql", relation: res, statement: `insert into ${res} default values`, writesWhenControlHolds: false,
        bindingNotes: ["the approved operation offers 'default values, or the minimum NOT NULL set'; DEFAULT VALUES is issued, because the privilege check precedes any column"],
      };
    }
    if (cmd === "DELETE") {
      if (!/^delete from \S+$/.test(t.operation)) throw new Error(`${t.testId}: unexpected DELETE form "${t.operation}"`);
      return { ...base, kind: "sql", relation: res, statement: t.operation, writesWhenControlHolds: false };
    }
    const um = /^update (\S+) set ([a-z_]+) = (.+)$/.exec(t.operation);
    if (!um || um[1] !== res) throw new Error(`${t.testId}: unexpected UPDATE form "${t.operation}"`);
    return { ...base, kind: "sql", relation: res, statement: `update ${res} set ${quoteIdent(um[2]!)} = ${um[3]!}`, writesWhenControlHolds: false };
  }

  // --- F6 column grants ----------------------------------------------------
  if (suffix === "colgrant:SELECT") {
    const cols = /^SELECT\s+([a-z_, ]+?)\s+from\s/i.exec(t.operation)?.[1];
    if (!cols) throw new Error(`${t.testId}: no column list in "${t.operation}"`);
    return { ...base, kind: "sql", relation: res, statement: `select ${cols} from ${res}`, writesWhenControlHolds: false };
  }
  if (suffix === "colgrant:UPDATE") {
    const mm = /^UPDATE\s+\S+\s+set\s+([a-z_]+)\s*=\s*(.+?)(?:\s+where\s+([a-z_]+)\s*=\s*(\S+))?$/i.exec(t.operation);
    if (!mm) throw new Error(`${t.testId}: cannot parse "${t.operation}"`);
    const [, col, rawVal, whereCol, whereRef] = mm;
    const value = resolveRefs(rawVal!.trim()).value;
    if (!whereCol || !whereRef) throw new Error(`${t.testId}: an F6 UPDATE without a WHERE`);
    return {
      ...base, kind: "sql", relation: res, writesWhenControlHolds: pos,
      statement: `update ${res} set ${quoteIdent(col!)} = ${value} where ${quoteIdent(whereCol)} = $1`,
      params: [resolveRefs(whereRef).value],
    };
  }

  // --- F4 anon reach: no policy admits the caller --------------------------
  if (suffix === "anon-reach") {
    return { ...base, kind: "sql", relation: res, statement: `select * from ${res}`, writesWhenControlHolds: false };
  }

  // --- F7 per-resource characterization ------------------------------------
  if (suffix === "rls_forced") {
    return {
      ...base, kind: "catalog", statement: `pg_class read for ${res}`, relation: res, writesWhenControlHolds: false,
      assertSql:
        `select c.relrowsecurity as rls_enabled, not c.relforcerowsecurity as rls_not_forced,
                pg_get_userbyid(c.relowner) as owner,
                'rls_enabled = ' || c.relrowsecurity::text || ', rls_forced = ' || c.relforcerowsecurity::text ||
                ', owner = ' || pg_get_userbyid(c.relowner) as detail
           from pg_class c where c.oid = '${res}'::regclass`,
    };
  }
  if (suffix === "pg_roles: rolsuper / rolbypassrls / relowner") {
    return { ...base, kind: "f7_roles", statement: "pg_roles / pg_class read", writesWhenControlHolds: false };
  }
  if (suffix === "FORCE ROW LEVEL SECURITY vs BYPASSRLS") {
    const step = /NOT forced/i.test(t.operation) ? "unforced_owner" : /enable FORCE/i.test(t.operation) ? "forced_owner" : "forced_bypass";
    return { ...base, kind: "f7_mechanism", statement: `scratch-table demonstration: ${step}`, variant: step, writesWhenControlHolds: false };
  }

  // --- F10 audit trail ------------------------------------------------------
  if (suffix === "audit:absent") {
    return {
      ...base, kind: "audit_absence", relation: res, writesWhenControlHolds: false,
      statement: `catalog search for a history/versioning/audit relation covering ${res}`,
      assertSql: auditAbsenceSql(res),
    };
  }
  m = /^audit:immutable:(UPDATE|DELETE|TRUNCATE)$/.exec(suffix);
  if (m) {
    const cmd = m[1]!;
    if (cmd === "TRUNCATE") return { ...base, kind: "sql", relation: res, statement: `truncate ${res}`, writesWhenControlHolds: false };
    const row = TRAIL_ROW[res];
    if (!row) throw new Error(`${t.testId}: no trail row known for ${res}`);
    const note = `"one row of ${res}" bound to the fixture row ${row.col} = ${String(row.params[0])}`;
    if (cmd === "DELETE") {
      return { ...base, kind: "sql", relation: res, statement: `delete from ${res} where ${row.where}`, params: [...row.params], writesWhenControlHolds: false, bindingNotes: [note] };
    }
    return {
      ...base, kind: "sql", relation: res, writesWhenControlHolds: false, params: [...row.params],
      statement: `update ${res} set ${quoteIdent(row.touch)} = ${quoteIdent(row.touch)} where ${row.where}`,
      bindingNotes: [note, `the approved operation names no column; ${row.touch} is set to itself, so the statement changes nothing but still requires UPDATE`],
    };
  }
  if (/^audit:exists$/.test(suffix)) {
    const cols = AUDIT_COLUMNS[res];
    if (!cols) throw new Error(`${t.testId}: no audit columns known for ${res}`);
    return { ...base, kind: "sql", relation: res, statement: `select ${cols.join(", ")} from ${res} limit 5`, writesWhenControlHolds: false };
  }

  // --- F5 SECURITY DEFINER --------------------------------------------------
  if (suffix === "security_definer") {
    const { schema, name, args } = functionIdentity(res);
    const call = parseCall(t, name);
    return {
      ...base, kind: "rpc", statement: call.sql, params: call.params,
      functionCall: `${schema}.${name}(${args})`, calledFunction: name,
      bindingNotes: call.notes, writesWhenControlHolds: F5_WRITES_WHEN_HOLDING.has(t.testId.replace(/\.\d+$/, "")) || F5_WRITES_BY_TEST.has(t.testId),
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
    return { ...base, kind: "f9", statement: op, variant, writesWhenControlHolds: variant === "concurrent" || variant === "idempotent" };
  }

  // --- F8 realtime ----------------------------------------------------------
  if (suffix === "realtime-socket") {
    const variant = /publish/i.test(t.operation) ? "publish_denied" : pos ? "subscribe_ok" : "subscribe_denied";
    // Every socket runner has the server broadcast onto the topic, which
    // writes a realtime.messages row.
    return { ...base, kind: "socket", statement: t.operation, variant, writesWhenControlHolds: true };
  }

  // --- boundary -------------------------------------------------------------
  if (suffix === "PostgREST / GoTrue JWT verification") {
    return { ...base, kind: "http", statement: "GET /rest/v1/profiles with an expired bearer token", variant: "expired_jwt", writesWhenControlHolds: false };
  }
  if (/^boundary:null-identity$/.test(suffix)) {
    return { ...base, kind: "sql", relation: res, statement: `select * from ${res}`, writesWhenControlHolds: false };
  }
  if (/^boundary:deleted-user$/.test(suffix)) {
    const col = OWNER_COL[res];
    if (!col) throw new Error(`${t.testId}: no owner column known for ${res}`);
    return {
      ...base, kind: "sql", relation: res, statement: `select * from ${res} where ${quoteIdent(col)} = $1`,
      params: [refValue("fixtures.dave.id")], writesWhenControlHolds: false,
    };
  }

  // --- policy probes (F1, F2 policy, F3, F4 predicate, F8 SQL) --------------
  if (/^policy:/.test(suffix)) return policySpec(t, base);

  throw new Error(`${t.testId}: no executor derivation for control "${t.control}"`);
}

/**
 * F5 functions whose approved row expects the call to RUN and write when the
 * control holds — keyed on the function, not a Test ID number. A refusal row
 * (get_room_state, sprint_standings, …) is absent: when its control holds it
 * writes nothing, and if it writes anyway the digest catches it.
 */
const F5_WRITES_WHEN_HOLDING: ReadonlySet<string> = new Set([
  "F5.block_player", "F5.register_push_token", "F5.join_private_room", "F5.search_players",
  "F5.ensure_todays_daily_challenge", "F5.join_matchmaking", "F5.poll_matchmaking",
  "F5.claim_recovery_grant", "F5.delete_own_account", "F5.grant_earned_cosmetics", "F5.leave_matchmaking",
  "F5.touch_last_seen", "F5.enforce_rate_limit",
]);
const F5_WRITES_BY_TEST: ReadonlySet<string> = new Set();

/** F1/F2/F3/F4/F8 rows, all of which name a policy. */
function policySpec(
  t: PlannedTest,
  base: { testId: string; caller: Caller; params: unknown[] },
): ExecSpec {
  const res = t.resource;
  const op = t.operation;
  const pos = t.polarity === "positive";

  // realtime.messages: the topic GUC is what the policies read.
  if (res === "realtime.messages") {
    // "set realtime.topic to fixtures.session.topic, then …": the reference
    // ends at the first character a fixture reference cannot contain. The
    // previous parser took every non-space character and kept the comma, so
    // four probes read the topic "game:…001," which exists nowhere (R2).
    const topicRef = /set realtime\.topic to (fixtures\.[A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)?|the game topic)/.exec(op)?.[1];
    if (!topicRef) throw new Error(`${t.testId}: no topic in "${op}"`);
    const topic = topicRef === "the game topic" ? refValue("fixtures.session.topic") : resolveRefs(topicRef).value;
    const setTopic = [{ sql: `select set_config('realtime.topic', $1, false)`, params: [topic] }];
    if (/insert into/i.test(op)) {
      return {
        ...base, kind: "sql", relation: res, preStatements: setTopic, writesWhenControlHolds: pos,
        statement:
          `insert into realtime.messages (topic, extension, payload, event, private) ` +
          `values ($1, 'broadcast', '{"attest":true}'::jsonb, 'state', true)`,
        params: [topic],
      };
    }
    return {
      ...base, kind: "sql", relation: res, preStatements: setTopic, writesWhenControlHolds: false,
      statement: `select * from realtime.messages where topic = $1`,
      params: [topic],
    };
  }

  // INSERT probes (F3): the compared column from the approved row, the rest
  // completed so the row reaches WITH CHECK (R3).
  let m = /^INSERT into \S+ with ([a-z_]+) = (fixtures\.\w+\.\w+)/i.exec(op);
  if (m) {
    const col = m[1]!, value = resolveRefs(m[2]!).value;
    const done = INSERT_COMPLETION[res];
    if (!done) throw new Error(`${t.testId}: no row completion known for ${res}`);
    const cols = [col, ...done.cols];
    const params = [value, ...done.values];
    return {
      ...base, kind: "sql", relation: res, writesWhenControlHolds: pos,
      statement: `insert into ${res} (${cols.map(quoteIdent).join(", ")}) values (${params.map((_, i) => `$${i + 1}`).join(", ")})`,
      params, bindingNotes: [done.note],
    };
  }

  // UPDATE / DELETE probes keyed on a predicate column.
  m = /^(update|delete)\s+(?:from\s+)?\S+\s+(?:set\s+([a-z_]+)\s*=\s*(\S+)\s+)?where\s+([a-z_]+)\s*=\s*(fixtures\.\w+\.\w+)/i.exec(op);
  if (m) {
    const [, verb, setCol, setVal, whereCol, whereRef] = m;
    const value = resolveRefs(whereRef!).value;
    if (verb!.toLowerCase() === "delete") {
      return { ...base, kind: "sql", relation: res, statement: `delete from ${res} where ${quoteIdent(whereCol!)} = $1`, params: [value], writesWhenControlHolds: pos };
    }
    if (setCol) {
      return {
        ...base, kind: "sql", relation: res, writesWhenControlHolds: pos,
        statement: `update ${res} set ${quoteIdent(setCol)} = ${resolveRefs(setVal!).value} where ${quoteIdent(whereCol!)} = $1`,
        params: [value],
      };
    }
    // The approved F2 UPDATE names no SET. The executor picks a granted
    // column whose new value is one the application permits the caller to
    // write, so the probe tests the policy and not a column grant or a write
    // guard.
    const touch = UPDATE_TOUCH[res];
    if (!touch) throw new Error(`${t.testId}: no update binding known for ${res}`);
    return {
      ...base, kind: "sql", relation: res, writesWhenControlHolds: pos,
      statement: `update ${res} set ${quoteIdent(touch.col)} = ${touch.value} where ${quoteIdent(whereCol!)} = $1`,
      params: [value], bindingNotes: [touch.note],
    };
  }

  // SELECT keyed on an ownership column.
  m = /^select from \S+ where ([a-z_]+) = (fixtures\.\w+\.\w+)/i.exec(op);
  if (m) {
    return {
      ...base, kind: "sql", relation: res, writesWhenControlHolds: false,
      statement: `select * from ${res} where ${quoteIdent(m[1]!)} = $1`, params: [resolveRefs(m[2]!).value],
    };
  }

  // SELECT over a multi-clause OR predicate: the fixture row names neither party.
  m = /^select from \S+ for a row where NONE of ([a-z_, ]+) is /i.exec(op);
  if (m) {
    const cols = m[1]!.split(",").map((c) => c.trim()).filter(Boolean);
    const conj = cols.map((c) => `${quoteIdent(c)} <> $1`).join(" and ");
    return { ...base, kind: "sql", relation: res, writesWhenControlHolds: false, statement: `select * from ${res} where ${conj}`, params: [refValue("fixtures.alice.id")] };
  }

  // SELECT gated by membership rather than ownership.
  m = /^select from \S+ for (?:that same )?(?:game session|room|tournament)?\s*(fixtures\.\w+\.\w+)/i.exec(op);
  if (m) {
    const fk = MEMBERSHIP_FK[res];
    if (!fk) throw new Error(`${t.testId}: no membership column known for ${res}`);
    const extra = /visibility = 'public'/.test(op) ? ` and visibility = 'public'` : "";
    return {
      ...base, kind: "sql", relation: res, writesWhenControlHolds: false,
      statement: `select * from ${res} where ${quoteIdent(fk)} = $1${extra}`, params: [resolveRefs(m[1]!).value],
    };
  }

  // F4's predicate rows.
  m = /^select from \S+ for (?:the seeded row where|a row satisfying) (.+)$/i.exec(op);
  if (m) {
    return { ...base, kind: "sql", relation: res, writesWhenControlHolds: false, statement: `select * from ${res} where ${m[1]!.trim()}` };
  }

  throw new Error(`${t.testId}: cannot derive a policy probe from "${op}"`);
}

/** A column (and value) an approved F2 UPDATE that names no SET is issued with. */
const UPDATE_TOUCH: Readonly<Record<string, { col: string; value: string; note: string }>> = {
  "public.friend_requests": {
    col: "status", value: `'cancelled'`,
    note: "the approved UPDATE names no column. status is the only client-granted column, and guard_friend_request_transition lets a SENDER make exactly one change — to 'cancelled' — so that is the value; any other would be refused by the trigger before the policy's USING could be observed",
  },
  "public.loadouts": {
    col: "avatar_cosmetic_id", value: `"avatar_cosmetic_id"`,
    note: "the approved UPDATE names no column; a granted slot is set to itself, which guard_loadout_slots accepts",
  },
  "public.profiles": {
    col: "bio", value: `"bio"`,
    note: "the approved UPDATE names no column; bio (granted, and read by no trigger) is set to itself",
  },
};

/**
 * Parse `as <who>, call f(args…)` into a callable statement.
 *
 * Three shapes are bound rather than copied, each recorded in `notes`:
 * a signature placeholder (`p_action text`) the approved row never filled; an
 * elision (`...`) meaning "the remaining arguments", which take the function's
 * own defaults; and "call it for the seeded challenge date", which names the
 * date of the seeded challenge rather than giving it.
 */
function parseCall(t: PlannedTest, fn: string): { sql: string; params: unknown[]; notes: string[] } {
  const { schema, name } = functionIdentity(t.resource);
  const op = t.operation;
  const notes: string[] = [];

  const sig = SIGNATURE_BINDINGS[fn];
  if (sig && /^call [a-z_]+\([a-z_]+ [a-z ]+\) as /.test(op)) {
    notes.push(sig.note);
    return { sql: `select * from ${schema}.${name}(${sig.sql})`, params: [...sig.args], notes };
  }
  if (/call it for the seeded challenge date/.test(op)) {
    notes.push("\"the seeded challenge date\" bound to today's UTC date, the date of the daily challenge the fixture seeds; p_limit and p_offset take the function's defaults");
    return { sql: `select * from ${schema}.${name}((now() at time zone 'utc')::date)`, params: [], notes };
  }

  const argText = /\bcall\s+(?:it|[a-z_0-9]+)\s*\(([\s\S]*?)\)(?:\s|$|,|—)/.exec(op)?.[1];
  if (argText === undefined || argText.trim() === "") {
    if (/call it and inspect/.test(op) && argText === undefined) {
      notes.push("the approved operation calls the function with no arguments; every parameter takes the function's own default");
    }
    return { sql: `select * from ${schema}.${name}()`, params: [], notes };
  }
  let parts = splitArgs(argText.trim());
  if (parts[parts.length - 1] === "...") {
    parts = parts.slice(0, -1);
    notes.push("the approved operation elides the remaining arguments ('...'); they take the function's own defaults rather than values the harness would invent");
  }
  const params: unknown[] = [];
  const placeholders = parts.map((p) => literalArg(p, params));
  return { sql: `select * from ${schema}.${name}(${placeholders.join(", ")})`, params, notes };
}

/** Split an argument list on commas that are not inside brackets or quotes. */
function splitArgs(s: string): string[] {
  const out: string[] = [];
  let depth = 0, quoted = false, cur = "";
  for (const ch of s) {
    if (ch === "'") quoted = !quoted;
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
  if (/^[a-z_]+ [a-z_ ]+$/.test(a) && !/^'/.test(a)) {
    throw new Error(`the argument "${a}" is a signature placeholder, not a value; bind it in SIGNATURE_BINDINGS`);
  }
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
  throw new Error(`cannot bind the argument "${a}"`);
}

/** Search the catalogs for any trail covering a resource. */
function auditAbsenceSql(res: string): string {
  const [, name] = res.split(".");
  return `select (hist = 0 and softdel = 0 and deltrig = 0) as no_trail,
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
