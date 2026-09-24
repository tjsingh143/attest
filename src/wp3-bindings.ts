/**
 * Attest — what each probe rests on, and how each of its claims is checked.
 *
 * `wp3-claims.ts` says WHICH claims an approved expectation makes and names an
 * evaluator for each. This module supplies the per-Test-ID facts those
 * evaluators need:
 *
 *   setupKey    the probe-scoped fixture applied before this probe only (D3.38)
 *   premises    admin reads that must hold immediately before the probe; one that
 *               fails makes the record `precondition_failed` / `not_measured`,
 *               never a verdict (R2, R5)
 *   catalog     catalog facts an expectation states ("EXECUTE is granted to
 *               authenticated"), checked live
 *   guards      named post-probe state guards: a snapshot taken before and after,
 *               and/or an after-only check, all as admin (R4, R6)
 *   reference   a second observation a comparative claim needs ("nothing
 *               distinguishes 'they blocked you' from 'no such player'")
 *   refusal     for F5: which raise sites ARE the security refusal the row asks
 *               about, and which are an unrelated business prerequisite that
 *               must never satisfy it (D3.41)
 *   results     named checks over the returned rows
 *
 * Everything here is keyed on what a row IS — its family, resource, control,
 * function — and never on a Test ID number, so a binding can only attach to
 * the row whose own text calls for it.
 */
import type { PlannedTest } from "./wp3-plan.ts";
import type { ExecSpec } from "./wp3-exec.ts";
import { uidOf } from "./wp3-exec.ts";
import type { Outcome } from "./evidence.ts";
import { FIXTURES } from "../rubric/fixtures.ts";
import { AUX, ERIN_DISPLAY_NAME, implFor } from "./seed-extensions.ts";

const F = FIXTURES;
const A = uidOf("alice"), B = uidOf("bob"), CA = uidOf("carol"), D = uidOf("dave"), E = uidOf("erin");

/** An admin read returning one row: `ok boolean, detail text`. */
export interface AdminCheck {
  readonly id: string;
  readonly describe: string;
  readonly sql: string;
  readonly params: readonly unknown[];
}

export type Snapshot =
  | { readonly kind: "sql"; readonly sql: string; readonly params: readonly unknown[] }
  /** Rows (in every public/private table and auth.users) whose text names any `include` id and no `exclude` id. */
  | { readonly kind: "account_rows"; readonly include: readonly string[]; readonly exclude: readonly string[] }
  /**
   * Every row naming any `include` id, as JSON keyed by relation and id (auth.users
   * by id and md5 only — its text carries password hashes). For a guard that must
   * tell one KIND of change from another rather than any change from none (D3.54).
   */
  | { readonly kind: "account_rows_json"; readonly include: readonly string[] }
  /**
   * Digests of every table the foreign-key graph does NOT connect to auth.users:
   * state no account's deletion can legitimately reach (D3.54).
   */
  | { readonly kind: "unrelated_tables" }
  | { readonly kind: "tables"; readonly tables: readonly string[] }
  | { readonly kind: "database" }
  | { readonly kind: "catalog" };

export interface Guard {
  readonly describe: string;
  /** Taken before and after; the guard requires them equal — unless `judge` is given. */
  readonly snap?: Snapshot;
  /**
   * Classify the change between the two snapshots instead of requiring none:
   * for a function whose documented behaviour legitimately changes other rows
   * (D3.54, delete_own_account). Returns ok only when every change is one the
   * judge can name as permitted.
   */
  readonly judge?: (before: string, after: string) => { ok: boolean; detail: string };
  /** Evaluated after; returns ok/detail. */
  readonly after?: { readonly sql: string; readonly params: readonly unknown[] };
  /** For "stale entries MAY be expired": the snapshot deliberately excludes stale-entry transitions. */
  readonly permitsStaleExpiry?: boolean;
}

export interface RefusalSite {
  readonly fn: string;
  readonly sqlstate: string;
  readonly message: RegExp;
  readonly describe: string;
}

export interface ResultCheck {
  readonly describe: string;
  /** Admin read taken AFTER the probe whose rows the judge may use. */
  readonly admin?: { readonly sql: string; readonly params: readonly unknown[] };
  /** Admin read taken BEFORE the probe. */
  readonly adminBefore?: { readonly sql: string; readonly params: readonly unknown[] };
  readonly judge: (o: Outcome, after: readonly Record<string, unknown>[], before: readonly Record<string, unknown>[]) => { ok: boolean; detail: string };
}

