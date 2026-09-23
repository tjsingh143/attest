/**
 * Attest — WP3 execution readiness.
 *
 * Preflight already asks whether the plan is intact, whether its fixtures
 * exist, and whether the author has spoken. This module asks the question
 * those leave open: if the 345 probes ran right now, would each verdict mean
 * what it says?
 *
 * It was written because the answer turned out to be no, for reasons none of
 * the existing gates could see (D3.36). A probe can derive, name real objects,
 * find its fixture present, and still be unable to produce a meaningful
 * verdict: its subject set is empty, so a refusal proves nothing; its INSERT
 * omits a NOT NULL column, so a working control records `deficient`; its
 * assertion cannot tell a no-op from an effect; its premise is contradicted by
 * another row's fixture; or an earlier probe's committed side effect has
 * already changed the state it depends on.
 *
 * Each check here is computed — from the plan, the derived probes, the
 * catalog, or an admin-side count of the fixture state — never listed by hand,
 * except the premises, which are written from each row's own approved text the
 * way the state guards are. None of it executes a probe or exercises a control:
 * the live reads are admin-side counts of seeded state and catalog lookups, the
 * same kind of read the fixture verification already makes.
 *
 * A failing check here blocks execution exactly as a plan contradiction does.
 * Resolving one is either Attest-side work (a fixture, an assertion, an
 * isolation mechanism) or, where it would change an approved row, the author's
 * decision.
 */
import type { Session } from "./db.ts";
import type { PlannedTest, Wp3Plan } from "./wp3-plan.ts";
import type { ExecSpec } from "./wp3-exec.ts";
import { assertionImplementedFor } from "./wp3-assertions.ts";
import { FIXTURES } from "../rubric/fixtures.ts";

export interface ReadinessCheck {
  readonly id: string;
  readonly name: string;
  readonly passed: boolean;
  readonly testIds: readonly string[];
  readonly detail: string;
  /** Per-row explanations, for the report and the author. */
  readonly rows: readonly { readonly testId: string; readonly why: string }[];
}

const F = FIXTURES;
const uid = (x: { value: string }) => x.value;

// ---------------------------------------------------------------------------
// R1 — custom expectations nobody implemented
// ---------------------------------------------------------------------------

/** Static: every custom expectation on a SQL or RPC probe has an assertion. */
export function checkAssertionCoverage(plan: Wp3Plan, specs: ReadonlyMap<string, ExecSpec>): ReadinessCheck {
  const rows: { testId: string; why: string }[] = [];
  for (const t of plan.tests) {
    const s = specs.get(t.testId);
    if (!s || s.expect.kind !== "custom" || (s.kind !== "sql" && s.kind !== "rpc")) continue;
    if (!assertionImplementedFor(t)) {
      rows.push({ testId: t.testId, why: `no assertion recognises "${t.expected.slice(0, 90)}…" — it would be recorded deficient whatever the control did` });
    }
  }
  return {
    id: "R1", name: "every custom expectation has an implemented assertion",
    passed: rows.length === 0, testIds: rows.map((r) => r.testId), rows,
    detail: rows.length ? `${rows.length} row(s) with no assertion: ${rows.map((r) => r.testId).join(", ")}` : "every custom expectation is recognised",
  };
}

// ---------------------------------------------------------------------------
// R2 — empty subjects
// ---------------------------------------------------------------------------

interface Subject {
  readonly relation: string;
  readonly where: string | null;
  readonly privilege: "SELECT" | "UPDATE" | "DELETE";
}

/** The set of rows a probe acts on, read back out of its derived statement. */
function subjectOf(s: ExecSpec): Subject | null {
  const st = s.statement.trim().replace(/\s+limit\s+\d+\s*$/i, "");
  let m = /^select\s+[\s\S]+?\s+from\s+((?:public|private|realtime)\.[a-z_0-9]+)(?:\s+where\s+([\s\S]+))?$/i.exec(st);
  if (m) return { relation: m[1]!, where: m[2] ?? null, privilege: "SELECT" };
  m = /^update\s+((?:public|private|realtime)\.[a-z_0-9]+)\s+set\s+[\s\S]+?\s+where\s+([\s\S]+)$/i.exec(st);
  if (m) return { relation: m[1]!, where: m[2]!, privilege: "UPDATE" };
  m = /^delete\s+from\s+((?:public|private|realtime)\.[a-z_0-9]+)(?:\s+where\s+([\s\S]+))?$/i.exec(st);
  if (m) return { relation: m[1]!, where: m[2] ?? null, privilege: "DELETE" };
  return null;
}

