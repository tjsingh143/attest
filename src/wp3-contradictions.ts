/**
 * Attest — approved rows that cannot measure what they claim.
 *
 * Plan contradictions of the C1 kind (a row whose own fields disagree) live in
 * `plan-contradictions.ts` and block execution. This module holds a second
 * kind, found while hardening the executor: a row that is internally
 * consistent but whose approved expectation the SYSTEM makes unreachable —
 * the named trigger sits behind a grant the caller does not hold, the approved
 * literal violates a CHECK constraint, the deleted-user filter names rows the
 * schema's own cascades remove.
 *
 * None is resolved here, because each resolution changes an approved row's
 * frozen field (operation, expected, identity) and that is the author's
 * decision (brief §1.1, D3.35). None is worked around either: the executor
 * still runs the probe exactly as approved and records what happened, and the
 * disposition is `blocked_contradiction` → `not_measured`, never a verdict. A
 * false "effective" would be false assurance; a false "deficient" would be a
 * finding against a working control.
 *
 * Every registration carries a LIVE check — a catalog read that returns true
 * while the contradiction still holds. Preflight runs them all: a registration
 * whose check no longer holds (Arc21 changed, or the reading was wrong) fails
 * preflight as stale, so a contradiction cannot outlive its evidence.
 */
import type { Session } from "./db.ts";

export interface RegisteredContradiction {
  readonly id: string;
  readonly testIds: readonly string[];
  /** One line: why the approved claim cannot be measured. */
  readonly summary: string;
  /** The approved text that states the unreachable claim. */
  readonly approvedSays: string;
  /** What the system does instead, with where that was read from. */
  readonly systemSays: string;
  /** A catalog read returning `holds boolean, detail text`: true while the contradiction still holds. */
  readonly liveCheck: string;
  /** The smallest change the author could make. Not applied. */
  readonly proposedResolution: string;
  /**
   * Premise ids this contradiction makes false BY CONSTRUCTION, and so the
   * only ones preflight may excuse on these Test IDs. Every other premise must
   * still hold: C5 excuses the empty subject, never "dave is deleted".
   */
  readonly exemptPremises: readonly string[];
  /**
   * SQLSTATEs the approved statement is predicted to produce BECAUSE of this
   * contradiction. An outcome carrying one is the contradiction's disposition
   * (blocked_contradiction), not a harness defect — and a derived statement
   * that fails to compile with one is excused in preflight for the same reason.
   */
  readonly predictedSqlstates?: readonly string[];
}

const LEDGER_FKS = `(select string_agg(conrelid::regclass::text || '.' || conname, ', ') from pg_constraint where contype = 'f' and confrelid = 'public.wallet_ledger'::regclass)`;