export interface Binding {
  readonly setupKey: string | null;
  readonly premises: readonly AdminCheck[];
  readonly catalog: Readonly<Record<string, AdminCheck>>;
  readonly guards: Readonly<Record<string, Guard>>;
  readonly reference?: { readonly describe: string; readonly statement: string; readonly params: readonly unknown[] };
  /** Raise sites that ARE the refusal the row asks about. */
  readonly refusalSites?: readonly RefusalSite[];
  /** The documented refusal a function signals by RETURNING (join_private_room returns NULL). */
  readonly refusalByReturn?: (o: Outcome) => { ok: boolean; detail: string };
  readonly results: Readonly<Record<string, ResultCheck>>;
  /** For caller-scoped F5: an admin read proving the definer behaviour actually ran (D3.41). */
  readonly reachability?: AdminCheck;
  /** Trigger a mechanism claim names, resolved to its function. */
  readonly namedTrigger?: { readonly trigger: string; readonly fn: string };
  /** The policy a mechanism claim names. */
  readonly namedPolicy?: string;
  /** The columns an F10 existence probe must find populated. */
  readonly trailColumns?: readonly string[];
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

const check = (id: string, describe: string, sql: string, params: readonly unknown[] = []): AdminCheck => ({ id, describe, sql, params });
const count = (id: string, describe: string, from: string, want: "= 0" | "= 1" | ">= 1", params: readonly unknown[] = []): AdminCheck =>
  check(id, describe, `select count(*) ${want} as ok, '${describe.replace(/'/g, "''")}: ' || count(*)::text || ' (need ${want.replace(/^= /, "")})' as detail from ${from}`, params);

const rowsText = (o: Outcome) => JSON.stringify(o.rows ?? o.sample ?? []);
const containsAny = (o: Outcome, needles: readonly string[]) => needles.filter((n) => rowsText(o).includes(n));

/** Identities that must never appear in a result for bob or carol: ids, usernames, display names. */
const BOB_CAROL = [B, CA, "bob_b", "carol_c", "\"Bob\"", "\"Carol\""];

/** Setup key: the requirement this row's fixture states, when it is probe-scoped. */
function setupKeyOf(t: PlannedTest, stateToKey: ReadonlyMap<string, { key: string; scope: string }>): string | null {
  const r = stateToKey.get(t.fixture);
  return r && r.scope === "probe" ? r.key : null;
}

/**
 * The subject set of a SQL probe — the rows it acts on — counted as admin with
 * the probe's own WHERE and parameters. A refusal of an empty set proves
 * nothing, and a positive over an empty set cannot succeed (R2).
 */
export function subjectOf(s: ExecSpec): { relation: string; where: string | null } | null {
  const st = s.statement.trim().replace(/\s+limit\s+\d+\s*$/i, "");
  let m = /^select\s+[\s\S]+?\s+from\s+((?:public|private|realtime)\.[a-z_0-9]+)(?:\s+where\s+([\s\S]+))?$/i.exec(st);
  if (m) return { relation: m[1]!, where: m[2] ?? null };
  m = /^update\s+((?:public|private|realtime)\.[a-z_0-9]+)\s+set\s+[\s\S]+?(?:\s+where\s+([\s\S]+))?$/i.exec(st);
  if (m) return { relation: m[1]!, where: m[2] ?? null };
  m = /^delete\s+from\s+((?:public|private|realtime)\.[a-z_0-9]+)(?:\s+where\s+([\s\S]+))?$/i.exec(st);
  if (m) return { relation: m[1]!, where: m[2] ?? null };
  return null;
}

/**
 * Why a SQL probe needs no subject premise, or null when it does. A privilege
 * refusal needs no row to refuse — the grant is the control — so the
 * grant-surface probes, the F6 negatives and TRUNCATE carry none. The
 * anon-reach evaluator checks emptiness itself, on the one path (anon holding a
 * grant) where it would matter. An INSERT has no subject. The R2 readiness
 * check uses exactly this, so the rule and its audit cannot drift apart.
 */
export function subjectExemption(t: PlannedTest, s: ExecSpec): string | null {
  if (s.kind !== "sql") return `a ${s.kind} probe has no SQL subject`;
  const ctl = t.control;
  if (/#grant:/.test(ctl)) return "a grant-surface probe: the privilege is the control";
  if (/#colgrant:/.test(ctl) && t.polarity !== "positive") return "a column-privilege negative: the privilege is the control";
  if (/#anon-reach$/.test(ctl)) return "anon-reach: the evaluator checks emptiness on the one path where it matters";
  if (/#audit:immutable:TRUNCATE$/.test(ctl)) return "TRUNCATE acts on the relation, not on rows";
  if (/^\s*insert\b/i.test(s.statement)) return "an INSERT has no subject";
  if (!subjectOf(s)) return "no relation the statement acts on";
  return null;
}

function subjectPremise(t: PlannedTest, s: ExecSpec): AdminCheck | null {
  if (subjectExemption(t, s)) return null;
  const sub = subjectOf(s)!;
  const want: "= 1" | ">= 1" = /^1 row affected/.test(t.expected) ? "= 1" : ">= 1";
  const from = `${sub.relation}${sub.where ? ` where ${sub.where}` : ""}`;
  const label = want === "= 1"
    ? "rows the probe's own WHERE selects (exactly one, so '1 row affected' is reachable)"
    : "rows the probe's own WHERE selects (at least one, so the result is not vacuous)";
  return count("subject", label, from, want, s.params);
}

// ---------------------------------------------------------------------------
// F5 function facts
// ---------------------------------------------------------------------------

/**
 * For each F5 function whose approved result is a refusal: the raise site(s)
 * that ARE the refusal the row examines, read from the function body. Any
 * other raise — a rate limit, an unrelated business rule, a missing session —
 * is a prerequisite refusal and records `control_not_reached`, never a verdict.
 */
const REFUSAL_SITES: Readonly<Record<string, readonly RefusalSite[]>> = {
  set_room_ready: [{ fn: "set_room_ready", sqlstate: "PT404", message: /^you are not at that table$/, describe: "the membership check: no joined row for the caller" }],
  invite_friend_to_room: [{ fn: "invite_friend_to_room", sqlstate: "PT404", message: /^you are not at that table$/, describe: "the membership check, reached because carol IS bob's friend (the friendship gate passes)" }],
  leave_room: [],
  accept_friend_request: [{ fn: "accept_friend_request", sqlstate: "PT404", message: /^there is no pending request from that player$/, describe: "no pending request from the named sender to the caller" }],
  send_friend_request: [{ fn: "send_friend_request", sqlstate: "PT404", message: /^no such player$/, describe: "is_blocked_between(caller, receiver) inside the function body" }],
  register_push_token: [],
  join_private_room: [],
  equip_cosmetic: [{ fn: "guard_loadout_slots", sqlstate: "42501", message: /is not owned by this player$/, describe: "loadouts_guard_slots' ownership check" }],
};

/** Result checks and reachability for the 21 caller-scoped functions (D3.41). */
interface CallerScopedSpec {
  readonly only: ResultCheck;
  readonly reach?: AdminCheck;
}

const ownIds = (col: string, adminSql: string, params: readonly unknown[], what: string): ResultCheck => ({
  describe: `every returned ${col} is one of alice's own ${what}, and all of hers are returned`,
  admin: { sql: adminSql, params },
  judge: (o, after) => {
    const got = new Set((o.rows ?? []).map((r) => String(r[col])).filter((v) => v !== "null" && v !== "undefined"));
    const want = new Set(after.map((r) => String(r.v)));
    const extra = [...got].filter((v) => !want.has(v));
    const missing = [...want].filter((v) => !got.has(v));
    return {
      ok: extra.length === 0 && missing.length === 0,
      detail: `returned ${got.size} ${col}(s); alice's own: ${want.size}; not hers: ${extra.length ? extra.join(", ") : "none"}; hers missing: ${missing.length ? missing.join(", ") : "none"}`,
    };
  },
});

/** Compare one returned value with an admin-computed one. */
const valueEquals = (col: string | null, adminSql: string, params: readonly unknown[], what: string): ResultCheck => ({
  describe: `the returned ${col ?? "value"} equals alice's own ${what}, computed independently as admin`,
  admin: { sql: adminSql, params },
  judge: (o, after) => {
    const rows = o.rows ?? [];
    if (rows.length !== 1) return { ok: false, detail: `${rows.length} row(s) returned, one expected` };
    const row = rows[0]!;
    const got = col ? row[col] : Object.values(row)[0];
    const want = after[0]?.v;
    return { ok: String(got) === String(want), detail: `returned ${JSON.stringify(got)}; alice's own ${what}: ${JSON.stringify(want)}` };
  },
});

const CALLER_SCOPED: Readonly<Record<string, CallerScopedSpec>> = {
  claim_recovery_grant: {
    only: {
      describe: "the returned ledger row is alice's own recovery grant",
      judge: (o) => {
        const r = (o.rows ?? [])[0];
        return { ok: r?.user_id === A && r?.reason === "recovery_grant", detail: `returned ledger row user_id ${String(r?.user_id)}, reason ${String(r?.reason)}` };
      },
    },
    reach: count("reach", "recovery_grant ledger rows for alice after the call", `public.wallet_ledger where user_id = $1 and reason = 'recovery_grant'`, "= 1", [A]),
  },
  delete_own_account: {
    only: { describe: "the function returns void; nothing is returned to leak", judge: (o) => ({ ok: (o.rows ?? []).length <= 1, detail: `${(o.rows ?? []).length} row(s) (a void call returns one empty row)` }) },
    reach: count("reach", "auth.users rows for alice after the call (the deletion ran)", `auth.users where id = $1`, "= 0", [A]),
  },
  grant_earned_cosmetics: {
    only: {
      describe: "the returned count equals the cosmetics newly granted to alice",
      adminBefore: { sql: `select count(*)::int as v from public.user_cosmetics where user_id = $1`, params: [A] },
      admin: { sql: `select count(*)::int as v from public.user_cosmetics where user_id = $1`, params: [A] },
      judge: (o, after, before) => {
        const got = Number(Object.values((o.rows ?? [])[0] ?? {})[0]);
        const delta = Number(after[0]?.v) - Number(before[0]?.v);
        return { ok: got === delta && got >= 1, detail: `returned ${got}; alice's user_cosmetics grew by ${delta} (at least one grantable cosmetic is seeded)` };
      },
    },
  },
  leave_matchmaking: {
    only: { describe: "the function returns void", judge: (o) => ({ ok: (o.rows ?? []).length <= 1, detail: `${(o.rows ?? []).length} row(s)` }) },
    reach: count("reach", "alice's queue entries still waiting or matched after the call", `public.matchmaking_queue where user_id = $1 and status in ('waiting','matched')`, "= 0", [A]),
  },
  list_blocked: { only: ownIds("id", `select blocked_id as v from public.blocks where blocker_id = $1`, [A], "blocked accounts") },
  list_friend_requests: {
    only: ownIds("other_id",
      `select case when r.receiver_id = $1 then r.sender_id else r.receiver_id end as v
         from public.friend_requests r where r.status = 'pending' and $1 in (r.sender_id, r.receiver_id)
          and not public.is_blocked_between($1, case when r.receiver_id = $1 then r.sender_id else r.receiver_id end)`, [A], "pending request counterparties"),
  },
  list_friends: {
    only: ownIds("id", `select case when user_id_a = $1 then user_id_b else user_id_a end as v from public.friendships where $1 in (user_id_a, user_id_b)`, [A], "friends"),
  },
  my_active_session: {
    only: ownIds("seat_id",
      `select s.id as v from public.game_session_seats s join public.game_sessions g on g.id = s.game_session_id
        where s.user_id = $1 and s.status <> 'left' and g.status in ('lobby','active')`, [A], "live seats"),
  },
  my_career_progress: {
    only: ownIds("node_code", `select n.code as v from public.career_progress p join public.career_nodes n on n.id = p.career_node_id where p.user_id = $1`, [A], "career-progress nodes"),
  },
  my_competition_record: {
    only: valueEquals("tournaments_entered", `select count(*)::int as v from public.tournament_entries where user_id = $1 and status <> 'withdrawn'`, [A], "tournament entries"),
  },
  my_daily_entry: {
    only: ownIds("daily_challenge_id",
      `select e.daily_challenge_id as v from public.daily_entries e join public.daily_challenges c on c.id = e.daily_challenge_id
        where e.user_id = $1 and c.challenge_date = (now() at time zone 'utc')::date`, [A], "daily entries for today"),
  },
  my_inventory: {
    only: {
      describe: "the cosmetics marked owned are exactly alice's own user_cosmetics",
      admin: { sql: `select cosmetic_id as v from public.user_cosmetics where user_id = $1`, params: [A] },
      judge: (o, after) => {
        const owned = new Set((o.rows ?? []).filter((r) => r.owned === true).map((r) => String(r.cosmetic_id)));
        const want = new Set(after.map((r) => String(r.v)));
        const extra = [...owned].filter((v) => !want.has(v));
        const missing = [...want].filter((v) => !owned.has(v));
        return { ok: extra.length === 0 && missing.length === 0, detail: `marked owned: ${owned.size}; alice owns: ${want.size}; owned-but-not-hers: ${extra.join(", ") || "none"}; hers-not-marked: ${missing.join(", ") || "none"}` };
      },
    },
  },
  my_level_progress: { only: valueEquals("total_xp", `select xp::text as v from public.profiles where id = $1`, [A], "total xp") },
  my_loadout: {
    only: {
      describe: "the equipped cosmetics returned are exactly alice's own loadout slots",
      admin: { sql: `select unnest(array[avatar_cosmetic_id, card_back_cosmetic_id, table_theme_cosmetic_id])::text as v from public.loadouts where user_id = $1`, params: [A] },
      judge: (o, after) => {
        const got = (o.rows ?? []).map((r) => String(r.cosmetic_id)).sort().join(",");
        const want = after.map((r) => String(r.v)).sort().join(",");
        return { ok: (o.rows ?? []).length === 3 && got === want, detail: `returned slots ${got}; alice's loadout ${want}` };
      },
    },
  },
  my_sprint_entry: {
    only: ownIds("entry_id",
      `select e.id as v from public.tournament_entries e join public.tournaments t on t.id = e.tournament_id
        where e.user_id = $1 and e.status <> 'withdrawn'
          and (t.status in ('registering','running') or (t.status = 'completed' and t.ends_at > now() - interval '1 day'))
        order by e.registered_at desc limit 1`, [A], "live sprint entry"),
  },
  my_strategy_accuracy_progress: {
    only: valueEquals("decisions_total", `select coalesce((select decisions_total from public.player_decision_periods where user_id = $1 and period_start = public.utc_week_start()), 0) as v`, [A], "decisions this week"),
  },
  touch_last_seen: {
    only: {
      describe: "the returned timestamp is alice's own new last_seen_at",
      admin: { sql: `select last_seen_at as v from public.profiles where id = $1`, params: [A] },
      judge: (o, after) => {
        const got = Object.values((o.rows ?? [])[0] ?? {})[0];
        const want = after[0]?.v;
        return { ok: String(got) === String(want), detail: `returned ${String(got)}; alice's last_seen_at after the call ${String(want)}` };
      },
    },
    reach: check("reach", "alice's last_seen_at moved to the call's timestamp",
      `select (last_seen_at >= now() - interval '1 minute') as ok, 'alice last_seen_at ' || last_seen_at::text as detail from public.profiles where id = $1`, [A]),
  },
  unread_notification_count: { only: valueEquals(null, `select count(*)::int as v from public.notifications where user_id = $1 and read_at is null`, [A], "unread notification count") },
  enforce_rate_limit: {
    only: {
      describe: "the verdict is alice's own: 'player_search' allowed, as her own (empty) history dictates",
      judge: (o) => {
        const r = (o.rows ?? [])[0];
        return { ok: r?.allowed === true && r?.action === "player_search", detail: `verdict allowed=${String(r?.allowed)} action=${String(r?.action)}` };
      },
    },
    reach: count("reach", "player_search events recorded for alice by the call", `public.rate_limit_events where user_id = $1 and action = 'player_search'`, "= 1", [A]),
  },
  my_leaderboard_position: {
    only: valueEquals("value",
      `select coalesce(sum(repeatable_xp + milestone_xp), 0)::bigint::text as v from public.player_daily_xp
        where user_id = $1 and utc_day >= public.utc_week_start() and utc_day < public.utc_week_start() + 7`, [A], "weekly XP"),
  },
  my_notifications: { only: ownIds("id", `select id as v from public.notifications where user_id = $1 order by created_at desc limit 50`, [A], "notifications") },
};

// ---------------------------------------------------------------------------
// delete_own_account: the function-specific invariant (Gate A, D-283, D3.54)
// ---------------------------------------------------------------------------

type JRow = Record<string, unknown>;

/**
 * Classify every change delete_own_account() made to a row naming an account,
 * into the author's three categories:
 *
 *   A  caller-owned: a row naming the caller and no other account — any change
 *   B  documented cleanup and reassignment, and nothing more:
 *        - a row involving the caller REMOVED (the schema's cascades; the
 *          function's deletion of other players' notifications about the caller)
 *        - the caller's id CLEARED from a row (a foreign key's SET NULL), the
 *          row otherwise unchanged (a seat may also become 'Deleted player')
 *        - a lobby the caller hosted handed to the joined member with the
 *          earliest joined_at (release_room_seat's rule), nothing else changed
 *        - another player's queue entry that pointed at a room the caller still
 *          hosts after the handovers cancelled (status 'cancelled', room_id and
 *          matched_at cleared), nothing else changed
 *   C  anything else on a row naming another account — including a new one —
 *      which makes the guard fail
 *
 * Rows naming no account at all are the other guard's (unrelated tables); rows
 * that reach an account only through another table's id (a match naming entry
 * ids) are outside both, which is recorded as a limitation (D3.54).
 */
export function classifyAccountDeletion(before: string, after: string, caller: string, others: readonly string[]): { ok: boolean; detail: string } {
  type P = [string, string, JRow];
  const a = JSON.parse(before || "[]") as P[];
  const b = JSON.parse(after || "[]") as P[];
  const key = (p: P) => `${p[0]} ${p[1]}`;
  const A = new Map(a.map((p) => [key(p), p])), B = new Map(b.map((p) => [key(p), p]));
  const names = (row: JRow, ids: readonly string[]) => { const t = JSON.stringify(row); return ids.some((i) => t.includes(i)); };

  // release_room_seat's heir, from the BEFORE state: the joined member other
  // than the caller with the earliest joined_at (ties: any of them).
  const members = a.filter((p) => p[0] === "public.room_members").map((p) => p[2]);
  const heirs = new Map<string, Set<string>>();
  const heirless = new Set<string>();
  for (const [rel, , row] of a) {
    if (rel !== "public.rooms" || row.host_user_id !== caller) continue;
    const joined = members.filter((m) => m.room_id === row.id && m.status === "joined" && m.user_id !== caller);
    if (!joined.length) { heirless.add(String(row.id)); continue; }
    const first = Math.min(...joined.map((m) => new Date(String(m.joined_at)).getTime()));
    heirs.set(String(row.id), new Set(joined.filter((m) => new Date(String(m.joined_at)).getTime() === first).map((m) => String(m.user_id))));
  }
  const changedCols = (x: JRow, y: JRow) => [...new Set([...Object.keys(x), ...Object.keys(y)])].filter((c) => JSON.stringify(x[c]) !== JSON.stringify(y[c]));

  const documented: string[] = [];
  const violations: string[] = [];
  let removedInvolvingCaller = 0, cleared = 0, callerOwned = 0;
  for (const k of new Set([...A.keys(), ...B.keys()])) {
    const pb = A.get(k), pa = B.get(k);
    const rel = (pb ?? pa)![0];
    if (pb && pa && JSON.stringify(pb[2]) === JSON.stringify(pa[2])) continue;
    const rb = pb?.[2], ra = pa?.[2];
    const othersBefore = !!rb && names(rb, others), othersAfter = !!ra && names(ra, others);
    if (!othersBefore && !othersAfter) { callerOwned++; continue; }                         // A
    if (rb && !ra) {
      if (names(rb, [caller])) { removedInvolvingCaller++; continue; }                        // B: cascade / notification cleanup
      violations.push(`${k}: a row naming another account and not the caller was removed`);
      continue;
    }
    if (!rb && ra) { violations.push(`${k}: a row naming another account appeared`); continue; }
    const cols = changedCols(rb!, ra!);
    if (rel === "public.rooms" && cols.length === 1 && cols[0] === "host_user_id" && rb!.host_user_id === caller) {
      const want = heirs.get(String(rb!.id));
      if (want && want.has(String(ra!.host_user_id))) { documented.push(`${k}: the lobby the caller hosted passed to ${String(ra!.host_user_id)}, its longest-joined remaining member`); continue; }
      violations.push(`${k}: host moved from the caller to ${String(ra!.host_user_id)}, not the longest-joined remaining member (${[...(want ?? [])].join(" or ") || "none"})`);
      continue;
    }
    if (rel === "public.matchmaking_queue" && rb!.user_id !== caller && heirless.has(String(rb!.room_id))
        && cols.every((c) => ["status", "room_id", "matched_at"].includes(c))
        && ra!.status === "cancelled" && ra!.room_id === null && ra!.matched_at === null) {
      documented.push(`${k}: another player's queue entry pointing at a room the caller still hosted was cancelled`);
      continue;
    }
    const setNull = cols.every((c) => (rb![c] === caller && ra![c] === null) || (rel === "public.game_session_seats" && c === "display_name" && ra![c] === "Deleted player"));
    if (setNull && cols.some((c) => rb![c] === caller)) { cleared++; continue; }             // B: foreign-key SET NULL
    violations.push(`${k}: ${cols.join(", ")} changed on a row naming another account — not a documented deletion effect`);
  }
  const summary =
    `caller-owned rows changed: ${callerOwned}; rows involving the caller removed: ${removedInvolvingCaller}; ` +
    `rows with the caller's id cleared by a foreign key: ${cleared}; documented reassignments: ${documented.length ? documented.join(" | ") : "none"}`;
  return violations.length
    ? { ok: false, detail: `${violations.length} change(s) outside the documented deletion effects: ${violations.slice(0, 8).join(" | ")}. (${summary})` }
    : { ok: true, detail: `every change to a row naming another account is a documented deletion effect — ${summary}` };
}

// ---------------------------------------------------------------------------
// the binding
// ---------------------------------------------------------------------------

export function bindingFor(
  t: PlannedTest,
  s: ExecSpec,
  stateToKey: ReadonlyMap<string, { key: string; scope: string }>,
): Binding {
  const fam = t.family.split(" ")[0]!;
  const res = t.resource;
  const premises: AdminCheck[] = [];
  const catalog: Record<string, AdminCheck> = {};
  const guards: Record<string, Guard> = {};
  const results: Record<string, ResultCheck> = {};
  let reference: Binding["reference"];
  let refusalSites: RefusalSite[] | undefined;
  let refusalByReturn: Binding["refusalByReturn"];
  let reachability: AdminCheck | undefined;
  let namedTrigger: Binding["namedTrigger"];
  let namedPolicy: string | undefined;
  let trailColumns: string[] | undefined;
  const setupKey = setupKeyOf(t, stateToKey);

  // The probe-scoped setup's own verification is the first premise.
  if (setupKey) {
    const impl = implFor(setupKey);
    if (impl) premises.push(check(`setup:${setupKey}`, `probe-scoped fixture ${setupKey} holds`, impl.verify));
  }
  const sub = subjectPremise(t, s);
  if (sub) premises.push(sub);

  // ---------------------------------------------------------------- F1 relationships
  if (fam === "F1") {
    if (/is_session_participant/.test(t.covers)) {
      if (t.polarity === "positive") premises.push(count("relationship", "alice's live seat at the session", `public.game_session_seats where game_session_id = $1 and user_id = $2 and status <> 'left'`, "= 1", [F.session.value, A]));
      else premises.push(count("relationship", "carol's seats at the session", `public.game_session_seats where game_session_id = $1 and user_id = $2`, "= 0", [F.session.value, CA]));
    }
    if (/caller_is_room_member/.test(t.covers)) {
      if (t.polarity === "positive") premises.push(count("relationship", "alice's joined membership of the room", `public.room_members where room_id = $1 and user_id = $2 and status = 'joined'`, "= 1", [F.roomAliceBob.value, A]));
      else premises.push(count("relationship", "carol's memberships of the room", `public.room_members where room_id = $1 and user_id = $2`, "= 0", [F.roomAliceBob.value, CA]));
    }
    if (/viewer_is_in_tournament/.test(t.covers)) {
      if (t.polarity === "positive") premises.push(count("relationship", "alice's entry in the tournament", `public.tournament_entries where tournament_id = $1 and user_id = $2`, "= 1", [F.tournamentAliceBob.value, A]));
      else premises.push(count("relationship", "carol's entries in the tournament", `public.tournament_entries where tournament_id = $1 and user_id = $2`, "= 0", [F.tournamentAliceBob.value, CA]));
    }
    if (res === "public.profiles" && t.polarity === "negative") {
      premises.push(count("relationship", "alice->dave blocks (the conjunct dave falsifies)", `public.blocks where blocker_id = $1 and blocked_id = $2`, "= 1", [A, D]));
    }
    if (res === "public.profiles" && t.polarity === "positive" && s.params[0] === B) {
      premises.push(check("relationship", "bob public and unblocked either way",
        `select (p.privacy = 'public' and not exists (select 1 from public.blocks b where (b.blocker_id, b.blocked_id) in (($1,$2),($2,$1)))) as ok,
                'bob privacy ' || p.privacy::text || ', blocks between alice and bob ' ||
                (select count(*) from public.blocks b where (b.blocker_id, b.blocked_id) in (($1,$2),($2,$1)))::text as detail
           from public.profiles p where p.id = $2`, [A, B]));
    }
  }

  // ---------------------------------------------------------------- F3 / F6 state and catalog
  if (/^1 row affected, and the row is still attributed to alice afterwards$/.test(t.expected)) {
    const own: Record<string, { sql: string; params: unknown[] }> = {
      "public.friend_requests": { sql: `select (count(*) = 1) as ok, 'friend_requests sent by alice after the update: ' || count(*)::text || ' (need 1)' as detail from public.friend_requests where id = $1 and sender_id = $2`, params: [AUX.requestAliceErin, A] },
      "public.notifications": { sql: `select (count(*) = 1) as ok, 'alice''s seeded notification still has user_id alice: ' || count(*)::text as detail from public.notifications where id = $1 and user_id = $2`, params: [F.aliceNotification.value, A] },
      "public.profiles": { sql: `select (count(*) = 1) as ok, 'profile row with id alice after the update: ' || count(*)::text as detail from public.profiles where id = $1`, params: [A] },
    };
    const o = own[res];
    if (o) guards.still_attributed = { describe: "the updated row is still attributed to alice", after: o };
  }
  if (/a granted column on the caller's own row/.test(t.expected)) {
    const col = /set\s+"?([a-z_]+)"?\s*=/.exec(s.statement)?.[1];
    catalog.granted_column_own_row = check("granted_column_own_row", `authenticated holds UPDATE on ${res}.${col ?? "?"}, and the row the WHERE names is the caller's`,
      `select has_column_privilege('authenticated', $1::regclass, $2, 'UPDATE') as ok,
              'authenticated UPDATE on ' || $1 || '.' || $2 || ': ' || has_column_privilege('authenticated', $1::regclass, $2, 'UPDATE')::text as detail`,
      [res, col ?? ""]);
  }
  if (/^rows returned — 14 of 15 columns carry a client SELECT grant$/.test(t.expected)) {
    catalog.column_grant_count = check("column_grant_count", "14 of 15 columns carry a client SELECT grant",
      `select (g = 14 and n = 15) as ok, g::text || ' of ' || n::text || ' columns carry an authenticated SELECT grant' as detail
         from (select count(*) filter (where has_column_privilege('authenticated', a.attrelid, a.attname, 'SELECT')) g, count(*) n
                 from pg_attribute a where a.attrelid = $1::regclass and a.attnum > 0 and not a.attisdropped) x`, [res]);
  }

  // ---------------------------------------------------------------- F4 catalog facts
  if (fam === "F4") {
    const pol = /#policy:([a-z0-9_]+)$/.exec(t.control)?.[1];
    if (/deliberately readable without an account/.test(t.expected) && pol) {
      catalog.anon_policy_admits = check("anon_policy_admits", `anon holds SELECT on ${res} and ${pol} names anon`,
        `select (has_table_privilege('anon', $1::text, 'SELECT') and exists (select 1 from pg_policies where schemaname||'.'||tablename = $1::text and policyname = $2::name and 'anon' = any(roles))) as ok,
                'anon SELECT: ' || has_table_privilege('anon', $1::text, 'SELECT')::text || ', ' || $2::text || ' names anon: ' ||
                exists (select 1 from pg_policies where schemaname||'.'||tablename = $1::text and policyname = $2::name and 'anon' = any(roles))::text as detail`, [res, pol]);
    }
    const using = /([a-z_]+) USING is `([^`]+)`/.exec(t.expected);
    if (using) {
      catalog.policy_using_exact = policyUsing(res, using[1]!, using[2]!);
      const falsify = /for the seeded row where (.+)$/.exec(t.operation)?.[1];
      if (falsify) premises.push(count("falsifying_row", `rows of ${res} where ${falsify} (the falsifying subject)`, `${res} where ${falsify}`, ">= 1"));
    }
    if (res === "realtime.messages") {
      catalog.anon_holds_select = check("anon_holds_select", "anon holds SELECT on realtime.messages",
        `select has_table_privilege('anon', 'realtime.messages', 'SELECT') as ok, 'anon SELECT on realtime.messages: ' || has_table_privilege('anon', 'realtime.messages', 'SELECT')::text as detail`);
      catalog.no_policy_names_anon = noPolicyNamesAnon();
    }
  }

  // ---------------------------------------------------------------- F8 SQL
  if (fam === "F8" && s.kind === "sql") {
    const pol = /#policy:([a-z0-9_]+)$/.exec(t.control)?.[1];
    if (/alice holds a live seat at that game/.test(t.expected)) {
      premises.push(count("relationship", "alice's live seat at the session the topic names", `public.game_session_seats where game_session_id = $1 and user_id = $2 and status <> 'left'`, "= 1", [F.session.value, A]));
    }
    if (/carol holds no seat at that game/.test(t.expected)) {
      premises.push(count("relationship", "carol's seats at the session the topic names", `public.game_session_seats where game_session_id = $1 and user_id = $2`, "= 0", [F.session.value, CA]));
    }
    if (/requires only an account|may publish its own presence/.test(t.expected) && pol) {
      // Both presence policies admit exactly one topic, and only to authenticated:
      // the SELECT policy in USING, the INSERT policy in WITH CHECK.
      const expr = "(realtime.topic() = 'presence:players'::text)";
      catalog.policy_using_exact = check("policy_using_exact", `${pol} admits exactly the presence topic, to authenticated`,
        `select (coalesce(qual, with_check) = $2::text and roles = '{authenticated}'::name[]) as ok,
                $1::text || ': ' || coalesce(qual, with_check) || ' for ' || roles::text as detail
           from pg_policies where schemaname = 'realtime' and tablename = 'messages' and policyname = $1::name`, [pol, expr]);
    }
    if (/no policy on realtime\.messages names anon/.test(t.expected)) catalog.no_policy_names_anon = noPolicyNamesAnon();
    if (t.polarity === "positive" && /insert/i.test(s.statement)) {
      guards.presence_written = { describe: "the presence row alice published exists", after: { sql: `select count(*) >= 1 as ok, 'rows on presence:players with the attest marker: ' || count(*)::text as detail from realtime.messages where topic = 'presence:players' and payload = '{"attest":true}'::jsonb`, params: [] } };
    }
  }

  // ---------------------------------------------------------------- F10
  if (fam === "F10") {
    if (/#audit:immutable:/.test(t.control)) guards.table_unchanged = { describe: `${res} is unchanged by the statement`, snap: { kind: "tables", tables: [res] } };
    if (/#audit:absent$/.test(t.control)) guards.catalog_unchanged = { describe: "no relation, trigger or policy was created or altered while the absence was read", snap: { kind: "catalog" } };
    if (/#audit:exists$/.test(t.control)) trailColumns = [...(/select (.+) from/.exec(s.statement)?.[1] ?? "").split(",").map((c) => c.trim())];
  }

  // ---------------------------------------------------------------- B null identity
  if (/#boundary:null-identity$/.test(t.control)) {
    // The identity premise is checked on the session itself (auth.uid() is null);
    // the subject premise above makes the table non-empty.
  }

  // ---------------------------------------------------------------- F5
  if (fam === "F5") {
    const fn = s.calledFunction ?? "";
    refusalSites = REFUSAL_SITES[fn] ? [...REFUSAL_SITES[fn]!] : undefined;
    switch (fn) {
      case "remove_room_member":
        premises.push(check("relationship", "the room is bob's private lobby with no game, bob joined, alice not a member",
          `select (r.host_user_id = $2 and r.visibility = 'private' and r.status = 'lobby' and r.game_session_id is null
                   and exists (select 1 from public.room_members m where m.room_id = r.id and m.user_id = $2 and m.status = 'joined')
                   and not exists (select 1 from public.room_members m where m.room_id = r.id and m.user_id = $3)) as ok,
                  'host ' || r.host_user_id::text || ', ' || r.visibility || ', ' || r.status::text as detail
             from public.rooms r where r.id = $1`, [F.roomBobHosts.value, B, A]));
        guards.guard = { describe: "bob's membership row of the bob-hosted room is unchanged", snap: { kind: "sql", sql: `select row_to_json(m)::text as snap from public.room_members m where room_id = $1 and user_id = $2`, params: [F.roomBobHosts.value, B] } };
        break;
      case "get_room_state":
        premises.push(count("relationship", "carol's memberships of the room", `public.room_members where room_id = $1 and user_id = $2`, "= 0", [F.roomAliceBob.value, CA]));
        break;
      case "set_room_ready":
        premises.push(count("relationship", "carol's memberships of the room", `public.room_members where room_id = $1 and user_id = $2`, "= 0", [F.roomAliceBob.value, CA]));
        guards.guard = { describe: "carol is still absent from room_members for the room", after: { sql: `select count(*) = 0 as ok, 'carol rows in room_members for the room: ' || count(*)::text as detail from public.room_members where room_id = $1 and user_id = $2`, params: [F.roomAliceBob.value, CA] } };
        guards.no_effect = { describe: "the database is unchanged by the call", snap: { kind: "database" } };
        break;
      case "invite_friend_to_room":
        premises.push(count("relationship", "carol's memberships of the room", `public.room_members where room_id = $1 and user_id = $2`, "= 0", [F.roomAliceBob.value, CA]));
        premises.push(count("relationship", "the bob<->carol friendship that lets the call reach the membership check", `public.friendships where user_id_a = $1 and user_id_b = $2`, "= 1", [B, CA]));
        guards.guard = { describe: "no room_members row exists for bob beyond the seeded one", snap: { kind: "sql", sql: `select count(*)::text as snap from public.room_members where user_id = $1`, params: [B] } };
        break;
      case "leave_room":
        premises.push(count("relationship", "carol's memberships of the room", `public.room_members where room_id = $1 and user_id = $2`, "= 0", [F.roomAliceBob.value, CA]));
        guards.guard = { describe: "alice's and bob's membership rows of the room are unaltered", snap: { kind: "sql", sql: `select string_agg(row_to_json(m)::text, '|' order by m.user_id) as snap from public.room_members m where room_id = $1 and user_id in ($2, $3)`, params: [F.roomAliceBob.value, A, B] } };
        guards.no_effect = { describe: "the database is unchanged by the call", snap: { kind: "database" } };
        break;
      case "equip_cosmetic":
        namedTrigger = { trigger: "loadouts_guard_slots", fn: "guard_loadout_slots" };
        premises.push(check("relationship", "the cosmetic exists, is active, is an avatar, and alice does not own it", implFor("fixture:unownedCosmetic")!.verify));
        break;
      case "mark_notifications_read":
        premises.push(count("relationship", "bob's notification exists unread", `public.notifications where id = $1 and user_id = $2 and read_at is null`, "= 1", [F.bobNotification.value, B]));
        guards.guard = { describe: "bob's notification read_at is still null", after: { sql: `select (read_at is null) as ok, 'bob notification read_at = ' || coalesce(read_at::text, 'null') as detail from public.notifications where id = $1`, params: [F.bobNotification.value] } };
        catalog.body_contains = bodyContains("mark_notifications_read", "where user_id = v_me");
        break;
      case "caller_is_room_member":
        premises.push(count("relationship", "carol's memberships of the room", `public.room_members where room_id = $1 and user_id = $2`, "= 0", [F.roomAliceBob.value, CA]));
        premises.push(count("relationship", "joined members of the room (a room that exists and is populated)", `public.room_members where room_id = $1 and status = 'joined'`, ">= 1", [F.roomAliceBob.value]));
        break;
      case "is_session_participant":
        premises.push(count("relationship", "carol's seats at the session", `public.game_session_seats where game_session_id = $1 and user_id = $2`, "= 0", [F.session.value, CA]));
        premises.push(count("relationship", "seats at the session (a populated session)", `public.game_session_seats where game_session_id = $1`, ">= 1", [F.session.value]));
        break;
      case "sprint_standings":
        if (t.polarity === "negative") {
          premises.push(count("relationship", "carol's entries in the tournament", `public.tournament_entries where tournament_id = $1 and user_id = $2`, "= 0", [F.tournamentAliceBob.value, CA]));
          premises.push(count("relationship", "entries in the tournament (a populated standings table)", `public.tournament_entries where tournament_id = $1`, ">= 1", [F.tournamentAliceBob.value]));
        } else {
          premises.push(check("relationship", "alice and dave both entered, and alice blocks dave", implFor("fixture:tournamentAliceDave")!.verify));
          catalog.body_lacks_block_filter = check("body_lacks_block_filter", "sprint_standings' body joins profiles with no block or privacy filter",
            `select (prosrc like '%join public.profiles%' and prosrc not like '%is_blocked%' and prosrc not like '%viewer_has_blocked%' and prosrc not like '%privacy%') as ok,
                    'joins profiles: ' || (prosrc like '%join public.profiles%')::text || ', mentions a block or privacy filter: ' ||
                    (prosrc like '%is_blocked%' or prosrc like '%viewer_has_blocked%' or prosrc like '%privacy%')::text as detail
               from pg_proc where oid = 'public.sprint_standings(uuid)'::regprocedure`);
          catalog.prosecdef = check("prosecdef", "sprint_standings is SECURITY DEFINER",
            `select prosecdef as ok, 'prosecdef = ' || prosecdef::text as detail from pg_proc where oid = 'public.sprint_standings(uuid)'::regprocedure`);
        }
        break;
      case "viewer_is_in_tournament":
        premises.push(count("relationship", "carol's entries in the tournament", `public.tournament_entries where tournament_id = $1 and user_id = $2`, "= 0", [F.tournamentAliceBob.value, CA]));
        premises.push(count("relationship", "entries in the tournament", `public.tournament_entries where tournament_id = $1`, ">= 1", [F.tournamentAliceBob.value]));
        break;
      case "accept_friend_request":
        // Directional, as approved: "when no request from alice to carol exists".
        premises.push(count("relationship", "pending alice->carol friend requests", `public.friend_requests where sender_id = $1 and receiver_id = $2 and status = 'pending'`, "= 0", [A, CA]));
        premises.push(count("relationship", "alice<->carol friendships", `public.friendships where user_id_a = $1 and user_id_b = $2`, "= 0", [A, CA]));
        guards.guard = { describe: "no friendships row appears between alice and carol", after: { sql: `select count(*) = 0 as ok, 'alice<->carol friendships after the call: ' || count(*)::text as detail from public.friendships where user_id_a = $1 and user_id_b = $2`, params: [A, CA] } };
        guards.no_effect = { describe: "the database is unchanged by the call", snap: { kind: "database" } };
        break;
      case "decline_friend_request":
        guards.guard = { describe: "the alice->bob request is unchanged (still pending, unanswered)", snap: { kind: "sql", sql: `select row_to_json(r)::text as snap from public.friend_requests r where id = $1`, params: [AUX.requestAliceBob] } };
        premises.push(count("relationship", "requests from alice received by carol (carol is not the receiver of the alice->bob request)", `public.friend_requests where sender_id = $1 and receiver_id = $2`, "= 0", [A, CA]));
        break;
      case "send_friend_request":
        // Gate A, C2-definer-bypasses-named-policy (D3.54): the refusal is the
        // SECURITY DEFINER body's own — the caller's policies never apply to its insert.
        catalog.body_contains = bodyContains("send_friend_request", "if public.is_blocked_between(v_me, p_to) then");
        premises.push(count("relationship", "alice->dave blocks", `public.blocks where blocker_id = $1 and blocked_id = $2`, "= 1", [A, D]));
        premises.push(count("relationship", "dave's profile (the receiver exists)", `public.profiles where id = $1`, "= 1", [D]));
        break;
      case "block_player":
        premises.push(count("relationship", "blocks alice->bob before the call (the row the call must create)", `public.blocks where blocker_id = $1 and blocked_id = $2`, "= 0", [A, B]));
        premises.push(count("relationship", "bob's profile (the target exists)", `public.profiles where id = $1`, "= 1", [B]));
        guards.guard = { describe: "exactly one blocks row with blocker alice and blocked bob exists", after: { sql: `select count(*) = 1 as ok, 'alice->bob blocks after the call: ' || count(*)::text as detail from public.blocks where blocker_id = $1 and blocked_id = $2`, params: [A, B] } };
        guards.guard2 = { describe: "the blocks rows authored by bob are unchanged (no row appears with blocker_id = bob)", snap: { kind: "sql", sql: `select coalesce(string_agg(blocked_id::text, ',' order by blocked_id), '') as snap from public.blocks where blocker_id = $1`, params: [B] } };
        break;
      case "unblock_player":
        premises.push(check("relationship", "the alice->dave block exists and carol has no block on dave", `select (ad = 1 and cd = 0) as ok, 'alice->dave blocks: ' || ad || ', carol->dave blocks: ' || cd as detail
                 from (select (select count(*) from public.blocks where blocker_id = $1 and blocked_id = $3) ad,
                              (select count(*) from public.blocks where blocker_id = $2 and blocked_id = $3) cd) x`, [A, CA, D]));
        guards.no_effect = { describe: "the database is unchanged by the call", snap: { kind: "database" } };
        guards.guard = { describe: "the alice->dave block survives", after: { sql: `select count(*) = 1 as ok, 'alice->dave block rows: ' || count(*)::text as detail from public.blocks where blocker_id = $1 and blocked_id = $2`, params: [A, D] } };
        break;
      case "remove_friend":
        guards.no_effect = { describe: "the database is unchanged by the call", snap: { kind: "database" } };
        guards.guard = { describe: "the alice<->bob friendship survives", after: { sql: `select count(*) = 1 as ok, 'alice<->bob friendship rows: ' || count(*)::text as detail from public.friendships where user_id_a = $1 and user_id_b = $2`, params: [A, B] } };
        break;
      case "player_public_profile":
        if (/non-friend projection/.test(res)) {
          results.non_friend_projection = {
            describe: "the one row returned is bob's, with is_friend = false",
            judge: (o) => {
              const r = (o.rows ?? [])[0];
              return { ok: (o.rows ?? []).length === 1 && r?.user_id === B && r?.is_friend === false, detail: `row user_id ${String(r?.user_id)}, is_friend ${String(r?.is_friend)}` };
            },
          };
        } else {
          premises.push(count("relationship", "alice->dave blocks", `public.blocks where blocker_id = $1 and blocked_id = $2`, "= 1", [A, D]));
          premises.push(count("relationship", "dave's profile (the target exists)", `public.profiles where id = $1`, "= 1", [D]));
          catalog.body_contains = bodyContains("player_public_profile", "if public.is_blocked_between(v_me, p_user_id) then return; end if;");
          reference = {
            describe: "the same call for an account id that does not exist ('no such player')",
            statement: s.statement, params: ["00000000-0000-4000-8000-0000000000f0"],
          };
          premises.push(count("relationship", "profiles carrying the reference's non-existent id", `public.profiles where id = $1`, "= 0", ["00000000-0000-4000-8000-0000000000f0"]));
        }
        break;
      case "viewer_is_friend_of":
        premises.push(count("relationship", "carol<->bob friendships", `public.friendships where user_id_a = $1 and user_id_b = $2`, "= 0", [B, CA]));
        premises.push(count("relationship", "bob's friendships (bob has a friend, so the helper has something to find)", `public.friendships where $1 in (user_id_a, user_id_b)`, ">= 1", [B]));
        break;
      case "viewer_has_blocked":
        premises.push(count("relationship", "blocks by carol", `public.blocks where blocker_id = $1`, "= 0", [CA]));
        premises.push(count("relationship", "blocks on dave by anyone (a block the helper could misreport)", `public.blocks where blocked_id = $1`, ">= 1", [D]));
        break;
      case "viewer_is_blocked_by":
        premises.push(count("relationship", "alice->carol blocks", `public.blocks where blocker_id = $1 and blocked_id = $2`, "= 0", [A, CA]));
        premises.push(count("relationship", "blocks by alice (a block the helper could misreport)", `public.blocks where blocker_id = $1`, ">= 1", [A]));
        break;
      case "retire_push_token":
        premises.push(count("relationship", "bob's token row, active", `public.push_tokens where token = $1 and user_id = $2 and is_active`, "= 1", [F.bobPushToken.value, B]));
        guards.no_effect = { describe: "the database is unchanged by the call", snap: { kind: "database" } };
        guards.guard = { describe: "bob's token row stays is_active = true", after: { sql: `select (is_active) as ok, 'bob token is_active = ' || is_active::text as detail from public.push_tokens where token = $1`, params: [F.bobPushToken.value] } };
        break;
      case "register_push_token":
        premises.push(count("relationship", "bob's token row", `public.push_tokens where token = $1 and user_id = $2`, "= 1", [F.bobPushToken.value, B]));
        guards.guard = { describe: "bob's token row still exists with user_id = bob", after: { sql: `select count(*) = 1 as ok, 'rows for that token still owned by bob: ' || count(*)::text as detail from public.push_tokens where token = $1 and user_id = $2`, params: [F.bobPushToken.value, B] } };
        guards.caller_row = { describe: "a row carrying that token attributed to alice", after: { sql: `select count(*) = 1 as ok, 'rows for that token attributed to alice: ' || count(*)::text as detail from public.push_tokens where token = $1 and user_id = $2`, params: [F.bobPushToken.value, A] } };
        break;
      case "join_private_room":
        premises.push(count("relationship", "rooms carrying the non-existent code", `public.rooms where code = $1`, "= 0", [F.nonexistentRoomCode.value]));
        premises.push(check("relationship", "the reference room is an expired private lobby", implFor("expired_room")!.verify));
        refusalByReturn = (o) => {
          const r = (o.rows ?? [])[0];
          const allNull = !!r && Object.values(r).every((v) => v === null);
          return { ok: !o.raised && (o.rows ?? []).length === 1 && allNull, detail: o.raised ? `raised ${o.sqlstate}` : `returned ${(o.rows ?? []).length} row(s)${allNull ? ", every column NULL (the function's documented refusal)" : ", not the NULL room"}` };
        };
        guards.no_join = { describe: "carol joined no room", snap: { kind: "sql", sql: `select count(*)::text as snap from public.room_members where user_id = $1 and status = 'joined'`, params: [CA] } };
        reference = { describe: "the same call with the code of an ineligible room (an expired private lobby)", statement: s.statement, params: [AUX.roomExpiredCode] };
        break;
      case "leaderboard_weekly_xp":
      case "leaderboard_daily_challenge":
      case "leaderboard_strategy_accuracy":
      case "leaderboard_tournament_wins": {
        if (t.identity === "anon") {
          catalog.execute_granted_authenticated = check("execute_granted_authenticated", `EXECUTE on ${fn} is granted to authenticated, not to anon`,
            `select (has_function_privilege('authenticated', p.oid, 'EXECUTE') and not has_function_privilege('anon', p.oid, 'EXECUTE')) as ok,
                    'authenticated EXECUTE: ' || has_function_privilege('authenticated', p.oid, 'EXECUTE')::text || ', anon EXECUTE: ' || has_function_privilege('anon', p.oid, 'EXECUTE')::text as detail
               from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = $1`, [fn]);
          break;
        }
        const erinOnBoard: Record<string, string> = {
          leaderboard_weekly_xp: `select count(*) > 0 as ok, 'erin (private) holds weekly XP: ' || count(*)::text as detail from public.player_daily_xp where user_id = $1 and utc_day >= public.utc_week_start() and (repeatable_xp + milestone_xp) > 0`,
          leaderboard_daily_challenge: `select count(*) > 0 as ok, 'erin (private) holds a completed entry today: ' || count(*)::text as detail from public.daily_entries e join public.daily_challenges c on c.id = e.daily_challenge_id where e.user_id = $1 and e.status = 'completed' and c.challenge_date = (now() at time zone 'utc')::date`,
          leaderboard_strategy_accuracy: `select count(*) > 0 as ok, 'erin (private) qualifies this week: ' || count(*)::text as detail from public.player_decision_periods where user_id = $1 and period_start = public.utc_week_start() and decisions_total >= public.strategy_accuracy_minimum_decisions()`,
          leaderboard_tournament_wins: `select count(*) > 0 as ok, 'erin (private) has a win in a completed tournament: ' || count(*)::text as detail from public.tournament_entries e join public.tournaments t on t.id = e.tournament_id where e.user_id = $1 and t.status = 'completed' and e.placement = 1`,
        };
        premises.push(check("relationship", "a private-privacy account (erin) holds data this board ranks", erinOnBoard[fn]!, [E]));
        premises.push(count("relationship", "erin's profile is private", `public.profiles where id = $1 and privacy = 'private'`, "= 1", [E]));
        break;
      }
      case "search_players":
        premises.push(count("relationship", "alice->dave blocks", `public.blocks where blocker_id = $1 and blocked_id = $2`, "= 1", [A, D]));
        premises.push(count("relationship", "profiles the query 'dave' would match absent the block (dave's)", `public.profiles where id = $1 and (username like 'dave%' or lower(display_name) like '%dave%')`, "= 1", [D]));
        break;
      case "ensure_todays_daily_challenge":
        premises.push(check("relationship", "today's challenge exists, open and unrevealed", implFor("f5_state:ensure_todays_daily_challenge")!.verify));
        guards.guard = { describe: "today's still-open challenge has revealed_seed IS NULL afterwards", after: { sql: `select (revealed_seed is null and seed_revealed_at is null) as ok, 'today''s challenge revealed_seed ' || coalesce(revealed_seed, 'NULL') as detail from public.daily_challenges where challenge_date = (now() at time zone 'utc')::date`, params: [] } };
        break;
      case "latest_verifiable_daily_challenge":
        premises.push(check("relationship", "one revealed and one later unrevealed challenge exist", implFor("f5_state:latest_verifiable_daily_challenge")!.verify));
        break;
      case "join_matchmaking":
        guards.guard = { describe: "exactly one waiting queue row for alice appears", after: { sql: `select count(*) = 1 as ok, 'alice queue rows after the call: ' || count(*)::text as detail from public.matchmaking_queue where user_id = $1`, params: [A] } };
        guards.guard2 = {
          describe: "no other account's queue row appears or changes, except a stale entry turning 'expired'",
          // A stale entry reads the same before (waiting, past expiry) and after
          // (expired), so housekeeping it performs is not counted as a change.
          snap: { kind: "sql", sql: `select coalesce(string_agg(id::text || ':' || user_id::text || ':' || case when status in ('waiting','expired') and expires_at < now() then 'stale' else status::text end, ',' order by id), '') as snap from public.matchmaking_queue where user_id <> $1`, params: [A] },
          permitsStaleExpiry: true,
        };
        guards.guard3 = { describe: "bob's fresh entry is untouched", snap: { kind: "sql", sql: `select row_to_json(q)::text as snap from public.matchmaking_queue q where id = $1`, params: [AUX.queueBob] } };
        break;
      case "poll_matchmaking":
        results.own_queue_entry = {
          describe: "the returned entry is alice's: its waiting_since and tier are her queue row's",
          adminBefore: { sql: `select enqueued_at, tier::text as tier from public.matchmaking_queue where id = $1`, params: [AUX.queueAlice] },
          judge: (o, _after, before) => {
            const r = (o.rows ?? [])[0];
            const b = before[0];
            const ok = (o.rows ?? []).length === 1 && !!b && new Date(String(r?.waiting_since)).getTime() === new Date(String(b.enqueued_at)).getTime() && r?.tier === b.tier;
            return { ok, detail: `returned waiting_since ${String(r?.waiting_since)}, tier ${String(r?.tier)}; alice's entry enqueued_at ${String(b?.enqueued_at)}, tier ${String(b?.tier)}` };
          },
        };
        break;
      case "create_private_room":
        guards.guard = { describe: "no rooms row is created", snap: { kind: "tables", tables: ["public.rooms"] } };
        break;
    }

    // Gate A, D-283 (D3.54): delete_own_account's function-specific invariant.
    if (fn === "delete_own_account") {
      const others = [B, CA, D, E];
      reachability = CALLER_SCOPED.delete_own_account!.reach;
      guards.caller_account_removed = {
        describe: "alice's account is gone: no auth.users row and no profile",
        after: {
          sql: `select (u = 0 and p = 0) as ok, 'auth.users rows for alice: ' || u::text || ', profiles rows for alice: ' || p::text as detail
                  from (select (select count(*) from auth.users where id = $1) u, (select count(*) from public.profiles where id = $1) p) x`,
          params: [A],
        },
      };
      guards.documented_effects_only = {
        describe: "every change to a row naming another account (bob, carol, dave or erin) is a documented deletion effect",
        snap: { kind: "account_rows_json", include: [A, ...others] },
        judge: (before, after) => classifyAccountDeletion(before, after, A, others),
      };
      guards.no_unrelated_change = {
        describe: "no table the foreign keys do not connect to an account changes",
        snap: { kind: "unrelated_tables" },
      };
      premises.push(check("relationship", "bob and carol hold rows in every table the function reads", implFor("caller_scoped_population")!.verify));
    }

    // Caller-scoped: the shared invariant, made concrete per function (D3.41).
    if (/\[no_target, caller-scoped\]/.test(t.covers)) {
      const cs = CALLER_SCOPED[fn];
      if (!cs) throw new Error(`${t.testId}: no caller-scoped binding for ${fn}`);
      results.only_own = cs.only;
      if (cs.reach) reachability = cs.reach;
      guards.only_own_altered = { describe: "no row naming another account (bob, carol, dave or erin) and not alice changes", snap: { kind: "account_rows", include: [B, CA, D, E], exclude: [A] } };
      guards.no_bob_carol_change = { describe: "no row naming bob or carol and not alice changes", snap: { kind: "account_rows", include: [B, CA], exclude: [A] } };
      premises.push(check("relationship", "bob and carol hold rows in every table the function reads", implFor("caller_scoped_population")!.verify));
    }
  }