/**
 * Which rows' verdicts depend on their subject set being non-empty.
 *
 * Excluded, because a privilege refusal does not need a row to refuse: the F2
 * grant-surface probes (`where false`, or no WHERE at all), the F6 negatives
 * (column privilege), the F10 immutability probes (no client write grant), and
 * INSERT and TRUNCATE, which have no subject set.
 */
function subjectMatters(t: PlannedTest, s: ExecSpec, sub: Subject): boolean {
  if (s.kind !== "sql") return false;
  if (/#grant:|#audit:immutable:/.test(t.control)) return false;
  if (/#colgrant:/.test(t.control) && t.polarity !== "positive") return false;
  if (sub.where && /^(false|true)$/i.test(sub.where.trim())) return false;
  if (sub.privilege !== "SELECT" && !sub.where) return false;
  return true;
}

/**
 * Live: every probe whose verdict depends on its subject rows has some.
 *
 * Counted as admin with the probe's own WHERE clause and parameters. A positive
 * with an empty subject cannot succeed; a refusal against an empty subject
 * proves nothing — unless the caller's role lacks the privilege outright, in
 * which case the grant is the control and the rows do not matter.
 */
export async function checkSubjects(
  admin: Session,
  plan: Wp3Plan,
  specs: ReadonlyMap<string, ExecSpec>,
): Promise<ReadinessCheck> {
  const rows: { testId: string; why: string }[] = [];
  for (const t of plan.tests) {
    const s = specs.get(t.testId);
    if (!s) continue;
    const sub = subjectOf(s);
    if (!sub || !subjectMatters(t, s, sub)) continue;
    let n: number;
    try {
      const { rows: r } = await admin.query(
        `select count(*)::int as n from ${sub.relation}${sub.where ? ` where ${sub.where}` : ""}`,
        s.params as unknown[],
      );
      n = (r[0] as { n: number }).n;
    } catch (err) {
      // A subject that cannot even be counted is a malformed derivation; the
      // catalog check names it too. Recorded here so the row is not silently
      // skipped.
      rows.push({ testId: t.testId, why: `the subject cannot be counted — the derived statement is malformed: ${(err as Error).message}` });
      continue;
    }
    if (n > 0) continue;
    let rolePrivileged = true;
    if (t.polarity !== "positive" && s.caller.kind === "role") {
      // DELETE exists only at table level; SELECT and UPDATE may be granted
      // per column, so "any column" is the right question for those.
      const { rows: p } = await admin.query(
        sub.privilege === "DELETE"
          ? `select has_table_privilege($1, $2::regclass, $3) as ok`
          : `select has_any_column_privilege($1, $2::regclass, $3) as ok`,
        [s.caller.role, sub.relation, sub.privilege],
      );
      rolePrivileged = (p[0] as { ok: boolean }).ok;
    }
    if (!rolePrivileged) continue;
    // The bound values are part of the evidence: a subject can be empty
    // because the fixture is missing, or because the derivation bound the
    // wrong value — the F8 topic parser, for one, keeps a trailing comma.
    const bound = s.params.length ? ` [bound: ${s.params.map((v) => JSON.stringify(v)).join(", ")}]` : "";
    rows.push({
      testId: t.testId,
      why:
        t.polarity === "positive"
          ? `positive expecting "${t.expected.slice(0, 40)}…" but ${sub.relation}${sub.where ? ` where ${sub.where}` : ""}${bound} holds 0 rows — it cannot succeed, and would record deficient`
          : `${t.polarity} expecting a refusal, but ${sub.relation}${sub.where ? ` where ${sub.where}` : ""}${bound} holds 0 rows and the caller holds ${sub.privilege} — "no data" would be true because there was nothing to return`,
    });
  }
  return {
    id: "R2", name: "every probe's subject rows exist, so no verdict is vacuous",
    passed: rows.length === 0, testIds: rows.map((r) => r.testId), rows,
    detail: rows.length
      ? `${rows.length} row(s) act on an empty set: ${rows.map((r) => r.testId).join(", ")}`
      : "every positive has something to find, and every refusal has something to refuse",
  };
}

// ---------------------------------------------------------------------------
// R3 — INSERT positives that cannot succeed
// ---------------------------------------------------------------------------

/** Live: an INSERT positive supplies every NOT NULL column and violates no unique key. */
export async function checkInsertPositives(
  admin: Session,
  plan: Wp3Plan,
  specs: ReadonlyMap<string, ExecSpec>,
): Promise<ReadinessCheck> {
  const rows: { testId: string; why: string }[] = [];
  for (const t of plan.tests) {
    const s = specs.get(t.testId);
    if (!s || s.kind !== "sql" || t.polarity !== "positive") continue;
    const m = /^insert into\s+((?:public|private|realtime)\.[a-z_0-9]+)\s*\(([^)]*)\)\s*values\s*\(([\s\S]*)\)\s*$/i.exec(s.statement.trim());
    if (!m) continue;
    const rel = m[1]!;
    const cols = m[2]!.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
    const vals = m[3]!.split(/,(?![^(]*\))/).map((v) => v.trim());
    const { rows: req } = await admin.query(
      `select a.attname::text as col from pg_attribute a
        where a.attrelid = $1::regclass and a.attnum > 0 and not a.attisdropped
          and a.attnotnull and not a.atthasdef and a.attidentity = '' and a.attgenerated = ''`,
      [rel],
    );
    const missing = req.map((r) => (r as { col: string }).col).filter((c) => !cols.includes(c));
    const problems: string[] = [];
    if (missing.length) problems.push(`omits NOT NULL column(s) with no default: ${missing.join(", ")} (23502)`);
    // Single-column unique keys whose value the probe binds.
    const { rows: uniq } = await admin.query(
      `select a.attname::text as col from pg_index i
         join pg_attribute a on a.attrelid = i.indrelid and a.attnum = i.indkey[0]
        where i.indrelid = $1::regclass and i.indisunique and i.indnkeyatts = 1 and i.indpred is null`,
      [rel],
    );
    for (const u of uniq.map((r) => (r as { col: string }).col)) {
      const at = cols.indexOf(u);
      const pm = at >= 0 ? /^\$(\d+)$/.exec(vals[at] ?? "") : null;
      if (!pm) continue;
      const value = s.params[Number(pm[1]) - 1];
      const { rows: hit } = await admin.query(`select count(*)::int as n from ${rel} where "${u}" = $1`, [value]);
      if ((hit[0] as { n: number }).n > 0) problems.push(`a row with ${u} = ${String(value)} already exists, so the unique key on ${u} refuses it (23505)`);
    }
    if (problems.length) rows.push({ testId: t.testId, why: `\`${s.statement}\` ${problems.join("; ")} — the positive would record deficient against a working control` });
  }
  return {
    id: "R3", name: "every INSERT positive can succeed against the fixture",
    passed: rows.length === 0, testIds: rows.map((r) => r.testId), rows,
    detail: rows.length ? `${rows.length} INSERT positive(s) cannot succeed as derived: ${rows.map((r) => r.testId).join(", ")}` : "every INSERT positive supplies its required columns",
  };
}

// ---------------------------------------------------------------------------
// R4 — refusal / no-effect assertions that cannot judge a non-raising call
// ---------------------------------------------------------------------------

/**
 * Catalog: `select * from f()` returns exactly one row whenever a
 * non-set-returning function does not raise — a boolean, a text `'none'`, a
 * void, or a NULL composite. The assertion for "refusal" / "no effect" reads
 * that row as an effect. So a function that signals refusal by returning
 * (join_private_room returns NULL by design) or that no-ops and returns
 * (decline_friend_request returns 'none') would be recorded deficient while
 * the control held.
 */
export function checkNoEffectAssertions(
  plan: Wp3Plan,
  specs: ReadonlyMap<string, ExecSpec>,
  procs: ProcIndex,
): ReadinessCheck {
  const rows: { testId: string; why: string }[] = [];
  for (const t of plan.tests) {
    const s = specs.get(t.testId);
    if (!s || s.kind !== "rpc" || !s.functionCall) continue;
    const e = t.expected.trim();
    if (!/^(refusal|refused|no effect)\b/i.test(e) || /^refusal,\s+or\b/i.test(e)) continue;
    const p = procs.get(s.functionCall);
    if (!p || p.setof) continue;
    // Two ways the row-count judgement goes wrong. The expectation itself may
    // permit a no-op ("no effect", "refusal or no effect"), which a
    // single-row function reports as one returned row. Or the function may
    // refuse by RETURNING — join_private_room returns NULL "rather than raising"
    // by design. The second is read from the body, so it is a heuristic in the
    // same sense as D0.14's can_refuse flag, and is labelled as one.
    const permitsNoOp = /\bno effect\b/i.test(e);
    const refusesByReturn = /\breturn\s+null\b/i.test(p.body);
    if (!permitsNoOp && !refusesByReturn) continue;
    rows.push({
      testId: t.testId,
      why:
        `${s.functionCall} returns ${p.result}, so a call that does not raise returns exactly one row, and "${e.slice(0, 50)}…" ` +
        `is judged as "raised or 0 rows". ` +
        (permitsNoOp
          ? "The expectation permits a no-op, which would therefore be recorded as an effect"
          : "The body refuses by returning NULL (heuristic: a `return null` in the body), which would be recorded as an effect") +
        (s.stateGuard ? "; the state guard cannot rescue it, because the row-count half still fails" : "; and no state guard exists to judge the effect by"),
    });
  }
  return {
    id: "R4", name: "every refusal / no-effect assertion can judge a call that returns",
    passed: rows.length === 0, testIds: rows.map((r) => r.testId), rows,
    detail: rows.length
      ? `${rows.length} row(s) whose assertion treats any returned row as an effect: ${rows.map((r) => r.testId).join(", ")}`
      : "no refusal or no-effect assertion depends on a zero row count from a single-row function",
  };
}

// ---------------------------------------------------------------------------
// R5 — premises the fixture does not satisfy
// ---------------------------------------------------------------------------

interface Premise {
  readonly premise: string;
  readonly sql: string;
  readonly params: readonly unknown[];
}

const notRoomMember: Premise = {
  premise: "carol is not a member of fixtures.roomAliceBob",
  sql: `select count(*) = 0 as ok, 'carol rows in room_members for roomAliceBob: ' || count(*) || ' (need 0)' as detail
          from public.room_members where room_id = $1::uuid and user_id = $2::uuid`,
  params: [uid(F.roomAliceBob), uid(F.carol)],
};
const notEntrant: Premise = {
  premise: "carol holds no entry in fixtures.tournamentAliceBob",
  sql: `select count(*) = 0 as ok, 'carol entries in tournamentAliceBob: ' || count(*) || ' (need 0)' as detail
          from public.tournament_entries where tournament_id = $1::uuid and user_id = $2::uuid`,
  params: [uid(F.tournamentAliceBob), uid(F.carol)],
};
const pairCount = (table: "friendships" | "friend_requests") =>
  table === "friendships"
    ? `(select count(*) from public.friendships where (user_id_a, user_id_b) in ((PX, PY), (PY, PX)))`
    : `(select count(*) from public.friend_requests where (sender_id, receiver_id) in ((PX, PY), (PY, PX)))`;
const pair = (table: "friendships" | "friend_requests", x: string, y: string) =>
  pairCount(table).replaceAll("PX", x).replaceAll("PY", y);

/**
 * Each row's own approved text, turned into a check on the fixture state.
 *
 * For the seventeen rows C1 corrected, the premise is the relationship that
 * makes the corrected caller the refused one — it is the live half of "the
 * expected result is defined for that caller". The others are premises an
 * approved operation states ("when the friendship is alice↔bob", "for a
 * request alice sent to bob", "a non-friend", "a deleted account") that the
 * shared fixture does not, or cannot, satisfy.
 */
export function probePremises(plan: Wp3Plan): ReadonlyMap<string, Premise> {
  const m = new Map<string, Premise>();
  const byFn = (fn: string) => plan.tests.filter((t) => t.family.startsWith("F5") && t.resource.startsWith(`public.${fn}(`));
  const set = (fn: string, p: Premise, filter: (t: PlannedTest) => boolean = () => true) => {
    for (const t of byFn(fn).filter(filter)) m.set(t.testId, p);
  };
  for (const fn of ["get_room_state", "set_room_ready", "invite_friend_to_room", "leave_room", "caller_is_room_member"]) set(fn, notRoomMember);
  set("is_session_participant", {
    premise: "carol holds no seat at fixtures.session",
    sql: `select count(*) = 0 as ok, 'carol seats at the session: ' || count(*) || ' (need 0)' as detail
            from public.game_session_seats where game_session_id = $1::uuid and user_id = $2::uuid`,
    params: [uid(F.session), uid(F.carol)],
  });
  set("sprint_standings", notEntrant, (t) => t.polarity === "negative");
  set("viewer_is_in_tournament", notEntrant);
  set("accept_friend_request", {
    premise: "no request from alice to carol exists, and alice and carol are not friends",
    sql: `select (${pair("friend_requests", "$1::uuid", "$2::uuid")} = 0 and ${pair("friendships", "$1::uuid", "$2::uuid")} = 0) as ok,
                 'alice<->carol friend_requests: ' || ${pair("friend_requests", "$1::uuid", "$2::uuid")} ||
                 ', friendships: ' || ${pair("friendships", "$1::uuid", "$2::uuid")} || ' (need 0 and 0)' as detail`,
    params: [uid(F.alice), uid(F.carol)],
  });
  set("decline_friend_request", {
    premise: "a pending request alice sent to bob exists — the operation's \"for a request alice sent to bob\" — and carol is not its receiver",
    sql: `select count(*) = 1 as ok, 'pending alice->bob friend_requests: ' || count(*) || ' (need 1)' as detail
            from public.friend_requests where sender_id = $1::uuid and receiver_id = $2::uuid and status = 'pending'`,
    params: [uid(F.alice), uid(F.bob)],
  });
  set("unblock_player", {
    premise: "the alice→dave block exists and carol has no block on dave — \"when the alice→dave block is the one that exists\"",
    sql: `select (ad = 1 and cd = 0) as ok, 'alice->dave blocks: ' || ad || ' (need 1), carol->dave blocks: ' || cd || ' (need 0)' as detail
            from (select (select count(*) from public.blocks where blocker_id = $1::uuid and blocked_id = $3::uuid) ad,
                         (select count(*) from public.blocks where blocker_id = $2::uuid and blocked_id = $3::uuid) cd) x`,
    params: [uid(F.alice), uid(F.carol), uid(F.dave)],
  });
  set("remove_friend", {
    premise: "the alice↔bob friendship exists and carol shares neither a friendship nor a friend request with bob — \"when the friendship is alice↔bob\"",
    sql: `select (ab = 1 and cbf = 0 and cbr = 0) as ok,
                 'alice<->bob friendships: ' || ab || ' (need 1), carol<->bob friendships: ' || cbf ||
                 ' (need 0), carol<->bob friend_requests: ' || cbr || ' (need 0)' as detail
            from (select ${pair("friendships", "$1::uuid", "$2::uuid")} ab,
                         ${pair("friendships", "$3::uuid", "$2::uuid")} cbf,
                         ${pair("friend_requests", "$3::uuid", "$2::uuid")} cbr) x`,
    params: [uid(F.alice), uid(F.bob), uid(F.carol)],
  });
  set("viewer_is_friend_of", {
    premise: "carol and bob are not friends — \"when the friendship is alice↔bob\"",
    sql: `select cbf = 0 as ok, 'carol<->bob friendships: ' || cbf || ' (need 0)' as detail
            from (select ${pair("friendships", "$1::uuid", "$2::uuid")} cbf) x`,
    params: [uid(F.carol), uid(F.bob)],
  });
  set("viewer_has_blocked", {
    premise: "carol has blocked nobody",
    sql: `select count(*) = 0 as ok, 'blocks by carol: ' || count(*) || ' (need 0)' as detail from public.blocks where blocker_id = $1::uuid`,
    params: [uid(F.carol)],
  });
  set("viewer_is_blocked_by", {
    premise: "alice has not blocked carol — \"when the block is alice→dave\"",
    sql: `select count(*) = 0 as ok, 'alice->carol blocks: ' || count(*) || ' (need 0)' as detail
            from public.blocks where blocker_id = $1::uuid and blocked_id = $2::uuid`,
    params: [uid(F.alice), uid(F.carol)],
  });
  set("join_private_room", {
    premise: `no room carries the code ${F.nonexistentRoomCode.value}`,
    sql: `select count(*) = 0 as ok, 'rooms with that code: ' || count(*) || ' (need 0)' as detail from public.rooms where code = $1`,
    params: [F.nonexistentRoomCode.value],
  });
  set("player_public_profile", {
    premise: "bob is not alice's friend and bob's privacy is 'public' — the operation's \"a non-friend whose privacy is 'public'\"",
    sql: `select (ab = 0 and pub) as ok, 'alice<->bob friendships: ' || ab || ' (need 0), bob privacy public: ' || pub as detail
            from (select ${pair("friendships", "$1::uuid", "$2::uuid")} ab,
                         coalesce((select privacy::text = 'public' from public.profiles where id = $2::uuid), false) pub) x`,
    params: [uid(F.alice), uid(F.bob)],
  }, (t) => /non-friend projection/.test(t.resource));
  // The deleted-user boundary: the identity is "claims for a deleted account".
  for (const t of plan.tests.filter((x) => x.control.endsWith("#boundary:deleted-user"))) {
    m.set(t.testId, {
      premise: "fixtures.dave.id has no auth.users row when the probe runs — the identity is \"claims for a deleted account\"",
      sql: `select count(*) = 0 as ok, 'auth.users rows for dave: ' || count(*) || ' (need 0 — the executor has no step that deletes him)' as detail
              from auth.users where id = $1::uuid`,
      params: [uid(F.dave)],
    });
  }
  return m;
}

/** Live: every registered premise holds in the fixture state. */
export async function checkPremises(admin: Session, plan: Wp3Plan): Promise<ReadinessCheck & { readonly held: readonly { testId: string; premise: string; detail: string }[] }> {
  const rows: { testId: string; why: string }[] = [];
  const held: { testId: string; premise: string; detail: string }[] = [];
  for (const [testId, p] of probePremises(plan)) {
    let ok = false;
    let detail = "";
    try {
      const { rows: r } = await admin.query(p.sql, p.params as unknown[]);
      const row = r[0] as { ok?: boolean; detail?: string } | undefined;
      ok = row?.ok === true;
      detail = row?.detail ?? "premise check returned no row";
    } catch (err) {
      detail = `premise check raised: ${(err as Error).message}`;
    }
    if (ok) held.push({ testId, premise: p.premise, detail });
    else rows.push({ testId, why: `premise not satisfied: ${p.premise} (${detail})` });
  }
  return {
    id: "R5", name: "every row's stated premise holds in the fixture",
    passed: rows.length === 0, testIds: rows.map((r) => r.testId), rows, held,
    detail: rows.length
      ? `${rows.length} of ${rows.length + held.length} premise(s) not satisfied: ${rows.map((r) => r.testId).join(", ")}`
      : `all ${held.length} premises hold`,
  };
}

// ---------------------------------------------------------------------------
// R6 — two-claim expectations whose state half nobody checks
// ---------------------------------------------------------------------------

/**
 * Static: an expectation that asserts something about STATE — "stays",
 * "survives", "is still attributed", "no row … changes" — needs a post-probe
 * state guard, or only its return-value half is checked (D3.30 #2's class).
 */
export function checkStateClaims(plan: Wp3Plan, specs: ReadonlyMap<string, ExecSpec>, procs: ProcIndex): ReadinessCheck {
  const STATE = /\b(stays|unchanged|survives|untouched|still exists?|still attributed|afterwards|is created|appears (?:with|between)|or changes|is altered|displace)\b/i;
  const rows: { testId: string; why: string }[] = [];
  for (const t of plan.tests) {
    const s = specs.get(t.testId);
    if (!s || (s.kind !== "sql" && s.kind !== "rpc")) continue;
    const hit = STATE.exec(t.expected);
    if (!hit || s.stateGuard) continue;
    // A STABLE or IMMUTABLE function cannot write — PL/pgSQL refuses a data
    // change inside a non-volatile function — so its "nothing changes" half
    // is guaranteed by the database rather than left unchecked.
    if (s.kind === "rpc" && s.functionCall && procs.get(s.functionCall)?.volatility !== "v") continue;
    rows.push({ testId: t.testId, why: `the expectation makes a state claim ("…${hit[0]}…") that no state guard checks; only the returned value is asserted` });
  }
  return {
    id: "R6", name: "every state claim in an expectation has a state guard",
    passed: rows.length === 0, testIds: rows.map((r) => r.testId), rows,
    detail: rows.length ? `${rows.length} row(s) assert state that nothing checks: ${rows.map((r) => r.testId).join(", ")}` : "every state claim is guarded",
  };
}

// ---------------------------------------------------------------------------
// R7 — probes are not isolated from one another
// ---------------------------------------------------------------------------

/**
 * How the executor keeps one probe's committed effects away from the next.
 *
 * `none` is the truth today: every probe runs in autocommit on one shared
 * instance, in plan order, and nothing restores state between them. The check
 * below fails while that is so and there is any probe that commits a change
 * when its control HOLDS — because then a later probe can meet state its own
 * premise does not describe, and record a verdict about a situation the plan
 * never set up. Changing this constant without building the mechanism would be
 * the gate lying; `prove-gates` does not treat it as configuration.
 */
export const PROBE_ISOLATION: "none" | "per-probe" = "none";

export function checkIsolation(
  plan: Wp3Plan,
  specs: ReadonlyMap<string, ExecSpec>,
  procs: ProcIndex,
): ReadinessCheck {
  const volatile = new Set([...procs].filter(([, p]) => p.volatility === "v").map(([sig]) => sig));
  const rows: { testId: string; why: string }[] = [];
  for (const t of plan.tests) {
    const s = specs.get(t.testId);
    if (!s) continue;
    const n = /^(\d+) rows? affected/i.exec(t.expected);
    if (s.kind === "sql" && n && Number(n[1]) > 0) {
      rows.push({ testId: t.testId, why: `commits "${t.expected.slice(0, 40)}…" when the control holds: \`${s.statement.slice(0, 90)}\`` });
    } else if (s.kind === "rpc" && s.functionCall && volatile.has(s.functionCall)) {
      rows.push({ testId: t.testId, why: `calls ${s.functionCall}, a VOLATILE function, and commits whatever it writes` });
    } else if (s.kind === "f9" && (s.variant === "concurrent" || s.variant === "idempotent")) {
      rows.push({ testId: t.testId, why: "commits wallet and ledger rows by design (the concurrency and retry probes)" });
    }
  }
  const passed = PROBE_ISOLATION === "per-probe" || rows.length === 0;
  return {
    id: "R7", name: "no probe's committed side effect can reach a later probe",
    passed, testIds: passed ? [] : rows.map((r) => r.testId), rows: passed ? [] : rows,
    detail: passed
      ? "probes are isolated"
      : `the executor runs every probe in autocommit on one shared instance with no restore between them, and ${rows.length} probe(s) ` +
        `commit changes when their control holds (for example F2.public_blocks.024 deletes the seeded alice→dave block that ` +
        `F1.public_profiles.146/.148, F5.send_friend_request.259, F5.unblock_player.261, F5.player_public_profile.263 and ` +
        `F5.search_players.276 all rely on, and runs before them)`,
  };
}

/** Everything above, in order. */
export async function auditReadiness(
  admin: Session,
  plan: Wp3Plan,
  specs: ReadonlyMap<string, ExecSpec>,
): Promise<ReadinessCheck[]> {
  const procs = await readProcIndex(admin);
  return [
    checkAssertionCoverage(plan, specs),
    await checkSubjects(admin, plan, specs),
    await checkInsertPositives(admin, plan, specs),
    checkNoEffectAssertions(plan, specs, procs),
    await checkPremises(admin, plan),
    checkStateClaims(plan, specs, procs),
    checkIsolation(plan, specs, procs),
  ];
}

/** The functions the F5 probes call: return shape, volatility and body, keyed by identity signature. */
export type ProcIndex = ReadonlyMap<string, { readonly setof: boolean; readonly result: string; readonly volatility: string; readonly body: string }>;

export async function readProcIndex(admin: Session): Promise<ProcIndex> {
  const { rows } = await admin.query(
    `select n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as sig,
            p.proretset as setof, pg_get_function_result(p.oid) as result, p.provolatile::text as volatility,
            coalesce(p.prosrc, '') as body
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('public', 'private')`,
  );
  return new Map(rows.map((r) => [r.sig as string, {
    setof: r.setof as boolean, result: r.result as string, volatility: r.volatility as string, body: r.body as string,
  }]));
}