export const REGISTERED_CONTRADICTIONS: readonly RegisteredContradiction[] = [
  {
    id: "C2-grant-before-trigger",
    testIds: ["F9.public_wallets.319", "F9.public_wallets.321"],
    summary: "the approved expectation names a wallet_ledger trigger as the refusal, but an ordinary client holds no UPDATE or TRUNCATE privilege on wallet_ledger, so the privilege check refuses first and the trigger is never reached",
    approvedSays: "'error — UPDATE is rejected by wallet_ledger_append_only' (.319, as alice); 'error — refused by wallet_ledger_deny_truncate' (.321, as alice)",
    systemSays: "authenticated holds only SELECT on public.wallet_ledger; PostgreSQL checks table privileges before any trigger fires, so the refusal is 42501 'permission denied for table wallet_ledger'",
    liveCheck: `select (not has_table_privilege('authenticated', 'public.wallet_ledger', 'UPDATE') and not has_table_privilege('authenticated', 'public.wallet_ledger', 'TRUNCATE')) as holds,
                       'authenticated UPDATE: ' || has_table_privilege('authenticated', 'public.wallet_ledger', 'UPDATE')::text ||
                       ', TRUNCATE: ' || has_table_privilege('authenticated', 'public.wallet_ledger', 'TRUNCATE')::text as detail`,
    exemptPremises: [],
    proposedResolution: "restate each expectation as the privilege refusal it is ('error 42501 — refused before any trigger is consulted: authenticated holds no UPDATE/TRUNCATE on wallet_ledger'), or, if the trigger is the point, keep only the server-side rows (.320, .322) as the trigger's evidence",
  },
  {
    id: "C2-fk-before-truncate-trigger",
    testIds: ["F9.public_wallets.322"],
    summary: "TRUNCATE of a table another table references is refused by PostgreSQL's foreign-key check (0A000) before BEFORE TRUNCATE triggers fire, so wallet_ledger_deny_truncate is never reached by the approved statement",
    approvedSays: "'error — refused by wallet_ledger_deny_truncate' for a server-side `truncate public.wallet_ledger`",
    systemSays: "career_progress, daily_entries and tournament_entries hold foreign keys to wallet_ledger; ExecuteTruncate checks referencing keys before it fires statement triggers (observed in D3.28)",
    liveCheck: `select exists (select 1 from pg_constraint where contype = 'f' and confrelid = 'public.wallet_ledger'::regclass) as holds,
                       'foreign keys referencing wallet_ledger: ' || coalesce(${LEDGER_FKS}, 'none') as detail`,
    exemptPremises: [],
    proposedResolution: "restate the expectation as 'error — refused (0A000: the ledger is referenced, so TRUNCATE is refused before its trigger)', or make the operation `truncate public.wallet_ledger cascade` so the trigger is what refuses",
  },
  {
    id: "C2-definer-bypasses-named-policy",
    testIds: ["F5.send_friend_request.259"],
    summary: "the approved expectation attributes the refusal to the RLS policy friend_requests_insert_as_sender, but send_friend_request is SECURITY DEFINER, so the caller's policies are never consulted; the refusal is the body's own is_blocked_between check",
    approvedSays: "'refusal — friend_requests_insert_as_sender requires NOT viewer_has_blocked(receiver_id)'",
    systemSays: "send_friend_request runs as its owner and raises PT404 'no such player' when is_blocked_between(caller, receiver) — before any insert, so no policy is evaluated",
    liveCheck: `select (p.prosecdef and position('if public.is_blocked_between(v_me, p_to) then' in regexp_replace(p.prosrc, '\\s+', ' ', 'g')) > 0) as holds,
                       'prosecdef ' || p.prosecdef::text || '; body refuses on is_blocked_between before inserting: ' ||
                       (position('if public.is_blocked_between(v_me, p_to) then' in regexp_replace(p.prosrc, '\\s+', ' ', 'g')) > 0)::text as detail
                  from pg_proc p where p.oid = 'public.send_friend_request(uuid)'::regprocedure`,
    exemptPremises: [],
    proposedResolution: "restate the expectation as 'refusal — the function body refuses with PT404 \"no such player\" because is_blocked_between(caller, receiver)'; the property (a blocked receiver is refused) is unchanged, only the mechanism the text names",
  },
  {
    id: "C3-sender-cannot-accept",
    testIds: ["F3.public_friend_requests.059"],
    summary: "the approved positive has the SENDER set status = 'accepted'; guard_friend_request_transition lets only the receiver accept, and as a BEFORE trigger it refuses before the policy's WITH CHECK is evaluated",
    approvedSays: "`UPDATE public.friend_requests set status = 'accepted' where sender_id = fixtures.alice.id` → '1 row affected, and the row is still attributed to alice afterwards'",
    systemSays: "guard_friend_request_transition raises 42501 'only the receiver may accept or decline a friend request' for a client whose auth.uid() is the sender",
    liveCheck: `select (t.tgenabled <> 'D' and position('only the receiver may accept or decline' in p.prosrc) > 0) as holds,
                       'friend_requests_guard_transition enabled: ' || (t.tgenabled <> 'D')::text as detail
                  from pg_trigger t join pg_proc p on p.oid = t.tgfoid
                 where t.tgrelid = 'public.friend_requests'::regclass and t.tgname = 'friend_requests_guard_transition'`,
    exemptPremises: [],
    proposedResolution: "change the positive's literal to the one transition a sender may make ('cancelled'), or have the receiver accept (`… where receiver_id = fixtures.alice.id` over a request alice received)",
  },
  {
    id: "C3-username-literal-invalid",
    testIds: ["F3.public_profiles.151", "F6.public_profiles.153"],
    summary: "the approved positive sets username = 'attest-probe-username', which Arc21 refuses (23514) before the write can be admitted: the BEFORE UPDATE trigger guard_profile_username rejects it through username_is_permitted() (a hyphen, 21 characters), and profiles_username_check (^[a-z0-9_]{3,20}$) would refuse it independently. The positive fails on an unrelated username rule before it can show the write is admitted",
    approvedSays: "`UPDATE public.profiles set username = 'attest-probe-username' where id = fixtures.alice.id` → '1 row affected …'",
    systemSays: "observed as alice (2026-09-24 mechanism check, rolled back): 23514 'username \"attest-probe-username\" is reserved or not permitted', raised in guard_profile_username(); the registration first recorded only the CHECK constraint, which a BEFORE trigger precedes. The literal was generated mechanically by literalFor(), which reads neither triggers nor CHECK constraints",
    liveCheck: `select (not public.username_is_permitted('attest-probe-username')
                        and not ('attest-probe-username' ~ '^[a-z0-9_]{3,20}$')
                        and exists (select 1 from pg_trigger where tgrelid = 'public.profiles'::regclass and tgname = 'profiles_guard_username' and tgenabled <> 'D')) as holds,
                       'username_is_permitted: ' || public.username_is_permitted('attest-probe-username')::text ||
                       '; matches profiles_username_check: ' || ('attest-probe-username' ~ '^[a-z0-9_]{3,20}$')::text as detail`,
    exemptPremises: [],
    proposedResolution: "replace the literal with one the column accepts and no reserved-word filter refuses, e.g. 'attest_probe_user' (verified 2026-09-24: 1 row affected as alice, rolled back). Note the trigger also spends alice's one 'profile_username_change' rate-limit event per 30 days; each positive runs on its own rebuilt baseline, so the two positives do not share it",
  },
  {
    id: "C3-cosmetic-literal-invalid",
    testIds: ["F6.public_loadouts.117"],
    summary: "the approved positive equips avatar_cosmetic_id = '00000000-0000-4000-8000-0000000000ff', which is no cosmetic, so loadouts_guard_slots refuses it (23503) before the column grant the row examines can be shown to admit the write",
    approvedSays: "`UPDATE public.loadouts set avatar_cosmetic_id = '00000000-0000-4000-8000-0000000000ff' where user_id = fixtures.alice.id` → '1 row affected — a granted column on the caller's own row'",
    systemSays: "guard_loadout_slots raises 23503 'cosmetic … is not available' for a slot naming no active cosmetic; the literal came from literalFor()",
    liveCheck: `select (not exists (select 1 from public.cosmetics where id = '00000000-0000-4000-8000-0000000000ff')) as holds,
                       'a cosmetic with that id exists: ' || exists (select 1 from public.cosmetics where id = '00000000-0000-4000-8000-0000000000ff')::text as detail`,
    exemptPremises: [],
    proposedResolution: "replace the literal with a cosmetic alice owns (the fixture gives her avatar-house-dealer), or with NULL (unequip), either of which the slot guard accepts",
  },
  {
    id: "C4-anon-has-no-execute",
    testIds: ["F5.latest_verifiable_daily_challenge.278"],
    summary: "the approved row calls latest_verifiable_daily_challenge() as anon and expects the revealed challenge back, but EXECUTE is granted to authenticated only, so anon is refused (42501) before the function body — the control the row examines — runs",
    approvedSays: "'as anon, call latest_verifiable_daily_challenge() …' → 'exactly the revealed challenge is returned; …'",
    systemSays: "pg_proc.proacl for latest_verifiable_daily_challenge() grants EXECUTE to postgres and authenticated, not to anon or PUBLIC",
    liveCheck: `select (not has_function_privilege('anon', 'public.latest_verifiable_daily_challenge()', 'EXECUTE')) as holds,
                       'anon EXECUTE: ' || has_function_privilege('anon', 'public.latest_verifiable_daily_challenge()', 'EXECUTE')::text as detail`,
    exemptPremises: [],
    proposedResolution: "run the row as an authenticated caller (the function does not read auth.uid(), so the invariant is identity-independent), which changes identity and operation; or keep anon and change the expectation to 'error 42501' — a different claim (who may call it), which the author may prefer as a separate row",
  },
  {
    id: "C5-deleted-user-subject-empty",
    testIds: [
      "B.private_game_commands.323", "B.public_blocks.325", "B.public_friend_requests.327", "B.public_friendships.329",
      "B.public_game_events.331", "B.public_game_session_seats.332", "B.public_game_sessions.333", "B.public_profiles.335",
      "B.public_rate_limit_events.336", "B.public_room_members.337", "B.public_rooms.338", "B.public_tournament_entries.340",
      "B.public_wallet_ledger.342", "B.public_wallets.344",
    ],
    summary: "after a genuine deletion (Arc21's delete_own_account), every owner column these probes filter on is emptied by the schema's own ON DELETE CASCADE or SET NULL, so no row can name the deleted account: 'no data' is produced by referential actions, not by any control evaluating the stale identity. B.323 and B.336 also contradict 'and no error': authenticated holds no privilege on private.game_commands or rate_limit_events",
    approvedSays: "'select from <resource> where the owner column names fixtures.dave.id, the deleted account' → 'no data — and no error. A token outliving its account must not become a key to whatever the cascade left behind'",
    systemSays: "every foreign key from those owner columns to profiles/auth.users is ON DELETE CASCADE or SET NULL (read from pg_constraint); the rows the cascade leaves behind (SET NULL) no longer name the account, so the approved filter cannot select them",
    liveCheck: `select bool_and(confdeltype in ('c','n')) as holds,
                       string_agg(conrelid::regclass::text || '.' || a.attname || ' on delete ' || case confdeltype when 'c' then 'CASCADE' when 'n' then 'SET NULL' else confdeltype::text end, ', ' order by 1) as detail
                  from pg_constraint c
                  join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
                 where c.contype = 'f'
                   and (c.conrelid::regclass::text, a.attname) in (
                     ('private.game_commands','user_id'), ('blocks','blocker_id'), ('friend_requests','sender_id'),
                     ('friendships','user_id_a'), ('game_events','recipient_user_id'), ('game_session_seats','user_id'),
                     ('game_sessions','host_user_id'), ('profiles','id'), ('rate_limit_events','user_id'),
                     ('room_members','user_id'), ('rooms','host_user_id'), ('tournament_entries','user_id'),
                     ('wallet_ledger','user_id'), ('wallets','user_id'))`,
    exemptPremises: ["subject"],
    proposedResolution: "redefine the boundary probe to target what the cascade leaves behind — e.g. before the deletion, record a row the account could read that survives it (a seat whose user_id becomes NULL, a session it hosted), then query THAT row with the stale token — or accept these rows as characterization ('deletion cascades; nothing remains keyed to the account')",
  },
  {
    id: "C2-client-guard-before-grant",
    testIds: [
      "F2.private_career_drill_seeds.002", "F2.private_career_drill_seeds.003", "F2.private_game_commands.008",
      "F2.private_game_commands.009", "F2.private_game_state_private.017", "F2.private_game_state_private.018",
      "F2.public_daily_challenges.042", "F2.public_daily_challenges.043", "F2.public_game_events.075",
      "F2.public_game_events.076", "F2.public_game_session_seats.086", "F2.public_game_session_seats.087",
      "F2.public_game_sessions.094", "F2.public_game_sessions.095", "F2.public_hand_records.105",
      "F2.public_hand_records.106", "F2.public_rate_limit_events.167", "F2.public_rate_limit_events.168",
      "F2.public_rate_limit_policies.176", "F2.public_rate_limit_policies.177", "F2.public_room_members.184",
      "F2.public_room_members.185", "F2.public_rooms.192", "F2.public_rooms.193",
      "F2.public_rulesets.198", "F2.public_rulesets.199", "F2.public_tournament_entries.207",
      "F2.public_tournament_entries.208", "F2.public_tournament_matches.215", "F2.public_tournament_matches.216",
      "F2.public_wallet_ledger.228", "F2.public_wallet_ledger.229", "F2.public_wallets.239",
      "F2.public_wallets.240",
    ],
    summary: "the approved grant-surface statement is an UPDATE or DELETE with no WHERE clause; every client connection arrives through `authenticator`, which preloads pg_safeupdate, and pg_safeupdate refuses such a statement at parse analysis (21000) — before the privilege check the expectation names is ever made",
    approvedSays: "e.g. `update public.game_sessions set tier = 'attest-probe-tier'` / `delete from public.wallets` as alice → 'error 42501 — refused before any policy is consulted'",
    systemSays: "pg_db_role_setting gives authenticator session_preload_libraries = 'supautils, safeupdate'; observed as alice: `update public.game_sessions set tier = tier` → 21000 'UPDATE requires a WHERE clause', not 42501. Parse-analysis hooks run before the executor's permission check",
    liveCheck: `select coalesce(bool_or(x like 'session_preload_libraries=%safeupdate%'), false) as holds,
                       'authenticator ' || coalesce(string_agg(x, '; ') filter (where x like 'session_preload_libraries=%'), 'has no session_preload_libraries setting') as detail
                  from pg_db_role_setting s join pg_roles r on r.oid = s.setrole cross join lateral unnest(s.setconfig) x
                 where r.rolname = 'authenticator'`,
    exemptPremises: [],
    predictedSqlstates: ["21000"],
    proposedResolution: "append a WHERE clause to each of the 34 approved operations — `where true` suffices, since pg_safeupdate only requires that one exist — so the statement reaches the privilege check the expectation names; the property under test (no client UPDATE/DELETE grant) is unchanged. Alternatively restate the expectation as the pg_safeupdate refusal, which is a different claim (a platform guard, not Arc21's grants)",
  },
  {
    id: "C3-tier-literal-invalid",
    testIds: ["F2.public_game_sessions.094"],
    summary: "the approved statement sets tier = 'attest-probe-tier', which is not a value of the enum table_tier, so the statement fails to parse (22P02) before any privilege or client guard is consulted",
    approvedSays: "`update public.game_sessions set tier = 'attest-probe-tier'` → 'error 42501 — refused before any policy is consulted'",
    systemSays: "public.table_tier is an enum of casual, standard, high; an unknown enum literal is rejected while the statement is analysed (22P02 'invalid input value for enum table_tier'); the literal came from literalFor(), which does not read enum labels",
    liveCheck: `select (not exists (select 1 from pg_enum where enumtypid = 'public.table_tier'::regtype and enumlabel = 'attest-probe-tier')) as holds,
                       'table_tier labels: ' || (select string_agg(enumlabel::text, ', ' order by enumsortorder) from pg_enum where enumtypid = 'public.table_tier'::regtype) as detail`,
    exemptPremises: [],
    predictedSqlstates: ["22P02"],
    proposedResolution: "replace the literal with a label the enum has (e.g. 'casual'), and — per C2-client-guard-before-grant — add a WHERE clause, so the statement reaches the privilege check",
  },
];