  // ---------------------------------------------------------------- F9
  if (fam === "F9") {
    if (/debit larger than the balance/.test(t.operation)) {
      guards.balance_unchanged_non_negative = {
        describe: "alice's balance and ledger are unchanged, and the balance is non-negative",
        snap: { kind: "sql", sql: `select (select balance::text from public.wallets where user_id = $1) || '/' || (select count(*)::text from public.wallet_ledger where user_id = $1) as snap`, params: [A] },
        after: { sql: `select (balance >= 0) as ok, 'alice balance ' || balance::text as detail from public.wallets where user_id = $1`, params: [A] },
      };
    }
    if (/append_only|every role/.test(t.expected)) namedTrigger = { trigger: "wallet_ledger_append_only", fn: "guard_ledger_append_only" };
    if (/deny_truncate/.test(t.expected)) namedTrigger = { trigger: "wallet_ledger_deny_truncate", fn: "deny_truncate" };
  }

  // Every result that names people is scanned for bob and carol, and for erin
  // where a claim is about private-privacy identities.
  results.excludes_bob_carol ??= {
    describe: "no returned value carries bob's or carol's id, username or display name",
    judge: (o) => { const hit = containsAny(o, BOB_CAROL); return { ok: hit.length === 0, detail: hit.length ? `found ${hit.join(", ")}` : `${(o.rows ?? []).length} row(s), none naming bob or carol` }; },
  };