const BY_TEST = new Map<string, RegisteredContradiction[]>();
for (const c of REGISTERED_CONTRADICTIONS) for (const id of c.testIds) BY_TEST.set(id, [...(BY_TEST.get(id) ?? []), c]);

/** Every registration naming this Test ID (one row can carry more than one, e.g. F2.094). */
export function registeredContradictionsFor(testId: string): readonly RegisteredContradiction[] {
  return BY_TEST.get(testId) ?? [];
}

/** The combined disposition an evidence record carries. */
export function contradictionDisposition(testId: string): { id: string; reason: string; predictedSqlstates: string[] } | null {
  const cs = registeredContradictionsFor(testId);
  if (!cs.length) return null;
  return { id: cs.map((c) => c.id).join(" + "), reason: cs.map((c) => c.summary).join(" | "), predictedSqlstates: cs.flatMap((c) => c.predictedSqlstates ?? []) };
}

export interface ContradictionCheck {
  readonly id: string;
  readonly testIds: readonly string[];
  readonly holds: boolean;
  readonly detail: string;
}

/** Run every registration's live check. A registration that no longer holds is stale. */
export async function checkRegisteredContradictions(admin: Session): Promise<ContradictionCheck[]> {
  const out: ContradictionCheck[] = [];
  for (const c of REGISTERED_CONTRADICTIONS) {
    try {
      const { rows } = await admin.query(c.liveCheck);
      const r = rows[0] as { holds?: boolean; detail?: string } | undefined;
      out.push({ id: c.id, testIds: c.testIds, holds: r?.holds === true, detail: String(r?.detail ?? "no row") });
    } catch (err) {
      out.push({ id: c.id, testIds: c.testIds, holds: false, detail: `the live check raised: ${(err as Error).message}` });
    }
  }
  return out;
}