  return {
    setupKey, premises, catalog, guards, reference, refusalSites, refusalByReturn, results, reachability,
    namedTrigger, namedPolicy, trailColumns,
  };
}

function policyUsing(res: string, pol: string, expr: string): AdminCheck {
  // pg_policies renders `is_active is true` as `is_active`; the approved text
  // quotes the planner's own rendering, so both forms are accepted as equal.
  const alt = expr.replace(/^(\w+) is true$/, "$1");
  return check("policy_using_exact", `${pol} USING is exactly \`${expr}\``,
    `select (qual in ($3, $4, '(' || $3 || ')', '(' || $4 || ')') or replace(replace(qual, '''', ''), '::tournament_status', '') in ($3, $4, '(' || replace($4, '''', '') || ')', replace($4, '''', ''))) as ok,
            $2 || ' USING = ' || qual as detail
       from pg_policies where schemaname || '.' || tablename = $1 and policyname = $2`, [res, pol, expr, alt]);
}

function noPolicyNamesAnon(): AdminCheck {
  return check("no_policy_names_anon", "no policy on realtime.messages names anon or PUBLIC",
    `select count(*) = 0 as ok, 'policies on realtime.messages naming anon or public: ' || count(*)::text as detail
       from pg_policies where schemaname = 'realtime' and tablename = 'messages' and ('anon' = any(roles) or 'public' = any(roles))`);
}

function bodyContains(fn: string, text: string): AdminCheck {
  return check("body_contains", `${fn}'s body contains \`${text}\``,
    `select (position($2 in regexp_replace(p.prosrc, '\\s+', ' ', 'g')) > 0) as ok, $1 || ' body contains the text: ' || (position($2 in regexp_replace(p.prosrc, '\\s+', ' ', 'g')) > 0)::text as detail
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = $1`,
    [fn, text]);
}

/** Names the display-name check uses. */
export const ERIN = { id: E, displayName: ERIN_DISPLAY_NAME } as const;
